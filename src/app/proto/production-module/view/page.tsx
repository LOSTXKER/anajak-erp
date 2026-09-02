"use client";

/**
 * มุมมองเต็มจอของหน้าลองโมดูลผลิต — ไว้เปิดเป็นหน้าต่างขนาดจอทัช (1024×768) หรือเต็มจอ
 * ไม่มีแถบควบคุม ให้เห็นเฉพาะสิ่งที่ผู้ใช้จะเห็นจริง
 */

import { useProtoFlag, useProtoVariant } from "../../_kit/use-proto-variant";
import { Preview, VALUES, type Variant } from "../_preview";
import { cn } from "@/lib/utils";

export default function ProductionModuleViewPage() {
  const [variant] = useProtoVariant<Variant>("v", VALUES, "desk");
  const [busy] = useProtoFlag("busy");
  const [station] = useProtoFlag("station");
  return (
    <main
      className={cn(
        "min-h-screen bg-bg px-4 py-5 text-strong sm:px-6 lg:px-8",
        station && "dark",
      )}
    >
      <Preview variant={variant} busy={busy} station={station} />
    </main>
  );
}
