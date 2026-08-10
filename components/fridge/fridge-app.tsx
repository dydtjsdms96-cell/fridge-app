import type { FridgeItem } from "@/types/database";
import { AppShell } from "@/components/layout/app-shell";
import { FridgeScreen } from "@/components/fridge/fridge-screen";

type FridgeAppProps = {
  initialItems: FridgeItem[];
};

export function FridgeApp({ initialItems }: FridgeAppProps) {
  return (
    <AppShell activeTab="fridge">
      <FridgeScreen initialItems={initialItems} />
    </AppShell>
  );
}
