import { FilmStockPage } from "@/components/production/film-stock-page";
import {
  operationsOrigin,
  type OperationsSearchParams,
} from "@/components/production/operations-navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<OperationsSearchParams>;
}) {
  return <FilmStockPage origin={operationsOrigin(await searchParams)} />;
}
