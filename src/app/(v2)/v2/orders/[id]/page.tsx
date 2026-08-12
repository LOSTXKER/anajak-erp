import { permanentRedirect } from "next/navigation";
import { legacyV2RedirectHref, type LegacySearchParams } from "@/lib/v2-navigation";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<LegacySearchParams>;
}) {
  const { id } = await params;
  permanentRedirect(
    legacyV2RedirectHref(
      `/v2/orders/${encodeURIComponent(id)}`,
      await searchParams,
    ),
  );
}
