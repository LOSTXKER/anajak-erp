"use client";

import {
  INTERNAL_STATUS_LABELS,
  INTERNAL_STATUS_COLORS,
  INTERNAL_STATUS_EXCEPTIONS,
  INTERNAL_STATUS_STAGES,
} from "@/lib/order-status";
import type { InternalStatus } from "@prisma/client";
import { FlowFilterBar, type FlowFilterItem } from "@/components/ui/flow-filter-bar";

/* ============================================================
   แถบเส้นทางงานเหนือตาราง (เบสเคาะแบบ C 2026-08-01)

   อ่านซ้ายไปขวาเป็นเส้นทางงานจริง: รับงาน → ออกแบบ → ผลิต → ส่งของ → ปิดงาน
   ตอบคำถาม "ตอนนี้งานกองอยู่ช่วงไหนของสายการผลิต" ได้ในตาเดียว

   2026-08-15: ย้ายหน้าตาไปอยู่ `ui/flow-filter-bar.tsx` เพื่อให้หน้าผลิตใช้
   ภาษาเดียวกันจริง (เบสทัก "ใช้อันเดียวกันกับหน้าออเดอร์ได้มั้ย") — ไฟล์นี้
   เหลือหน้าที่แปลงสถานะออเดอร์เป็น item ของแถบกลาง ไม่มีการเปลี่ยนหน้าตา
   ============================================================ */

function dotFor(status: InternalStatus) {
  const c = INTERNAL_STATUS_COLORS[status];
  if (!c) return "bg-slate-400";
  if (c.text.includes("green")) return "bg-green-500";
  if (c.text.includes("red")) return "bg-red-500";
  if (c.text.includes("amber") || c.text.includes("yellow")) return "bg-amber-500";
  if (c.text.includes("blue")) return "bg-blue-500";
  return "bg-slate-400";
}

const FLOW_STATUS_ORDER = INTERNAL_STATUS_STAGES.flatMap(
  (s) => s.statuses,
) as InternalStatus[];

const COMPACT_STATUS_LABELS: Partial<Record<InternalStatus, string>> = {
  CONFIRMED: "ยืนยัน",
  DESIGNING: "ออกแบบ",
  DESIGN_APPROVED: "อนุมัติ",
  PRODUCTION_QUEUE: "รอผลิต",
  PRODUCING: "ผลิต",
  QUALITY_CHECK: "ตรวจงาน",
  PACKING: "แพ็ค",
  READY_TO_SHIP: "พร้อมส่ง",
  SHIPPED: "ส่งแล้ว",
  COMPLETED: "เสร็จ",
};

function compactLabelFor(status: InternalStatus) {
  return COMPACT_STATUS_LABELS[status] ?? INTERNAL_STATUS_LABELS[status];
}

export function OrderStatusFlowBar({
  counts,
  selected,
  onSelect,
  isLoading,
}: {
  /** จำนวนงานต่อสถานะ — นับจากตัวกรองอื่นที่เปิดอยู่ แต่ไม่รวมตัวสถานะเอง */
  counts: Record<string, number> | undefined;
  selected: string;
  onSelect: (status: string) => void;
  isLoading?: boolean;
}) {
  const toItem = (status: InternalStatus): FlowFilterItem => ({
    key: status,
    label: compactLabelFor(status),
    fullLabel: INTERNAL_STATUS_LABELS[status],
    count: counts?.[status] ?? 0,
    dotClass: dotFor(status),
  });

  return (
    <FlowFilterBar
      ariaLabel="กรองตามสถานะงาน"
      mobileAriaLabel="กรองตามสถานะในเส้นทางงาน"
      items={FLOW_STATUS_ORDER.map(toItem)}
      groups={INTERNAL_STATUS_STAGES.map((stage) => ({
        label: stage.label,
        keys: [...stage.statuses],
      }))}
      aside={{
        label: "นอกเส้นทาง",
        ariaLabel: "สถานะนอกเส้นทางงาน",
        items: INTERNAL_STATUS_EXCEPTIONS.map(toItem),
      }}
      selected={selected}
      onSelect={onSelect}
      isLoading={isLoading}
    />
  );
}
