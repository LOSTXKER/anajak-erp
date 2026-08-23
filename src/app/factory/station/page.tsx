import { Suspense } from "react";
import { StationModeScreen } from "@/components/factory/station-mode-screen";
import { ManufacturingStationScreen } from "@/components/factory/manufacturing-station-screen";
import { Skeleton } from "@/components/ui/skeleton";
import { productionV2Enabled } from "@/lib/production-v2-flag";

export default function FactoryStationPage() {
  const Screen = productionV2Enabled() ? ManufacturingStationScreen : StationModeScreen;
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-6">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      }
    >
      <Screen />
    </Suspense>
  );
}
