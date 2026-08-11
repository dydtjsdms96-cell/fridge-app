"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Shared sheet motion — keep in sync with globals.css durations. */
export const SHEET_DURATION_MS = 280;
export const SHEET_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

const BottomSheetCloseContext = createContext<() => void>(() => {});

/** Animated close for nested sheet content (backdrop / submit / X). */
export function useBottomSheetClose() {
  return useContext(BottomSheetCloseContext);
}

type BottomSheetProps = {
  onClose: () => void;
  children: ReactNode;
  /** Extra classes on the sliding panel */
  className?: string;
  /** Show the drag handle pill (default true) */
  showHandle?: boolean;
  ariaLabel?: string;
  /** Overlay z-index (default 50) */
  zIndex?: number;
};

/**
 * Unified bottom sheet: backdrop fade + panel slide-up.
 * Call useBottomSheetClose() inside children for animated dismiss.
 */
export function BottomSheet({
  onClose,
  children,
  className = "",
  showHandle = true,
  ariaLabel,
  zIndex = 50,
}: BottomSheetProps) {
  const [entered, setEntered] = useState(false);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setEntered(true));
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setEntered(false);
    window.setTimeout(() => {
      onCloseRef.current();
    }, SHEET_DURATION_MS);
  }, []);

  return (
    <div
      className={`absolute inset-0 flex items-end transition-opacity ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      style={{
        zIndex,
        background: "rgba(0,0,0,0.42)",
        transitionDuration: `${SHEET_DURATION_MS}ms`,
        transitionTimingFunction: SHEET_EASING,
      }}
      onClick={requestClose}
      role="presentation"
    >
      <div
        className={`relative flex max-h-[88%] w-full flex-col overflow-hidden rounded-t-[28px] bg-card shadow-[0_-8px_48px_rgba(0,0,0,0.18)] transition-transform ${
          entered ? "translate-y-0" : "translate-y-full"
        } ${className}`}
        style={{
          transitionDuration: `${SHEET_DURATION_MS}ms`,
          transitionTimingFunction: SHEET_EASING,
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {showHandle && (
          <div className="flex shrink-0 justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-muted" />
          </div>
        )}
        <BottomSheetCloseContext.Provider value={requestClose}>
          {children}
        </BottomSheetCloseContext.Provider>
      </div>
    </div>
  );
}
