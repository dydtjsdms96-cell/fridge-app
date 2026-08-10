"use client";

import { FormEvent, useState } from "react";

type AddShoppingSheetProps = {
  onClose: () => void;
  onSubmit: (payload: {
    item_name: string;
    quantity: number;
    unit: string | null;
  }) => Promise<void>;
};

export function AddShoppingSheet({ onClose, onSubmit }: AddShoppingSheetProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("개");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const item_name = name.trim();
    if (!item_name) {
      setError("재료명을 입력해 주세요");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onSubmit({
        item_name,
        quantity: Number(quantity) || 1,
        unit: unit.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "추가에 실패했어요");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-end"
      style={{ background: "rgba(0,0,0,0.42)" }}
      onClick={onClose}
      role="presentation"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full rounded-t-[28px] bg-card px-5 pt-3 pb-8 shadow-[0_-8px_48px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-muted" />
        </div>
        <h2 className="mb-4 text-[18px] font-bold text-foreground">수동 추가</h2>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
              재료명
            </span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 대파"
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
        </div>

        {error && (
          <p className="mt-3 text-[12px] font-medium text-status-urgent">{error}</p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-muted py-3 text-[13px] font-semibold text-foreground transition-transform active:scale-95"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-primary py-3 text-[13px] font-semibold text-primary-foreground transition-transform active:scale-95 disabled:opacity-60"
          >
            {loading ? "추가 중…" : "추가"}
          </button>
        </div>
      </form>
    </div>
  );
}
