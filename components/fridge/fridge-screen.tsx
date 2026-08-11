"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCcw, Search } from "lucide-react";
import type { FridgeItem, StorageZone } from "@/types/database";
import { defaultExpiresAt } from "@/lib/dday";
import { createClient } from "@/lib/supabase";
import {
  SaveCancelledError,
  normalizeItemName,
  saveFridgeItem,
  saveFridgeItems,
} from "@/lib/fridge-item-upsert";
import { FoodIcon } from "@/components/ui/food-icon";
import { ItemCard } from "@/components/fridge/item-card";
import {
  ItemDetailSheet,
  type ConfirmMode,
} from "@/components/fridge/item-detail-sheet";
import { AddOptionsSheet } from "@/components/fridge/add-options-sheet";
import { ManualAddSheet } from "@/components/fridge/manual-add-sheet";
import {
  CookedDishAddSheet,
  type CookedDishPayload,
} from "@/components/fridge/cooked-dish-add-sheet";
import { VoiceRegisterFlow } from "@/components/fridge/voice-register-flow";
import { useDuplicateItemPrompt } from "@/hooks/use-duplicate-item-prompt";

const ZONE_FILTERS = ["전체", "냉장", "냉동", "실온"] as const;
const CATEGORY_FILTERS = [
  "전체",
  "완성요리",
  "유제품",
  "채소·과일",
  "육류·어류",
  "두부·콩류",
  "기타",
] as const;

function matchCategory(
  item: Pick<FridgeItem, "category" | "item_type">,
  filter: string,
) {
  if (filter === "전체") return true;
  if (filter === "완성요리") {
    return item.item_type === "완성요리" || item.category === "완성요리";
  }
  if (item.item_type === "완성요리" || item.category === "완성요리") {
    return false;
  }
  const itemCategory = item.category;
  if (!itemCategory) return filter === "기타";
  if (itemCategory === filter) return true;
  if (
    filter === "채소·과일" &&
    (itemCategory.includes("채소") || itemCategory.includes("과일"))
  ) {
    return true;
  }
  if (
    filter === "육류·어류" &&
    (itemCategory.includes("육류") ||
      itemCategory.includes("해산물") ||
      itemCategory.includes("어류"))
  ) {
    return true;
  }
  if (
    filter === "두부·콩류" &&
    (itemCategory.includes("두부") || itemCategory.includes("콩"))
  ) {
    return true;
  }
  if (filter === "유제품" && itemCategory.includes("유제")) return true;
  if (filter === "기타") {
    return ![
      "채소",
      "과일",
      "육류",
      "해산물",
      "어류",
      "두부",
      "콩",
      "유제",
      "완성요리",
    ].some((key) => itemCategory.includes(key));
  }
  return false;
}

/** 이름+구역 기준 최신 1건만 (다시 구매 목록용) */
function dedupeRecentArchived(items: FridgeItem[]): FridgeItem[] {
  const seen = new Set<string>();
  const out: FridgeItem[] = [];
  for (const item of items) {
    const key = `${normalizeItemName(item.name)}|${item.zone}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, 12);
}

type FridgeScreenProps = {
  initialItems: FridgeItem[];
  initialRecentArchived?: FridgeItem[];
};

export function FridgeScreen({
  initialItems,
  initialRecentArchived = [],
}: FridgeScreenProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [recentArchived, setRecentArchived] = useState(initialRecentArchived);
  const [search, setSearch] = useState("");
  const [zone, setZone] = useState<(typeof ZONE_FILTERS)[number]>("전체");
  const [category, setCategory] =
    useState<(typeof CATEGORY_FILTERS)[number]>("전체");
  const [selectedItem, setSelectedItem] = useState<FridgeItem | null>(null);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [showCookedDish, setShowCookedDish] = useState(false);
  const [repurchaseFrom, setRepurchaseFrom] = useState<FridgeItem | null>(null);
  const [showVoice, setShowVoice] = useState(false);
  const { resolveDuplicate, dialog: duplicateDialog } = useDuplicateItemPrompt();

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    setRecentArchived(initialRecentArchived);
  }, [initialRecentArchived]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchZone = zone === "전체" || item.zone === zone;
      const matchCat = matchCategory(item, category);
      const matchSearch = !search.trim() || item.name.includes(search.trim());
      return matchZone && matchCat && matchSearch;
    });
  }, [items, zone, category, search]);

  const recentForBuyAgain = useMemo(
    () => dedupeRecentArchived(recentArchived),
    [recentArchived],
  );

  async function handleSavePartial(newQuantity: number) {
    if (!selectedItem) return;
    // 0 이하면 소진으로 처리해 목록에서 제거
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
      const archived: FridgeItem = {
        ...selectedItem,
        status,
        updated_at: new Date().toISOString(),
      };
      setItems((prev) => prev.filter((item) => item.id !== selectedItem.id));
      setRecentArchived((prev) => [archived, ...prev]);
      setSelectedItem(null);
      router.refresh();
    }
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
      { ...payload, input_method: "수동" },
      { supabase, ownedItems: items, resolveDuplicate },
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
        { supabase, ownedItems: items, resolveDuplicate },
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
      console.error("[fridge] voice register:", err);
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
    if (error) {
      console.error("[fridge] expires_at error:", error.message);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.id === selectedItem.id ? { ...item, ...next } : item,
      ),
    );
    setSelectedItem((prev) => (prev ? { ...prev, ...next } : prev));
    router.refresh();
  }

  function openRepurchase(item: FridgeItem) {
    setRepurchaseFrom(item);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
        <div className="px-4 pt-4 pb-3 sm:px-6 lg:px-8">
          <h1 className="mb-3 text-[22px] font-bold leading-[27.5px] text-foreground">
            냉장고
          </h1>
          <div className="flex items-center gap-2 rounded-[20px] border border-border bg-white px-3 py-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <Search size={15} className="shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="식재료 검색..."
              className="flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="mb-2.5 flex gap-2 overflow-x-auto px-4 scrollbar-hide sm:px-6 lg:px-8">
          {ZONE_FILTERS.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZone(z)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all ${
                zone === z
                  ? "bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(61,112,88,0.35)]"
                  : "border border-border bg-card text-muted-foreground"
              }`}
            >
              {z}
            </button>
          ))}
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto px-4 scrollbar-hide sm:px-6 lg:px-8">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all ${
                category === cat
                  ? "border-primary/20 bg-secondary text-primary"
                  : "border-border bg-transparent text-muted-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="mb-3 px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] text-muted-foreground">
            총{" "}
            <span className="min-w-[1.5ch] font-medium text-foreground tabular-nums">
              {filtered.length}
            </span>
            개
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 sm:px-6 lg:grid-cols-4 lg:px-8">
          {filtered.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onClick={() => setSelectedItem(item)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-2 flex flex-col items-center gap-2 py-12 sm:col-span-3 lg:col-span-4">
              <span className="text-3xl opacity-30">
                {items.length === 0 ? "🧊" : "🔍"}
              </span>
              <p className="text-sm text-muted-foreground">
                {items.length === 0
                  ? "냉장고가 비어 있어요"
                  : "검색 결과가 없어요"}
              </p>
            </div>
          )}
        </div>

        {recentForBuyAgain.length > 0 && (
          <section className="mt-8 px-4 pb-2 sm:px-6 lg:px-8">
            <div className="mb-3">
              <h2 className="text-[13px] font-bold text-foreground">
                최근 소진·폐기
              </h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                다시 구매하면 이름·구역을 그대로 불러와요
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              {recentForBuyAgain.map((item, idx) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-3.5 py-3 ${
                    idx < recentForBuyAgain.length - 1
                      ? "border-b border-border"
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <FoodIcon
                      name={item.name}
                      category={item.category}
                      itemType={item.item_type}
                      size={28}
                      className="shrink-0 opacity-80"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground">
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {item.zone}
                        {item.unit ? ` · ${item.unit}` : ""}
                        {" · "}
                        <span
                          className={
                            item.status === "폐기"
                              ? "text-status-urgent"
                              : "text-muted-foreground"
                          }
                        >
                          {item.status}
                        </span>
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => openRepurchase(item)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-secondary px-3 py-1.5 text-[11px] font-bold text-primary transition-transform active:scale-95"
                  >
                    <RotateCcw size={12} strokeWidth={2.5} />
                    다시 구매
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowAddOptions(true)}
        className="absolute right-5 bottom-3 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(61,112,88,0.4)] transition-transform active:scale-95"
        aria-label="재료 추가"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {selectedItem && (
        <ItemDetailSheet
          key={selectedItem.id}
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSavePartial={handleSavePartial}
          onSaveExpires={handleSaveExpires}
          onRemove={handleRemove}
          onRepurchase={() => {
            const item = selectedItem;
            setSelectedItem(null);
            openRepurchase(item);
          }}
        />
      )}

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
          onSelectBarcode={() => {
            setShowAddOptions(false);
            router.push("/fridge/add/barcode");
          }}
          onSelectCookedDish={() => {
            setShowAddOptions(false);
            setShowCookedDish(true);
          }}
        />
      )}

      {showManualAdd && (
        <ManualAddSheet
          onClose={() => setShowManualAdd(false)}
          onSubmit={handleManualAdd}
        />
      )}

      {showCookedDish && (
        <CookedDishAddSheet
          onClose={() => setShowCookedDish(false)}
          onSubmit={handleCookedDishAdd}
        />
      )}

      {repurchaseFrom && (
        <ManualAddSheet
          key={`repurchase-${repurchaseFrom.id}`}
          title="다시 구매"
          initialName={repurchaseFrom.name}
          initialCategory={repurchaseFrom.category}
          initialZone={repurchaseFrom.zone}
          initialSubZone={repurchaseFrom.sub_zone}
          initialUnit={repurchaseFrom.unit}
          initialHasNoExpiry={Boolean(repurchaseFrom.has_no_expiry)}
          onClose={() => setRepurchaseFrom(null)}
          onSubmit={handleManualAdd}
        />
      )}

      {showVoice && (
        <VoiceRegisterFlow
          onClose={() => setShowVoice(false)}
          onRegister={handleVoiceRegister}
        />
      )}

      {duplicateDialog}
    </div>
  );
}
