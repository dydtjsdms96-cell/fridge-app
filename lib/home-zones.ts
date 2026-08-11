import type { FridgeItem, StorageZone, StorageZoneRow } from "@/types/database";

/** Figma 홈과 맞춘 기본 구조 (storage_zones 비어 있을 때 가상 표시용 — UI에서는 CTA로 대체). */
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
  id: string | null;
  baseZone: StorageZone;
  label: string;
  sortOrder: number;
  /** true when label comes from DEFAULT_HOME_ZONES, not DB */
  isVirtual: boolean;
  items: FridgeItem[];
};

export type HomeZoneSections = {
  fridge: HomeZonePanel[];
  freezer: HomeZonePanel[];
  ambient: HomeZonePanel[];
  kimchi: HomeZonePanel[];
  /** True when the user has not configured storage_zones yet */
  needsStructureSetup: boolean;
};

function panelsForBase(
  baseZone: StorageZone,
  zoneRows: StorageZoneRow[],
  useDefaults: boolean,
): Array<{
  id: string | null;
  label: string;
  sortOrder: number;
  isVirtual: boolean;
}> {
  const labels = zoneRows
    .filter((z) => z.base_zone === baseZone)
    .slice()
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        a.label.localeCompare(b.label, "ko"),
    )
    .map((z) => ({
      id: z.id,
      label: z.label,
      sortOrder: z.sort_order ?? 0,
      isVirtual: false,
    }));

  if (labels.length > 0) return labels;

  if (useDefaults) {
    return DEFAULT_HOME_ZONES.filter((z) => z.base_zone === baseZone).map(
      (z, i) => ({
        id: null,
        label: z.label,
        sortOrder: i,
        isVirtual: true,
      }),
    );
  }

  return [];
}

/**
 * Build home fridge panels from storage_zones + items.
 * - Empty storage_zones → needsStructureSetup (defaults only for item bucketing)
 * - Items with null/unknown sub_zone → first panel of that base_zone
 * - 실온/김치 appear only when they have zones or items
 */
export function buildHomeZonePanels(
  zoneRows: StorageZoneRow[],
  items: FridgeItem[],
): HomeZoneSections {
  const needsStructureSetup = zoneRows.length === 0;
  const useDefaults = needsStructureSetup;
  const panels: HomeZonePanel[] = [];

  const ensurePanel = (
    baseZone: StorageZone,
    label: string,
    opts: { id: string | null; sortOrder: number; isVirtual: boolean },
  ) => {
    const key = `${baseZone}:${label}`;
    let panel = panels.find((p) => p.key === key);
    if (!panel) {
      panel = {
        key,
        id: opts.id,
        baseZone,
        label,
        sortOrder: opts.sortOrder,
        isVirtual: opts.isVirtual,
        items: [],
      };
      panels.push(panel);
    }
    return panel;
  };

  for (const base of ["냉장", "냉동", "실온", "김치냉장고"] as StorageZone[]) {
    for (const p of panelsForBase(base, zoneRows, useDefaults)) {
      ensurePanel(base, p.label, p);
    }
  }

  const labeledFor = (base: StorageZone) =>
    panels.filter((p) => p.baseZone === base).map((p) => p.label);

  for (const item of items) {
    const labels = labeledFor(item.zone);
    const sub = item.sub_zone?.trim() || null;

    if (sub && labels.includes(sub)) {
      ensurePanel(item.zone, sub, {
        id: null,
        sortOrder: 999,
        isVirtual: false,
      }).items.push(item);
      continue;
    }

    if (labels.length > 0) {
      const first = panels
        .filter((p) => p.baseZone === item.zone)
        .sort((a, b) => a.sortOrder - b.sortOrder)[0]!;
      first.items.push(item);
      continue;
    }

    ensurePanel(item.zone, item.zone, {
      id: null,
      sortOrder: 0,
      isVirtual: true,
    }).items.push(item);
  }

  const visible = panels.filter((p) => {
    if (p.items.length > 0) return true;
    if (p.baseZone === "냉장" || p.baseZone === "냉동") return true;
    return !p.isVirtual;
  });

  const byOrder = (a: HomeZonePanel, b: HomeZonePanel) =>
    a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "ko");

  return {
    fridge: visible.filter((p) => p.baseZone === "냉장").sort(byOrder),
    freezer: visible.filter((p) => p.baseZone === "냉동").sort(byOrder),
    ambient: visible.filter((p) => p.baseZone === "실온").sort(byOrder),
    kimchi: visible.filter((p) => p.baseZone === "김치냉장고").sort(byOrder),
    needsStructureSetup,
  };
}
