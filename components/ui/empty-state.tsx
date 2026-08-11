import type { ReactNode } from "react";
import { PackageOpen } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** compact = list/section empties; default = page-level */
  variant?: "page" | "section";
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = "",
  variant = "page",
}: EmptyStateProps) {
  const isPage = variant === "page";

  return (
    <div
      className={`flex flex-col items-center text-center ${
        isPage
          ? "flex-1 justify-center px-8 py-16"
          : "col-span-full gap-2 py-12"
      } ${className}`}
    >
      <div
        className={
          isPage
            ? "mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-card shadow-[0_2px_12px_rgba(0,0,0,0.05)]"
            : "mb-1 opacity-40"
        }
      >
        {icon ?? (
          <PackageOpen
            size={isPage ? 36 : 28}
            className="text-primary/70"
            strokeWidth={1.5}
            aria-hidden
          />
        )}
      </div>
      <h2
        className={
          isPage
            ? "text-[18px] font-bold text-foreground"
            : "text-sm text-muted-foreground"
        }
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-2 max-w-[260px] text-muted-foreground ${
            isPage ? "text-[13px] leading-relaxed" : "text-[12px]"
          }`}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
