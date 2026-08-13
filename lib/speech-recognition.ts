import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

export type SpeechErrorKind =
  | "permission-denied"
  | "unsupported"
  | "recognition-failed"
  | "aborted";

export type SpeechSessionCallbacks = {
  onPartial: (text: string) => void;
  onFinal?: (text: string) => void;
  onError: (kind: SpeechErrorKind, message: string) => void;
  onListeningChange?: (listening: boolean) => void;
};

export type SpeechSession = {
  start: () => Promise<void>;
  stop: () => Promise<string>;
  destroy: () => Promise<void>;
};

type WebSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

function getWebSpeechCtor(): (new () => WebSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => WebSpeechRecognition;
    webkitSpeechRecognition?: new () => WebSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function createWebSession(
  language: string,
  cb: SpeechSessionCallbacks,
): SpeechSession {
  const Ctor = getWebSpeechCtor();
  if (!Ctor) {
    return {
      async start() {
        cb.onError(
          "unsupported",
          "이 브라우저에서는 음성 인식을 지원하지 않아요.",
        );
      },
      async stop() {
        return "";
      },
      async destroy() {},
    };
  }

  let recognition: WebSpeechRecognition | null = null;
  let finalChunks: string[] = [];
  let interim = "";
  let starting = false;

  function emit() {
    const text = [...finalChunks, interim].join(" ").replace(/\s+/g, " ").trim();
    cb.onPartial(text);
  }

  return {
    async start() {
      if (starting || recognition) return;
      starting = true;
      finalChunks = [];
      interim = "";
      recognition = new Ctor();
      recognition.lang = language;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (ev) => {
        let nextInterim = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const piece = ev.results[i][0]?.transcript ?? "";
          if (ev.results[i].isFinal) {
            const t = piece.trim();
            if (t) finalChunks.push(t);
          } else {
            nextInterim += piece;
          }
        }
        interim = nextInterim.trim();
        emit();
      };

      recognition.onerror = (ev) => {
        const code = ev.error;
        if (code === "not-allowed" || code === "service-not-allowed") {
          cb.onError(
            "permission-denied",
            "마이크 권한이 필요해요. 설정에서 허용해 주세요.",
          );
        } else if (code === "aborted" || code === "no-speech") {
          // ignore soft ends
        } else {
          cb.onError(
            "recognition-failed",
            "음성을 인식하지 못했어요. 다시 시도해 주세요.",
          );
        }
      };

      recognition.onend = () => {
        cb.onListeningChange?.(false);
        recognition = null;
        starting = false;
      };

      try {
        recognition.start();
        cb.onListeningChange?.(true);
      } catch {
        cb.onError(
          "recognition-failed",
          "음성 인식을 시작하지 못했어요.",
        );
        recognition = null;
      } finally {
        starting = false;
      }
    },

    async stop() {
      const text = [...finalChunks, interim].join(" ").replace(/\s+/g, " ").trim();
      try {
        recognition?.stop();
      } catch {
        // ignore
      }
      recognition = null;
      cb.onListeningChange?.(false);
      if (text) cb.onFinal?.(text);
      return text;
    },

    async destroy() {
      try {
        recognition?.abort();
      } catch {
        // ignore
      }
      recognition = null;
      cb.onListeningChange?.(false);
    },
  };
}

function createNativeSession(
  language: string,
  cb: SpeechSessionCallbacks,
): SpeechSession {
  let latest = "";
  let handles: Array<{ remove: () => Promise<void> }> = [];

  async function clearListeners() {
    for (const h of handles) {
      try {
        await h.remove();
      } catch {
        // ignore
      }
    }
    handles = [];
    try {
      await SpeechRecognition.removeAllListeners();
    } catch {
      // ignore
    }
  }

  return {
    async start() {
      latest = "";
      try {
        const { available } = await SpeechRecognition.available();
        if (!available) {
          cb.onError(
            "unsupported",
            "이 기기에서는 음성 인식을 사용할 수 없어요.",
          );
          return;
        }

        const perm = await SpeechRecognition.requestPermissions();
        if (perm.speechRecognition !== "granted") {
          cb.onError(
            "permission-denied",
            "마이크 권한이 필요해요. 설정에서 허용해 주세요.",
          );
          return;
        }

        await clearListeners();

        const partial = await SpeechRecognition.addListener(
          "partialResults",
          (data) => {
            const text = (data.matches?.[0] ?? "").trim();
            if (!text) return;
            latest = text;
            cb.onPartial(text);
          },
        );
        handles.push(partial);

        const state = await SpeechRecognition.addListener(
          "listeningState",
          (data) => {
            cb.onListeningChange?.(data.status === "started");
            if (data.status === "stopped" && latest) {
              cb.onFinal?.(latest);
            }
          },
        );
        handles.push(state);

        await SpeechRecognition.start({
          language,
          maxResults: 5,
          partialResults: true,
          popup: false,
          prompt: "재료를 말씀해 주세요",
        });
        cb.onListeningChange?.(true);
      } catch (err) {
        console.error("[speech] native start failed", err);
        cb.onError(
          "recognition-failed",
          "음성 인식을 시작하지 못했어요.",
        );
        cb.onListeningChange?.(false);
      }
    },

    async stop() {
      try {
        const listening = await SpeechRecognition.isListening();
        if (listening.listening) {
          await SpeechRecognition.stop();
        }
      } catch {
        // ignore
      }
      cb.onListeningChange?.(false);
      if (latest) cb.onFinal?.(latest);
      return latest;
    },

    async destroy() {
      try {
        const listening = await SpeechRecognition.isListening();
        if (listening.listening) {
          await SpeechRecognition.stop();
        }
      } catch {
        // ignore
      }
      await clearListeners();
      cb.onListeningChange?.(false);
    },
  };
}

/** Unified speech session: native plugin on Capacitor, Web Speech API in browser. */
export function createSpeechSession(
  cb: SpeechSessionCallbacks,
  language = "ko-KR",
): SpeechSession {
  if (Capacitor.isNativePlatform()) {
    return createNativeSession(language, cb);
  }
  return createWebSession(language, cb);
}

export function isSpeechSupportedEnvironment(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return getWebSpeechCtor() != null;
}
