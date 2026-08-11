import { AppShell } from "@/components/layout/app-shell";
import { HomeSkeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <AppShell activeTab="home">
      <HomeSkeleton />
    </AppShell>
  );
}
