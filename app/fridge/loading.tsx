import { AppShell } from "@/components/layout/app-shell";
import { FridgeListSkeleton } from "@/components/ui/skeleton";

export default function FridgeLoading() {
  return (
    <AppShell activeTab="fridge">
      <FridgeListSkeleton />
    </AppShell>
  );
}
