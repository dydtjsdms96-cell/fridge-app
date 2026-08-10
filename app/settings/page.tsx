import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsScreen } from "@/components/settings/settings-screen";

function normalizeNotifyTime(value: string | null | undefined): string {
  if (!value) return "08:00";
  // Postgres time may be "08:00:00" or "08:00:00.000000"
  return value.slice(0, 5);
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let { data: profile, error } = await supabase
    .from("profiles")
    .select("id, notify_time")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[settings] profile fetch error:", error.message);
  }

  if (!profile) {
    const { data: created, error: createError } = await supabase
      .from("profiles")
      .insert({ id: user.id, notify_time: "08:00:00" })
      .select("id, notify_time")
      .single();

    if (createError) {
      console.error("[settings] profile create error:", createError.message);
    } else {
      profile = created;
    }
  }

  return (
    <AppShell activeTab="settings">
      <SettingsScreen
        email={user.email ?? "알 수 없는 계정"}
        userId={user.id}
        initialNotifyTime={normalizeNotifyTime(profile?.notify_time)}
        reportMonth={new Date().getMonth() + 1}
      />
    </AppShell>
  );
}
