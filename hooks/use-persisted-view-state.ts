"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";

const STORAGE_PREFIX = "fp:view:";
const DEFAULT_TTL_MS = 30 * 60 * 1000;

type StoredBlob<T> = {
  savedAt: number;
  state: T;
  scrollTop: number;
};

function fullKey(key: string) {
  return key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
}

function readBlob<T>(key: string, ttlMs: number): StoredBlob<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(fullKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBlob<T>;
    if (
      !parsed ||
      typeof parsed.savedAt !== "number" ||
      parsed.state == null ||
      Date.now() - parsed.savedAt > ttlMs
    ) {
      sessionStorage.removeItem(fullKey(key));
      return null;
    }
    return {
      savedAt: parsed.savedAt,
      state: parsed.state,
      scrollTop:
        typeof parsed.scrollTop === "number" && Number.isFinite(parsed.scrollTop)
          ? parsed.scrollTop
          : 0,
    };
  } catch {
    return null;
  }
}

function writeBlob<T>(key: string, state: T, scrollTop: number) {
  if (typeof window === "undefined") return;
  try {
    const blob: StoredBlob<T> = {
      savedAt: Date.now(),
      state,
      scrollTop,
    };
    sessionStorage.setItem(fullKey(key), JSON.stringify(blob));
  } catch {
    // quota / private mode — ignore
  }
}

export type UsePersistedViewStateOptions = {
  /** Cache lifetime. Default 30 minutes. */
  ttlMs?: number;
  /**
   * When false, skip restoring scrollTop from storage
   * (e.g. caller restores multiple scroll containers from state).
   */
  persistScroll?: boolean;
};

export type UsePersistedViewStateResult<T> = {
  state: T;
  setState: Dispatch<SetStateAction<T>>;
  patchState: (partial: Partial<T>) => void;
  /** Attach to the primary overflow scroller for this view. */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** True after sessionStorage hydrate attempt (client). */
  ready: boolean;
  /** Force-write current state + scroll immediately (e.g. before navigate). */
  flush: () => void;
};

/**
 * Persist arbitrary view state (+ scroll) in sessionStorage keyed by `key`
 * (usually a pathname like `/meal` or `/fridge`).
 *
 * Restores on mount when the cache is younger than `ttlMs`.
 */
export function usePersistedViewState<T extends object>(
  key: string,
  defaults: T,
  options: UsePersistedViewStateOptions = {},
): UsePersistedViewStateResult<T> {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const persistScroll = options.persistScroll !== false;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<T>(defaults);
  const [state, setState] = useState<T>(defaults);
  const [ready, setReady] = useState(false);
  const pendingScrollTop = useRef<number | null>(null);

  stateRef.current = state;

  const flush = useCallback(() => {
    const scrollTop = persistScroll
      ? (scrollRef.current?.scrollTop ?? pendingScrollTop.current ?? 0)
      : 0;
    writeBlob(key, stateRef.current, scrollTop);
  }, [key, persistScroll]);

  // Hydrate once on mount
  useEffect(() => {
    const blob = readBlob<T>(key, ttlMs);
    if (blob) {
      stateRef.current = { ...defaults, ...blob.state };
      setState(stateRef.current);
      if (persistScroll) pendingScrollTop.current = blob.scrollTop;
    }
    setReady(true);
    // defaults intentionally captured for initial merge only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ttlMs, persistScroll]);

  // Restore scroll after paint once the scroller exists
  useEffect(() => {
    if (!ready || !persistScroll) return;
    const top = pendingScrollTop.current;
    if (top == null || top <= 0) return;

    let attempts = 0;
    const tryRestore = () => {
      const el = scrollRef.current;
      if (el) {
        el.scrollTop = top;
        pendingScrollTop.current = null;
        return;
      }
      if (attempts++ < 20) requestAnimationFrame(tryRestore);
    };
    requestAnimationFrame(tryRestore);
  }, [ready, persistScroll, state]);

  // Debounced persist on state change
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => flush(), 120);
    return () => window.clearTimeout(timer);
  }, [state, ready, flush]);

  // Persist scroll while user scrolls
  useEffect(() => {
    if (!ready || !persistScroll) return;
    const el = scrollRef.current;
    if (!el) return;

    let timer: number | null = null;
    const onScroll = () => {
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => flush(), 100);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (timer != null) window.clearTimeout(timer);
      el.removeEventListener("scroll", onScroll);
    };
  }, [ready, persistScroll, flush, state]);

  // Flush when leaving the page / hiding the tab
  useEffect(() => {
    if (!ready) return;
    const onLeave = () => flush();
    window.addEventListener("pagehide", onLeave);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onLeave();
    });
    return () => {
      onLeave();
      window.removeEventListener("pagehide", onLeave);
    };
  }, [ready, flush]);

  const patchState = useCallback((partial: Partial<T>) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      stateRef.current = next;
      return next;
    });
  }, []);

  return { state, setState, patchState, scrollRef, ready, flush };
}

/** Navigate back when possible; otherwise push a fallback route. */
export function navigateBackOr(
  router: { back: () => void; push: (href: string) => void; refresh?: () => void },
  fallbackHref: string,
  options?: { refresh?: boolean },
) {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
  } else {
    router.push(fallbackHref);
  }
  if (options?.refresh !== false) {
    router.refresh?.();
  }
}
