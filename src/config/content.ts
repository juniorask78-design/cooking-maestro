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

/** Nombre de niveaux à réussir dans chaque restaurant avant de pouvoir l'agrandir. */
export const LEVELS_PER_STAGE = 5;

/**
 * BOISSONS — chaque restaurant a sa machine. On touche la machine pour remplir un verre,
 * puis on touche le verre plein pour le servir au client qui l'a demandé.
 */
export interface DrinkDef { id: string; name: string; cuisine: string; price: number }

export const DRINKS: DrinkDef[] = [
  { id: 'limonade', name: 'Limonade', cuisine: 'mexique', price: 5 },
  { id: 'the', name: 'Thé vert', cuisine: 'japon', price: 6 },
];

/** Objectif d'un niveau : il faut le remplir pour passer au niveau suivant. */
export type GoalType = 'pieces' | 'clients' | 'parfait';
export interface LevelGoal { type: GoalType; target: number }

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
  /** Chance qu'un client commande aussi une boisson (quand une machine existe). */
  drinkChance: 0.45,
  pourSeconds: 2.5,
  /** Un plat servi redonne une part de patience si la commande n'est pas finie. */
  partialPatienceBonus: 0.25,
  /** Deux services à moins de N secondes d'écart font monter le combo (+10 % de pourboire par cran). */
  comboWindow: 8,
  comboMax: 5,
  /** À partir de ce niveau, certains clients sont pressés (moins patients, plus généreux). */
  hurriedFromLevel: 3,
  hurriedChance: 0.18,
  rechaud: 1,
  spawnIntervalStart: 10,
  spawnIntervalPerLevel: -0.25,
  spawnIntervalMin: 5.5,
  spawnJitter: 2,
  patienceStart: 50,
  patiencePerLevel: -1,
  patienceMin: 30,
  chopSeconds: 2.5,
  cookSeconds: 5,
  burnSeconds: 6,
  eatSeconds: 3,
  walkSeconds: 1.6,
  tipMax: 0.5,
  plates: 3,
  boards: 1,
  /** Pièces visées pour 1 étoile au niveau 1 ; 2★ et 3★ = multiplicateurs. */
  goalBase: 90,
  goalPerLevel: 12,
  starMultipliers: [1, 1.3, 1.6] as const,
};

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  costs: number[]; // un coût par niveau
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'feux', name: 'Feux plus puissants', description: 'Les plats cuisent 15 % plus vite (par niveau).', costs: [60, 130, 220] },
  { id: 'planche', name: 'Deuxième planche', description: 'Coupe deux ingrédients en même temps.', costs: [80] },
  { id: 'couteau', name: 'Couteau de chef', description: 'Coupe 40 % plus vite.', costs: [70] },
  { id: 'rechaud', name: 'Grand réchaud', description: 'Une place de plus pour garder un plat au chaud.', costs: [70] },
  { id: 'assiette', name: 'Plan de dressage', description: 'Une assiette de plus pour préparer plusieurs plats.', costs: [90] },
  { id: 'bar', name: 'Machine rapide', description: 'Les boissons se remplissent 40 % plus vite.', costs: [80] },
  { id: 'deco', name: 'Décoration cosy', description: 'Clients 15 % plus patients et pourboires +10 % (par niveau).', costs: [60, 140, 260] },
];

/** Tous les ingrédients dans l'ordre des bacs. */
export const BIN_ORDER: string[] = CUISINES.flatMap((c) => c.ingredients);

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 640;
