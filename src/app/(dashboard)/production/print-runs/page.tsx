import { PrintRunsPage } from "@/components/production/print-runs-page";
import {
  operationsOrigin,
  type OperationsSearchParams,
} from "@/components/production/operations-navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<OperationsSearchParams>;
}) {
  const params = await searchParams;
  return (
    <PrintRunsPage origin={operationsOrigin(params)} runNumber={params.run} />
  );
}
