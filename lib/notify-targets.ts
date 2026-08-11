import { getDDay, isExpiryTracked } from "@/lib/dday";
import type { FridgeItem } from "@/types/database";

/**
 * Smart push / expiry reminder candidates.
 * Excludes has_no_expiry items entirely.
 */
export function getExpiryNotifyTargets(
  items: FridgeItem[],
  withinDays = 7,
): FridgeItem[] {
  return items.filter((item) => {
    if (item.status !== "보유") return false;
    if (!isExpiryTracked(item)) return false;
    const dDay = getDDay(item.expires_at);
    if (dDay === null) return false;
    return dDay <= withinDays;
  });
}
