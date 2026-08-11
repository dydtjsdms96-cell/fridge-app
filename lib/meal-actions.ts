import { createClient } from "@/lib/supabase";
import type { MealPlanEntry } from "@/lib/meal-plan-types";
import type { MealSlot, WeekDay } from "@/lib/week";
import { getWeekDayDates } from "@/lib/week";

export async function placeMealRecipe(params: {
  userId: string;
  recipeId: string;
  recipeTitle: string;
  day: WeekDay;
  meal: MealSlot;
  weekBase?: Date;
}): Promise<{ data: MealPlanEntry | null; error: string | null }> {
  const { userId, recipeId, recipeTitle, day, meal, weekBase } = params;
  const week = getWeekDayDates(weekBase);
  const planDate = week.find((w) => w.day === day)?.date;
  if (!planDate) return { data: null, error: "invalid day" };

  const supabase = createClient();

  const { data: existingSame } = await supabase
    .from("meal_plan")
    .select("id")
    .eq("user_id", userId)
    .eq("plan_date", planDate)
    .eq("meal_type", meal)
    .eq("recipe_id", recipeId)
    .maybeSingle();

  if (existingSame) {
    return { data: null, error: "이미 추가되어 있어요" };
  }

  const { data, error } = await supabase
    .from("meal_plan")
    .insert({
      user_id: userId,
      recipe_id: recipeId,
      plan_date: planDate,
      meal_type: meal,
      status: "배치됨",
      label: recipeTitle,
    })
    .select(
      `
      *,
      recipes ( id, title, cook_minutes, difficulty, image_url )
    `,
    )
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as MealPlanEntry, error: null };
}
