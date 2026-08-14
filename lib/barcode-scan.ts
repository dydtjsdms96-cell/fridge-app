import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import {
  BarcodeFormat,
  BarcodeScanner,
  LensFacing,
} from "@capacitor-mlkit/barcode-scanning";

const PRODUCT_FORMATS = [
  BarcodeFormat.Ean13,
  BarcodeFormat.Ean8,
  BarcodeFormat.UpcA,
  BarcodeFormat.UpcE,
  BarcodeFormat.Code128,
];

const ACTIVE_CLASS = "barcode-scanner-active";

let listenerHandles: PluginListenerHandle[] = [];

export function isNativeBarcodePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Explicit camera permission flow for ML Kit barcode scanning.
 * Returns true when the user granted (or limited) access.
 */
export async function ensureBarcodeCameraPermission(): Promise<boolean> {
  const current = await BarcodeScanner.checkPermissions();
  if (current.camera === "granted" || current.camera === "limited") {
    return true;
  }
  const requested = await BarcodeScanner.requestPermissions();
  return requested.camera === "granted" || requested.camera === "limited";
}

function setScannerChromeActive(active: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(ACTIVE_CLASS, active);
  document.body.classList.toggle(ACTIVE_CLASS, active);
}

async function clearListeners() {
  for (const handle of listenerHandles) {
    try {
      await handle.remove();
    } catch {
      // ignore
    }
  }
  listenerHandles = [];
  try {
    await BarcodeScanner.removeAllListeners();
  } catch {
    // ignore
  }
}

/**
 * Start continuous native ML Kit scanning (camera behind WebView).
 * Call {@link stopNativeBarcodeScan} when done or on unmount.
 */
export async function startNativeBarcodeScan(opts: {
  onDetect: (raw: string) => void;
  onError?: (message: string) => void;
}): Promise<void> {
  const supported = await BarcodeScanner.isSupported();
  if (!supported.supported) {
    throw new Error("unsupported");
  }

  const granted = await ensureBarcodeCameraPermission();
  if (!granted) {
    throw new Error("permission-denied");
  }

  await stopNativeBarcodeScan();
  setScannerChromeActive(true);

  const scanned = await BarcodeScanner.addListener(
    "barcodesScanned",
    (event) => {
      const raw = event.barcodes?.[0]?.rawValue?.trim();
      if (raw) opts.onDetect(raw);
    },
  );
  listenerHandles.push(scanned);

  const errored = await BarcodeScanner.addListener("scanError", (event) => {
    opts.onError?.(event.message || "바코드 스캔 중 오류가 났어요");
  });
  listenerHandles.push(errored);

  await BarcodeScanner.startScan({
    formats: PRODUCT_FORMATS,
    lensFacing: LensFacing.Back,
  });
}

export async function stopNativeBarcodeScan(): Promise<void> {
  setScannerChromeActive(false);
  await clearListeners();
  try {
    await BarcodeScanner.stopScan();
  } catch {
    // already stopped
  }
}
