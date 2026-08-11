"use client";

import { useState } from "react";
import {
  Box,
  Check,
  Minus,
  Plus,
  RotateCcw,
  Snowflake,
  Thermometer,
  Trash2,
} from "lucide-react";
import type { FridgeItem } from "@/types/database";
import {
  defaultExpiresAt,
  formatDDay,
  getDDay,
  getExpiryStatus,
  ymdInAppTz,
} from "@/lib/dday";
import { FoodIcon } from "@/components/ui/food-icon";
import { formatQuantity } from "@/lib/quantity";
import { EXPIRY_STYLES } from "@/components/home/expiry-styles";
import {
  BottomSheet,
  useBottomSheetClose,
} from "@/components/ui/bottom-sheet";

export type ConfirmMode = "consume" | "discard";

export type SaveExpiresPayload = {
  expires_at: string | null;
  has_no_expiry: boolean;
};

function ZoneIcon({ zone }: { zone: string }) {
  if (zone === "냉동") return <Snowflake size={10} />;
  if (zone === "냉장") return <Thermometer size={10} />;
  return <Box size={10} />;
}

function ConfirmDialog({
  mode,
  itemName,
  onConfirm,
  onCancel,
}: {
  mode: ConfirmMode;
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isDiscard = mode === "discard";
  return (
    <div
      className="absolute inset-0 z-[70] flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      <div className="w-full rounded-3xl bg-card p-6 shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: isDiscard ? "#FEF0ED" : "#EDF5F0" }}
        >
          {isDiscard ? (
            <Trash2 size={22} className="text-[#C04D38]" />
          ) : (
            <Check size={22} strokeWidth={2.5} className="text-[#3D7058]" />
          )}
        </div>
        <h3 className="mb-1.5 text-center text-[17px] font-bold text-foreground">
          {isDiscard ? "폐기 처리할까요?" : "전량 소진 처리할까요?"}
        </h3>
        <p className="mb-1 text-center text-[12px] text-muted-foreground">
          <span className="font-semibold text-foreground">{itemName}</span>
          {isDiscard ? "을(를) 폐기합니다." : "을(를) 소진 처리합니다."}
        </p>
        <p
          className={`mb-6 text-center text-[11px] font-medium ${
            isDiscard ? "text-[#C04D38]" : "text-muted-foreground"
          }`}
        >
          {isDiscard
            ? "⚠ 이 작업은 되돌릴 수 없어요."
            : "냉장고 목록에서 삭제됩니다."}
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl bg-muted py-3 text-[13px] font-semibold text-foreground transition-transform active:scale-95"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl py-3 text-[13px] font-bold transition-transform active:scale-95 ${
              isDiscard
                ? "bg-[#D95C45] text-white shadow-[0_4px_12px_rgba(217,92,69,0.35)]"
                : "bg-primary text-primary-foreground shadow-[0_4px_12px_rgba(61,112,88,0.3)]"
            }`}
          >
            {isDiscard ? "폐기하기" : "소진 처리"}
          </button>
        </div>
      </div>
    </div>
  );
}

type ItemDetailSheetProps = {
  item: FridgeItem;
  onClose: () => void;
  onSavePartial: (newQuantity: number) => void;
  onSaveExpires: (payload: SaveExpiresPayload) => void | Promise<void>;
  onRemove: (reason: ConfirmMode) => void;
  onRepurchase?: () => void;
};

export function ItemDetailSheet(props: ItemDetailSheetProps) {
  return (
    <BottomSheet onClose={props.onClose} ariaLabel={props.item.name}>
      <ItemDetailContent {...props} />
    </BottomSheet>
  );
}

function ItemDetailContent({
  item,
  onSavePartial,
  onSaveExpires,
  onRemove,
  onRepurchase,
}: ItemDetailSheetProps) {
  const close = useBottomSheetClose();
  const isArchived = item.status === "소진" || item.status === "폐기";
  const hasNoExpiryStored = Boolean(item.has_no_expiry);
  const dDay = hasNoExpiryStored ? null : getDDay(item.expires_at);
  const s = EXPIRY_STYLES[getExpiryStatus(dDay, hasNoExpiryStored)];
  const [usagePct, setUsagePct] = useState(0);
  const [memo, setMemo] = useState("");
  const [confirmMode, setConfirmMode] = useState<ConfirmMode | null>(null);
  const [hasNoExpiry, setHasNoExpiry] = useState(hasNoExpiryStored);
  const [expiresAt, setExpiresAt] = useState(
    () =>
      item.expires_at?.slice(0, 10) ??
      defaultExpiresAt(item.name, item.category),
  );
  const [savingExpires, setSavingExpires] = useState(false);
  const today = ymdInAppTz();
  const expiresDirty =
    hasNoExpiry !== hasNoExpiryStored ||
    (!hasNoExpiry &&
      (item.expires_at?.slice(0, 10) ?? "") !== expiresAt);

  const remainingValue = Math.max(
    0,
    Math.round(item.quantity * (1 - usagePct / 100) * 10) / 10,
  );
  const usedValue = Math.round((item.quantity - remainingValue) * 10) / 10;
  const quantityLabel = formatQuantity(item.quantity, item.unit);
  const addedLabel = item.created_at
    ? new Date(item.created_at).toLocaleDateString("ko-KR", {
        month: "numeric",
        day: "numeric",
      })
    : null;

  function handlePartialSave() {
    if (usagePct === 0) {
      close();
      return;
    }
    if (usagePct >= 100) {
      setConfirmMode("consume");
      return;
    }
    onSavePartial(remainingValue);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
          <div className="px-5 pt-3 pb-4">
            <div className="flex items-start gap-4">
              <div className="flex size-[68px] shrink-0 items-center justify-center rounded-2xl border border-border bg-background">
                <FoodIcon
                  name={item.name}
                  category={item.category}
                  itemType={item.item_type}
                  size={40}
                />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[20px] font-bold leading-tight text-foreground">
                  {item.name}
                </h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {item.category ?? "기타"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {(item.item_type === "완성요리" ||
                    item.category === "완성요리") && (
                    <span className="rounded-full bg-[#fff4e8] px-2 py-0.5 text-[10px] font-semibold text-[#c47a2c]">
                      완성요리
                    </span>
                  )}
                  <span
                    className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.badge}`}
                  >
                    <ZoneIcon zone={item.zone} />
                    <span className="ml-0.5">{item.zone}</span>
                  </span>
                  {isArchived ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        item.status === "폐기"
                          ? "bg-status-urgent-bg text-status-urgent"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.status}
                    </span>
                  ) : (
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${s.bg}`}
                    >
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: s.dot }}
                      />
                      <span
                        className={`${
                          hasNoExpiryStored || dDay === null
                            ? "text-[11px] font-semibold"
                            : "text-[11px] font-semibold tabular-nums"
                        } ${s.text}`}
                      >
                        {formatDDay(dDay, hasNoExpiryStored)}
                      </span>
                    </span>
                  )}
                  {addedLabel && (
                    <span className="text-[10px] text-muted-foreground">
                      {addedLabel} 등록
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {isArchived ? (
            <>
              <div className="mx-5 h-px bg-border" />
              <div className="px-5 py-4">
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {item.status === "폐기" ? "폐기" : "소진"}된 항목이에요.
                  같은 이름·구역·단위로 다시 등록할 수 있어요.
                </p>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  마지막 수량{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {quantityLabel}
                  </span>
                </p>
              </div>
              <div className="space-y-2.5 px-5 py-4 pb-10">
                {onRepurchase && (
                  <button
                    type="button"
                    onClick={onRepurchase}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[13px] font-bold text-primary-foreground shadow-[0_4px_16px_rgba(61,112,88,0.3)] transition-transform active:scale-[0.98]"
                  >
                    <RotateCcw size={16} strokeWidth={2.5} />
                    다시 구매
                  </button>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="w-full rounded-xl border border-border bg-muted py-3 text-[12px] font-semibold text-foreground transition-transform active:scale-[0.98]"
                >
                  닫기
                </button>
              </div>
            </>
          ) : (
            <>
          <div className="mx-5 h-px bg-border" />

          <div className="px-5 py-4">
            <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              유통기한
            </p>
            <label className="mb-2 flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
              <input
                type="checkbox"
                checked={hasNoExpiry}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setHasNoExpiry(checked);
                  if (!checked && !expiresAt) {
                    setExpiresAt(
                      defaultExpiresAt(item.name, item.category, today),
                    );
                  }
                }}
                className="size-4 accent-primary"
              />
              <span className="text-[13px] font-medium text-foreground">
                유통기한 없음
              </span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={expiresAt}
                min={today}
                disabled={hasNoExpiry}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-[14px] outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="button"
                disabled={
                  !expiresDirty ||
                  savingExpires ||
                  (!hasNoExpiry && !expiresAt)
                }
                onClick={async () => {
                  if (!hasNoExpiry && !expiresAt) return;
                  setSavingExpires(true);
                  try {
                    await onSaveExpires({
                      expires_at: hasNoExpiry ? null : expiresAt,
                      has_no_expiry: hasNoExpiry,
                    });
                  } finally {
                    setSavingExpires(false);
                  }
                }}
                className="shrink-0 rounded-xl bg-primary px-3.5 py-3 text-[12px] font-bold text-primary-foreground disabled:opacity-50"
              >
                {savingExpires ? "저장…" : "저장"}
              </button>
            </div>
            {!hasNoExpiryStored && !item.expires_at && !hasNoExpiry && (
              <p className="mt-1.5 text-[10px] text-status-warn">
                유통기한이 없어 기본값으로 채워 두었어요. 확인하고 저장해 주세요.
              </p>
            )}
            {hasNoExpiry && (
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                무기한으로 저장되며 임박·만료 알림 대상에서 제외돼요.
              </p>
            )}
          </div>

          <div className="mx-5 h-px bg-border" />

          <div className="px-5 py-4">
            <p className="mb-4 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              수량 조절
            </p>

            <div className="mb-3 flex items-center gap-3">
              <div className="flex-1 rounded-xl bg-muted/60 px-3 py-2.5 text-center">
                <p className="mb-0.5 text-[10px] text-muted-foreground">현재 보유</p>
                <p className="text-[17px] font-bold tabular-nums text-foreground">
                  {quantityLabel}
                </p>
              </div>
              <div className="text-lg text-muted-foreground/40">→</div>
              <div
                className={`flex-1 rounded-xl px-3 py-2.5 text-center transition-colors ${
                  usagePct === 100 ? "bg-[#FEF0ED]" : "bg-[#EDF5F0]"
                }`}
              >
                <p className="mb-0.5 text-[10px] text-muted-foreground">사용 후 잔량</p>
                <p
                  className={`text-[17px] font-bold tabular-nums transition-colors ${
                    usagePct === 100
                      ? "text-[#C04D38] line-through"
                      : "text-[#3D7058]"
                  }`}
                >
                  {usagePct === 100
                    ? `0${item.unit ?? ""}`
                    : formatQuantity(remainingValue, item.unit)}
                </p>
              </div>
            </div>

            <div
              className={`mb-4 flex items-center justify-between rounded-xl px-3.5 py-2 transition-opacity ${
                usagePct > 0 ? "opacity-100" : "opacity-0"
              }`}
              style={{ backgroundColor: "#EDF5F0" }}
            >
              <span className="text-[12px] font-medium text-[#3D7058]">
                이번에 사용하는 양
              </span>
              <span className="text-[13px] font-bold tabular-nums text-[#3D7058]">
                {formatQuantity(usedValue, item.unit)}
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={usagePct}
              onChange={(e) => setUsagePct(Number(e.target.value))}
              className="mb-2 w-full"
              style={{
                background: `linear-gradient(to right, #3D7058 0%, #3D7058 ${usagePct}%, #EDEBE6 ${usagePct}%, #EDEBE6 100%)`,
              }}
            />

            <div className="mb-4 flex justify-between">
              {[0, 25, 50, 75, 100].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setUsagePct(v)}
                  className={`px-1 text-[10px] font-medium transition-colors ${
                    usagePct === v
                      ? "font-bold text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {v}%
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
              <button
                type="button"
                onClick={() => setUsagePct(Math.max(0, usagePct - 10))}
                className="flex size-9 items-center justify-center rounded-xl border border-border bg-card shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-transform active:scale-95"
              >
                <Minus size={14} className="text-foreground" />
              </button>
              <div className="text-center">
                <span className="text-[28px] font-bold leading-none text-foreground tabular-nums">
                  {usagePct}
                </span>
                <span className="text-[14px] text-muted-foreground">%</span>
                <p className="mt-0.5 text-[10px] text-muted-foreground">사용</p>
              </div>
              <button
                type="button"
                onClick={() => setUsagePct(Math.min(100, usagePct + 10))}
                className="flex size-9 items-center justify-center rounded-xl border border-border bg-card shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-transform active:scale-95"
              >
                <Plus size={14} className="text-foreground" />
              </button>
            </div>
          </div>

          <div className="mx-5 h-px bg-border" />

          <div className="px-5 py-4">
            <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              메모 <span className="font-normal normal-case">(선택)</span>
            </p>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="조리 방법, 보관 팁 등을 기록해요"
              rows={2}
              className="w-full resize-none rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </div>

          <div className="mx-5 h-px bg-border" />

          <div className="space-y-2.5 px-5 py-4 pb-10">
            <button
              type="button"
              onClick={handlePartialSave}
              className="w-full rounded-2xl bg-primary py-3.5 text-[13px] font-bold text-primary-foreground shadow-[0_4px_16px_rgba(61,112,88,0.3)] transition-transform active:scale-[0.98]"
            >
              {usagePct === 0
                ? "변경 없이 닫기"
                : usagePct >= 100
                  ? "전량 소진으로 처리"
                  : `일부 사용 저장 (${usagePct}% 사용)`}
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmMode("consume")}
                className="rounded-xl border border-border bg-muted py-3 text-[12px] font-semibold text-foreground transition-transform active:scale-[0.98]"
              >
                전량 소진
              </button>
              <button
                type="button"
                onClick={() => setConfirmMode("discard")}
                className="rounded-xl border border-[#F5C4BB] py-3 text-[12px] font-semibold transition-transform active:scale-[0.98]"
                style={{ background: "#FEF0ED", color: "#C04D38" }}
              >
                폐기
              </button>
            </div>
          </div>
            </>
          )}
        </div>

        {confirmMode && (
          <ConfirmDialog
            mode={confirmMode}
            itemName={item.name}
            onConfirm={() => {
              onRemove(confirmMode);
              setConfirmMode(null);
            }}
            onCancel={() => setConfirmMode(null)}
          />
        )}
    </div>
  );
}
