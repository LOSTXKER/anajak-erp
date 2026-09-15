import type { ExtendedPrismaClient } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { startOfBangkokDay } from "@/lib/date-utils";
import { createNotification } from "@/server/helpers";

/**
 * แจ้งเตือนของร้านนอกเลยนัดรับ (ROADMAP C2 ส่วนร้านนอก · เบสสั่งทำ 2026-09-16)
 * เรียกจาก cron รายวันตัวเดิม (/api/cron/overdue) — แจ้งหัวหน้า (supervise_operations) ครั้งเดียวต่อใบส่งร้าน
 * กันแจ้งซ้ำด้วยแถวแจ้งเตือนเดิม (entityType OUTSOURCE_OVERDUE + entityId ของใบ) ไม่เพิ่ม schema
 */

export const OUTSOURCE_AT_SHOP_STATUSES = ["SENT", "IN_PROGRESS", "COMPLETED"] as const;
export const OUTSOURCE_OVERDUE_ENTITY = "OUTSOURCE_OVERDUE";

export type OutsourceOverdueCandidate = { id: string; status: string; expectedBackAt: Date | null };

/** ใบที่อยู่ที่ร้านและนัดรับก่อนวันนี้ (วันไทย) และยังไม่เคยแจ้ง */
export function pickNewOverdueOutsource<T extends OutsourceOverdueCandidate>(orders: readonly T[], notifiedIds: ReadonlySet<string>, now: Date): T[] {
  const today = startOfBangkokDay(now).getTime();
  return orders.filter(
    (order) =>
      (OUTSOURCE_AT_SHOP_STATUSES as readonly string[]).includes(order.status) &&
      !!order.expectedBackAt &&
      order.expectedBackAt.getTime() < today &&
      !notifiedIds.has(order.id),
  );
}

export async function sweepOverdueOutsource(prisma: ExtendedPrismaClient, now = new Date()) {
  const orders = await prisma.outsourceOrder.findMany({
    where: { status: { in: [...OUTSOURCE_AT_SHOP_STATUSES] }, expectedBackAt: { lt: startOfBangkokDay(now) } },
    select: {
      id: true,
      status: true,
      expectedBackAt: true,
      description: true,
      vendor: { select: { name: true } },
      productionStep: { select: { production: { select: { order: { select: { orderNumber: true } } } } } },
    },
  });
  if (orders.length === 0) return { overdue: 0, notified: 0 };

  const already = await prisma.notification.findMany({
    where: { entityType: OUTSOURCE_OVERDUE_ENTITY, entityId: { in: orders.map((o) => o.id) } },
    select: { entityId: true },
  });
  const fresh = pickNewOverdueOutsource(orders, new Set(already.map((n) => n.entityId!).filter(Boolean)), now);
  if (fresh.length === 0) return { overdue: orders.length, notified: 0 };

  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true, role: true, permissionOverrides: true } });
  const supervisors = users.filter((user) => hasPermission(user.role, user.permissionOverrides, "supervise_operations"));

  await prisma.$transaction(async (tx) => {
    for (const order of fresh) {
      const orderNumber = order.productionStep.production.order.orderNumber;
      for (const user of supervisors) {
        await createNotification(tx, {
          userId: user.id,
          type: "PRODUCTION",
          title: `ร้านนอกเลยนัดรับ — ${orderNumber}`,
          message: `${order.vendor.name} · ${order.description}`,
          link: "/production/outsource",
          entityType: OUTSOURCE_OVERDUE_ENTITY,
          entityId: order.id,
        });
      }
    }
  });
  return { overdue: orders.length, notified: fresh.length };
}
