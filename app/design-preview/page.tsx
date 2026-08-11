import { PhoneFrame } from "@/components/design/phone-frame";
import { BottomTabBar } from "@/components/home/bottom-tab-bar";

/**
 * Dev/marketing-only route: Figma-style iPhone frame + fake status bar.
 * Production app routes use full-bleed `AppShell` instead.
 */
export default function DesignPreviewPage() {
  return (
    <PhoneFrame>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6">
          <p className="text-[11px] font-medium tracking-[0.275px] text-muted-foreground uppercase">
            Design preview
          </p>
          <h1 className="mt-0.5 text-[22px] font-bold leading-[27.5px] text-foreground">
            iPhone 프레임 목업
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            이 페이지는 스크린샷·마케팅용입니다. 실제 앱 라우트(
            <code className="text-[12px]">/</code>,{" "}
            <code className="text-[12px]">/fridge</code> 등)에는 프레임과
            가짜 상태바가 렌더링되지 않습니다.
          </p>
          <div className="mt-5 space-y-3">
            {[
              "둥근 베젤 + 그림자",
              "가짜 상태바 (9:41 / 신호 / 배터리)",
              "고정 폭 390px 캔버스",
            ].map((label) => (
              <div
                key={label}
                className="rounded-2xl border border-border bg-card px-4 py-3 text-[13px] font-medium text-foreground shadow-[0_1px_6px_rgba(0,0,0,0.04)]"
              >
                {label}
              </div>
            ))}
          </div>
        </div>
        <BottomTabBar activeTab="home" />
      </div>
    </PhoneFrame>
  );
}
