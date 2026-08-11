"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Mic, X } from "lucide-react";
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

const DEMO_TAGS = ["계란", "두부", "대파", "닭고기"];

const WAVE_BARS = [18, 32, 48, 28, 56, 36, 44, 24, 52, 30, 40, 22];

export type VoiceRegisterItem = {
  name: string;
  quantity: number;
  unit: string;
  zone: StorageZone;
  category: string;
  expires_at: string | null;
  has_no_expiry: boolean;
};

type DraftItem = {
  name: string;
  quantity: number;
  unit: string;
  zone: StorageZone;
  category: string;
  expires_at: string;
  has_no_expiry: boolean;
};

type VoiceRegisterFlowProps = {
  onClose: () => void;
  onRegister: (items: VoiceRegisterItem[]) => Promise<void>;
};

function draftFromName(name: string, today: string): DraftItem {
  const category = "기타";
  const noExpiry = isNoExpiryCategory(category);
  return {
    name,
    quantity: 1,
    unit: "개",
    zone: "냉장",
    category,
    has_no_expiry: noExpiry,
    expires_at: defaultExpiresAt(name, category, today),
  };
}

export function VoiceRegisterFlow({
  onClose,
  onRegister,
}: VoiceRegisterFlowProps) {
  const today = ymdInAppTz();
  const [step, setStep] = useState<"listen" | "review">("listen");
  const [revealedTags, setRevealedTags] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);

  useEffect(() => {
    if (step !== "listen") return;
    setRevealedTags([]);
    let i = 0;
    const timer = setInterval(() => {
      if (i < DEMO_TAGS.length) {
        const tag = DEMO_TAGS[i];
        setRevealedTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
        i += 1;
      } else {
        clearInterval(timer);
      }
    }, 900);
    return () => clearInterval(timer);
  }, [step]);

  function goToReview() {
    if (revealedTags.length === 0) return;
    setDrafts(revealedTags.map((name) => draftFromName(name, today)));
    setStep("review");
  }

  if (step === "review") {
    return (
      <BottomSheet onClose={onClose} ariaLabel="인식 결과 확인">
        <VoiceReviewPanel
          drafts={drafts}
          setDrafts={setDrafts}
          today={today}
          onBack={() => setStep("listen")}
          onRegister={onRegister}
        />
      </BottomSheet>
    );
  }

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col"
      style={{ background: "#0B1A10" }}
    >
      <div className="flex h-12 shrink-0 items-center justify-end px-7 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 text-[13px] font-medium text-white/60"
        >
          <X size={15} />
          취소
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <div className="flex items-end gap-[5px]" style={{ height: 60 }}>
          {WAVE_BARS.map((maxH, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: 5,
                height: maxH,
                backgroundColor: "#3D7058",
                transformOrigin: "bottom center",
                animation: `voiceBar ${0.65 + i * 0.04}s ease-in-out ${i * 0.075}s infinite`,
              }}
            />
          ))}
        </div>

        <div className="relative flex items-center justify-center">
          <div
            className="absolute size-20 rounded-full"
            style={{
              background: "rgba(61,112,88,0.35)",
              animation: "voicePulseRing 1.6s ease-out infinite",
            }}
          />
          <div className="relative flex size-20 items-center justify-center rounded-full bg-[#3D7058] shadow-[0_0_40px_rgba(61,112,88,0.55)]">
            <Mic size={28} className="text-white" />
          </div>
        </div>

        <p className="text-[15px] font-medium text-white/70">
          {revealedTags.length === 0
            ? "재료를 말씀해 주세요..."
            : "계속 말씀해 주세요"}
        </p>
      </div>

      <div className="px-6 pb-8">
        <p className="mb-3 text-[12px] text-white/40">인식된 재료</p>
        <div className="mb-5 flex min-h-[36px] flex-wrap gap-2">
          {revealedTags.length === 0 ? (
            <p className="text-[13px] text-white/25 italic">
              아직 인식된 재료가 없어요
            </p>
          ) : (
            revealedTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[#2D5543] px-3.5 py-1.5 text-[13px] font-medium text-white"
                style={{ animation: "voiceTagIn 0.35s ease-out" }}
              >
                {tag}
              </span>
            ))
          )}
        </div>
        <button
          type="button"
          disabled={revealedTags.length === 0}
          onClick={goToReview}
          className="w-full rounded-2xl bg-primary py-3.5 text-[14px] font-bold text-primary-foreground disabled:opacity-40"
        >
          {`확인하기 (${revealedTags.length}개 인식됨)`}
        </button>
      </div>
    </div>
  );
}

function VoiceReviewPanel({
  drafts,
  setDrafts,
  today,
  onBack,
  onRegister,
}: {
  drafts: DraftItem[];
  setDrafts: Dispatch<SetStateAction<DraftItem[]>>;
  today: string;
  onBack: () => void;
  onRegister: (items: VoiceRegisterItem[]) => Promise<void>;
}) {
  const close = useBottomSheetClose();
  const [loading, setLoading] = useState(false);

  function updateDraft(index: number, patch: Partial<DraftItem>) {
    setDrafts((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        if (patch.category !== undefined) {
          if (isNoExpiryCategory(patch.category)) {
            next.has_no_expiry = true;
          }
          if (!next.has_no_expiry) {
            next.expires_at = defaultExpiresAt(
              next.name,
              next.category,
              today,
            );
          }
        }
        return next;
      }),
    );
  }

  async function handleRegister() {
    if (drafts.length === 0) return;
    setLoading(true);
    try {
      await onRegister(
        drafts.map((d) => ({
          name: d.name,
          quantity: d.quantity,
          unit: d.unit,
          zone: d.zone,
          category: d.category,
          has_no_expiry: d.has_no_expiry,
          expires_at: d.has_no_expiry ? null : d.expires_at,
        })),
      );
      close();
    } catch (err) {
      if (err instanceof SaveCancelledError) return;
      throw err;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between px-5 pt-1 pb-3">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            음성 등록
          </p>
          <h2 className="text-[18px] font-bold text-foreground">
            인식 결과 확인
          </h2>
        </div>
        <button
          type="button"
          onClick={close}
          className="flex size-9 items-center justify-center rounded-full border border-border bg-card"
          aria-label="닫기"
        >
          <X size={16} className="text-muted-foreground" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-4 scrollbar-hide">
        {drafts.map((item, index) => (
          <div
            key={`${item.name}-${index}`}
            className="rounded-2xl border border-border bg-card p-3.5 shadow-[0_1px_6px_rgba(0,0,0,0.04)]"
          >
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <p className="text-[15px] font-bold text-foreground">{item.name}</p>
              <input
                value={item.category}
                onChange={(e) =>
                  updateDraft(index, { category: e.target.value })
                }
                placeholder="카테고리"
                className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] outline-none focus:border-primary"
              />
            </div>
            <label className="mb-2 flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={item.has_no_expiry}
                onChange={(e) =>
                  updateDraft(index, {
                    has_no_expiry: e.target.checked,
                    expires_at: e.target.checked
                      ? item.expires_at
                      : defaultExpiresAt(item.name, item.category, today),
                  })
                }
                className="size-4 accent-primary"
              />
              <span className="text-[12px] font-medium text-foreground">
                유통기한 없음
              </span>
            </label>
            <input
              type="date"
              value={item.expires_at}
              min={today}
              disabled={item.has_no_expiry}
              onChange={(e) =>
                updateDraft(index, { expires_at: e.target.value })
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            />
          </div>
        ))}
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2.5 px-5 pt-2 pb-8">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl bg-muted py-3.5 text-[13px] font-semibold"
        >
          다시 인식
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={handleRegister}
          className="rounded-xl bg-primary py-3.5 text-[13px] font-bold text-primary-foreground disabled:opacity-50"
        >
          {loading ? "등록 중..." : `${drafts.length}개 등록`}
        </button>
      </div>
    </div>
  );
}
