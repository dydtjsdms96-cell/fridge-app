"use client";

import { useMemo, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import type { RecipeMatch, RecipeWithIngredients } from "@/lib/recipe-match";
import { filterRecipeMatches, type RecipeFilter } from "@/lib/recipe-match";
import { placeMealRecipe } from "@/lib/meal-actions";
import type { MealPlanEntry } from "@/lib/meal-plan-types";
import {
  getWeekDayDates,
  MEAL_SLOTS,
  todayWeekDay,
  WEEK_DAYS,
  type MealSlot,
  type WeekDay,
} from "@/lib/week";
import type { FridgeItem } from "@/types/database";
import { RecipeCard } from "@/components/meal/recipe-card";
import { WeekPlanner } from "@/components/meal/week-planner";
import {
  MealPlacementSheet,
  type SlotOccupant,
} from "@/components/meal/meal-placement-sheet";

const FILTER_CHIPS: { id: RecipeFilter; label: string }[] = [
  { id: "전체", label: "전체" },
  { id: "냉털", label: "냉털 (지금 바로)" },
  { id: "+1", label: "재료 +1개" },
];

type MealScreenProps = {
  matches: RecipeMatch[];
  recipes: RecipeWithIngredients[];
  fridgeItems: FridgeItem[];
  initialPlans: MealPlanEntry[];
  userId: string;
};

export function MealScreen({
  matches,
  recipes,
  fridgeItems,
  initialPlans,
  userId,
}: MealScreenProps) {
  const [subTab, setSubTab] = useState<"recipes" | "planner">("recipes");
  const [filter, setFilter] = useState<RecipeFilter>("전체");
  const [placing, setPlacing] = useState<RecipeMatch | null>(null);
  const [plans, setPlans] = useState<MealPlanEntry[]>(initialPlans);

  const filtered = useMemo(
    () => filterRecipeMatches(matches, filter),
    [matches, filter],
  );

  const defaultDay: WeekDay = todayWeekDay();

  const occupancy = useMemo(() => {
    const week = getWeekDayDates();
    const dateByDay = Object.fromEntries(
      week.map((w) => [w.day, w.date]),
    ) as Record<WeekDay, string>;
    const out: Partial<
      Record<WeekDay, Partial<Record<MealSlot, SlotOccupant[]>>>
    > = {};
    for (const day of WEEK_DAYS) {
      out[day] = {};
      for (const meal of MEAL_SLOTS) {
        out[day]![meal] = plans
          .filter(
            (p) =>
              p.plan_date === dateByDay[day] &&
              p.meal_type === meal &&
              (p.recipes || p.recipe_id),
          )
          .map((p) => ({
            recipeId: p.recipes?.id ?? p.recipe_id!,
            title: p.recipes?.title ?? p.label ?? "요리",
          }));
      }
    }
    return out;
  }, [plans]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-4 pb-3">
        <h1 className="mb-3 text-[22px] leading-[27.5px] font-bold text-foreground">
          식단 & 레시피
        </h1>
        <div className="flex gap-1 rounded-[20px] bg-muted p-1">
          {(
            [
              { id: "recipes" as const, label: "오늘의 레시피" },
              { id: "planner" as const, label: "일주일 식단 플래너" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`flex-1 rounded-[10px] py-2 text-[12px] font-semibold leading-[18px] transition-all ${
                subTab === t.id
                  ? "bg-card text-foreground shadow-[0_1px_6px_rgba(0,0,0,0.08)]"
                  : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === "recipes" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 gap-2 overflow-x-auto px-5 pb-4 scrollbar-hide">
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilter(chip.id)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all ${
                  filter === chip.id
                    ? "border-transparent bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(61,112,88,0.3)]"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-8 scrollbar-hide">
            {filtered.map((m) => (
              <RecipeCard
                key={m.recipe.id}
                match={m}
                onAdd={() => setPlacing(m)}
              />
            ))}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12">
                <UtensilsCrossed
                  size={28}
                  className="text-muted-foreground opacity-40"
                  aria-hidden
                />
                <p className="text-sm text-muted-foreground">
                  {matches.length === 0
                    ? "등록된 레시피가 없어요"
                    : "해당 조건의 레시피가 없어요"}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <WeekPlanner
          key={plans.map((p) => p.id).join("|")}
          matches={matches}
          recipes={recipes}
          fridgeItems={fridgeItems}
          initialPlans={plans}
          userId={userId}
          onPlansChange={setPlans}
        />
      )}

      {placing && (
        <MealPlacementSheet
          match={placing}
          defaultDay={defaultDay}
          occupancy={occupancy}
          onConfirm={async (day, meal) => {
            const { data, error } = await placeMealRecipe({
              userId,
              recipeId: placing.recipe.id,
              recipeTitle: placing.recipe.title,
              day,
              meal,
            });
            if (error) {
              console.error("[meal_plan] place error:", error);
              window.alert(error);
              return;
            }
            if (data) {
              setPlans((prev) => [...prev, data]);
            }
            setPlacing(null);
          }}
          onClose={() => setPlacing(null)}
        />
      )}
    </div>
  );
}
