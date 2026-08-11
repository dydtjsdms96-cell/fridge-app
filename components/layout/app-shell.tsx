import type { ReactNode } from "react";
import { BottomTabBar, type AppTab } from "@/components/home/bottom-tab-bar";

type AppShellProps = {
  activeTab: AppTab;
  children: ReactNode;
  fab?: ReactNode;
};

/** Full-bleed responsive app chrome (no mock phone frame / status bar). */
export function AppShell({ activeTab, children, fab }: AppShellProps) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-full flex-col bg-background">
      <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
      {fab}
      <BottomTabBar activeTab={activeTab} />
    </div>
  );
}
