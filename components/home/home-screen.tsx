"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ClipboardList,
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
import {
  ItemDetailSheet,
  type ConfirmMode,
} from "@/components/fridge/item-detail-sheet";
import { useDuplicateItemPrompt } from "@/hooks/use-duplicate-item-prompt";

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

export function HomeScreen({ items: initialItems, zones }: HomeScreenProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [showCookedDish, setShowCookedDish] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FridgeItem | null>(null);
  const { resolveDuplicate, dialog: duplicateDialog } = useDuplicateItemPrompt();

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

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
            <Link
              href="/settings/zones"
              className="flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#2d5a45]"
            >
              <SlidersHorizontal size={14} />
              구조 편집
            </Link>
          </div>

          <div className="flex flex-1 flex-col gap-3 rounded-[20px] border border-border bg-[#f0efe9] p-3 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            <ZoneSection
              title="냉장"
              panels={panels.fridge}
              variant="fridge"
              onAdd={openAdd}
              onSelectItem={setSelectedItem}
              metaById={metaById}
            />
            <ZoneSection
              title="냉동"
              panels={panels.freezer}
              variant="freezer"
              onAdd={openAdd}
              onSelectItem={setSelectedItem}
              metaById={metaById}
            />
            <ZoneSection
              title="실온"
              panels={panels.ambient}
              variant="ambient"
              onAdd={openAdd}
              onSelectItem={setSelectedItem}
              metaById={metaById}
            />
            <ZoneSection
              title="김치냉장고"
              panels={panels.kimchi}
              variant="kimchi"
              onAdd={openAdd}
              onSelectItem={setSelectedItem}
              metaById={metaById}
            />
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
          onClose={() => setShowVoice(false)}
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

      {duplicateDialog}
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
    accent?: string;
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
    accent: "bg-[#c2d8e8]",
  },
  ambient: {
    card: "border-[#e8d9c4] bg-[#faf4ea]",
    title: "text-[#8a6a3a]",
    empty: "text-[#b09a78]",
    add: "border-[#e0d0b8] text-[#8a6a3a]",
    rowHover: "hover:bg-[#f3eadc]",
    itemText: "text-[#5c4528]",
    accent: "bg-[#e0d0b8]",
  },
  kimchi: {
    card: "border-[#c9ddc8] bg-[#eef6ee]",
    title: "text-[#3d7058]",
    empty: "text-[#7a9a88]",
    add: "border-[#c0d8c4] text-[#3d7058]",
    rowHover: "hover:bg-[#e2efe4]",
    itemText: "text-[#2a4f3c]",
    accent: "bg-[#c0d8c4]",
  },
};

function ZoneSection({
  title,
  panels,
  variant,
  onAdd,
  onSelectItem,
  metaById,
}: {
  title: string;
  panels: HomeZonePanel[];
  variant: ZoneVariant;
  onAdd: (zone: StorageZone, subZone: string | null) => void;
  onSelectItem: (item: FridgeItem) => void;
  metaById: Record<string, ItemWithMeta>;
}) {
  if (panels.length === 0) return null;

  return (
    <section className="flex flex-col gap-1.5">
      <p className="px-0.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {panels.map((panel, index) => (
          <ZoneCard
            key={panel.key}
            panel={panel}
            handleSide={index % 2 === 0 ? "right" : "left"}
            variant={variant}
            onAdd={() => onAdd(panel.baseZone, panel.label)}
            onSelectItem={onSelectItem}
            metaById={metaById}
          />
        ))}
      </div>
    </section>
  );
}

/** Compact zone panel — list rows, page scroll only (no nested scroll). */
function ZoneCard({
  panel,
  handleSide,
  variant,
  onAdd,
  onSelectItem,
  metaById,
}: {
  panel: HomeZonePanel;
  handleSide?: "left" | "right";
  variant: ZoneVariant;
  onAdd: () => void;
  onSelectItem: (item: FridgeItem) => void;
  metaById: Record<string, ItemWithMeta>;
}) {
  const theme = ZONE_THEME[variant];
  const showDoorHandle = variant === "fridge";

  return (
    <div className={`flex flex-col rounded-xl border ${theme.card}`}>
      <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
        {showDoorHandle && handleSide === "left" && (
          <div className="h-4 w-0.5 shrink-0 rounded bg-[#d4d0c8]" aria-hidden />
        )}
        {!showDoorHandle && theme.accent && (
          <div
            className={`h-0.5 w-8 shrink-0 rounded ${theme.accent}`}
            aria-hidden
          />
        )}
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
        {showDoorHandle && handleSide === "right" && (
          <div className="h-4 w-0.5 shrink-0 rounded bg-[#d4d0c8]" aria-hidden />
        )}
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
