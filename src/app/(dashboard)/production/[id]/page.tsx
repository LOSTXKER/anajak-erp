"use client";

import { use } from "react";
import { ProductionDetailScreen } from "@/components/production/production-detail-screen";

export default function ProductionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ProductionDetailScreen id={id} />;
}
