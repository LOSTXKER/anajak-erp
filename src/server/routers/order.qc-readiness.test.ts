import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { orderRouter } from "./order";

describe("order.updateStatus — QC evidence", () => {
  it("ปฏิเสธ PRODUCING → QUALITY_CHECK เมื่อยังมีใบผลิตหรือขั้นงานค้าง", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ internalStatus: "PRODUCING" }),
        updateMany: vi.fn(),
      },
      production: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "production-1",
            status: "IN_PROGRESS",
            steps: [{ stepType: "HEAT_PRESS", status: "PENDING" }],
          },
        ]),
      },
    };
    const auditCreate = vi.fn();
    const ctx: Context = {
      prisma: {
        order: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: "order-1",
            orderType: "CUSTOM",
            internalStatus: "PRODUCING",
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
        internalStatus: "QUALITY_CHECK",
      }),
    ).rejects.toThrow("ยังมีใบผลิตหรือขั้นงานค้างอยู่");

    expect(String(tx.$queryRaw.mock.calls[0]?.[0])).toContain("pg_advisory_xact_lock");
    expect(String(tx.$queryRaw.mock.calls[1]?.[0])).toContain("production_steps");
    expect(String(tx.$queryRaw.mock.calls[2]?.[0])).toContain("productions");
    expect(String(tx.$queryRaw.mock.calls[3]?.[0])).toContain("orders");
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("ยอม recovery PRODUCING → QUALITY_CHECK เมื่อใบผลิตและ workflow เสร็จจริงทั้งหมด", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      order: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({ internalStatus: "PRODUCING" })
          .mockResolvedValueOnce({
            orderType: "CUSTOM",
            internalStatus: "PRODUCING",
            stockReservationError: null,
          })
          .mockResolvedValueOnce({
            id: "order-1",
            internalStatus: "QUALITY_CHECK",
            customerStatus: "IN_PRODUCTION",
          }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      production: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "production-1",
            status: "COMPLETED",
            steps: [
              { stepType: "HEAT_PRESS", status: "COMPLETED" },
              { stepType: "PACKAGING", status: "PENDING" },
            ],
          },
        ]),
      },
      orderRevision: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "revision-1" }),
      },
    };
    const ctx: Context = {
      prisma: {
        order: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: "order-1",
            orderType: "CUSTOM",
            internalStatus: "PRODUCING",
            customerStatus: "IN_PRODUCTION",
          }),
        },
        auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
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
        internalStatus: "QUALITY_CHECK",
      }),
    ).resolves.toMatchObject({ internalStatus: "QUALITY_CHECK" });

    expect(tx.order.updateMany).toHaveBeenCalledOnce();
  });

  it("QUALITY_CHECK → PRODUCING ถือ topology mutex ก่อน transition และเปิดงานแก้", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      order: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            orderType: "CUSTOM",
            internalStatus: "QUALITY_CHECK",
            stockReservationError: null,
          })
          .mockResolvedValueOnce({
            id: "order-1",
            orderType: "CUSTOM",
            internalStatus: "PRODUCING",
            customerStatus: "IN_PRODUCTION",
          }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      orderRevision: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "revision-1" }),
      },
      production: {
        findMany: vi.fn().mockResolvedValue([
          { id: "production-1", steps: [{ sortOrder: 2 }] },
        ]),
        update: vi.fn().mockResolvedValue({ id: "production-1" }),
      },
      productionStep: {
        create: vi.fn().mockResolvedValue({ id: "rework-step-1" }),
      },
    };
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
        auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
        $transaction: vi.fn(
          async (callback: (transaction: unknown) => unknown) => callback(tx),
        ),
      } as unknown as Context["prisma"],
      userId: "production-staff-1",
      userRole: "PRODUCTION_STAFF",
      permissionOverrides: null,
    };

    await orderRouter.createCaller(ctx).updateStatus({
      id: "order-1",
      internalStatus: "PRODUCING",
      reason: "QC พบตำหนิ",
    });

    expect(String(tx.$queryRaw.mock.calls[0]?.[0])).toContain(
      "pg_advisory_xact_lock",
    );
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.order.updateMany.mock.invocationCallOrder[0],
    );
    expect(tx.productionStep.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productionId: "production-1",
        customStepName: "งานแก้ (QC ไม่ผ่าน)",
      }),
    });
  });

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
