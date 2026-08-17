"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { Clock, Plus } from "lucide-react";
import type { RecipeMatch } from "@/lib/recipe-match";
import { FoodIcon } from "@/components/ui/food-icon";

/** Match fridge home item-drag long-press timing. */
const LONG_PRESS_MS = 420;
const SCROLL_CANCEL_PX = 10;

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
  const dragStarted = useRef(false);
  const targetRef = useRef<HTMLElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  function clearLongPress() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function clearDragTouchAction() {
    const el = targetRef.current;
    if (el) el.style.removeProperty("touch-action");
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (!onDragBegin || e.button !== 0) return;
    // Capture element now; React nulls currentTarget after the handler returns.
    // Do NOT set touch-action:none here — parent scroll must keep working.
    targetRef.current = e.currentTarget as HTMLElement;
    pointerIdRef.current = e.pointerId;
    dragStarted.current = false;
    suppressClick.current = false;
    origin.current = { x: e.clientX, y: e.clientY };
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      const el = targetRef.current;
      const pointerId = pointerIdRef.current;
      if (!el || pointerId == null) return;
      dragStarted.current = true;
      suppressClick.current = true;
      el.style.touchAction = "none";
      try {
        el.setPointerCapture(pointerId);
      } catch {
        // ignore
      }
      onDragBegin(match, origin.current.x, origin.current.y);
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (longPressTimer.current == null) return;
    const dx = e.clientX - origin.current.x;
    const dy = e.clientY - origin.current.y;
    // Cancel long-press if the finger slides (scroll intent) before it arms.
    // Do not preventDefault — let the browser scroll.
    if (Math.hypot(dx, dy) > SCROLL_CANCEL_PX) {
      clearLongPress();
      clearDragTouchAction();
    }
  }

  function onPointerEnd() {
    clearLongPress();
    if (!dragStarted.current) clearDragTouchAction();
    dragStarted.current = false;
    targetRef.current = null;
    pointerIdRef.current = null;
  }

  return (
    <div
      className={`flex h-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 shadow-[0_1px_6px_rgba(0,0,0,0.04)] transition-opacity touch-manipulation ${
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
          if (suppressClick.current || dragging || dragStarted.current) {
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
