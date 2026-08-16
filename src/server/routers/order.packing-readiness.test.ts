import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { orderRouter } from "./order";

function orderContext(tx: Record<string, unknown>, internalStatus = "PACKING") {
  const auditCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
  const ctx: Context = {
    prisma: {
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "order-1",
          orderType: "CUSTOM",
          internalStatus,
          customerStatus: "IN_PROGRESS",
        }),
      },
      auditLog: { create: auditCreate },
      $transaction: vi.fn(
        async (callback: (transaction: unknown) => unknown) => callback(tx),
      ),
    } as unknown as Context["prisma"],
    userId: "owner-1",
    userRole: "OWNER",
    permissionOverrides: null,
  };
  return { ctx, auditCreate };
}

function transitionTx(packedQty: number) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    order: {
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValueOnce({
          orderType: "CUSTOM",
          internalStatus: "PACKING",
          stockReservationError: null,
        })
        .mockResolvedValueOnce({
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
              status: "PREPARING",
              lines: [{ description: "เสื้อยืด", size: "M", color: "ดำ", qty: packedQty }],
            },
          ],
        })
        .mockResolvedValueOnce({
          id: "order-1",
          orderType: "CUSTOM",
          internalStatus: "READY_TO_SHIP",
          customerStatus: "READY",
        }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    orderRevision: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "revision-1" }),
    },
  };
}

describe("order.updateStatus — packing evidence", () => {
  it("ปฏิเสธ PACKING → READY_TO_SHIP เมื่อใบส่งยังนับสินค้าไม่ครบ", async () => {
    const tx = transitionTx(4);
    const { ctx, auditCreate } = orderContext(tx);

    await expect(
      orderRouter.createCaller(ctx).updateStatus({
        id: "order-1",
        internalStatus: "READY_TO_SHIP",
      }),
    ).rejects.toThrow("ยังแพ็คสินค้าไม่ครบ");

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("ยอมให้พร้อมส่งเมื่อมีใบส่งที่ใช้งานอยู่และนับครบทุกไซส์", async () => {
    const tx = transitionTx(5);
    const { ctx, auditCreate } = orderContext(tx);

    await expect(
      orderRouter.createCaller(ctx).updateStatus({
        id: "order-1",
        internalStatus: "READY_TO_SHIP",
      }),
    ).resolves.toMatchObject({ internalStatus: "READY_TO_SHIP" });

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ internalStatus: "READY_TO_SHIP" }) }),
    );
    expect(auditCreate).toHaveBeenCalledOnce();
  });

  it("ปฏิเสธกด SHIPPED มือเมื่อเหลือแต่ใบส่ง RETURNED", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      order: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            orderType: "CUSTOM",
            internalStatus: "READY_TO_SHIP",
            stockReservationError: null,
          })
          .mockResolvedValueOnce({
            items: [],
            deliveries: [{ status: "RETURNED", lines: [] }],
          }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      orderRevision: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "revision-1" }),
      },
    };
    const { ctx, auditCreate } = orderContext(tx, "READY_TO_SHIP");

    await expect(
      orderRouter.createCaller(ctx).updateStatus({
        id: "order-1",
        internalStatus: "SHIPPED",
      }),
    ).rejects.toThrow("ยังไม่มีใบส่งของที่ใช้งานอยู่");
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
