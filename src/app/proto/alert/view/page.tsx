"use client";

/** มุมมองเต็มจอของหน้าลองกล่องแจ้งเตือน — เปิดขนาดมือถือ / เต็มจอ */

import { useProtoVariant } from "../../_kit/use-proto-variant";
import { Preview, VALUES, type Variant } from "../_preview";

export default function AlertViewPage() {
  const [variant] = useProtoVariant<Variant>("v", VALUES, "mark");
  return (
    <main className="min-h-screen bg-bg px-4 py-5 text-strong sm:px-6 lg:px-8">
      <Preview variant={variant} />
    </main>
  );
}
