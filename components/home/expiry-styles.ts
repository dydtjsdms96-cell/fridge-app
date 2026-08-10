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
};
