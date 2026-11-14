import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config/content';
import { THEME } from './config/theme';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { KitchenScene } from './scenes/KitchenScene';
import { ResultScene } from './scenes/ResultScene';
import { ShopScene } from './scenes/ShopScene';
import { CustomizeScene } from './scenes/CustomizeScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: THEME.palette.background,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [BootScene, MenuScene, KitchenScene, ResultScene, ShopScene, CustomizeScene],
});
