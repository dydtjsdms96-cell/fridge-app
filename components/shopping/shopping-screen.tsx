"use client";

import { useMemo, useState } from "react";
import { Check, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatIngredientAmount } from "@/lib/format-amount";
import type { ShoppingList, ShoppingListSource } from "@/types/database";
import { AddShoppingSheet } from "@/components/shopping/add-shopping-sheet";
import { SwipeDeleteRow } from "@/components/settings/swipe-delete-row";
import { EmptyState } from "@/components/ui/empty-state";

const SOURCE_LABEL: Record<ShoppingListSource, string> = {
  자동_식단: "식단",
  자동_소진: "소진",
  수동: "수동",
};

type ShoppingScreenProps = {
  initialItems: ShoppingList[];
  userId: string;
};

export function ShoppingScreen({ initialItems, userId }: ShoppingScreenProps) {
  const [items, setItems] = useState(initialItems);
  const [showAdd, setShowAdd] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const pending = useMemo(
    () => items.filter((i) => i.checked !== true),
    [items],
  );
  const done = useMemo(
    () => items.filter((i) => i.checked === true),
    [items],
  );

  async function toggleChecked(item: ShoppingList) {
    if (togglingId || deletingId) return;
    const next = !(item.checked === true);
    setTogglingId(item.id);
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, checked: next } : i)),
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("shopping_list")
      .update({ checked: next })
      .eq("id", item.id);

    if (error) {
      console.error("[shopping] toggle error:", error.message);
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, checked: item.checked } : i,
        ),
      );
    }
    setTogglingId(null);
  }

  async function deleteItem(item: ShoppingList) {
    if (deletingId || clearing) return;
    setDeletingId(item.id);
    const prev = items;
    setItems((list) => list.filter((i) => i.id !== item.id));

    const supabase = createClient();
    const { error } = await supabase
      .from("shopping_list")
      .delete()
      .eq("id", item.id);

    if (error) {
      console.error("[shopping] delete error:", error.message);
      setItems(prev);
    }
    setDeletingId(null);
  }

  async function clearCompleted() {
    if (clearing || done.length === 0) return;
    setClearing(true);
    const prev = items;
    setItems((list) => list.filter((i) => i.checked !== true));
    setConfirmClear(false);

    const supabase = createClient();
    const { error } = await supabase
      .from("shopping_list")
      .delete()
      .eq("user_id", userId)
      .eq("checked", true);

    if (error) {
      console.error("[shopping] clear completed error:", error.message);
      setItems(prev);
    }
    setClearing(false);
  }

  async function addManual(payload: {
    item_name: string;
    quantity: number;
    unit: string | null;
  }) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shopping_list")
      .insert({
        user_id: userId,
        item_name: payload.item_name,
        quantity: payload.quantity,
        unit: payload.unit,
        source: "수동",
        checked: false,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    setItems((prev) => [data as ShoppingList, ...prev]);
  }

  function openCoupangBundle() {
    if (pending.length === 0) return;
    const query = pending.map((i) => i.item_name).join(" ");
    const url = `https://www.coupang.com/np/search?q=${encodeURIComponent(query)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4 scrollbar-hide sm:px-6 lg:px-8">
        <div className="mb-0.5 flex items-start justify-between gap-3">
          <h1 className="text-[22px] leading-[27.5px] font-bold text-foreground">
            쇼핑 목록
          </h1>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground/70 shadow-[0_1px_6px_rgba(0,0,0,0.06)] transition-transform active:scale-95"
            aria-label="수동 추가"
          >
            <Plus size={17} strokeWidth={2.5} />
          </button>
        </div>
        <p className="mb-5 text-[11px] leading-[16.5px] text-muted-foreground">
          <span className="min-w-[1.5ch] font-medium text-foreground tabular-nums">
            {pending.length}
          </span>
          개 남음
        </p>

        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {pending.map((item) => (
            <ShoppingRow
              key={item.id}
              item={item}
              checked={false}
              onToggle={() => toggleChecked(item)}
            />
          ))}
          {pending.length === 0 && (
            <EmptyState
              variant="section"
              title="살 게 없어요. +로 추가해 보세요"
            />
          )}
        </div>

        {done.length > 0 && (
          <div className="pt-1">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold tracking-[0.275px] text-muted-foreground uppercase">
                완료
              </p>
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                disabled={clearing}
                className="text-[11px] font-semibold text-muted-foreground underline-offset-2 transition-colors hover:text-status-urgent hover:underline disabled:opacity-50"
              >
                완료 항목 비우기
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {done.map((item) => (
                <SwipeDeleteRow
                  key={item.id}
                  disabled={deletingId === item.id || clearing}
                  contentClassName="bg-transparent"
                  onDelete={() => void deleteItem(item)}
                >
                  <ShoppingRow
                    item={item}
                    checked
                    onToggle={() => toggleChecked(item)}
                  />
                </SwipeDeleteRow>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={openCoupangBundle}
          disabled={pending.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[13px] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
          style={{
            backgroundColor: "#C00000",
            boxShadow:
              pending.length > 0 ? "0 4px 16px rgba(192,0,0,0.3)" : "none",
          }}
        >
          <ShoppingBag size={15} className="text-white" aria-hidden />
          쿠팡에서 구매하기
          <span className="text-[12px] font-medium tabular-nums opacity-80">
            ({pending.length}개)
          </span>
        </button>
      </div>

      {showAdd && (
        <AddShoppingSheet
          onClose={() => setShowAdd(false)}
          onSubmit={addManual}
        />
      )}

      {confirmClear && (
        <ClearCompletedDialog
          count={done.length}
          busy={clearing}
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => void clearCompleted()}
        />
      )}
    </div>
  );
}

function ClearCompletedDialog({
  count,
  busy,
  onCancel,
  onConfirm,
}: {
  count: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-[70] flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "#FEF0ED" }}
        >
          <Trash2 size={22} className="text-[#C04D38]" />
        </div>
        <h3 className="mb-1.5 text-center text-[17px] font-bold text-foreground">
          완료된 {count}개 항목을 모두 삭제할까요?
        </h3>
        <p className="mb-6 text-center text-[11px] font-medium text-[#C04D38]">
          ⚠ 이 작업은 되돌릴 수 없어요.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl bg-muted py-3 text-[13px] font-semibold text-foreground transition-transform active:scale-95 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl bg-[#D95C45] py-3 text-[13px] font-bold text-white shadow-[0_4px_12px_rgba(217,92,69,0.35)] transition-transform active:scale-95 disabled:opacity-50"
          >
            {busy ? "삭제 중…" : "모두 삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShoppingRow({
  item,
  checked,
  onToggle,
}: {
  item: ShoppingList;
  checked: boolean;
  onToggle: () => void;
}) {
  const amount = formatIngredientAmount(
    item.quantity,
    item.unit,
    item.item_name,
  );
  const sourceLabel =
    item.source && item.source in SOURCE_LABEL
      ? SOURCE_LABEL[item.source]
      : null;

  return (
    <div
      className={`flex h-full items-center gap-3 rounded-[20px] px-4 py-3.5 ${
        checked
          ? "bg-muted/50"
          : "border border-border bg-card shadow-[0_1px_6px_rgba(0,0,0,0.04)]"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`flex size-5 shrink-0 items-center justify-center rounded-full transition-colors ${
          checked
            ? "bg-primary"
            : "border-2 border-muted-foreground/30 hover:border-primary"
        }`}
        aria-label={checked ? "미완료로 되돌리기" : "완료 처리"}
        aria-pressed={checked}
      >
        {checked && (
          <Check size={10} className="text-primary-foreground" strokeWidth={3} />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`text-[13px] leading-[19.5px] ${
              checked
                ? "font-normal text-muted-foreground line-through"
                : "font-medium text-foreground"
            }`}
          >
            {item.item_name}
            {amount ? ` ${amount}` : ""}
          </span>
          {sourceLabel && (
            <span
              className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${
                item.source === "자동_식단"
                  ? "bg-secondary text-primary"
                  : item.source === "자동_소진"
                    ? "bg-status-warn-bg text-status-warn"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {sourceLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
