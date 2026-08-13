"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { parseFreshPocketDeepLink } from "@/lib/deep-links";

type VoiceAddRequestContextValue = {
  utterance: string | null;
  clearUtterance: () => void;
  requestVoiceAdd: (text: string) => void;
};

const VoiceAddRequestContext =
  createContext<VoiceAddRequestContextValue | null>(null);

export function useVoiceAddRequest() {
  const ctx = useContext(VoiceAddRequestContext);
  if (!ctx) {
    throw new Error(
      "useVoiceAddRequest must be used within VoiceAddRequestProvider",
    );
  }
  return ctx;
}

export function useOptionalVoiceAddRequest() {
  return useContext(VoiceAddRequestContext);
}

export function VoiceAddRequestProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [utterance, setUtterance] = useState<string | null>(null);
  const handledLaunch = useRef(false);
  const lastQueryKey = useRef<string | null>(null);

  const requestVoiceAdd = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setUtterance(trimmed);
      if (pathname !== "/") {
        router.push(`/?voiceAdd=${encodeURIComponent(trimmed)}`);
      }
    },
    [pathname, router],
  );

  const clearUtterance = useCallback(() => setUtterance(null), []);

  const handleRawUrl = useCallback(
    (rawUrl: string) => {
      const parsed = parseFreshPocketDeepLink(rawUrl);
      if (parsed.action === "add") {
        requestVoiceAdd(parsed.text);
      }
    },
    [requestVoiceAdd],
  );

  // Web query: /?voiceAdd=... or /add?text=...
  useEffect(() => {
    const fromQuery =
      searchParams.get("voiceAdd") ??
      searchParams.get("text") ??
      searchParams.get("q") ??
      searchParams.get("query");
    if (!fromQuery?.trim()) return;

    const key = `${pathname}?${fromQuery.trim()}`;
    if (lastQueryKey.current === key) return;
    lastQueryKey.current = key;

    setUtterance(fromQuery.trim());
    if (pathname !== "/" || searchParams.toString().length > 0) {
      router.replace("/");
    }
  }, [pathname, router, searchParams]);

  // Native: cold start + runtime opens
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    const listeners: Array<{ remove: () => Promise<void> }> = [];

    async function setup() {
      try {
        const launch = await App.getLaunchUrl();
        if (!cancelled && launch?.url && !handledLaunch.current) {
          handledLaunch.current = true;
          handleRawUrl(launch.url);
        }
      } catch (err) {
        console.warn("[deep-link] getLaunchUrl failed", err);
      }

      try {
        const sub = await App.addListener("appUrlOpen", ({ url }) => {
          handleRawUrl(url);
        });
        listeners.push(sub);
      } catch (err) {
        console.warn("[deep-link] appUrlOpen failed", err);
      }
    }

    void setup();
    return () => {
      cancelled = true;
      for (const l of listeners) void l.remove();
    };
  }, [handleRawUrl]);

  const value = useMemo(
    () => ({ utterance, clearUtterance, requestVoiceAdd }),
    [utterance, clearUtterance, requestVoiceAdd],
  );

  return (
    <VoiceAddRequestContext.Provider value={value}>
      {children}
    </VoiceAddRequestContext.Provider>
  );
}
