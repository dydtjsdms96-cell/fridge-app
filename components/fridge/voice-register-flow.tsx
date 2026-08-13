"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Mic, MicOff, X } from "lucide-react";
import type { StorageZone } from "@/types/database";
import {
  defaultExpiresAt,
  isNoExpiryCategory,
  ymdInAppTz,
} from "@/lib/dday";
import { parseVoiceUtterance } from "@/lib/parse-voice-utterance";
import {
  enrichParsedWithIngredientRef,
  fetchIngredientRefs,
  type EnrichedVoiceDraft,
} from "@/lib/ingredient-ref-lookup";
import {
  createSpeechSession,
  isSpeechSupportedEnvironment,
  type SpeechErrorKind,
  type SpeechSession,
} from "@/lib/speech-recognition";
import { SaveCancelledError } from "@/lib/fridge-item-upsert";
import {
  BottomSheet,
  useBottomSheetClose,
} from "@/components/ui/bottom-sheet";
import { useImmersiveMode } from "@/components/layout/immersive-mode";

const WAVE_BARS = [18, 32, 48, 28, 56, 36, 44, 24, 52, 30, 40, 22];

const ZONES: StorageZone[] = ["냉장", "냉동", "실온", "김치냉장고"];

export type VoiceRegisterItem = {
  name: string;
  quantity: number;
  unit: string;
  zone: StorageZone;
  category: string;
  expires_at: string | null;
  has_no_expiry: boolean;
};

type DraftItem = EnrichedVoiceDraft;

type VoiceRegisterFlowProps = {
  onClose: () => void;
  onRegister: (items: VoiceRegisterItem[]) => Promise<void>;
  /** Skip listen and open review with parsed items (deep link). */
  initialUtterance?: string;
  /** Permission / unsupported / failure → open manual add. */
  onFallbackToManual?: () => void;
};

function draftsFromUtterance(
  utterance: string,
  today: string,
  refs: Awaited<ReturnType<typeof fetchIngredientRefs>>,
): DraftItem[] {
  return parseVoiceUtterance(utterance).map((item) =>
    enrichParsedWithIngredientRef(item, refs, today),
  );
}

function tagLabelsFromUtterance(utterance: string): string[] {
  return parseVoiceUtterance(utterance).map((i) => {
    const qty =
      i.quantity !== 1 || i.unit !== "개"
        ? ` ${i.quantity}${i.unit}`
        : "";
    return `${i.name}${qty}`;
  });
}

export function VoiceRegisterFlow({
  onClose,
  onRegister,
  initialUtterance,
  onFallbackToManual,
}: VoiceRegisterFlowProps) {
  useImmersiveMode(true);
  const today = ymdInAppTz();
  const sessionRef = useRef<SpeechSession | null>(null);
  const refsRef = useRef<Awaited<ReturnType<typeof fetchIngredientRefs>>>([]);

  const [step, setStep] = useState<"listen" | "review">(
    initialUtterance?.trim() ? "review" : "listen",
  );
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState(initialUtterance?.trim() ?? "");
  const [revealedTags, setRevealedTags] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [sourceUtterance, setSourceUtterance] = useState<string | null>(
    initialUtterance?.trim() || null,
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<SpeechErrorKind | null>(null);
  const [busyReview, setBusyReview] = useState(false);

  // Load ingredient_ref + hydrate deep-link utterance
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const refs = await fetchIngredientRefs();
      if (cancelled) return;
      refsRef.current = refs;
      const seed = initialUtterance?.trim();
      if (seed) {
        const next = draftsFromUtterance(seed, today, refs);
        setDrafts(next);
        setRevealedTags(tagLabelsFromUtterance(seed));
        setStep(next.length > 0 ? "review" : "listen");
        if (next.length === 0) {
          setStatusMsg("문장에서 재료를 찾지 못했어요. 다시 말씀해 주세요.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialUtterance, today]);

  // Live tags from transcript
  useEffect(() => {
    if (step !== "listen") return;
    setRevealedTags(transcript.trim() ? tagLabelsFromUtterance(transcript) : []);
  }, [transcript, step]);

  useEffect(() => {
    return () => {
      void sessionRef.current?.destroy();
      sessionRef.current = null;
    };
  }, []);

  function fallback(kind: SpeechErrorKind, message: string) {
    setErrorKind(kind);
    setStatusMsg(message);
    setListening(false);
  }

  function ensureSession(): SpeechSession {
    if (sessionRef.current) return sessionRef.current;
    sessionRef.current = createSpeechSession({
      onPartial: (text) => {
        setTranscript(text);
        setStatusMsg(null);
        setErrorKind(null);
      },
      onFinal: (text) => {
        if (text.trim()) setTranscript(text);
      },
      onError: (kind, message) => fallback(kind, message),
      onListeningChange: (on) => setListening(on),
    });
    return sessionRef.current;
  }

  async function toggleListen() {
    if (!isSpeechSupportedEnvironment()) {
      fallback(
        "unsupported",
        "이 환경에서는 음성 인식을 지원하지 않아요. 수동 등록을 이용해 주세요.",
      );
      return;
    }
    const session = ensureSession();
    if (listening) {
      const finalText = await session.stop();
      if (finalText.trim()) setTranscript(finalText);
      return;
    }
    setStatusMsg(null);
    setErrorKind(null);
    await session.start();
  }

  async function goToReview() {
    let latest = transcript.trim();
    if (!latest && !listening) return;
    setBusyReview(true);
    try {
      if (listening) {
        const finalText = await sessionRef.current?.stop();
        if (finalText?.trim()) {
          latest = finalText.trim();
          setTranscript(latest);
        }
      }
      latest = latest || transcript.trim();
      if (!latest) return;
      if (!refsRef.current.length) {
        refsRef.current = await fetchIngredientRefs();
      }
      const next = draftsFromUtterance(latest, today, refsRef.current);
      if (next.length === 0) {
        setStatusMsg("문장에서 재료를 찾지 못했어요. 다시 말씀해 주세요.");
        return;
      }
      setSourceUtterance(latest);
      setDrafts(next);
      setStep("review");
    } finally {
      setBusyReview(false);
    }
  }

  function handleFallbackManual() {
    void sessionRef.current?.destroy();
    sessionRef.current = null;
    onClose();
    onFallbackToManual?.();
  }

  if (step === "review") {
    return (
      <BottomSheet onClose={onClose} ariaLabel="인식 결과 확인">
        <VoiceReviewPanel
          drafts={drafts}
          setDrafts={setDrafts}
          today={today}
          sourceUtterance={sourceUtterance}
          onBack={() => {
            setStep("listen");
            setStatusMsg(null);
            setErrorKind(null);
          }}
          onRegister={onRegister}
        />
      </BottomSheet>
    );
  }

  const canConfirm = revealedTags.length > 0 && transcript.trim().length > 0;

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col"
      style={{ background: "#0B1A10" }}
    >
      <div className="flex h-12 shrink-0 items-center justify-end px-7 pt-4">
        <button
          type="button"
          onClick={() => {
            void sessionRef.current?.destroy();
            onClose();
          }}
          className="touch-target flex items-center gap-1.5 px-2 text-[13px] font-medium text-white/60"
        >
          <X size={15} />
          취소
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        {listening && (
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
        )}

        <button
          type="button"
          onClick={() => void toggleListen()}
          className="relative flex items-center justify-center"
          aria-label={listening ? "녹음 중지" : "녹음 시작"}
        >
          {listening && (
            <div
              className="absolute size-20 rounded-full"
              style={{
                background: "rgba(61,112,88,0.35)",
                animation: "voicePulseRing 1.6s ease-out infinite",
              }}
            />
          )}
          <div
            className={`relative flex size-20 items-center justify-center rounded-full shadow-[0_0_40px_rgba(61,112,88,0.55)] ${
              listening ? "bg-[#3D7058]" : "bg-[#2D5543]"
            }`}
          >
            {listening ? (
              <MicOff size={28} className="text-white" />
            ) : (
              <Mic size={28} className="text-white" />
            )}
          </div>
        </button>

        <div className="w-full max-w-sm text-center">
          <p className="text-[15px] font-medium text-white/70">
            {listening
              ? "듣고 있어요… 마이크를 다시 누르면 멈춰요"
              : "마이크를 눌러 재료를 말씀해 주세요"}
          </p>
          {transcript.trim() ? (
            <p className="mt-3 rounded-xl bg-white/5 px-3 py-2.5 text-left text-[13px] leading-relaxed text-white/90">
              {transcript}
            </p>
          ) : null}
          {statusMsg && (
            <p
              className={`mt-3 text-[12px] leading-relaxed ${
                errorKind ? "text-[#f0b4a0]" : "text-white/50"
              }`}
            >
              {statusMsg}
            </p>
          )}
        </div>
      </div>

      <div className="px-6 pb-8">
        <p className="mb-3 text-[12px] text-white/40">인식된 재료</p>
        <div className="mb-5 flex min-h-[36px] flex-wrap gap-2">
          {revealedTags.length === 0 ? (
            <p className="text-[13px] text-white/25 italic">
              아직 인식된 재료가 없어요
            </p>
          ) : (
            revealedTags.map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="rounded-full bg-[#2D5543] px-3.5 py-1.5 text-[13px] font-medium text-white"
                style={{ animation: "voiceTagIn 0.35s ease-out" }}
              >
                {tag}
              </span>
            ))
          )}
        </div>

        {errorKind && onFallbackToManual ? (
          <button
            type="button"
            onClick={handleFallbackManual}
            className="mb-2.5 w-full rounded-2xl border border-white/15 bg-white/5 py-3.5 text-[14px] font-semibold text-white/85"
          >
            수동 등록으로 추가하기
          </button>
        ) : null}

        <button
          type="button"
          disabled={!canConfirm || busyReview}
          onClick={() => void goToReview()}
          className="w-full rounded-2xl bg-primary py-3.5 text-[14px] font-bold text-primary-foreground disabled:opacity-40"
        >
          {busyReview
            ? "준비 중..."
            : `확인하기 (${revealedTags.length}개 인식됨)`}
        </button>
      </div>
    </div>
  );
}

function VoiceReviewPanel({
  drafts,
  setDrafts,
  today,
  sourceUtterance,
  onBack,
  onRegister,
}: {
  drafts: DraftItem[];
  setDrafts: Dispatch<SetStateAction<DraftItem[]>>;
  today: string;
  sourceUtterance: string | null;
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
        <div className="min-w-0 flex-1 pr-2">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            음성 등록
          </p>
          <h2 className="text-[18px] font-bold text-foreground">
            인식 결과 확인
          </h2>
          {sourceUtterance && (
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              “{sourceUtterance}”
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={close}
          className="touch-target flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card"
          aria-label="닫기"
        >
          <X size={16} className="text-muted-foreground" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-4 scrollbar-hide">
        {drafts.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-muted-foreground">
            인식된 재료가 없어요
          </p>
        ) : (
          drafts.map((item, index) => (
            <div
              key={`${item.name}-${index}`}
              className="rounded-2xl border border-border bg-card p-3.5 shadow-[0_1px_6px_rgba(0,0,0,0.04)]"
            >
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <input
                  value={item.name}
                  onChange={(e) => updateDraft(index, { name: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[15px] font-bold text-foreground outline-none focus:border-primary"
                  aria-label="재료 이름"
                />
                <input
                  value={item.category}
                  onChange={(e) =>
                    updateDraft(index, { category: e.target.value })
                  }
                  placeholder="카테고리"
                  className="w-24 shrink-0 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] outline-none focus:border-primary"
                />
              </div>

              <div className="mb-2.5 grid grid-cols-[1fr_1fr_1.2fr] gap-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium text-muted-foreground">
                    수량
                  </span>
                  <input
                    type="number"
                    min={0.01}
                    step="any"
                    value={item.quantity}
                    onChange={(e) =>
                      updateDraft(index, {
                        quantity: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-lg border border-border bg-background px-2 py-2 text-[13px] outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium text-muted-foreground">
                    단위
                  </span>
                  <input
                    value={item.unit}
                    onChange={(e) =>
                      updateDraft(index, { unit: e.target.value })
                    }
                    className="w-full rounded-lg border border-border bg-background px-2 py-2 text-[13px] outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium text-muted-foreground">
                    구역
                  </span>
                  <select
                    value={item.zone}
                    onChange={(e) =>
                      updateDraft(index, {
                        zone: e.target.value as StorageZone,
                      })
                    }
                    className="w-full rounded-lg border border-border bg-background px-2 py-2 text-[13px] outline-none focus:border-primary"
                  >
                    {ZONES.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mb-2 flex min-h-11 cursor-pointer items-center gap-2">
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
                  className="size-5 accent-primary"
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
          ))
        )}
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
          disabled={loading || drafts.length === 0}
          onClick={handleRegister}
          className="rounded-xl bg-primary py-3.5 text-[13px] font-bold text-primary-foreground disabled:opacity-50"
        >
          {loading ? "등록 중..." : "전체 등록"}
        </button>
      </div>
    </div>
  );
}
