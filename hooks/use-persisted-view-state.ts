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
const SCROLL_RESTORE_MAX_ATTEMPTS = 60;

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

/** Sync write for callers that capture DOM scroll themselves before navigation. */
export function writePersistedViewState<T extends object>(
  key: string,
  state: T,
  scrollTop = 0,
) {
  writeBlob(key, state, scrollTop);
}

/**
 * Restore scrollTop on an inner overflow container after layout is tall enough.
 * Retries with rAF + short timeouts until scrollHeight can hold `top`, or attempts exhaust.
 * Returns a cancel function.
 */
export function restoreElementScroll(
  getEl: () => HTMLElement | null,
  top: number,
  options?: {
    maxAttempts?: number;
    onComplete?: (applied: boolean) => void;
  },
): () => void {
  const maxAttempts = options?.maxAttempts ?? SCROLL_RESTORE_MAX_ATTEMPTS;
  if (!(top > 0)) {
    options?.onComplete?.(false);
    return () => {};
  }

  let cancelled = false;
  let attempts = 0;
  let rafId = 0;
  let timeoutId = 0;

  const finish = (applied: boolean) => {
    if (cancelled) return;
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (timeoutId) window.clearTimeout(timeoutId);
    options?.onComplete?.(applied);
  };

  const tryRestore = () => {
    if (cancelled) return;
    const el = getEl();
    attempts += 1;

    if (!el) {
      if (attempts >= maxAttempts) {
        finish(false);
        return;
      }
      rafId = requestAnimationFrame(tryRestore);
      timeoutId = window.setTimeout(tryRestore, 32);
      return;
    }

    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    // Wait until content is tall enough to hold the saved offset (accordion/list paint).
    if (maxScroll + 1 < top && attempts < maxAttempts) {
      rafId = requestAnimationFrame(tryRestore);
      timeoutId = window.setTimeout(tryRestore, 32);
      return;
    }

    el.scrollTop = Math.min(top, maxScroll);

    // Images / late layout can still change height — verify after a frame.
    rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      const el2 = getEl();
      if (!el2) {
        finish(false);
        return;
      }
      const max2 = Math.max(0, el2.scrollHeight - el2.clientHeight);
      if (max2 + 1 < top && attempts < maxAttempts) {
        tryRestore();
        return;
      }
      if (Math.abs(el2.scrollTop - Math.min(top, max2)) > 2 && attempts < maxAttempts) {
        el2.scrollTop = Math.min(top, max2);
        timeoutId = window.setTimeout(tryRestore, 40);
        return;
      }
      el2.scrollTop = Math.min(top, max2);
      finish(true);
    });
  };

  // Double-rAF: wait for React commit + browser layout after accordion open.
  rafId = requestAnimationFrame(() => {
    rafId = requestAnimationFrame(tryRestore);
  });

  // Cleanup must not call onComplete — effect remounts would flicker scrollReady
  // and re-bind listeners mid-interaction.
  return () => {
    cancelled = true;
    if (rafId != null) cancelAnimationFrame(rafId);
    if (timeoutId != null) window.clearTimeout(timeoutId);
  };
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
  /**
   * False while a pending scroll restore is in progress.
   * Callers that own their own scroll fields should gate scroll persistence on this
   * when using restoreElementScroll themselves — for the hook's built-in scroll,
   * persistence is already gated.
   */
  scrollReady: boolean;
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
  const [scrollReady, setScrollReady] = useState(!persistScroll);
  const pendingScrollTop = useRef<number | null>(null);
  const restoringRef = useRef(false);
  const scrollRestoreStartedRef = useRef(false);

  stateRef.current = state;

  const flush = useCallback(() => {
    // Never persist a clamped-to-zero scroll while restore is still pending.
    if (restoringRef.current) {
      writeBlob(key, stateRef.current, pendingScrollTop.current ?? 0);
      return;
    }
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
      if (persistScroll && blob.scrollTop > 0) {
        pendingScrollTop.current = blob.scrollTop;
        restoringRef.current = true;
        setScrollReady(false);
      } else {
        pendingScrollTop.current = 0;
        setScrollReady(true);
      }
    } else {
      pendingScrollTop.current = 0;
      setScrollReady(true);
    }
    setReady(true);
    // defaults intentionally captured for initial merge only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ttlMs, persistScroll]);

  // Restore scroll once after hydrate — retry until content is tall enough.
  useEffect(() => {
    if (!ready || !persistScroll) return;
    if (scrollRestoreStartedRef.current) return;
    scrollRestoreStartedRef.current = true;

    const top = pendingScrollTop.current ?? 0;
    if (!(top > 0)) {
      setScrollReady(true);
      restoringRef.current = false;
      return;
    }

    restoringRef.current = true;
    setScrollReady(false);

    const cancel = restoreElementScroll(() => scrollRef.current, top, {
      onComplete: (applied) => {
        restoringRef.current = false;
        if (applied) pendingScrollTop.current = null;
        setScrollReady(true);
      },
    });

    return cancel;
  }, [ready, persistScroll]);

  // Debounced persist on state change (skip while restoring scroll)
  useEffect(() => {
    if (!ready || restoringRef.current) return;
    const timer = window.setTimeout(() => flush(), 120);
    return () => window.clearTimeout(timer);
  }, [state, ready, flush]);

  // Persist scroll while user scrolls (only after restore finished)
  useEffect(() => {
    if (!ready || !persistScroll || !scrollReady) return;
    const el = scrollRef.current;
    if (!el) return;

    let timer: number | null = null;
    const onScroll = () => {
      if (restoringRef.current) return;
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => flush(), 100);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (timer != null) window.clearTimeout(timer);
      el.removeEventListener("scroll", onScroll);
    };
  }, [ready, persistScroll, scrollReady, flush, state]);

  // Flush when leaving the page / hiding the tab
  useEffect(() => {
    if (!ready) return;
    const onLeave = () => flush();
    window.addEventListener("pagehide", onLeave);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onLeave();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      onLeave();
      window.removeEventListener("pagehide", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ready, flush]);

  const patchState = useCallback((partial: Partial<T>) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      stateRef.current = next;
      return next;
    });
  }, []);

  return {
    state,
    setState,
    patchState,
    scrollRef,
    ready,
    scrollReady,
    flush,
  };
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
