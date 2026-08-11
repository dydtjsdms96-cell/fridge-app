import type { FridgeItem, StorageZone, StorageZoneRow } from "@/types/database";

/** Figma 홈과 맞춘 기본 구조 (storage_zones 비어 있을 때 가상 표시). */
export const DEFAULT_HOME_ZONES: Array<{
  base_zone: StorageZone;
  label: string;
}> = [
  { base_zone: "냉장", label: "상칸 좌" },
  { base_zone: "냉장", label: "상칸 우" },
  { base_zone: "냉동", label: "냉동실" },
];

export type HomeZonePanel = {
  key: string;
  baseZone: StorageZone;
  label: string;
  /** true when label comes from DEFAULT_HOME_ZONES, not DB */
  isVirtual: boolean;
  items: FridgeItem[];
};

const UPPER_BASES: StorageZone[] = ["냉장", "실온", "김치냉장고"];

function panelsForBase(
  baseZone: StorageZone,
  zoneRows: StorageZoneRow[],
  useDefaults: boolean,
): Array<{ label: string; isVirtual: boolean }> {
  const labels = zoneRows
    .filter((z) => z.base_zone === baseZone)
    .map((z) => ({ label: z.label, isVirtual: false }));

  if (labels.length > 0) return labels;

  if (useDefaults) {
    return DEFAULT_HOME_ZONES.filter((z) => z.base_zone === baseZone).map(
      (z) => ({ label: z.label, isVirtual: true }),
    );
  }

  return [];
}

/**
 * Build home fridge panels from storage_zones + items.
 * - Empty storage_zones → Figma defaults (상칸 좌/우, 냉동실)
 * - Items with null/unknown sub_zone → first panel of that base_zone
 * - Extra base zones (실온/김치) appear only when they have zones or items
 */
export function buildHomeZonePanels(
  zoneRows: StorageZoneRow[],
  items: FridgeItem[],
): { upper: HomeZonePanel[]; freezer: HomeZonePanel[]; other: HomeZonePanel[] } {
  const useDefaults = zoneRows.length === 0;
  const panels: HomeZonePanel[] = [];

  const ensurePanel = (baseZone: StorageZone, label: string, isVirtual: boolean) => {
    const key = `${baseZone}:${label}`;
    let panel = panels.find((p) => p.key === key);
    if (!panel) {
      panel = { key, baseZone, label, isVirtual, items: [] };
      panels.push(panel);
    }
    return panel;
  };

  for (const base of ["냉장", "냉동", "실온", "김치냉장고"] as StorageZone[]) {
    for (const p of panelsForBase(base, zoneRows, useDefaults)) {
      ensurePanel(base, p.label, p.isVirtual);
    }
  }

  const labeledFor = (base: StorageZone) =>
    panels.filter((p) => p.baseZone === base).map((p) => p.label);

  for (const item of items) {
    const labels = labeledFor(item.zone);
    const sub = item.sub_zone?.trim() || null;

    if (sub && labels.includes(sub)) {
      ensurePanel(item.zone, sub, false).items.push(item);
      continue;
    }

    if (labels.length > 0) {
      // null/unknown → first panel of that base (avoids empty defaults + orphan pile)
      const first = panels.find((p) => p.baseZone === item.zone)!;
      first.items.push(item);
      continue;
    }

    // No panels for this base yet (e.g. 실온 item with no zones defined)
    ensurePanel(item.zone, item.zone, true).items.push(item);
  }

  // Drop empty virtual panels for 실온/김치 that were never seeded
  const visible = panels.filter((p) => {
    if (p.items.length > 0) return true;
    if (p.baseZone === "냉장" || p.baseZone === "냉동") return true;
    return !p.isVirtual;
  });

  const upper = visible.filter((p) => UPPER_BASES.includes(p.baseZone));
  const freezer = visible.filter((p) => p.baseZone === "냉동");
  const other: HomeZonePanel[] = [];

  return { upper, freezer, other };
}

/** Trailing empty "+" slots only — no fixed capacity. Empty zone gets 2; otherwise 1. */
export function emptyTrailingSlots(itemCount: number): number {
  return itemCount === 0 ? 2 : 1;
}
