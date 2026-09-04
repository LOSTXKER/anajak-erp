"use client";

/** มุมมองเต็มจอของหน้าลองโซนลงมือ */

import { useProtoFlag, useProtoVariant } from "../../_kit/use-proto-variant";
import { Preview, VALUES, type Variant } from "../_preview";

export default function ActionZoneViewPage() {
  const [variant] = useProtoVariant<Variant>("v", VALUES, "menu");
  const [boss] = useProtoFlag("boss", true);
  return (
    <main className="min-h-screen bg-bg px-4 py-5 text-strong sm:px-6 lg:px-8">
      <Preview variant={variant} boss={boss} />
    </main>
  );
}
