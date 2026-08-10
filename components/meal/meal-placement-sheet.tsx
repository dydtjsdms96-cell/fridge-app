"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import type { RecipeMatch } from "@/lib/recipe-match";
import { getFoodEmoji } from "@/lib/food-emoji";
import {
  MEAL_SLOTS,
  WEEK_DAYS,
  type MealSlot,
  type WeekDay,
} from "@/lib/week";
import type { RecipeDifficulty } from "@/types/database";

const DIFFICULTY_COLOR: Record<RecipeDifficulty, string> = {
  쉬움: "text-primary",
  보통: "text-status-warn",
  어려움: "text-status-urgent",
};

export type SlotOccupant = {
  recipeId: string;
  title: string;
};

type MealPlacementSheetProps = {
  match: RecipeMatch;
  defaultDay: WeekDay;
  /** day → meal → placed recipe (if any) */
  occupancy: Partial<Record<WeekDay, Partial<Record<MealSlot, SlotOccupant>>>>;
  onConfirm: (day: WeekDay, meal: MealSlot) => void | Promise<void>;
  onClose: () => void;
};

export function MealPlacementSheet({
  match,
  defaultDay,
  occupancy,
  onConfirm,
  onClose,
}: MealPlacementSheetProps) {
  const [day, setDay] = useState<WeekDay>(defaultDay);
  const [meal, setMeal] = useState<MealSlot>("점심");
  const [busy, setBusy] = useState(false);

  const occupied = occupancy[day]?.[meal] ?? null;
  const { recipe, group } = match;
  const difficulty = recipe.difficulty;
  const emoji = getFoodEmoji(recipe.title, null);

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm(day, meal);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-end"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full rounded-t-3xl bg-card shadow-[0_-8px_40px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="식단 배치"
      >
        <div className="mx-auto mt-4 mb-4 h-1 w-10 rounded-full bg-muted" />

        <div className="mb-5 px-5">
          <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-muted/50 p-3">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted text-2xl">
              {recipe.image_url ? (
                <img
                  src={recipe.image_url}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                emoji
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-tight font-bold text-foreground">
                {recipe.title}
              </p>
              <div className="mt-1 flex items-center gap-2">
                {recipe.cook_minutes != null && (
                  <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                    <Clock size={10} aria-hidden /> {recipe.cook_minutes}분
                  </span>
                )}
                {difficulty && (
                  <span
                    className={`text-[11px] font-semibold ${DIFFICULTY_COLOR[difficulty]}`}
                  >
                    ● {difficulty}
                  </span>
                )}
              </div>
            </div>
            {(group === "냉털" || group === "+1") && (
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  group === "냉털"
                    ? "bg-primary text-primary-foreground"
                    : "border border-status-warn-border bg-status-warn-bg text-status-warn"
                }`}
              >
                {group === "냉털" ? "냉털" : "+1"}
              </span>
            )}
          </div>
        </div>

        <div className="mb-4 px-5">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            요일
          </p>
          <div className="flex gap-1.5">
            {WEEK_DAYS.map((d) => {
              const hasMeal = MEAL_SLOTS.some((m) => occupancy[d]?.[m]);
              const active = day === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(d)}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[12px] font-semibold transition-all ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {d}
                  <span
                    className={`size-1 rounded-full ${
                      hasMeal
                        ? active
                          ? "bg-white/60"
                          : "bg-status-warn-dot"
                        : "bg-transparent"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-4 px-5">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            끼니
          </p>
          <div className="flex gap-2">
            {MEAL_SLOTS.map((m) => {
              const slotTaken = Boolean(occupancy[day]?.[m]);
              const active = meal === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMeal(m)}
                  className={`relative flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition-all ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m}
                  {slotTaken && (
                    <span
                      className={`absolute top-1.5 right-1.5 size-1.5 rounded-full ${
                        active ? "bg-white/60" : "bg-status-warn-dot"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 pb-8">
          {occupied && (
            <div className="mb-3 rounded-xl border border-status-warn-border bg-status-warn-bg px-3.5 py-2.5">
              <p className="text-[11px] leading-snug font-medium text-status-warn">
                이미{" "}
                <span className="font-bold text-[#7A5F0E]">{occupied.title}</span>
                이(가) 배치되어 있어요. 교체할까요?
              </p>
            </div>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={handleConfirm}
            className="w-full rounded-2xl bg-primary py-3.5 text-[13px] font-bold text-primary-foreground shadow-[0_4px_16px_rgba(61,112,88,0.3)] transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {occupied ? "교체하기" : "배치하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
