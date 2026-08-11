import { AppShell } from "@/components/layout/app-shell";
import { ShoppingListSkeleton } from "@/components/ui/skeleton";

export default function ShoppingLoading() {
  return (
    <AppShell activeTab="list">
      <ShoppingListSkeleton />
    </AppShell>
  );
}
