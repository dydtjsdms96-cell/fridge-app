import type { HTMLAttributes } from "react";

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  /** rounded style */
  rounded?: "md" | "lg" | "xl" | "2xl" | "full";
};

const ROUND: Record<NonNullable<SkeletonProps["rounded"]>, string> = {
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

/** Single gray bone block */
export function Skeleton({
  className = "",
  rounded = "xl",
  ...rest
}: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-muted ${ROUND[rounded]} ${className}`}
      aria-hidden
      {...rest}
    />
  );
}

/** Fridge inventory grid placeholder */
export function FridgeListSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-4 sm:px-6 lg:px-8">
      <Skeleton className="mb-3 h-7 w-24" rounded="lg" />
      <Skeleton className="mb-4 h-11 w-full" rounded="2xl" />
      <div className="mb-3 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-14" rounded="full" />
        ))}
      </div>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-16" rounded="full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2.5 rounded-2xl border border-border bg-white p-3.5"
          >
            <div className="flex justify-between">
              <Skeleton className="size-8" rounded="lg" />
              <Skeleton className="h-5 w-10" rounded="full" />
            </div>
            <Skeleton className="h-4 w-[75%]" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-6 w-16" rounded="2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Meal recipe candidate cards */
export function MealListSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-4 sm:px-6">
      <Skeleton className="mb-3 h-7 w-28" rounded="lg" />
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" rounded="full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-border bg-card"
          >
            <Skeleton className="h-36 w-full rounded-none" rounded="md" />
            <div className="space-y-2 p-3.5">
              <Skeleton className="h-4 w-[66%]" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shopping list rows */
export function ShoppingListSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-4 sm:px-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <Skeleton className="mb-2 h-7 w-28" rounded="lg" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="size-9" rounded="full" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[52px] w-full" rounded="2xl" />
        ))}
      </div>
    </div>
  );
}

/** Home zone grid placeholder */
export function HomeSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pt-5">
      <div className="mb-4 flex justify-between">
        <Skeleton className="h-7 w-28" rounded="lg" />
        <Skeleton className="size-9" rounded="2xl" />
      </div>
      <Skeleton className="mb-4 h-28 w-full" rounded="2xl" />
      <Skeleton className="mb-3 h-4 w-24" />
      <Skeleton className="min-h-[280px] flex-1 w-full" rounded="2xl" />
    </div>
  );
}
