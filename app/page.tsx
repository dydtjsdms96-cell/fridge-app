import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { FridgeItem } from "@/types/database";
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

function formatTodayLabel(date = new Date()) {
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export default async function HomePage() {
  const items = await getOwnedFridgeItems();
  const todayLabel = formatTodayLabel();

  return (
    <AppShell
      activeTab="home"
      fab={
        <Link
          href="/fridge"
          className="absolute right-5 bottom-[94px] z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(61,112,88,0.4)] transition-transform active:scale-95"
          aria-label="재료 추가"
        >
          <Plus size={24} strokeWidth={2.5} />
        </Link>
      }
    >
      <HomeScreen items={items} todayLabel={todayLabel} />
    </AppShell>
  );
}
