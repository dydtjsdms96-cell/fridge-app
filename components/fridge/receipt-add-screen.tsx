"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ChevronLeft, ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { saveFridgeItem } from "@/lib/fridge-item-upsert";
import { ManualAddSheet } from "@/components/fridge/manual-add-sheet";
import { useDuplicateItemPrompt } from "@/hooks/use-duplicate-item-prompt";
import type { ManualAddPayload } from "@/components/fridge/manual-add-sheet";
import { Toast, useToast } from "@/components/ui/toast";
import { useImmersiveMode } from "@/components/layout/immersive-mode";

export function ReceiptAddScreen() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const { message, showToast } = useToast();
  const [showManualAdd, setShowManualAdd] = useState(false);
  const { resolveDuplicate, dialog: duplicateDialog } = useDuplicateItemPrompt();
  useImmersiveMode(true);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(file: File | null) {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
  }

  function handleRecognize() {
    if (!previewUrl) return;
    showToast("영수증 인식 기능은 준비 중입니다", 900);
    window.setTimeout(() => {
      setShowManualAdd(true);
    }, 900);
  }

  async function handleManualAdd(payload: ManualAddPayload) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인이 필요해요");

    await saveFridgeItem(
      user.id,
      { ...payload, input_method: "수동" },
      { supabase, resolveDuplicate },
    );

    router.push("/fridge");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="touch-target flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-[0_1px_6px_rgba(0,0,0,0.06)]"
          aria-label="뒤로"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="min-h-0 flex-1">
          <h1 className="text-[22px] font-bold leading-[27.5px] text-foreground">
            영수증 촬영
          </h1>
          <p className="text-[11px] text-muted-foreground">
            사진으로 재료를 불러올 자리예요 (준비 중)
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-5 pb-6 safe-bottom">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-[24px] border border-dashed border-border bg-card"
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="영수증 미리보기"
              className="absolute inset-0 size-full object-contain bg-[#f0efe9]"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
                <Camera size={26} />
              </div>
              <div>
                <p className="text-[15px] font-bold text-foreground">
                  촬영하거나 사진을 선택하세요
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  카메라 또는 갤러리에서 영수증 이미지를 불러와요
                </p>
              </div>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-muted-foreground">
                <ImagePlus size={14} />
                사진 선택
              </span>
            </div>
          )}
        </button>

        {previewUrl && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-[12px] text-muted-foreground">
              {fileName ?? "선택된 사진"}
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="shrink-0 text-[12px] font-semibold text-primary"
            >
              다시 선택
            </button>
          </div>
        )}

        <button
          type="button"
          disabled={!previewUrl}
          onClick={handleRecognize}
          className="touch-target mt-4 w-full rounded-2xl bg-primary py-3.5 text-[15px] font-bold text-primary-foreground disabled:opacity-40"
        >
          인식하기
        </button>
      </div>

      <Toast message={message} position="top" />

      {showManualAdd && (
        <ManualAddSheet
          onClose={() => setShowManualAdd(false)}
          onSubmit={handleManualAdd}
        />
      )}

      {duplicateDialog}
    </div>
  );
}
