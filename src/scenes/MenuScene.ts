import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, STAGES, CUISINES } from '../config/content';
import { playableLevel } from '../core/progress';
import { THEME } from '../config/theme';
import { button, text, drawChef, colorOf, panel } from '../ui/widgets';
import { Session, fadeTo } from './state';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    this.cameras.main.fadeIn(250, 43, 35, 64);
    const s = Session.data;
    const cx = GAME_WIDTH / 2;

    // Décor : drapeaux des cuisines qui flottent.
    CUISINES.forEach((c, i) => {
      const f = text(this, 120 + i * 240, 120 + (i % 2) * 40, c.flag, 54).setOrigin(0.5).setAlpha(0.35);
      this.tweens.add({ targets: f, y: f.y + 14, duration: 1800 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });

    text(this, cx, 125, THEME.restaurantName, 76, '#ffb347', { fontStyle: 'bold', stroke: '#2b2340', strokeThickness: 10 }).setOrigin(0.5);
    text(this, cx, 190, THEME.tagline, 24).setOrigin(0.5);

    const chef = drawChef(this, colorOf(THEME.avatarColors, s.look.avatarColor).color, s.look.hat, 2.4);
    chef.setPosition(cx, 335);
    this.tweens.add({ targets: chef, y: 327, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    panel(this, cx - 230, 400, 460, 54, 0x3d3158);
    text(this, cx, 427, `Niveau ${playableLevel(s)}  ·  ${STAGES[s.stage].name}  ·  🪙 ${s.coins}`, 22).setOrigin(0.5);

    button(this, cx, 500, s.level === 1 ? 'Ouvrir le food truck' : 'Continuer', () => fadeTo(this, s.level === 1 ? 'Kitchen' : 'Shop'), { w: 320, h: 64, size: 26 });
    button(this, cx - 130, 575, 'Personnaliser', () => fadeTo(this, 'Customize', { back: 'Menu' }), { w: 240, color: 0x7ee0b0 });
    button(this, cx + 130, 575, 'Coop en ligne', () => this.toast('La coop en ligne arrive dans une prochaine version !'), { w: 240, color: 0x6ec6ff });
    const reset = text(this, GAME_WIDTH - 20, GAME_HEIGHT - 16, 'Nouvelle partie', 16, '#b9aed0').setOrigin(1, 1).setInteractive({ useHandCursor: true });
    reset.on('pointerup', async () => {
      if (reset.text !== 'Confirmer ?') { reset.setText('Confirmer ?'); return; }
      Session.save = await Session.service.reset();
      this.scene.restart();
    });
    text(this, 20, GAME_HEIGHT - 16, 'Prototype v0.3', 16, '#b9aed0').setOrigin(0, 1);
  }

  private toast(msg: string) {
    const t = text(this, GAME_WIDTH / 2, 620, msg, 20, '#fff6e6', { backgroundColor: '#3d3158', padding: { x: 14, y: 8 } }).setOrigin(0.5);
    this.tweens.add({ targets: t, alpha: 0, delay: 2200, duration: 400, onComplete: () => t.destroy() });
  }
}
