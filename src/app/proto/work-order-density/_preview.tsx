"use client";

/** ตัวหน้าจริงที่กำลังเทียบ — ใช้ทั้งในหน้าเทียบ และในหน้า /view ที่เปิดเต็มจอ */

import { ExternalLink } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { StatusLabel } from "@/components/ui/status-label";

import { BIG_WORK_ORDER, SMALL_WORK_ORDER } from "./_data";
import { VARIANT_COMPONENTS, type WorkOrderDensityVariant } from "./_variants";

export type { WorkOrderDensityVariant };

export function WorkOrderDensityPreview({
  variant,
  big = false,
}: {
  variant: WorkOrderDensityVariant;
  /** สลับไปใบใหญ่ที่มีสายร้านนอก · จำนวน 27 แถว · ปัญหา 3 · ประวัติ 19 */
  big?: boolean;
}) {
  const workOrder = big ? BIG_WORK_ORDER : SMALL_WORK_ORDER;
  const Variant = VARIANT_COMPONENTS[variant] ?? VARIANT_COMPONENTS.current;
  return (
    <PageShell
      title={workOrder.workOrderNumber}
      description={`${workOrder.orderNumber} · ${workOrder.customerName}`}
      back={{ href: "/production", label: "กลับไปรายการผลิต" }}
      titleBadge={<StatusLabel label={workOrder.stateLabel} tone="warning" />}
      action={
        /* ของจริงมีปุ่มเดียวตอนใบปล่อยผลิตแล้ว — "ปล่อยผลิต" ขึ้นเฉพาะใบที่ยังเป็นร่าง */
        <Button variant="outline">
          เปิดออเดอร์ <ExternalLink />
        </Button>
      }
      width="full"
    >
      <Variant workOrder={workOrder} />
    </PageShell>
  );
}
