import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { outsourceRouter } from "./outsource";

function harness(stepType = "DTF_PRINT", activeRun = false) {
  const step = {
    id: "step-1", productionId: "production-1", stepType, status: "IN_PROGRESS",
    sortOrder: 1, qtyDone: 4, qtyTotal: 10, executionEnabled: false, executionMode: "IN_HOUSE",
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    production: { findUniqueOrThrow: vi.fn().mockResolvedValue({ orderId: "order-1" }) },
    order: { findUniqueOrThrow: vi.fn().mockResolvedValue({ internalStatus: "PRODUCING", orderNumber: "ORD-1" }) },
    productionStep: {
      findUniqueOrThrow: vi.fn(async () => ({ ...step })),
      findMany: vi.fn(async () => [{ ...step }]),
      update: vi.fn(async ({ data }: { data: Partial<typeof step> }) => Object.assign(step, data)),
    },
    printRunItem: { findFirst: vi.fn().mockResolvedValue(activeRun ? { printRun: { runNumber: "PR-1" } } : null) },
    outsourceOrder: {
      findUnique: vi.fn().mockResolvedValue(null),
      aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "outsource-1", ...data })),
    },
    auditLog: { create: vi.fn() },
  };
  const ctx = {
    userId: "manager-1", userRole: "MANAGER", permissionOverrides: null,
    prisma: {
      productionStep: { findUnique: vi.fn().mockResolvedValue({ executionEnabled: false }) },
      $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
    },
  } as unknown as Context;
  return { step, tx, caller: outsourceRouter.createCaller(ctx) };
}

const input = { productionStepId: "step-1", vendorId: "vendor-1", quantity: 6, description: "เครื่องเสีย ส่งทำส่วนที่เหลือ" };

describe("เครื่องเสียส่งร้านแทนบนใบผลิตเดิม", () => {
  it.each(["DTF_PRINT", "HEAT_PRESS", "CUSTOM"])("%s ส่งเฉพาะส่วนที่เหลือ6และคงยอดทำเอง4", async (stepType) => {
    const { caller, step, tx } = harness(stepType);
    await caller.createOrder(input);
    expect(step).toMatchObject({ executionMode: "OUTSOURCE", qtyDone: 4, qtyTotal: 10 });
    expect(tx.outsourceOrder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productionStepId: "step-1", quantity: 6 }),
    }));
  });
  it("ยังมีรอบพิมพ์ค้างต้องยกเลิกหรือปิดก่อน ไม่มีใบส่งเกิด", async () => {
    const { caller, step, tx } = harness("DTF_PRINT", true);
    await expect(caller.createOrder(input)).rejects.toThrow("ยกเลิกหรือปิดรอบเดิม");
    expect(tx.outsourceOrder.create).not.toHaveBeenCalled();
    expect(step.executionMode).toBe("IN_HOUSE");
  });
  it("จำนวนที่ทำเองแล้วห้ามส่งซ้ำไปที่ร้าน", async () => {
    const { caller, tx } = harness();
    await expect(caller.createOrder({ ...input, quantity: 7 })).rejects.toThrow("เหลือส่งได้ 6");
    expect(tx.outsourceOrder.create).not.toHaveBeenCalled();
  });
  it("ขั้นเบิกและรับเสื้อยังต้องใช้เอกสารวัตถุดิบ", async () => {
    const { caller, tx } = harness("GARMENT_RECEIVE");
    await expect(caller.createOrder(input)).rejects.toThrow("เฉพาะขั้นที่กำหนดให้ส่งร้านนอก");
    expect(tx.outsourceOrder.create).not.toHaveBeenCalled();
  });
});
