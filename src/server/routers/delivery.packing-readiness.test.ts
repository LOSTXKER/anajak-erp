import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { deliveryRouter } from "./delivery";

function ctxFor(tx: Record<string, unknown>, role: Context["userRole"] = "PRODUCTION_STAFF") {
  return {
    prisma: {
      $transaction: vi.fn(
        async (callback: (transaction: unknown) => unknown) => callback(tx),
      ),
    } as unknown as Context["prisma"],
    userId: "factory-user",
    userRole: role,
    permissionOverrides: null,
  } satisfies Context;
}

const incompleteEvidence = {
  items: [
    {
      products: [
        {
          description: "เสื้อยืด",
          variants: [{ size: "M", color: "ดำ", quantity: 5 }],
        },
      ],
    },
  ],
  deliveries: [
    {
      status: "RETURNED",
      lines: [{ description: "เสื้อยืด", size: "M", color: "ดำ", qty: 5 }],
    },
  ],
};

describe("delivery packing evidence persistence", () => {
  it("ปฏิเสธคืนใบ evidence เดียวขณะออเดอร์ READY_TO_SHIP", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      delivery: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({ status: "PREPARING", orderId: "order-1" })
          .mockResolvedValueOnce({ id: "delivery-1", orderId: "order-1", status: "RETURNED" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({ internalStatus: "READY_TO_SHIP" })
          .mockResolvedValueOnce(incompleteEvidence),
      },
    };

    await expect(
      deliveryRouter
        .createCaller(ctxFor(tx))
        .updateStatus({ id: "delivery-1", status: "RETURNED" }),
    ).rejects.toThrow("ยังไม่มีใบส่งของที่ใช้งานอยู่");
  });

  it("ปฏิเสธลบใบ evidence เดียวขณะออเดอร์ READY_TO_SHIP", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      delivery: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ orderId: "order-1" }),
        delete: vi.fn().mockResolvedValue({ id: "delivery-1", orderId: "order-1" }),
      },
      order: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({ internalStatus: "READY_TO_SHIP" })
          .mockResolvedValueOnce(incompleteEvidence),
      },
    };

    await expect(
      deliveryRouter
        .createCaller(ctxFor(tx, "MANAGER"))
        .delete({ id: "delivery-1" }),
    ).rejects.toThrow("ยังไม่มีใบส่งของที่ใช้งานอยู่");
  });

  it("ฝ่ายผลิตส่งค่าจัดส่งเข้าช่องสร้างใบส่งไม่ได้", async () => {
    const ctx = ctxFor({});
    await expect(
      deliveryRouter.createCaller(ctx).create({
        orderId: "order-1",
        recipientName: "ผู้รับ",
        phone: "0812345678",
        address: "1 ถนนสุขุมวิท",
        shippingMethod: "KERRY",
        shippingCost: 99,
        isPaid: false,
        saveAsCustomerAddress: false,
        lines: [],
      }),
    ).rejects.toThrow("ฝ่ายผลิตบันทึกค่าจัดส่ง/สถานะชำระเงินไม่ได้");
  });
});
