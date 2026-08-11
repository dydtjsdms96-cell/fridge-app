"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

type ImmersiveModeContextValue = {
  immersive: boolean;
  enter: (id: string) => void;
  exit: (id: string) => void;
  reset: () => void;
};

const ImmersiveModeContext = createContext<ImmersiveModeContextValue | null>(
  null,
);

/** Tab roots must always show the bottom tab bar. */
export function isTabRootPath(pathname: string | null | undefined): boolean {
  if (!pathname) return true;
  return (
    pathname === "/" ||
    pathname === "/fridge" ||
    pathname === "/meal" ||
    pathname === "/shopping" ||
    pathname === "/settings"
  );
}

export function ImmersiveModeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [locks, setLocks] = useState<Set<string>>(() => new Set());

  const enter = useCallback((id: string) => {
    setLocks((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const exit = useCallback((id: string) => {
    setLocks((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setLocks((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  // Clear leftover locks when navigating onto a tab root (or between tabs).
  // Skip the provider's first mount (prev === null) so an already-open sheet's
  // enter() is not wiped by a parent effect that runs after children.
  const prevPathRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname ?? null;
    if (!isTabRootPath(pathname)) return;
    if (prev === null || prev === pathname) return;
    reset();
  }, [pathname, reset]);

  const value = useMemo(
    () => ({
      immersive: locks.size > 0,
      enter,
      exit,
      reset,
    }),
    [locks, enter, exit, reset],
  );

  return (
    <ImmersiveModeContext.Provider value={value}>
      {children}
    </ImmersiveModeContext.Provider>
  );
}

export function useImmersiveModeState() {
  const ctx = useContext(ImmersiveModeContext);
  if (!ctx) {
    return {
      immersive: false,
      enter: (_id: string) => {},
      exit: (_id: string) => {},
      reset: () => {},
    };
  }
  return ctx;
}

/**
 * While mounted (or while `active`), hide the app tab bar.
 * Uses a stable lock id so Strict Mode remounts cannot leave depth stuck.
 */
export function useImmersiveMode(active = true) {
  const { enter, exit } = useImmersiveModeState();
  const id = useId();

  useEffect(() => {
    if (!active) return;
    enter(id);
    return () => exit(id);
  }, [active, id, enter, exit]);
}
