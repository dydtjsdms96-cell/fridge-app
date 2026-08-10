import { Bell, ChevronRight } from "lucide-react";
import type { FridgeItem } from "@/types/database";
import {
  formatDDay,
  getDDay,
  getExpiryStatus,
  type ExpiryStatus,
} from "@/lib/dday";
import { getFoodEmoji } from "@/lib/food-emoji";
import { EXPIRY_STYLES } from "@/components/home/expiry-styles";
import { HomeEmptyState } from "@/components/home/home-empty-state";

type ItemWithDDay = FridgeItem & {
  dDay: number | null;
  statusKey: ExpiryStatus;
  emoji: string;
  quantityLabel: string;
};

function enrichItems(items: FridgeItem[]): ItemWithDDay[] {
  return items.map((item) => {
    const dDay = getDDay(item.expires_at);
    return {
      ...item,
      dDay,
      statusKey: getExpiryStatus(dDay),
      emoji: getFoodEmoji(item.name, item.category),
      quantityLabel: `${item.quantity}${item.unit ?? ""}`,
    };
  });
}

function UrgentCard({ item }: { item: ItemWithDDay }) {
  const s = EXPIRY_STYLES[item.statusKey];
  return (
    <div
      className={`flex w-[130px] shrink-0 flex-col gap-2 rounded-2xl border p-3.5 ${s.bg} ${s.border}`}
    >
      <span className="text-2xl leading-8">{item.emoji}</span>
      <div>
        <p className="text-[13px] font-semibold leading-[16.25px] text-foreground">
          {item.name}
        </p>
        <p className="mt-0.5 text-[11px] leading-[16.5px] text-muted-foreground">
          {item.quantityLabel}
        </p>
      </div>
      <span className={`font-mono text-[20px] font-medium leading-7 ${s.text}`}>
        {formatDDay(item.dDay)}
      </span>
    </div>
  );
}

type HomeScreenProps = {
  items: FridgeItem[];
  todayLabel: string;
};

export function HomeScreen({ items, todayLabel }: HomeScreenProps) {
  const enriched = enrichItems(items);
  const freshCount = enriched.filter((i) => i.statusKey === "fresh").length;
  const warnCount = enriched.filter((i) => i.statusKey === "warn").length;
  const urgentCount = enriched.filter((i) => i.statusKey === "urgent").length;
  const expiring = enriched
    .filter((i) => i.dDay !== null && i.dDay <= 7)
    .sort((a, b) => (a.dDay ?? 0) - (b.dDay ?? 0));
  const recent = [...enriched]
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  const total = enriched.length;
  const distribution = [
    {
      label: "여유 있음",
      count: freshCount,
      color: "#5A9E72",
      pct: total ? (freshCount / total) * 100 : 0,
    },
    {
      label: "D-7 이하",
      count: warnCount,
      color: "#D4A82A",
      pct: total ? (warnCount / total) * 100 : 0,
    },
    {
      label: "D-3 이하",
      count: urgentCount,
      color: "#D95C45",
      pct: total ? (urgentCount / total) * 100 : 0,
    },
  ];

  if (total === 0) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto px-5 pt-4 pb-8 scrollbar-hide">
        <header className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium tracking-[0.275px] text-muted-foreground uppercase">
              {todayLabel}
            </p>
            <h1 className="mt-0.5 text-[22px] font-bold leading-[27.5px] text-foreground">
              냉장고 현황
            </h1>
          </div>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full border border-border bg-white shadow-[0_1px_6px_rgba(0,0,0,0.06)]"
            aria-label="알림"
          >
            <Bell size={17} className="text-foreground/60" />
          </button>
        </header>
        <HomeEmptyState />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-5 pt-4 pb-8 scrollbar-hide">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium tracking-[0.275px] text-muted-foreground uppercase">
            {todayLabel}
          </p>
          <h1 className="mt-0.5 text-[22px] font-bold leading-[27.5px] text-foreground">
            냉장고 현황
          </h1>
        </div>
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-full border border-border bg-white shadow-[0_1px_6px_rgba(0,0,0,0.06)]"
          aria-label="알림"
        >
          <Bell size={17} className="text-foreground/60" />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl border border-border bg-card p-3.5 shadow-[0_2px_6px_rgba(0,0,0,0.05)]">
          <p className="font-mono text-[26px] font-medium leading-[26px] text-foreground">
            {total}
          </p>
          <p className="mt-1.5 text-[10px] leading-[12.5px] text-muted-foreground">
            총 식재료
          </p>
        </div>
        <div className="rounded-2xl border border-[#f0dfa0] bg-[#fef9ec] p-3.5">
          <p className="font-mono text-[26px] font-medium leading-[26px] text-[#9b7a1a]">
            {warnCount + urgentCount}
          </p>
          <p className="mt-1.5 text-[10px] leading-[12.5px] text-[rgba(155,122,26,0.7)]">
            주의 필요
          </p>
        </div>
        <div className="rounded-2xl border border-[#c5e0d0] bg-[#edf5f0] p-3.5">
          <p className="font-mono text-[26px] font-medium leading-[26px] text-[#3d7058]">
            {freshCount}
          </p>
          <p className="mt-1.5 text-[10px] leading-[12.5px] text-[rgba(61,112,88,0.7)]">
            신선 보관
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-[0_2px_6px_rgba(0,0,0,0.05)]">
        <p className="text-[11px] font-semibold tracking-[0.275px] text-muted-foreground uppercase">
          유통기한 분포
        </p>
        <div className="mt-3.5 space-y-3">
          {distribution.map((row) => (
            <div key={row.label} className="flex items-center gap-2.5">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="w-[60px] shrink-0 text-[11px] leading-[16.5px] text-muted-foreground">
                {row.label}
              </span>
              <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${row.pct}%`, backgroundColor: row.color }}
                />
              </div>
              <span className="w-3 text-right font-mono text-[11px] font-medium leading-[16.5px] text-foreground">
                {row.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {expiring.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-bold leading-[19.5px] text-foreground">
              빨리 사용해야 해요
            </h2>
            <button
              type="button"
              className="flex items-center gap-0.5 text-[11px] font-medium leading-[16.5px] text-primary"
            >
              전체보기 <ChevronRight size={11} />
            </button>
          </div>
          <div className="-mx-5 mt-3 flex gap-2.5 overflow-x-auto px-5 pb-0.5 scrollbar-hide">
            {expiring.map((item) => (
              <UrgentCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <h2 className="text-[13px] font-bold leading-[19.5px] text-foreground">
          최근 추가
        </h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          {recent.map((item, idx) => {
            const s = EXPIRY_STYLES[item.statusKey];
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  idx < recent.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <span className="shrink-0 text-xl leading-7">{item.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold leading-[19.5px] text-foreground">
                    {item.name}
                  </p>
                  <p className="text-[11px] leading-[16.5px] text-muted-foreground">
                    {item.quantityLabel} · {item.zone}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: s.dot }}
                  />
                  <span
                    className={`font-mono text-[13px] font-medium leading-[19.5px] ${s.text}`}
                  >
                    {formatDDay(item.dDay)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
