/**
 * THÈME — tout ce qui est « habillage » est ici, pour pouvoir changer d'univers sans toucher au gameplay.
 * Thème retenu : « Saveurs du Monde ». Les emoji sont des visuels provisoires, à remplacer par des sprites.
 */
export interface Theme {
  restaurantName: string;
  tagline: string;
  /** Emoji (provisoires) des ingrédients, par id et par état. */
  ingredientIcons: Record<string, string>;
  recipeIcons: Record<string, string>;
  plateIcon: string;
  palette: {
    background: number;
    hud: number;
    hudText: string;
    accent: number;
    accentText: string;
    good: number;
    warn: number;
    bad: number;
    counter: number;
    counterTop: number;
    wall: number;
    tableTop: number;
  };
  /** Choix de personnalisation proposés (couleurs en hexadécimal). */
  floorColors: { id: string; name: string; a: number; b: number }[];
  wallColors: { id: string; name: string; color: number }[];
  avatarColors: { id: string; name: string; color: number }[];
  hats: { id: string; name: string }[];
  customerColors: number[];
}

export const THEME: Theme = {
  restaurantName: 'Cooking Maestro',
  tagline: 'Saveurs du Monde : du food truck au grand restaurant',
  ingredientIcons: {
    tortilla: '🫓',
    boeuf: '🥩',
    tomate: '🍅',
    avocat: '🥑',
    pates: '🍝',
    fromage: '🧀',
    riz: '🍚',
    poisson: '🐟',
    poulet: '🍗',
  },
  recipeIcons: {
    taco: '🌮',
    guacamole: '🥣',
    pates: '🍝',
    caprese: '🥗',
    sushi: '🍣',
    donburi: '🍱',
    curry: '🍛',
  },
  plateIcon: '🍽️',
  palette: {
    background: 0x2b2340,
    hud: 0x3d3158,
    hudText: '#fff6e6',
    accent: 0xffb347,
    accentText: '#2b2340',
    good: 0x6ccf7f,
    warn: 0xffd166,
    bad: 0xef6f6c,
    counter: 0xb9835a,
    counterTop: 0xe8c39e,
    wall: 0x6d5a8c,
    tableTop: 0xd9a066,
  },
  floorColors: [
    { id: 'creme', name: 'Crème', a: 0xf3e9d2, b: 0xe8dcc0 },
    { id: 'menthe', name: 'Menthe', a: 0xd8f0e3, b: 0xc5e6d4 },
    { id: 'rose', name: 'Rose', a: 0xf7dde2, b: 0xefcdd4 },
    { id: 'ciel', name: 'Ciel', a: 0xdbe9f7, b: 0xc9dcf0 },
  ],
  wallColors: [
    { id: 'lavande', name: 'Lavande', color: 0x6d5a8c },
    { id: 'brique', name: 'Brique', color: 0xa0524a },
    { id: 'sapin', name: 'Sapin', color: 0x3f7a5c },
    { id: 'ocean', name: 'Océan', color: 0x3e6a99 },
  ],
  avatarColors: [
    { id: 'blanc', name: 'Blanc', color: 0xffffff },
    { id: 'corail', name: 'Corail', color: 0xff7f6b },
    { id: 'citron', name: 'Citron', color: 0xffd93d },
    { id: 'menthe', name: 'Menthe', color: 0x7ee0b0 },
    { id: 'lagon', name: 'Lagon', color: 0x6ec6ff },
    { id: 'prune', name: 'Prune', color: 0xb388eb },
  ],
  hats: [
    { id: 'toque', name: 'Toque' },
    { id: 'casquette', name: 'Casquette' },
    { id: 'bandana', name: 'Bandana' },
    { id: 'aucun', name: 'Aucun' },
  ],
  customerColors: [0xff9aa2, 0xffdac1, 0xb5ead7, 0xc7ceea, 0xe2f0cb, 0xf6c6ea],
};
