import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/content';
import { THEME } from '../config/theme';
import { button, text, panel, drawChef, colorOf } from '../ui/widgets';
import { Session, fadeTo } from './state';
import { sfx } from '../ui/sfx';

type LookKey = 'avatarColor' | 'hat' | 'floor' | 'wall';

export class CustomizeScene extends Phaser.Scene {
  private back = 'Menu';
  constructor() { super('Customize'); }

  create(data: { back?: string }) {
    this.back = data.back ?? this.back;
    this.cameras.main.fadeIn(150, 43, 35, 64);
    const look = Session.data.look;
    const cx = GAME_WIDTH / 2;
    text(this, cx, 40, 'Personnalisation', 38, '#ffb347', { fontStyle: 'bold' }).setOrigin(0.5);

    // Aperçu
    panel(this, 40, 100, 300, 480, 0xfff6e6);
    const floor = colorOf(THEME.floorColors, look.floor);
    const wall = colorOf(THEME.wallColors, look.wall);
    const g = this.add.graphics();
    g.fillStyle(wall.color, 1).fillRoundedRect(70, 130, 240, 90, { tl: 14, tr: 14, bl: 0, br: 0 });
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) g.fillStyle((x + y) % 2 ? floor.a : floor.b, 1).fillRect(70 + x * 60, 220 + y * 60, 60, 60);
    const chef = drawChef(this, colorOf(THEME.avatarColors, look.avatarColor).color, look.hat, 2.2);
    chef.setPosition(190, 340);
    text(this, 190, 520, look.playerName, 24, '#2b2340', { fontStyle: 'bold' }).setOrigin(0.5);

    const row = (y: number, title: string, key: LookKey, items: { id: string; name: string; color?: number; a?: number }[]) => {
      text(this, 380, y, title, 22, '#fff6e6', { fontStyle: 'bold' });
      items.forEach((it, i) => {
        const x = 400 + i * 92;
        const yy = y + 66;
        const selected = look[key] === it.id;
        const sw = this.add.graphics();
        sw.fillStyle(selected ? 0xffb347 : 0x3d3158, 1).fillRoundedRect(x - 40, yy - 34, 80, 68, 14);
        const col = it.color ?? it.a;
        if (col !== undefined) sw.fillStyle(col, 1).fillCircle(x, yy - 6, 18).lineStyle(2, 0x2b2340).strokeCircle(x, yy - 6, 18);
        text(this, x, yy + (col !== undefined ? 22 : 0), it.name, 14, selected ? '#2b2340' : '#fff6e6').setOrigin(0.5);
        const z = this.add.zone(x, yy, 80, 68).setInteractive({ useHandCursor: true });
        z.on('pointerup', () => { look[key] = it.id; sfx.pickup(); Session.persist(); this.scene.restart({ back: this.back }); });
      });
    };
    row(100, 'Couleur de la veste', 'avatarColor', THEME.avatarColors);
    row(220, 'Chapeau', 'hat', THEME.hats);
    row(340, 'Sol du restaurant', 'floor', THEME.floorColors);
    row(460, 'Murs', 'wall', THEME.wallColors);

    const name = button(this, 190, 620, 'Changer de nom', () => {
      const n = window.prompt('Nom du chef ?', look.playerName);
      if (n && n.trim()) { look.playerName = n.trim().slice(0, 16); Session.persist(); this.scene.restart({ back: this.back }); }
    }, { w: 240, color: 0x6ec6ff, size: 20 });
    name.setDepth(1);
    button(this, 700, 640, 'Terminé', () => fadeTo(this, this.back), { w: 240 });
  }
}
