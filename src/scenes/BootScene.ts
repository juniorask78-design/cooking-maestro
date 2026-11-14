import Phaser from 'phaser';
import { Session } from './state';
import { text } from '../ui/widgets';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/content';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    const t = text(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Chargement…', 28).setOrigin(0.5);
    void Session.init().then(() => { t.destroy(); this.scene.start('Menu'); });
  }
}
