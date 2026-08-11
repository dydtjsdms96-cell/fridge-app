"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Snowflake, Thermometer, Box } from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { StorageZone, StorageZoneRow } from "@/types/database";
import { SwipeDeleteRow } from "@/components/settings/swipe-delete-row";
import { Toast, useToast } from "@/components/ui/toast";

const BASE_ZONES: StorageZone[] = ["냉장", "냉동", "실온", "김치냉장고"];

const ZONE_META: Record<
  StorageZone,
  { emoji: string; hint: string; Icon: typeof Thermometer }
> = {
  냉장: { emoji: "🧊", hint: "야채칸, 문쪽 선반…", Icon: Thermometer },
  냉동: { emoji: "❄️", hint: "급속냉동, 서랍…", Icon: Snowflake },
  실온: { emoji: "🏠", hint: "팬트리, 식탁 옆…", Icon: Box },
  김치냉장고: { emoji: "🥬", hint: "김치칸, 야채칸…", Icon: Thermometer },
};

type ZonesScreenProps = {
  userId: string;
  initialZones: StorageZoneRow[];
};

export function ZonesScreen({ userId, initialZones }: ZonesScreenProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialZones);
  const [addingFor, setAddingFor] = useState<StorageZone | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const { message, showToast } = useToast(2000);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(
      BASE_ZONES.map((z) => [z, [] as StorageZoneRow[]]),
    ) as Record<StorageZone, StorageZoneRow[]>;
    for (const row of items) {
      if (map[row.base_zone]) map[row.base_zone].push(row);
    }
    for (const zone of BASE_ZONES) {
      map[zone].sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
          a.label.localeCompare(b.label, "ko"),
      );
    }
    return map;
  }, [items]);

  function notify(message: string) {
    showToast(message);
  }

  async function addLabel(baseZone: StorageZone) {
    const label = draftLabel.trim();
    if (!label || busy) return;
    setBusy(true);
    const supabase = createClient();
    const nextOrder =
      items.filter((z) => z.base_zone === baseZone).reduce(
        (max, z) => Math.max(max, z.sort_order ?? 0),
        -1,
      ) + 1;
    const { data, error } = await supabase
      .from("storage_zones")
      .insert({
        user_id: userId,
        base_zone: baseZone,
        label,
        sort_order: nextOrder,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[zones] insert:", error.message);
      notify("추가에 실패했어요");
    } else if (data) {
      setItems((prev) => [...prev, data as StorageZoneRow]);
      setAddingFor(null);
      setDraftLabel("");
      router.refresh();
    }
    setBusy(false);
  }

  async function deleteZone(id: string) {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("storage_zones").delete().eq("id", id);
    if (error) {
      console.error("[zones] delete:", error.message);
      notify("삭제에 실패했어요");
    } else {
      setItems((prev) => prev.filter((z) => z.id !== id));
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={() => router.push("/settings")}
          className="touch-target flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-[0_1px_6px_rgba(0,0,0,0.06)]"
          aria-label="뒤로"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-bold leading-[27.5px] text-foreground">
            구역 설정
          </h1>
          <p className="text-[11px] text-muted-foreground">
            보관 구역별 하위 칸을 관리해요
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-8 scrollbar-hide">
        {BASE_ZONES.map((zone) => {
          const meta = ZONE_META[zone];
          const rows = grouped[zone];
          return (
            <section key={zone}>
              <div className="mb-2 flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px]" aria-hidden>
                    {meta.emoji}
                  </span>
                  <h2 className="text-[13px] font-bold text-foreground">
                    {zone}
                  </h2>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {rows.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAddingFor(zone);
                    setDraftLabel("");
                  }}
                  className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-primary"
                >
                  <Plus size={12} strokeWidth={2.5} />
                  추가
                </button>
              </div>

              <div className="space-y-2">
                {rows.map((row) => (
                  <SwipeDeleteRow
                    key={row.id}
                    disabled={busy}
                    onDelete={() => void deleteZone(row.id)}
                  >
                    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-[0_2px_6px_rgba(0,0,0,0.05)]">
                      <span className="flex size-8 items-center justify-center rounded-xl bg-[#edf3ef] text-primary">
                        <meta.Icon size={14} />
                      </span>
                      <span className="text-[13px] font-medium text-foreground">
                        {row.label}
                      </span>
                    </div>
                  </SwipeDeleteRow>
                ))}

                {rows.length === 0 && addingFor !== zone && (
                  <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-center text-[11px] text-muted-foreground">
                    하위 구역이 없어요 · {meta.hint}
                  </div>
                )}

                {addingFor === zone && (
                  <div className="rounded-2xl border border-primary/20 bg-card p-3.5 shadow-[0_2px_6px_rgba(0,0,0,0.05)]">
                    <input
                      value={draftLabel}
                      onChange={(e) => setDraftLabel(e.target.value)}
                      placeholder={`예: ${meta.hint.split(",")[0]}`}
                      className="mb-2.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void addLabel(zone);
                      }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAddingFor(null)}
                        className="rounded-xl bg-muted py-2.5 text-[13px] font-semibold text-foreground"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        disabled={busy || !draftLabel.trim()}
                        onClick={() => void addLabel(zone)}
                        className="rounded-xl bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Toast message={message} />
    </div>
  );
}
