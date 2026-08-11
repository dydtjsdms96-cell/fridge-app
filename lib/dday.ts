export type ExpiryStatus = "fresh" | "warn" | "urgent" | "unset" | "none";

const APP_TIME_ZONE = "Asia/Seoul";

/** Categories that default to "유통기한 없음". */
const NO_EXPIRY_CATEGORY_KEYS = [
  "양념",
  "조미료",
  "완성",
  "요리",
  "소스",
  "향신료",
] as const;

/** Calendar YYYY-MM-DD in app timezone (SSR/client match). */
export function ymdInAppTz(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const from = Date.UTC(
    Number(fromYmd.slice(0, 4)),
    Number(fromYmd.slice(5, 7)) - 1,
    Number(fromYmd.slice(8, 10)),
  );
  const to = Date.UTC(
    Number(toYmd.slice(0, 4)),
    Number(toYmd.slice(5, 7)) - 1,
    Number(toYmd.slice(8, 10)),
  );
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

/** Add calendar days to a YYYY-MM-DD string. */
export function addDaysYmd(ymd: string, days: number): string {
  const base = Date.UTC(
    Number(ymd.slice(0, 4)),
    Number(ymd.slice(5, 7)) - 1,
    Number(ymd.slice(8, 10)),
  );
  const next = new Date(base + days * 24 * 60 * 60 * 1000);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Default shelf life (days) by ingredient name / category. */
export function defaultShelfLifeDays(
  name?: string | null,
  category?: string | null,
): number {
  const n = (name ?? "").trim();
  const c = (category ?? "").trim();

  const nameDays: [string, number][] = [
    ["고등어", 2],
    ["생선", 2],
    ["회", 1],
    ["새우", 2],
    ["삼겹살", 3],
    ["소고기", 3],
    ["돼지고기", 3],
    ["닭", 3],
    ["우유", 7],
    ["요거트", 10],
    ["치즈", 14],
    ["두부", 5],
    ["계란", 21],
    ["달걀", 21],
    ["대파", 7],
    ["양파", 14],
    ["감자", 14],
    ["당근", 10],
    ["버섯", 5],
    ["토마토", 5],
    ["빵", 3],
  ];
  for (const [key, days] of nameDays) {
    if (n.includes(key)) return days;
  }

  if (c.includes("해산물") || c.includes("수산물")) return 2;
  if (c.includes("육류") || c.includes("고기")) return 3;
  if (c.includes("채소") || c.includes("과일")) return 7;
  if (c.includes("유제품")) return 7;
  if (c.includes("냉동")) return 30;
  return 7;
}

/** Fallback expiry date when ingredient_ref matching fails / user skips. */
export function defaultExpiresAt(
  name?: string | null,
  category?: string | null,
  fromDate = ymdInAppTz(),
): string {
  return addDaysYmd(fromDate, defaultShelfLifeDays(name, category));
}

/** 양념·조미료·완성 요리 등 장기/무기한 보관 카테고리 여부 */
export function isNoExpiryCategory(category?: string | null): boolean {
  const c = (category ?? "").trim();
  if (!c) return false;
  return NO_EXPIRY_CATEGORY_KEYS.some((key) => c.includes(key));
}

/** expires_at(YYYY-MM-DD) − 오늘(Asia/Seoul) 일수 */
export function getDDay(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const expiresYmd = expiresAt.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresYmd)) return null;
  return daysBetweenYmd(ymdInAppTz(), expiresYmd);
}

export function getExpiryStatus(
  dDay: number | null,
  hasNoExpiry = false,
): ExpiryStatus {
  if (hasNoExpiry) return "none";
  if (dDay === null) return "unset";
  if (dDay <= 3) return "urgent";
  if (dDay <= 7) return "warn";
  return "fresh";
}

export function formatDDay(dDay: number | null, hasNoExpiry = false): string {
  if (hasNoExpiry) return "무기한";
  if (dDay === null) return "유통기한 미설정";
  if (dDay < 0) return `D+${Math.abs(dDay)}`;
  return `D-${dDay}`;
}

/** Short badge text for compact slots (home zone cards). */
export function formatDDayShort(
  dDay: number | null,
  hasNoExpiry = false,
): string {
  if (hasNoExpiry) return "무기한";
  if (dDay === null) return "—";
  if (dDay < 0) return `+${Math.abs(dDay)}`;
  return `D-${dDay}`;
}

/** Items with a real expiry that can appear in 임박/만료/알림. */
export function isExpiryTracked(item: {
  has_no_expiry?: boolean | null;
}): boolean {
  return !item.has_no_expiry;
}
