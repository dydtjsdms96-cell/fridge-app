import { createClient } from "@/lib/supabase/server";
import {
  buildRecipeMatchesFromJoined,
  type RecipeWithIngredients,
} from "@/lib/recipe-match";
import { getWeekDayDates } from "@/lib/week";
import type { MealPlanEntry } from "@/lib/meal-plan-types";
import { AppShell } from "@/components/layout/app-shell";
import { MealScreen } from "@/components/meal/meal-screen";
import type { FridgeItem } from "@/types/database";
import { redirect } from "next/navigation";

export default async function MealPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const week = getWeekDayDates();
  const from = week[0].date;
  const to = week[6].date;

  const [fridgeRes, recipesRes, plansRes] = await Promise.all([
    supabase.from("fridge_items").select("*").eq("status", "보유"),
    supabase
      .from("recipes")
      .select(
        `
        id,
        title,
        cook_minutes,
        difficulty,
        image_url,
        steps,
        base_servings,
        created_at,
        recipe_ingredients (
          id,
          recipe_id,
          ingredient_name,
          amount,
          unit,
          is_optional
        )
      `,
      )
      .order("title", { ascending: true }),
    supabase
      .from("meal_plan")
      .select(
        `
        *,
        recipes ( id, title, cook_minutes, difficulty, image_url )
      `,
      )
      .gte("plan_date", from)
      .lte("plan_date", to)
      .order("plan_date", { ascending: true }),
  ]);

  if (fridgeRes.error) {
    console.error("[meal] fridge_items error:", fridgeRes.error.message);
  }
  if (recipesRes.error) {
    console.error("[meal] recipes error:", recipesRes.error.message);
  }
  if (plansRes.error) {
    console.error("[meal] meal_plan error:", plansRes.error.message);
  }

  const fridgeItems = (fridgeRes.data ?? []) as FridgeItem[];
  const fridgeStock = fridgeItems.map((i) => ({
    name: i.name,
    quantity: Number(i.quantity) || 0,
  }));
  const recipes = (recipesRes.data ?? []) as RecipeWithIngredients[];
  const matches = buildRecipeMatchesFromJoined(recipes, fridgeStock);
  const initialPlans = (plansRes.data ?? []) as MealPlanEntry[];

  return (
    <AppShell activeTab="meal">
      <MealScreen
        matches={matches}
        recipes={recipes}
        fridgeItems={fridgeItems}
        initialPlans={initialPlans}
        userId={user.id}
      />
    </AppShell>
  );
}
