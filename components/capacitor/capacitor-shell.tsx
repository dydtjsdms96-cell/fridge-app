"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { WifiOff } from "lucide-react";
import { ImmersiveModeProvider } from "@/components/layout/immersive-mode";
import { VoiceAddRequestProvider } from "@/components/fridge/voice-add-request";

const STATUS_BAR_COLOR = "#2E5B4C";
const EXIT_TOAST_MS = 2000;

function isAppRootPath(pathname: string | null): boolean {
  if (!pathname) return true;
  return pathname === "/";
}

export function CapacitorShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const lastBackRef = useRef(0);
  const [offline, setOffline] = useState(false);
  const [exitHint, setExitHint] = useState(false);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    const listeners: Array<{ remove: () => Promise<void> }> = [];

    async function setup() {
      try {
        await StatusBar.setBackgroundColor({ color: STATUS_BAR_COLOR });
        await StatusBar.setStyle({ style: Style.Dark });
        if (Capacitor.getPlatform() === "android") {
          await StatusBar.setOverlaysWebView({ overlay: false });
        }
      } catch (err) {
        console.warn("[capacitor] StatusBar setup failed", err);
      }

      try {
        await SplashScreen.hide();
      } catch {
        // ignore — auto-hide may already have run
      }

      try {
        const status = await Network.getStatus();
        if (!cancelled) setOffline(!status.connected);
        const networkListener = await Network.addListener(
          "networkStatusChange",
          (next) => {
            setOffline(!next.connected);
          },
        );
        listeners.push(networkListener);
      } catch (err) {
        console.warn("[capacitor] Network setup failed", err);
      }

      try {
        const backListener = await App.addListener(
          "backButton",
          ({ canGoBack }) => {
            const onRoot = isAppRootPath(pathnameRef.current);

            if (!onRoot) {
              router.back();
              return;
            }

            if (canGoBack) {
              window.history.back();
              return;
            }

            const now = Date.now();
            if (now - lastBackRef.current < EXIT_TOAST_MS) {
              void App.exitApp();
              return;
            }
            lastBackRef.current = now;
            setExitHint(true);
            window.setTimeout(() => setExitHint(false), EXIT_TOAST_MS);
          },
        );
        listeners.push(backListener);
      } catch (err) {
        console.warn("[capacitor] App backButton setup failed", err);
      }
    }

    void setup();

    return () => {
      cancelled = true;
      for (const listener of listeners) {
        void listener.remove();
      }
    };
  }, [router]);

  return (
    <ImmersiveModeProvider>
      <Suspense fallback={null}>
        <VoiceAddRequestProvider>{children}</VoiceAddRequestProvider>
      </Suspense>
      {offline && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-[#f5f4f0] px-8 text-center"
          role="alert"
          aria-live="polite"
        >
          <div className="flex size-16 items-center justify-center rounded-2xl bg-[#2E5B4C]/15 text-[#2E5B4C]">
            <WifiOff size={28} />
          </div>
          <div>
            <p className="text-[18px] font-bold text-[#1b1b19]">
              인터넷 연결을 확인해주세요
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-[#9a9790]">
              네트워크가 끊긴 것 같아요. 연결되면 자동으로 다시 이어져요.
            </p>
          </div>
        </div>
      )}
      {exitHint && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[110] flex justify-center px-5">
          <div className="rounded-full bg-[#1b1b19]/90 px-4 py-2.5 text-[13px] font-medium text-white shadow-lg">
            한 번 더 누르면 종료됩니다
          </div>
        </div>
      )}
    </ImmersiveModeProvider>
  );
}
