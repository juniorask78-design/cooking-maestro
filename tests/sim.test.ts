import { describe, it, expect } from 'vitest';
import { KitchenSim } from '../src/core/sim';
import { newSave, serviceParams, starsFor, buyStage, applyServiceResult } from '../src/core/progress';
import { canAddToPlate, dishOf, recipesForStage, ingredientsForStage } from '../src/core/recipes';
import { BALANCE } from '../src/config/content';

const fixedRng = () => 0.1;

function setup() {
  const save = newSave();
  const sim = new KitchenSim(serviceParams(save), fixedRng);
  const p = sim.addPlayer('p1');
  return { sim, p };
}

describe('recettes', () => {
  it('le food truck ne propose que la cuisine mexicaine', () => {
    expect(recipesForStage(0).map((r) => r.id)).toEqual(['taco', 'guacamole']);
    expect(ingredientsForStage(0)).toEqual(['tortilla', 'boeuf', 'tomate', 'avocat']);
  });
  it('reconnaît un taco quel que soit l’ordre', () => {
    expect(dishOf(['tomate:coupe', 'boeuf:cuit', 'tortilla:brut'], recipesForStage(0))?.id).toBe('taco');
  });
  it('refuse un ingrédient qui ne mène à aucune recette', () => {
    expect(canAddToPlate(['tortilla:brut'], 'avocat:coupe', recipesForStage(0))).toBe(false);
    expect(canAddToPlate(['tortilla:brut'], 'boeuf:cuit', recipesForStage(0))).toBe(true);
  });
  it('le donburi réutilise le bœuf du Mexique', () => {
    expect(ingredientsForStage(2)).toContain('boeuf');
  });
});

describe('simulation', () => {
  it('prépare et sert un guacamole de bout en bout', () => {
    const { sim, p } = setup();
    const st = (type: string, i = 0) => sim.stations.find((s) => s.spec.type === type && s.spec.index === i)!;
    const crate = (ing: string) => sim.stations.find((s) => s.spec.ingredient === ing)!;
    const board = st('board');
    const counter = st('counter', 3);

    // Avocat : caisse -> planche -> découpe
    sim.interact(p, crate('avocat'));
    sim.interact(p, board);
    // On place le joueur à côté de la planche pour couper.
    p.x = (board.spec.tx - 1) * 64 + 32; p.y = board.spec.ty * 64 + 32 + 64;
    for (let i = 0; i < 30; i++) sim.tick(0.1);
    expect(board.item).toMatchObject({ id: 'avocat', state: 'coupe' });
    sim.interact(p, board);
    sim.interact(p, counter);

    sim.interact(p, crate('tomate'));
    sim.interact(p, board);
    for (let i = 0; i < 30; i++) sim.tick(0.1);
    // Assiette, puis on ramasse la tomate et l'avocat dedans.
    sim.interact(p, st('plates'));
    sim.interact(p, board);
    sim.interact(p, counter);
    expect(p.holding).toMatchObject({ kind: 'plate' });
    expect(dishOf((p.holding as { parts: string[] }).parts, sim.recipes)?.id).toBe('guacamole');

    // Un client commande un guacamole.
    while (!sim.customers.length) sim.tick(0.1);
    const c = sim.customers[0];
    c.order = 'guacamole';
    while (c.phase !== 'waiting') sim.tick(0.1);
    sim.interact(p, sim.station(c.tableId)!);
    expect(c.phase).toBe('eating');
    expect(sim.coins).toBeGreaterThanOrEqual(12);
  });

  it('le bœuf brûle si on l’oublie', () => {
    const { sim, p } = setup();
    const stove = sim.stations.find((s) => s.spec.type === 'stove')!;
    sim.interact(p, sim.stations.find((s) => s.spec.ingredient === 'boeuf')!);
    sim.interact(p, stove);
    for (let i = 0; i < (BALANCE.cookSeconds + BALANCE.burnSeconds + 1) * 10; i++) sim.tick(0.1);
    expect(stove.item).toMatchObject({ state: 'brule' });
  });

  it('les caisses des cuisines non débloquées sont verrouillées', () => {
    const { sim } = setup();
    expect(sim.stations.find((s) => s.spec.ingredient === 'riz')!.locked).toBe(true);
  });

  it('le service se termine', () => {
    const { sim } = setup();
    for (let i = 0; i < (BALANCE.serviceSeconds + 40) * 10 && !sim.ended; i++) sim.tick(0.1);
    expect(sim.ended).toBe(true);
  });
});

describe('progression', () => {
  it('étoiles et agrandissement', () => {
    expect(starsFor(0, 55)).toBe(0);
    expect(starsFor(55, 55)).toBe(1);
    expect(starsFor(200, 55)).toBe(3);
    const save = newSave();
    applyServiceResult(save, { coins: 150, served: 8, left: 0, stars: 3 });
    expect(save.day).toBe(2);
    expect(buyStage(save)).toBe(true);
    expect(save.stage).toBe(1);
    expect(save.coins).toBe(10);
  });
});
