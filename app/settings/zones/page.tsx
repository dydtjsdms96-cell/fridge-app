import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { ZonesScreen } from "@/components/settings/zones-screen";
import type { StorageZoneRow } from "@/types/database";

export default async function ZonesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("storage_zones")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[settings/zones] fetch:", error.message);
  }

  return (
    <AppShell activeTab="settings">
      <ZonesScreen
        userId={user.id}
        initialZones={(data ?? []) as StorageZoneRow[]}
      />
    </AppShell>
  );
}
