/**
 * CONTENU & ÉQUILIBRAGE — ingrédients, recettes, rythme des services, améliorations, plan du restaurant.
 * Les noms affichés sont en français ; les ids ne changent jamais (ils servent aux sauvegardes).
 */

export type IngredientState = 'brut' | 'coupe' | 'cuit' | 'brule';

export interface IngredientDef {
  id: string;
  name: string;
  /** Peut être coupé sur la planche (brut -> coupe). */
  choppable: boolean;
  /** État d'entrée accepté par la poêle (ex. steak brut, tomate coupée). */
  cookFrom?: IngredientState;
}

export const INGREDIENTS: Record<string, IngredientDef> = {
  tortilla: { id: 'tortilla', name: 'Tortilla', choppable: false },
  boeuf: { id: 'boeuf', name: 'Bœuf', choppable: false, cookFrom: 'brut' },
  tomate: { id: 'tomate', name: 'Tomate', choppable: true, cookFrom: 'coupe' },
  avocat: { id: 'avocat', name: 'Avocat', choppable: true },
  pates: { id: 'pates', name: 'Pâtes', choppable: false, cookFrom: 'brut' },
  fromage: { id: 'fromage', name: 'Mozzarella', choppable: true },
  riz: { id: 'riz', name: 'Riz', choppable: false, cookFrom: 'brut' },
  poisson: { id: 'poisson', name: 'Saumon', choppable: true },
  poulet: { id: 'poulet', name: 'Poulet', choppable: false, cookFrom: 'brut' },
};

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
 * L'ordre des ingrédients donne l'ordre des caisses dans la cuisine.
 */
export interface CuisineDef {
  id: string;
  name: string;
  flag: string;
  ingredients: string[];
}

export const CUISINES: CuisineDef[] = [
  { id: 'mexique', name: 'Mexique', flag: '🇲🇽', ingredients: ['tortilla', 'boeuf', 'tomate', 'avocat'] },
  { id: 'italie', name: 'Italie', flag: '🇮🇹', ingredients: ['pates', 'fromage'] },
  { id: 'japon', name: 'Japon', flag: '🇯🇵', ingredients: ['riz', 'poisson'] },
  { id: 'inde', name: 'Inde', flag: '🇮🇳', ingredients: ['poulet'] },
];

export const RECIPES: RecipeDef[] = [
  { id: 'taco', name: 'Taco', cuisine: 'mexique', parts: ['tortilla:brut', 'boeuf:cuit', 'tomate:coupe'], price: 15, weight: 3 },
  { id: 'guacamole', name: 'Guacamole', cuisine: 'mexique', parts: ['avocat:coupe', 'tomate:coupe'], price: 12, weight: 3 },
  { id: 'pates', name: 'Pâtes tomate', cuisine: 'italie', parts: ['pates:cuit', 'tomate:cuit'], price: 17, weight: 3 },
  { id: 'caprese', name: 'Caprese', cuisine: 'italie', parts: ['tomate:coupe', 'fromage:coupe'], price: 13, weight: 2 },
  { id: 'sushi', name: 'Sushi', cuisine: 'japon', parts: ['riz:cuit', 'poisson:coupe'], price: 18, weight: 3 },
  { id: 'donburi', name: 'Donburi', cuisine: 'japon', parts: ['riz:cuit', 'boeuf:cuit'], price: 18, weight: 2 },
  { id: 'curry', name: 'Curry', cuisine: 'inde', parts: ['poulet:cuit', 'riz:cuit', 'tomate:cuit'], price: 26, weight: 3 },
];

/**
 * AGRANDISSEMENTS — du food truck au grand restaurant.
 * Chaque étape ajoute des tables et une cuisine du monde.
 */
export interface StageDef {
  id: string;
  name: string;
  cuisine: string;
  tables: number;
  stoves: number;
  /** Prix pour atteindre cette étape (0 pour la première). */
  cost: number;
}

export const STAGES: StageDef[] = [
  { id: 'foodtruck', name: 'Food truck', cuisine: 'mexique', tables: 2, stoves: 2, cost: 0 },
  { id: 'terrasse', name: 'Terrasse', cuisine: 'italie', tables: 3, stoves: 3, cost: 140 },
  { id: 'bistrot', name: 'Petit restaurant', cuisine: 'japon', tables: 5, stoves: 3, cost: 280 },
  { id: 'restaurant', name: 'Grand restaurant', cuisine: 'inde', tables: 6, stoves: 4, cost: 480 },
];

/**
 * RYTHME — « calme mais exigeant ».
 * Un service dure 2 min 30. Pas d'échec brutal : un client trop impatient part sans payer
 * et la réputation baisse un peu. Les étoiles récompensent la maîtrise.
 */
export const BALANCE = {
  serviceSeconds: 150,
  /** Dernier client accepté N secondes avant la fermeture. */
  lastCallSeconds: 25,
  firstCustomerDelay: 3,
  spawnIntervalStart: 15,
  spawnIntervalPerDay: -1.2,
  spawnIntervalMin: 8,
  spawnJitter: 3,
  patienceStart: 75,
  patiencePerDay: -4,
  patienceMin: 45,
  chopSeconds: 2.4,
  cookSeconds: 6,
  burnSeconds: 7,
  eatSeconds: 5,
  walkSeconds: 2.2,
  tipMax: 0.5,
  playerSpeed: 230,
  /** Objectif de recette du jour pour 1 étoile ; 2★ et 3★ = multiplicateurs. */
  goalBase: 55,
  goalPerDay: 22,
  starMultipliers: [1, 1.45, 1.9] as const,
};

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  costs: number[]; // un coût par niveau
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'couteau', name: 'Couteau de chef', description: 'Coupe 35 % plus vite.', costs: [70] },
  { id: 'antiadhesive', name: 'Poêles antiadhésives', description: 'Les plats brûlent beaucoup moins vite.', costs: [65] },
  { id: 'deco', name: 'Décoration cosy', description: 'Les clients patientent 20 % plus longtemps (par niveau).', costs: [50, 120] },
  { id: 'chaussures', name: 'Chaussures confort', description: 'Tu te déplaces 15 % plus vite.', costs: [55] },
];


/**
 * PLAN DU RESTAURANT (15 x 10 cases de 64 px).
 * Cuisine à gauche, salle à droite.
 *  c : caisse d'ingrédient (attribuée dans l'ordre des cuisines)   p : pile d'assiettes
 *  = : plan de travail   x : planche à découper   s : poêle   t : poubelle
 *  # : mur   T : table (le client s'assoit sur la case à droite)   D : porte d'entrée   . : sol
 */
export const MAP = [
  'cccccp=#.......',
  'c.....x#.T..T..',
  'c.....=#.......',
  'c..==.=#.......',
  'c..==.....T..T.',
  's..............',
  's.....=#.......',
  's.....=#.T..T..',
  's.....=#.......',
  't=x====#......D',
];

export const TILE = 64;
export const HUD_HEIGHT = 64;
export const GAME_WIDTH = 15 * TILE;
export const GAME_HEIGHT = 10 * TILE + HUD_HEIGHT;

/** Tous les ingrédients dans l'ordre des caisses. */
export const CRATE_ORDER: string[] = CUISINES.flatMap((c) => c.ingredients);
