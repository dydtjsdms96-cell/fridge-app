import { notFound } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { RecipeDetailScreen } from "@/components/meal/recipe-detail-screen";
import type { FridgeItem, Recipe, RecipeIngredient } from "@/types/database";

type PageProps = {
  params: Promise<{ recipeId: string }>;
};

export default async function RecipeDetailPage({ params }: PageProps) {
  const { recipeId } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const [recipeRes, fridgeRes] = await Promise.all([
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
      .eq("id", recipeId)
      .maybeSingle(),
    supabase.from("fridge_items").select("*").eq("status", "보유"),
  ]);

  if (recipeRes.error) {
    console.error("[meal/detail] recipe error:", recipeRes.error.message);
  }
  if (!recipeRes.data) notFound();

  const row = recipeRes.data as Recipe & {
    recipe_ingredients: RecipeIngredient[] | null;
  };
  const { recipe_ingredients, ...rest } = row;
  const recipe: Recipe = {
    ...rest,
    base_servings: rest.base_servings ?? 1,
  };
  const ingredients = recipe_ingredients ?? [];
  const fridgeItems = (fridgeRes.data ?? []) as FridgeItem[];

  return (
    <AppShell activeTab="meal">
      <RecipeDetailScreen
        recipe={recipe}
        ingredients={ingredients}
        fridgeItems={fridgeItems}
      />
    </AppShell>
  );
}
