/**
 * SIMULATION D'UN SERVICE — logique pure, sans Phaser.
 *
 * Tout se joue au toucher : on touche un bac d'ingrédient, il part seul vers la planche ou le feu ;
 * ce qui est prêt part sur une assiette quand on le touche ; on touche une assiette complète pour servir.
 *
 * Toute action d'un joueur passe par `dispatch(action)` et le temps avance avec `tick(dt)`.
 * C'est ce qui permettra la coop en ligne : l'hôte fait tourner la simulation,
 * les autres joueurs envoient leurs actions et reçoivent l'état (voir docs/ARCHITECTURE.md).
 */
import { BALANCE, BIN_ORDER, INGREDIENTS, READY_STATE, type IngredientState, type Part, type RecipeDef } from '../config/content';
import { canAddToPlate, dishOf, ingredientsForStage, partOf, recipesForStage } from './recipes';
import type { ServiceParams } from './progress';

export interface Ingredient { id: string; state: IngredientState }

export type ApplianceKind = 'planche' | 'feu';

export interface SlotState {
  id: string; // ex. "feu-0"
  kind: ApplianceKind;
  item: Ingredient | null;
  /** Secondes de découpe ou de cuisson accumulées. */
  progress: number;
}

export interface PlateState { parts: Part[] }

export interface PlayerState { id: string; selectedPlate: number | null }

export type CustomerPhase = 'arriving' | 'waiting' | 'eating' | 'leaving';

export interface CustomerState {
  id: number;
  seat: number;
  order: string;
  phase: CustomerPhase;
  t: number;
  patience: number;
  patienceMax: number;
  look: number;
  happy: boolean;
}

/** Repère d'un élément de l'écran : "bin:tomate", "slot:feu-0", "plate:1", "seat:2". */
export type Ref = string;

export type SimEvent =
  | { type: 'sent'; from: Ref; to: Ref; item: Ingredient; player: string }
  | { type: 'nope'; at: Ref; reason: string }
  | { type: 'trash'; at: Ref }
  | { type: 'chopDone' | 'cookDone' | 'burnt'; at: Ref }
  | { type: 'served'; customer: number; plate: number; seat: number; coins: number; tip: number; player: string }
  | { type: 'select'; plate: number | null; player: string }
  | { type: 'arrived'; customer: number }
  | { type: 'left'; customer: number }
  | { type: 'closing' }
  | { type: 'ended' };

export type Action =
  | { type: 'tapBin'; player: string; ingredient: string }
  | { type: 'tapSlot'; player: string; slot: string }
  | { type: 'tapPlate'; player: string; plate: number }
  | { type: 'clearPlate'; player: string; plate: number };

export class KitchenSim {
  readonly slots: SlotState[] = [];
  readonly plates: PlateState[] = [];
  readonly players = new Map<string, PlayerState>();
  readonly customers: CustomerState[] = [];
  readonly recipes: RecipeDef[];
  readonly bins: string[];
  readonly events: SimEvent[] = [];
  time = 0;
  coins = 0;
  served = 0;
  left = 0;
  ended = false;
  private nextSpawn: number;
  private nextCustomerId = 1;
  private closingAnnounced = false;

  constructor(readonly params: ServiceParams, private rng: () => number = Math.random) {
    this.recipes = recipesForStage(params.stage);
    const available = ingredientsForStage(params.stage);
    this.bins = BIN_ORDER.filter((id) => available.includes(id));
    for (let i = 0; i < params.stoves; i++) this.slots.push({ id: `feu-${i}`, kind: 'feu', item: null, progress: 0 });
    for (let i = 0; i < params.boards; i++) this.slots.push({ id: `planche-${i}`, kind: 'planche', item: null, progress: 0 });
    for (let i = 0; i < params.plates; i++) this.plates.push({ parts: [] });
    this.nextSpawn = BALANCE.firstCustomerDelay;
  }

  addPlayer(id: string): PlayerState {
    const p: PlayerState = { id, selectedPlate: null };
    this.players.set(id, p);
    return p;
  }

  slot(id: string) { return this.slots.find((s) => s.id === id); }

  get timeLeft() { return Math.max(0, BALANCE.serviceSeconds - this.time); }

  /** Plat complet que forme une assiette, s'il y en a un. */
  dishOn(plate: number): RecipeDef | undefined {
    return dishOf(this.plates[plate]?.parts ?? [], this.recipes);
  }

  // ───────────────────────── Actions ─────────────────────────

  dispatch(a: Action): void {
    const p = this.players.get(a.player) ?? this.addPlayer(a.player);
    if (this.ended) return;
    switch (a.type) {
      case 'tapBin': return this.tapBin(p, a.ingredient);
      case 'tapSlot': return this.tapSlot(p, a.slot);
      case 'tapPlate': return this.tapPlate(p, a.plate);
      case 'clearPlate': {
        const plate = this.plates[a.plate];
        if (!plate || !plate.parts.length) return;
        plate.parts = [];
        if (p.selectedPlate === a.plate) p.selectedPlate = null;
        this.events.push({ type: 'trash', at: `plate:${a.plate}` });
        return;
      }
    }
  }

  private nope(at: Ref, reason: string) { this.events.push({ type: 'nope', at, reason }); }

  private tapBin(p: PlayerState, id: string) {
    const def = INGREDIENTS[id];
    if (!def || !this.bins.includes(id)) return this.nope(`bin:${id}`, 'Ingrédient indisponible');
    const item: Ingredient = { id, state: 'brut' };
    if (def.process === 'aucun') { this.toPlate(p, item, `bin:${id}`); return; }
    const kind: ApplianceKind = def.process === 'couper' ? 'planche' : 'feu';
    const free = this.slots.find((s) => s.kind === kind && !s.item);
    if (!free) return this.nope(`bin:${id}`, kind === 'feu' ? 'Tous les feux sont occupés' : 'La planche est occupée');
    free.item = item;
    free.progress = 0;
    this.events.push({ type: 'sent', from: `bin:${id}`, to: `slot:${free.id}`, item: { ...item }, player: p.id });
  }

  private tapSlot(p: PlayerState, slotId: string) {
    const s = this.slot(slotId);
    if (!s || !s.item) return;
    if (s.item.state === 'brule') {
      s.item = null; s.progress = 0;
      this.events.push({ type: 'trash', at: `slot:${s.id}` });
      return;
    }
    const ready = READY_STATE[INGREDIENTS[s.item.id].process];
    if (s.item.state !== ready) return this.nope(`slot:${s.id}`, 'Pas encore prêt');
    if (this.toPlate(p, s.item, `slot:${s.id}`)) { s.item = null; s.progress = 0; }
  }

  /** Pose un ingrédient prêt sur la meilleure assiette. Renvoie false si aucune ne convient. */
  private toPlate(p: PlayerState, item: Ingredient, from: Ref): boolean {
    const plate = this.pickPlate(p, partOf(item.id, item.state));
    if (plate < 0) { this.nope(from, 'Aucune assiette ne convient'); return false; }
    this.plates[plate].parts.push(partOf(item.id, item.state));
    this.events.push({ type: 'sent', from, to: `plate:${plate}`, item: { ...item }, player: p.id });
    return true;
  }

  /**
   * Choix de l'assiette : celle sélectionnée par le joueur si elle accepte l'ingrédient,
   * sinon une assiette déjà commencée qui mène à une commande en attente, sinon une assiette vide.
   */
  pickPlate(p: PlayerState, part: Part): number {
    const waitingOrders = this.customers.filter((c) => c.phase === 'waiting' || c.phase === 'arriving').map((c) => c.order);
    const wanted = this.recipes.filter((r) => waitingOrders.includes(r.id));
    let best = -1;
    let bestScore = -1;
    this.plates.forEach((pl, i) => {
      if (!canAddToPlate(pl.parts, part, this.recipes)) return;
      let score = 0;
      if (p.selectedPlate === i) score += 100;
      if (pl.parts.length) score += 20 + pl.parts.length;
      if (canAddToPlate(pl.parts, part, wanted)) score += 10;
      if (score > bestScore) { bestScore = score; best = i; }
    });
    return best;
  }

  private tapPlate(p: PlayerState, i: number) {
    const plate = this.plates[i];
    if (!plate) return;
    const dish = dishOf(plate.parts, this.recipes);
    if (!dish) {
      // Assiette incomplète : on la sélectionne (ou on la désélectionne).
      p.selectedPlate = p.selectedPlate === i ? null : i;
      this.events.push({ type: 'select', plate: p.selectedPlate, player: p.id });
      return;
    }
    const candidates = this.customers.filter((c) => c.phase === 'waiting' && c.order === dish.id).sort((a, b) => a.patience - b.patience);
    const c = candidates[0];
    if (!c) return this.nope(`plate:${i}`, 'Personne n’a commandé ce plat');
    const tip = Math.round(dish.price * BALANCE.tipMax * (c.patience / c.patienceMax));
    this.coins += dish.price + tip;
    this.served += 1;
    plate.parts = [];
    if (p.selectedPlate === i) p.selectedPlate = null;
    c.phase = 'eating'; c.t = 0; c.happy = true;
    this.events.push({ type: 'served', customer: c.id, plate: i, seat: c.seat, coins: dish.price, tip, player: p.id });
  }

  // ───────────────────────── Temps ─────────────────────────

  tick(dt: number): void {
    if (this.ended) return;
    this.time += dt;
    this.updateSlots(dt);
    this.updateCustomers(dt);

    const closeAt = BALANCE.serviceSeconds - BALANCE.lastCallSeconds;
    if (!this.closingAnnounced && this.time >= closeAt) { this.closingAnnounced = true; this.events.push({ type: 'closing' }); }
    if (this.time < closeAt && this.time >= this.nextSpawn) {
      this.spawnCustomer();
      this.nextSpawn = this.time + this.params.spawnInterval + (this.rng() * 2 - 1) * BALANCE.spawnJitter;
    }
    const someoneWaiting = this.customers.some((c) => c.phase === 'waiting' || c.phase === 'arriving');
    if ((this.time >= BALANCE.serviceSeconds && !someoneWaiting) || this.time >= BALANCE.serviceSeconds + 30) {
      this.ended = true;
      this.events.push({ type: 'ended' });
    }
  }

  private updateSlots(dt: number) {
    for (const s of this.slots) {
      const it = s.item;
      if (!it) continue;
      s.progress += dt;
      if (s.kind === 'planche' && it.state === 'brut' && s.progress >= this.params.chopSeconds) {
        it.state = 'coupe'; s.progress = 0;
        this.events.push({ type: 'chopDone', at: `slot:${s.id}` });
      } else if (s.kind === 'feu' && it.state === 'brut' && s.progress >= this.params.cookSeconds) {
        it.state = 'cuit'; s.progress = 0;
        this.events.push({ type: 'cookDone', at: `slot:${s.id}` });
      } else if (s.kind === 'feu' && it.state === 'cuit' && s.progress >= this.params.burnSeconds) {
        it.state = 'brule'; s.progress = 0;
        this.events.push({ type: 'burnt', at: `slot:${s.id}` });
      }
    }
  }

  private spawnCustomer() {
    const busy = new Set(this.customers.map((c) => c.seat));
    const free = [...Array(this.params.seats).keys()].filter((i) => !busy.has(i));
    if (!free.length) return;
    const seat = free[Math.floor(this.rng() * free.length)];
    const total = this.recipes.reduce((a, r) => a + r.weight, 0);
    let roll = this.rng() * total;
    const order = this.recipes.find((r) => (roll -= r.weight) < 0) ?? this.recipes[0];
    const id = this.nextCustomerId++;
    this.customers.push({
      id, seat, order: order.id, phase: 'arriving', t: 0,
      patience: this.params.patience, patienceMax: this.params.patience,
      look: Math.floor(this.rng() * 1e6), happy: false,
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

  drainEvents(): SimEvent[] {
    return this.events.splice(0, this.events.length);
  }
}
