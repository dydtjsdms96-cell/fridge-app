import { createClient } from "@/lib/supabase/server";
import type { FridgeItem, StorageZoneRow } from "@/types/database";
import { HomeScreen } from "@/components/home/home-screen";
import { AppShell } from "@/components/layout/app-shell";

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

async function getStorageZones(): Promise<StorageZoneRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("storage_zones")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch storage_zones:", error.message);
    return [];
  }

  return (data ?? []) as StorageZoneRow[];
}

export default async function HomePage() {
  const [items, zones] = await Promise.all([
    getOwnedFridgeItems(),
    getStorageZones(),
  ]);

  return (
    <AppShell activeTab="home">
      <HomeScreen items={items} zones={zones} />
    </AppShell>
  );
}
