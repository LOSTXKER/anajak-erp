import { LegacyProductionPage } from "@/components/production/legacy-production-page";
import { ProductionV2Workspace } from "@/components/production-v2/production-v2-workspace";
import { productionV2Enabled } from "@/lib/production-v2-flag";

export default function ProductionPage() {
  return productionV2Enabled() ? <ProductionV2Workspace /> : <LegacyProductionPage />;
}
