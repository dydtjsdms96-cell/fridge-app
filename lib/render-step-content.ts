import {
  formatIngredientAmountForMode,
  type AmountUnitMode,
} from "@/lib/format-amount";
import type { ScaledIngredient } from "@/lib/servings-scale";

const ING_PLACEHOLDER_RE = /\{\{ing:([^}]+)\}\}/g;

/**
 * Replace `{{ing:재료명}}` in a step string with the scaled+formatted amount
 * for the current servings / unit mode. Unknown names are left as-is.
 */
export function renderStepContent(
  content: string,
  scaledIngredients: ScaledIngredient[],
  unitMode: AmountUnitMode,
): string {
  if (!content.includes("{{ing:")) return content;

  const labels = new Map<string, string>();
  for (const ing of scaledIngredients) {
    const label = formatIngredientAmountForMode(
      ing.scaledAmount,
      ing.unit,
      ing.ingredient_name,
      unitMode,
    );
    if (label) labels.set(ing.ingredient_name, label);
  }

  return content.replace(ING_PLACEHOLDER_RE, (full, rawName: string) => {
    const name = rawName.trim();
    return labels.get(name) ?? full;
  });
}
