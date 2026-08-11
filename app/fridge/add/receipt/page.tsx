import { AppShell } from "@/components/layout/app-shell";
import { ReceiptAddScreen } from "@/components/fridge/receipt-add-screen";

export default function ReceiptAddPage() {
  return (
    <AppShell activeTab="fridge" hideTabBar>
      <ReceiptAddScreen />
    </AppShell>
  );
}
