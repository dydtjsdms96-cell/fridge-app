import type { ReactNode } from "react";
import { StatusBar } from "@/components/home/status-bar";

type PhoneFrameProps = {
  children: ReactNode;
  /** Show fake iOS status bar (9:41 / signal / battery). Default true. */
  showStatusBar?: boolean;
  className?: string;
};

/**
 * Figma/marketing mock iPhone bezel.
 * Not used in production app routes — only `/design-preview` (and similar).
 */
export function PhoneFrame({
  children,
  showStatusBar = true,
  className = "",
}: PhoneFrameProps) {
  return (
    <div
      className={`flex min-h-screen items-center justify-center p-6 ${className}`}
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 30% 40%, #C8D9CF 0%, #BDB9B0 50%, #A8A49C 100%)",
      }}
    >
      <div className="relative flex h-[min(844px,100dvh)] w-full max-w-[390px] flex-col overflow-hidden rounded-[50px] bg-[#f5f4f0] shadow-[0_50px_100px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.15)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[60] rounded-[50px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]"
        />
        {showStatusBar ? <StatusBar /> : null}
        <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
