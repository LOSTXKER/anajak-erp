import { Suspense } from "react";
import { StationModeScreen } from "@/components/factory/station-mode-screen";
import { Skeleton } from "@/components/ui/skeleton";

export default function FactoryStationPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-6">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      }
    >
      <StationModeScreen />
    </Suspense>
  );
}
