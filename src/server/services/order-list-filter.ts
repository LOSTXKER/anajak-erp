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
