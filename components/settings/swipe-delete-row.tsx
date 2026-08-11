"use client";

import {
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Trash2 } from "lucide-react";

const DELETE_WIDTH = 76;
const LONG_PRESS_MS = 480;
/** Treat as closed until the user has dragged past this threshold (avoids flash). */
const OPEN_VISIBILITY_PX = 2;

type SwipeDeleteRowProps = {
  children: ReactNode;
  onDelete: () => void;
  disabled?: boolean;
  /** Sliding content background — must be opaque so the delete affordance stays hidden when closed */
  contentClassName?: string;
};

export function SwipeDeleteRow({
  children,
  onDelete,
  disabled,
  contentClassName = "bg-card",
}: SwipeDeleteRowProps) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const dragging = useRef(false);
  const longPressTimer = useRef<number | null>(null);
  const moved = useRef(false);

  const revealed = offset < -OPEN_VISIBILITY_PX;

  function clearLongPress() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    dragging.current = true;
    moved.current = false;
    startX.current = e.clientX;
    startOffset.current = offset;
    e.currentTarget.setPointerCapture(e.pointerId);

    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      if (!moved.current) setOffset(-DELETE_WIDTH);
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current || disabled) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 6) {
      moved.current = true;
      clearLongPress();
    }
    const next = Math.min(0, Math.max(-DELETE_WIDTH, startOffset.current + dx));
    setOffset(next);
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    clearLongPress();
    setOffset((prev) => (prev < -DELETE_WIDTH / 2 ? -DELETE_WIDTH : 0));
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <button
        type="button"
        tabIndex={revealed ? 0 : -1}
        aria-hidden={!revealed}
        onClick={() => {
          setOffset(0);
          onDelete();
        }}
        className="absolute inset-y-0 right-0 flex w-[76px] items-center justify-center bg-status-urgent text-white transition-opacity duration-150"
        style={{
          opacity: revealed ? 1 : 0,
          pointerEvents: revealed ? "auto" : "none",
        }}
        aria-label="삭제"
      >
        <Trash2 size={18} />
      </button>
      <div
        className={`relative z-[1] touch-pan-y transition-transform duration-150 ease-out ${contentClassName}`}
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
      </div>
    </div>
  );
}
