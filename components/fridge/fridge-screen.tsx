"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import type { FridgeItem, StorageZone } from "@/types/database";
import { defaultExpiresAt } from "@/lib/dday";
import { createClient } from "@/lib/supabase";
import { ItemCard } from "@/components/fridge/item-card";
import {
  ItemDetailSheet,
  type ConfirmMode,
} from "@/components/fridge/item-detail-sheet";
import { AddOptionsSheet } from "@/components/fridge/add-options-sheet";
import { ManualAddSheet } from "@/components/fridge/manual-add-sheet";
import { VoiceRegisterFlow } from "@/components/fridge/voice-register-flow";

const ZONE_FILTERS = ["전체", "냉장", "냉동", "실온"] as const;
const CATEGORY_FILTERS = [
  "전체",
  "유제품",
  "채소·과일",
  "육류·어류",
  "두부·콩류",
  "기타",
] as const;

function matchCategory(itemCategory: string | null, filter: string) {
  if (filter === "전체") return true;
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
    ].some((key) => itemCategory.includes(key));
  }
  return false;
}

type FridgeScreenProps = {
  initialItems: FridgeItem[];
};

export function FridgeScreen({ initialItems }: FridgeScreenProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [zone, setZone] = useState<(typeof ZONE_FILTERS)[number]>("전체");
  const [category, setCategory] =
    useState<(typeof CATEGORY_FILTERS)[number]>("전체");
  const [selectedItem, setSelectedItem] = useState<FridgeItem | null>(null);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [showVoice, setShowVoice] = useState(false);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchZone = zone === "전체" || item.zone === zone;
      const matchCat = matchCategory(item.category, category);
      const matchSearch = !search.trim() || item.name.includes(search.trim());
      return matchZone && matchCat && matchSearch;
    });
  }, [items, zone, category, search]);

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
      setItems((prev) => prev.filter((item) => item.id !== selectedItem.id));
      setSelectedItem(null);
      router.refresh();
    }
  }

  async function handleManualAdd(payload: {
    name: string;
    quantity: number;
    unit: string | null;
    zone: StorageZone;
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

  async function handleSaveExpires(expiresAt: string) {
    if (!selectedItem) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("fridge_items")
      .update({ expires_at: expiresAt })
      .eq("id", selectedItem.id);
    if (error) {
      console.error("[fridge] expires_at error:", error.message);
      return;
    }
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
      <div className="flex-1 overflow-y-auto pb-8 scrollbar-hide">
        <div className="px-5 pt-4 pb-3">
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

        <div className="mb-2.5 flex gap-2 overflow-x-auto px-5 scrollbar-hide">
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

        <div className="mb-4 flex gap-2 overflow-x-auto px-5 scrollbar-hide">
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

        <div className="mb-3 px-5">
          <p className="text-[11px] text-muted-foreground">
            총{" "}
            <span className="font-mono font-medium text-foreground">
              {filtered.length}
            </span>
            개
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 px-5">
          {filtered.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onClick={() => setSelectedItem(item)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-2 flex flex-col items-center gap-2 py-12">
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
        />
      )}

      {showManualAdd && (
        <ManualAddSheet
          onClose={() => setShowManualAdd(false)}
          onSubmit={handleManualAdd}
        />
      )}

      {showVoice && (
        <VoiceRegisterFlow
          onClose={() => setShowVoice(false)}
          onRegister={handleVoiceRegister}
        />
      )}
    </div>
  );
}
