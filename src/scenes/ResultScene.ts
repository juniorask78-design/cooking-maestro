import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/content';
import { button, text, panel } from '../ui/widgets';
import { Session, fadeTo } from './state';
import { applyServiceResult, goalLabel, type ServiceResult } from '../core/progress';
import type { LevelGoal } from '../config/content';
import { sfx } from '../ui/sfx';

export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  create(data: ServiceResult & { goal: LevelGoal; coinGoal: number }) {
    this.cameras.main.fadeIn(250, 43, 35, 64);
    const cx = GAME_WIDTH / 2;
    applyServiceResult(Session.data, data);
    Session.persist();

    panel(this, cx - 300, 40, 600, 570);
    text(this, cx, 96, data.success ? `Niveau ${data.level} réussi !` : `Niveau ${data.level} : objectif manqué`, 34, '#2b2340', { fontStyle: 'bold' }).setOrigin(0.5);
    text(this, cx, 142, `${data.success ? '✅' : '🎯'} ${goalLabel(data.goal)}`, 21, data.success ? '#3f7a5c' : '#a0524a').setOrigin(0.5);

    if (data.success) {
      for (let i = 0; i < 3; i++) {
        const star = text(this, cx - 110 + i * 110, 232, '⭐', 72).setOrigin(0.5).setScale(0);
        if (i >= data.stars) star.setAlpha(0.2).setTint(0x000000);
        this.tweens.add({ targets: star, scale: 1, delay: 300 + i * 300, duration: 400, ease: 'Back.out', onStart: () => { if (i < data.stars) sfx.done(); } });
      }
    } else {
      text(this, cx, 225, 'Pas grave : tu gardes tes pièces,\net tu peux retenter le niveau quand tu veux.', 21, '#6d5a8c', { align: 'center' }).setOrigin(0.5);
    }

    const lines = [
      `Pièces gagnées : 🪙 ${data.coins}   (★ dès ${data.coinGoal})`,
      `Clients servis : ${data.served}`,
      `Clients partis sans manger : ${data.left}`,
      `Cagnotte totale : 🪙 ${Session.data.coins}`,
    ];
    lines.forEach((l, i) => text(this, cx, 330 + i * 40, l, 23, '#2b2340').setOrigin(0.5));

    if (data.success) {
      button(this, cx, 550, 'Continuer', () => fadeTo(this, 'Shop'), { w: 280 });
    } else {
      button(this, cx - 140, 550, 'Réessayer', () => fadeTo(this, 'Kitchen'), { w: 240 });
      button(this, cx + 140, 550, 'Boutique', () => fadeTo(this, 'Shop'), { w: 240, color: 0x6ec6ff });
    }
  }
}
