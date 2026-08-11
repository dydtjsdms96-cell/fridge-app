import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ymdInAppTz } from "@/lib/dday";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsScreen } from "@/components/settings/settings-screen";

function normalizeNotifyTime(value: string | null | undefined): string {
  if (!value) return "08:00";
  // Postgres time may be "08:00:00" or "08:00:00.000000"
  return value.slice(0, 5);
}

/** Asia/Seoul 기준 이번 달 [start, nextMonthStart) */
function currentMonthRangeSeoul(): {
  month: number;
  start: string;
  nextStart: string;
} {
  const today = ymdInAppTz();
  const [yRaw, mRaw] = today.split("-");
  const year = Number(yRaw);
  const month = Number(mRaw);
  const start = `${yRaw}-${mRaw}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextStart = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { month, start, nextStart };
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

  const { month, start, nextStart } = currentMonthRangeSeoul();
  const { count: discardedThisMonth, error: wasteError } = await supabase
    .from("waste_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("logged_at", start)
    .lt("logged_at", nextStart);

  if (wasteError) {
    console.error("[settings] waste_log count error:", wasteError.message);
  }

  return (
    <AppShell activeTab="settings">
      <SettingsScreen
        email={user.email ?? "알 수 없는 계정"}
        userId={user.id}
        initialNotifyTime={normalizeNotifyTime(profile?.notify_time)}
        reportMonth={month}
        discardedThisMonth={discardedThisMonth ?? 0}
      />
    </AppShell>
  );
}
