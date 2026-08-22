import { describe, expect, it, vi } from "vitest";
import {
  STOCK_RESERVATION_PENDING_MESSAGE,
  STOCK_RESERVATION_PENDING_PRODUCTION_MESSAGE,
} from "@/lib/stock-reservation-state";
import {
  finalizeProductionIfComplete,
  reopenProductionsForRework,
  transitionOrder,
} from "./order-status";

function transitionTx(params?: { pendingInitially?: boolean; pendingAfterRead?: boolean }) {
  const initial = {
    orderType: "CUSTOM",
    internalStatus: "PRODUCTION_QUEUE",
    stockReservationError: params?.pendingInitially
      ? STOCK_RESERVATION_PENDING_MESSAGE
      : null,
  };
  const findUniqueOrThrow = vi
    .fn()
    .mockResolvedValueOnce(initial)
    .mockResolvedValueOnce({
      stockReservationError: params?.pendingAfterRead
        ? STOCK_RESERVATION_PENDING_MESSAGE
        : null,
    });
  const updateMany = vi.fn().mockResolvedValue({
    count: params?.pendingAfterRead ? 0 : 1,
  });
  const tx = {
    order: { findUniqueOrThrow, updateMany },
    orderRevision: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "revision-1" }),
    },
  };
  return { tx, findUniqueOrThrow, updateMany };
}

describe("transitionOrder — pending stock reservation gate", () => {
  it("blocks PRODUCING when the reservation update is already pending", async () => {
    const { tx, updateMany } = transitionTx({ pendingInitially: true });

    await expect(
      transitionOrder(tx as never, {
        orderId: "order-1",
        to: "PRODUCING",
        changedBy: "user-1",
      }),
    ).rejects.toThrow(STOCK_RESERVATION_PENDING_PRODUCTION_MESSAGE);

    expect(updateMany).not.toHaveBeenCalled();
  });

  it("keeps the gate atomic when pending is set between read and update", async () => {
    const { tx, updateMany, findUniqueOrThrow } = transitionTx({
      pendingAfterRead: true,
    });

    await expect(
      transitionOrder(tx as never, {
        orderId: "order-1",
        to: "PRODUCING",
        changedBy: "user-1",
      }),
    ).rejects.toThrow(STOCK_RESERVATION_PENDING_PRODUCTION_MESSAGE);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "order-1",
        internalStatus: "PRODUCTION_QUEUE",
        OR: [
          { stockReservationError: null },
          {
            stockReservationError: {
              not: STOCK_RESERVATION_PENDING_MESSAGE,
            },
          },
        ],
      },
      data: expect.objectContaining({ internalStatus: "PRODUCING" }),
    });
    expect(findUniqueOrThrow).toHaveBeenCalledTimes(2);
  });

  it("allows PRODUCING after the reservation settles", async () => {
    const { tx, updateMany } = transitionTx();

    await expect(
      transitionOrder(tx as never, {
        orderId: "order-1",
        to: "PRODUCING",
        changedBy: "user-1",
      }),
    ).resolves.toEqual({ changed: true, from: "PRODUCTION_QUEUE" });

    expect(updateMany).toHaveBeenCalledOnce();
  });
});

describe("finalizeProductionIfComplete — legacy PACKAGING compatibility", () => {
  it("legacy finalizer ปฏิเสธ Operation Job ของ Production V2", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: {
        findMany: vi.fn().mockResolvedValue([
          {
            stepType: "HEAT_PRESS",
            status: "COMPLETED",
            executionEnabled: true,
          },
        ]),
        updateMany: vi.fn(),
      },
      production: { update: vi.fn() },
    };

    await expect(
      finalizeProductionIfComplete(tx as never, {
        productionId: "production-v2",
        changedBy: "worker-1",
      }),
    ).rejects.toThrow("Production V2");
    expect(tx.productionStep.updateMany).not.toHaveBeenCalled();
    expect(tx.production.update).not.toHaveBeenCalled();
  });

  it("ไม่ปิดใบที่มีแต่ PACKAGING เก่าผ่าน finalizer ปกติ", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: {
        findMany: vi.fn().mockResolvedValue([
          { id: "step-pack", stepType: "PACKAGING", status: "PENDING" },
        ]),
        updateMany: vi.fn(),
      },
      production: { update: vi.fn() },
    };

    await expect(
      finalizeProductionIfComplete(tx as never, {
        productionId: "production-pack-only",
        changedBy: "user-1",
      }),
    ).resolves.toBe(false);

    expect(tx.productionStep.updateMany).not.toHaveBeenCalled();
    expect(tx.production.update).not.toHaveBeenCalled();
  });

  it("ยอมปิดใบ PACKAGING-only เฉพาะทางกู้ที่ประกาศชัดว่าเป็นข้อมูลเก่า", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: {
        findMany: vi.fn().mockResolvedValue([
          { id: "step-pack", stepType: "PACKAGING", status: "PENDING" },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      production: {
        update: vi.fn().mockResolvedValue({ orderId: "order-1" }),
        count: vi.fn().mockResolvedValue(1),
      },
    };

    await expect(
      finalizeProductionIfComplete(tx as never, {
        productionId: "production-pack-only",
        changedBy: "user-1",
        requireLegacyPackaging: true,
      }),
    ).resolves.toBe(true);

    expect(tx.productionStep.updateMany).toHaveBeenCalledOnce();
    expect(tx.production.update).toHaveBeenCalledOnce();
  });

  it("ปิด PACKAGING เก่าอัตโนมัติและดันเข้า QC เมื่อขั้นผลิตจริงเสร็จครบ", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: {
        findMany: vi.fn().mockResolvedValue([
          { id: "step-press", stepType: "HEAT_PRESS", status: "COMPLETED" },
          { id: "step-pack", stepType: "PACKAGING", status: "PENDING" },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      production: {
        update: vi.fn().mockResolvedValue({ orderId: "order-1" }),
        count: vi.fn().mockResolvedValue(0),
      },
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          orderType: "CUSTOM",
          internalStatus: "PRODUCING",
          stockReservationError: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      orderRevision: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "revision-1" }),
      },
    };

    await expect(
      finalizeProductionIfComplete(tx as never, {
        productionId: "production-1",
        changedBy: "user-1",
      }),
    ).resolves.toBe(true);

    expect(tx.productionStep.updateMany).toHaveBeenCalledWith({
      where: {
        productionId: "production-1",
        stepType: "PACKAGING",
        status: { not: "COMPLETED" },
      },
      data: { status: "COMPLETED", completedAt: expect.any(Date) },
    });
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ internalStatus: "QUALITY_CHECK" }),
      }),
    );
  });
});

describe("reopenProductionsForRework — V2 boundary", () => {
  it("ไม่สร้าง legacy CUSTOM step ลง Work Order V2", async () => {
    const tx = {
      production: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "production-1",
            workOrderNumber: "MO-2608-0001",
            steps: [{ sortOrder: 5, executionEnabled: true }],
          },
        ]),
        update: vi.fn(),
      },
      productionStep: { create: vi.fn() },
    };

    await expect(
      reopenProductionsForRework(tx as never, {
        orderId: "order-1",
        reason: "QC ไม่ผ่าน",
      }),
    ).rejects.toThrow("Rework Case");
    expect(tx.production.update).not.toHaveBeenCalled();
    expect(tx.productionStep.create).not.toHaveBeenCalled();
  });
});
