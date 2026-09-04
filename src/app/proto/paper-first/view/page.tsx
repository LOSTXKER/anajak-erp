"use client";

/** มุมมองเต็มจอของหน้าลอง "กระดาษเป็นหลัก" */

import { useProtoFlag, useProtoVariant } from "../../_kit/use-proto-variant";
import { Preview, VALUES, type Variant } from "../_preview";

export default function PaperFirstViewPage() {
  const [variant] = useProtoVariant<Variant>("v", VALUES, "three");
  const [out] = useProtoFlag("out", true);
  const [boss] = useProtoFlag("boss", true);
  return (
    <main className="min-h-screen bg-bg px-4 py-5 text-strong sm:px-6 lg:px-8">
      <Preview variant={variant} out={out} boss={boss} />
    </main>
  );
}
