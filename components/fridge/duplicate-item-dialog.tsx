"use client";

import { formatDDay, getDDay } from "@/lib/dday";
import { formatQuantity } from "@/lib/quantity";
import type { FridgeItem } from "@/types/database";
import type { IncomingFridgeItem } from "@/lib/fridge-item-upsert";

type DuplicateItemDialogProps = {
  existing: FridgeItem;
  incoming: IncomingFridgeItem;
  onMerge: () => void;
  onSeparate: () => void;
  onCancel: () => void;
};

function expiryText(item: {
  expires_at: string | null;
  has_no_expiry?: boolean | null;
}): string {
  if (item.has_no_expiry) return "무기한";
  return formatDDay(getDDay(item.expires_at), false);
}

export function DuplicateItemDialog({
  existing,
  incoming,
  onMerge,
  onSeparate,
  onCancel,
}: DuplicateItemDialogProps) {
  const qty = formatQuantity(existing.quantity, existing.unit);
  const expiry = expiryText(existing);
  const incomingExpiry = expiryText({
    expires_at: incoming.expires_at,
    has_no_expiry: incoming.has_no_expiry,
  });

  return (
    <div
      className="absolute inset-0 z-[90] flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-center text-[17px] font-bold text-foreground">
          이미 냉장고에 있어요
        </h3>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">{incoming.name}</span>
          이(가) {existing.zone}에 있어요.
          <br />
          합칠까요, 별도로 등록할까요?
        </p>

        <div className="mt-4 space-y-2 rounded-2xl border border-border bg-muted/50 px-3.5 py-3 text-[12px]">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">기존</span>
            <span className="text-right font-medium text-foreground">
              {qty} · {expiry}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">추가</span>
            <span className="text-right font-medium text-foreground">
              {formatQuantity(incoming.quantity, incoming.unit)} ·{" "}
              {incomingExpiry}
            </span>
          </div>
          <p className="pt-1 text-[11px] leading-snug text-muted-foreground">
            합치면 수량은 더하고, 유통기한은 더 이른 날짜(날짜 있는 쪽 우선)로
            맞춰요.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onSeparate}
            className="rounded-xl border border-border bg-muted py-3 text-[13px] font-semibold text-foreground transition-transform active:scale-95"
          >
            별도로 등록
          </button>
          <button
            type="button"
            onClick={onMerge}
            className="rounded-xl bg-primary py-3 text-[13px] font-bold text-primary-foreground shadow-[0_4px_12px_rgba(61,112,88,0.3)] transition-transform active:scale-95"
          >
            합치기
          </button>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 w-full py-2.5 text-[12px] font-medium text-muted-foreground"
        >
          취소
        </button>
      </div>
    </div>
  );
}
