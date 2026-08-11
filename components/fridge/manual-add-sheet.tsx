"use client";

import { FormEvent, useMemo, useState } from "react";
import type { StorageZone } from "@/types/database";
import { defaultExpiresAt, ymdInAppTz } from "@/lib/dday";

const ZONES: StorageZone[] = ["냉장", "냉동", "실온", "김치냉장고"];

type ManualAddSheetProps = {
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    quantity: number;
    unit: string | null;
    zone: StorageZone;
    category: string | null;
    expires_at: string;
  }) => Promise<void>;
};

export function ManualAddSheet({ onClose, onSubmit }: ManualAddSheetProps) {
  const today = useMemo(() => ymdInAppTz(), []);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("개");
  const [zone, setZone] = useState<StorageZone>("냉장");
  const [category, setCategory] = useState("");
  const [expiresAt, setExpiresAt] = useState(() =>
    defaultExpiresAt("", null, today),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refreshDefaultExpiry(nextName: string, nextCategory: string) {
    setExpiresAt(defaultExpiresAt(nextName, nextCategory || null, today));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("재료명을 입력해 주세요");
      return;
    }
    if (!expiresAt) {
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
        category: category.trim() || null,
        expires_at: expiresAt,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록에 실패했어요");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-end"
      style={{ background: "rgba(0,0,0,0.42)" }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[88%] w-full overflow-y-auto rounded-t-[28px] bg-card px-5 pt-3 pb-8 shadow-[0_-8px_48px_rgba(0,0,0,0.18)] scrollbar-hide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-muted" />
        </div>
        <h2 className="mb-4 text-[18px] font-bold text-foreground">수동 등록</h2>

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
                refreshDefaultExpiry(v, category);
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
                  className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium ${
                    zone === z
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-muted-foreground"
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
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
                refreshDefaultExpiry(name, v);
              }}
              placeholder="예: 채소"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-[14px] outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
              유통기한
            </span>
            <input
              required
              type="date"
              value={expiresAt}
              min={today}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-[14px] outline-none focus:border-primary"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              재료명에 맞춰 기본값이 채워져요. 필요하면 수정하세요.
            </p>
          </label>

          {error && (
            <p className="rounded-xl border border-status-urgent-border bg-status-urgent-bg px-3 py-2 text-[12px] text-status-urgent">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
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
    </div>
  );
}
