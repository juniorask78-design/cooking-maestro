import Phaser from 'phaser';
import { BALANCE, GAME_WIDTH, GAME_HEIGHT, INGREDIENTS, STAGES, CUISINES, DRINKS, LEVELS_PER_STAGE, type Part } from '../config/content';
import { THEME } from '../config/theme';
import { KitchenSim, type CustomerState, type SimEvent, type SlotState, type Ingredient } from '../core/sim';
import { serviceParams, starsFor, goalReached, levelInStage } from '../core/progress';
import { text, button, drawChef, colorOf, panel } from '../ui/widgets';
import { sfx, setMuted, isMuted } from '../ui/sfx';
import { Session, fadeTo } from './state';

const PLAYER = 'local';
const HUD_H = 56;

/** Mise en page (canvas 960 x 640, pensé pour un téléphone en paysage). */
const L = {
  seatY: 236,
  counterY: 292,
  rowPlates: 374,
  rowAppliances: 476,
  rowBins: 584,
  seatX: (i: number) => 110 + i * 148,
  plateX: (i: number) => 318 + i * 118,
  rechaudX: (i: number) => 800 + i * 92,
  stoveX: (i: number) => 58 + i * 96,
  boardX: (i: number) => 474 + i * 96,
  barX: (i: number) => 730 + i * 96,
};

const TIPS = [
  'Touche un ingrédient : il part tout seul sur la planche ou sur le feu.',
  'Quand c’est prêt, touche-le pour le poser sur une assiette.',
  'Une assiette complète brille : touche-la pour servir le client.',
  'Les clients laissent leurs pièces sur la table : touche-les pour les ramasser et libérer la place !',
  'Touche la machine à boissons pour remplir un verre, puis touche le verre pour le servir.',
  'Ce qui cuit brûle si tu l’oublies. Pas d’assiette libre ? Le plat part au réchaud, où il ne brûle plus.',
  'Enchaîne les services rapidement pour faire monter le combo et les pourboires.',
  'Touche une assiette en cours pour la sélectionner : les ingrédients iront dessus en priorité.',
];

const STATE_RING: Record<string, number> = { brut: 0xffffff, coupe: 0x9be3a5, cuit: 0xffb26b, brule: 0x3b3340 };

interface CustomerView { c: Phaser.GameObjects.Container; bubble: Phaser.GameObjects.Container; bar: Phaser.GameObjects.Graphics; phase: string }
interface SeatView { coins: Phaser.GameObjects.Container; amount: number }

export class KitchenScene extends Phaser.Scene {
  private sim!: KitchenSim;
  private slotViews = new Map<string, { item?: Phaser.GameObjects.Container; sig: string; ring: Phaser.GameObjects.Graphics }>();
  private plateViews: { item?: Phaser.GameObjects.Container; sig: string; frame: Phaser.GameObjects.Graphics; clear: Phaser.GameObjects.Text }[] = [];
  private customerViews = new Map<number, CustomerView>();
  private chef!: Phaser.GameObjects.Container;
  private seatViews: SeatView[] = [];
  private hud!: { timer: Phaser.GameObjects.Text; coins: Phaser.GameObjects.Text; goal: Phaser.GameObjects.Graphics; objective: Phaser.GameObjects.Text; combo: Phaser.GameObjects.Text; comboBar: Phaser.GameObjects.Graphics };
  private paused = false;
  private book?: Phaser.GameObjects.Container;
  private finished = false;

  constructor() { super('Kitchen'); }

  create() {
    this.cameras.main.fadeIn(250, 43, 35, 64);
    this.slotViews.clear();
    this.plateViews = [];
    this.customerViews.clear();
    this.seatViews = [];
    this.finished = false;
    this.paused = false;
    this.book = undefined;

    const save = Session.data;
    this.sim = new KitchenSim(serviceParams(save));
    this.sim.addPlayer(PLAYER);

    this.drawDining();
    this.drawKitchen();
    this.createHud();
    this.input.keyboard?.on('keydown-R', () => this.toggleBook());
    if (this.sim.params.level <= 3) this.startTips();
    (window as unknown as { __kitchen?: KitchenScene }).__kitchen = this; // utile aux tests de bout en bout
    const p = this.sim.params;
    this.banner(`Niveau ${p.level} · ${this.goalText()}`);
  }

  /** Position à l'écran d'un repère de la simulation. */
  private pos(ref: string): { x: number; y: number } {
    const [kind, id] = ref.split(':');
    if (kind === 'bin') return { x: this.binX(this.sim.bins.indexOf(id)), y: L.rowBins - 8 };
    if (kind === 'plate') return { x: L.plateX(Number(id)), y: L.rowPlates };
    if (kind === 'seat') return { x: L.seatX(Number(id)), y: L.seatY };
    const [k, n] = id.split('-');
    if (k === 'rechaud') return { x: L.rechaudX(Number(n)), y: L.rowPlates };
    if (k === 'bar') return { x: L.barX(this.sim.params.drinks.indexOf(n)), y: L.rowAppliances };
    return { x: k === 'feu' ? L.stoveX(Number(n)) : L.boardX(Number(n)), y: L.rowAppliances };
  }

  private binX(i: number) {
    const n = this.sim.bins.length;
    const step = Math.min(96, (GAME_WIDTH - 40) / n);
    return GAME_WIDTH / 2 + (i - (n - 1) / 2) * step;
  }

  // ───────────────────────── Décor ─────────────────────────

  private drawDining() {
    const save = Session.data;
    const look = save.look;
    const floor = colorOf(THEME.floorColors, look.floor);
    const wall = colorOf(THEME.wallColors, look.wall).color;
    const outdoor = save.stage < 2; // food truck et terrasse : on sert en plein air
    const g = this.add.graphics();
    if (outdoor) {
      g.fillStyle(0x9fd3f0, 1).fillRect(0, HUD_H, GAME_WIDTH, 90);
      g.fillStyle(0xffffff, 0.8).fillEllipse(160, HUD_H + 34, 120, 30).fillEllipse(700, HUD_H + 24, 160, 34);
      for (let x = 0; x < GAME_WIDTH; x += 48) for (let y = HUD_H + 90; y < L.counterY; y += 48)
        g.fillStyle(((x + y) / 48) % 2 ? 0xbfe0a0 : 0xb3d693, 1).fillRect(x, y, 48, 48);
    } else {
      g.fillStyle(wall, 1).fillRect(0, HUD_H, GAME_WIDTH, 90);
      g.fillStyle(0xffffff, 0.1).fillRect(0, HUD_H + 70, GAME_WIDTH, 8);
      for (let x = 0; x < GAME_WIDTH; x += 48) for (let y = HUD_H + 90; y < L.counterY; y += 48)
        g.fillStyle(((x + y) / 48) % 2 ? floor.a : floor.b, 1).fillRect(x, y, 48, 48);
    }
    // Décor de la cuisine du monde la plus récente
    const deco = ['🪅', '🍋', '🏮', '🪔'][save.stage] ?? '🪅';
    for (let i = 0; i < 6; i++) text(this, 80 + i * 160, HUD_H + 24, deco, 26).setOrigin(0.5).setAlpha(0.9);

    // Places des clients (tabourets), verrouillées au-delà de l'étape
    for (let i = 0; i < 6; i++) {
      const x = L.seatX(i);
      const sg = this.add.graphics();
      sg.fillStyle(0x000000, 0.12).fillEllipse(x, L.seatY + 34, 70, 16);
      sg.fillStyle(THEME.palette.tableTop, 1).fillRoundedRect(x - 30, L.seatY + 10, 60, 26, 10);
      sg.lineStyle(3, 0x8a5a3b).strokeRoundedRect(x - 30, L.seatY + 10, 60, 26, 10);
      if (i >= this.sim.params.seats) {
        sg.setAlpha(0.35);
        text(this, x, L.seatY - 6, '🔒', 22).setOrigin(0.5).setAlpha(0.6);
        continue;
      }
      const coins = this.add.container(x, L.seatY + 18).setDepth(18).setVisible(false);
      this.seatViews.push({ coins, amount: 0 });
      const zone = this.add.zone(x, L.seatY - 20, 140, 170).setInteractive({ useHandCursor: true }).setDepth(19);
      zone.on('pointerdown', () => this.act({ type: 'tapSeat', player: PLAYER, seat: i }));
    }
  }

  private drawKitchen() {
    const save = Session.data;
    const g = this.add.graphics();
    // Comptoir de service
    g.fillStyle(0x8a5a3b, 1).fillRect(0, L.counterY - 14, GAME_WIDTH, 26);
    g.fillStyle(0xd9a066, 1).fillRect(0, L.counterY - 18, GAME_WIDTH, 10);
    if (save.stage === 0) for (let i = 0; i < 20; i++) g.fillStyle(i % 2 ? 0xffffff : 0xef6f6c, 1).fillRect(i * 48, L.counterY + 12, 48, 10);
    // Fond de cuisine
    g.fillStyle(0x4a3d63, 1).fillRect(0, L.counterY + (save.stage === 0 ? 22 : 12), GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0x56487a, 1).fillRoundedRect(8, L.rowPlates - 50, GAME_WIDTH - 16, 100, 18);
    g.fillStyle(0x56487a, 1).fillRoundedRect(8, L.rowAppliances - 48, GAME_WIDTH - 16, 96, 18);
    g.fillStyle(0x3d3158, 1).fillRoundedRect(8, L.rowBins - 52, GAME_WIDTH - 16, 104, 18);

    const st = STAGES[save.stage];
    text(this, 24, L.rowPlates - 40, `${st.icon} ${st.name}`, 14, '#d8cdf0', { fontStyle: 'bold' });

    // Le chef (personnalisable) supervise depuis le passe.
    this.chef = drawChef(this, colorOf(THEME.avatarColors, save.look.avatarColor).color, save.look.hat, 1.25).setPosition(205, L.rowPlates + 6);
    this.tweens.add({ targets: this.chef, y: L.rowPlates + 2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    text(this, 205, L.rowPlates + 40, save.look.playerName, 13, '#fff6e6', { fontStyle: 'bold' }).setOrigin(0.5);

    // Assiettes (dressage)
    for (let i = 0; i < this.sim.plates.length; i++) {
      const x = L.plateX(i);
      const frame = this.add.graphics();
      const zone = this.add.zone(x, L.rowPlates, 108, 92).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.act({ type: 'tapPlate', player: PLAYER, plate: i }));
      const clear = text(this, x + 44, L.rowPlates - 36, '✖', 18, '#fff6e6', { backgroundColor: '#ef6f6c', padding: { x: 7, y: 3 } })
        .setOrigin(0.5).setDepth(15).setVisible(false).setInteractive({ useHandCursor: true });
      clear.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        this.act({ type: 'clearPlate', player: PLAYER, plate: i });
      });
      this.plateViews.push({ sig: '-', frame, clear });
    }

    // Feux et planches
    for (const s of this.sim.slots) {
      const { x, y } = this.pos(`slot:${s.id}`);
      const base = this.add.graphics();
      if (s.kind === 'feu') {
        base.fillStyle(0x2f2f3a, 1).fillRoundedRect(x - 44, y - 40, 88, 80, 14);
        base.fillStyle(0x1e1e26, 1).fillCircle(x, y, 30);
        base.lineStyle(3, 0x666677).strokeCircle(x, y, 22);
      } else if (s.kind === 'planche') {
        base.fillStyle(0xb9835a, 1).fillRoundedRect(x - 44, y - 40, 88, 80, 14);
        base.fillStyle(0xf7e1b5, 1).fillRoundedRect(x - 34, y - 28, 68, 56, 10);
        base.lineStyle(2, 0xc49a6c).strokeRoundedRect(x - 34, y - 28, 68, 56, 10);
      } else if (s.kind === 'rechaud') {
        base.fillStyle(0x8f8fa3, 1).fillRoundedRect(x - 42, y - 40, 84, 80, 14);
        base.fillStyle(0xc7c7d6, 1).fillRoundedRect(x - 34, y - 30, 68, 60, 10);
        text(this, x, y + 30, 'réchaud', 11, '#3d3158', { fontStyle: 'bold' }).setOrigin(0.5);
      } else {
        // Machine à boissons
        base.fillStyle(0x6ec6ff, 1).fillRoundedRect(x - 44, y - 40, 88, 80, 14);
        base.fillStyle(0xffffff, 0.85).fillRoundedRect(x - 32, y - 32, 64, 22, 8);
        base.fillStyle(0x3e6a99, 1).fillRect(x - 6, y - 10, 12, 10);
        text(this, x, y - 21, DRINKS.find((d) => d.id === s.drink)?.name ?? '', 11, '#2b2340', { fontStyle: 'bold' }).setOrigin(0.5);
        text(this, x + 30, y + 26, THEME.drinkIcons[s.drink ?? ''] ?? '🥤', 16).setOrigin(0.5).setAlpha(0.7);
      }
      const zone = this.add.zone(x, y, 92, 84).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.act({ type: 'tapSlot', player: PLAYER, slot: s.id }));
      this.slotViews.set(s.id, { sig: '', ring: this.add.graphics().setDepth(12) });
    }
    // Emplacements de feux à débloquer
    for (let i = this.sim.params.stoves; i < 4; i++) {
      const x = L.stoveX(i);
      this.add.graphics().fillStyle(0x2f2f3a, 0.35).fillRoundedRect(x - 44, L.rowAppliances - 40, 88, 80, 14);
      text(this, x, L.rowAppliances, '🔒', 20).setOrigin(0.5).setAlpha(0.5);
    }
    text(this, L.stoveX(0) - 44, L.rowAppliances - 62, 'Feux 🔥', 13, '#d8cdf0', { fontStyle: 'bold' });
    text(this, L.boardX(0) - 44, L.rowAppliances - 62, 'Planches 🔪', 13, '#d8cdf0', { fontStyle: 'bold' });
    if (this.sim.params.drinks.length) text(this, L.barX(0) - 44, L.rowAppliances - 62, 'Boissons', 13, '#d8cdf0', { fontStyle: 'bold' });

    // Bacs d'ingrédients
    const processIcon = { aucun: '', couper: '🔪', cuire: '🔥' };
    this.sim.bins.forEach((id, i) => {
      const x = this.binX(i);
      const y = L.rowBins;
      const w = Math.min(86, (GAME_WIDTH - 40) / this.sim.bins.length - 6);
      const c = this.add.container(x, y);
      const bg = this.add.graphics();
      bg.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -40, w, 86, 14);
      bg.fillStyle(0xa86b3c, 1).fillRoundedRect(-w / 2, -44, w, 86, 14);
      bg.fillStyle(0xc98a55, 1).fillRoundedRect(-w / 2 + 5, -39, w - 10, 50, 10);
      c.add(bg);
      c.add(text(this, 0, -14, THEME.ingredientIcons[id] ?? '❓', 34).setOrigin(0.5));
      c.add(text(this, 0, 26, INGREDIENTS[id].name, 12, '#fff6e6', { fontStyle: 'bold' }).setOrigin(0.5));
      const pi = processIcon[INGREDIENTS[id].process];
      if (pi) c.add(text(this, w / 2 - 12, -32, pi, 14).setOrigin(0.5));
      c.setSize(w, 86).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => {
        this.tweens.add({ targets: c, scale: 0.9, duration: 60, yoyo: true });
        this.act({ type: 'tapBin', player: PLAYER, ingredient: id });
      });
    });
  }

  private act(a: Parameters<KitchenSim['dispatch']>[0]) {
    if (this.paused || this.finished) return;
    this.sim.dispatch(a);
  }

  // ───────────────────────── Objets ─────────────────────────

  private ingredientView(item: Ingredient, size = 34): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    if (item.state !== 'brut') g.fillStyle(STATE_RING[item.state], 0.9).fillCircle(0, 0, size * 0.62);
    const icon = text(this, 0, 0, THEME.ingredientIcons[item.id] ?? THEME.drinkIcons[item.id] ?? '❓', item.state === 'coupe' ? size * 0.8 : size).setOrigin(0.5);
    c.add([g, icon]);
    if (item.state === 'brule') { icon.setTint(0x333333); c.add(text(this, 14, -16, '💨', 16).setOrigin(0.5)); }
    return c;
  }

  private plateView(index: number): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const parts: Part[] = this.sim.plates[index].parts;
    const dish = this.sim.dishOn(index);
    if (dish) {
      const icon = text(this, 0, -6, THEME.recipeIcons[dish.id] ?? '🍽️', 40).setOrigin(0.5);
      c.add(icon);
      c.add(text(this, 0, 28, 'Servir !', 13, '#2b2340', { fontStyle: 'bold', backgroundColor: '#ffd166', padding: { x: 6, y: 2 } }).setOrigin(0.5));
      this.tweens.add({ targets: icon, scale: 1.12, duration: 400, yoyo: true, repeat: -1 });
    } else {
      parts.forEach((p, i) => {
        const [id] = p.split(':');
        c.add(text(this, (i - (parts.length - 1) / 2) * 30, -4, THEME.ingredientIcons[id] ?? '❓', 24).setOrigin(0.5));
      });
    }
    return c;
  }

  // ───────────────────────── HUD ─────────────────────────

  private goalText(): string {
    const g = this.sim.params.goal;
    if (g.type === 'pieces') return `🎯 ${g.target} pièces`;
    if (g.type === 'clients') return `🎯 servir ${g.target} clients`;
    return '🎯 ne perdre aucun client';
  }

  private createHud() {
    const save = Session.data;
    const p = this.sim.params;
    const g = this.add.graphics().setDepth(40);
    g.fillStyle(THEME.palette.hud, 1).fillRect(0, 0, GAME_WIDTH, HUD_H);
    const flag = CUISINES.find((c) => c.id === STAGES[save.stage].cuisine)!.flag;
    text(this, 14, 16, `${flag} Niveau ${p.level}`, 19, THEME.palette.hudText, { fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(41);
    text(this, 14, 40, `${levelInStage(p.level)}/${LEVELS_PER_STAGE} · ${STAGES[save.stage].name}`, 13, '#b9aed0').setOrigin(0, 0.5).setDepth(41);
    const timer = text(this, 240, HUD_H / 2, '', 24, THEME.palette.hudText, { fontStyle: 'bold' }).setOrigin(0.5).setDepth(41);
    const objective = text(this, 330, 16, '', 15, '#ffffff', { fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(41);
    const coins = text(this, 330, 40, '', 17, '#ffd166', { fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(41);
    const goal = this.add.graphics().setDepth(41);
    const combo = text(this, 640, 16, '', 16, '#ff9a8a', { fontStyle: 'bold' }).setOrigin(0.5).setDepth(41);
    const comboBar = this.add.graphics().setDepth(41);
    this.hud = { timer, coins, goal, objective, combo, comboBar };
    button(this, GAME_WIDTH - 128, HUD_H / 2, '📖 Recettes', () => this.toggleBook(), { w: 140, h: 40, size: 17 }).setDepth(42);
    const mute = text(this, GAME_WIDTH - 28, HUD_H / 2, isMuted() ? '🔇' : '🔊', 24).setOrigin(0.5).setDepth(42).setInteractive({ useHandCursor: true });
    mute.on('pointerup', () => { setMuted(!isMuted()); mute.setText(isMuted() ? '🔇' : '🔊'); });
  }

  private updateHud() {
    const sim = this.sim;
    const left = Math.ceil(sim.timeLeft);
    const closing = sim.time >= BALANCE.serviceSeconds - BALANCE.lastCallSeconds;
    this.hud.timer.setText(left > 0 ? `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '⏱ Fermé');
    this.hud.timer.setColor(closing ? '#ffd166' : THEME.palette.hudText);

    const g = sim.params.goal;
    const onTable = sim.seats.reduce((a, s) => a + s.coins, 0);
    const done = goalReached(g, { coins: sim.coins + onTable, served: sim.served, left: sim.left });
    const progress = g.type === 'pieces' ? `${sim.coins + onTable}/${g.target} 🪙` : g.type === 'clients' ? `${sim.served}/${g.target} clients` : `${sim.left} perdu${sim.left > 1 ? 's' : ''} (max ${g.target})`;
    this.hud.objective.setText(`${done ? '✅' : '🎯'} ${progress}`).setColor(done ? '#9be3a5' : g.type === 'parfait' && sim.left > g.target ? '#ef6f6c' : '#ffffff');
    this.hud.coins.setText(`🪙 ${sim.coins}${onTable ? `  (+${onTable} sur les tables)` : ''}`);

    // Barre d'étoiles (sur les pièces gagnées)
    const goal = sim.params.coinGoal;
    const gr = this.hud.goal;
    const x0 = 560, w = 160, y = 40;
    const max = goal * BALANCE.starMultipliers[2];
    const total = sim.coins + onTable;
    gr.clear();
    gr.fillStyle(0x2b2340, 1).fillRoundedRect(x0, y - 7, w, 14, 7);
    gr.fillStyle(THEME.palette.good, 1).fillRoundedRect(x0, y - 7, Math.max(14, w * Math.min(1, total / max)), 14, 7);
    const stars = starsFor(total, goal);
    BALANCE.starMultipliers.forEach((m, i) => {
      const sx = x0 + (w * m * goal) / max;
      gr.fillStyle(i < stars ? 0xffd166 : 0x8a8299, 1).fillCircle(Math.min(sx, x0 + w - 6), y, 7);
    });

    // Combo
    const k = sim.comboRemaining;
    this.hud.combo.setText(sim.combo > 1 && k > 0 ? `Combo x${sim.combo} 🔥` : '');
    this.hud.comboBar.clear();
    if (sim.combo > 1 && k > 0) this.hud.comboBar.fillStyle(0xff9a8a, 1).fillRect(590, 26, 100 * k, 3);
  }

  private toggleBook() {
    if (this.finished) return;
    if (this.book) { this.book.destroy(); this.book = undefined; this.paused = false; return; }
    this.paused = true;
    const c = this.add.container(0, 0).setDepth(100);
    const veil = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5).setInteractive();
    veil.on('pointerup', () => this.toggleBook());
    c.add(veil);
    const recipes = this.sim.recipes;
    const h = 130 + recipes.length * 56;
    const y0 = (GAME_HEIGHT - h) / 2;
    c.add(panel(this, 160, y0, 640, h));
    c.add(text(this, GAME_WIDTH / 2, y0 + 34, '📖 Livre de recettes (pause)', 26, '#2b2340', { fontStyle: 'bold' }).setOrigin(0.5));
    const stateLabel: Record<string, string> = { brut: '', coupe: ' coupé', cuit: ' cuit', brule: '' };
    recipes.forEach((r, i) => {
      const y = y0 + 84 + i * 56;
      const parts = r.parts.map((p) => { const [id, st] = p.split(':'); return `${THEME.ingredientIcons[id]}${stateLabel[st]}`; }).join('  +  ');
      c.add(text(this, 190, y, `${THEME.recipeIcons[r.id]} ${r.name}`, 21, '#2b2340', { fontStyle: 'bold' }).setOrigin(0, 0.5));
      c.add(text(this, 440, y, parts, 19, '#6d5a8c').setOrigin(0, 0.5));
      c.add(text(this, 780, y, `🪙${r.price}`, 18, '#2b2340').setOrigin(1, 0.5));
    });
    if (this.sim.params.drinks.length) c.add(text(this, GAME_WIDTH / 2, y0 + h - 44, `Boissons : ${this.sim.params.drinks.map((d) => `${THEME.drinkIcons[d]} ${DRINKS.find((x) => x.id === d)!.name} (machine)`).join('   ')}`, 16, '#2b2340').setOrigin(0.5));
    c.add(text(this, GAME_WIDTH / 2, y0 + h - 20, 'Touche pour reprendre', 15, '#6d5a8c').setOrigin(0.5));
    this.book = c;
  }

  private banner(msg: string) {
    const t = text(this, GAME_WIDTH / 2, 190, msg, 34, '#fff6e6', { fontStyle: 'bold', stroke: '#2b2340', strokeThickness: 8 }).setOrigin(0.5).setDepth(90).setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 300, ease: 'Back.out', yoyo: true, hold: 1400, onComplete: () => t.destroy() });
  }

  private startTips() {
    let i = 0;
    const tip = text(this, GAME_WIDTH / 2, HUD_H + 22, '', 17, '#fff6e6', { backgroundColor: '#2b2340dd', padding: { x: 12, y: 7 }, align: 'center', wordWrap: { width: 700 } }).setOrigin(0.5).setDepth(60);
    const show = () => { tip.setText(`💡 ${TIPS[i % TIPS.length]}`); i++; };
    show();
    this.time.addEvent({ delay: 8000, loop: true, callback: show });
  }

  // ───────────────────────── Boucle ─────────────────────────

  update(_t: number, deltaMs: number) {
    if (this.paused || this.finished) return;
    this.sim.tick(Math.min(deltaMs, 100) / 1000);
    for (const e of this.sim.drainEvents()) this.onEvent(e);
    this.renderSlots();
    this.renderPlates();
    this.renderCustomers();
    this.renderSeats();
    this.updateHud();
  }

  private renderSeats() {
    this.sim.seats.forEach((st, i) => {
      const v = this.seatViews[i];
      if (!v || v.amount === st.coins) return;
      v.amount = st.coins;
      v.coins.removeAll(true);
      v.coins.setVisible(st.coins > 0);
      if (!st.coins) return;
      v.coins.add(text(this, -12, 0, '🪙', 22).setOrigin(0.5));
      v.coins.add(text(this, 10, -6, '🪙', 22).setOrigin(0.5));
      v.coins.add(text(this, 0, 22, `${st.coins}`, 14, '#2b2340', { fontStyle: 'bold', backgroundColor: '#ffd166', padding: { x: 5, y: 1 } }).setOrigin(0.5));
      this.tweens.add({ targets: v.coins, y: v.coins.y - 4, duration: 400, yoyo: true, repeat: -1 });
    });
  }

  private onEvent(e: SimEvent) {
    switch (e.type) {
      case 'sent': {
        sfx.pickup();
        const a = this.pos(e.from), b = this.pos(e.to);
        const fly = this.ingredientView(e.item, 30).setPosition(a.x, a.y).setDepth(70);
        this.tweens.add({ targets: fly, x: b.x, y: b.y, duration: 220, ease: 'Quad.out', onComplete: () => fly.destroy() });
        break;
      }
      case 'nope': {
        sfx.nope();
        const p = this.pos(e.at);
        this.floatText(p.x, p.y - 44, e.reason, '#ffffff', 15);
        break;
      }
      case 'select': sfx.drop(); break;
      case 'trash': { sfx.trash(); const p = this.pos(e.at); this.floatText(p.x, p.y - 30, '🗑️', '#ffffff'); break; }
      case 'chopDone': case 'cookDone': sfx.done(); break;
      case 'burnt': { sfx.burnt(); const p = this.pos(e.at); this.floatText(p.x, p.y - 40, 'Brûlé…', '#ef6f6c'); break; }
      case 'served': {
        sfx.served();
        const a = this.pos(e.from), b = this.pos(`seat:${e.seat}`);
        const icon = THEME.recipeIcons[e.item] ?? THEME.drinkIcons[e.item] ?? '🍽️';
        const fly = text(this, a.x, a.y, icon, 34).setOrigin(0.5).setDepth(70);
        this.tweens.add({ targets: fly, x: b.x, y: b.y + 10, duration: 320, ease: 'Quad.inOut', onComplete: () => {
          this.tweens.add({ targets: fly, alpha: 0, delay: e.complete ? BALANCE.eatSeconds * 1000 - 600 : 200, duration: 250, onComplete: () => fly.destroy() });
        } });
        if (!e.complete) this.floatText(b.x, b.y - 70, 'Merci ! Et la suite ?', '#ffffff', 15);
        break;
      }
      case 'paid': {
        const b = this.pos(`seat:${e.seat}`);
        if (e.combo > 1) this.floatText(b.x, b.y - 100, `Combo x${e.combo} !`, '#ff9a8a', 20);
        this.tweens.add({ targets: this.chef, angle: { from: -10, to: 10 }, duration: 120, yoyo: true, repeat: 2, onComplete: () => this.chef.setAngle(0) });
        break;
      }
      case 'collected': {
        sfx.coins();
        const b = this.pos(`seat:${e.seat}`);
        this.floatText(b.x, b.y - 20, `+${e.coins} 🪙`, '#ffd166', 22);
        break;
      }
      case 'arrived': sfx.bell(); break;
      case 'left': sfx.left(); break;
      case 'closing': this.banner('Dernières commandes !'); break;
      case 'ended': this.finish(); break;
    }
  }

  private floatText(x: number, y: number, str: string, color: string, size = 20) {
    const t = text(this, x, y, str, size, color, { fontStyle: 'bold', stroke: '#2b2340', strokeThickness: 5 }).setOrigin(0.5).setDepth(80);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 1200, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }

  private renderSlots() {
    for (const s of this.sim.slots) {
      const v = this.slotViews.get(s.id)!;
      const { x, y } = this.pos(`slot:${s.id}`);
      const sig = s.item ? `${s.item.id}:${s.item.state}` : '';
      if (sig !== v.sig) {
        v.item?.destroy();
        const showItem = s.item && !(s.kind === 'bar' && s.item.state === 'brut');
        v.item = showItem ? this.ingredientView(s.item!).setPosition(x, s.kind === 'bar' ? y + 8 : y).setDepth(10) : undefined;
        if (v.item && this.isReady(s)) this.tweens.add({ targets: v.item, scale: 1.15, duration: 350, yoyo: true, repeat: -1 });
        v.sig = sig;
      }
      this.drawRing(v.ring, s, x, y);
      if (s.kind === 'feu' && s.item && Math.random() < 0.05) {
        const puff = text(this, x + (Math.random() - 0.5) * 30, y - 16, s.item.state === 'brule' ? '💨' : '♨️', 14).setOrigin(0.5).setDepth(11).setAlpha(0.8);
        this.tweens.add({ targets: puff, y: y - 50, alpha: 0, duration: 900, onComplete: () => puff.destroy() });
      }
    }
  }

  private isReady(s: SlotState) {
    return !!s.item && ((s.kind === 'planche' && s.item.state === 'coupe') || ((s.kind === 'feu' || s.kind === 'bar') && s.item.state === 'cuit') || s.kind === 'rechaud');
  }

  /** Anneau de progression : vert pendant la préparation, puis orange → rouge avant que ça brûle. */
  private drawRing(g: Phaser.GameObjects.Graphics, s: SlotState, x: number, y: number) {
    g.clear();
    const it = s.item;
    if (!it || it.state === 'brule') return;
    const p = this.sim.params;
    let k = 0;
    let color = THEME.palette.good;
    if (s.kind === 'rechaud') return;
    if (s.kind === 'bar') {
      if (it.state === 'cuit') { g.lineStyle(5, THEME.palette.good, 1).strokeCircle(x, y + 8, 30); return; }
      k = s.progress / p.pourSeconds;
      g.lineStyle(5, 0x6ec6ff, 1).beginPath().arc(x, y + 8, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, k)).strokePath();
      return;
    }
    if (it.state === 'brut') k = s.progress / (s.kind === 'feu' ? p.cookSeconds : p.chopSeconds);
    else if (s.kind === 'feu') { k = s.progress / p.burnSeconds; color = k > 0.55 ? THEME.palette.bad : THEME.palette.warn; }
    else { g.lineStyle(5, THEME.palette.good, 1).strokeCircle(x, y, 34); return; }
    g.lineStyle(7, 0x1e1e26, 0.8).strokeCircle(x, y, 34);
    g.lineStyle(5, color, 1).beginPath().arc(x, y, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, k)).strokePath();
    if (it.state === 'cuit' && k > 0.55 && Math.floor(this.sim.time * 6) % 2 === 0) g.lineStyle(3, THEME.palette.bad, 1).strokeRoundedRect(x - 44, y - 40, 88, 80, 14);
  }

  private renderPlates() {
    const selected = this.sim.players.get(PLAYER)?.selectedPlate ?? null;
    this.sim.plates.forEach((pl, i) => {
      const v = this.plateViews[i];
      const x = L.plateX(i), y = L.rowPlates;
      const sig = pl.parts.join(',') + (selected === i ? '*' : '');
      if (sig === v.sig) return;
      v.sig = sig;
      v.item?.destroy();
      v.frame.clear();
      const ready = !!this.sim.dishOn(i);
      v.frame.fillStyle(ready ? 0xffe9a8 : 0x6b5c8f, 1).fillRoundedRect(x - 52, y - 44, 104, 88, 16);
      if (selected === i) v.frame.lineStyle(4, 0xffd166, 1).strokeRoundedRect(x - 52, y - 44, 104, 88, 16);
      v.frame.fillStyle(0x000000, 0.15).fillEllipse(x, y + 8, 80, 30);
      v.frame.fillStyle(0xffffff, 1).fillEllipse(x, y + 4, 80, 32).lineStyle(2, 0xb0a8c0).strokeEllipse(x, y + 4, 80, 32);
      v.item = this.plateView(i).setPosition(x, y).setDepth(10);
      v.clear.setVisible(pl.parts.length > 0);
    });
  }

  private renderCustomers() {
    const alive = new Set<number>();
    for (const cu of this.sim.customers) {
      alive.add(cu.id);
      const v = this.customerViews.get(cu.id) ?? this.createCustomerView(cu);
      const seat = this.pos(`seat:${cu.seat}`);
      const k = Math.min(1, cu.t / BALANCE.walkSeconds);
      const enterX = GAME_WIDTH + 60;
      const x = cu.phase === 'arriving' ? enterX + (seat.x - enterX) * k : cu.phase === 'leaving' ? seat.x + (enterX - seat.x) * k : seat.x;
      const walking = cu.phase === 'arriving' || cu.phase === 'leaving';
      v.c.setPosition(x, seat.y + (walking ? Math.sin(this.sim.time * 16) * 3 : 0));
      const sig = `${cu.phase}${cu.servedDish ? 'P' : ''}${cu.servedDrink ? 'B' : ''}`;
      if (v.phase !== sig) this.onCustomerPhase(cu, v, sig);
      v.bar.clear();
      if (cu.phase === 'waiting') {
        const r = cu.patience / cu.patienceMax;
        const color = r > 0.5 ? THEME.palette.good : r > 0.25 ? THEME.palette.warn : THEME.palette.bad;
        v.bar.fillStyle(0x2b2340, 0.9).fillRoundedRect(-30, 26, 60, 10, 5);
        v.bar.fillStyle(color, 1).fillRoundedRect(-29, 27, 58 * r, 8, 4);
        v.bubble.setAngle(r < 0.25 ? Math.sin(this.sim.time * 20) * 6 : 0);
      }
    }
    for (const [id, v] of this.customerViews) if (!alive.has(id)) { v.c.destroy(); this.customerViews.delete(id); }
  }

  private createCustomerView(cu: CustomerState): CustomerView {
    const color = THEME.customerColors[cu.look % THEME.customerColors.length];
    const c = this.add.container(0, 0).setDepth(15);
    const body = drawChef(this, color, ['aucun', 'casquette', 'bandana'][cu.look % 3], 1.1);
    const bubble = this.add.container(0, -84);
    const bar = this.add.graphics();
    c.add([body, bubble]);
    const v: CustomerView = { c, bubble, bar, phase: '' };
    this.customerViews.set(cu.id, v);
    return v;
  }

  private onCustomerPhase(cu: CustomerState, v: CustomerView, sig: string) {
    const firstShow = !v.phase.startsWith('waiting');
    v.phase = sig;
    v.bubble.removeAll(true);
    v.bar = this.add.graphics();
    v.bubble.setAngle(0);
    if (cu.phase === 'waiting') {
      const g = this.add.graphics();
      const w = cu.drink ? 112 : 72;
      g.fillStyle(cu.hurried ? 0xfff0d6 : 0xffffff, 1).fillRoundedRect(-w / 2, -30, w, 72, 16).fillTriangle(-8, 40, 8, 40, 0, 52);
      g.lineStyle(2, cu.hurried ? 0xef6f6c : 0x2b2340, cu.hurried ? 0.9 : 0.3).strokeRoundedRect(-w / 2, -30, w, 72, 16);
      v.bubble.add(g);
      const items: [string, boolean][] = [[THEME.recipeIcons[cu.order] ?? '❓', cu.servedDish]];
      if (cu.drink) items.push([THEME.drinkIcons[cu.drink] ?? '🥤', cu.servedDrink]);
      items.forEach(([icon, done], i) => {
        const ix = (i - (items.length - 1) / 2) * 44;
        v.bubble.add(text(this, ix, -2, icon, 30).setOrigin(0.5).setAlpha(done ? 0.35 : 1));
        if (done) v.bubble.add(text(this, ix + 10, 8, '✅', 16).setOrigin(0.5));
      });
      if (cu.hurried) v.bubble.add(text(this, w / 2 - 4, -28, '⚡', 18).setOrigin(0.5));
      if (firstShow) {
        v.bubble.setScale(0);
        this.tweens.add({ targets: v.bubble, scale: 1, duration: 250, ease: 'Back.out' });
      }
    } else if (cu.phase === 'eating') {
      v.bubble.add(text(this, 0, 0, '😋', 32).setOrigin(0.5));
      const heart = text(this, 0, -24, '💖', 22).setOrigin(0.5);
      v.bubble.add(heart);
      this.tweens.add({ targets: heart, y: -56, alpha: 0, duration: 1200 });
    } else if (cu.phase === 'leaving') {
      v.bubble.add(text(this, 0, 0, cu.happy ? '👋' : '😤', 30).setOrigin(0.5));
    }
    v.bubble.add(v.bar);
  }

  private finish() {
    if (this.finished) return;
    this.finished = true;
    const p = this.sim.params;
    const r = { coins: this.sim.coins, served: this.sim.served, left: this.sim.left };
    const success = goalReached(p.goal, r);
    const result = { ...r, level: p.level, success, stars: success ? Math.max(1, starsFor(r.coins, p.coinGoal)) : 0, goal: p.goal, coinGoal: p.coinGoal };
    this.banner('Le service est terminé !');
    this.time.delayedCall(1600, () => fadeTo(this, 'Result', result));
  }
}
