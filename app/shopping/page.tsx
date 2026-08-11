import { createClient, requireUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { ShoppingScreen } from "@/components/shopping/shopping-screen";
import type { ShoppingList } from "@/types/database";

export default async function ShoppingPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("shopping_list")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[shopping] fetch error:", error.message);
  }

  return (
    <AppShell activeTab="list">
      <ShoppingScreen
        initialItems={(data ?? []) as ShoppingList[]}
        userId={user.id}
      />
    </AppShell>
  );
}
