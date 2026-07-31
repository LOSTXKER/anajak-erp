import type { Prisma } from "@prisma/client";
import { STUCK_AFTER_DAYS } from "@/server/services/owner-pulse";

export const ORDER_ATTENTIONS = ["overdue", "due-soon", "stuck"] as const;

export type OrderAttention = (typeof ORDER_ATTENTIONS)[number];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * ตัวกรอง drill-down ต้องใช้นิยามเดียวกับ Owner Pulse บน Dashboard:
 * - overdue / due-soon ไม่นับงานร่าง งานส่งแล้ว งานจบ และงานยกเลิก
 * - stuck คือ active order ที่ทั้งหัวงานและ revision เงียบเกิน 3 วัน
 */
/**
 * ป้าย "เร่งด่วน" ของออเดอร์แต่ละใบสำหรับคอลัมน์ในตาราง (เบสสั่ง 2026-07-31 —
 * เลิกใช้ชิปกรองด้านบน ย้ายมาเป็นคอลัมน์ที่เรียงได้แทน)
 *
 * ต้องใช้นิยามชุดเดียวกับ orderAttentionWhere เป๊ะ ไม่งั้นคอลัมน์จะบอกคนละเรื่อง
 * กับตัวเลขบนแดชบอร์ด · "ติดหล่ม" ต้องดูประวัติแก้ไขด้วย หน้าเว็บคำนวณเองไม่ได้
 * จึงให้ server ส่ง stuckIds มาให้ (ดู order.list)
 *
 * ลำดับความสำคัญ: เลยกำหนด > ใกล้กำหนด > ติดหล่ม — ใบเดียวติดได้หลายข้อ
 * เอาข้อที่แรงสุดข้อเดียวมาแสดง ไม่งั้นคอลัมน์รกจนอ่านไม่ทัน
 */
export function orderAttentionOf(
  order: {
    id: string;
    deadline: Date | string | null;
    internalStatus: string;
  },
  stuckIds: ReadonlySet<string>,
  now = new Date()
): OrderAttention | null {
  const exemptForDeadline = ["COMPLETED", "CANCELLED", "SHIPPED", "DRAFT"];
  if (order.deadline && !exemptForDeadline.includes(order.internalStatus)) {
    const due = new Date(order.deadline).getTime();
    if (due < now.getTime()) return "overdue";
    if (due <= now.getTime() + 48 * HOUR_MS) return "due-soon";
  }
  return stuckIds.has(order.id) ? "stuck" : null;
}

export function orderAttentionWhere(
  attention: OrderAttention,
  now = new Date()
): Prisma.OrderWhereInput {
  if (attention === "overdue") {
    return {
      internalStatus: {
        notIn: ["COMPLETED", "CANCELLED", "SHIPPED", "DRAFT"],
      },
      deadline: { lt: now },
    };
  }

  if (attention === "due-soon") {
    return {
      internalStatus: {
        notIn: ["COMPLETED", "CANCELLED", "SHIPPED", "DRAFT"],
      },
      deadline: { gte: now, lte: new Date(now.getTime() + 48 * HOUR_MS) },
    };
  }

  const stuckBefore = new Date(now.getTime() - STUCK_AFTER_DAYS * DAY_MS);
  return {
    internalStatus: { notIn: ["COMPLETED", "CANCELLED", "DRAFT"] },
    updatedAt: { lt: stuckBefore },
    revisions: { none: { createdAt: { gte: stuckBefore } } },
  };
}
