"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ClipboardList,
  MoreVertical,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import type { FridgeItem, StorageZone, StorageZoneRow } from "@/types/database";
import {
  defaultExpiresAt,
  formatDDay,
  formatDDayShort,
  getDDay,
  getExpiryStatus,
  isExpiryTracked,
  type ExpiryStatus,
} from "@/lib/dday";
import { createClient } from "@/lib/supabase";
import {
  buildHomeZonePanels,
  type HomeZonePanel,
} from "@/lib/home-zones";
import {
  SaveCancelledError,
  isCookedDish,
  saveFridgeItem,
  saveFridgeItems,
} from "@/lib/fridge-item-upsert";
import { FoodIcon } from "@/components/ui/food-icon";
import { EXPIRY_STYLES } from "@/components/home/expiry-styles";
import { AddOptionsSheet } from "@/components/fridge/add-options-sheet";
import { ManualAddSheet } from "@/components/fridge/manual-add-sheet";
import {
  CookedDishAddSheet,
  type CookedDishPayload,
} from "@/components/fridge/cooked-dish-add-sheet";
import { VoiceRegisterFlow } from "@/components/fridge/voice-register-flow";
import { useOptionalVoiceAddRequest } from "@/components/fridge/voice-add-request";
import {
  ItemDetailSheet,
  type ConfirmMode,
} from "@/components/fridge/item-detail-sheet";
import { useDuplicateItemPrompt } from "@/hooks/use-duplicate-item-prompt";
import { Toast, useToast } from "@/components/ui/toast";

type ItemWithMeta = FridgeItem & {
  dDay: number | null;
  statusKey: ExpiryStatus;
};

function enrich(items: FridgeItem[]): ItemWithMeta[] {
  return items.map((item) => {
    const hasNoExpiry = Boolean(item.has_no_expiry);
    const dDay = hasNoExpiry ? null : getDDay(item.expires_at);
    return {
      ...item,
      dDay,
      statusKey: getExpiryStatus(dDay, hasNoExpiry),
    };
  });
}

type AddTarget = { zone: StorageZone; subZone: string | null };

type HomeScreenProps = {
  items: FridgeItem[];
  zones: StorageZoneRow[];
};

export function HomeScreen({ items: initialItems, zones: initialZones }: HomeScreenProps) {
  const router = useRouter();
  const voiceAddRequest = useOptionalVoiceAddRequest();
  const [items, setItems] = useState(initialItems);
  const [zones, setZones] = useState(initialZones);
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [showCookedDish, setShowCookedDish] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [voiceInitialUtterance, setVoiceInitialUtterance] = useState<
    string | undefined
  >();
  const [selectedItem, setSelectedItem] = useState<FridgeItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<HomeZonePanel | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const { resolveDuplicate, dialog: duplicateDialog } = useDuplicateItemPrompt();
  const { message, showToast } = useToast();

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    setZones(initialZones);
  }, [initialZones]);

  // Deep link / Bixby → open voice review with parsed utterance
  useEffect(() => {
    const text = voiceAddRequest?.utterance;
    if (!text) return;
    setVoiceInitialUtterance(text);
    setShowVoice(true);
    setShowAddOptions(false);
    voiceAddRequest.clearUtterance();
  }, [voiceAddRequest?.utterance]);

  const enriched = useMemo(() => enrich(items), [items]);
  const panels = useMemo(
    () => buildHomeZonePanels(zones, items),
    [zones, items],
  );
  const metaById = useMemo(
    () => Object.fromEntries(enriched.map((i) => [i.id, i])),
    [enriched],
  );

  const total = enriched.length;
  const tracked = enriched.filter((i) => isExpiryTracked(i));
  const expiredCount = tracked.filter(
    (i) => i.dDay !== null && i.dDay < 0,
  ).length;
  const imminentCount = tracked.filter(
    (i) => i.dDay !== null && i.dDay >= 0 && i.dDay <= 7,
  ).length;
  // 여유: 추적 대상 중 임박·만료가 아닌 항목 (+ 무기한은 여유에 포함)
  const freshCount = total - expiredCount - imminentCount;

  function openAdd(zone: StorageZone, subZone: string | null) {
    setAddTarget({ zone, subZone });
  }

  function openRename(panel: HomeZonePanel) {
    if (!panel.id || panel.isVirtual) {
      showToast("구조 편집에서 칸을 만든 뒤 이름을 바꿀 수 있어요");
      return;
    }
    setRenameTarget(panel);
    setRenameDraft(panel.label);
  }

  async function submitRename() {
    if (!renameTarget?.id || renaming) return;
    const next = renameDraft.trim();
    if (!next) {
      showToast("칸 이름을 입력해 주세요");
      return;
    }
    if (next === renameTarget.label) {
      setRenameTarget(null);
      return;
    }
    setRenaming(true);
    const supabase = createClient();
    const oldLabel = renameTarget.label;
    const { error } = await supabase
      .from("storage_zones")
      .update({ label: next })
      .eq("id", renameTarget.id);
    if (error) {
      console.error("[home] rename zone:", error.message);
      showToast("이름 변경에 실패했어요");
      setRenaming(false);
      return;
    }
    await supabase
      .from("fridge_items")
      .update({ sub_zone: next })
      .eq("zone", renameTarget.baseZone)
      .eq("sub_zone", oldLabel);

    setZones((prev) =>
      prev.map((z) => (z.id === renameTarget.id ? { ...z, label: next } : z)),
    );
    setItems((prev) =>
      prev.map((item) =>
        item.zone === renameTarget.baseZone && item.sub_zone === oldLabel
          ? { ...item, sub_zone: next }
          : item,
      ),
    );
    setRenameTarget(null);
    setRenaming(false);
    router.refresh();
  }

  async function reorderZones(baseZone: StorageZone, orderedIds: string[]) {
    setZones((prev) => {
      const next = prev.map((z) => {
        if (z.base_zone !== baseZone) return z;
        const idx = orderedIds.indexOf(z.id);
        if (idx < 0) return z;
        return { ...z, sort_order: idx };
      });
      return next;
    });

    const supabase = createClient();
    await Promise.all(
      orderedIds.map((id, sort_order) =>
        supabase.from("storage_zones").update({ sort_order }).eq("id", id),
      ),
    );
    router.refresh();
  }

  async function handleManualAdd(payload: {
    name: string;
    quantity: number;
    unit: string | null;
    zone: StorageZone;
    sub_zone: string | null;
    category: string | null;
    expires_at: string | null;
    has_no_expiry: boolean;
  }) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인이 필요해요");

    const result = await saveFridgeItem(
      user.id,
      {
        ...payload,
        input_method: "수동",
      },
      {
        supabase,
        ownedItems: items,
        resolveDuplicate,
      },
    );

    setItems((prev) => {
      if (result.status === "merged") {
        return prev.map((item) =>
          item.id === result.item.id ? result.item : item,
        );
      }
      return [result.item, ...prev];
    });
    router.refresh();
  }

  async function handleCookedDishAdd(payload: CookedDishPayload) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인이 필요해요");

    const result = await saveFridgeItem(
      user.id,
      {
        ...payload,
        sub_zone: null,
        category: "완성요리",
        item_type: "완성요리",
        input_method: "수동",
      },
      {
        supabase,
        ownedItems: items,
        resolveDuplicate: async () => "separate",
      },
    );

    setItems((prev) => [result.item, ...prev]);
    router.refresh();
  }

  async function handleVoiceRegister(
    payloads: {
      name: string;
      quantity: number;
      unit: string;
      zone: StorageZone;
      category: string;
      expires_at: string | null;
      has_no_expiry: boolean;
    }[],
  ) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const results = await saveFridgeItems(
        user.id,
        payloads.map((payload) => ({
          ...payload,
          sub_zone: null,
          expires_at: payload.has_no_expiry
            ? null
            : (payload.expires_at ??
              defaultExpiresAt(payload.name, payload.category)),
          input_method: "음성" as const,
        })),
        {
          supabase,
          ownedItems: items,
          resolveDuplicate,
        },
      );

      setItems((prev) => {
        let next = [...prev];
        for (const result of results) {
          if (result.status === "merged") {
            next = next.map((item) =>
              item.id === result.item.id ? result.item : item,
            );
          } else {
            next = [result.item, ...next];
          }
        }
        return next;
      });
      router.refresh();
    } catch (err) {
      if (err instanceof SaveCancelledError) throw err;
      console.error("[home] voice register:", err);
    }
  }

  async function handleSavePartial(newQuantity: number) {
    if (!selectedItem) return;
    if (newQuantity <= 0) {
      await handleRemove("consume");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from("fridge_items")
      .update({ quantity: newQuantity })
      .eq("id", selectedItem.id);
    if (!error) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id
            ? { ...item, quantity: newQuantity }
            : item,
        ),
      );
      setSelectedItem(null);
      router.refresh();
    }
  }

  async function handleRemove(reason: ConfirmMode) {
    if (!selectedItem) return;
    const status = reason === "discard" ? "폐기" : "소진";
    const supabase = createClient();
    const { error } = await supabase
      .from("fridge_items")
      .update({ status })
      .eq("id", selectedItem.id);
    if (!error) {
      setItems((prev) => prev.filter((item) => item.id !== selectedItem.id));
      setSelectedItem(null);
      router.refresh();
    }
  }

  async function handleSaveExpires(payload: {
    expires_at: string | null;
    has_no_expiry: boolean;
  }) {
    if (!selectedItem) return;
    const supabase = createClient();
    const next = {
      expires_at: payload.has_no_expiry ? null : payload.expires_at,
      has_no_expiry: payload.has_no_expiry,
    };
    const { error } = await supabase
      .from("fridge_items")
      .update(next)
      .eq("id", selectedItem.id);
    if (error) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === selectedItem.id ? { ...item, ...next } : item,
      ),
    );
    setSelectedItem((prev) => (prev ? { ...prev, ...next } : prev));
    router.refresh();
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-28 scrollbar-hide">
        <div className="flex flex-col gap-4 bg-background px-5 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[22px] font-bold leading-none text-foreground">
                내 냉장고
              </h1>
              <span className="flex size-6 items-center justify-center text-muted-foreground">
                <ChevronDown size={14} strokeWidth={2.5} />
              </span>
            </div>
            <button
              type="button"
              className="touch-target flex size-11 items-center justify-center rounded-[18px] border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
              aria-label="알림"
            >
              <Bell size={18} className="text-foreground/55" />
            </button>
          </div>

          <div className="flex flex-col gap-4 rounded-[20px] bg-primary px-5 pt-4 pb-5 shadow-[0_4px_8px_rgba(61,112,88,0.25)]">
            <div className="flex items-center gap-2">
              <div className="flex size-[22px] items-center justify-center rounded-[11px] bg-white/15">
                <ClipboardList size={12} className="text-white" />
              </div>
              <p className="text-[13px] font-bold text-white/80">냉장고 현황</p>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center">
              {[
                { value: total, label: "전체" },
                { value: imminentCount, label: "임박" },
                { value: expiredCount, label: "만료" },
                { value: freshCount, label: "여유" },
              ].map((stat, idx) => (
                <div key={stat.label} className="contents">
                  {idx > 0 && <div className="mx-auto h-11 w-px bg-white/20" />}
                  <div className="flex flex-col items-center gap-1.5">
                    <p className="min-w-[2ch] text-center text-[26px] font-bold leading-9 text-white tabular-nums">
                      {stat.value}
                    </p>
                    <p className="text-[11px] font-medium text-white/70">
                      {stat.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 px-4 pb-6 pt-1">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-bold leading-[19.5px] text-foreground">
              냉장고 보기
            </h2>
            {!panels.needsStructureSetup && (
              <Link
                href="/settings/zones"
                className="flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#2d5a45]"
              >
                <SlidersHorizontal size={14} />
                구조 편집
              </Link>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-3 rounded-[20px] border border-border bg-[#f0efe9] p-3 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            {panels.needsStructureSetup ? (
              <StructureSetupPrompt />
            ) : (
              <>
                <ZoneSection
                  title="냉장"
                  panels={panels.fridge}
                  variant="fridge"
                  onAdd={openAdd}
                  onSelectItem={setSelectedItem}
                  onRename={openRename}
                  onReorder={(ids) => void reorderZones("냉장", ids)}
                  metaById={metaById}
                />
                <ZoneSection
                  title="냉동"
                  panels={panels.freezer}
                  variant="freezer"
                  onAdd={openAdd}
                  onSelectItem={setSelectedItem}
                  onRename={openRename}
                  onReorder={(ids) => void reorderZones("냉동", ids)}
                  metaById={metaById}
                />
                <ZoneSection
                  title="실온"
                  panels={panels.ambient}
                  variant="ambient"
                  onAdd={openAdd}
                  onSelectItem={setSelectedItem}
                  onRename={openRename}
                  onReorder={(ids) => void reorderZones("실온", ids)}
                  metaById={metaById}
                />
                <ZoneSection
                  title="김치냉장고"
                  panels={panels.kimchi}
                  variant="kimchi"
                  onAdd={openAdd}
                  onSelectItem={setSelectedItem}
                  onRename={openRename}
                  onReorder={(ids) => void reorderZones("김치냉장고", ids)}
                  metaById={metaById}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAddOptions(true)}
        className="fab-safe-bottom absolute right-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_12px_rgba(61,112,88,0.4)] transition-transform active:scale-95"
        aria-label="재료 추가"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {showAddOptions && (
        <AddOptionsSheet
          onClose={() => setShowAddOptions(false)}
          onSelectManual={() => {
            setShowManualAdd(true);
          }}
          onSelectVoice={() => {
            setVoiceInitialUtterance(undefined);
            setShowVoice(true);
          }}
          onSelectReceipt={() => {
            router.push("/fridge/add/receipt");
          }}
          onSelectBarcode={() => {
            router.push("/fridge/add/barcode");
          }}
          onSelectCookedDish={() => {
            setShowCookedDish(true);
          }}
        />
      )}

      {(addTarget || showManualAdd) && (
        <ManualAddSheet
          onClose={() => {
            setAddTarget(null);
            setShowManualAdd(false);
          }}
          initialZone={addTarget?.zone ?? "냉장"}
          initialSubZone={addTarget?.subZone ?? null}
          onSubmit={handleManualAdd}
        />
      )}

      {showCookedDish && (
        <CookedDishAddSheet
          onClose={() => setShowCookedDish(false)}
          onSubmit={handleCookedDishAdd}
        />
      )}

      {showVoice && (
        <VoiceRegisterFlow
          key={voiceInitialUtterance ?? "mic"}
          initialUtterance={voiceInitialUtterance}
          onClose={() => {
            setShowVoice(false);
            setVoiceInitialUtterance(undefined);
          }}
          onFallbackToManual={() => {
            setShowVoice(false);
            setVoiceInitialUtterance(undefined);
            setShowManualAdd(true);
          }}
          onRegister={handleVoiceRegister}
        />
      )}

      {selectedItem && (
        <ItemDetailSheet
          key={selectedItem.id}
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSavePartial={handleSavePartial}
          onRemove={handleRemove}
          onSaveExpires={handleSaveExpires}
        />
      )}

      {renameTarget && (
        <div className="absolute inset-0 z-50 flex items-end bg-black/40 p-4">
          <div
            className="w-full rounded-2xl bg-card p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="칸 이름 수정"
          >
            <p className="text-[14px] font-bold text-foreground">칸 이름 수정</p>
            <input
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitRename();
              }}
              className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-primary"
              placeholder="예: 야채칸"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="flex-1 rounded-xl border border-border py-2.5 text-[13px] font-semibold text-foreground"
              >
                취소
              </button>
              <button
                type="button"
                disabled={renaming}
                onClick={() => void submitRename()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {duplicateDialog}
      <Toast message={message} />
    </div>
  );
}

function StructureSetupPrompt() {
  return (
    <div className="flex flex-col items-center gap-4 px-3 py-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-white text-[28px] shadow-sm">
        🧊
      </div>
      <div className="space-y-1.5">
        <p className="text-[15px] font-bold text-foreground">
          냉장고 구조를 먼저 만들어 주세요
        </p>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          기본으로 보이는 칸은 예시예요.
          <br />
          현재 상태를 맞추려면 구조 편집에서
          <br />
          내 냉장고 칸을 만들어 주세요.
        </p>
      </div>
      <Link
        href="/settings/zones"
        className="flex w-full max-w-[260px] items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-[14px] font-bold text-primary-foreground shadow-[0_6px_16px_rgba(61,112,88,0.28)]"
      >
        <SlidersHorizontal size={16} />
        구조 편집하기
      </Link>
    </div>
  );
}

type ZoneVariant = "fridge" | "freezer" | "ambient" | "kimchi";

const ZONE_THEME: Record<
  ZoneVariant,
  {
    card: string;
    title: string;
    empty: string;
    add: string;
    rowHover: string;
    itemText: string;
  }
> = {
  fridge: {
    card: "border-border bg-white",
    title: "text-foreground/70",
    empty: "text-muted-foreground",
    add: "border-[#e0ddd4] text-muted-foreground",
    rowHover: "hover:bg-[#f5f3ee]",
    itemText: "text-foreground",
  },
  freezer: {
    card: "border-[rgba(184,212,232,0.55)] bg-[#e8f4ff]",
    title: "text-[#2563a8]",
    empty: "text-[#6a92b0]",
    add: "border-[#b8d4e8] text-[#3a6a8a]",
    rowHover: "hover:bg-[#dceef8]",
    itemText: "text-[#2a5570]",
  },
  ambient: {
    card: "border-[#e8d9c4] bg-[#faf4ea]",
    title: "text-[#8a6a3a]",
    empty: "text-[#b09a78]",
    add: "border-[#e0d0b8] text-[#8a6a3a]",
    rowHover: "hover:bg-[#f3eadc]",
    itemText: "text-[#5c4528]",
  },
  kimchi: {
    card: "border-[#c9ddc8] bg-[#eef6ee]",
    title: "text-[#3d7058]",
    empty: "text-[#7a9a88]",
    add: "border-[#c0d8c4] text-[#3d7058]",
    rowHover: "hover:bg-[#e2efe4]",
    itemText: "text-[#2a4f3c]",
  },
};

const LONG_PRESS_MS = 420;
const FLIP_MS = 220;

function ZoneSection({
  title,
  panels,
  variant,
  onAdd,
  onSelectItem,
  onRename,
  onReorder,
  metaById,
}: {
  title: string;
  panels: HomeZonePanel[];
  variant: ZoneVariant;
  onAdd: (zone: StorageZone, subZone: string | null) => void;
  onSelectItem: (item: FridgeItem) => void;
  onRename: (panel: HomeZonePanel) => void;
  onReorder: (orderedIds: string[]) => void;
  metaById: Record<string, ItemWithMeta>;
}) {
  const [order, setOrder] = useState(panels);
  const dragId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const longPressTimer = useRef<number | null>(null);
  const pointerOrigin = useRef({ x: 0, y: 0 });
  const lastPointer = useRef({ x: 0, y: 0 });
  const grabOffset = useRef({ x: 0, y: 0 });
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastRects = useRef<Record<string, DOMRect>>({});

  useEffect(() => {
    setOrder(panels);
  }, [panels]);

  function naturalRect(node: HTMLDivElement) {
    const prev = node.style.transform;
    node.style.transform = "none";
    const rect = node.getBoundingClientRect();
    node.style.transform = prev;
    return rect;
  }

  function syncDragOffsetToFinger() {
    const id = dragId.current;
    if (!id) return;
    const node = cardRefs.current[id];
    if (!node) return;
    const rect = naturalRect(node);
    setDragOffset({
      x: lastPointer.current.x - grabOffset.current.x - rect.left,
      y: lastPointer.current.y - grabOffset.current.y - rect.top,
    });
  }

  // FLIP: animate siblings into their new grid slots after reorder.
  useLayoutEffect(() => {
    const nextRects: Record<string, DOMRect> = {};
    for (const panel of order) {
      if (!panel.id) continue;
      const node = cardRefs.current[panel.id];
      if (!node) continue;

      if (panel.id === dragId.current) {
        nextRects[panel.id] = naturalRect(node);
        continue;
      }

      const next = node.getBoundingClientRect();
      nextRects[panel.id] = next;
      const prev = lastRects.current[panel.id];
      if (!prev) continue;
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      node.style.transition = "none";
      node.style.transform = `translate(${dx}px, ${dy}px)`;
      void node.offsetWidth;
      node.style.transition = `transform ${FLIP_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
      node.style.transform = "";
      const clear = () => {
        node.style.transition = "";
        node.removeEventListener("transitionend", clear);
      };
      node.addEventListener("transitionend", clear);
    }
    lastRects.current = nextRects;
    // Keep the dragged card glued to the finger after layout shifts.
    if (dragId.current) syncDragOffsetToFinger();
  }, [order]);

  if (panels.length === 0) return null;

  function clearLongPress() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function snapshotRects() {
    const rects: Record<string, DOMRect> = {};
    for (const panel of order) {
      if (!panel.id) continue;
      const node = cardRefs.current[panel.id];
      if (!node) continue;
      rects[panel.id] =
        panel.id === dragId.current ? naturalRect(node) : node.getBoundingClientRect();
    }
    lastRects.current = rects;
  }

  function startLongPress(panel: HomeZonePanel, e: ReactPointerEvent) {
    if (!panel.id) return;
    clearLongPress();
    pointerOrigin.current = { x: e.clientX, y: e.clientY };
    lastPointer.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = window.setTimeout(() => {
      const node = cardRefs.current[panel.id!];
      if (!node) return;
      const rect = naturalRect(node);
      grabOffset.current = {
        x: lastPointer.current.x - rect.left,
        y: lastPointer.current.y - rect.top,
      };
      snapshotRects();
      dragId.current = panel.id;
      setDraggingId(panel.id);
      setDragOffset({ x: 0, y: 0 });
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }, LONG_PRESS_MS);
  }

  function moveDragTo(targetId: string) {
    if (!dragId.current || dragId.current === targetId) return;
    snapshotRects();
    setOrder((prev) => {
      const from = prev.findIndex((p) => p.id === dragId.current);
      const to = prev.findIndex((p) => p.id === targetId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function onPointerMove(e: ReactPointerEvent) {
    lastPointer.current = { x: e.clientX, y: e.clientY };
    if (!dragId.current) {
      const dx = e.clientX - pointerOrigin.current.x;
      const dy = e.clientY - pointerOrigin.current.y;
      if (Math.hypot(dx, dy) > 10) clearLongPress();
      return;
    }
    syncDragOffsetToFinger();

    const floating = cardRefs.current[dragId.current];
    if (floating) floating.style.pointerEvents = "none";
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (floating) floating.style.pointerEvents = "";
    if (!el) return;
    const card = el.closest("[data-zone-id]") as HTMLElement | null;
    const targetId = card?.dataset.zoneId;
    if (targetId) moveDragTo(targetId);
  }

  function endDrag() {
    clearLongPress();
    if (!dragId.current) return;
    const ids = order.map((p) => p.id).filter((id): id is string => Boolean(id));
    dragId.current = null;
    setDraggingId(null);
    setDragOffset({ x: 0, y: 0 });
    onReorder(ids);
  }

  return (
    <section className="flex flex-col gap-1.5">
      <p className="px-0.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {order.map((panel) => (
          <ZoneCard
            key={panel.key}
            panel={panel}
            variant={variant}
            dragging={draggingId === panel.id}
            dragOffset={
              draggingId === panel.id ? dragOffset : { x: 0, y: 0 }
            }
            cardRef={(node) => {
              if (panel.id) cardRefs.current[panel.id] = node;
            }}
            onAdd={() => onAdd(panel.baseZone, panel.label)}
            onSelectItem={onSelectItem}
            onRename={() => onRename(panel)}
            onPointerDownCard={(e) => startLongPress(panel, e)}
            onPointerMoveCard={onPointerMove}
            onPointerUpCard={endDrag}
            onPointerCancelCard={endDrag}
            metaById={metaById}
          />
        ))}
      </div>
    </section>
  );
}

function ZoneCard({
  panel,
  variant,
  dragging,
  dragOffset,
  cardRef,
  onAdd,
  onSelectItem,
  onRename,
  onPointerDownCard,
  onPointerMoveCard,
  onPointerUpCard,
  onPointerCancelCard,
  metaById,
}: {
  panel: HomeZonePanel;
  variant: ZoneVariant;
  dragging: boolean;
  dragOffset: { x: number; y: number };
  cardRef: (node: HTMLDivElement | null) => void;
  onAdd: () => void;
  onSelectItem: (item: FridgeItem) => void;
  onRename: () => void;
  onPointerDownCard: (e: ReactPointerEvent) => void;
  onPointerMoveCard: (e: ReactPointerEvent) => void;
  onPointerUpCard: () => void;
  onPointerCancelCard: () => void;
  metaById: Record<string, ItemWithMeta>;
}) {
  const theme = ZONE_THEME[variant];

  return (
    <div
      ref={cardRef}
      data-zone-id={panel.id ?? undefined}
      className={`relative flex touch-none flex-col rounded-xl border will-change-transform ${theme.card} ${
        dragging
          ? "z-30 shadow-[0_16px_32px_rgba(0,0,0,0.2)] ring-2 ring-primary/35"
          : "z-0"
      }`}
      style={
        dragging
          ? {
              transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(1.04)`,
              transition: "box-shadow 160ms ease",
            }
          : undefined
      }
      onPointerDown={onPointerDownCard}
      onPointerMove={onPointerMoveCard}
      onPointerUp={onPointerUpCard}
      onPointerCancel={onPointerCancelCard}
    >
      <div className="flex items-center gap-1 px-2 pt-1.5 pb-1">
        <p
          className={`min-w-0 flex-1 truncate text-[11px] font-semibold tracking-tight ${theme.title}`}
        >
          {panel.label}
          {panel.items.length > 0 && (
            <span className="ml-1 font-medium text-muted-foreground tabular-nums">
              · {panel.items.length}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="touch-target flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
          aria-label={`${panel.label} 메뉴`}
        >
          <MoreVertical size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-0.5 px-1.5 pb-1.5">
        {panel.items.length === 0 ? (
          <p className={`px-2 py-1.5 text-[11px] ${theme.empty}`}>비어 있어요</p>
        ) : (
          panel.items.map((item) => (
            <ItemListRow
              key={item.id}
              item={item}
              meta={metaById[item.id]}
              variant={variant}
              onClick={() => onSelectItem(item)}
            />
          ))
        )}
        <button
          type="button"
          onClick={onAdd}
          onPointerDown={(e) => e.stopPropagation()}
          className={`flex h-8 items-center justify-center gap-1 rounded-lg border border-dashed text-[11px] font-medium ${theme.add}`}
          aria-label={`${panel.label}에 추가`}
        >
          <Plus size={12} strokeWidth={2.5} />
          추가
        </button>
      </div>
    </div>
  );
}

function ItemListRow({
  item,
  meta,
  variant,
  onClick,
}: {
  item: FridgeItem;
  meta?: ItemWithMeta;
  variant: ZoneVariant;
  onClick: () => void;
}) {
  const theme = ZONE_THEME[variant];
  const s = EXPIRY_STYLES[meta?.statusKey ?? "unset"];
  const cooked = isCookedDish(item);
  const qty =
    item.quantity != null
      ? `${item.quantity}${item.unit ? item.unit : ""}`
      : null;

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(e: ReactPointerEvent) => e.stopPropagation()}
      className={`flex h-9 w-full items-center gap-1.5 rounded-lg px-1.5 text-left transition-colors active:bg-black/[0.04] ${theme.rowHover}`}
    >
      <FoodIcon
        name={item.name}
        category={item.category}
        itemType={item.item_type}
        size={18}
      />
      <span
        className={`min-w-0 flex-1 truncate text-[12px] font-medium leading-tight ${theme.itemText}`}
      >
        {item.name}
        {cooked && (
          <span className="ml-1 text-[9px] font-bold text-[#c47a2c]">요리</span>
        )}
      </span>
      {qty && (
        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
          {qty}
        </span>
      )}
      {meta && (
        <span
          className={`shrink-0 rounded px-1 py-px text-[9px] font-bold leading-3 tabular-nums ${s.badge}`}
          title={formatDDay(meta.dDay, Boolean(meta.has_no_expiry))}
        >
          {formatDDayShort(meta.dDay, Boolean(meta.has_no_expiry))}
        </span>
      )}
    </button>
  );
}
