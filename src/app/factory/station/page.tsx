import { Suspense } from "react";
import { ListSkeleton } from "@/components/ui/page-skeleton";
import { StationModeScreen } from "@/components/factory/station-mode-screen";
import { ManufacturingStationScreen } from "@/components/factory/manufacturing-station-screen";
import { productionV2Enabled } from "@/lib/production-v2-flag";

export default function FactoryStationPage() {
  const Screen = productionV2Enabled() ? ManufacturingStationScreen : StationModeScreen;
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-6">
          <ListSkeleton rows={1} />
          <ListSkeleton rows={5} />
        </div>
      }
    >
      <Screen />
    </Suspense>
  );
}
