"use client";

/** มุมมองเต็มจอของหน้าลองใบผลิต — เปิดเป็นหน้าต่างจอทัช 1024×768 / มือถือ / เต็มจอ */

import { useProtoFlag, useProtoVariant } from "../../_kit/use-proto-variant";
import { Preview, VALUES, type Variant } from "../_preview";
import { cn } from "@/lib/utils";

export default function WorkOrderViewPage() {
  const [variant] = useProtoVariant<Variant>("v", VALUES, "tabs");
  const [touch] = useProtoFlag("touch");
  return (
    <main className={cn("min-h-screen bg-bg px-4 py-5 text-strong sm:px-6 lg:px-8", touch && "dark")}>
      <Preview variant={variant} touch={touch} />
    </main>
  );
}
