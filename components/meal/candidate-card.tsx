"use client";

import Link from "next/link";
import { Clock, Plus } from "lucide-react";
import type { RecipeMatch } from "@/lib/recipe-match";
import { FoodIcon } from "@/components/ui/food-icon";

type CandidateCardProps = {
  match: RecipeMatch;
  onAdd: () => void;
};

export function CandidateCard({ match, onAdd }: CandidateCardProps) {
  const { recipe, ingredients, ownedCount, totalCount } = match;
  const missing = ingredients.filter((i) => !i.owned);

  return (
    <div className="flex h-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
      <Link
        href={`/meal/${recipe.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <FoodIcon name={recipe.title} size={26} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">
            {recipe.title}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            {recipe.cook_minutes != null && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Clock size={9} aria-hidden /> {recipe.cook_minutes}분
              </span>
            )}
            <span className="text-[10px] tabular-nums text-muted-foreground">
              재료 {ownedCount}/{totalCount}
            </span>
            {missing[0] && (
              <span className="rounded-full bg-status-warn-bg px-1.5 py-0.5 text-[10px] font-medium text-status-warn">
                {missing[0].name}
              </span>
            )}
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={onAdd}
        className="touch-target flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-secondary text-primary transition-transform active:scale-95"
        aria-label={`${recipe.title} 배치`}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
