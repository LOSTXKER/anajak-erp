import { redirect } from "next/navigation";
import { LegacyFilmStockPage } from "@/components/production/legacy-film-stock-page";
import { productionV2Enabled } from "@/lib/production-v2-flag";

export default function FilmStockPage() {
  if (productionV2Enabled()) redirect("/production?view=work-centers&center=DTF_PRINT");
  return <LegacyFilmStockPage />;
}
