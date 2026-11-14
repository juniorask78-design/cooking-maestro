/**
 * CONTENU & ÉQUILIBRAGE — ingrédients, recettes, cuisines, agrandissements, rythme et améliorations.
 * Les noms affichés sont en français ; les ids ne changent jamais (ils servent aux sauvegardes).
 */

export type IngredientState = 'brut' | 'coupe' | 'cuit' | 'brule';

/**
 * Chaque ingrédient a UN seul chemin de préparation, pour qu'un simple toucher suffise :
 *  - 'aucun'   : il part directement sur une assiette (ex. tortilla) ;
 *  - 'couper'  : il part sur une planche et se coupe tout seul ;
 *  - 'cuire'   : il part sur un feu, cuit tout seul… et brûle si on l'oublie.
 */
export type Process = 'aucun' | 'couper' | 'cuire';

export interface IngredientDef {
  id: string;
  name: string;
  process: Process;
}

export const INGREDIENTS: Record<string, IngredientDef> = {
  tortilla: { id: 'tortilla', name: 'Tortilla', process: 'aucun' },
  boeuf: { id: 'boeuf', name: 'Bœuf', process: 'cuire' },
  tomate: { id: 'tomate', name: 'Tomate', process: 'couper' },
  avocat: { id: 'avocat', name: 'Avocat', process: 'couper' },
  pates: { id: 'pates', name: 'Pâtes', process: 'cuire' },
  sauce: { id: 'sauce', name: 'Sauce tomate', process: 'cuire' },
  fromage: { id: 'fromage', name: 'Mozzarella', process: 'couper' },
  riz: { id: 'riz', name: 'Riz', process: 'cuire' },
  poisson: { id: 'poisson', name: 'Saumon', process: 'couper' },
  poulet: { id: 'poulet', name: 'Poulet', process: 'cuire' },
  epices: { id: 'epices', name: 'Épices', process: 'aucun' },
};

/** État final d'un ingrédient une fois préparé. */
export const READY_STATE: Record<Process, IngredientState> = { aucun: 'brut', couper: 'coupe', cuire: 'cuit' };

/** Une composante de recette : "ingredient:etat". */
export type Part = `${string}:${IngredientState}`;

export interface RecipeDef {
  id: string;
  name: string;
  cuisine: string;
  parts: Part[];
  price: number;
  /** Poids dans le tirage des commandes. */
  weight: number;
}

/**
 * CUISINES DU MONDE — chaque agrandissement du restaurant débloque une cuisine.
 * L'ordre des ingrédients donne l'ordre des bacs en bas de l'écran.
 */
export interface CuisineDef {
  id: string;
  name: string;
  flag: string;
  ingredients: string[];
}

export const CUISINES: CuisineDef[] = [
  { id: 'mexique', name: 'Mexique', flag: '🇲🇽', ingredients: ['tortilla', 'boeuf', 'tomate', 'avocat'] },
  { id: 'italie', name: 'Italie', flag: '🇮🇹', ingredients: ['pates', 'sauce', 'fromage'] },
  { id: 'japon', name: 'Japon', flag: '🇯🇵', ingredients: ['riz', 'poisson'] },
  { id: 'inde', name: 'Inde', flag: '🇮🇳', ingredients: ['poulet', 'epices'] },
];

export const RECIPES: RecipeDef[] = [
  { id: 'taco', name: 'Taco', cuisine: 'mexique', parts: ['tortilla:brut', 'boeuf:cuit', 'tomate:coupe'], price: 15, weight: 3 },
  { id: 'guacamole', name: 'Guacamole', cuisine: 'mexique', parts: ['avocat:coupe', 'tomate:coupe'], price: 11, weight: 3 },
  { id: 'pates', name: 'Pâtes sauce tomate', cuisine: 'italie', parts: ['pates:cuit', 'sauce:cuit'], price: 16, weight: 3 },
  { id: 'caprese', name: 'Caprese', cuisine: 'italie', parts: ['tomate:coupe', 'fromage:coupe'], price: 12, weight: 2 },
  { id: 'sushi', name: 'Sushi', cuisine: 'japon', parts: ['riz:cuit', 'poisson:coupe'], price: 17, weight: 3 },
  { id: 'donburi', name: 'Donburi', cuisine: 'japon', parts: ['riz:cuit', 'boeuf:cuit'], price: 17, weight: 2 },
  { id: 'curry', name: 'Curry', cuisine: 'inde', parts: ['poulet:cuit', 'riz:cuit', 'epices:brut'], price: 24, weight: 3 },
];

/**
 * AGRANDISSEMENTS — du food truck au grand restaurant.
 * Chaque étape ajoute des places pour les clients, des feux et une cuisine du monde.
 */
export interface StageDef {
  id: string;
  name: string;
  icon: string;
  cuisine: string;
  seats: number;
  stoves: number;
  /** Prix pour atteindre cette étape (0 pour la première). */
  cost: number;
}

export const STAGES: StageDef[] = [
  { id: 'foodtruck', name: 'Food truck', icon: '🚚', cuisine: 'mexique', seats: 3, stoves: 2, cost: 0 },
  { id: 'terrasse', name: 'Terrasse', icon: '⛱️', cuisine: 'italie', seats: 4, stoves: 3, cost: 220 },
  { id: 'bistrot', name: 'Petit restaurant', icon: '🏠', cuisine: 'japon', seats: 5, stoves: 3, cost: 480 },
  { id: 'restaurant', name: 'Grand restaurant', icon: '🏛️', cuisine: 'inde', seats: 6, stoves: 4, cost: 850 },
];

/**
 * RYTHME — « calme mais exigeant ».
 * Un service dure 2 min 30. Pas d'échec brutal : un client trop impatient part sans payer
 * et la réputation baisse un peu. Les étoiles récompensent la maîtrise.
 */
export const BALANCE = {
  serviceSeconds: 150,
  /** Plus aucun nouveau client N secondes avant la fermeture. */
  lastCallSeconds: 20,
  firstCustomerDelay: 2,
  spawnIntervalStart: 10,
  spawnIntervalPerDay: -0.6,
  spawnIntervalMin: 5.5,
  spawnJitter: 2,
  patienceStart: 50,
  patiencePerDay: -2.5,
  patienceMin: 30,
  chopSeconds: 2.5,
  cookSeconds: 5,
  burnSeconds: 6,
  eatSeconds: 3,
  walkSeconds: 1.6,
  tipMax: 0.5,
  plates: 3,
  boards: 1,
  /** Objectif de recette du jour pour 1 étoile ; 2★ et 3★ = multiplicateurs. */
  goalBase: 90,
  goalPerDay: 22,
  starMultipliers: [1, 1.4, 1.8] as const,
};

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  costs: number[]; // un coût par niveau
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'planche', name: 'Deuxième planche', description: 'Coupe deux ingrédients en même temps.', costs: [80] },
  { id: 'assiette', name: 'Plan de dressage', description: 'Une assiette de plus pour préparer plusieurs plats.', costs: [90] },
  { id: 'couteau', name: 'Couteau de chef', description: 'Coupe 40 % plus vite.', costs: [70] },
  { id: 'antiadhesive', name: 'Poêles antiadhésives', description: 'Les plats cuits brûlent deux fois moins vite.', costs: [75] },
  { id: 'deco', name: 'Décoration cosy', description: 'Les clients patientent 20 % plus longtemps (par niveau).', costs: [60, 140] },
];

/** Tous les ingrédients dans l'ordre des bacs. */
export const BIN_ORDER: string[] = CUISINES.flatMap((c) => c.ingredients);

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 640;
