"use client";

import { Camera, CookingPot, Keyboard, Mic, ScanBarcode, X } from "lucide-react";

type AddOptionsSheetProps = {
  onClose: () => void;
  onSelectManual: () => void;
  onSelectVoice: () => void;
  onSelectReceipt: () => void;
  onSelectBarcode: () => void;
  onSelectCookedDish: () => void;
};

export function AddOptionsSheet({
  onClose,
  onSelectManual,
  onSelectVoice,
  onSelectReceipt,
  onSelectBarcode,
  onSelectCookedDish,
}: AddOptionsSheetProps) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-end"
      style={{ background: "rgba(0,0,0,0.42)" }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-[28px] bg-card px-5 pt-3 pb-8 shadow-[0_-8px_48px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              재료 등록
            </p>
            <h2 className="mt-0.5 text-[18px] font-bold text-foreground">
              어떻게 추가할까요?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full border border-border bg-background"
            aria-label="닫기"
          >
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onSelectManual}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-4 text-left transition-transform active:scale-[0.98]"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
              <Keyboard size={20} />
            </div>
            <div>
              <p className="text-[14px] font-bold text-foreground">수동 입력</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                이름·수량·보관 구역을 직접 입력해요
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onSelectVoice}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-4 text-left transition-transform active:scale-[0.98]"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Mic size={20} />
            </div>
            <div>
              <p className="text-[14px] font-bold text-foreground">음성 등록</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                말하면서 여러 재료를 한 번에 등록해요
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onSelectBarcode}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-4 text-left transition-transform active:scale-[0.98]"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-[#edf3ef] text-primary">
              <ScanBarcode size={20} />
            </div>
            <div>
              <p className="text-[14px] font-bold text-foreground">바코드 스캔</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                상품 바코드로 빠르게 불러와요
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onSelectReceipt}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-4 text-left transition-transform active:scale-[0.98]"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-[#edf3ef] text-primary">
              <Camera size={20} />
            </div>
            <div>
              <p className="text-[14px] font-bold text-foreground">영수증 촬영</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                영수증 사진으로 재료를 불러와요
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onSelectCookedDish}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-4 text-left transition-transform active:scale-[0.98]"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-[#fff4e8] text-[#c47a2c]">
              <CookingPot size={20} />
            </div>
            <div>
              <p className="text-[14px] font-bold text-foreground">
                만든 요리 등록
              </p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                완성된 음식을 남은 음식으로 남겨 둬요
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
