/**
 * SIMULATION D'UN SERVICE — logique pure, sans Phaser.
 *
 * Toute action d'un joueur passe par `dispatch(action)` et le temps avance avec `tick(dt)`.
 * C'est ce qui permettra la coop en ligne : l'hôte fait tourner la simulation,
 * les autres joueurs envoient leurs actions et reçoivent l'état (voir docs/ARCHITECTURE.md).
 */
import { BALANCE, TILE, HUD_HEIGHT, type IngredientState, type Part, type RecipeDef } from '../config/content';
import { Grid, tileCenter, worldToTile, type StationSpec, type Tile } from './grid';
import { canAddToPlate, canChop, canCook, dishOf, ingredientsForStage, partOf, recipesForStage } from './recipes';
import type { ServiceParams } from './progress';

export type Item =
  | { kind: 'ing'; id: string; state: IngredientState }
  | { kind: 'plate'; parts: Part[] };

export interface StationState {
  spec: StationSpec;
  item: Item | null;
  /** Secondes de découpe ou de cuisson accumulées. */
  progress: number;
  locked: boolean;
}

export interface PlayerState {
  id: string;
  x: number;
  y: number;
  faceX: number;
  faceY: number;
  holding: Item | null;
  input: { dx: number; dy: number };
  path: Tile[];
  pendingStation: string | null;
  speed: number;
}

export type CustomerPhase = 'arriving' | 'waiting' | 'eating' | 'leaving';

export interface CustomerState {
  id: number;
  tableId: string;
  order: string;
  phase: CustomerPhase;
  t: number;
  patience: number;
  patienceMax: number;
  color: number;
  happy: boolean;
}

export type SimEvent =
  | { type: 'served'; customer: number; coins: number; tip: number; x: number; y: number }
  | { type: 'left'; customer: number }
  | { type: 'arrived'; customer: number }
  | { type: 'pickup' | 'drop' | 'chopDone' | 'cookDone' | 'burnt' | 'trash' | 'nope'; x: number; y: number }
  | { type: 'closing' }
  | { type: 'ended' };

export type Action =
  | { type: 'input'; player: string; dx: number; dy: number }
  | { type: 'interact'; player: string }
  | { type: 'interactAt'; player: string; station: string }
  | { type: 'moveTo'; player: string; tx: number; ty: number };

export class KitchenSim {
  readonly grid: Grid;
  readonly stations: StationState[];
  readonly players = new Map<string, PlayerState>();
  readonly customers: CustomerState[] = [];
  readonly recipes: RecipeDef[];
  readonly events: SimEvent[] = [];
  time = 0;
  coins = 0;
  served = 0;
  left = 0;
  ended = false;
  private nextSpawn: number;
  private nextCustomerId = 1;
  private closingAnnounced = false;
  private rng: () => number;

  constructor(readonly params: ServiceParams, rng: () => number = Math.random, grid = new Grid()) {
    this.rng = rng;
    this.grid = grid;
    this.recipes = recipesForStage(params.stage);
    const ingredients = ingredientsForStage(params.stage);
    this.stations = grid.stations.map((spec) => ({
      spec,
      item: null,
      progress: 0,
      locked:
        (spec.type === 'table' && spec.index >= params.tables) ||
        (spec.type === 'stove' && spec.index >= params.stoves) ||
        (spec.type === 'crate' && (!spec.ingredient || !ingredients.includes(spec.ingredient))),
    }));
    this.nextSpawn = BALANCE.firstCustomerDelay;
  }

  addPlayer(id: string, tile: Tile = { x: 3, y: 6 }, speed = this.params.playerSpeed): PlayerState {
    const c = tileCenter(tile.x, tile.y);
    const p: PlayerState = { id, x: c.x, y: c.y, faceX: 0, faceY: 1, holding: null, input: { dx: 0, dy: 0 }, path: [], pendingStation: null, speed };
    this.players.set(id, p);
    return p;
  }

  station(id: string) {
    return this.stations.find((s) => s.spec.id === id);
  }

  get timeLeft() {
    return Math.max(0, BALANCE.serviceSeconds - this.time);
  }

  // ───────────────────────── Actions ─────────────────────────

  dispatch(a: Action): void {
    const p = this.players.get(a.player);
    if (!p || this.ended) return;
    switch (a.type) {
      case 'input':
        p.input = { dx: a.dx, dy: a.dy };
        if (a.dx || a.dy) { p.path = []; p.pendingStation = null; }
        break;
      case 'interact': {
        const s = this.targetStation(p);
        if (s) this.interact(p, s);
        break;
      }
      case 'moveTo': {
        const path = this.grid.path(worldToTile(p.x, p.y), { x: a.tx, y: a.ty });
        if (path) { p.path = path; p.pendingStation = null; }
        break;
      }
      case 'interactAt': {
        const s = this.station(a.station);
        if (!s) return;
        const here = worldToTile(p.x, p.y);
        if (this.isAdjacent(here, s.spec)) { this.face(p, s.spec); this.interact(p, s); return; }
        for (const n of this.grid.freeNeighbours(s.spec, here)) {
          const path = this.grid.path(here, n);
          if (path) { p.path = path; p.pendingStation = s.spec.id; return; }
        }
        break;
      }
    }
  }

  private isAdjacent(t: Tile, s: StationSpec) {
    return Math.abs(t.x - s.tx) + Math.abs(t.y - s.ty) === 1;
  }

  private face(p: PlayerState, s: StationSpec) {
    const t = worldToTile(p.x, p.y);
    p.faceX = Math.sign(s.tx - t.x);
    p.faceY = Math.sign(s.ty - t.y);
  }

  /** Station visée : celle en face du joueur, sinon la plus proche autour de lui. */
  targetStation(p: PlayerState): StationState | undefined {
    const t = worldToTile(p.x, p.y);
    const front = this.grid.stationAt(t.x + p.faceX, t.y + p.faceY);
    if (front) return this.station(front.id);
    const around = [[0, 1], [0, -1], [1, 0], [-1, 0]]
      .map(([dx, dy]) => this.grid.stationAt(t.x + dx, t.y + dy))
      .filter((s): s is StationSpec => !!s);
    return around.length ? this.station(around[0].id) : undefined;
  }

  // ───────────────────────── Règles d'interaction ─────────────────────────

  private fx(type: 'pickup' | 'drop' | 'chopDone' | 'cookDone' | 'burnt' | 'trash' | 'nope', s: StationSpec) {
    const c = tileCenter(s.tx, s.ty);
    this.events.push({ type, x: c.x, y: c.y });
  }

  interact(p: PlayerState, s: StationState): void {
    if (s.locked) return this.fx('nope', s.spec);
    const h = p.holding;
    switch (s.spec.type) {
      case 'crate': {
        const ing = s.spec.ingredient!;
        if (!h) { p.holding = { kind: 'ing', id: ing, state: 'brut' }; return this.fx('pickup', s.spec); }
        if (h.kind === 'ing' && h.id === ing && h.state === 'brut') { p.holding = null; return this.fx('drop', s.spec); }
        if (h.kind === 'plate' && canAddToPlate(h.parts, partOf(ing, 'brut'), this.recipes)) {
          h.parts.push(partOf(ing, 'brut'));
          return this.fx('drop', s.spec);
        }
        return this.fx('nope', s.spec);
      }
      case 'plates':
        if (!h) { p.holding = { kind: 'plate', parts: [] }; return this.fx('pickup', s.spec); }
        if (h.kind === 'plate' && h.parts.length === 0) { p.holding = null; return this.fx('drop', s.spec); }
        return this.fx('nope', s.spec);
      case 'trash':
        if (!h) return this.fx('nope', s.spec);
        if (h.kind === 'plate') h.parts = [];
        else p.holding = null;
        return this.fx('trash', s.spec);
      case 'table':
        return this.serve(p, s);
      case 'board':
        if (h && h.kind === 'ing' && !s.item && !canChop(h.id, h.state)) return this.fx('nope', s.spec);
        return this.swapOrCombine(p, s);
      case 'stove':
        if (h && h.kind === 'ing' && !s.item && !canCook(h.id, h.state)) return this.fx('nope', s.spec);
        if (h && h.kind === 'plate' && s.item?.kind === 'ing' && s.item.state === 'brut') return this.fx('nope', s.spec);
        return this.swapOrCombine(p, s);
      case 'counter':
        return this.swapOrCombine(p, s);
    }
  }

  /** Poser / prendre / assembler sur un plan de travail, une planche ou une poêle. */
  private swapOrCombine(p: PlayerState, s: StationState) {
    const h = p.holding;
    const it = s.item;
    if (!h && it) { p.holding = it; s.item = null; s.progress = 0; return this.fx('pickup', s.spec); }
    if (h && !it) {
      if (s.spec.type !== 'counter' && h.kind === 'plate') return this.fx('nope', s.spec);
      s.item = h; p.holding = null; s.progress = 0; return this.fx('drop', s.spec);
    }
    if (h && it) {
      // Assiette en main + ingrédient posé → on le met dans l'assiette.
      if (h.kind === 'plate' && it.kind === 'ing') {
        const part = partOf(it.id, it.state);
        if (it.state !== 'brule' && canAddToPlate(h.parts, part, this.recipes)) {
          h.parts.push(part); s.item = null; s.progress = 0; return this.fx('pickup', s.spec);
        }
      }
      // Ingrédient en main + assiette posée → on garnit l'assiette.
      if (h.kind === 'ing' && it.kind === 'plate') {
        const part = partOf(h.id, h.state);
        if (h.state !== 'brule' && canAddToPlate(it.parts, part, this.recipes)) {
          it.parts.push(part); p.holding = null; return this.fx('drop', s.spec);
        }
      }
    }
    return this.fx('nope', s.spec);
  }

  private serve(p: PlayerState, s: StationState) {
    const h = p.holding;
    const c = this.customers.find((c) => c.tableId === s.spec.id && c.phase === 'waiting');
    if (!c || !h || h.kind !== 'plate') return this.fx('nope', s.spec);
    const dish = dishOf(h.parts, this.recipes);
    if (!dish || dish.id !== c.order) return this.fx('nope', s.spec);
    const tip = Math.round(dish.price * BALANCE.tipMax * (c.patience / c.patienceMax));
    this.coins += dish.price + tip;
    this.served += 1;
    p.holding = null;
    c.phase = 'eating';
    c.t = 0;
    c.happy = true;
    const at = tileCenter(s.spec.tx, s.spec.ty);
    this.events.push({ type: 'served', customer: c.id, coins: dish.price, tip, x: at.x, y: at.y });
  }

  // ───────────────────────── Temps ─────────────────────────

  tick(dt: number): void {
    if (this.ended) return;
    this.time += dt;
    for (const p of this.players.values()) this.movePlayer(p, dt);
    this.updateStations(dt);
    this.updateCustomers(dt);

    const closeAt = BALANCE.serviceSeconds - BALANCE.lastCallSeconds;
    if (!this.closingAnnounced && this.time >= closeAt) { this.closingAnnounced = true; this.events.push({ type: 'closing' }); }
    if (this.time < closeAt && this.time >= this.nextSpawn) {
      this.spawnCustomer();
      this.nextSpawn = this.time + this.params.spawnInterval + (this.rng() * 2 - 1) * BALANCE.spawnJitter;
    }
    const noOneWaiting = !this.customers.some((c) => c.phase === 'waiting' || c.phase === 'arriving');
    if ((this.time >= BALANCE.serviceSeconds && noOneWaiting) || this.time >= BALANCE.serviceSeconds + 30) {
      this.ended = true;
      this.events.push({ type: 'ended' });
    }
  }

  private movePlayer(p: PlayerState, dt: number) {
    let dx = p.input.dx;
    let dy = p.input.dy;
    if (p.path.length) {
      const target = tileCenter(p.path[0].x, p.path[0].y);
      const vx = target.x - p.x;
      const vy = target.y - p.y;
      const dist = Math.hypot(vx, vy);
      if (dist <= Math.max(2, p.speed * dt)) {
        // On atteint la case : on se cale dessus (évite d'osciller quand les images/seconde chutent).
        p.x = target.x; p.y = target.y;
        p.path.shift();
        if (!p.path.length && p.pendingStation) {
          const s = this.station(p.pendingStation);
          p.pendingStation = null;
          if (s) { this.face(p, s.spec); this.interact(p, s); }
        }
        return;
      }
      dx = vx / dist; dy = vy / dist;
    }
    const len = Math.hypot(dx, dy);
    if (!len) return;
    dx /= len; dy /= len;
    if (Math.abs(dx) > Math.abs(dy)) { p.faceX = Math.sign(dx); p.faceY = 0; } else { p.faceX = 0; p.faceY = Math.sign(dy); }
    const step = p.speed * dt;
    // Déplacement séparé sur X puis Y pour glisser le long des obstacles.
    const r = TILE * 0.3;
    const free = (x: number, y: number) =>
      [[-r, -r], [r, -r], [-r, r], [r, r]].every(([ox, oy]) => {
        const t = worldToTile(x + ox, y + oy);
        return !this.grid.isBlocked(t.x, t.y);
      });
    const nx = p.x + dx * step;
    if (free(nx, p.y)) p.x = nx;
    const ny = p.y + dy * step;
    if (free(p.x, ny)) p.y = ny;
    p.y = Math.max(HUD_HEIGHT + r, p.y);
  }

  private nearAnyPlayer(s: StationSpec) {
    for (const p of this.players.values()) {
      const t = worldToTile(p.x, p.y);
      if (Math.abs(t.x - s.tx) + Math.abs(t.y - s.ty) === 1) return true;
    }
    return false;
  }

  private updateStations(dt: number) {
    for (const s of this.stations) {
      const it = s.item;
      if (!it || it.kind !== 'ing') continue;
      if (s.spec.type === 'board' && canChop(it.id, it.state)) {
        // La découpe n'avance que si quelqu'un se tient à côté de la planche.
        if (!this.nearAnyPlayer(s.spec)) continue;
        s.progress += dt;
        if (s.progress >= this.params.chopSeconds) { it.state = 'coupe'; s.progress = 0; this.fx('chopDone', s.spec); }
      } else if (s.spec.type === 'stove' && (it.state === 'cuit' || canCook(it.id, it.state))) {
        s.progress += dt;
        if (it.state !== 'cuit' && s.progress >= this.params.cookSeconds) {
          it.state = 'cuit'; s.progress = 0; this.fx('cookDone', s.spec);
        } else if (it.state === 'cuit' && s.progress >= this.params.burnSeconds) {
          it.state = 'brule'; s.progress = 0; this.fx('burnt', s.spec);
        }
      }
    }
  }

  private spawnCustomer() {
    const busy = new Set(this.customers.map((c) => c.tableId));
    const free = this.stations.filter((s) => s.spec.type === 'table' && !s.locked && !busy.has(s.spec.id));
    if (!free.length) return;
    const table = free[Math.floor(this.rng() * free.length)];
    const total = this.recipes.reduce((a, r) => a + r.weight, 0);
    let roll = this.rng() * total;
    const order = this.recipes.find((r) => (roll -= r.weight) < 0) ?? this.recipes[0];
    const id = this.nextCustomerId++;
    this.customers.push({
      id, tableId: table.spec.id, order: order.id, phase: 'arriving', t: 0,
      patience: this.params.patience, patienceMax: this.params.patience,
      color: Math.floor(this.rng() * 1e6), happy: false,
    });
    this.events.push({ type: 'arrived', customer: id });
  }

  private updateCustomers(dt: number) {
    for (const c of this.customers) {
      c.t += dt;
      if (c.phase === 'arriving' && c.t >= BALANCE.walkSeconds) { c.phase = 'waiting'; c.t = 0; }
      else if (c.phase === 'waiting') {
        c.patience -= dt;
        if (c.patience <= 0) {
          c.phase = 'leaving'; c.t = 0; c.happy = false; this.left += 1;
          this.events.push({ type: 'left', customer: c.id });
        }
      } else if (c.phase === 'eating' && c.t >= BALANCE.eatSeconds) { c.phase = 'leaving'; c.t = 0; }
    }
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      if (c.phase === 'leaving' && c.t >= BALANCE.walkSeconds) this.customers.splice(i, 1);
    }
  }

  /** Position (en pixels) d'un client : il marche de la porte à sa chaise, puis repart. */
  customerPosition(c: CustomerState): { x: number; y: number } {
    const table = this.station(c.tableId)!.spec;
    const seat = tileCenter(table.tx + 1, table.ty);
    const door = tileCenter(this.grid.door.x, this.grid.door.y);
    const k = Math.min(1, c.t / BALANCE.walkSeconds);
    if (c.phase === 'arriving') return { x: door.x + (seat.x - door.x) * k, y: door.y + (seat.y - door.y) * k };
    if (c.phase === 'leaving') return { x: seat.x + (door.x - seat.x) * k, y: seat.y + (door.y - seat.y) * k };
    return seat;
  }

  drainEvents(): SimEvent[] {
    return this.events.splice(0, this.events.length);
  }
}
