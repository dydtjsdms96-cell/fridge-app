import {
  addDaysYmd,
  defaultExpiresAt,
  isNoExpiryCategory,
  ymdInAppTz,
} from "@/lib/dday";
import type { ParsedVoiceItem } from "@/lib/parse-voice-utterance";
import { createClient } from "@/lib/supabase";
import type { IngredientRef, StorageZone } from "@/types/database";

function normalizeName(name: string): string {
  return name.replace(/\s+/g, "").trim().toLowerCase();
}

/** Fetch public ingredient_ref rows (best-effort; empty on failure). */
export async function fetchIngredientRefs(): Promise<IngredientRef[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("ingredient_ref")
      .select("name, aliases, default_zone, shelf_life_days, category");
    if (error) {
      console.error("[ingredient_ref] fetch:", error.message);
      return [];
    }
    return (data ?? []) as IngredientRef[];
  } catch (err) {
    console.error("[ingredient_ref] fetch failed", err);
    return [];
  }
}

export function matchIngredientRef(
  name: string,
  refs: IngredientRef[],
): IngredientRef | null {
  const key = normalizeName(name);
  if (!key || refs.length === 0) return null;

  for (const ref of refs) {
    if (normalizeName(ref.name) === key) return ref;
  }
  for (const ref of refs) {
    for (const alias of ref.aliases ?? []) {
      if (normalizeName(alias) === key) return ref;
    }
  }
  // substring: longer names first
  const sorted = [...refs].sort(
    (a, b) => normalizeName(b.name).length - normalizeName(a.name).length,
  );
  for (const ref of sorted) {
    const n = normalizeName(ref.name);
    if (n.length >= 2 && (key.includes(n) || n.includes(key))) return ref;
  }
  for (const ref of sorted) {
    for (const alias of ref.aliases ?? []) {
      const a = normalizeName(alias);
      if (a.length >= 2 && (key.includes(a) || a.includes(key))) return ref;
    }
  }
  return null;
}

export type EnrichedVoiceDraft = {
  name: string;
  quantity: number;
  unit: string;
  zone: StorageZone;
  category: string;
  expires_at: string;
  has_no_expiry: boolean;
};

/** Merge parsed voice item with ingredient_ref shelf life / zone / category. */
export function enrichParsedWithIngredientRef(
  item: ParsedVoiceItem,
  refs: IngredientRef[],
  today = ymdInAppTz(),
): EnrichedVoiceDraft {
  const ref = matchIngredientRef(item.name, refs);
  const category = ref?.category?.trim() || item.category || "기타";
  const zone = (ref?.default_zone as StorageZone | undefined) ?? item.zone;
  const noExpiry = isNoExpiryCategory(category);
  const days =
    typeof ref?.shelf_life_days === "number" && ref.shelf_life_days > 0
      ? ref.shelf_life_days
      : null;

  return {
    name: ref?.name?.trim() || item.name,
    quantity: item.quantity,
    unit: item.unit,
    zone,
    category,
    has_no_expiry: noExpiry,
    expires_at: noExpiry
      ? today
      : days != null
        ? addDaysYmd(today, days)
        : defaultExpiresAt(item.name, category, today),
  };
}
