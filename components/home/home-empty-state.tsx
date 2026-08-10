import { PackageOpen, Plus } from "lucide-react";

export function HomeEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-card shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
        <PackageOpen size={36} className="text-primary/70" strokeWidth={1.5} />
      </div>
      <h2 className="text-[18px] font-bold text-foreground">냉장고가 비어 있어요</h2>
      <p className="mt-2 max-w-[240px] text-[13px] leading-relaxed text-muted-foreground">
        식재료를 등록하면 유통기한과 재고를 한눈에 관리할 수 있어요
      </p>
      <button
        type="button"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-3 text-[13px] font-bold text-primary-foreground shadow-[0_4px_12px_rgba(61,112,88,0.3)] transition-transform active:scale-95"
      >
        <Plus size={16} strokeWidth={2.5} />
        재료 등록하기
      </button>
    </div>
  );
}
