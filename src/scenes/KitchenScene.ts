import Phaser from 'phaser';
import { BALANCE, GAME_WIDTH, GAME_HEIGHT, HUD_HEIGHT, TILE, INGREDIENTS, STAGES, CUISINES, type Part } from '../config/content';
import { THEME } from '../config/theme';
import { KitchenSim, type Item, type StationState, type CustomerState, type SimEvent } from '../core/sim';
import { serviceParams, starsFor } from '../core/progress';
import { dishOf } from '../core/recipes';
import { tileCenter, worldToTile } from '../core/grid';
import { text, button, drawChef, colorOf, panel } from '../ui/widgets';
import { sfx, setMuted, isMuted } from '../ui/sfx';
import { Session, fadeTo } from './state';

const PLAYER = 'local';

const TIPS = [
  'Clique sur une caisse (ou approche-toi et appuie sur Espace) pour prendre un ingrédient.',
  'Pose la tomate ou l’avocat sur la planche et reste à côté pour les couper.',
  'Le bœuf se cuit à la poêle. Récupère-le vite : il brûle si on l’oublie !',
  'Prends une assiette, puis garnis-la : clique sur les ingrédients prêts.',
  'Apporte l’assiette à la table du client qui a commandé ce plat.',
  'Ouvre le livre de recettes (bouton 📖 ou touche R) pour revoir les plats.',
];

export class KitchenScene extends Phaser.Scene {
  private sim!: KitchenSim;
  private stationViews = new Map<string, { item?: Phaser.GameObjects.Container; sig: string; bar: Phaser.GameObjects.Graphics; lock?: Phaser.GameObjects.Text }>();
  private playerView!: Phaser.GameObjects.Container;
  private heldView?: Phaser.GameObjects.Container;
  private heldSig = '';
  private customerViews = new Map<number, { c: Phaser.GameObjects.Container; bubble: Phaser.GameObjects.Container; bar: Phaser.GameObjects.Graphics; phase: string }>();
  private highlight!: Phaser.GameObjects.Graphics;
  private hud!: { timer: Phaser.GameObjects.Text; coins: Phaser.GameObjects.Text; goal: Phaser.GameObjects.Graphics };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private lastInput = '0,0';
  private paused = false;
  private book?: Phaser.GameObjects.Container;
  private tip?: Phaser.GameObjects.Text;
  private finished = false;

  constructor() { super('Kitchen'); }

  create() {
    this.cameras.main.fadeIn(250, 43, 35, 64);
    this.stationViews.clear();
    this.customerViews.clear();
    this.finished = false;
    this.paused = false;
    this.book = undefined;
    this.heldSig = '';
    this.heldView = undefined;

    const save = Session.data;
    this.sim = new KitchenSim(serviceParams(save));
    this.sim.addPlayer(PLAYER, { x: 3, y: 6 });

    this.drawStatic();
    this.highlight = this.add.graphics().setDepth(5);
    for (const s of this.sim.stations) this.createStationView(s);

    this.playerView = drawChef(this, colorOf(THEME.avatarColors, save.look.avatarColor).color, save.look.hat);
    this.playerView.setDepth(20);

    this.createHud();
    this.setupInput();
    if (save.day <= 2) this.startTips();
    (window as unknown as { __kitchen?: KitchenScene }).__kitchen = this; // utile aux tests de bout en bout
    this.banner(save.day === 1 ? 'Premier service : bonne chance, Chef !' : `Jour ${save.day} : c’est parti !`);
  }

  // ───────────────────────── Décor ─────────────────────────

  private drawStatic() {
    const look = Session.data.look;
    const floor = colorOf(THEME.floorColors, look.floor);
    const wall = colorOf(THEME.wallColors, look.wall).color;
    const stage = Session.data.stage;
    const outdoor = stage < 2; // food truck et terrasse : la salle est en plein air
    const g = this.add.graphics().setDepth(0);
    const grid = this.sim.grid;
    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        const px = x * TILE;
        const py = y * TILE + HUD_HEIGHT;
        const dining = x >= 8;
        const alt = (x + y) % 2 === 0;
        if (dining && outdoor) g.fillStyle(alt ? 0xbfe0a0 : 0xb3d693, 1);
        else g.fillStyle(alt ? floor.a : floor.b, 1);
        g.fillRect(px, py, TILE, TILE);
        if (dining && outdoor && (x * 7 + y * 3) % 5 === 0) g.fillStyle(0x9cc77c, 1).fillCircle(px + 18, py + 40, 3).fillCircle(px + 44, py + 20, 2);
      }
    }
    // Murs
    for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
      if (this.sim.grid.isBlocked(x, y) && !grid.stationAt(x, y)) {
        g.fillStyle(wall, 1).fillRoundedRect(x * TILE + 4, y * TILE + HUD_HEIGHT + 2, TILE - 8, TILE - 4, 10);
        g.fillStyle(0xffffff, 0.12).fillRoundedRect(x * TILE + 8, y * TILE + HUD_HEIGHT + 6, TILE - 16, 12, 6);
      }
    }
    // Porte
    const door = tileCenter(grid.door.x, grid.door.y);
    g.fillStyle(0x8a5a3b, 1).fillRoundedRect(door.x - 26, door.y - 30, 52, 60, 8);
    text(this, door.x, door.y, '🚪', 30).setOrigin(0.5).setDepth(1);

    // Habillage selon l'agrandissement
    const kitchenW = 7 * TILE;
    if (stage === 0) {
      // Food truck : carrosserie autour de la cuisine
      g.lineStyle(8, 0xffb347, 1).strokeRoundedRect(4, HUD_HEIGHT + 4, kitchenW - 8, 10 * TILE - 8, 18);
      for (let i = 0; i < 7; i++) g.fillStyle(i % 2 ? 0xffffff : 0xef6f6c, 1).fillRect(i * TILE, HUD_HEIGHT, TILE, 8);
    }
    const st = STAGES[stage];
    text(this, 7.5 * TILE, HUD_HEIGHT + 30, st.name.toUpperCase().replace(' ', '\n'), 12, '#fff6e6', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5).setDepth(2);
  }

  private stationBase(s: StationState) {
    const { tx, ty } = s.spec;
    const x = tx * TILE;
    const y = ty * TILE + HUD_HEIGHT;
    const P = THEME.palette;
    const g = this.add.graphics().setDepth(2);
    const c = tileCenter(tx, ty);
    switch (s.spec.type) {
      case 'table': {
        g.fillStyle(0x000000, 0.15).fillEllipse(c.x, c.y + 18, 56, 16);
        g.fillStyle(0x8a5a3b, 1).fillRect(c.x - 4, c.y, 8, 22);
        g.fillStyle(P.tableTop, 1).fillCircle(c.x, c.y, 26).lineStyle(3, 0x8a5a3b).strokeCircle(c.x, c.y, 26);
        g.fillStyle(0xffffff, 0.6).fillCircle(c.x, c.y, 18);
        // chaise
        g.fillStyle(0xc0874f, 1).fillRoundedRect(c.x + TILE - 18, c.y + 4, 36, 22, 6);
        break;
      }
      case 'stove':
        g.fillStyle(0x4b4b5a, 1).fillRoundedRect(x + 2, y + 2, TILE - 4, TILE - 4, 10);
        g.fillStyle(0x2b2b33, 1).fillCircle(c.x, c.y, 22);
        g.lineStyle(3, 0x777788).strokeCircle(c.x, c.y, 16);
        break;
      case 'trash':
        g.fillStyle(0x8a8f9c, 1).fillRoundedRect(x + 10, y + 8, TILE - 20, TILE - 14, 8);
        g.fillStyle(0x6b707c, 1).fillRoundedRect(x + 6, y + 4, TILE - 12, 10, 4);
        break;
      default:
        g.fillStyle(P.counter, 1).fillRoundedRect(x + 2, y + 2, TILE - 4, TILE - 4, 10);
        g.fillStyle(P.counterTop, 1).fillRoundedRect(x + 5, y + 5, TILE - 10, TILE - 16, 8);
        if (s.spec.type === 'board') g.fillStyle(0xf7e1b5, 1).fillRoundedRect(x + 12, y + 12, TILE - 24, TILE - 28, 6).lineStyle(2, 0xc49a6c).strokeRoundedRect(x + 12, y + 12, TILE - 24, TILE - 28, 6);
        if (s.spec.type === 'crate') {
          g.fillStyle(0xa86b3c, 1).fillRoundedRect(x + 8, y + 10, TILE - 16, TILE - 22, 6);
          g.lineStyle(2, 0x7a4a26).lineBetween(x + 8, y + 26, x + TILE - 8, y + 26);
          const icon = THEME.ingredientIcons[s.spec.ingredient ?? ''] ?? '❓';
          text(this, c.x, c.y - 4, icon, 28).setOrigin(0.5).setDepth(3);
          text(this, c.x, c.y + 22, INGREDIENTS[s.spec.ingredient ?? '']?.name ?? '', 11, '#2b2340', { fontStyle: 'bold' }).setOrigin(0.5).setDepth(3);
        }
        if (s.spec.type === 'plates') {
          for (let i = 0; i < 3; i++) g.fillStyle(0xffffff, 1).fillEllipse(c.x, c.y + 6 - i * 6, 40, 14).lineStyle(1, 0xb0a8c0).strokeEllipse(c.x, c.y + 6 - i * 6, 40, 14);
        }
    }
  }

  private createStationView(s: StationState) {
    this.stationBase(s);
    const bar = this.add.graphics().setDepth(12);
    const view: { sig: string; bar: Phaser.GameObjects.Graphics; lock?: Phaser.GameObjects.Text } = { sig: '', bar };
    if (s.locked) {
      const c = tileCenter(s.spec.tx, s.spec.ty);
      const veil = this.add.graphics().setDepth(4);
      veil.fillStyle(0x2b2340, 0.55).fillRoundedRect(s.spec.tx * TILE + 2, s.spec.ty * TILE + HUD_HEIGHT + 2, TILE - 4, TILE - 4, 10);
      if (s.spec.type === 'table') veil.fillRoundedRect((s.spec.tx + 1) * TILE + 2, s.spec.ty * TILE + HUD_HEIGHT + 2, TILE - 4, TILE - 4, 10);
      view.lock = text(this, c.x, c.y, '🔒', 22).setOrigin(0.5).setDepth(5);
    }
    this.stationViews.set(s.spec.id, view);
  }

  // ───────────────────────── Objets ─────────────────────────

  private itemView(item: Item): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    if (item.kind === 'ing') {
      const ring = { brut: 0xffffff, coupe: 0x9be3a5, cuit: 0xffb26b, brule: 0x3b3340 }[item.state];
      const g = this.add.graphics();
      g.fillStyle(ring, item.state === 'brut' ? 0 : 0.9).fillCircle(0, 0, 20);
      const icon = text(this, 0, 0, THEME.ingredientIcons[item.id] ?? '❓', item.state === 'coupe' ? 22 : 28).setOrigin(0.5);
      c.add([g, icon]);
      if (item.state === 'coupe') c.add(text(this, 12, 10, '🔪', 12).setOrigin(0.5));
      if (item.state === 'cuit') c.add(text(this, 12, 10, '🔥', 12).setOrigin(0.5));
      if (item.state === 'brule') { icon.setTint(0x333333); c.add(text(this, 10, -14, '💨', 16).setOrigin(0.5)); }
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.15).fillEllipse(0, 6, 50, 18);
      g.fillStyle(0xffffff, 1).fillEllipse(0, 2, 50, 24).lineStyle(2, 0xb0a8c0).strokeEllipse(0, 2, 50, 24);
      g.lineStyle(1, 0xd8d0e8).strokeEllipse(0, 2, 34, 14);
      c.add(g);
      const dish = dishOf(item.parts, this.sim.recipes);
      if (dish) {
        c.add(text(this, 0, -6, THEME.recipeIcons[dish.id] ?? '🍽️', 30).setOrigin(0.5));
        c.add(text(this, 18, -18, '✨', 14).setOrigin(0.5));
      } else {
        item.parts.forEach((p, i) => {
          const [id] = p.split(':');
          c.add(text(this, (i - (item.parts.length - 1) / 2) * 16, -2, THEME.ingredientIcons[id] ?? '❓', 16).setOrigin(0.5));
        });
      }
    }
    return c;
  }

  // ───────────────────────── HUD ─────────────────────────

  private createHud() {
    const save = Session.data;
    const g = this.add.graphics().setDepth(40);
    g.fillStyle(THEME.palette.hud, 1).fillRect(0, 0, GAME_WIDTH, HUD_HEIGHT);
    g.fillStyle(0x000000, 0.2).fillRect(0, HUD_HEIGHT - 4, GAME_WIDTH, 4);
    const flags = STAGES.slice(0, save.stage + 1).map((s) => CUISINES.find((c) => c.id === s.cuisine)!.flag).join('');
    text(this, 16, HUD_HEIGHT / 2, `Jour ${save.day}  ${flags}`, 24, THEME.palette.hudText, { fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(41);
    const timer = text(this, 330, HUD_HEIGHT / 2, '', 28, THEME.palette.hudText, { fontStyle: 'bold' }).setOrigin(0.5).setDepth(41);
    const coins = text(this, 470, HUD_HEIGHT / 2, '', 24, '#ffd166', { fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(41);
    const goal = this.add.graphics().setDepth(41);
    this.hud = { timer, coins, goal };

    const bookBtn = button(this, GAME_WIDTH - 150, HUD_HEIGHT / 2, '📖 Recettes', () => this.toggleBook(), { w: 150, h: 42, size: 18 });
    bookBtn.setDepth(42);
    const mute = text(this, GAME_WIDTH - 40, HUD_HEIGHT / 2, isMuted() ? '🔇' : '🔊', 26).setOrigin(0.5).setDepth(42).setInteractive({ useHandCursor: true });
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
    const x0 = 570, w = 190, y = HUD_HEIGHT / 2;
    const max = goal * BALANCE.starMultipliers[2];
    g.clear();
    g.fillStyle(0x2b2340, 1).fillRoundedRect(x0, y - 9, w, 18, 9);
    g.fillStyle(THEME.palette.good, 1).fillRoundedRect(x0, y - 9, Math.max(18, w * Math.min(1, this.sim.coins / max)), 18, 9);
    const stars = starsFor(this.sim.coins, goal);
    BALANCE.starMultipliers.forEach((m, i) => {
      const sx = x0 + (w * m * goal) / max;
      g.fillStyle(i < stars ? 0xffd166 : 0x8a8299, 1).fillCircle(Math.min(sx, x0 + w - 4), y, 7);
    });
  }

  private toggleBook() {
    if (this.book) { this.book.destroy(); this.book = undefined; this.paused = false; return; }
    this.paused = true;
    const c = this.add.container(0, 0).setDepth(100);
    const veil = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5).setInteractive();
    veil.on('pointerup', () => this.toggleBook());
    c.add(veil);
    const recipes = this.sim.recipes;
    const h = 120 + recipes.length * 58;
    const y0 = (GAME_HEIGHT - h) / 2;
    c.add(panel(this, 180, y0, 600, h));
    c.add(text(this, GAME_WIDTH / 2, y0 + 36, '📖 Livre de recettes (pause)', 28, '#2b2340', { fontStyle: 'bold' }).setOrigin(0.5));
    const stateLabel: Record<string, string> = { brut: '', coupe: ' coupé', cuit: ' cuit', brule: ' brûlé' };
    recipes.forEach((r, i) => {
      const y = y0 + 90 + i * 58;
      const parts = (r.parts as Part[]).map((p) => {
        const [id, st] = p.split(':');
        return `${THEME.ingredientIcons[id]}${stateLabel[st]}`;
      }).join('  +  ');
      c.add(text(this, 210, y, `${THEME.recipeIcons[r.id]} ${r.name}`, 22, '#2b2340', { fontStyle: 'bold' }).setOrigin(0, 0.5));
      c.add(text(this, 430, y, parts, 20, '#6d5a8c').setOrigin(0, 0.5));
      c.add(text(this, 760, y, `🪙${r.price}`, 18, '#2b2340').setOrigin(1, 0.5));
    });
    c.add(text(this, GAME_WIDTH / 2, y0 + h - 22, 'Touche R ou clic pour reprendre', 16, '#6d5a8c').setOrigin(0.5));
    this.book = c;
  }

  private banner(msg: string) {
    const t = text(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, msg, 36, '#fff6e6', { fontStyle: 'bold', stroke: '#2b2340', strokeThickness: 8 }).setOrigin(0.5).setDepth(90).setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 300, ease: 'Back.out', yoyo: true, hold: 1400, onComplete: () => t.destroy() });
  }

  private startTips() {
    let i = 0;
    this.tip = text(this, 11.5 * TILE, GAME_HEIGHT - 80, '', 17, '#fff6e6', { backgroundColor: '#2b2340dd', padding: { x: 12, y: 8 }, wordWrap: { width: 400 }, align: 'center' }).setOrigin(0.5, 1).setDepth(60);
    const show = () => { this.tip?.setText(`💡 ${TIPS[i % TIPS.length]}`); i++; };
    show();
    this.time.addEvent({ delay: 9000, loop: true, callback: show });
  }

  // ───────────────────────── Entrées ─────────────────────────

  private setupInput() {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,Z,Q,SPACE,E,R') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-SPACE', () => !this.paused && this.sim.dispatch({ type: 'interact', player: PLAYER }));
    kb.on('keydown-E', () => !this.paused && this.sim.dispatch({ type: 'interact', player: PLAYER }));
    kb.on('keydown-R', () => this.toggleBook());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.paused || over.length || p.y < HUD_HEIGHT) return;
      const t = worldToTile(p.worldX, p.worldY);
      let st = this.sim.grid.stationAt(t.x, t.y);
      // Cliquer sur la chaise d'un client revient à cliquer sur sa table.
      if (!st) { const left = this.sim.grid.stationAt(t.x - 1, t.y); if (left?.type === 'table') st = left; }
      if (st) this.sim.dispatch({ type: 'interactAt', player: PLAYER, station: st.id });
      else this.sim.dispatch({ type: 'moveTo', player: PLAYER, tx: t.x, ty: t.y });
    });
  }

  private readKeyboard() {
    const k = this.keys;
    const dx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown || k.Q.isDown ? 1 : 0);
    const dy = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown || k.Z.isDown ? 1 : 0);
    const sig = `${dx},${dy}`;
    if (sig !== this.lastInput) { this.lastInput = sig; this.sim.dispatch({ type: 'input', player: PLAYER, dx, dy }); }
  }

  // ───────────────────────── Boucle ─────────────────────────

  update(_t: number, deltaMs: number) {
    if (this.paused || this.finished) return;
    this.readKeyboard();
    this.sim.tick(Math.min(deltaMs, 100) / 1000);
    for (const e of this.sim.drainEvents()) this.onEvent(e);
    this.renderStations();
    this.renderPlayer();
    this.renderCustomers();
    this.updateHud();
  }

  private onEvent(e: SimEvent) {
    switch (e.type) {
      case 'pickup': sfx.pickup(); break;
      case 'drop': sfx.drop(); break;
      case 'nope': sfx.nope(); this.floatText(e.x, e.y - 20, '✋', '#ffffff'); break;
      case 'trash': sfx.trash(); break;
      case 'chopDone': case 'cookDone': sfx.done(); this.floatText(e.x, e.y - 30, e.type === 'chopDone' ? 'Coupé !' : 'Cuit !', '#ffffff'); break;
      case 'burnt': sfx.burnt(); this.floatText(e.x, e.y - 30, 'Brûlé…', '#ef6f6c'); break;
      case 'served':
        sfx.served();
        this.floatText(e.x, e.y - 30, `+${e.coins}${e.tip ? ` (+${e.tip} pourboire)` : ''}`, '#ffd166');
        break;
      case 'arrived': sfx.bell(); break;
      case 'left': sfx.left(); break;
      case 'closing': this.banner('Dernières commandes !'); break;
      case 'ended': this.finish(); break;
    }
  }

  private floatText(x: number, y: number, str: string, color: string) {
    const t = text(this, x, y, str, 20, color, { fontStyle: 'bold', stroke: '#2b2340', strokeThickness: 5 }).setOrigin(0.5).setDepth(80);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 1100, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }

  private renderStations() {
    for (const s of this.sim.stations) {
      const v = this.stationViews.get(s.spec.id)!;
      const sig = s.item ? JSON.stringify(s.item) : '';
      const c = tileCenter(s.spec.tx, s.spec.ty);
      if (sig !== v.sig) {
        v.item?.destroy();
        v.item = s.item ? this.itemView(s.item).setPosition(c.x, c.y - 4).setDepth(10) : undefined;
        v.sig = sig;
      }
      v.bar.clear();
      const it = s.item;
      if (it?.kind === 'ing' && s.progress > 0) {
        let k = 0, color = THEME.palette.good;
        if (s.spec.type === 'board') k = s.progress / this.sim.params.chopSeconds;
        else if (it.state === 'cuit') { k = s.progress / this.sim.params.burnSeconds; color = k > 0.5 ? THEME.palette.bad : THEME.palette.warn; }
        else k = s.progress / this.sim.params.cookSeconds;
        const bx = c.x - 24, by = c.y + 20;
        v.bar.fillStyle(0x2b2340, 0.9).fillRoundedRect(bx - 2, by - 2, 52, 10, 5);
        v.bar.fillStyle(color, 1).fillRoundedRect(bx, by, 48 * Math.min(1, k), 6, 3);
        if (it.state === 'cuit' && k > 0.5 && Math.floor(this.sim.time * 6) % 2 === 0) v.bar.lineStyle(3, THEME.palette.bad).strokeCircle(c.x, c.y, 28);
      }
      // Fumée de cuisson
      if (s.spec.type === 'stove' && it?.kind === 'ing' && Math.random() < 0.04) {
        const puff = text(this, c.x + (Math.random() - 0.5) * 20, c.y - 10, it.state === 'brule' ? '💨' : '♨️', 14).setOrigin(0.5).setDepth(11).setAlpha(0.8);
        this.tweens.add({ targets: puff, y: c.y - 40, alpha: 0, duration: 900, onComplete: () => puff.destroy() });
      }
    }
  }

  private renderPlayer() {
    const p = this.sim.players.get(PLAYER)!;
    const moving = p.path.length > 0 || p.input.dx !== 0 || p.input.dy !== 0;
    this.playerView.setPosition(p.x, p.y + (moving ? Math.sin(this.sim.time * 18) * 2 : 0));
    this.playerView.setScale(p.faceX < 0 ? -1 : 1, 1);
    const sig = p.holding ? JSON.stringify(p.holding) : '';
    if (sig !== this.heldSig) {
      this.heldView?.destroy();
      this.heldView = p.holding ? this.itemView(p.holding).setDepth(21) : undefined;
      this.heldSig = sig;
    }
    this.heldView?.setPosition(p.x + p.faceX * 22, p.y + 6 + p.faceY * 10);

    const target = this.sim.targetStation(p);
    this.highlight.clear();
    if (target && !target.locked) {
      this.highlight.lineStyle(4, 0xffffff, 0.8 + Math.sin(this.sim.time * 6) * 0.2)
        .strokeRoundedRect(target.spec.tx * TILE + 2, target.spec.ty * TILE + HUD_HEIGHT + 2, TILE - 4, TILE - 4, 12);
    }
  }

  private renderCustomers() {
    const alive = new Set<number>();
    for (const cu of this.sim.customers) {
      alive.add(cu.id);
      let v = this.customerViews.get(cu.id);
      if (!v) v = this.createCustomerView(cu);
      const pos = this.sim.customerPosition(cu);
      const walking = cu.phase === 'arriving' || cu.phase === 'leaving';
      v.c.setPosition(pos.x, pos.y + (walking ? Math.sin(this.sim.time * 16) * 2 : 0));
      if (v.phase !== cu.phase) this.onCustomerPhase(cu, v);
      v.bar.clear();
      if (cu.phase === 'waiting') {
        const k = cu.patience / cu.patienceMax;
        const color = k > 0.5 ? THEME.palette.good : k > 0.25 ? THEME.palette.warn : THEME.palette.bad;
        v.bar.fillStyle(0x2b2340, 0.9).fillRoundedRect(-24, -34, 48, 8, 4);
        v.bar.fillStyle(color, 1).fillRoundedRect(-23, -33, 46 * k, 6, 3);
        if (k < 0.25) v.bubble.setAngle(Math.sin(this.sim.time * 20) * 6);
      }
    }
    for (const [id, v] of this.customerViews) {
      if (!alive.has(id)) { v.c.destroy(); this.customerViews.delete(id); }
    }
  }

  private createCustomerView(cu: CustomerState) {
    const color = THEME.customerColors[cu.color % THEME.customerColors.length];
    const c = this.add.container(0, 0).setDepth(15);
    const body = drawChef(this, color, ['aucun', 'casquette', 'bandana'][cu.color % 3], 0.9);
    const bubble = this.add.container(0, -64);
    const bar = this.add.graphics();
    bubble.add(bar);
    c.add([body, bubble]);
    const v = { c, bubble, bar, phase: '' };
    this.customerViews.set(cu.id, v);
    return v;
  }

  private onCustomerPhase(cu: CustomerState, v: { bubble: Phaser.GameObjects.Container; bar: Phaser.GameObjects.Graphics; phase: string }) {
    v.phase = cu.phase;
    v.bubble.removeAll(true);
    v.bar = this.add.graphics();
    v.bubble.setAngle(0);
    if (cu.phase === 'waiting') {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1).fillRoundedRect(-30, -28, 60, 52, 14).fillTriangle(-6, 22, 6, 22, 0, 32);
      g.lineStyle(2, 0x2b2340, 0.3).strokeRoundedRect(-30, -28, 60, 52, 14);
      v.bubble.add([g, text(this, 0, -2, THEME.recipeIcons[cu.order] ?? '❓', 30).setOrigin(0.5), v.bar]);
      v.bubble.setScale(0);
      this.tweens.add({ targets: v.bubble, scale: 1, duration: 250, ease: 'Back.out' });
    } else if (cu.phase === 'eating') {
      v.bubble.add(text(this, 0, 0, '😋', 30).setOrigin(0.5));
      const table = this.sim.station(cu.tableId)!.spec;
      const tc = tileCenter(table.tx, table.ty);
      const dish = text(this, tc.x, tc.y - 4, THEME.recipeIcons[cu.order] ?? '🍽️', 28).setOrigin(0.5).setDepth(9);
      this.tweens.add({ targets: dish, alpha: 0, delay: BALANCE.eatSeconds * 1000 - 300, duration: 300, onComplete: () => dish.destroy() });
      const heart = text(this, 0, -20, '💖', 22).setOrigin(0.5);
      v.bubble.add(heart);
      this.tweens.add({ targets: heart, y: -50, alpha: 0, duration: 1200 });
    } else if (cu.phase === 'leaving') {
      v.bubble.add(text(this, 0, 0, cu.happy ? '👋' : '😤', 28).setOrigin(0.5));
    }
    if (!v.bubble.exists(v.bar)) v.bubble.add(v.bar);
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
