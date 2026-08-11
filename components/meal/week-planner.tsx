"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import type { RecipeMatch, RecipeWithIngredients } from "@/lib/recipe-match";
import { ingredientNamesMatch } from "@/lib/recipe-match";
import { isMildSeasoning } from "@/lib/servings-scale";
import { placeMealRecipe } from "@/lib/meal-actions";
import { FoodIcon } from "@/components/ui/food-icon";
import { createClient } from "@/lib/supabase";
import {
  getWeekDayDates,
  MEAL_SLOTS,
  todayWeekDay,
  WEEK_DAYS,
  type MealSlot,
  type WeekDay,
} from "@/lib/week";
import type { FridgeItem } from "@/types/database";
import type { MealPlanEntry } from "@/lib/meal-plan-types";
import { CandidateCard } from "@/components/meal/candidate-card";
import {
  MealPlacementSheet,
  type SlotOccupant,
} from "@/components/meal/meal-placement-sheet";

export type { MealPlanEntry };

type WeekPlannerProps = {
  matches: RecipeMatch[];
  recipes: RecipeWithIngredients[];
  fridgeItems: FridgeItem[];
  initialPlans: MealPlanEntry[];
  userId: string;
  onPlansChange?: (plans: MealPlanEntry[]) => void;
};

/** plan_date|meal_type → entries in that slot */
type PlanMap = Record<string, MealPlanEntry[]>;

function buildPlanMap(plans: MealPlanEntry[]): PlanMap {
  const map: PlanMap = {};
  for (const p of plans) {
    const key = `${p.plan_date}|${p.meal_type}`;
    if (!map[key]) map[key] = [];
    map[key].push(p);
  }
  return map;
}

function flattenPlans(map: PlanMap): MealPlanEntry[] {
  return Object.values(map).flat();
}

export function WeekPlanner({
  matches,
  recipes,
  fridgeItems,
  initialPlans,
  userId,
  onPlansChange,
}: WeekPlannerProps) {
  const week = useMemo(() => getWeekDayDates(), []);
  const dateByDay = useMemo(() => {
    const m = {} as Record<WeekDay, string>;
    for (const w of week) m[w.day] = w.date;
    return m;
  }, [week]);

  const [selectedDay, setSelectedDay] = useState<WeekDay>(() => todayWeekDay());
  const [planMap, setPlanMap] = useState<PlanMap>(() =>
    buildPlanMap(initialPlans),
  );
  const [placing, setPlacing] = useState<RecipeMatch | null>(null);
  const [shoppingBusy, setShoppingBusy] = useState(false);
  const [shoppingMsg, setShoppingMsg] = useState<string | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);

  const selectedDate = dateByDay[selectedDay];

  const occupancy = useMemo(() => {
    const out: Partial<
      Record<WeekDay, Partial<Record<MealSlot, SlotOccupant[]>>>
    > = {};
    for (const day of WEEK_DAYS) {
      out[day] = {};
      for (const meal of MEAL_SLOTS) {
        const entries = planMap[`${dateByDay[day]}|${meal}`] ?? [];
        out[day]![meal] = entries
          .filter((e) => e.recipes || e.recipe_id)
          .map((e) => ({
            recipeId: e.recipes?.id ?? e.recipe_id!,
            title: e.recipes?.title ?? e.label ?? "요리",
          }));
      }
    }
    return out;
  }, [planMap, dateByDay]);

  const ready = matches.filter((m) => m.group === "냉털");
  const plusOne = matches.filter((m) => m.group === "+1");

  async function placeRecipe(day: WeekDay, meal: MealSlot) {
    if (!placing) return;
    setPlaceError(null);
    const planDate = dateByDay[day];
    const { data, error } = await placeMealRecipe({
      userId,
      recipeId: placing.recipe.id,
      recipeTitle: placing.recipe.title,
      day,
      meal,
    });
    if (error) {
      console.error("[meal_plan] place error:", error);
      setPlaceError(error);
      return;
    }
    if (!data) return;

    setPlanMap((prev) => {
      const key = `${planDate}|${meal}`;
      const next = {
        ...prev,
        [key]: [...(prev[key] ?? []), data],
      };
      onPlansChange?.(flattenPlans(next));
      return next;
    });
    setPlacing(null);
  }

  async function removeEntry(entry: MealPlanEntry) {
    const key = `${entry.plan_date}|${entry.meal_type}`;
    const supabase = createClient();
    const { error } = await supabase
      .from("meal_plan")
      .delete()
      .eq("id", entry.id);
    if (error) {
      console.error("[meal_plan] clear error:", error.message);
      return;
    }
    setPlanMap((prev) => {
      const next = { ...prev };
      next[key] = (prev[key] ?? []).filter((e) => e.id !== entry.id);
      if (next[key].length === 0) delete next[key];
      onPlansChange?.(flattenPlans(next));
      return next;
    });
  }

  async function generateShoppingList() {
    if (shoppingBusy) return;
    setShoppingBusy(true);
    setShoppingMsg(null);
    const supabase = createClient();

    try {
      // Count every placement (same recipe in two slots → ingredients ×2)
      const placedRecipeIds: string[] = [];
      for (const w of week) {
        for (const meal of MEAL_SLOTS) {
          for (const entry of planMap[`${w.date}|${meal}`] ?? []) {
            if (entry.recipe_id) placedRecipeIds.push(entry.recipe_id);
          }
        }
      }

      if (placedRecipeIds.length === 0) {
        setShoppingMsg("이번 주에 배치된 요리가 없어요");
        return;
      }

      type Need = { name: string; amount: number; unit: string | null };
      const needs = new Map<string, Need>();

      for (const recipeId of placedRecipeIds) {
        const recipe = recipes.find((r) => r.id === recipeId);
        if (!recipe) continue;
        for (const ing of recipe.recipe_ingredients ?? []) {
          if (ing.is_optional === true) continue;
          if (isMildSeasoning(ing.ingredient_name)) continue;
          const key = ing.ingredient_name.trim();
          const prev = needs.get(key);
          const amt = Number(ing.amount) || 0;
          if (prev) prev.amount += amt;
          else {
            needs.set(key, {
              name: ing.ingredient_name,
              amount: amt,
              unit: ing.unit,
            });
          }
        }
      }

      const fridgeOwned = fridgeItems.filter((f) => f.status === "보유");
      const { data: existingList } = await supabase
        .from("shopping_list")
        .select("item_name")
        .eq("checked", false);

      const existingNames = new Set(
        (existingList ?? []).map((r) => String(r.item_name).trim()),
      );

      const toInsert: {
        user_id: string;
        item_name: string;
        quantity: number;
        unit: string | null;
        source: "자동_식단";
        checked: boolean;
      }[] = [];

      for (const need of needs.values()) {
        const matched = fridgeOwned.filter((f) =>
          ingredientNamesMatch(f.name, need.name),
        );
        const ownedQty = matched.reduce((s, f) => s + Number(f.quantity), 0);
        const absent = matched.length === 0;
        const short = need.amount > 0 && ownedQty < need.amount;
        if (!absent && !short) continue;

        const already = [...existingNames].some(
          (n) =>
            n === need.name.trim() || ingredientNamesMatch(n, need.name),
        );
        if (already) continue;

        const missingQty =
          need.amount > 0
            ? Math.max(0, need.amount - ownedQty)
            : absent
              ? 1
              : 0;
        const qty =
          absent && need.amount <= 0 ? 1 : missingQty || need.amount || 1;

        toInsert.push({
          user_id: userId,
          item_name: need.name,
          quantity: qty,
          unit: need.unit,
          source: "자동_식단",
          checked: false,
        });
        existingNames.add(need.name.trim());
      }

      if (toInsert.length === 0) {
        setShoppingMsg("추가할 부족 재료가 없어요");
        return;
      }

      const { error } = await supabase.from("shopping_list").insert(toInsert);
      if (error) {
        console.error("[shopping_list] insert error:", error.message);
        setShoppingMsg("쇼핑 리스트 생성에 실패했어요");
        return;
      }
      setShoppingMsg(`${toInsert.length}개 재료를 쇼핑 리스트에 담았어요`);
    } finally {
      setShoppingBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 scrollbar-hide">
        <div className="mb-3 flex gap-1.5">
          {WEEK_DAYS.map((day) => {
            const on = selectedDay === day;
            const hasMeal = MEAL_SLOTS.some(
              (m) => (planMap[`${dateByDay[day]}|${m}`]?.length ?? 0) > 0,
            );
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[12px] font-semibold transition-all ${
                  on
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-foreground"
                }`}
              >
                {day}
                <span
                  className={`size-1 rounded-full ${
                    hasMeal
                      ? on
                        ? "bg-white/60"
                        : "bg-primary"
                      : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="mb-5 space-y-2">
          {MEAL_SLOTS.map((meal) => {
            const placed = planMap[`${selectedDate}|${meal}`] ?? [];
            return (
              <div key={meal} className="flex items-start gap-2.5">
                <span className="mt-3 w-7 shrink-0 text-[11px] font-semibold text-muted-foreground">
                  {meal}
                </span>
                {placed.length > 0 ? (
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {placed.map((entry) => {
                      const title =
                        entry.recipes?.title ?? entry.label ?? "요리";
                      return (
                        <div
                          key={entry.id}
                          className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-[0_1px_6px_rgba(0,0,0,0.05)]"
                        >
                          <Link
                            href={
                              entry.recipe_id
                                ? `/meal/${entry.recipe_id}`
                                : "/meal"
                            }
                            className="flex min-w-0 flex-1 items-center gap-2"
                          >
                            <FoodIcon name={title} size={20} />
                            <span className="truncate text-[13px] font-semibold text-foreground">
                              {title}
                            </span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => removeEntry(entry)}
                            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
                            aria-label={`${title} 배치 제거`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-muted/50 py-3 text-muted-foreground">
                    <Plus size={16} aria-hidden />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full bg-status-fresh-dot" />
              <span className="text-[12px] font-bold text-foreground">
                바로 가능
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {ready.length}개
              </span>
            </div>
            <div className="space-y-2">
              {ready.map((m) => (
                <CandidateCard
                  key={m.recipe.id}
                  match={m}
                  onAdd={() => {
                    setPlaceError(null);
                    setPlacing(m);
                  }}
                />
              ))}
              {ready.length === 0 && (
                <p className="py-2 text-[12px] text-muted-foreground">
                  지금 바로 만들 수 있는 요리가 없어요
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full bg-status-warn-dot" />
              <span className="text-[12px] font-bold text-foreground">
                +1 재료만 사면 가능
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {plusOne.length}개
              </span>
            </div>
            <div className="space-y-2">
              {plusOne.map((m) => (
                <CandidateCard
                  key={m.recipe.id}
                  match={m}
                  onAdd={() => {
                    setPlaceError(null);
                    setPlacing(m);
                  }}
                />
              ))}
              {plusOne.length === 0 && (
                <p className="py-2 text-[12px] text-muted-foreground">
                  +1 후보 요리가 없어요
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-background px-5 py-3">
        {shoppingMsg && (
          <p className="mb-2 text-center text-[11px] font-medium text-muted-foreground">
            {shoppingMsg}
          </p>
        )}
        <button
          type="button"
          disabled={shoppingBusy}
          onClick={generateShoppingList}
          className="w-full rounded-2xl bg-primary py-3.5 text-[13px] font-bold text-primary-foreground shadow-[0_4px_16px_rgba(61,112,88,0.3)] transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          이 식단으로 쇼핑 리스트 생성
        </button>
      </div>

      {placing && (
        <MealPlacementSheet
          match={placing}
          defaultDay={selectedDay}
          occupancy={occupancy}
          onConfirm={placeRecipe}
          onClose={() => {
            setPlacing(null);
            setPlaceError(null);
          }}
        />
      )}
      {placeError && !placing && (
        <div className="absolute inset-x-5 bottom-24 z-40 rounded-xl border border-status-warn-border bg-status-warn-bg px-3.5 py-2.5 text-center text-[11px] font-medium text-status-warn shadow-lg">
          {placeError}
        </div>
      )}
    </div>
  );
}
