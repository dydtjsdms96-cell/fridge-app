import { AppShell } from "@/components/layout/app-shell";
import { BarcodeAddScreen } from "@/components/fridge/barcode-add-screen";

export default function BarcodeAddPage() {
  return (
    <AppShell activeTab="fridge">
      <BarcodeAddScreen />
    </AppShell>
  );
}
