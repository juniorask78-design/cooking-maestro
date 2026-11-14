import { BALANCE, STAGES, UPGRADES, DRINKS, LEVELS_PER_STAGE, type LevelGoal } from '../config/content';
import { cuisinesForStage } from './recipes';

/** Données sauvegardées d'un joueur (locale ou cloud). Versionnée pour les migrations. */
export interface SaveData {
  version: 2;
  /** Prochain niveau à jouer (1, 2, 3…), tous restaurants confondus. */
  level: number;
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
    version: 2,
    level: 1,
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

/** Dernier niveau du restaurant actuel (le grand restaurant n'a pas de limite). */
export function lastLevelOfStage(stage: number): number {
  return stage >= STAGES.length - 1 ? Infinity : (stage + 1) * LEVELS_PER_STAGE;
}

/** Tous les niveaux du restaurant sont réussis : il faut l'agrandir pour continuer. */
export function needsExpansion(save: SaveData): boolean {
  return save.level > lastLevelOfStage(save.stage);
}

/** Niveau qui sera joué au prochain service (on rejoue le dernier si l'agrandissement manque). */
export function playableLevel(save: SaveData): number {
  return needsExpansion(save) ? lastLevelOfStage(save.stage) : save.level;
}

/** Numéro du niveau dans son restaurant (1 à 5). */
export function levelInStage(level: number): number {
  return ((level - 1) % LEVELS_PER_STAGE) + 1;
}

export function nextStageCost(save: SaveData): number | null {
  const next = STAGES[save.stage + 1];
  return next ? next.cost : null;
}

export function canBuyStage(save: SaveData): boolean {
  const cost = nextStageCost(save);
  return cost !== null && needsExpansion(save) && save.coins >= cost;
}

export function buyStage(save: SaveData): boolean {
  if (!canBuyStage(save)) return false;
  save.coins -= nextStageCost(save)!;
  save.stage += 1;
  return true;
}

export function coinGoal(level: number): number {
  return Math.round(BALANCE.goalBase + BALANCE.goalPerLevel * (level - 1));
}

/** Objectif du niveau : il varie au fil des 5 niveaux d'un restaurant. */
export function levelGoal(level: number): LevelGoal {
  const k = levelInStage(level);
  const coins = coinGoal(level);
  if (k === 2) return { type: 'clients', target: 6 + Math.floor(level / 3) };
  if (k === 4) return { type: 'parfait', target: 1 };
  if (k === 5) return { type: 'pieces', target: Math.round(coins * 1.25) };
  return { type: 'pieces', target: coins };
}

export function goalLabel(g: LevelGoal): string {
  if (g.type === 'pieces') return `Gagner ${g.target} pièces`;
  if (g.type === 'clients') return `Servir ${g.target} clients`;
  return g.target <= 1 ? 'Ne perdre aucun client (1 erreur permise)' : `Perdre au plus ${g.target} clients`;
}

export function goalReached(g: LevelGoal, r: { coins: number; served: number; left: number }): boolean {
  if (g.type === 'pieces') return r.coins >= g.target;
  if (g.type === 'clients') return r.served >= g.target;
  return r.left <= g.target && r.served >= 3;
}

/** Paramètres d'un service, calculés à partir du niveau et des améliorations. */
export interface ServiceParams {
  level: number;
  stage: number;
  goal: LevelGoal;
  /** Pièces visées pour la 1re étoile. */
  coinGoal: number;
  spawnInterval: number;
  patience: number;
  chopSeconds: number;
  cookSeconds: number;
  burnSeconds: number;
  pourSeconds: number;
  seats: number;
  stoves: number;
  boards: number;
  plates: number;
  rechaud: number;
  drinks: string[];
  hurriedChance: number;
  tipBonus: number;
}

export function serviceParams(save: SaveData): ServiceParams {
  const level = playableLevel(save);
  const d = level - 1;
  const stage = STAGES[save.stage];
  const deco = upgradeLevel(save, 'deco');
  const cuisines = cuisinesForStage(save.stage);
  return {
    level,
    stage: save.stage,
    goal: levelGoal(level),
    coinGoal: coinGoal(level),
    spawnInterval: Math.max(BALANCE.spawnIntervalMin, BALANCE.spawnIntervalStart + BALANCE.spawnIntervalPerLevel * d) * (1 - 0.06 * save.stage),
    patience: Math.max(BALANCE.patienceMin, BALANCE.patienceStart + BALANCE.patiencePerLevel * d) * (1 + 0.15 * deco),
    chopSeconds: BALANCE.chopSeconds * (upgradeLevel(save, 'couteau') ? 0.6 : 1),
    cookSeconds: BALANCE.cookSeconds * (1 - 0.15 * upgradeLevel(save, 'feux')),
    burnSeconds: BALANCE.burnSeconds,
    pourSeconds: BALANCE.pourSeconds * (upgradeLevel(save, 'bar') ? 0.6 : 1),
    seats: stage.seats,
    stoves: stage.stoves,
    boards: BALANCE.boards + upgradeLevel(save, 'planche'),
    plates: BALANCE.plates + upgradeLevel(save, 'assiette'),
    rechaud: BALANCE.rechaud + upgradeLevel(save, 'rechaud'),
    drinks: DRINKS.filter((dr) => cuisines.includes(dr.cuisine)).map((dr) => dr.id),
    hurriedChance: level >= BALANCE.hurriedFromLevel ? BALANCE.hurriedChance : 0,
    tipBonus: 0.1 * deco,
  };
}

export function starsFor(coins: number, goal: number): number {
  return BALANCE.starMultipliers.filter((m) => coins >= goal * m).length;
}

export interface ServiceResult {
  level: number;
  coins: number;
  served: number;
  left: number;
  stars: number;
  success: boolean;
}

/**
 * Applique la fin d'un service. Les pièces gagnées sont toujours gardées (jeu détente) ;
 * on passe au niveau suivant seulement si l'objectif est rempli.
 */
export function applyServiceResult(save: SaveData, r: ServiceResult): void {
  save.coins += r.coins;
  if (r.success) {
    save.bestStars[r.level] = Math.max(save.bestStars[r.level] ?? 0, r.stars);
    if (r.level === save.level) save.level += 1;
  }
  save.reputation = Math.max(0, Math.min(100, save.reputation + r.served * 2 - r.left * 4));
  save.updatedAt = Date.now();
}
