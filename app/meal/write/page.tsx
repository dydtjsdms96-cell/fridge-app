import { createClient, requireUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { RecipeWriteScreen } from "@/components/meal/recipe-write-screen";
import type { Recipe, RecipeIngredient } from "@/types/database";

type PageProps = {
  searchParams: Promise<{ edit?: string }>;
};

export default async function MealWritePage({ searchParams }: PageProps) {
  const user = await requireUser();
  const { edit } = await searchParams;
  const supabase = await createClient();

  let initialRecipe: Recipe | null = null;
  let initialIngredients: RecipeIngredient[] = [];

  if (edit) {
    const { data, error } = await supabase
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
        dish_type,
        source,
        user_id,
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
      .eq("id", edit)
      .eq("user_id", user.id)
      .eq("source", "user")
      .maybeSingle();

    if (error) {
      console.error("[meal/write] load error:", error.message);
    }
    if (data) {
      const { recipe_ingredients, ...rest } = data as Recipe & {
        recipe_ingredients: RecipeIngredient[] | null;
      };
      initialRecipe = {
        ...rest,
        base_servings: rest.base_servings ?? 1,
        dish_type: rest.dish_type ?? "메인요리",
        source: "user",
        user_id: user.id,
      };
      initialIngredients = recipe_ingredients ?? [];
    }
  }

  return (
    <AppShell activeTab="meal" hideTabBar>
      <RecipeWriteScreen
        userId={user.id}
        mode={initialRecipe ? "edit" : "create"}
        initialRecipe={initialRecipe}
        initialIngredients={initialIngredients}
      />
    </AppShell>
  );
}
