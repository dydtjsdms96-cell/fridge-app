import { createClient } from "@/lib/supabase/server";
import type { FridgeItem } from "@/types/database";
import { FridgeApp } from "@/components/fridge/fridge-app";

async function getOwnedFridgeItems(): Promise<FridgeItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fridge_items")
    .select("*")
    .eq("status", "보유")
    .order("expires_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch fridge_items:", error.message);
    return [];
  }

  return (data ?? []) as FridgeItem[];
}

/** 최근 소진·폐기 — 다시 구매용 (최대 30건, 클라이언트에서 이름+구역 중복 제거) */
async function getRecentArchivedItems(): Promise<FridgeItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fridge_items")
    .select("*")
    .in("status", ["소진", "폐기"])
    .order("updated_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("Failed to fetch archived fridge_items:", error.message);
    return [];
  }

  return (data ?? []) as FridgeItem[];
}

export default async function FridgePage() {
  const [items, recentArchived] = await Promise.all([
    getOwnedFridgeItems(),
    getRecentArchivedItems(),
  ]);
  return (
    <FridgeApp initialItems={items} initialRecentArchived={recentArchived} />
  );
}
