"use client";

/** มุมมองเต็มจอ / กรอบมือถือ ของหน้าลอง "ใบผลิตแบบฟอร์ม" */

import { useProtoFlag, useProtoVariant } from "../../_kit/use-proto-variant";
import { VALUES, type Variant } from "../_engine";
import { Preview } from "../_preview";

export default function WorkOrderFormViewPage() {
  const [variant] = useProtoVariant<Variant>("v", VALUES, "seq");
  const [case7] = useProtoFlag("big", false);
  const [boss] = useProtoFlag("boss", true);
  return (
    <main className="min-h-screen bg-bg px-4 py-5 text-strong sm:px-6 lg:px-8">
      <Preview variant={variant} case7={case7} boss={boss} />
    </main>
  );
}
