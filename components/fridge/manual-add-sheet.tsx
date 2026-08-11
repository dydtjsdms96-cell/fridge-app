"use client";

import { FormEvent, useMemo, useState } from "react";
import type { StorageZone } from "@/types/database";
import {
  defaultExpiresAt,
  isNoExpiryCategory,
  ymdInAppTz,
} from "@/lib/dday";
import { SaveCancelledError } from "@/lib/fridge-item-upsert";
import {
  BottomSheet,
  useBottomSheetClose,
} from "@/components/ui/bottom-sheet";
import { useImmersiveMode } from "@/components/layout/immersive-mode";

const ZONES: StorageZone[] = ["냉장", "냉동", "실온", "김치냉장고"];

export type ManualAddPayload = {
  name: string;
  quantity: number;
  unit: string | null;
  zone: StorageZone;
  sub_zone: string | null;
  category: string | null;
  expires_at: string | null;
  has_no_expiry: boolean;
  /** Set when registering from a barcode scan */
  barcode?: string | null;
};

type ManualAddSheetProps = {
  onClose: () => void;
  initialZone?: StorageZone;
  initialSubZone?: string | null;
  initialName?: string;
  initialCategory?: string | null;
  initialUnit?: string | null;
  initialHasNoExpiry?: boolean;
  barcode?: string | null;
  title?: string;
  onSubmit: (payload: ManualAddPayload) => Promise<void>;
};

export function ManualAddSheet(props: ManualAddSheetProps) {
  useImmersiveMode(true);
  return (
    <BottomSheet onClose={props.onClose} ariaLabel={props.title ?? "수동 등록"}>
      <ManualAddForm {...props} />
    </BottomSheet>
  );
}

function ManualAddForm({
  onSubmit,
  initialZone = "냉장",
  initialSubZone = null,
  initialName = "",
  initialCategory = null,
  initialUnit = "개",
  initialHasNoExpiry,
  barcode = null,
  title = "수동 등록",
}: ManualAddSheetProps) {
  const close = useBottomSheetClose();
  const today = useMemo(() => ymdInAppTz(), []);
  const [name, setName] = useState(initialName);
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState(initialUnit?.trim() || "개");
  const [zone, setZone] = useState<StorageZone>(initialZone);
  const [subZone] = useState<string | null>(initialSubZone);
  const [category, setCategory] = useState(initialCategory ?? "");
  const [hasNoExpiry, setHasNoExpiry] = useState(
    () => initialHasNoExpiry ?? isNoExpiryCategory(initialCategory),
  );
  const [expiresAt, setExpiresAt] = useState(() =>
    defaultExpiresAt(initialName, initialCategory, today),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyCategoryDefaults(nextName: string, nextCategory: string) {
    const noExpiry = isNoExpiryCategory(nextCategory);
    setHasNoExpiry(noExpiry);
    if (!noExpiry) {
      setExpiresAt(defaultExpiresAt(nextName, nextCategory || null, today));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("재료명을 입력해 주세요");
      return;
    }
    if (!hasNoExpiry && !expiresAt) {
      setError("유통기한을 입력해 주세요");
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        name: trimmedName,
        quantity: Number(quantity) || 1,
        unit: unit.trim() || null,
        zone,
        sub_zone: subZone?.trim() || null,
        category: category.trim() || null,
        expires_at: hasNoExpiry ? null : expiresAt,
        has_no_expiry: hasNoExpiry,
        barcode: barcode?.trim() || null,
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
      {barcode && (
        <p className="mb-4 font-mono text-[11px] text-muted-foreground">
          바코드 {barcode}
        </p>
      )}
      {!barcode && <div className="mb-3" />}

      <input type="hidden" name="barcode" value={barcode ?? ""} readOnly />

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
            재료명
          </span>
          <input
            required
            value={name}
            onChange={(e) => {
              const v = e.target.value;
              setName(v);
              if (!hasNoExpiry) {
                setExpiresAt(defaultExpiresAt(v, category || null, today));
              }
            }}
            placeholder="예: 계란"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-[14px] outline-none focus:border-primary"
          />
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
              수량
            </span>
            <input
              required
              type="number"
              min="0"
              step="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-[14px] outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
              단위
            </span>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="개"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-[14px] outline-none focus:border-primary"
            />
          </label>
        </div>

        <div>
          <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
            보관 구역
          </span>
          <div className="flex flex-wrap gap-2">
            {ZONES.map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZone(z)}
                disabled={Boolean(subZone)}
              className={`touch-target shrink-0 rounded-full px-3.5 py-2.5 text-[12px] font-medium disabled:opacity-70 ${
                    zone === z
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-muted-foreground"
                  }`}
              >
                {z}
              </button>
            ))}
          </div>
          {subZone && (
            <p className="mt-2 text-[12px] font-medium text-primary">
              하위 구역: {subZone}
            </p>
          )}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
            카테고리 (선택)
          </span>
          <input
            value={category}
            onChange={(e) => {
              const v = e.target.value;
              setCategory(v);
              applyCategoryDefaults(name, v);
            }}
            placeholder="예: 채소, 양념"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-[14px] outline-none focus:border-primary"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
            유통기한
          </span>
            <label className="mb-2 flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 py-2">
              <input
                type="checkbox"
                checked={hasNoExpiry}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setHasNoExpiry(checked);
                  if (!checked && !expiresAt) {
                    setExpiresAt(defaultExpiresAt(name, category || null, today));
                  }
                }}
                className="size-5 accent-primary"
              />
            <span className="text-[13px] font-medium text-foreground">
              유통기한 없음
            </span>
            <span className="text-[11px] text-muted-foreground">
              (조미료·양념 등)
            </span>
          </label>
          <input
            type="date"
            value={expiresAt}
            min={today}
            disabled={hasNoExpiry}
            required={!hasNoExpiry}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-[14px] outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            {hasNoExpiry
              ? "무기한으로 저장돼요. D-Day 알림 대상에서 제외됩니다."
              : "재료명·카테고리에 맞춰 기본값이 채워져요. 필요하면 수정하세요."}
          </p>
        </div>

        {error && (
          <p className="rounded-xl border border-status-urgent-border bg-status-urgent-bg px-3 py-2 text-[12px] text-status-urgent">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            onClick={close}
            className="rounded-xl bg-muted py-3 text-[13px] font-semibold"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-primary py-3 text-[13px] font-bold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "등록 중..." : "등록"}
          </button>
        </div>
      </div>
    </form>
  );
}
