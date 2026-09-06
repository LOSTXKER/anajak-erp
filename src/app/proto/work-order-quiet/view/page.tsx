"use client";

/** มุมมองเต็มจอของหน้าลอง "ใบผลิตเงียบลง" */

import { useProtoFlag, useProtoVariant } from "../../_kit/use-proto-variant";
import { Preview, VALUES, type Variant } from "../_preview";

export default function WorkOrderQuietViewPage() {
  const [variant] = useProtoVariant<Variant>("v", VALUES, "cut");
  const [out] = useProtoFlag("out", true);
  const [boss] = useProtoFlag("boss", true);
  return (
    <main className="min-h-screen bg-bg px-4 py-5 text-strong sm:px-6 lg:px-8">
      <Preview variant={variant} out={out} boss={boss} />
    </main>
  );
}
