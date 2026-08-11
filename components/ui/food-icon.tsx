"use client";

import { getFoodIconUrl } from "@/lib/food-icon";

type FoodIconProps = {
  name: string;
  category?: string | null;
  size?: number;
  className?: string;
  alt?: string;
};

export function FoodIcon({
  name,
  category = null,
  size = 28,
  className = "",
  alt = "",
}: FoodIconProps) {
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
