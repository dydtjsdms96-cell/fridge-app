import { Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function HomeEmptyState() {
  return (
    <EmptyState
      title="냉장고가 비어 있어요"
      description="식재료를 등록하면 유통기한과 재고를 한눈에 관리할 수 있어요"
      action={
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-3 text-[13px] font-bold text-primary-foreground shadow-[0_4px_12px_rgba(61,112,88,0.3)] transition-transform active:scale-95"
        >
          <Plus size={16} strokeWidth={2.5} />
          재료 등록하기
        </button>
      }
    />
  );
}
