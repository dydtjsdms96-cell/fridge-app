import { Box, Snowflake, Thermometer } from "lucide-react";
import type { FridgeItem } from "@/types/database";
import { formatDDay, getDDay, getExpiryStatus } from "@/lib/dday";
import { getFoodEmoji } from "@/lib/food-emoji";
import { formatQuantity } from "@/lib/quantity";
import { EXPIRY_STYLES } from "@/components/home/expiry-styles";

function ZoneIcon({ zone }: { zone: string }) {
  const cls = "shrink-0";
  if (zone === "냉동") return <Snowflake size={10} className={cls} />;
  if (zone === "냉장") return <Thermometer size={10} className={cls} />;
  return <Box size={10} className={cls} />;
}

type ItemCardProps = {
  item: FridgeItem;
  onClick: () => void;
};

export function ItemCard({ item, onClick }: ItemCardProps) {
  const dDay = getDDay(item.expires_at);
  const status = getExpiryStatus(dDay);
  const s = EXPIRY_STYLES[status];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2.5 rounded-2xl border border-border bg-white p-3.5 text-left shadow-[0_2px_6px_rgba(0,0,0,0.06)] transition-transform active:scale-[0.97]"
    >
      <div className="flex items-start justify-between">
        <span className="text-[28px] leading-7">
          {getFoodEmoji(item.name, item.category)}
        </span>
        <span
          className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-[13.5px] ${s.badge}`}
        >
          <ZoneIcon zone={item.zone} />
          <span className="pl-0.5">{item.zone}</span>
        </span>
      </div>
      <div>
        <p className="text-[14px] font-semibold leading-[17.5px] text-foreground">
          {item.name}
        </p>
        <p className="mt-0.5 text-[11px] leading-[16.5px] text-muted-foreground">
          {formatQuantity(item.quantity, item.unit)}
        </p>
      </div>
      <div className={`flex items-center gap-1.5 self-start rounded-2xl px-2 py-1 ${s.bg}`}>
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: s.dot }}
        />
        <span className={`font-mono text-[14px] font-medium leading-5 ${s.text}`}>
          {formatDDay(dDay)}
        </span>
      </div>
    </button>
  );
}
