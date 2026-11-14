import { BALANCE, STAGES, UPGRADES } from '../config/content';

/** Données sauvegardées d'un joueur (locale ou cloud). Versionnée pour les migrations. */
export interface SaveData {
  version: 1;
  day: number;
  coins: number;
  stage: number;
  upgrades: Record<string, number>;
  bestStars: Record<number, number>;
  reputation: number;
  look: {
    floor: string;
    wall: string;
    avatarColor: string;
    hat: string;
    playerName: string;
  };
  updatedAt: number;
}

export function newSave(): SaveData {
  return {
    version: 1,
    day: 1,
    coins: 0,
    stage: 0,
    upgrades: {},
    bestStars: {},
    reputation: 50,
    look: { floor: 'creme', wall: 'lavande', avatarColor: 'blanc', hat: 'toque', playerName: 'Chef' },
    updatedAt: Date.now(),
  };
}

export const upgradeLevel = (save: SaveData, id: string) => save.upgrades[id] ?? 0;

export function nextUpgradeCost(save: SaveData, id: string): number | null {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return null;
  const lvl = upgradeLevel(save, id);
  return lvl < def.costs.length ? def.costs[lvl] : null;
}

export function buyUpgrade(save: SaveData, id: string): boolean {
  const cost = nextUpgradeCost(save, id);
  if (cost === null || save.coins < cost) return false;
  save.coins -= cost;
  save.upgrades[id] = upgradeLevel(save, id) + 1;
  return true;
}

export function nextStageCost(save: SaveData): number | null {
  const next = STAGES[save.stage + 1];
  return next ? next.cost : null;
}

export function buyStage(save: SaveData): boolean {
  const cost = nextStageCost(save);
  if (cost === null || save.coins < cost) return false;
  save.coins -= cost;
  save.stage += 1;
  return true;
}

/** Paramètres d'un service, calculés à partir du jour et des améliorations. */
export interface ServiceParams {
  day: number;
  stage: number;
  spawnInterval: number;
  patience: number;
  chopSeconds: number;
  cookSeconds: number;
  burnSeconds: number;
  playerSpeed: number;
  goal: number;
  tables: number;
  stoves: number;
}

export function serviceParams(save: SaveData): ServiceParams {
  const d = save.day - 1;
  const stage = STAGES[save.stage];
  return {
    day: save.day,
    stage: save.stage,
    spawnInterval: Math.max(BALANCE.spawnIntervalMin, BALANCE.spawnIntervalStart + BALANCE.spawnIntervalPerDay * d) * (stage.tables >= 5 ? 0.85 : 1),
    patience: Math.max(BALANCE.patienceMin, BALANCE.patienceStart + BALANCE.patiencePerDay * d) * (1 + 0.2 * upgradeLevel(save, 'deco')),
    chopSeconds: BALANCE.chopSeconds * (upgradeLevel(save, 'couteau') ? 0.65 : 1),
    cookSeconds: BALANCE.cookSeconds,
    burnSeconds: BALANCE.burnSeconds * (upgradeLevel(save, 'antiadhesive') ? 1.8 : 1),
    playerSpeed: BALANCE.playerSpeed * (upgradeLevel(save, 'chaussures') ? 1.15 : 1),
    goal: Math.round(BALANCE.goalBase + BALANCE.goalPerDay * d),
    tables: stage.tables,
    stoves: stage.stoves,
  };
}

export function starsFor(coins: number, goal: number): number {
  return BALANCE.starMultipliers.filter((m) => coins >= goal * m).length;
}

export interface ServiceResult {
  coins: number;
  served: number;
  left: number;
  stars: number;
}

/** Applique la fin d'un service à la sauvegarde. Le jour avance toujours : pas de blocage. */
export function applyServiceResult(save: SaveData, r: ServiceResult): void {
  save.coins += r.coins;
  save.bestStars[save.day] = Math.max(save.bestStars[save.day] ?? 0, r.stars);
  save.reputation = Math.max(0, Math.min(100, save.reputation + r.served * 2 - r.left * 4));
  save.day += 1;
  save.updatedAt = Date.now();
}
