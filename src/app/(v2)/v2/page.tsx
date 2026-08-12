import { permanentRedirect } from "next/navigation";
import { legacyV2RedirectHref, type LegacySearchParams } from "@/lib/v2-navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<LegacySearchParams>;
}) {
  permanentRedirect(legacyV2RedirectHref("/v2", await searchParams));
}
