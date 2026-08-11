"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import type { RecipeMatch } from "@/lib/recipe-match";
import { FoodIcon } from "@/components/ui/food-icon";
import {
  BottomSheet,
  useBottomSheetClose,
} from "@/components/ui/bottom-sheet";
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
  /** day → meal → placed recipes (0+) */
  occupancy: Partial<Record<WeekDay, Partial<Record<MealSlot, SlotOccupant[]>>>>;
  onConfirm: (day: WeekDay, meal: MealSlot) => void | Promise<void>;
  onClose: () => void;
};

export function MealPlacementSheet(props: MealPlacementSheetProps) {
  return (
    <BottomSheet onClose={props.onClose} ariaLabel="식단 배치">
      <MealPlacementForm {...props} />
    </BottomSheet>
  );
}

function MealPlacementForm({
  match,
  defaultDay,
  occupancy,
  onConfirm,
}: MealPlacementSheetProps) {
  const close = useBottomSheetClose();
  const [day, setDay] = useState<WeekDay>(defaultDay);
  const [meal, setMeal] = useState<MealSlot>("점심");
  const [busy, setBusy] = useState(false);
  const [dupMsg, setDupMsg] = useState<string | null>(null);

  const occupants = occupancy[day]?.[meal] ?? [];
  const alreadySame = occupants.some((o) => o.recipeId === match.recipe.id);
  const { recipe, group } = match;
  const difficulty = recipe.difficulty;

  async function handleConfirm() {
    if (busy) return;
    if (alreadySame) {
      setDupMsg("이미 추가되어 있어요");
      return;
    }
    setDupMsg(null);
    setBusy(true);
    try {
      await onConfirm(day, meal);
      close();
    } catch {
      // parent surfaces the error; keep sheet open
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
      <div className="mb-5 px-5 pt-1">
        <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-muted/50 p-3">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted">
            {recipe.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={recipe.image_url}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <FoodIcon name={recipe.title} size={32} />
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
            const hasMeal = MEAL_SLOTS.some(
              (m) => (occupancy[d]?.[m]?.length ?? 0) > 0,
            );
            const active = day === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDay(d);
                  setDupMsg(null);
                }}
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
            const slotTaken = (occupancy[day]?.[m]?.length ?? 0) > 0;
            const active = meal === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMeal(m);
                  setDupMsg(null);
                }}
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
        {occupants.length > 0 && !alreadySame && (
          <div className="mb-3 rounded-xl border border-border bg-muted/60 px-3.5 py-2.5">
            <p className="text-[11px] leading-snug font-medium text-muted-foreground">
              이 슬롯에 이미{" "}
              <span className="font-semibold text-foreground">
                {occupants.map((o) => o.title).join(", ")}
              </span>
              이(가) 있어요. 함께 추가됩니다.
            </p>
          </div>
        )}
        {(alreadySame || dupMsg) && (
          <div className="mb-3 rounded-xl border border-status-warn-border bg-status-warn-bg px-3.5 py-2.5">
            <p className="text-[11px] leading-snug font-medium text-status-warn">
              {dupMsg ?? "이미 추가되어 있어요"}
            </p>
          </div>
        )}
        <button
          type="button"
          disabled={busy || alreadySame}
          onClick={handleConfirm}
          className="w-full rounded-2xl bg-primary py-3.5 text-[13px] font-bold text-primary-foreground shadow-[0_4px_16px_rgba(61,112,88,0.3)] transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          배치하기
        </button>
      </div>
    </div>
  );
}
