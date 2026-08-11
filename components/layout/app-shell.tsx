"use client";

import type { ReactNode } from "react";
import { BottomTabBar, type AppTab } from "@/components/home/bottom-tab-bar";
import {
  ImmersiveModeProvider,
  useImmersiveModeState,
} from "@/components/layout/immersive-mode";

type AppShellProps = {
  activeTab: AppTab;
  children: ReactNode;
  fab?: ReactNode;
  /** Route-level immersive (barcode / receipt pages) */
  hideTabBar?: boolean;
};

/** Full-bleed responsive app chrome (no mock phone frame / status bar). */
export function AppShell({
  activeTab,
  children,
  fab,
  hideTabBar = false,
}: AppShellProps) {
  return (
    <ImmersiveModeProvider>
      <AppShellChrome
        activeTab={activeTab}
        fab={fab}
        hideTabBar={hideTabBar}
      >
        {children}
      </AppShellChrome>
    </ImmersiveModeProvider>
  );
}

function AppShellChrome({
  activeTab,
  children,
  fab,
  hideTabBar,
}: AppShellProps) {
  const { immersive } = useImmersiveModeState();
  const hideChrome = Boolean(hideTabBar || immersive);

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-full flex-col bg-background">
      <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
      {!hideChrome && fab}
      {!hideChrome && <BottomTabBar activeTab={activeTab} />}
    </div>
  );
}
