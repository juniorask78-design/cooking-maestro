import { RECIPES, CUISINES, STAGES, type IngredientState, type Part, type RecipeDef } from '../config/content';

export const partOf = (id: string, state: IngredientState): Part => `${id}:${state}` as Part;

const sortParts = (parts: readonly string[]) => [...parts].sort();

/** Cuisines débloquées pour une étape d'agrandissement (0 = food truck). */
export function cuisinesForStage(stage: number): string[] {
  return STAGES.slice(0, stage + 1).map((s) => s.cuisine);
}

export function recipesForStage(stage: number): RecipeDef[] {
  const cuisines = cuisinesForStage(stage);
  return RECIPES.filter((r) => cuisines.includes(r.cuisine));
}

export function ingredientsForStage(stage: number): string[] {
  const cuisines = cuisinesForStage(stage);
  const fromCuisines = CUISINES.filter((c) => cuisines.includes(c.id)).flatMap((c) => c.ingredients);
  // Un ingrédient d'une autre cuisine peut être requis par une recette débloquée (ex. bœuf pour le donburi).
  const fromRecipes = recipesForStage(stage).flatMap((r) => r.parts.map((p) => p.split(':')[0]));
  return [...new Set([...fromCuisines, ...fromRecipes])];
}

/** Vrai si les composantes de l'assiette forment exactement la recette. */
export function matchesRecipe(parts: readonly string[], recipe: RecipeDef): boolean {
  const a = sortParts(parts);
  const b = sortParts(recipe.parts);
  return a.length === b.length && a.every((p, i) => p === b[i]);
}

/** Recette complète que forme l'assiette, s'il y en a une. */
export function dishOf(parts: readonly string[], recipes: RecipeDef[]): RecipeDef | undefined {
  return recipes.find((r) => matchesRecipe(parts, r));
}

/** Peut-on ajouter `part` à l'assiette sans sortir de toute recette disponible ? */
export function canAddToPlate(parts: readonly string[], part: Part, recipes: RecipeDef[]): boolean {
  const next = [...parts, part];
  return recipes.some((r) => {
    const pool = [...r.parts] as string[];
    return next.every((p) => {
      const i = pool.indexOf(p);
      if (i < 0) return false;
      pool.splice(i, 1);
      return true;
    });
  });
}

