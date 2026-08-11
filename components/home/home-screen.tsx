"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
  type WheelEvent,
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
  getDDay,
  getExpiryStatus,
  type ExpiryStatus,
} from "@/lib/dday";
import { createClient } from "@/lib/supabase";
import {
  buildHomeZonePanels,
  emptyTrailingSlots,
  type HomeZonePanel,
} from "@/lib/home-zones";
import { FoodIcon } from "@/components/ui/food-icon";
import { EXPIRY_STYLES } from "@/components/home/expiry-styles";
import { AddOptionsSheet } from "@/components/fridge/add-options-sheet";
import { ManualAddSheet } from "@/components/fridge/manual-add-sheet";
import { VoiceRegisterFlow } from "@/components/fridge/voice-register-flow";
import {
  ItemDetailSheet,
  type ConfirmMode,
} from "@/components/fridge/item-detail-sheet";

type ItemWithMeta = FridgeItem & {
  dDay: number | null;
  statusKey: ExpiryStatus;
};

function enrich(items: FridgeItem[]): ItemWithMeta[] {
  return items.map((item) => {
    const dDay = getDDay(item.expires_at);
    return { ...item, dDay, statusKey: getExpiryStatus(dDay) };
  });
}

function shortDDay(dDay: number | null): string {
  if (dDay === null) return "—";
  if (dDay < 0) return `+${Math.abs(dDay)}`;
  return `D-${dDay}`;
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
  const [showVoice, setShowVoice] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FridgeItem | null>(null);

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
  const expiredCount = enriched.filter(
    (i) => i.dDay !== null && i.dDay < 0,
  ).length;
  const imminentCount = enriched.filter(
    (i) => i.dDay !== null && i.dDay >= 0 && i.dDay <= 7,
  ).length;
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
    expires_at: string;
  }) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인이 필요해요");

    const { data, error } = await supabase
      .from("fridge_items")
      .insert({
        user_id: user.id,
        name: payload.name,
        quantity: payload.quantity,
        unit: payload.unit,
        zone: payload.zone,
        sub_zone: payload.sub_zone,
        category: payload.category,
        expires_at: payload.expires_at,
        status: "보유",
        input_method: "수동",
        purchased_at: new Date().toISOString().slice(0, 10),
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    if (data) {
      setItems((prev) => [data as FridgeItem, ...prev]);
      router.refresh();
    }
  }

  async function handleVoiceRegister(
    payloads: {
      name: string;
      quantity: number;
      unit: string;
      zone: StorageZone;
      category: string;
    }[],
  ) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const rows = payloads.map((payload) => ({
      user_id: user.id,
      name: payload.name,
      quantity: payload.quantity,
      unit: payload.unit,
      zone: payload.zone,
      category: payload.category,
      expires_at: defaultExpiresAt(payload.name, payload.category),
      status: "보유" as const,
      input_method: "음성" as const,
      purchased_at: new Date().toISOString().slice(0, 10),
    }));

    const { data, error } = await supabase
      .from("fridge_items")
      .insert(rows)
      .select("*");

    if (!error && data) {
      setItems((prev) => [...(data as FridgeItem[]), ...prev]);
      router.refresh();
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

  async function handleSaveExpires(expiresAt: string) {
    if (!selectedItem) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("fridge_items")
      .update({ expires_at: expiresAt })
      .eq("id", selectedItem.id);
    if (error) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === selectedItem.id
          ? { ...item, expires_at: expiresAt }
          : item,
      ),
    );
    setSelectedItem((prev) =>
      prev ? { ...prev, expires_at: expiresAt } : prev,
    );
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
              className="flex size-9 items-center justify-center rounded-[18px] border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
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
                    <p className="font-sans text-[26px] font-bold leading-9 text-white [font-feature-settings:'zero'_0] [font-variant-numeric:normal]">
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

          <div className="flex flex-1 flex-col rounded-[24px] border border-border bg-[#f0efe9] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            {panels.upper.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {panels.upper.map((panel, index) => (
                  <ZoneCard
                    key={panel.key}
                    panel={panel}
                    handleSide={index % 2 === 0 ? "right" : "left"}
                    variant="door"
                    onAdd={() => openAdd(panel.baseZone, panel.label)}
                    onSelectItem={setSelectedItem}
                    metaById={metaById}
                  />
                ))}
              </div>
            )}

            {panels.freezer.map((panel) => (
              <ZoneCard
                key={panel.key}
                panel={panel}
                className={panels.upper.length > 0 ? "mt-3" : undefined}
                variant="freezer"
                onAdd={() => openAdd(panel.baseZone, panel.label)}
                onSelectItem={setSelectedItem}
                metaById={metaById}
              />
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAddOptions(true)}
        className="absolute right-5 bottom-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_12px_rgba(61,112,88,0.4)] transition-transform active:scale-95"
        aria-label="재료 추가"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {showAddOptions && (
        <AddOptionsSheet
          onClose={() => setShowAddOptions(false)}
          onSelectManual={() => {
            setShowAddOptions(false);
            setShowManualAdd(true);
          }}
          onSelectVoice={() => {
            setShowAddOptions(false);
            setShowVoice(true);
          }}
          onSelectReceipt={() => {
            setShowAddOptions(false);
            router.push("/fridge/add/receipt");
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

      {showVoice && (
        <VoiceRegisterFlow
          onClose={() => setShowVoice(false)}
          onRegister={handleVoiceRegister}
        />
      )}

      {selectedItem && (
        <ItemDetailSheet
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSavePartial={handleSavePartial}
          onRemove={handleRemove}
          onSaveExpires={handleSaveExpires}
        />
      )}
    </div>
  );
}

/** Keep nested zone scroll from chaining into the page scroll. */
function useIsolatedScroll() {
  const ref = useRef<HTMLDivElement>(null);

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const canScroll = scrollHeight > clientHeight + 1;
    if (!canScroll) return;

    const atTop = scrollTop <= 0;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
    if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
      // allow page scroll only at edges
      return;
    }
    e.stopPropagation();
  }

  function onScroll(e: UIEvent<HTMLDivElement>) {
    e.stopPropagation();
  }

  return { ref, onWheel, onScroll };
}

function ZoneCard({
  panel,
  handleSide,
  variant,
  className,
  onAdd,
  onSelectItem,
  metaById,
}: {
  panel: HomeZonePanel;
  handleSide?: "left" | "right";
  variant: "door" | "freezer";
  className?: string;
  onAdd: () => void;
  onSelectItem: (item: FridgeItem) => void;
  metaById: Record<string, ItemWithMeta>;
}) {
  const empties = emptyTrailingSlots(panel.items.length);
  const scroll = useIsolatedScroll();
  const isFreezer = variant === "freezer";

  return (
    <div
      className={`flex max-h-[340px] flex-col overflow-hidden rounded-2xl border ${
        isFreezer
          ? "border-[rgba(184,212,232,0.5)] bg-[#e8f4ff]"
          : "border-border bg-white"
      } ${className ?? ""}`}
    >
      {isFreezer ? (
        <div className="flex shrink-0 justify-center pt-2.5">
          <div className="h-1 w-[60px] rounded bg-[#c2d8e8]" />
        </div>
      ) : (
        <div
          className={`flex shrink-0 pt-2 ${
            handleSide === "right" ? "justify-end pr-3" : "justify-start pl-3"
          }`}
        >
          <div className="h-7 w-1 rounded bg-[#d4d0c8]" />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col px-2.5 pt-1 pb-2.5">
        <p
          className={`mb-2 shrink-0 truncate px-0.5 text-center text-[12px] font-semibold tracking-tight ${
            isFreezer ? "text-[#2563a8]" : "text-foreground/70"
          }`}
        >
          {panel.label}
        </p>

        <div
          ref={scroll.ref}
          onWheel={scroll.onWheel}
          onScroll={scroll.onScroll}
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] scrollbar-hide"
        >
          <div className="grid grid-cols-2 gap-2.5 pb-1">
            {panel.items.map((item) => (
              <ItemSlot
                key={item.id}
                item={item}
                meta={metaById[item.id]}
                variant={variant}
                onClick={() => onSelectItem(item)}
              />
            ))}
            {Array.from({ length: empties }).map((_, i) => (
              <button
                key={`empty-${i}`}
                type="button"
                onClick={onAdd}
                className={`flex aspect-square min-h-[72px] flex-col items-center justify-center rounded-xl border ${
                  isFreezer
                    ? "border-[#b8d4e8] bg-[#d0e8f4]"
                    : "border-[#e8e5de] bg-[#f0ede6]"
                }`}
                aria-label={`${panel.label}에 추가`}
              >
                <span className="text-[22px] leading-none text-black/25">+</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemSlot({
  item,
  meta,
  variant,
  onClick,
}: {
  item: FridgeItem;
  meta?: ItemWithMeta;
  variant: "door" | "freezer";
  onClick: () => void;
}) {
  const s = EXPIRY_STYLES[meta?.statusKey ?? "unset"];
  const isFreezer = variant === "freezer";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex aspect-square min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-1 ${
        isFreezer
          ? "border-[#b8d4e8] bg-[#dceef8]"
          : "border-[#e8e5de] bg-[#f8f6f2]"
      }`}
    >
      <FoodIcon name={item.name} category={item.category} size={28} />
      <span
        className={`max-w-full truncate text-[11px] font-medium leading-tight ${
          isFreezer ? "text-[#3a6a8a]" : "text-foreground/70"
        }`}
      >
        {item.name}
      </span>
      {meta && (
        <span
          className={`absolute top-1 right-1 rounded-md px-1 py-px text-[9px] font-bold leading-3 ${s.badge}`}
          title={formatDDay(meta.dDay)}
        >
          {shortDDay(meta.dDay)}
        </span>
      )}
    </button>
  );
}
