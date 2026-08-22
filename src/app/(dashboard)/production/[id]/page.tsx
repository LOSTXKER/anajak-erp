import { LegacyProductionDetailPage } from "@/components/production/legacy-production-detail-page";
import { ProductionV2ControlRecord } from "@/components/production-v2/production-v2-control-record";
import { productionV2Enabled } from "@/lib/production-v2-flag";

export default function ProductionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  if (!productionV2Enabled()) {
    return <LegacyProductionDetailPage params={params} searchParams={searchParams} />;
  }

  return <ProductionV2ControlRecord params={params} />;
}
