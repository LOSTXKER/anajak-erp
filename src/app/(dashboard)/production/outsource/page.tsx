import { OutsourcePage } from "@/components/production/outsource-page";
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
    <OutsourcePage
      productionId={params.production}
      origin={operationsOrigin(params)}
    />
  );
}
