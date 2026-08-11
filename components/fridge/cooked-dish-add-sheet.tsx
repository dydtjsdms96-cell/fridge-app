"use client";

import { FormEvent, useMemo, useState } from "react";
import type { StorageZone } from "@/types/database";
import { addDaysYmd, ymdInAppTz } from "@/lib/dday";
import { SaveCancelledError } from "@/lib/fridge-item-upsert";
import {
  BottomSheet,
  useBottomSheetClose,
} from "@/components/ui/bottom-sheet";

const ZONES: StorageZone[] = ["냉장", "냉동", "실온", "김치냉장고"];

/** "2인분" → { quantity: 2, unit: "인분" }, "일부" → { quantity: 1, unit: "일부" } */
export function parseFreeQuantity(raw: string): {
  quantity: number;
  unit: string | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { quantity: 1, unit: "인분" };
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return { quantity: 1, unit: trimmed };
  const quantity = Number(match[1]) || 1;
  const unit = match[2]?.trim() || null;
  return { quantity, unit };
}

export type CookedDishPayload = {
  name: string;
  quantity: number;
  unit: string | null;
  zone: StorageZone;
  expires_at: string | null;
  has_no_expiry: boolean;
};

type CookedDishAddSheetProps = {
  onClose: () => void;
  onSubmit: (payload: CookedDishPayload) => Promise<void>;
  initialName?: string;
  initialQuantityLabel?: string;
  title?: string;
};

export function CookedDishAddSheet(props: CookedDishAddSheetProps) {
  return (
    <BottomSheet onClose={props.onClose} ariaLabel={props.title ?? "만든 요리 등록"}>
      <CookedDishForm {...props} />
    </BottomSheet>
  );
}

function CookedDishForm({
  onSubmit,
  initialName = "",
  initialQuantityLabel = "1인분",
  title = "만든 요리 등록",
}: CookedDishAddSheetProps) {
  const close = useBottomSheetClose();
  const today = useMemo(() => ymdInAppTz(), []);
  const [name, setName] = useState(initialName);
  const [quantityLabel, setQuantityLabel] = useState(initialQuantityLabel);
  const [zone, setZone] = useState<StorageZone>("냉장");
  const [hasNoExpiry, setHasNoExpiry] = useState(false);
  const [expiresAt, setExpiresAt] = useState(() => addDaysYmd(today, 3));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("요리 이름을 입력해 주세요");
      return;
    }
    if (!hasNoExpiry && !expiresAt) {
      setError("유통기한을 입력해 주세요");
      return;
    }
    const { quantity, unit } = parseFreeQuantity(quantityLabel);
    setLoading(true);
    try {
      await onSubmit({
        name: trimmedName,
        quantity,
        unit,
        zone,
        expires_at: hasNoExpiry ? null : expiresAt,
        has_no_expiry: hasNoExpiry,
      });
      close();
    } catch (err) {
      if (err instanceof SaveCancelledError) return;
      setError(err instanceof Error ? err.message : "등록에 실패했어요");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-8 scrollbar-hide"
    >
      <h2 className="mb-1 text-[18px] font-bold text-foreground">{title}</h2>
      <p className="mb-4 text-[12px] text-muted-foreground">
        만든 음식을 남은 음식으로 냉장고에 남겨 둬요
      </p>

      <label className="mb-3 block">
        <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
          요리 이름
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 된장찌개"
          className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-[14px] outline-none focus:border-primary"
          autoFocus={!initialName}
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
          수량
        </span>
        <input
          value={quantityLabel}
          onChange={(e) => setQuantityLabel(e.target.value)}
          placeholder="예: 2인분, 1통, 일부"
          className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-[14px] outline-none focus:border-primary"
        />
      </label>

      <div className="mb-3">
        <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
          보관 구역
        </span>
        <div className="flex flex-wrap gap-2">
          {ZONES.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZone(z)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all ${
                zone === z
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground"
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
          유통기한
        </span>
        <label className="mb-2 flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
          <input
            type="checkbox"
            checked={hasNoExpiry}
            onChange={(e) => {
              const checked = e.target.checked;
              setHasNoExpiry(checked);
              if (!checked && !expiresAt) {
                setExpiresAt(addDaysYmd(today, 3));
              }
            }}
            className="size-4 accent-primary"
          />
          <span className="text-[13px] font-medium text-foreground">
            유통기한 없음
          </span>
        </label>
        <input
          type="date"
          value={expiresAt}
          min={today}
          disabled={hasNoExpiry}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-[14px] outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
        />
        {!hasNoExpiry && (
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            기본값은 오늘부터 3일 후예요. 필요하면 바꿔 주세요.
          </p>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-xl border border-status-urgent-border bg-status-urgent-bg px-3 py-2 text-[12px] text-status-urgent">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-primary py-3.5 text-[13px] font-bold text-primary-foreground shadow-[0_4px_16px_rgba(61,112,88,0.3)] transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? "저장 중…" : "냉장고에 넣기"}
      </button>
    </form>
  );
}
