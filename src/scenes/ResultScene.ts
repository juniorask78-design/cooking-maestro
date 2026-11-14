import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/content';
import { button, text, panel } from '../ui/widgets';
import { Session, fadeTo } from './state';
import { applyServiceResult, type ServiceResult } from '../core/progress';
import { sfx } from '../ui/sfx';

export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  create(data: ServiceResult & { goal: number; day: number }) {
    this.cameras.main.fadeIn(250, 43, 35, 64);
    const cx = GAME_WIDTH / 2;
    applyServiceResult(Session.data, data);
    Session.persist();

    panel(this, cx - 300, 70, 600, 580);
    text(this, cx, 150, `Fin du service · Jour ${data.day}`, 36, '#2b2340', { fontStyle: 'bold' }).setOrigin(0.5);
    const msgs = ['Une journée tranquille, on fera mieux demain !', 'Joli service !', 'Excellent service !', 'Service parfait, Maestro !'];
    text(this, cx, 200, msgs[data.stars], 22, '#6d5a8c').setOrigin(0.5);

    for (let i = 0; i < 3; i++) {
      const star = text(this, cx - 110 + i * 110, 290, '⭐', 72).setOrigin(0.5).setScale(0);
      if (i >= data.stars) star.setAlpha(0.2).setTint(0x000000);
      this.tweens.add({ targets: star, scale: 1, delay: 300 + i * 300, duration: 400, ease: 'Back.out', onStart: () => { if (i < data.stars) sfx.done(); } });
    }

    const lines = [
      `Recette : 🪙 ${data.coins}   (objectif ${data.goal})`,
      `Clients servis : ${data.served}`,
      `Clients partis sans manger : ${data.left}`,
      `Cagnotte totale : 🪙 ${Session.data.coins}`,
    ];
    lines.forEach((l, i) => text(this, cx, 380 + i * 40, l, 24, '#2b2340').setOrigin(0.5));

    button(this, cx, 600, 'Continuer', () => fadeTo(this, 'Shop'), { w: 280 });
  }
}
