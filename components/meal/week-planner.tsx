"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { EmptyState } from "@/components/ui/empty-state";

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

type DragState = {
  match: RecipeMatch;
  x: number;
  y: number;
};

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
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [hoverMeal, setHoverMeal] = useState<MealSlot | null>(null);
  const [dropBusy, setDropBusy] = useState(false);

  const draggingRef = useRef<DragState | null>(null);
  const hoverMealRef = useRef<MealSlot | null>(null);
  const selectedDayRef = useRef(selectedDay);
  const dropBusyRef = useRef(false);

  useEffect(() => {
    selectedDayRef.current = selectedDay;
  }, [selectedDay]);

  useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);

  useEffect(() => {
    hoverMealRef.current = hoverMeal;
  }, [hoverMeal]);

  useEffect(() => {
    dropBusyRef.current = dropBusy;
  }, [dropBusy]);

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

  async function placeRecipeAt(
    match: RecipeMatch,
    day: WeekDay,
    meal: MealSlot,
  ) {
    setPlaceError(null);
    const planDate = dateByDay[day];
    const { data, error } = await placeMealRecipe({
      userId,
      recipeId: match.recipe.id,
      recipeTitle: match.recipe.title,
      day,
      meal,
    });
    if (error) {
      console.error("[meal_plan] place error:", error);
      setPlaceError(error);
      throw new Error(error);
    }
    if (!data) throw new Error("배치에 실패했어요");

    setPlanMap((prev) => {
      const key = `${planDate}|${meal}`;
      const next = {
        ...prev,
        [key]: [...(prev[key] ?? []), data],
      };
      onPlansChange?.(flattenPlans(next));
      return next;
    });
  }

  async function placeRecipe(day: WeekDay, meal: MealSlot) {
    if (!placing) return;
    await placeRecipeAt(placing, day, meal);
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

  function mealFromPoint(clientX: number, clientY: number): MealSlot | null {
    const ghost = document.getElementById("meal-drag-ghost");
    if (ghost) ghost.style.pointerEvents = "none";
    const el = document.elementFromPoint(clientX, clientY);
    if (ghost) ghost.style.pointerEvents = "";
    const slot = el?.closest("[data-meal-slot]") as HTMLElement | null;
    const value = slot?.dataset.mealSlot;
    if (value && (MEAL_SLOTS as readonly string[]).includes(value)) {
      return value as MealSlot;
    }
    return null;
  }

  const dragHandlersRef = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: Event) => void;
  } | null>(null);

  function clearDragListeners() {
    if (!dragHandlersRef.current) return;
    window.removeEventListener("pointermove", dragHandlersRef.current.move, true);
    window.removeEventListener("pointerup", dragHandlersRef.current.up, true);
    window.removeEventListener("pointercancel", dragHandlersRef.current.up, true);
    dragHandlersRef.current = null;
    document.body.style.removeProperty("touch-action");
    document.body.style.removeProperty("user-select");
  }

  function beginDrag(match: RecipeMatch, clientX: number, clientY: number) {
    const next = { match, x: clientX, y: clientY };
    draggingRef.current = next;
    setDragging(next);
    const initialMeal = mealFromPoint(clientX, clientY);
    hoverMealRef.current = initialMeal;
    setHoverMeal(initialMeal);
    setPlaceError(null);

    clearDragListeners();

    const move = (e: PointerEvent) => {
      const cur = draggingRef.current;
      if (!cur) return;
      e.preventDefault();
      const updated = { ...cur, x: e.clientX, y: e.clientY };
      draggingRef.current = updated;
      setDragging(updated);
      const meal = mealFromPoint(e.clientX, e.clientY);
      hoverMealRef.current = meal;
      setHoverMeal(meal);
    };

    const up = () => {
      const cur = draggingRef.current;
      const meal = hoverMealRef.current;
      draggingRef.current = null;
      hoverMealRef.current = null;
      setDragging(null);
      setHoverMeal(null);
      clearDragListeners();
      if (!cur || !meal || dropBusyRef.current) return;
      dropBusyRef.current = true;
      setDropBusy(true);
      void placeRecipeAt(cur.match, selectedDayRef.current, meal)
        .catch(() => {
          // placeError already set
        })
        .finally(() => {
          dropBusyRef.current = false;
          setDropBusy(false);
        });
    };

    dragHandlersRef.current = { move, up };
    document.body.style.touchAction = "none";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move, {
      capture: true,
      passive: false,
    });
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
  }

  useEffect(() => {
    return () => clearDragListeners();
  }, []);

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

      const fridgeOwned = fridgeItems.filter(
        (f) => f.status === "보유" && f.item_type !== "완성요리",
      );
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
      <div
        className={`min-h-0 flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide sm:px-6 lg:px-8 ${
          dragging ? "overflow-hidden touch-none" : ""
        }`}
      >
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
            const isDropTarget = dragging != null && hoverMeal === meal;
            return (
              <div key={meal} className="flex items-start gap-2.5">
                <span className="mt-3 w-7 shrink-0 text-[11px] font-semibold text-muted-foreground">
                  {meal}
                </span>
                <div
                  data-meal-slot={meal}
                  className={`flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl transition-all ${
                    isDropTarget
                      ? "bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : dragging
                        ? "ring-1 ring-dashed ring-border"
                        : ""
                  }`}
                >
                  {placed.length > 0 ? (
                    placed.map((entry) => {
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
                    })
                  ) : (
                    <div
                      className={`flex flex-1 items-center justify-center rounded-xl border border-dashed py-3 ${
                        isDropTarget
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <Plus size={16} aria-hidden />
                      {isDropTarget && (
                        <span className="ml-1.5 text-[11px] font-semibold">
                          여기에 놓기
                        </span>
                      )}
                    </div>
                  )}
                  {placed.length > 0 && isDropTarget && (
                    <div className="flex items-center justify-center rounded-xl border border-dashed border-primary bg-primary/5 py-2 text-[11px] font-semibold text-primary">
                      여기에 추가
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mb-3 text-[11px] text-muted-foreground">
          레시피를 길게 눌러 위 끼니로 드래그하거나, + 로 배치할 수 있어요
        </p>

        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full bg-status-fresh-dot" />
              <span className="text-[12px] font-bold text-foreground">
                바로 가능
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {ready.length}개
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {ready.map((m) => (
                <CandidateCard
                  key={m.recipe.id}
                  match={m}
                  dragging={dragging?.match.recipe.id === m.recipe.id}
                  onDragBegin={beginDrag}
                  onAdd={() => {
                    setPlaceError(null);
                    setPlacing(m);
                  }}
                />
              ))}
              {ready.length === 0 && (
                <EmptyState
                  variant="section"
                  className="py-2"
                  title="지금 바로 만들 수 있는 요리가 없어요"
                />
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full bg-status-warn-dot" />
              <span className="text-[12px] font-bold text-foreground">
                +1 재료만 사면 가능
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {plusOne.length}개
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {plusOne.map((m) => (
                <CandidateCard
                  key={m.recipe.id}
                  match={m}
                  dragging={dragging?.match.recipe.id === m.recipe.id}
                  onDragBegin={beginDrag}
                  onAdd={() => {
                    setPlaceError(null);
                    setPlacing(m);
                  }}
                />
              ))}
              {plusOne.length === 0 && (
                <EmptyState
                  variant="section"
                  className="py-2"
                  title="+1 후보 요리가 없어요"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-6 lg:px-8">
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

      {dragging && (
        <div
          id="meal-drag-ghost"
          className="pointer-events-none fixed z-50 flex max-w-[220px] items-center gap-2 rounded-xl border border-primary/30 bg-card px-3 py-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
          style={{
            left: dragging.x,
            top: dragging.y,
            transform: "translate(-50%, -120%) scale(1.04)",
          }}
        >
          <FoodIcon name={dragging.match.recipe.title} size={22} />
          <span className="truncate text-[12px] font-semibold text-foreground">
            {dragging.match.recipe.title}
          </span>
        </div>
      )}
    </div>
  );
}
