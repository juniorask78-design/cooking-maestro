import Phaser from 'phaser';
import { BALANCE, GAME_WIDTH, GAME_HEIGHT, INGREDIENTS, STAGES, CUISINES, type Part } from '../config/content';
import { THEME } from '../config/theme';
import { KitchenSim, type CustomerState, type SimEvent, type SlotState, type Ingredient } from '../core/sim';
import { serviceParams, starsFor } from '../core/progress';
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
  plateX: (i: number) => 330 + i * 128,
  stoveX: (i: number) => 66 + i * 104,
  boardX: (i: number) => 560 + i * 104,
};

const TIPS = [
  'Touche un ingrédient : il part tout seul sur la planche ou sur le feu.',
  'Quand c’est prêt, touche-le pour le poser sur une assiette.',
  'Attention : ce qui cuit brûle si tu l’oublies ! Touche un plat brûlé pour le jeter.',
  'Une assiette complète brille : touche-la pour servir le client.',
  'Touche une assiette en cours pour la sélectionner : les ingrédients iront dessus en priorité.',
  'Le bouton 📖 ouvre le livre de recettes (et met le jeu en pause).',
];

const STATE_RING: Record<string, number> = { brut: 0xffffff, coupe: 0x9be3a5, cuit: 0xffb26b, brule: 0x3b3340 };

interface CustomerView { c: Phaser.GameObjects.Container; bubble: Phaser.GameObjects.Container; bar: Phaser.GameObjects.Graphics; phase: string }

export class KitchenScene extends Phaser.Scene {
  private sim!: KitchenSim;
  private slotViews = new Map<string, { item?: Phaser.GameObjects.Container; sig: string; ring: Phaser.GameObjects.Graphics }>();
  private plateViews: { item?: Phaser.GameObjects.Container; sig: string; frame: Phaser.GameObjects.Graphics; clear: Phaser.GameObjects.Text }[] = [];
  private customerViews = new Map<number, CustomerView>();
  private chef!: Phaser.GameObjects.Container;
  private hud!: { timer: Phaser.GameObjects.Text; coins: Phaser.GameObjects.Text; goal: Phaser.GameObjects.Graphics };
  private paused = false;
  private book?: Phaser.GameObjects.Container;
  private finished = false;

  constructor() { super('Kitchen'); }

  create() {
    this.cameras.main.fadeIn(250, 43, 35, 64);
    this.slotViews.clear();
    this.plateViews = [];
    this.customerViews.clear();
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
    if (save.day <= 2) this.startTips();
    (window as unknown as { __kitchen?: KitchenScene }).__kitchen = this; // utile aux tests de bout en bout
    this.banner(save.day === 1 ? 'Premier service : bonne chance, Chef !' : `Jour ${save.day} : c’est parti !`);
  }

  /** Position à l'écran d'un repère de la simulation. */
  private pos(ref: string): { x: number; y: number } {
    const [kind, id] = ref.split(':');
    if (kind === 'bin') return { x: this.binX(this.sim.bins.indexOf(id)), y: L.rowBins - 8 };
    if (kind === 'plate') return { x: L.plateX(Number(id)), y: L.rowPlates };
    if (kind === 'seat') return { x: L.seatX(Number(id)), y: L.seatY };
    const [k, n] = id.split('-');
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
      }
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
      const zone = this.add.zone(x, L.rowPlates, 116, 92).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.act({ type: 'tapPlate', player: PLAYER, plate: i }));
      const clear = text(this, x + 48, L.rowPlates - 36, '✖', 18, '#fff6e6', { backgroundColor: '#ef6f6c', padding: { x: 7, y: 3 } })
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
        base.fillStyle(0x2f2f3a, 1).fillRoundedRect(x - 46, y - 40, 92, 80, 14);
        base.fillStyle(0x1e1e26, 1).fillCircle(x, y, 30);
        base.lineStyle(3, 0x666677).strokeCircle(x, y, 22);
      } else {
        base.fillStyle(0xb9835a, 1).fillRoundedRect(x - 46, y - 40, 92, 80, 14);
        base.fillStyle(0xf7e1b5, 1).fillRoundedRect(x - 36, y - 28, 72, 56, 10);
        base.lineStyle(2, 0xc49a6c).strokeRoundedRect(x - 36, y - 28, 72, 56, 10);
      }
      const zone = this.add.zone(x, y, 96, 84).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.act({ type: 'tapSlot', player: PLAYER, slot: s.id }));
      this.slotViews.set(s.id, { sig: '', ring: this.add.graphics().setDepth(12) });
    }
    // Emplacements de feux à débloquer
    for (let i = this.sim.params.stoves; i < 4; i++) {
      const x = L.stoveX(i);
      this.add.graphics().fillStyle(0x2f2f3a, 0.35).fillRoundedRect(x - 46, L.rowAppliances - 40, 92, 80, 14);
      text(this, x, L.rowAppliances, '🔒', 20).setOrigin(0.5).setAlpha(0.5);
    }
    text(this, L.stoveX(0) - 46, L.rowAppliances - 62, 'Feux 🔥', 13, '#d8cdf0', { fontStyle: 'bold' });
    text(this, L.boardX(0) - 46, L.rowAppliances - 62, 'Planches 🔪', 13, '#d8cdf0', { fontStyle: 'bold' });

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
    const icon = text(this, 0, 0, THEME.ingredientIcons[item.id] ?? '❓', item.state === 'coupe' ? size * 0.8 : size).setOrigin(0.5);
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

  private createHud() {
    const save = Session.data;
    const g = this.add.graphics().setDepth(40);
    g.fillStyle(THEME.palette.hud, 1).fillRect(0, 0, GAME_WIDTH, HUD_H);
    const flags = STAGES.slice(0, save.stage + 1).map((s) => CUISINES.find((c) => c.id === s.cuisine)!.flag).join('');
    text(this, 16, HUD_H / 2, `Jour ${save.day} ${flags}`, 22, THEME.palette.hudText, { fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(41);
    const timer = text(this, 300, HUD_H / 2, '', 26, THEME.palette.hudText, { fontStyle: 'bold' }).setOrigin(0.5).setDepth(41);
    const coins = text(this, 410, HUD_H / 2, '', 22, '#ffd166', { fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(41);
    const goal = this.add.graphics().setDepth(41);
    this.hud = { timer, coins, goal };
    button(this, GAME_WIDTH - 140, HUD_H / 2, '📖 Recettes', () => this.toggleBook(), { w: 150, h: 40, size: 18 }).setDepth(42);
    const mute = text(this, GAME_WIDTH - 34, HUD_H / 2, isMuted() ? '🔇' : '🔊', 26).setOrigin(0.5).setDepth(42).setInteractive({ useHandCursor: true });
    mute.on('pointerup', () => { setMuted(!isMuted()); mute.setText(isMuted() ? '🔇' : '🔊'); });
  }

  private updateHud() {
    const left = Math.ceil(this.sim.timeLeft);
    const closing = this.sim.time >= BALANCE.serviceSeconds - BALANCE.lastCallSeconds;
    this.hud.timer.setText(left > 0 ? `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '⏱ Fermé');
    this.hud.timer.setColor(closing ? '#ffd166' : THEME.palette.hudText);
    const goal = this.sim.params.goal;
    this.hud.coins.setText(`🪙 ${this.sim.coins}`);
    const g = this.hud.goal;
    const x0 = 510, w = 220, y = HUD_H / 2;
    const max = goal * BALANCE.starMultipliers[2];
    g.clear();
    g.fillStyle(0x2b2340, 1).fillRoundedRect(x0, y - 9, w, 18, 9);
    g.fillStyle(THEME.palette.good, 1).fillRoundedRect(x0, y - 9, Math.max(18, w * Math.min(1, this.sim.coins / max)), 18, 9);
    const stars = starsFor(this.sim.coins, goal);
    BALANCE.starMultipliers.forEach((m, i) => {
      const sx = x0 + (w * m * goal) / max;
      g.fillStyle(i < stars ? 0xffd166 : 0x8a8299, 1).fillCircle(Math.min(sx, x0 + w - 6), y, 8);
    });
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
    const h = 110 + recipes.length * 56;
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
    this.updateHud();
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
        const a = this.pos(`plate:${e.plate}`), b = this.pos(`seat:${e.seat}`);
        const c = this.sim.customers.find((cu) => cu.id === e.customer);
        const fly = text(this, a.x, a.y, THEME.recipeIcons[c?.order ?? ''] ?? '🍽️', 36).setOrigin(0.5).setDepth(70);
        this.tweens.add({ targets: fly, x: b.x, y: b.y + 16, duration: 320, ease: 'Quad.inOut', onComplete: () => {
          this.tweens.add({ targets: fly, alpha: 0, delay: BALANCE.eatSeconds * 1000 - 600, duration: 250, onComplete: () => fly.destroy() });
        } });
        this.floatText(b.x, b.y - 70, `+${e.coins}${e.tip ? ` +${e.tip}` : ''} 🪙`, '#ffd166', 22);
        this.tweens.add({ targets: this.chef, angle: { from: -10, to: 10 }, duration: 120, yoyo: true, repeat: 2, onComplete: () => this.chef.setAngle(0) });
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
        v.item = s.item ? this.ingredientView(s.item).setPosition(x, y).setDepth(10) : undefined;
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
    return !!s.item && ((s.kind === 'planche' && s.item.state === 'coupe') || (s.kind === 'feu' && s.item.state === 'cuit'));
  }

  /** Anneau de progression : vert pendant la préparation, puis orange → rouge avant que ça brûle. */
  private drawRing(g: Phaser.GameObjects.Graphics, s: SlotState, x: number, y: number) {
    g.clear();
    const it = s.item;
    if (!it || it.state === 'brule') return;
    const p = this.sim.params;
    let k = 0;
    let color = THEME.palette.good;
    if (it.state === 'brut') k = s.progress / (s.kind === 'feu' ? p.cookSeconds : p.chopSeconds);
    else if (s.kind === 'feu') { k = s.progress / p.burnSeconds; color = k > 0.55 ? THEME.palette.bad : THEME.palette.warn; }
    else { g.lineStyle(5, THEME.palette.good, 1).strokeCircle(x, y, 34); return; }
    g.lineStyle(7, 0x1e1e26, 0.8).strokeCircle(x, y, 34);
    g.lineStyle(5, color, 1).beginPath().arc(x, y, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, k)).strokePath();
    if (it.state === 'cuit' && k > 0.55 && Math.floor(this.sim.time * 6) % 2 === 0) g.lineStyle(3, THEME.palette.bad, 1).strokeRoundedRect(x - 46, y - 40, 92, 80, 14);
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
      v.frame.fillStyle(ready ? 0xffe9a8 : 0x6b5c8f, 1).fillRoundedRect(x - 56, y - 44, 112, 88, 16);
      if (selected === i) v.frame.lineStyle(4, 0xffd166, 1).strokeRoundedRect(x - 56, y - 44, 112, 88, 16);
      v.frame.fillStyle(0x000000, 0.15).fillEllipse(x, y + 8, 84, 30);
      v.frame.fillStyle(0xffffff, 1).fillEllipse(x, y + 4, 84, 32).lineStyle(2, 0xb0a8c0).strokeEllipse(x, y + 4, 84, 32);
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
      if (v.phase !== cu.phase) this.onCustomerPhase(cu, v);
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

  private onCustomerPhase(cu: CustomerState, v: CustomerView) {
    v.phase = cu.phase;
    v.bubble.removeAll(true);
    v.bar = this.add.graphics();
    v.bubble.setAngle(0);
    if (cu.phase === 'waiting') {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1).fillRoundedRect(-36, -30, 72, 72, 16).fillTriangle(-8, 40, 8, 40, 0, 52);
      g.lineStyle(2, 0x2b2340, 0.3).strokeRoundedRect(-36, -30, 72, 72, 16);
      v.bubble.add([g, text(this, 0, -2, THEME.recipeIcons[cu.order] ?? '❓', 34).setOrigin(0.5)]);
      v.bubble.setScale(0);
      this.tweens.add({ targets: v.bubble, scale: 1, duration: 250, ease: 'Back.out' });
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
    const goal = this.sim.params.goal;
    const result = { coins: this.sim.coins, served: this.sim.served, left: this.sim.left, stars: starsFor(this.sim.coins, goal), goal, day: Session.data.day };
    this.banner('Le service est terminé !');
    this.time.delayedCall(1600, () => fadeTo(this, 'Result', result));
  }
}
