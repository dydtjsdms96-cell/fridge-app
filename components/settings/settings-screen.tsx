"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { FridgeItem } from "@/types/database";

type SettingsScreenProps = {
  email: string;
  userId: string;
  initialNotifyTime: string; // HH:mm
  reportMonth: number;
};

const EXPIRY_ROWS = [
  {
    label: "여유 있음",
    sub: "D-8 이상",
    example: "D-12",
    color: "var(--status-fresh-dot)",
    bg: "var(--status-fresh-bg)",
    text: "var(--status-fresh)",
  },
  {
    label: "D-7 이하",
    sub: "주의 단계",
    example: "D-6",
    color: "var(--status-warn-dot)",
    bg: "var(--status-warn-bg)",
    text: "var(--status-warn)",
  },
  {
    label: "D-3 이하",
    sub: "긴급 단계",
    example: "D-2",
    color: "var(--status-urgent-dot)",
    bg: "var(--status-urgent-bg)",
    text: "var(--status-urgent)",
  },
] as const;

function formatNotifyLabel(time: string): string {
  const [hRaw = "0", mRaw = "00"] = time.split(":");
  const h = Number(hRaw);
  const m = mRaw.padStart(2, "0");
  if (!Number.isFinite(h)) return "매일";
  const period = h < 12 ? "오전" : "오후";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === "00" ? `${period} ${hour12}시` : `${period} ${hour12}:${m}`;
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(items: FridgeItem[]): string {
  const headers = [
    "id",
    "name",
    "category",
    "zone",
    "sub_zone",
    "quantity",
    "unit",
    "purchased_at",
    "expires_at",
    "has_no_expiry",
    "status",
    "input_method",
    "created_at",
    "updated_at",
  ];
  const rows = items.map((item) =>
    [
      item.id,
      item.name,
      item.category ?? "",
      item.zone,
      item.sub_zone ?? "",
      String(item.quantity),
      item.unit ?? "",
      item.purchased_at ?? "",
      item.expires_at ?? "",
      item.has_no_expiry ? "true" : "false",
      item.status,
      item.input_method ?? "",
      item.created_at ?? "",
      item.updated_at ?? "",
    ]
      .map((v) => escapeCsv(String(v)))
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

function MonthlyReportCard({ month }: { month: number }) {
  return (
    <div className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-[0_2px_6px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] leading-[22.5px]" aria-hidden>
            📊
          </span>
          <p className="text-[13px] font-bold leading-[19.5px] text-foreground">
            {month}월 소비 리포트
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <p className="text-[10px] font-semibold leading-[15px] text-primary">
            ↓ 지난달 대비 5%p 개선
          </p>
          <span className="rounded-full bg-[#edf3ef] px-2 py-0.5 text-[10px] font-semibold leading-[15px] text-primary">
            이번 달
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-5">
        <div className="relative size-24 shrink-0">
          <div
            className="size-full rounded-full"
            style={{
              background:
                "conic-gradient(#3d7058 0deg 277deg, #d95c45 277deg 360deg)",
            }}
            aria-hidden
          />
          <div className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-card">
            <span className="min-w-[3ch] text-center text-[20px] font-medium leading-5 text-foreground tabular-nums">
              77%
            </span>
            <span className="text-[9px] tracking-tight text-muted-foreground">
              소비율
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" />
            <span className="text-[10px] leading-[15px] text-muted-foreground">
              소비됨
            </span>
          </div>
          <p className="mt-0.5 min-w-[2ch] text-[22px] font-medium leading-[22px] text-foreground tabular-nums">
            23
            <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">
              개
            </span>
          </p>

          <div className="mt-3.5 flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-destructive" />
            <span className="text-[10px] leading-[15px] text-muted-foreground">
              폐기됨
            </span>
          </div>
          <p className="mt-0.5 min-w-[2ch] text-[22px] font-medium leading-[22px] text-foreground tabular-nums">
            7
            <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">
              개
            </span>
          </p>
        </div>
      </div>

      <div className="mt-4 h-px bg-border" />

      <div className="mt-3.5 flex items-start gap-2.5">
        <span className="pt-px text-[18px] leading-[18px]" aria-hidden>
          🍗
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold leading-[16.5px] text-foreground">
            이번 달 약{" "}
            <span className="font-medium tabular-nums">12,600</span>
            원어치를 날렸어요
          </p>
          <p className="mt-0.5 text-[11px] leading-[16.5px] text-muted-foreground">
            치킨 한 마리 값이에요. 아깝다아~! 😅
          </p>
        </div>
      </div>
    </div>
  );
}

function SettingsRow({
  label,
  onClick,
  href,
  trailing,
  border = true,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  trailing?: ReactNode;
  border?: boolean;
}) {
  const className = `flex w-full items-center justify-between px-4 py-3.5 text-left ${
    border ? "border-b border-border" : ""
  }`;
  const content = (
    <>
      <span className="text-[13px] leading-[19.5px] text-foreground">
        {label}
      </span>
      {trailing ?? (
        <ChevronRight size={15} className="text-muted-foreground" />
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

export function SettingsScreen({
  email,
  userId,
  initialNotifyTime,
  reportMonth,
}: SettingsScreenProps) {
  const router = useRouter();
  const [notifyTime, setNotifyTime] = useState(initialNotifyTime);
  const [savingTime, setSavingTime] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[settings] signOut error:", error.message);
      setLoggingOut(false);
      showToast("로그아웃에 실패했어요");
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  async function handleNotifyTimeChange(value: string) {
    setNotifyTime(value);
    setSavingTime(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ notify_time: value.length === 5 ? `${value}:00` : value })
      .eq("id", userId);
    if (error) {
      console.error("[settings] notify_time error:", error.message);
      showToast("알림 시간 저장에 실패했어요");
    }
    setSavingTime(false);
  }

  async function exportCsv() {
    if (exporting) return;
    setExporting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("fridge_items")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const items = (data ?? []) as FridgeItem[];
      const blob = new Blob(["\uFEFF" + toCsv(items)], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `fridge-items-${stamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`${items.length}개 항목을 내보냈어요`);
    } catch (err) {
      console.error("[settings] csv export error:", err);
      showToast("CSV 내보내기에 실패했어요");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-8 scrollbar-hide">
        <h1 className="text-[22px] leading-[27.5px] font-bold text-foreground">
          설정
        </h1>

        <div className="mt-5">
          <MonthlyReportCard month={reportMonth} />
        </div>

        {/* Profile — email + logout (Figma: emoji avatar + chevron look) */}
        <div className="mb-5 flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-[0_2px_6px_rgba(0,0,0,0.05)]">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#edf3ef] text-[24px] leading-8"
            suppressHydrationWarning
          >
            🧑‍🍳
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-bold leading-[21px] text-foreground">
              {email}
            </p>
            <p className="text-[11px] leading-[16.5px] text-muted-foreground">
              로그인 계정
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-muted px-3 py-2 text-[12px] font-semibold text-foreground transition-transform active:scale-95 disabled:opacity-60"
            aria-label="로그아웃"
          >
            <LogOut size={14} aria-hidden />
            로그아웃
          </button>
        </div>

        {/* Expiry legend */}
        <div className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-[0_2px_6px_rgba(0,0,0,0.05)]">
          <p className="mb-3.5 text-[11px] font-semibold tracking-[0.275px] text-muted-foreground uppercase">
            유통기한 색상 체계
          </p>
          <div className="space-y-2.5">
            {EXPIRY_ROWS.map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <div
                  className="flex size-8 shrink-0 items-center justify-center rounded-[20px]"
                  style={{ backgroundColor: row.bg }}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-[19.5px] text-foreground">
                    {row.label}
                  </p>
                  <p className="text-[11px] leading-[16.5px] text-muted-foreground">
                    {row.sub}
                  </p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium leading-[16.5px] tabular-nums"
                  style={{ color: row.text, backgroundColor: row.bg }}
                >
                  {row.example}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications — Figma rows + functional time */}
        <div className="mb-4">
          <p className="mb-2 px-0.5 text-[11px] font-semibold tracking-[0.275px] text-muted-foreground uppercase">
            알림 설정
          </p>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            <SettingsRow
              label="유통기한 D-3 주의 알림"
              onClick={() => showToast("준비 중입니다")}
            />
            <SettingsRow
              label="D-7 사전 알림"
              onClick={() => showToast("준비 중입니다")}
            />
            <div className="flex items-center justify-between gap-3 px-4 py-3.5">
              <p className="min-w-0 text-[13px] leading-[19.5px] text-foreground">
                {formatNotifyLabel(notifyTime)} 일일 리마인더
              </p>
              <input
                type="time"
                value={notifyTime}
                onChange={(e) => handleNotifyTimeChange(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-[13px] text-foreground tabular-nums outline-none focus:border-primary"
                aria-label="알림 시간"
                disabled={savingTime}
              />
            </div>
          </div>
        </div>

        {/* Fridge management */}
        <div className="mb-4">
          <p className="mb-2 px-0.5 text-[11px] font-semibold tracking-[0.275px] text-muted-foreground uppercase">
            냉장고 관리
          </p>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            <SettingsRow label="카테고리 편집" href="/settings/categories" />
            <SettingsRow label="냉장고 구역 설정" href="/settings/zones" />
            <SettingsRow
              label="데이터 내보내기 (CSV)"
              onClick={() => {
                if (!exporting) void exportCsv();
              }}
              border={false}
              trailing={
                <ChevronRight
                  size={15}
                  className={`text-muted-foreground ${exporting ? "opacity-40" : ""}`}
                />
              }
            />
          </div>
        </div>

        {/* App — static placeholders */}
        <div className="mb-2">
          <p className="mb-2 px-0.5 text-[11px] font-semibold tracking-[0.275px] text-muted-foreground uppercase">
            앱
          </p>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            <SettingsRow
              label="테마"
              onClick={() => showToast("준비 중입니다")}
              trailing={
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  준비 중
                  <ChevronRight size={15} />
                </span>
              }
            />
            <SettingsRow
              label="언어"
              onClick={() => showToast("준비 중입니다")}
              trailing={
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  준비 중
                  <ChevronRight size={15} />
                </span>
              }
            />
            <SettingsRow
              label="버전 정보 1.0.0"
              border={false}
            />
          </div>
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none absolute inset-x-5 bottom-6 z-20">
          <div className="rounded-2xl bg-foreground/90 px-4 py-3 text-center text-[12px] font-semibold text-background shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
