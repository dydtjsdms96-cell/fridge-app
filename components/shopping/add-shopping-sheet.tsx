"use client";

import { FormEvent, useState } from "react";
import {
  BottomSheet,
  useBottomSheetClose,
} from "@/components/ui/bottom-sheet";

type AddShoppingSheetProps = {
  onClose: () => void;
  onSubmit: (payload: {
    item_name: string;
    quantity: number;
    unit: string | null;
  }) => Promise<void>;
};

export function AddShoppingSheet(props: AddShoppingSheetProps) {
  return (
    <BottomSheet onClose={props.onClose} ariaLabel="수동 추가">
      <AddShoppingForm {...props} />
    </BottomSheet>
  );
}

function AddShoppingForm({ onSubmit }: AddShoppingSheetProps) {
  const close = useBottomSheetClose();
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
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "추가에 실패했어요");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-8 scrollbar-hide"
    >
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
          onClick={close}
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
  );
}
