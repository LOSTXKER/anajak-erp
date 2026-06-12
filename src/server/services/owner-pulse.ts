/**
 * 5 ตัวเลขเจ้าของ — "จอเช้า 10 วินาที" (FLOW-REDESIGN ก้อน 2 · doc หัวข้อ 8 จอที่ 5)
 *
 * ① งานเสี่ยงเลยกำหนด — งาน active ที่เลยกำหนด/จะถึงใน 48 ชม.
 * ② ค้างร้านนอก — ใบ outsource ค้างที่ร้าน + เลยกำหนดรับ (พ้นสิ้นวันไทย)
 * ③ คิววันนี้ — ขั้นผลิตที่ปิดวันนี้ / (ปิดวันนี้ + ยังค้าง)
 * ④ เงินรอเก็บ — บิลเลยกำหนด + ใบเสนอส่งแล้วค้างตอบ
 * ⑤ งานติดหล่ม — งาน active ที่เงียบ (ไม่มีความเคลื่อนไหว) เกิน N วัน
 *
 * เป็น service กลางจงใจ — MCP เฟสแรก (ก้อน 5) ใช้ตัวเลขชุดเดียวกันนี้
 * ห้ามคืนรายละเอียดเงินลึกเกินจำนวนนับ (ผู้เรียกต้อง gate role เอง: OWNER/MANAGER)
 */

import type { ExtendedPrismaClient } from "@/lib/prisma";

// งานที่ยังต้องดูแล — พ้นสถานะจบ/ยกเลิกแล้วไม่นับ
const ACTIVE_ORDER_STATUSES_EXCLUDED = ["COMPLETED", "CANCELLED"] as const;
// งานติดหล่ม: เงียบเกินกี่วัน (doc ไม่ระบุ N — เคาะ 3 วัน · ปรับได้ที่เดียวตรงนี้)
export const STUCK_AFTER_DAYS = 3;

export interface OwnerPulse {
  /** ① งานเสี่ยงเลยกำหนด (เลยแล้ว + จะถึงใน 48 ชม.) */
  atRiskOrders: { overdue: number; dueSoon: number };
  /** ② ร้านนอก */
  outsource: { pending: number; overduePickup: number };
  /** ③ คิววันนี้ */
  todayQueue: { done: number; open: number };
  /** ④ เงินรอเก็บ */
  money: { overdueInvoices: number; quotationsAwaiting: number };
  /** ⑤ งานติดหล่ม (เงียบเกิน STUCK_AFTER_DAYS วัน) */
  stuckOrders: number;
}

export async function getOwnerPulse(prisma: ExtendedPrismaClient): Promise<OwnerPulse> {
  const now = new Date();
  // สิ้นวันไทยของเมื่อวาน = เส้น "เลยกำหนดรับ" ฝั่ง outsource (นิยามเดียวกับหน้า /outsource)
  const startOfTodayTh = new Date(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now) + "T00:00:00+07:00"
  );
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const stuckBefore = new Date(now.getTime() - STUCK_AFTER_DAYS * 24 * 60 * 60 * 1000);

  const [
    overdue,
    dueSoon,
    outsourcePending,
    outsourceOverduePickup,
    stepsDoneToday,
    stepsOpen,
    overdueInvoices,
    quotationsAwaiting,
    stuckOrders,
  ] = await Promise.all([
    prisma.order.count({
      where: {
        internalStatus: { notIn: [...ACTIVE_ORDER_STATUSES_EXCLUDED, "SHIPPED", "DRAFT"] },
        deadline: { lt: now },
      },
    }),
    prisma.order.count({
      where: {
        internalStatus: { notIn: [...ACTIVE_ORDER_STATUSES_EXCLUDED, "SHIPPED", "DRAFT"] },
        deadline: { gte: now, lte: in48h },
      },
    }),
    prisma.outsourceOrder.count({
      where: { status: { in: ["SENT", "IN_PROGRESS"] } },
    }),
    prisma.outsourceOrder.count({
      where: { status: { in: ["SENT", "IN_PROGRESS"] }, expectedBackAt: { lt: startOfTodayTh } },
    }),
    prisma.productionStep.count({ where: { completedAt: { gte: startOfTodayTh } } }),
    prisma.productionStep.count({
      where: {
        status: { in: ["PENDING", "IN_PROGRESS"] },
        production: { order: { internalStatus: { notIn: ["CANCELLED", "ON_HOLD"] } } },
      },
    }),
    // นิยามเดียวกับ analytics.dashboard — บิลเลยกำหนดที่ยังไม่ถูกยกเลิก
    prisma.invoice.count({ where: { paymentStatus: "OVERDUE", isVoided: false } }),
    prisma.quotation.count({ where: { status: "SENT" } }),
    prisma.order.count({
      where: {
        internalStatus: { notIn: [...ACTIVE_ORDER_STATUSES_EXCLUDED, "DRAFT"] },
        updatedAt: { lt: stuckBefore },
        // อัปเดตขั้นผลิตไม่แตะ order.updatedAt — เช็คประวัติ (revision) ประกอบ
        // กันงานที่กำลังเดินจริงถูกนับเป็นติดหล่ม
        revisions: { none: { createdAt: { gte: stuckBefore } } },
      },
    }),
  ]);

  return {
    atRiskOrders: { overdue, dueSoon },
    outsource: { pending: outsourcePending, overduePickup: outsourceOverduePickup },
    todayQueue: { done: stepsDoneToday, open: stepsOpen },
    money: { overdueInvoices, quotationsAwaiting },
    stuckOrders,
  };
}
