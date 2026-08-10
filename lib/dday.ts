export type ExpiryStatus = "fresh" | "warn" | "urgent";

const APP_TIME_ZONE = "Asia/Seoul";

/** Calendar YYYY-MM-DD in app timezone (SSR/client match). */
function ymdInAppTz(date = new Date()): string {
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

/** expires_at(YYYY-MM-DD) − 오늘(Asia/Seoul) 일수 */
export function getDDay(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const expiresYmd = expiresAt.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresYmd)) return null;
  return daysBetweenYmd(ymdInAppTz(), expiresYmd);
}

export function getExpiryStatus(dDay: number | null): ExpiryStatus {
  if (dDay === null) return "fresh";
  if (dDay <= 3) return "urgent";
  if (dDay <= 7) return "warn";
  return "fresh";
}

export function formatDDay(dDay: number | null): string {
  if (dDay === null) return "—";
  if (dDay < 0) return `D+${Math.abs(dDay)}`;
  return `D-${dDay}`;
}
