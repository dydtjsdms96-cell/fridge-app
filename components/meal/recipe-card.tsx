"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import type { RecipeMatch } from "@/lib/recipe-match";
import { FoodIcon } from "@/components/ui/food-icon";
import type { RecipeDifficulty } from "@/types/database";

const DIFFICULTY_COLOR: Record<RecipeDifficulty, string> = {
  쉬움: "text-primary",
  보통: "text-status-warn",
  어려움: "text-status-urgent",
};

type RecipeCardProps = {
  match: RecipeMatch;
  onAdd?: () => void;
  onNavigate?: () => void;
};

export function RecipeCard({ match, onAdd, onNavigate }: RecipeCardProps) {
  const { recipe, ingredients, ownedCount, totalCount, fulfillment, group } =
    match;
  const missing = ingredients.filter((i) => !i.owned);
  const pct = Math.round(fulfillment * 100);
  const difficulty = recipe.difficulty;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <Link
        href={`/meal/${recipe.id}`}
        className="block"
        onPointerDown={() => onNavigate?.()}
      >
        <div className="relative h-[144px] overflow-hidden bg-muted">
          {recipe.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.image_url}
              alt={recipe.title}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center opacity-90">
              <FoodIcon name={recipe.title} size={64} />
            </div>
          )}
          {group === "냉털" && (
            <span className="absolute top-2.5 left-2.5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold leading-[15px] text-primary-foreground">
              지금 바로 가능
            </span>
          )}
          {group === "+1" && (
            <span className="absolute top-2.5 left-2.5 rounded-full bg-[#e8913a] px-2.5 py-1 text-[10px] font-semibold leading-[15px] text-white">
              재료 +1개
            </span>
          )}
          {recipe.source === "user" && (
            <span className="absolute top-2.5 right-2.5 rounded-full bg-card/95 px-2 py-1 text-[10px] font-semibold leading-[15px] text-foreground shadow-sm backdrop-blur-sm">
              내 레시피
            </span>
          )}
        </div>
      </Link>

      <div className="p-3.5">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <Link
            href={`/meal/${recipe.id}`}
            onPointerDown={() => onNavigate?.()}
            className="text-[14px] leading-tight font-bold text-foreground"
          >
            {recipe.title}
          </Link>
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="shrink-0 rounded-2xl border border-primary/20 bg-secondary px-2.5 py-1 text-[11px] font-bold leading-[16.5px] text-primary transition-transform active:scale-95"
            >
              추가
            </button>
          )}
        </div>

        <Link
          href={`/meal/${recipe.id}`}
          className="block"
          onPointerDown={() => onNavigate?.()}
        >
          <div className="mb-3 flex items-center gap-3 text-[11px] text-muted-foreground">
            {recipe.cook_minutes != null && (
              <span className="flex items-center gap-1">
                <Clock size={10} aria-hidden />
                {recipe.cook_minutes}분
              </span>
            )}
            {difficulty && (
              <span className={`font-semibold ${DIFFICULTY_COLOR[difficulty]}`}>
                ● {difficulty}
              </span>
            )}
          </div>

          <div className="mb-1.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                보유 재료 {ownedCount}/{totalCount}개
              </span>
            </div>
            <div className="h-[6px] overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {missing.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {missing.map((ing) => (
                <span
                  key={ing.name}
                  className="rounded-full bg-[#fef0ed] px-2 py-0.5 text-[10px] font-medium text-[#c04d38]"
                >
                  부족 {ing.name}
                  {ing.amount != null
                    ? ` ${ing.amount}${ing.unit ?? ""}`
                    : ""}
                </span>
              ))}
            </div>
          )}
        </Link>
      </div>
    </article>
  );
}
