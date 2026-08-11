"use client";

import { CookingPot } from "lucide-react";
import { getFoodIconUrl } from "@/lib/food-icon";
import type { FridgeItemType } from "@/types/database";

type FoodIconProps = {
  name: string;
  category?: string | null;
  itemType?: FridgeItemType | null;
  size?: number;
  className?: string;
  alt?: string;
};

export function FoodIcon({
  name,
  category = null,
  itemType = null,
  size = 28,
  className = "",
  alt = "",
}: FoodIconProps) {
  if (itemType === "완성요리" || category === "완성요리") {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-xl bg-[#fff4e8] text-[#c47a2c] ${className}`}
        style={{ width: size, height: size }}
        aria-hidden={alt ? undefined : true}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
      >
        <CookingPot size={Math.round(size * 0.58)} strokeWidth={2.25} />
      </span>
    );
  }

  const src = getFoodIconUrl(name, category);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`inline-block object-contain ${className}`}
      style={{ width: size, height: size }}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}
