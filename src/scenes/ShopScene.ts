import Phaser from 'phaser';
import { GAME_WIDTH, STAGES, UPGRADES, CUISINES, LEVELS_PER_STAGE } from '../config/content';
import { THEME } from '../config/theme';
import { button, text, panel } from '../ui/widgets';
import { Session, fadeTo } from './state';
import { buyStage, buyUpgrade, nextStageCost, nextUpgradeCost, upgradeLevel, canBuyStage, needsExpansion, playableLevel, levelGoal, goalLabel } from '../core/progress';
import { recipesForStage } from '../core/recipes';
import { sfx } from '../ui/sfx';

export class ShopScene extends Phaser.Scene {
  constructor() { super('Shop'); }

  create() {
    this.cameras.main.fadeIn(200, 43, 35, 64);
    const s = Session.data;
    const cx = GAME_WIDTH / 2;

    text(this, cx, 40, 'Entre deux services', 38, '#ffb347', { fontStyle: 'bold' }).setOrigin(0.5);
    text(this, cx, 84, `🪙 ${s.coins}  ·  Réputation ${s.reputation}/100`, 22).setOrigin(0.5);

    // ── Agrandissement ──
    panel(this, 30, 116, 420, 430, 0xfff6e6);
    const stage = STAGES[s.stage];
    const next = STAGES[s.stage + 1];
    text(this, 240, 150, 'Agrandir le restaurant', 26, '#2b2340', { fontStyle: 'bold' }).setOrigin(0.5);
    const flags = STAGES.slice(0, s.stage + 1).map((st) => CUISINES.find((c) => c.id === st.cuisine)!.flag).join(' ');
    text(this, 240, 186, `${stage.icon} ${stage.name} · ${flags}`, 21, '#6d5a8c').setOrigin(0.5);
    // Les 5 niveaux du restaurant, avec leurs étoiles
    const first = s.stage * LEVELS_PER_STAGE + 1;
    for (let i = 0; i < LEVELS_PER_STAGE; i++) {
      const lv = first + i;
      const x = 240 + (i - 2) * 72;
      const done = s.bestStars[lv] !== undefined;
      const current = lv === playableLevel(s);
      const g = this.add.graphics();
      g.fillStyle(done ? 0x7ee0b0 : current ? 0xffb347 : 0xd8d0e8, 1).fillCircle(x, 232, 24);
      if (current) g.lineStyle(3, 0x2b2340).strokeCircle(x, 232, 24);
      text(this, x, 232, `${lv}`, 20, '#2b2340', { fontStyle: 'bold' }).setOrigin(0.5);
      if (done) text(this, x, 266, '★'.repeat(s.bestStars[lv]), 14, '#e0a100').setOrigin(0.5);
    }

    if (next) {
      const cuisine = CUISINES.find((c) => c.id === next.cuisine)!;
      const newRecipes = recipesForStage(s.stage + 1).filter((r) => r.cuisine === cuisine.id);
      text(this, 240, 312, `Prochaine étape : ${next.name}`, 24, '#2b2340', { fontStyle: 'bold' }).setOrigin(0.5);
      text(this, 240, 360, `${cuisine.flag} Cuisine ${cuisine.name === 'Inde' ? "de l'Inde" : cuisine.name === 'Japon' ? 'du Japon' : cuisine.name === 'Mexique' ? 'du Mexique' : "d'" + cuisine.name}`, 22, '#2b2340').setOrigin(0.5);
      text(this, 240, 396, newRecipes.map((r) => `${THEME.recipeIcons[r.id]} ${r.name}`).join('   '), 20, '#2b2340').setOrigin(0.5);
      text(this, 240, 430, `${next.seats} places · ${next.stoves} feux`, 20, '#2b2340').setOrigin(0.5);
      const cost = nextStageCost(s)!;
      if (!needsExpansion(s)) {
        text(this, 240, 480, `Réussis les ${LEVELS_PER_STAGE} niveaux pour agrandir\n(prix : 🪙 ${cost})`, 18, '#6d5a8c', { align: 'center' }).setOrigin(0.5);
      } else {
        button(this, 240, 495, `Agrandir · 🪙 ${cost}`, () => {
          if (buyStage(s)) { sfx.served(); Session.persist(); this.scene.restart(); } else sfx.nope();
        }, { w: 300, disabled: !canBuyStage(s), color: 0x7ee0b0 });
      }
    } else {
      text(this, 240, 400, 'Ton restaurant est au maximum.\nBravo, Maestro !', 24, '#2b2340', { align: 'center' }).setOrigin(0.5);
    }

    // ── Améliorations ──
    panel(this, 480, 116, 450, 430, 0xfff6e6);
    text(this, 705, 150, 'Améliorations', 26, '#2b2340', { fontStyle: 'bold' }).setOrigin(0.5);
    UPGRADES.forEach((u, i) => {
      const y = 186 + i * 52;
      const lvl = upgradeLevel(s, u.id);
      const cost = nextUpgradeCost(s, u.id);
      text(this, 500, y - 18, `${u.name}${u.costs.length > 1 ? ` (${lvl}/${u.costs.length})` : ''}`, 17, '#2b2340', { fontStyle: 'bold' });
      text(this, 500, y + 3, u.description, 12, '#6d5a8c', { wordWrap: { width: 290 } });
      if (cost === null) text(this, 855, y, 'Acquis ✓', 18, '#3f7a5c', { fontStyle: 'bold' }).setOrigin(0.5);
      else button(this, 860, y, `🪙 ${cost}`, () => {
        if (buyUpgrade(s, u.id)) { sfx.served(); Session.persist(); this.scene.restart(); } else sfx.nope();
      }, { w: 110, h: 40, size: 18, disabled: s.coins < cost });
    });

    button(this, 170, 600, 'Menu', () => fadeTo(this, 'Menu'), { w: 200, color: 0xb9aed0 });
    button(this, 420, 600, 'Personnaliser', () => fadeTo(this, 'Customize', { back: 'Shop' }), { w: 240, color: 0x6ec6ff });
    const lv = playableLevel(s);
    text(this, 760, 562, goalLabel(levelGoal(lv)), 14, '#d8cdf0').setOrigin(0.5);
    button(this, 760, 600, `${needsExpansion(s) ? 'Rejouer' : 'Jouer'} le niveau ${lv}`, () => fadeTo(this, 'Kitchen'), { w: 320, h: 60 });
  }
}
