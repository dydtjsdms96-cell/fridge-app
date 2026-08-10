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

export default async function FridgePage() {
  const items = await getOwnedFridgeItems();
  return <FridgeApp initialItems={items} />;
}
