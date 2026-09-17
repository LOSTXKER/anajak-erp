import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { orderRouter } from "./order";

/**
 * ถอย "พร้อมส่ง → กำลังแพ็ค" (กติกาถอยสถานะที่เบสเคาะ 2026-09-18)
 *   · ข้ามเส้น "ของออกจากโรงงาน" → หัวหน้า + ต้องมีเหตุผล
 *   · ของที่ออกไปแล้วย้อนไม่ได้ — ใบส่งที่ SHIPPED/DELIVERED ต้องตีกลับก่อน
 * เทสต์นี้ยิงผ่าน router จริงบน prisma ปลอม จึงพิสูจน์ด่านโดยไม่ต้องมีฐาน
 */
function contextFor(options: {
  role: Context["userRole"];
  shippedOutDeliveries: number;
}) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    order: {
      // ตัวแรก = transitionOrder อ่านสถานะสด · ตัวถัดไปเผื่อโค้ดอ่านซ้ำ
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        orderType: "CUSTOM",
        internalStatus: "READY_TO_SHIP",
        stockReservationError: null,
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    orderRevision: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "rev-1" }),
    },
    delivery: {
      count: vi.fn().mockResolvedValue(options.shippedOutDeliveries),
    },
  };
  const auditCreate = vi.fn();
  const ctx: Context = {
    prisma: {
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "order-1",
          orderType: "CUSTOM",
          internalStatus: "READY_TO_SHIP",
          customerStatus: "READY",
          totalAmount: 0,
        }),
      },
      auditLog: { create: auditCreate },
      $transaction: vi.fn(async (callback: (transaction: unknown) => unknown) => callback(tx)),
    } as unknown as Context["prisma"],
    userId: "manager-1",
    userRole: options.role,
    permissionOverrides: null,
  };
  return { ctx, tx, auditCreate };
}

describe("order.updateStatus — ถอยจากพร้อมส่งกลับไปแพ็ค", () => {
  it("ปฏิเสธเมื่อมีใบส่งที่ออกไปแล้ว — ให้ตีกลับใบส่งก่อน", async () => {
    const { ctx, tx, auditCreate } = contextFor({ role: "MANAGER", shippedOutDeliveries: 2 });

    await expect(
      orderRouter.createCaller(ctx).updateStatus({
        id: "order-1",
        internalStatus: "PACKING",
        reason: "ลูกค้าขอเปลี่ยนกล่อง",
      }),
    ).rejects.toThrow("มีใบส่งที่ออกไปแล้ว");

    // ด่านอยู่หลัง transition (ใช้ from จริงใน tx) — throw แล้ว transaction ทั้งก้อนถูก rollback
    expect(tx.delivery.count).toHaveBeenCalledWith({
      where: { orderId: "order-1", status: { in: ["SHIPPED", "DELIVERED"] } },
    });
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("ปฏิเสธเมื่อไม่ระบุเหตุผล ทั้งที่เป็นผู้จัดการ", async () => {
    const { ctx, tx } = contextFor({ role: "MANAGER", shippedOutDeliveries: 0 });

    await expect(
      orderRouter.createCaller(ctx).updateStatus({
        id: "order-1",
        internalStatus: "PACKING",
      }),
    ).rejects.toThrow("ต้องระบุเหตุผล");

    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it("ปฏิเสธเมื่อไม่ใช่หัวหน้า แม้ใส่เหตุผลมาแล้ว", async () => {
    const { ctx, tx } = contextFor({ role: "PRODUCTION_STAFF", shippedOutDeliveries: 0 });

    await expect(
      orderRouter.createCaller(ctx).updateStatus({
        id: "order-1",
        internalStatus: "PACKING",
        reason: "แพ็คผิดไซซ์",
      }),
    ).rejects.toThrow();

    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });
});
