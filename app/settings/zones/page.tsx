import { createClient, requireUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { ZonesScreen } from "@/components/settings/zones-screen";
import type { StorageZoneRow } from "@/types/database";

export default async function ZonesPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("storage_zones")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
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
