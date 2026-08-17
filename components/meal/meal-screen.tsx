"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus, UtensilsCrossed } from "lucide-react";
import type { RecipeMatch, RecipeWithIngredients } from "@/lib/recipe-match";
import {
  filterRecipeMatches,
  type DishTypeFilter,
  type RecipeFilter,
} from "@/lib/recipe-match";
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
import {
  type PlannerCandidateUiState,
  defaultPlannerCandidateUiState,
} from "@/components/meal/planner-candidate-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { usePersistedViewState } from "@/hooks/use-persisted-view-state";

const DISH_TYPE_TABS: { id: DishTypeFilter; label: string }[] = [
  { id: "메인요리", label: "메인요리" },
  { id: "밑반찬", label: "밑반찬" },
];

const FILTER_CHIPS: { id: RecipeFilter; label: string }[] = [
  { id: "전체", label: "전체" },
  { id: "냉털", label: "냉털 (지금 바로)" },
  { id: "+1", label: "재료 +1개" },
];

type MealViewState = {
  subTab: "recipes" | "planner";
  dishType: DishTypeFilter;
  filter: RecipeFilter;
  selectedDay: WeekDay;
  plannerUi: PlannerCandidateUiState;
  scrollTopRecipes: number;
  scrollTopPlanner: number;
};

const MEAL_DEFAULTS: MealViewState = {
  subTab: "recipes",
  dishType: "메인요리",
  filter: "전체",
  selectedDay: todayWeekDay(),
  plannerUi: defaultPlannerCandidateUiState(),
  scrollTopRecipes: 0,
  scrollTopPlanner: 0,
};

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
  const { state, patchState, ready, flush } = usePersistedViewState<MealViewState>(
    "/meal",
    MEAL_DEFAULTS,
    { persistScroll: false },
  );
  const {
    subTab,
    dishType,
    filter,
    selectedDay,
    plannerUi,
    scrollTopRecipes,
    scrollTopPlanner,
  } = state;

  const recipesScrollRef = useRef<HTMLDivElement | null>(null);
  const plannerScrollRef = useRef<HTMLDivElement | null>(null);
  const [placing, setPlacing] = useState<RecipeMatch | null>(null);
  const [plans, setPlans] = useState<MealPlanEntry[]>(initialPlans);

  const filtered = useMemo(
    () => filterRecipeMatches(matches, filter, dishType),
    [matches, filter, dishType],
  );

  function selectDishType(next: DishTypeFilter) {
    patchState({ dishType: next, filter: "전체" });
  }

  useEffect(() => {
    if (!ready) return;
    const el =
      subTab === "recipes"
        ? recipesScrollRef.current
        : plannerScrollRef.current;
    const top = subTab === "recipes" ? scrollTopRecipes : scrollTopPlanner;
    if (!el || top <= 0) return;
    requestAnimationFrame(() => {
      el.scrollTop = top;
    });
  }, [ready, subTab, scrollTopRecipes, scrollTopPlanner]);

  useEffect(() => {
    if (!ready) return;
    const el =
      subTab === "recipes"
        ? recipesScrollRef.current
        : plannerScrollRef.current;
    if (!el) return;
    let timer: number | null = null;
    const onScroll = () => {
      const top = el.scrollTop;
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (subTab === "recipes") patchState({ scrollTopRecipes: top });
        else patchState({ scrollTopPlanner: top });
      }, 80);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (timer != null) window.clearTimeout(timer);
      el.removeEventListener("scroll", onScroll);
      if (subTab === "recipes") {
        patchState({ scrollTopRecipes: el.scrollTop });
      } else {
        patchState({ scrollTopPlanner: el.scrollTop });
      }
      flush();
    };
  }, [ready, subTab, patchState, flush]);

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
      <div className="shrink-0 px-4 pt-4 pb-3 sm:px-6 lg:px-8">
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
              onClick={() => {
                flush();
                patchState({ subTab: t.id });
              }}
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
          <div className="shrink-0 space-y-2.5 px-4 pb-4 sm:px-6 lg:px-8">
            <div
              className="flex gap-1 rounded-[14px] border border-border/70 bg-muted/70 p-1"
              role="tablist"
              aria-label="요리 종류"
            >
              {DISH_TYPE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={dishType === tab.id}
                  onClick={() => selectDishType(tab.id)}
                  className={`flex-1 rounded-[10px] py-2 text-[13px] font-semibold leading-[18px] transition-all ${
                    dishType === tab.id
                      ? "bg-card text-foreground shadow-[0_1px_6px_rgba(0,0,0,0.08)]"
                      : "text-muted-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto scrollbar-hide">
                {FILTER_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => patchState({ filter: chip.id })}
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
              <Link
                href="/meal/write"
                onClick={() => flush()}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-secondary px-3 py-1.5 text-[12px] font-bold text-primary shadow-[0_1px_4px_rgba(61,112,88,0.12)] transition-transform active:scale-95"
              >
                <Plus size={14} strokeWidth={2.5} aria-hidden />
                내 레시피
              </Link>
            </div>
          </div>

          <div
            ref={recipesScrollRef}
            className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 scrollbar-hide sm:px-6 lg:px-8"
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((m) => (
                <RecipeCard
                  key={m.recipe.id}
                  match={m}
                  onAdd={() => setPlacing(m)}
                  onNavigate={() => flush()}
                />
              ))}
            </div>
            {filtered.length === 0 && (
              <EmptyState
                variant="section"
                title={
                  matches.length === 0
                    ? "등록된 레시피가 없어요"
                    : "해당 조건의 레시피가 없어요"
                }
                icon={
                  <UtensilsCrossed
                    size={28}
                    className="text-muted-foreground"
                    aria-hidden
                  />
                }
              />
            )}
          </div>
        </div>
      ) : (
        <WeekPlanner
          matches={matches}
          recipes={recipes}
          fridgeItems={fridgeItems}
          initialPlans={plans}
          userId={userId}
          onPlansChange={setPlans}
          selectedDay={selectedDay}
          onSelectedDayChange={(day) => patchState({ selectedDay: day })}
          scrollRef={plannerScrollRef}
          candidateUi={plannerUi}
          onCandidateUiChange={(next) => patchState({ plannerUi: next })}
          onNavigateAway={() => flush()}
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
              throw new Error(error);
            }
            if (data) {
              setPlans((prev) => [...prev, data]);
            }
          }}
          onClose={() => setPlacing(null)}
        />
      )}
    </div>
  );
}
