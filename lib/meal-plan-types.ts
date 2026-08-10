import type { MealPlan, Recipe } from "@/types/database";

export type MealPlanEntry = MealPlan & {
  recipes: Pick<
    Recipe,
    "id" | "title" | "cook_minutes" | "difficulty" | "image_url"
  > | null;
};
