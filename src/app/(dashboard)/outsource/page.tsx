import { redirect } from "next/navigation";
import { LegacyOutsourcePage } from "@/components/outsource/legacy-outsource-page";
import { productionV2Enabled } from "@/lib/production-v2-flag";

export default function OutsourcePage() {
  if (productionV2Enabled()) redirect("/production?view=outsource");
  return <LegacyOutsourcePage />;
}
