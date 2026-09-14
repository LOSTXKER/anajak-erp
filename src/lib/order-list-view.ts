import type { InternalStatus } from "@prisma/client";
import {
  INTERNAL_STATUS_COLORS,
  INTERNAL_STATUS_EXCEPTIONS,
  INTERNAL_STATUS_STAGES,
} from "@/lib/order-status";
import { isAttentionStatus } from "@/lib/order-progress";

/* ============================================================
   หน้ารายการออเดอร์ (รื้อ 2026-09-14 ตามต้นแบบรอบ 2 ที่เบสเคาะ "โอเคทำจริงเลย")
   ราง pipeline = 5 ช่วงของเส้นทางงาน + นอกเส้นทาง · หัวหน้า = ทั้งหมด/กำลังเดิน/เลยกำหนด
   ตัวเลขมาจาก order.list (statusCounts/overdueCounts) — ไฟล์นี้จัดวางและตีความอย่างเดียว
   ============================================================ */

export type OrderStatusTone = "neutral" | "brand" | "warning" | "success" | "danger";

/** โทนของสถานะภายใน — อ่านจากสีกลาง INTERNAL_STATUS_COLORS ไม่ประกาศสีชุดใหม่ */
export function orderStatusTone(status: string): OrderStatusTone {
  const text = (INTERNAL_STATUS_COLORS as Record<string, { text: string } | undefined>)[status]?.text ?? "";
  if (text.includes("red")) return "danger";
  if (text.includes("green")) return "success";
  if (text.includes("amber")) return "warning";
  if (text.includes("blue")) return "brand";
  return "neutral";
}

/** ป้ายสั้นบนราง — ป้ายเต็มอยู่ใน aria-label ของ node */
export const PIPELINE_SHORT_LABELS: Record<InternalStatus, string> = {
  DRAFT: "ร่าง",
  INQUIRY: "สอบถาม",
  CONFIRMED: "ยืนยัน",
  DESIGNING: "ออกแบบ",
  DESIGN_APPROVED: "อนุมัติแบบ",
  PRODUCTION_QUEUE: "รอผลิต",
  PRODUCING: "ผลิต",
  QUALITY_CHECK: "ตรวจงาน",
  PACKING: "แพ็ค",
  READY_TO_SHIP: "พร้อมส่ง",
  SHIPPED: "ส่งแล้ว",
  COMPLETED: "เสร็จ",
  CANCELLED: "ยกเลิก",
  ON_HOLD: "พักงาน",
};

export interface PipelineStage {
  label: string;
  statuses: InternalStatus[];
}

/** ช่วงบนราง · "ร่าง" โผล่เฉพาะตอนมีงานร่างหรือกำลังกรองอยู่ (ไม่ใช่ขั้นที่ทีมเดินงานจริง) */
export function pipelineStages(
  counts: Record<string, number> | undefined,
  selected: string,
): PipelineStage[] {
  return INTERNAL_STATUS_STAGES.map((stage) => ({
    label: stage.label,
    statuses: stage.statuses.filter(
      (status) => status !== "DRAFT" || (counts?.[status] ?? 0) > 0 || selected === status,
    ),
  }));
}

export const PIPELINE_EXCEPTIONS: readonly InternalStatus[] = INTERNAL_STATUS_EXCEPTIONS;

export interface OrdersHeadline {
  total: number;
  active: number;
  overdue: number;
}

/** ตัวเลขใต้หัวหน้า — ชุดเดียวกับราง (ตัวกรองอื่นมีผล แต่สถานะที่เลือกไม่มีผล) */
export function ordersHeadline(
  statusCounts?: Record<string, number>,
  overdueCounts?: Record<string, number>,
): OrdersHeadline {
  let total = 0;
  let active = 0;
  for (const [status, count] of Object.entries(statusCounts ?? {})) {
    total += count;
    if (isAttentionStatus(status)) active += count;
  }
  const overdue = Object.values(overdueCounts ?? {}).reduce((sum, count) => sum + count, 0);
  return { total, active, overdue };
}
