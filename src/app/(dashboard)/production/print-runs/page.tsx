import { redirect } from "next/navigation";
import { LegacyPrintRunsPage } from "@/components/production/legacy-print-runs-page";
import { productionV2Enabled } from "@/lib/production-v2-flag";

export default function PrintRunsPage() {
  if (productionV2Enabled()) redirect("/production?view=work-centers&center=DTF_PRINT");
  return <LegacyPrintRunsPage />;
}
