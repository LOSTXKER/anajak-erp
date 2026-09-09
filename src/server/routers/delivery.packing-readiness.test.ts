import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { deliveryRouter } from "./delivery";

function ctxFor(tx: Record<string, unknown>, role: Context["userRole"] = "SALES") {
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
  it("คนกดส่งชนะ lock ก่อนคนลบ: ต้องอ่านสถานะสดแล้วเก็บประวัติใบส่งไว้", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      delivery: {
        findUniqueOrThrow: vi.fn()
          .mockResolvedValueOnce({ orderId: "order-1", status: "PREPARING" })
          .mockResolvedValueOnce({ status: "SHIPPED" }),
        delete: vi.fn(),
      },
    };
    await expect(deliveryRouter.createCaller(ctxFor(tx, "MANAGER")).delete({ id: "delivery-1" }))
      .rejects.toThrow("ใบส่งที่ออกแล้วต้องเก็บประวัติ");
    expect(tx.delivery.delete).not.toHaveBeenCalled();
  });

  it("ห้ามนำใบตีกลับกลับมาแพ็กเมื่อเปิดใบส่งทดแทนครบยอดแล้ว", async () => {
    const line = { description: "เสื้อยืด", size: "M", color: "ดำ", qty: 5 };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      delivery: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "delivery-returned", status: "RETURNED", orderId: "order-1", lines: [line],
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          items: incompleteEvidence.items,
          deliveries: [
            { status: "RETURNED", lines: [line] },
            { status: "PREPARING", lines: [line] },
          ],
        }),
      },
    };
    await expect(deliveryRouter.createCaller(ctxFor(tx)).updateStatus({
      id: "delivery-returned", status: "PREPARING",
    })).rejects.toThrow("เปลี่ยนเป็น");
    expect(tx.delivery.updateMany).not.toHaveBeenCalled();
  });

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

  it("ฝ่ายผลิตสร้างใบส่งไม่ได้ — การแพ็กย้ายไป Station และการส่งเป็นงานออฟฟิศ", async () => {
    const ctx = ctxFor({}, "PRODUCTION_STAFF");
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
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("ปฏิเสธ SHIPPED เมื่อ owner Final Pack ยังทำไม่ครบ", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      delivery: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "delivery-1",
          status: "PREPARING",
          orderId: "order-1",
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({ internalStatus: "PACKING" })
          .mockResolvedValueOnce({
            productionCompletionOwnerId: "production-1",
            productions: [
              { id: "production-1", workOrderNumber: "MO-2608-0001" },
            ],
            productionCompletionOwner: {
              id: "production-1",
              workOrderNumber: "MO-2608-0001",
              completionOwnerStepId: "pack-1",
              steps: [
                {
                  id: "pack-1",
                  operationState: "RUNNING",
                  quantities: [
                    {
                      description: "เสื้อยืด",
                      size: "M",
                      color: "ดำ",
                      qtyPlanned: 5,
                      qtyGood: 4,
                      qtyRework: 0,
                    },
                  ],
                },
              ],
            },
          }),
      },
    };

    await expect(
      deliveryRouter
        .createCaller(ctxFor(tx))
        .updateStatus({ id: "delivery-1", status: "SHIPPED" }),
    ).rejects.toThrow("ต้องปิด Final Pack");
    expect(tx.delivery.updateMany).not.toHaveBeenCalled();
  });

  it("สร้าง Delivery lines จาก Final Pack ledger เมื่อออฟฟิศไม่กรอกยอดซ้ำ", async () => {
    const createDelivery = vi.fn().mockResolvedValue({
      id: "delivery-1",
      orderId: "order-1",
      status: "PENDING",
    });
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      order: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            internalStatus: "READY_TO_SHIP",
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
            deliveries: [],
          })
          .mockResolvedValueOnce({
            productionCompletionOwnerId: "production-1",
            productions: [
              { id: "production-1", workOrderNumber: "MO-2608-0001" },
            ],
            productionCompletionOwner: {
              id: "production-1",
              workOrderNumber: "MO-2608-0001",
              completionOwnerStepId: "pack-1",
              steps: [
                {
                  id: "pack-1",
                  operationState: "COMPLETED",
                  quantities: [
                    {
                      description: "เสื้อยืด",
                      size: "M",
                      color: "ดำ",
                      qtyPlanned: 5,
                      qtyGood: 5,
                      qtyRework: 0,
                    },
                  ],
                },
              ],
            },
          }),
      },
      delivery: { create: createDelivery },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    };

    await deliveryRouter.createCaller(ctxFor(tx)).create({
      orderId: "order-1",
      recipientName: "ผู้รับ",
      phone: "0812345678",
      address: "1 ถนนสุขุมวิท",
      shippingMethod: "KERRY",
      shippingCost: 0,
      isPaid: false,
      saveAsCustomerAddress: false,
      lines: [],
    });

    expect(createDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lines: {
            create: [
              {
                description: "เสื้อยืด",
                size: "M",
                color: "ดำ",
                qty: 5,
              },
            ],
          },
        }),
      }),
    );
  });

  it("เติม lines ให้ใบส่งเดิมจาก Final Pack ledger ก่อนเปลี่ยนเป็น SHIPPED", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const packedOrder = {
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
      deliveries: [{ status: "PREPARING", lines: [] }],
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      delivery: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            id: "delivery-1",
            status: "PREPARING",
            orderId: "order-1",
          })
          .mockResolvedValueOnce({
            id: "delivery-1",
            status: "SHIPPED",
            orderId: "order-1",
          }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        count: vi.fn().mockResolvedValue(1),
      },
      deliveryLine: {
        count: vi.fn().mockResolvedValue(0),
        createMany,
      },
      order: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({ internalStatus: "READY_TO_SHIP" })
          .mockResolvedValueOnce({
            productionCompletionOwnerId: "production-1",
            productions: [
              { id: "production-1", workOrderNumber: "MO-2608-0001" },
            ],
            productionCompletionOwner: {
              id: "production-1",
              workOrderNumber: "MO-2608-0001",
              completionOwnerStepId: "pack-1",
              steps: [
                {
                  id: "pack-1",
                  operationState: "COMPLETED",
                  quantities: [
                    {
                      description: "เสื้อยืด",
                      size: "M",
                      color: "ดำ",
                      qtyPlanned: 5,
                      qtyGood: 5,
                      qtyRework: 0,
                    },
                  ],
                },
              ],
            },
          })
          .mockResolvedValueOnce(packedOrder)
          .mockResolvedValueOnce(packedOrder),
      },
    };

    await deliveryRouter
      .createCaller(ctxFor(tx))
      .updateStatus({ id: "delivery-1", status: "SHIPPED" });

    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          deliveryId: "delivery-1",
          description: "เสื้อยืด",
          size: "M",
          color: "ดำ",
          qty: 5,
        },
      ],
    });
  });
});
