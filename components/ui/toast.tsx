"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const TOAST_COMING_SOON = "준비 중입니다";

type ToastProps = {
  message: string | null;
  /** default bottom — barcode/receipt often use top */
  position?: "top" | "bottom";
};

export function Toast({ message, position = "bottom" }: ToastProps) {
  if (!message) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-x-5 z-[80] flex justify-center ${
        position === "top" ? "top-20" : "bottom-6"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="max-w-full rounded-2xl bg-foreground/90 px-4 py-3 text-center text-[12px] font-semibold text-background shadow-lg">
        {message}
      </div>
    </div>
  );
}

export function useToast(defaultDurationMs = 2200) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const clearToast = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage(null);
  }, []);

  const showToast = useCallback(
    (next: string, durationMs = defaultDurationMs) => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      setMessage(next);
      timerRef.current = window.setTimeout(() => {
        setMessage(null);
        timerRef.current = null;
      }, durationMs);
    },
    [defaultDurationMs],
  );

  return { message, showToast, clearToast };
}
