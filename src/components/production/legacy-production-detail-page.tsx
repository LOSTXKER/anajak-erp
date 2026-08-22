"use client";

import { use } from "react";
import { ProductionDetailScreen } from "@/components/production/production-detail-screen";
import { normalizeProductionDetailTab } from "@/lib/production-detail-tabs";

export function LegacyProductionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { id } = use(params);
  const query = use(searchParams);
  const rawTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;

  return (
    <ProductionDetailScreen
      key={id}
      id={id}
      initialTab={normalizeProductionDetailTab(rawTab) ?? undefined}
    />
  );
}
