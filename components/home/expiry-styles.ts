import type { ExpiryStatus } from "@/lib/dday";

export const EXPIRY_STYLES: Record<
  ExpiryStatus,
  {
    bg: string;
    text: string;
    border: string;
    dot: string;
    badge: string;
  }
> = {
  fresh: {
    bg: "bg-status-fresh-bg",
    text: "text-status-fresh",
    border: "border-status-fresh-border",
    dot: "var(--status-fresh-dot)",
    badge: "bg-status-fresh-bg text-status-fresh",
  },
  warn: {
    bg: "bg-status-warn-bg",
    text: "text-status-warn",
    border: "border-status-warn-border",
    dot: "var(--status-warn-dot)",
    badge: "bg-status-warn-bg text-status-warn",
  },
  urgent: {
    bg: "bg-status-urgent-bg",
    text: "text-status-urgent",
    border: "border-status-urgent-border",
    dot: "var(--status-urgent-dot)",
    badge: "bg-status-urgent-bg text-status-urgent",
  },
  unset: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
    dot: "var(--muted-foreground)",
    badge: "bg-muted text-muted-foreground",
  },
  /** 유통기한 없음(무기한) — 미설정과 구분되는 중립 회색 */
  none: {
    bg: "bg-[#ececea]",
    text: "text-[#6b6963]",
    border: "border-[#d8d6d0]",
    dot: "#8a8780",
    badge: "bg-[#ececea] text-[#6b6963]",
  },
};
