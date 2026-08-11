"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Clock, Minus, Plus } from "lucide-react";
import { ingredientNamesMatch, isOwnedIngredient } from "@/lib/recipe-match";
import {
  formatIngredientAmountForMode,
  type AmountUnitMode,
} from "@/lib/format-amount";
import { FoodIcon } from "@/components/ui/food-icon";
import {
  normalizeBaseServings,
  scaleRecipeIngredients,
  SERVING_OPTIONS,
  type ServingOption,
} from "@/lib/servings-scale";
import { createClient } from "@/lib/supabase";
import type {
  FridgeItem,
  Recipe,
  RecipeDifficulty,
  RecipeIngredient,
  RecipeStep,
} from "@/types/database";

const DIFFICULTY_COLOR: Record<RecipeDifficulty, string> = {
  쉬움: "text-primary",
  보통: "text-status-warn",
  어려움: "text-status-urgent",
};

type RecipeDetailScreenProps = {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  fridgeItems: FridgeItem[];
};

export function RecipeDetailScreen({
  recipe,
  ingredients,
  fridgeItems,
}: RecipeDetailScreenProps) {
  const router = useRouter();
  const baseServings = normalizeBaseServings(recipe.base_servings);
  const [servings, setServings] = useState<ServingOption>(() => {
    const matched = SERVING_OPTIONS.find((n) => n === baseServings);
    return matched ?? 1;
  });

  const fridgeStock = useMemo(
    () =>
      fridgeItems.map((i) => ({
        name: i.name,
        quantity: Number(i.quantity) || 0,
      })),
    [fridgeItems],
  );
  const steps = useMemo(() => {
    const raw = (recipe.steps ?? []) as RecipeStep[];
    return [...raw].sort((a, b) => a.step - b.step);
  }, [recipe.steps]);

  const scaledIngredients = useMemo(
    () => scaleRecipeIngredients(ingredients, baseServings, servings),
    [ingredients, baseServings, servings],
  );
  // 양념·조미료는 재료 목록에 표시하지 않음 (차감도 스킵)
  const visibleIngredients = useMemo(
    () => scaledIngredients.filter((ing) => ing.scaleMode !== "mild"),
    [scaledIngredients],
  );

  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(() => new Set());
  const [showDeductConfirm, setShowDeductConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unitMode, setUnitMode] = useState<AmountUnitMode>("natural");

  const doneCount = checkedSteps.size;
  const totalSteps = steps.length;
  const allDone = totalSteps > 0 && doneCount === totalSteps;
  const difficulty = recipe.difficulty;

  function setServingsClamped(next: number) {
    const clamped = Math.min(
      4,
      Math.max(1, Math.floor(next)),
    ) as ServingOption;
    setServings(clamped);
  }

  function toggleStep(step: number) {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  }

  async function deductIngredients() {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();

    try {
      for (const ing of visibleIngredients) {
        const deduct = Number(ing.scaledAmount) || 0;
        if (deduct <= 0) continue;

        const fridgeItem = fridgeItems.find(
          (f) =>
            f.status === "보유" &&
            ingredientNamesMatch(f.name, ing.ingredient_name),
        );
        if (!fridgeItem) continue;

        const newQty =
          Math.round((Number(fridgeItem.quantity) - deduct) * 100) / 100;

        if (newQty <= 0) {
          const { error } = await supabase
            .from("fridge_items")
            .update({ quantity: 0, status: "소진" })
            .eq("id", fridgeItem.id);
          if (error) console.error("[cook] deduct error:", error.message);
        } else {
          const { error } = await supabase
            .from("fridge_items")
            .update({ quantity: newQty })
            .eq("id", fridgeItem.id);
          if (error) console.error("[cook] deduct error:", error.message);
        }
      }
      router.push("/meal");
      router.refresh();
    } finally {
      setBusy(false);
      setShowDeductConfirm(false);
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
        <div className="relative h-[220px] shrink-0 overflow-hidden bg-muted">
          {recipe.image_url ? (
            <img
              src={recipe.image_url}
              alt={recipe.title}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center opacity-90">
              <FoodIcon name={recipe.title} size={72} />
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(0deg, rgba(245,244,240,0.5) 0%, rgba(245,244,240,0) 50%, rgba(0,0,0,0.2) 100%)",
            }}
          />
          <button
            type="button"
            onClick={() => router.push("/meal")}
            className="absolute top-3 left-3 z-10 flex size-9 items-center justify-center rounded-full bg-card/90 text-foreground shadow-sm backdrop-blur-sm transition-transform active:scale-95"
            aria-label="뒤로"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        <div className="px-5 pt-5 pb-4">
          <h1 className="text-[24px] leading-[30px] font-bold text-foreground">
            {recipe.title}
          </h1>
          <div className="mt-2 flex items-center gap-4 text-[13px] text-muted-foreground">
            {recipe.cook_minutes != null && (
              <span className="flex items-center gap-1.5">
                <Clock size={13} aria-hidden />
                {recipe.cook_minutes}분
              </span>
            )}
            {difficulty && (
              <span className={`font-semibold ${DIFFICULTY_COLOR[difficulty]}`}>
                ● {difficulty}
              </span>
            )}
          </div>

          {/* Servings picker */}
          <div className="mt-4 rounded-2xl border border-border bg-card px-3.5 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold text-foreground">
                  몇 인분 만들까요?
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  기준 {baseServings}인분 · 양념은 완만하게 맞춰요
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="인분 줄이기"
                  disabled={servings <= 1}
                  onClick={() => setServingsClamped(servings - 1)}
                  className="flex size-8 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-transform active:scale-95 disabled:opacity-40"
                >
                  <Minus size={14} />
                </button>
                <span className="min-w-[3.25rem] text-center font-mono text-[18px] font-bold tabular-nums text-foreground">
                  {servings}
                  <span className="ml-0.5 text-[12px] font-semibold text-muted-foreground">
                    인분
                  </span>
                </span>
                <button
                  type="button"
                  aria-label="인분 늘리기"
                  disabled={servings >= 4}
                  onClick={() => setServingsClamped(servings + 1)}
                  className="flex size-8 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-transform active:scale-95 disabled:opacity-40"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <div className="mt-2.5 flex gap-1.5">
              {SERVING_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setServings(n)}
                  className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${
                    servings === n
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {n}인분
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5">
          <div className="h-px bg-border" />
        </div>

        <section className="px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                재료
              </p>
              <p className="text-[10px] text-muted-foreground">
                {servings}인분 기준
              </p>
            </div>
          </div>

          <div
            className="mt-3 flex rounded-xl border border-border bg-muted/60 p-0.5"
            role="group"
            aria-label="재료 단위 보기"
          >
            <button
              type="button"
              onClick={() => setUnitMode("natural")}
              className={`flex-1 rounded-[10px] py-2 text-[11px] font-semibold transition-colors ${
                unitMode === "natural"
                  ? "bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "text-muted-foreground"
              }`}
            >
              일반 단위
            </button>
            <button
              type="button"
              onClick={() => setUnitMode("grams")}
              className={`flex-1 rounded-[10px] py-2 text-[11px] font-semibold transition-colors ${
                unitMode === "grams"
                  ? "bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "text-muted-foreground"
              }`}
            >
              g (그램)
            </button>
          </div>
          {unitMode === "grams" && (
            <p className="mt-1.5 text-[10px] leading-[14px] text-muted-foreground">
              큰술≈15g · 작은술≈5g · 계란 1개≈55g 등 일반 계량 기준
            </p>
          )}

          <ul className="mt-3 space-y-2.5">
            {visibleIngredients.map((ing) => {
              const owned = isOwnedIngredient(
                ing.ingredient_name,
                fridgeStock,
                ing.scaledAmount,
              );
              return (
                <li key={ing.id} className="flex items-center gap-3">
                  {owned ? (
                    <Check
                      size={16}
                      className="shrink-0 text-primary"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                  ) : (
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-[#fef0ed] text-[9px] font-bold text-[#c04d38]">
                      !
                    </span>
                  )}
                  <span
                    className={`min-w-0 flex-1 text-[13px] font-medium leading-[19.5px] ${
                      owned ? "text-foreground" : "text-[#c04d38]"
                    }`}
                  >
                    {owned ? "" : "[부족] "}
                    {ing.ingredient_name}
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                    {formatIngredientAmountForMode(
                      ing.scaledAmount,
                      ing.unit,
                      ing.ingredient_name,
                      unitMode,
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="px-5">
          <div className="h-px bg-border" />
        </div>

        <section className="px-5 pt-4 pb-8">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            조리 단계
          </p>
          <ul className="mt-3.5 space-y-4">
            {steps.map((s) => {
              const checked = checkedSteps.has(s.step);
              return (
                <li key={s.step}>
                  <button
                    type="button"
                    onClick={() => toggleStep(s.step)}
                    className="flex w-full items-start gap-3 text-left"
                  >
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-medium font-mono ${
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {checked ? (
                        <Check size={12} strokeWidth={3} />
                      ) : (
                        s.step
                      )}
                    </span>
                    <p
                      className={`pt-0.5 text-[13px] leading-[21px] font-medium ${
                        checked
                          ? "text-muted-foreground line-through"
                          : "text-foreground"
                      }`}
                    >
                      {s.content}
                    </p>
                  </button>
                </li>
              );
            })}
            {steps.length === 0 && (
              <p className="text-sm text-muted-foreground">
                등록된 조리 단계가 없어요
              </p>
            )}
          </ul>
        </section>
      </div>

      <div className="shrink-0 border-t border-border bg-background px-5 py-4">
        <button
          type="button"
          disabled={!allDone || busy}
          onClick={() => setShowDeductConfirm(true)}
          className="w-full rounded-[16px] bg-primary py-3.5 text-[13px] font-bold text-primary-foreground shadow-[0_4px_16px_rgba(61,112,88,0.2)] transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          조리 완료 ({doneCount}/{totalSteps || 0}단계)
        </button>
      </div>

      {showDeductConfirm && (
        <div
          className="absolute inset-0 z-[70] flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.55)" }}
        >
          <div className="w-full rounded-3xl bg-card p-6 shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
            <h3 className="mb-2 text-center text-[17px] font-bold text-foreground">
              사용한 재료를 재고에서 차감할까요?
            </h3>
            <p className="mb-6 text-center text-[12px] text-muted-foreground">
              {servings}인분 기준으로 보유 중인 재료만 빼요. 없는 재료는
              건너뛰어요.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeductConfirm(false)}
                className="rounded-xl bg-muted py-3 text-[13px] font-semibold text-foreground transition-transform active:scale-95"
              >
                아니오
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={deductIngredients}
                className="rounded-xl bg-primary py-3 text-[13px] font-semibold text-primary-foreground transition-transform active:scale-95 disabled:opacity-60"
              >
                예
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
