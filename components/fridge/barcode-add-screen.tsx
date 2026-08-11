"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ScanBarcode } from "lucide-react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import { createClient } from "@/lib/supabase";
import { saveFridgeItem } from "@/lib/fridge-item-upsert";
import type { BarcodeLookup, StorageZone } from "@/types/database";
import {
  ManualAddSheet,
  type ManualAddPayload,
} from "@/components/fridge/manual-add-sheet";
import { useDuplicateItemPrompt } from "@/hooks/use-duplicate-item-prompt";
import { Toast, useToast } from "@/components/ui/toast";
import { useImmersiveMode } from "@/components/layout/immersive-mode";

const SCANNER_ID = "barcode-scanner-region";

const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
];

type FormPrefill = {
  barcode: string | null;
  name: string;
  category: string | null;
  zone: StorageZone;
  fromLookup: boolean;
};

function isStorageZone(value: string | null | undefined): value is StorageZone {
  return (
    value === "냉장" ||
    value === "냉동" ||
    value === "실온" ||
    value === "김치냉장고"
  );
}

export function BarcodeAddScreen() {
  const router = useRouter();
  const { resolveDuplicate, dialog: duplicateDialog } = useDuplicateItemPrompt();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState("카메라를 준비하는 중…");
  const [error, setError] = useState<string | null>(null);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [prefill, setPrefill] = useState<FormPrefill | null>(null);
  const { message, showToast } = useToast(2800);
  useImmersiveMode(true);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // ignore stop errors
    }
    scannerRef.current = null;
    setScanning(false);
  }, []);

  const openManualFallback = useCallback(
    (msg: string) => {
      showToast(msg);
      setPrefill({
        barcode: null,
        name: "",
        category: null,
        zone: "냉장",
        fromLookup: false,
      });
    },
    [showToast],
  );

  const handleDecoded = useCallback(
    async (rawCode: string) => {
      if (handledRef.current) return;
      handledRef.current = true;
      const code = rawCode.trim();
      setStatus("바코드를 확인하는 중…");
      await stopScanner();

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("로그인이 필요해요");

        const { data, error: lookupError } = await supabase
          .from("barcode_lookup")
          .select("*")
          .eq("barcode", code)
          .eq("user_id", user.id)
          .maybeSingle();

        if (lookupError) throw new Error(lookupError.message);

        const row = data as BarcodeLookup | null;
        if (row) {
          setPrefill({
            barcode: code,
            name: row.name,
            category: row.category,
            zone: isStorageZone(row.default_zone) ? row.default_zone : "냉장",
            fromLookup: true,
          });
        } else {
          setPrefill({
            barcode: code,
            name: "",
            category: null,
            zone: "냉장",
            fromLookup: false,
          });
        }
      } catch (err) {
        console.error("[barcode] lookup:", err);
        setPrefill({
          barcode: code,
          name: "",
          category: null,
          zone: "냉장",
          fromLookup: false,
        });
      }
    },
    [stopScanner],
  );

  useEffect(() => {
    if (prefill || cameraUnavailable) return;

    let cancelled = false;

    async function start() {
      if (typeof window === "undefined") return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraUnavailable(true);
        openManualFallback(
          "바코드 스캔을 사용할 수 없어요. 수동으로 입력해주세요",
        );
        return;
      }

      try {
        const scanner = new Html5Qrcode(SCANNER_ID, {
          formatsToSupport: BARCODE_FORMATS,
          verbose: false,
          useBarCodeDetectorIfSupported: true,
        });
        if (cancelled) return;
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 8,
            qrbox: { width: 280, height: 140 },
            aspectRatio: 1.777,
          },
          (decoded) => {
            void handleDecoded(decoded);
          },
          () => {
            // ignore per-frame miss
          },
        );

        if (cancelled) {
          await stopScanner();
          return;
        }
        setScanning(true);
        setStatus("바코드를 사각형 안에 맞춰 주세요");
        setError(null);
      } catch (err) {
        console.error("[barcode] camera:", err);
        if (!cancelled) {
          setCameraUnavailable(true);
          setError("카메라 권한이 없거나 사용할 수 없어요.");
          openManualFallback(
            "바코드 스캔을 사용할 수 없어요. 수동으로 입력해주세요",
          );
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [prefill, cameraUnavailable, handleDecoded, openManualFallback, stopScanner]);

  async function handleSubmit(payload: ManualAddPayload) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인이 필요해요");

    await saveFridgeItem(
      user.id,
      {
        name: payload.name,
        quantity: payload.quantity,
        unit: payload.unit,
        zone: payload.zone,
        sub_zone: payload.sub_zone,
        category: payload.category,
        expires_at: payload.has_no_expiry ? null : payload.expires_at,
        has_no_expiry: payload.has_no_expiry,
        input_method: payload.barcode ? "바코드" : "수동",
      },
      { supabase, resolveDuplicate },
    );

    if (payload.barcode) {
      const { error: upsertError } = await supabase.from("barcode_lookup").upsert(
        {
          barcode: payload.barcode,
          user_id: user.id,
          name: payload.name,
          category: payload.category,
          default_zone: payload.zone,
        },
        { onConflict: "user_id,barcode" },
      );
      if (upsertError) {
        console.error("[barcode] upsert lookup:", upsertError.message);
      }
    }

    router.push("/fridge");
    router.refresh();
  }

  function handleFormClose() {
    setPrefill(null);
    handledRef.current = false;
    // remount scanner via clearing prefill — effect restarts
  }

  function handleRescan() {
    setPrefill(null);
    handledRef.current = false;
    setStatus("카메라를 다시 켜는 중…");
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0b1a10]">
      <div className="flex shrink-0 items-center gap-2 px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="touch-target flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white"
          aria-label="뒤로"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-bold text-white">바코드 스캔</h1>
          <p className="text-[11px] text-white/55">{status}</p>
        </div>
        {prefill && (
          <button
            type="button"
            onClick={handleRescan}
            className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-semibold text-white/80"
          >
            다시 스캔
          </button>
        )}
      </div>

      <div className="relative mx-4 mb-4 min-h-0 flex-1 overflow-hidden rounded-[24px] bg-black">
        <div id={SCANNER_ID} className="size-full overflow-hidden" />
        {!scanning && !prefill && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
            <ScanBarcode size={36} className="opacity-60" />
            <p className="px-6 text-center text-[13px]">
              {error ?? "카메라 프리뷰를 불러오는 중…"}
            </p>
          </div>
        )}
      </div>

      <div className="safe-bottom-max px-5 pt-2">
        <button
          type="button"
          onClick={() =>
            openManualFallback(
              "수동으로 입력해주세요",
            )
          }
          className="touch-target w-full rounded-2xl border border-white/20 bg-white/10 py-3.5 text-[13px] font-semibold text-white"
        >
          수동으로 입력하기
        </button>
      </div>

      <Toast message={message} position="top" />

      {prefill && (
        <ManualAddSheet
          key={`${prefill.barcode ?? "manual"}-${prefill.name}`}
          title={
            prefill.fromLookup
              ? "바코드로 불러온 재료"
              : prefill.barcode
                ? "새 바코드 등록"
                : "수동 등록"
          }
          barcode={prefill.barcode}
          initialName={prefill.name}
          initialCategory={prefill.category}
          initialZone={prefill.zone}
          onClose={handleFormClose}
          onSubmit={handleSubmit}
        />
      )}

      {duplicateDialog}
    </div>
  );
}
