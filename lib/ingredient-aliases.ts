/**
 * Maps recipe_ingredients.ingredient_name → alternate phrasings used in steps.
 * Used when substituting {{ing:…}} placeholders so step text need not match
 * the ingredient list name exactly.
 */
export const INGREDIENT_ALIASES: Record<string, readonly string[]> = {
  체다치즈: ["슬라이스 치즈"],
  닭고기: ["닭다리살", "닭다리순살"],
  골뱅이통조림: ["통조림 골뱅이"],
  카레가루: ["카레 가루"],
};

/** Canonical name plus aliases, longest first. */
export function labelsForIngredient(canonical: string): string[] {
  const aliases = INGREDIENT_ALIASES[canonical] ?? [];
  return [canonical, ...aliases].sort((a, b) => b.length - a.length);
}
