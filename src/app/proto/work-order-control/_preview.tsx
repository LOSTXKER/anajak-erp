"use client";

/** ตัวหน้าจริงที่กำลังเทียบ — ใช้ทั้งในหน้าเทียบ และในหน้า /view ที่เปิดเต็มจอ */

import { PageShell } from "@/components/page-shell";
import { ProductionModuleNav } from "@/components/production/production-module-nav";

import { VARIANT_COMPONENTS, type WorkOrderControlVariant } from "./_variants";

export type { WorkOrderControlVariant };

export function WorkOrderControlPreview({
  variant,
}: {
  variant: WorkOrderControlVariant;
}) {
  const Variant = VARIANT_COMPONENTS[variant] ?? VARIANT_COMPONENTS.current;
  return (
    <PageShell title="ใบสั่งผลิต" action={<ProductionModuleNav />} width="full">
      <Variant />
    </PageShell>
  );
}
