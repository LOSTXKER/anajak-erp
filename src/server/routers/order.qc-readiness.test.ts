import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { orderRouter } from "./order";

describe("order.updateStatus — QC evidence", () => {
  it("ปฏิเสธ QUALITY_CHECK → PACKING เมื่อบันทึกของดีเพียงบางส่วน", async () => {
    const tx = {
      order: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            orderType: "CUSTOM",
            internalStatus: "QUALITY_CHECK",
            stockReservationError: null,
          })
          .mockResolvedValueOnce({
            items: [
              {
                products: [
                  { variants: [{ quantity: 100 }] },
                ],
              },
            ],
            qcRecords: [{ qtyGood: 40, qtyDefect: 0 }],
          }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      orderRevision: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "revision-1" }),
      },
      production: { count: vi.fn() },
    };
    const auditCreate = vi.fn();
    const ctx: Context = {
      prisma: {
        order: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: "order-1",
            orderType: "CUSTOM",
            internalStatus: "QUALITY_CHECK",
            customerStatus: "IN_PRODUCTION",
          }),
        },
        auditLog: { create: auditCreate },
        $transaction: vi.fn(
          async (callback: (transaction: unknown) => unknown) => callback(tx),
        ),
      } as unknown as Context["prisma"],
      userId: "production-staff-1",
      userRole: "PRODUCTION_STAFF",
      permissionOverrides: null,
    };

    await expect(
      orderRouter.createCaller(ctx).updateStatus({
        id: "order-1",
        internalStatus: "PACKING",
      }),
    ).rejects.toThrow("QC ยังตรวจของดีไม่ครบ");

    expect(tx.production.count).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
