import type { DishType, Recipe, RecipeIngredient } from "@/types/database";
import { isMildSeasoning } from "@/lib/servings-scale";

export type RecipeFilter = "전체" | "냉털" | "+1";
export type DishTypeFilter = DishType;

export type FridgeStock = {
  name: string;
  quantity: number;
};

export type MatchedIngredient = {
  name: string;
  amount: number | null;
  unit: string | null;
  owned: boolean;
};

export type RecipeMatch = {
  recipe: Recipe;
  ingredients: MatchedIngredient[];
  ownedCount: number;
  totalCount: number;
  missingCount: number;
  fulfillment: number;
  group: "냉털" | "+1" | "기타";
};

export type RecipeWithIngredients = Recipe & {
  recipe_ingredients?: RecipeIngredient[] | null;
};

/** Normalize for simple Korean/alias matching (trim, lower, strip spaces). */
export function normalizeIngredientName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

/** True if either name contains the other as a substring (after normalize). */
export function ingredientNamesMatch(a: string, b: string): boolean {
  const na = normalizeIngredientName(a);
  const nb = normalizeIngredientName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function toStock(fridgeStock: FridgeStock[] | string[]): FridgeStock[] {
  return fridgeStock.map((f) =>
    typeof f === "string"
      ? { name: f, quantity: Number.POSITIVE_INFINITY }
      : { name: f.name, quantity: Number(f.quantity) || 0 },
  );
}

/**
 * Owned if a matching fridge item exists and total quantity covers the recipe
 * amount (when amount is provided and > 0). Name-only checks pass amount as null.
 */
export function isOwnedIngredient(
  ingredientName: string,
  fridgeStock: FridgeStock[] | string[],
  requiredAmount?: number | null,
): boolean {
  const stock = toStock(fridgeStock);
  const matched = stock.filter((f) =>
    ingredientNamesMatch(ingredientName, f.name),
  );
  if (matched.length === 0) return false;

  const need = Number(requiredAmount) || 0;
  if (need <= 0) return true;

  const ownedQty = matched.reduce((sum, f) => sum + f.quantity, 0);
  return ownedQty + 1e-9 >= need;
}

function toRecipeMatch(
  recipe: Recipe,
  rawIngredients: RecipeIngredient[],
  fridgeStock: FridgeStock[] | string[],
): RecipeMatch {
  // Treat null/undefined as required (DB default false). Only explicit true is optional.
  // 양념·조미료(mild)는 필수 재료 목록/매칭에서 제외
  const required = rawIngredients.filter(
    (ing) =>
      ing.is_optional !== true && !isMildSeasoning(ing.ingredient_name),
  );

  const ingredients: MatchedIngredient[] = required.map((ing) => ({
    name: ing.ingredient_name,
    amount: ing.amount,
    unit: ing.unit,
    owned: isOwnedIngredient(
      ing.ingredient_name,
      fridgeStock,
      ing.amount,
    ),
  }));

  const ownedCount = ingredients.filter((i) => i.owned).length;
  const totalCount = ingredients.length;
  const missingCount = totalCount - ownedCount;
  const fulfillment = totalCount === 0 ? 0 : ownedCount / totalCount;

  let group: RecipeMatch["group"] = "기타";
  if (totalCount > 0 && missingCount === 0) group = "냉털";
  else if (totalCount > 0 && missingCount === 1) group = "+1";

  return {
    recipe: {
      id: recipe.id,
      title: recipe.title,
      cook_minutes: recipe.cook_minutes,
      difficulty: recipe.difficulty,
      image_url: recipe.image_url,
      steps: recipe.steps,
      base_servings: recipe.base_servings ?? 1,
      dish_type: recipe.dish_type ?? "메인요리",
      created_at: recipe.created_at,
    },
    ingredients,
    ownedCount,
    totalCount,
    missingCount,
    fulfillment,
    group,
  };
}

/** Build matches from a nested Supabase select: recipes + recipe_ingredients(...). */
export function buildRecipeMatchesFromJoined(
  recipes: RecipeWithIngredients[],
  fridgeStock: FridgeStock[] | string[],
): RecipeMatch[] {
  const matches = recipes.map((recipe) =>
    toRecipeMatch(recipe, recipe.recipe_ingredients ?? [], fridgeStock),
  );

  return matches.sort((a, b) => {
    if (b.fulfillment !== a.fulfillment) return b.fulfillment - a.fulfillment;
    return a.recipe.title.localeCompare(b.recipe.title, "ko");
  });
}

/** @deprecated Prefer buildRecipeMatchesFromJoined with nested select. */
export function buildRecipeMatches(
  recipes: Recipe[],
  ingredientsByRecipe: Map<string, RecipeIngredient[]>,
  fridgeStock: FridgeStock[] | string[],
): RecipeMatch[] {
  const matches = recipes.map((recipe) =>
    toRecipeMatch(
      recipe,
      ingredientsByRecipe.get(recipe.id) ?? [],
      fridgeStock,
    ),
  );

  return matches.sort((a, b) => {
    if (b.fulfillment !== a.fulfillment) return b.fulfillment - a.fulfillment;
    return a.recipe.title.localeCompare(b.recipe.title, "ko");
  });
}

export function filterRecipeMatches(
  matches: RecipeMatch[],
  filter: RecipeFilter,
  dishType: DishTypeFilter = "메인요리",
): RecipeMatch[] {
  const byDish = matches.filter((m) => m.recipe.dish_type === dishType);
  if (filter === "냉털") return byDish.filter((m) => m.group === "냉털");
  if (filter === "+1") return byDish.filter((m) => m.group === "+1");
  return byDish;
}
