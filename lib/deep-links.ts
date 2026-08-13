/**
 * FreshPocket / 프레시포켓 deep links for voice (and Bixby) add flows.
 *
 * Supported URLs:
 * - freshpocket://add?text=우유%201.8L%20계란%2010개
 * - freshpocket://add?q=...
 * - com.dydtjsdms96.fridgeapp://add?text=...
 * - https://fridge-app-aolm.vercel.app/add?text=...
 * - https://fridge-app-aolm.vercel.app/?voiceAdd=...
 *
 * Bixby Capsule intent spec: docs/bixby-capsule-intent-spec.md
 *   AddFridgeItems(utterance) → freshpocket://add?text={encodeURIComponent(utterance)}
 *
 * Quick Command (until Capsule ships): open the same deep link with a fixed/partial phrase.
 */

export type FreshPocketDeepLink =
  | { action: "add"; text: string }
  | { action: "unknown"; raw: string };

const ADD_HOSTS = new Set(["add", "voice", "voice-add"]);

function readTextParam(params: URLSearchParams): string | null {
  const text =
    params.get("text") ??
    params.get("q") ??
    params.get("query") ??
    params.get("utterance") ??
    params.get("voiceAdd") ??
    params.get("add");
  if (!text) return null;
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Parse custom-scheme or https deep link into an app action. */
export function parseFreshPocketDeepLink(rawUrl: string): FreshPocketDeepLink {
  const raw = rawUrl.trim();
  if (!raw) return { action: "unknown", raw };

  try {
    // URL() needs a base for some custom schemes without //
    const url = raw.includes("://")
      ? new URL(raw)
      : new URL(raw, "freshpocket://");

    const path = `${url.hostname}${url.pathname}`.replace(/\/+$/, "");
    const pathParts = path.split("/").filter(Boolean);
    const hostOrPath = (pathParts[0] ?? url.hostname ?? "").toLowerCase();

    const text = readTextParam(url.searchParams);
    if (text && (ADD_HOSTS.has(hostOrPath) || url.pathname === "/add")) {
      return { action: "add", text };
    }

    // https://host/?voiceAdd=... or /add?text=
    if (text && (url.searchParams.has("voiceAdd") || url.pathname === "/add")) {
      return { action: "add", text };
    }

    if (text && ADD_HOSTS.has(hostOrPath)) {
      return { action: "add", text };
    }

    // freshpocket://add/우유… (rare path form)
    if (ADD_HOSTS.has(hostOrPath) && pathParts.length > 1) {
      const fromPath = decodeURIComponent(pathParts.slice(1).join(" ")).trim();
      if (fromPath) return { action: "add", text: fromPath };
    }

    if (text) return { action: "add", text };

    return { action: "unknown", raw };
  } catch {
    return { action: "unknown", raw };
  }
}

/** Build a custom-scheme URL Bixby / ADB can open. */
export function buildVoiceAddDeepLink(text: string): string {
  const q = new URLSearchParams({ text });
  return `freshpocket://add?${q.toString()}`;
}
