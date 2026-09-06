"use client";

/** มุมมองเต็มจอ / หน้าต่างมือถือของหน้าลอง "ใบผลิตเบาลง" */

import { useProtoFlag, useProtoVariant } from "../../_kit/use-proto-variant";
import { Preview, VALUES, type Variant } from "../_preview";

export default function WorkOrderLeanViewPage() {
  const [variant] = useProtoVariant<Variant>("v", VALUES, "cut");
  const [complex] = useProtoFlag("complex", false);
  const [boss] = useProtoFlag("boss", true);
  return (
    <main className="min-h-screen bg-bg px-4 py-5 text-strong sm:px-6 lg:px-8">
      <Preview variant={variant} complex={complex} boss={boss} idPrefix="view" numbers={false} />
    </main>
  );
}
