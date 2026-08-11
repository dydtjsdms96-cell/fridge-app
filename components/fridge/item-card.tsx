import { Box, Snowflake, Thermometer } from "lucide-react";
import type { FridgeItem } from "@/types/database";
import { formatDDay, getDDay, getExpiryStatus } from "@/lib/dday";
import { FoodIcon } from "@/components/ui/food-icon";
import { formatQuantity } from "@/lib/quantity";
import { EXPIRY_STYLES } from "@/components/home/expiry-styles";
import { isCookedDish } from "@/lib/fridge-item-upsert";

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
  const hasNoExpiry = Boolean(item.has_no_expiry);
  const dDay = hasNoExpiry ? null : getDDay(item.expires_at);
  const status = getExpiryStatus(dDay, hasNoExpiry);
  const s = EXPIRY_STYLES[status];
  const label = formatDDay(dDay, hasNoExpiry);
  const cooked = isCookedDish(item);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2.5 rounded-2xl border border-border bg-white p-3.5 text-left shadow-[0_2px_6px_rgba(0,0,0,0.06)] transition-transform active:scale-[0.97]"
    >
      <div className="flex items-start justify-between gap-2">
        <FoodIcon
          name={item.name}
          category={item.category}
          itemType={item.item_type}
          size={32}
        />
        <div className="flex flex-col items-end gap-1">
          {cooked && (
            <span className="rounded-full bg-[#fff4e8] px-1.5 py-0.5 text-[9px] font-bold leading-[13.5px] text-[#c47a2c]">
              완성요리
            </span>
          )}
          <span
            className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-[13.5px] ${s.badge}`}
          >
            <ZoneIcon zone={item.zone} />
            <span className="pl-0.5">{item.zone}</span>
          </span>
        </div>
      </div>
      <div>
        <p className="text-[14px] font-semibold leading-[17.5px] text-foreground">
          {item.name}
        </p>
        <p className="mt-0.5 text-[11px] leading-[16.5px] text-muted-foreground">
          {formatQuantity(item.quantity, item.unit)}
        </p>
      </div>
      <div
        className={`flex max-w-full items-center gap-1.5 self-start rounded-2xl px-2 py-1 ${s.bg}`}
      >
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: s.dot }}
        />
        <span
          className={`${
            hasNoExpiry || dDay === null
              ? "text-[10px] font-semibold leading-4"
              : "text-[14px] font-medium leading-5 tabular-nums"
          } ${s.text}`}
        >
          {label}
        </span>
      </div>
    </button>
  );
}
