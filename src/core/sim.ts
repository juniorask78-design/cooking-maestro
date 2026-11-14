/**
 * SIMULATION D'UN SERVICE — logique pure, sans Phaser.
 *
 * Tout se joue au toucher : on touche un bac d'ingrédient, il part seul vers la planche ou le feu ;
 * ce qui est prêt part sur une assiette (ou au réchaud) quand on le touche ; on touche une assiette
 * complète pour servir. Les boissons se remplissent à la machine. Les clients laissent leurs pièces
 * sur la table : on les touche pour les ramasser et libérer la place.
 *
 * Toute action d'un joueur passe par `dispatch(action)` et le temps avance avec `tick(dt)`.
 * C'est ce qui permettra la coop en ligne : l'hôte fait tourner la simulation,
 * les autres joueurs envoient leurs actions et reçoivent l'état (voir docs/ARCHITECTURE.md).
 */
import { BALANCE, BIN_ORDER, DRINKS, INGREDIENTS, READY_STATE, type IngredientState, type Part, type RecipeDef } from '../config/content';
import { canAddToPlate, dishOf, ingredientsForStage, partOf, recipesForStage } from './recipes';
import type { ServiceParams } from './progress';

export interface Ingredient { id: string; state: IngredientState }

export type ApplianceKind = 'planche' | 'feu' | 'rechaud' | 'bar';

export interface SlotState {
  id: string; // ex. "feu-0"
  kind: ApplianceKind;
  item: Ingredient | null;
  /** Secondes de découpe, de cuisson ou de remplissage accumulées. */
  progress: number;
  /** Boisson servie par une machine du bar. */
  drink?: string;
}

export interface SeatState {
  /** Pièces laissées sur la table, à ramasser d'un toucher. */
  coins: number;
}

export interface PlateState { parts: Part[] }

export interface PlayerState { id: string; selectedPlate: number | null }

export type CustomerPhase = 'arriving' | 'waiting' | 'eating' | 'leaving';

export interface CustomerState {
  id: number;
  seat: number;
  /** Plat commandé, et boisson éventuelle. */
  order: string;
  drink: string | null;
  servedDish: boolean;
  servedDrink: boolean;
  /** Client pressé : moins patient, plus généreux. */
  hurried: boolean;
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
  | { type: 'served'; customer: number; from: Ref; seat: number; item: string; complete: boolean; player: string }
  | { type: 'paid'; customer: number; seat: number; coins: number; tip: number; combo: number }
  | { type: 'collected'; seat: number; coins: number; player: string }
  | { type: 'select'; plate: number | null; player: string }
  | { type: 'arrived'; customer: number }
  | { type: 'left'; customer: number }
  | { type: 'closing' }
  | { type: 'ended' };

export type Action =
  | { type: 'tapBin'; player: string; ingredient: string }
  | { type: 'tapSlot'; player: string; slot: string }
  | { type: 'tapPlate'; player: string; plate: number }
  | { type: 'tapSeat'; player: string; seat: number }
  | { type: 'clearPlate'; player: string; plate: number };

export class KitchenSim {
  readonly slots: SlotState[] = [];
  readonly plates: PlateState[] = [];
  readonly players = new Map<string, PlayerState>();
  readonly customers: CustomerState[] = [];
  readonly seats: SeatState[] = [];
  readonly recipes: RecipeDef[];
  readonly bins: string[];
  readonly events: SimEvent[] = [];
  time = 0;
  coins = 0;
  served = 0;
  left = 0;
  ended = false;
  combo = 0;
  private lastServeAt = -999;
  private nextSpawn: number;
  private nextCustomerId = 1;
  private closingAnnounced = false;

  constructor(readonly params: ServiceParams, private rng: () => number = Math.random) {
    this.recipes = recipesForStage(params.stage);
    const available = ingredientsForStage(params.stage);
    this.bins = BIN_ORDER.filter((id) => available.includes(id));
    for (let i = 0; i < params.stoves; i++) this.slots.push({ id: `feu-${i}`, kind: 'feu', item: null, progress: 0 });
    for (let i = 0; i < params.boards; i++) this.slots.push({ id: `planche-${i}`, kind: 'planche', item: null, progress: 0 });
    for (let i = 0; i < params.rechaud; i++) this.slots.push({ id: `rechaud-${i}`, kind: 'rechaud', item: null, progress: 0 });
    for (const drink of params.drinks) this.slots.push({ id: `bar-${drink}`, kind: 'bar', item: null, progress: 0, drink });
    for (let i = 0; i < params.plates; i++) this.plates.push({ parts: [] });
    for (let i = 0; i < params.seats; i++) this.seats.push({ coins: 0 });
    this.nextSpawn = BALANCE.firstCustomerDelay;
  }

  addPlayer(id: string): PlayerState {
    const p: PlayerState = { id, selectedPlate: null };
    this.players.set(id, p);
    return p;
  }

  slot(id: string) { return this.slots.find((s) => s.id === id); }

  get timeLeft() { return Math.max(0, BALANCE.serviceSeconds - this.time); }

  /** Part restante (0 à 1) de la fenêtre de combo. */
  get comboRemaining() {
    return this.combo > 0 ? Math.max(0, 1 - (this.time - this.lastServeAt) / BALANCE.comboWindow) : 0;
  }

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
      case 'tapSeat': return this.collect(p, a.seat);
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
    if (!s) return;
    const at = `slot:${s.id}`;
    if (s.kind === 'bar') {
      if (!s.item) { s.item = { id: s.drink!, state: 'brut' }; s.progress = 0; this.events.push({ type: 'sent', from: at, to: at, item: { ...s.item }, player: p.id }); return; }
      if (s.item.state !== 'cuit') return this.nope(at, 'Le verre se remplit…');
      const c = this.bestCustomer((cu) => cu.drink === s.drink && !cu.servedDrink);
      if (!c) return this.nope(at, 'Personne n’a commandé cette boisson');
      s.item = null; s.progress = 0;
      return this.serveItem(p, c, at, s.drink!, 'drink');
    }
    if (!s.item) return;
    if (s.item.state === 'brule') {
      s.item = null; s.progress = 0;
      this.events.push({ type: 'trash', at });
      return;
    }
    if (s.kind !== 'rechaud') {
      const ready = READY_STATE[INGREDIENTS[s.item.id].process];
      if (s.item.state !== ready) return this.nope(at, 'Pas encore prêt');
    }
    const item = s.item;
    const plate = this.pickPlate(p, partOf(item.id, item.state));
    if (plate >= 0) {
      this.plates[plate].parts.push(partOf(item.id, item.state));
      this.events.push({ type: 'sent', from: at, to: `plate:${plate}`, item: { ...item }, player: p.id });
      s.item = null; s.progress = 0;
      return;
    }
    // Aucune assiette ne convient : on garde le plat au chaud s'il reste de la place au réchaud.
    const warm = s.kind !== 'rechaud' ? this.slots.find((x) => x.kind === 'rechaud' && !x.item) : undefined;
    if (warm) {
      warm.item = item; warm.progress = 0;
      this.events.push({ type: 'sent', from: at, to: `slot:${warm.id}`, item: { ...item }, player: p.id });
      s.item = null; s.progress = 0;
      return;
    }
    this.nope(at, 'Aucune assiette ne convient');
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
    const waitingOrders = this.customers.filter((c) => (c.phase === 'waiting' || c.phase === 'arriving') && !c.servedDish).map((c) => c.order);
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
    const c = this.bestCustomer((cu) => cu.order === dish.id && !cu.servedDish);
    if (!c) return this.nope(`plate:${i}`, 'Personne n’a commandé ce plat');
    plate.parts = [];
    if (p.selectedPlate === i) p.selectedPlate = null;
    this.serveItem(p, c, `plate:${i}`, dish.id, 'dish');
  }

  /** Client en attente qui correspond, le moins patient d'abord. */
  private bestCustomer(match: (c: CustomerState) => boolean): CustomerState | undefined {
    return this.customers.filter((c) => c.phase === 'waiting' && match(c)).sort((a, b) => a.patience - b.patience)[0];
  }

  private serveItem(p: PlayerState, c: CustomerState, from: Ref, item: string, kind: 'dish' | 'drink') {
    if (kind === 'dish') c.servedDish = true; else c.servedDrink = true;
    const complete = c.servedDish && (!c.drink || c.servedDrink);
    this.events.push({ type: 'served', customer: c.id, from, seat: c.seat, item, complete, player: p.id });
    if (!complete) {
      // Une partie de la commande arrive : le client reprend patience.
      c.patience = Math.min(c.patienceMax, c.patience + c.patienceMax * BALANCE.partialPatienceBonus);
      return;
    }
    // Commande complète : combo, pourboire, et pièces laissées sur la table.
    this.combo = this.time - this.lastServeAt <= BALANCE.comboWindow ? Math.min(BALANCE.comboMax, this.combo + 1) : 1;
    this.lastServeAt = this.time;
    const price = (this.recipes.find((r) => r.id === c.order)?.price ?? 0) + (c.drink ? DRINKS.find((d) => d.id === c.drink)?.price ?? 0 : 0);
    const tipRate = BALANCE.tipMax * (c.patience / c.patienceMax) * (c.hurried ? 1.5 : 1) + 0.1 * (this.combo - 1) + this.params.tipBonus;
    const tip = Math.round(price * tipRate);
    this.seats[c.seat].coins += price + tip;
    this.served += 1;
    c.phase = 'eating'; c.t = 0; c.happy = true;
    this.events.push({ type: 'paid', customer: c.id, seat: c.seat, coins: price, tip, combo: this.combo });
  }

  private collect(p: PlayerState, seat: number) {
    const s = this.seats[seat];
    if (!s || !s.coins) return;
    this.coins += s.coins;
    this.events.push({ type: 'collected', seat, coins: s.coins, player: p.id });
    s.coins = 0;
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
      // Fin du service : on ramasse automatiquement les pièces oubliées.
      this.seats.forEach((st) => { this.coins += st.coins; st.coins = 0; });
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
      } else if (s.kind === 'bar' && it.state === 'brut' && s.progress >= this.params.pourSeconds) {
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
    // Une place reste prise tant que les pièces n'ont pas été ramassées.
    const free = [...Array(this.params.seats).keys()].filter((i) => !busy.has(i) && !this.seats[i].coins);
    if (!free.length) return;
    const seat = free[Math.floor(this.rng() * free.length)];
    const total = this.recipes.reduce((a, r) => a + r.weight, 0);
    let roll = this.rng() * total;
    const order = this.recipes.find((r) => (roll -= r.weight) < 0) ?? this.recipes[0];
    const id = this.nextCustomerId++;
    const drinks = this.params.drinks;
    const drink = drinks.length && this.rng() < BALANCE.drinkChance ? drinks[Math.floor(this.rng() * drinks.length)] : null;
    const hurried = this.rng() < this.params.hurriedChance;
    const patience = this.params.patience * (hurried ? 0.6 : 1) * (drink ? 1.15 : 1);
    this.customers.push({
      id, seat, order: order.id, drink, servedDish: false, servedDrink: false, hurried, phase: 'arriving', t: 0,
      patience, patienceMax: patience, look: Math.floor(this.rng() * 1e6), happy: false,
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
