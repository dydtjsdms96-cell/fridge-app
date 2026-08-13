"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { Clock, Plus } from "lucide-react";
import type { RecipeMatch } from "@/lib/recipe-match";
import { FoodIcon } from "@/components/ui/food-icon";

const LONG_PRESS_MS = 280;

type CandidateCardProps = {
  match: RecipeMatch;
  onAdd: () => void;
  /** Long-press then drag to a meal slot */
  onDragBegin?: (match: RecipeMatch, clientX: number, clientY: number) => void;
  dragging?: boolean;
};

export function CandidateCard({
  match,
  onAdd,
  onDragBegin,
  dragging = false,
}: CandidateCardProps) {
  const { recipe, ingredients, ownedCount, totalCount } = match;
  const missing = ingredients.filter((i) => !i.owned);
  const longPressTimer = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);

  function clearLongPress() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (!onDragBegin || e.button !== 0) return;
    suppressClick.current = false;
    origin.current = { x: e.clientX, y: e.clientY };
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      suppressClick.current = true;
      onDragBegin(match, origin.current.x, origin.current.y);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (longPressTimer.current == null) return;
    const dx = e.clientX - origin.current.x;
    const dy = e.clientY - origin.current.y;
    if (Math.hypot(dx, dy) > 10) clearLongPress();
  }

  function onPointerEnd() {
    clearLongPress();
  }

  return (
    <div
      className={`flex h-full touch-manipulation items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 shadow-[0_1px_6px_rgba(0,0,0,0.04)] transition-opacity ${
        dragging ? "opacity-40" : "opacity-100"
      }`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <Link
        href={`/meal/${recipe.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={(e) => {
          if (suppressClick.current || dragging) {
            e.preventDefault();
            suppressClick.current = false;
          }
        }}
        draggable={false}
      >
        <FoodIcon name={recipe.title} size={26} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">
            {recipe.title}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            {recipe.cook_minutes != null && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Clock size={9} aria-hidden /> {recipe.cook_minutes}분
              </span>
            )}
            <span className="text-[10px] tabular-nums text-muted-foreground">
              재료 {ownedCount}/{totalCount}
            </span>
            {missing[0] && (
              <span className="rounded-full bg-status-warn-bg px-1.5 py-0.5 text-[10px] font-medium text-status-warn">
                {missing[0].name}
              </span>
            )}
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={onAdd}
        onPointerDown={(e) => e.stopPropagation()}
        className="touch-target flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-secondary text-primary transition-transform active:scale-95"
        aria-label={`${recipe.title} 배치`}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
