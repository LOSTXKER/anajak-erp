import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { deliveryRouter } from "./delivery";

/**
 * ตีกลับใบส่งต้องมีเหตุผล (งานแก้/เคลม ก้อน 0 — เบสสั่ง 2026-09-18)
 * เดิมเป็นการเปลี่ยนคำเดียวจบ ไม่เหลือร่องรอยว่าทำไมของถึงกลับมา
 * เทสต์ยิงผ่าน router จริงบน prisma ปลอม — ด่านอยู่ก่อนเขียนทุกอย่าง จึงไม่ต้องมีฐาน
 */
function contextFor(currentStatus: string) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    delivery: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ status: currentStatus, orderId: "order-1" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    order: { findUniqueOrThrow: vi.fn().mockResolvedValue({ internalStatus: "SHIPPED" }) },
    orderRevision: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
  };
  const ctx: Context = {
    prisma: {
      $transaction: vi.fn(async (callback: (transaction: unknown) => unknown) => callback(tx)),
    } as unknown as Context["prisma"],
    userId: "manager-1",
    userRole: "MANAGER",
    permissionOverrides: null,
  };
  return { ctx, tx };
}

describe("delivery.updateStatus — ตีกลับต้องมีเหตุผล", () => {
  it("ปฏิเสธเมื่อกดตีกลับโดยไม่ระบุเหตุผล", async () => {
    const { ctx, tx } = contextFor("SHIPPED");

    await expect(
      deliveryRouter.createCaller(ctx).updateStatus({ id: "d-1", status: "RETURNED" }),
    ).rejects.toThrow("ระบุเหตุผลที่ตีกลับ");

    // ด่านอยู่ก่อนเขียน — ใบส่งต้องไม่ถูกแตะเลย
    expect(tx.delivery.updateMany).not.toHaveBeenCalled();
    expect(tx.orderRevision.create).not.toHaveBeenCalled();
  });

  it("ปฏิเสธเมื่อเหตุผลมีแต่ช่องว่าง", async () => {
    const { ctx, tx } = contextFor("DELIVERED");

    await expect(
      deliveryRouter.createCaller(ctx).updateStatus({ id: "d-1", status: "RETURNED", reason: "   " }),
    ).rejects.toThrow("ระบุเหตุผลที่ตีกลับ");

    expect(tx.delivery.updateMany).not.toHaveBeenCalled();
  });

  it("สถานะอื่นไม่ถูกบังคับเหตุผล — ด่านนี้คุมเฉพาะขาตีกลับ", async () => {
    const { ctx, tx } = contextFor("PENDING");

    // ขานี้เดินต่อไปโค้ดส่วนอื่นที่ mock ไม่ครบได้ — ที่ต้องพิสูจน์คือ "ไม่ได้ตกที่ด่านเหตุผล"
    const error = await deliveryRouter
      .createCaller(ctx)
      .updateStatus({ id: "d-1", status: "PREPARING" })
      .then(() => null, (e: Error) => e);

    expect(tx.delivery.findUniqueOrThrow).toHaveBeenCalled();
    if (error) expect(error.message).not.toContain("ระบุเหตุผลที่ตีกลับ");
  });
});
