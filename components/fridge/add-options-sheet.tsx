"use client";

import { Camera, CookingPot, Keyboard, Mic, ScanBarcode, X } from "lucide-react";
import type { ReactNode } from "react";
import {
  BottomSheet,
  SHEET_DURATION_MS,
  useBottomSheetClose,
} from "@/components/ui/bottom-sheet";

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
    <BottomSheet onClose={onClose} ariaLabel="재료 등록 방법" showHandle>
      <AddOptionsBody
        onSelectManual={onSelectManual}
        onSelectVoice={onSelectVoice}
        onSelectReceipt={onSelectReceipt}
        onSelectBarcode={onSelectBarcode}
        onSelectCookedDish={onSelectCookedDish}
      />
    </BottomSheet>
  );
}

function AddOptionsBody({
  onSelectManual,
  onSelectVoice,
  onSelectReceipt,
  onSelectBarcode,
  onSelectCookedDish,
}: Omit<AddOptionsSheetProps, "onClose">) {
  const close = useBottomSheetClose();

  function pick(fn: () => void) {
    close();
    window.setTimeout(fn, SHEET_DURATION_MS);
  }

  return (
    <div className="px-5 pt-1 pb-8">
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
          onClick={close}
          className="touch-target flex size-11 items-center justify-center rounded-full border border-border bg-background"
          aria-label="닫기"
        >
          <X size={16} className="text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-2.5">
        <OptionButton
          icon={<Keyboard size={20} />}
          iconClass="bg-secondary text-primary"
          title="수동 입력"
          subtitle="이름·수량·보관 구역을 직접 입력해요"
          onClick={() => pick(onSelectManual)}
        />
        <OptionButton
          icon={<Mic size={20} />}
          iconClass="bg-primary text-primary-foreground"
          title="음성 등록"
          subtitle="말하면서 여러 재료를 한 번에 등록해요"
          onClick={() => pick(onSelectVoice)}
        />
        <OptionButton
          icon={<ScanBarcode size={20} />}
          iconClass="bg-[#edf3ef] text-primary"
          title="바코드 스캔"
          subtitle="상품 바코드로 빠르게 불러와요"
          onClick={() => pick(onSelectBarcode)}
        />
        <OptionButton
          icon={<Camera size={20} />}
          iconClass="bg-[#edf3ef] text-primary"
          title="영수증 촬영"
          subtitle="영수증 사진으로 재료를 불러와요"
          onClick={() => pick(onSelectReceipt)}
        />
        <OptionButton
          icon={<CookingPot size={20} />}
          iconClass="bg-[#fff4e8] text-[#c47a2c]"
          title="만든 요리 등록"
          subtitle="완성된 음식을 남은 음식으로 남겨 둬요"
          onClick={() => pick(onSelectCookedDish)}
        />
      </div>
    </div>
  );
}

function OptionButton({
  icon,
  iconClass,
  title,
  subtitle,
  onClick,
}: {
  icon: ReactNode;
  iconClass: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-4 text-left transition-transform active:scale-[0.98]"
    >
      <div
        className={`flex size-11 items-center justify-center rounded-xl ${iconClass}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-[14px] font-bold text-foreground">{title}</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>
      </div>
    </button>
  );
}
