import { AppShell } from "@/components/layout/app-shell";
import { MealListSkeleton } from "@/components/ui/skeleton";

export default function MealLoading() {
  return (
    <AppShell activeTab="meal">
      <MealListSkeleton />
    </AppShell>
  );
}
