import { describe, it, expect } from 'vitest';
import { KitchenSim } from '../src/core/sim';
import { newSave, serviceParams, starsFor, buyStage, applyServiceResult, levelGoal, needsExpansion, playableLevel } from '../src/core/progress';
import { canAddToPlate, dishOf, recipesForStage, ingredientsForStage } from '../src/core/recipes';
import { BALANCE } from '../src/config/content';

const fixedRng = () => 0.1;
const P = 'p1';

function setup(stage = 0) {
  const save = newSave();
  save.stage = stage;
  const sim = new KitchenSim(serviceParams(save), fixedRng);
  sim.addPlayer(P);
  const run = (sec: number) => { for (let i = 0; i < sec * 20; i++) sim.tick(0.05); };
  const tap = {
    bin: (ingredient: string) => sim.dispatch({ type: 'tapBin', player: P, ingredient }),
    slot: (slot: string) => sim.dispatch({ type: 'tapSlot', player: P, slot }),
    plate: (plate: number) => sim.dispatch({ type: 'tapPlate', player: P, plate }),
  };
  return { sim, run, tap };
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

describe('service au toucher', () => {
  it('prépare et sert un taco uniquement avec des touchers', () => {
    const { sim, run, tap } = setup();
    tap.bin('tortilla'); // directement sur une assiette
    expect(sim.plates[0].parts).toEqual(['tortilla:brut']);
    tap.bin('boeuf'); // part sur un feu
    tap.bin('tomate'); // part sur la planche
    expect(sim.slot('feu-0')!.item).toMatchObject({ id: 'boeuf', state: 'brut' });
    expect(sim.slot('planche-0')!.item).toMatchObject({ id: 'tomate' });
    run(BALANCE.cookSeconds + 0.2);
    tap.slot('feu-0');
    tap.slot('planche-0');
    expect(sim.dishOn(0)?.id).toBe('taco');

    const c = sim.customers[0];
    c.order = 'taco'; c.drink = null;
    while (c.phase !== 'waiting') run(0.1);
    tap.plate(0);
    expect(c.phase).toBe('eating');
    expect(sim.plates[0].parts).toEqual([]);
    // Les pièces restent sur la table jusqu'à ce qu'on les ramasse.
    expect(sim.coins).toBe(0);
    expect(sim.seats[c.seat].coins).toBeGreaterThanOrEqual(15);
    sim.dispatch({ type: 'tapSeat', player: P, seat: c.seat });
    expect(sim.coins).toBeGreaterThanOrEqual(15);
    expect(sim.seats[c.seat].coins).toBe(0);
  });

  it('un ingrédient pas encore prêt reste sur son appareil', () => {
    const { sim, tap } = setup();
    tap.bin('avocat');
    tap.slot('planche-0');
    expect(sim.slot('planche-0')!.item).not.toBeNull();
    expect(sim.drainEvents().some((e) => e.type === 'nope')).toBe(true);
  });

  it('les ingrédients complètent l’assiette déjà commencée', () => {
    const { sim, run, tap } = setup();
    tap.bin('avocat');
    run(BALANCE.chopSeconds + 0.1);
    tap.slot('planche-0');
    tap.bin('tortilla'); // ne va pas avec l'avocat : nouvelle assiette
    expect(sim.plates[0].parts).toEqual(['avocat:coupe']);
    expect(sim.plates[1].parts).toEqual(['tortilla:brut']);
  });

  it('l’assiette sélectionnée est prioritaire', () => {
    const { sim, run, tap } = setup();
    tap.bin('tortilla');
    tap.bin('tortilla');
    tap.plate(1); // sélection
    tap.bin('tomate');
    run(BALANCE.chopSeconds + 0.1);
    tap.slot('planche-0');
    expect(sim.plates[1].parts).toContain('tomate:coupe');
  });

  it('le bœuf brûle si on l’oublie, et on le jette d’un toucher', () => {
    const { sim, run, tap } = setup();
    tap.bin('boeuf');
    run(BALANCE.cookSeconds + BALANCE.burnSeconds + 0.5);
    expect(sim.slot('feu-0')!.item).toMatchObject({ state: 'brule' });
    tap.slot('feu-0');
    expect(sim.slot('feu-0')!.item).toBeNull();
  });

  it('les feux pleins refusent un nouvel ingrédient', () => {
    const { sim, tap } = setup();
    tap.bin('boeuf'); tap.bin('boeuf'); tap.bin('boeuf');
    expect(sim.slots.filter((s) => s.kind === 'feu' && s.item).length).toBe(2);
    expect(sim.drainEvents().some((e) => e.type === 'nope')).toBe(true);
  });

  it('commande plat + boisson : il faut servir les deux', () => {
    const { sim, run, tap } = setup();
    const c = sim.customers[0] ?? (run(3), sim.customers[0]);
    c.order = 'guacamole'; c.drink = 'limonade';
    while (c.phase !== 'waiting') run(0.1);
    sim.plates[0].parts = ['avocat:coupe', 'tomate:coupe'];
    tap.plate(0);
    expect(c.phase).toBe('waiting');
    expect(c.servedDish).toBe(true);
    tap.slot('bar-limonade'); // on remplit un verre
    run(BALANCE.pourSeconds + 0.1);
    tap.slot('bar-limonade'); // on le sert
    expect(c.phase).toBe('eating');
  });

  it('un plat cuit sans assiette libre part au réchaud et ne brûle plus', () => {
    const { sim, run, tap } = setup();
    sim.plates.forEach((p) => { p.parts = ['avocat:coupe']; });
    tap.bin('boeuf');
    run(BALANCE.cookSeconds + 0.1);
    tap.slot('feu-0');
    expect(sim.slot('rechaud-0')!.item).toMatchObject({ id: 'boeuf', state: 'cuit' });
    run(BALANCE.burnSeconds * 3);
    expect(sim.slot('rechaud-0')!.item).toMatchObject({ state: 'cuit' });
  });

  it('enchaîner les services fait monter le combo', () => {
    const { sim, run, tap } = setup();
    run(BALANCE.firstCustomerDelay + BALANCE.walkSeconds + 0.1);
    sim.customers.forEach((c) => { c.phase = 'waiting'; c.order = 'guacamole'; c.drink = null; });
    sim.customers.push({ ...sim.customers[0], id: 99, seat: (sim.customers[0].seat + 1) % 3 });
    sim.plates[0].parts = ['avocat:coupe', 'tomate:coupe'];
    sim.plates[1].parts = ['avocat:coupe', 'tomate:coupe'];
    tap.plate(0); tap.plate(1);
    expect(sim.combo).toBe(2);
  });

  it('le service se termine et ramasse les pièces oubliées', () => {
    const { sim, run } = setup();
    sim.seats[0].coins = 12;
    run(BALANCE.serviceSeconds + 40);
    expect(sim.ended).toBe(true);
    expect(sim.coins).toBeGreaterThanOrEqual(12);
  });
});

describe('progression par niveaux', () => {
  it('étoiles', () => {
    expect(starsFor(0, 90)).toBe(0);
    expect(starsFor(90, 90)).toBe(1);
    expect(starsFor(200, 90)).toBe(3);
  });
  it('on passe au niveau suivant seulement si l’objectif est rempli', () => {
    const save = newSave();
    applyServiceResult(save, { level: 1, coins: 40, served: 3, left: 2, stars: 0, success: false });
    expect(save.level).toBe(1);
    expect(save.coins).toBe(40);
    applyServiceResult(save, { level: 1, coins: 120, served: 9, left: 0, stars: 1, success: true });
    expect(save.level).toBe(2);
  });
  it('les objectifs varient et l’agrandissement demande d’avoir fini les 5 niveaux', () => {
    expect(levelGoal(1).type).toBe('pieces');
    expect(levelGoal(2).type).toBe('clients');
    expect(levelGoal(4).type).toBe('parfait');
    const save = newSave();
    save.coins = 1000;
    expect(buyStage(save)).toBe(false);
    save.level = 6;
    expect(needsExpansion(save)).toBe(true);
    expect(playableLevel(save)).toBe(5);
    expect(buyStage(save)).toBe(true);
    expect(save.stage).toBe(1);
    expect(serviceParams(save).level).toBe(6);
  });
});
