import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { CategoriesScreen } from "@/components/settings/categories-screen";
import type { Category } from "@/types/database";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[settings/categories] fetch:", error.message);
  }

  return (
    <AppShell activeTab="settings">
      <CategoriesScreen
        userId={user.id}
        initialCategories={(data ?? []) as Category[]}
      />
    </AppShell>
  );
}
