import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";

const services = vi.hoisted(() => ({ finalize: vi.fn() }));
vi.mock("@/server/services/order-status", () => ({
  finalizeProductionIfComplete: services.finalize,
  transitionOrder: vi.fn(),
}));

import { productionRouter } from "./production";

function harness(status = "PENDING", orderStatus = "PRODUCING") {
  const step = {
    id: "press-1", stepType: "HEAT_PRESS", customStepName: null, status,
    executionMode: "IN_HOUSE", executionEnabled: false, notes: null,
    qtyDone: status === "COMPLETED" ? 10 : 0, qtyTotal: 10, startedAt: null,
    outsourceOrders: [],
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    production: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        status: orderStatus === "QUALITY_CHECK" ? "COMPLETED" : "IN_PROGRESS",
        orderId: "order-1", steps: [step],
      }),
    },
    order: { findUniqueOrThrow: vi.fn().mockResolvedValue({ internalStatus: orderStatus }) },
    productionStep: { update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const ctx: Context = {
    prisma: { $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run(tx)) } as unknown as Context["prisma"],
    userId: "staff-1", userRole: "PRODUCTION_STAFF", permissionOverrides: null,
  };
  return { ctx, tx, step };
}

beforeEach(() => {
  vi.clearAllMocks();
  services.finalize.mockResolvedValue(true);
});

describe("sendToQc requires actual completion", () => {
  it.each(["PENDING", "IN_PROGRESS", "FAILED", "ON_HOLD"])(
    "ไม่ถือว่าผ่านขั้นรีด %s ที่ยังไม่ปิดหรือยังไม่ติ๊กข้อกำหนด", async (status) => {
      const { ctx, tx } = harness(status);
      await expect(productionRouter.createCaller(ctx).sendToQc({ productionId: "production-1" }))
        .rejects.toThrow("ต้องปิด");
      expect(tx.productionStep.update).not.toHaveBeenCalled();
      expect(services.finalize).not.toHaveBeenCalled();
      expect(tx.auditLog.create).not.toHaveBeenCalled();
    },
  );

  it("ส่งใบที่ปิดครบทุกขั้นเข้าทาง finalize กลางได้", async () => {
    const { ctx, tx } = harness("COMPLETED");
    await expect(productionRouter.createCaller(ctx).sendToQc({ productionId: "production-1" }))
      .resolves.toMatchObject({ closed: 0 });
    expect(tx.productionStep.update).not.toHaveBeenCalled();
    expect(services.finalize).toHaveBeenCalledWith(tx, { productionId: "production-1", changedBy: "staff-1" });
  });

  it("กดซ้ำหลังส่งสำเร็จตอบสถานะเดิมโดยไม่เขียนซ้ำ", async () => {
    const { ctx, tx } = harness("COMPLETED", "QUALITY_CHECK");
    await expect(productionRouter.createCaller(ctx).sendToQc({ productionId: "production-1" }))
      .resolves.toMatchObject({ closed: 0, movedToQc: true, orderStatus: "QUALITY_CHECK" });
    expect(services.finalize).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
