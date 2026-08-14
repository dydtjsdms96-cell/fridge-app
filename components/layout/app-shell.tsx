"use client";

import type { ReactNode } from "react";
import { BottomTabBar, type AppTab } from "@/components/home/bottom-tab-bar";
import { useImmersiveModeState } from "@/components/layout/immersive-mode";

type AppShellProps = {
  activeTab: AppTab;
  children: ReactNode;
  fab?: ReactNode;
  /** Route-level immersive (barcode / receipt pages) — hide tab bar for the whole page */
  hideTabBar?: boolean;
};

/**
 * Full-bleed app chrome.
 * ImmersiveModeProvider lives in CapacitorShell (app-wide) and resets
 * leftover locks whenever a tab-root path is entered.
 *
 * Height is locked to the viewport (`h-dvh`) so the tab bar stays pinned;
 * `min-h-dvh` alone lets tall content push the tab below the fold.
 */
export function AppShell({
  activeTab,
  children,
  fab,
  hideTabBar = false,
}: AppShellProps) {
  const { immersive } = useImmersiveModeState();
  const showTabBar = !hideTabBar && !immersive;

  return (
    <div
      data-app-shell
      className="relative mx-auto flex h-dvh max-h-dvh w-full max-w-full flex-col overflow-hidden bg-background"
    >
      <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
      {showTabBar && fab}
      {showTabBar && <BottomTabBar activeTab={activeTab} />}
    </div>
  );
}
