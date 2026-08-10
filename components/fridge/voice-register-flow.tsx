"use client";

import { useEffect, useState } from "react";
import { Mic, X } from "lucide-react";
import type { StorageZone } from "@/types/database";

const DEMO_TAGS = ["계란", "두부", "대파", "닭고기"];

const WAVE_BARS = [18, 32, 48, 28, 56, 36, 44, 24, 52, 30, 40, 22];

type VoiceRegisterFlowProps = {
  onClose: () => void;
  onRegister: (
    items: {
      name: string;
      quantity: number;
      unit: string;
      zone: StorageZone;
      category: string;
    }[],
  ) => Promise<void>;
};

export function VoiceRegisterFlow({
  onClose,
  onRegister,
}: VoiceRegisterFlowProps) {
  const [revealedTags, setRevealedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
  }, []);

  async function handleDone() {
    if (revealedTags.length === 0) return;
    setLoading(true);
    try {
      await onRegister(
        revealedTags.map((name) => ({
          name,
          quantity: 1,
          unit: "개",
          zone: "냉장" as const,
          category: "기타",
        })),
      );
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col"
      style={{ background: "#0B1A10" }}
    >
      <div className="flex h-12 shrink-0 items-center justify-between px-7 pt-4">
        <span className="font-mono text-[13px] font-medium text-white/50">9:41</span>
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
            <p className="text-[13px] text-white/25 italic">아직 인식된 재료가 없어요</p>
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
          disabled={revealedTags.length === 0 || loading}
          onClick={handleDone}
          className="w-full rounded-2xl bg-primary py-3.5 text-[14px] font-bold text-primary-foreground disabled:opacity-40"
        >
          {loading
            ? "등록 중..."
            : `완료 (${revealedTags.length}개 인식됨)`}
        </button>
      </div>
    </div>
  );
}
