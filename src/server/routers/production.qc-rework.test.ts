import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { workOrderStandards } from "@/lib/work-order-standards";
import { QC_REWORK_STEP_NAME } from "@/lib/qc";
import { productionRouter } from "./production";

vi.mock("@/server/services/order-status", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/server/services/order-status")>(),
  finalizeProductionIfComplete: vi.fn(),
}));

function harness() {
  const step = {
    id: "rework-1", productionId: "production-1", stepType: "CUSTOM",
    customStepName: QC_REWORK_STEP_NAME, status: "IN_PROGRESS",
    executionMode: "IN_HOUSE",
    assignedToId: "staff-1", qtyTotal: 3, qtyDone: 2, sortOrder: 4,
    executionEnabled: false, startedAt: new Date("2026-09-10T01:00:00Z"),
  };
  const quantities = [
    { sourceOrderItemVariantId: "variant-m", qtyPlanned: 2, qtyGood: 1, qtyScrap: 1 },
    { sourceOrderItemVariantId: "variant-l", qtyPlanned: 1, qtyGood: 1, qtyScrap: 0 },
  ];
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    production: { findUniqueOrThrow: vi.fn().mockResolvedValue({ orderId: "order-1" }) },
    order: { findUniqueOrThrow: vi.fn().mockResolvedValue({ internalStatus: "PRODUCING" }) },
    productionStep: {
      findUniqueOrThrow: vi.fn(async () => ({ ...step })),
      findMany: vi.fn(async () => [{ ...step }]),
      update: vi.fn(async ({ data }: { data: Partial<typeof step> }) => {
        Object.assign(step, data);
        return { ...step, production: { orderId: "order-1" } };
      }),
    },
    productionStepCheck: { findMany: vi.fn().mockResolvedValue(workOrderStandards("CUSTOM").map((itemKey) => ({ itemKey }))) },
    printRunItem: { findFirst: vi.fn().mockResolvedValue(null) },
    outsourceOrder: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0) },
    operationQuantity: { findMany: vi.fn(async () => quantities), upsert: vi.fn(), updateMany: vi.fn() },
    orderItemVariant: { findMany: vi.fn().mockResolvedValue([
      { id: "variant-m", size: "M", color: "ดำ", quantity: 20,
        orderItemProduct: { id: "product-1", description: "เสื้อ", product: null } },
      { id: "variant-l", size: "L", color: "ดำ", quantity: 30,
        orderItemProduct: { id: "product-1", description: "เสื้อ", product: null } },
    ]) },
    auditLog: { create: vi.fn() },
  };
  const ctx = {
    userId: "staff-1", userRole: "PRODUCTION_STAFF", permissionOverrides: null,
    prisma: { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) },
  } as unknown as Context;
  return { tx, step, quantities, caller: productionRouter.createCaller(ctx) };
}

describe("QC rework commands", () => {
  it("ขั้นส่งร้านแทนแล้วห้ามบันทึกผลในโรงงานซ้ำ", async () => {
    const { tx, step, caller } = harness();
    step.executionMode = "OUTSOURCE";
    await expect(caller.updateStep({ stepId: step.id, status: "COMPLETED" }))
      .rejects.toThrow("ส่งร้านนอกแล้ว");
    await expect(caller.reportPieceQty({ stepId: step.id, rows: [{ variantId: "variant-m", done: 1, waste: 1 }] }))
      .rejects.toThrow("ส่งร้านนอกแล้ว");
    expect(tx.productionStep.update).not.toHaveBeenCalled();
    expect(tx.operationQuantity.upsert).not.toHaveBeenCalled();
  });

  it("ขั้นรีดปกติดี8เสีย2ปิดได้ โดยไม่ปลอมยอดดีเป็น10", async () => {
    const { step, quantities, tx, caller } = harness();
    step.stepType = "HEAT_PRESS";
    step.customStepName = "รีดร้อน";
    step.qtyTotal = 10;
    step.qtyDone = 8;
    quantities.splice(0, quantities.length, { sourceOrderItemVariantId: "variant-m", qtyPlanned: 10, qtyGood: 8, qtyScrap: 2 });
    tx.productionStepCheck.findMany.mockResolvedValue(workOrderStandards("HEAT_PRESS").map((itemKey) => ({ itemKey })));
    await caller.updateStep({ stepId: step.id, status: "COMPLETED" });
    expect(step).toMatchObject({ status: "COMPLETED", qtyDone: 8 });
  });
  it("นับตามไซซ์งานแก้ 2/1 แม้ออเดอร์เดิมเป็น 20/30", async () => {
    const { tx, caller } = harness();
    await caller.reportPieceQty({ stepId: "rework-1", rows: [
      { variantId: "variant-m", done: 1, waste: 1 },
      { variantId: "variant-l", done: 1, waste: 0 },
    ] });
    expect(tx.operationQuantity.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { qtyGood: 1, qtyScrap: 1, qtyPlanned: 2 },
    }));
    await expect(caller.reportPieceQty({ stepId: "rework-1", rows: [
      { variantId: "variant-m", done: 3, waste: 0 },
    ] })).rejects.toThrow("เกิน 2 ตัว");
  });

  it("ปิดไม่ได้หากยังไม่บันทึกครบทุกไซซ์ แม้ส่ง qtyDone ลัดเข้ามา", async () => {
    const { tx, quantities, caller } = harness();
    quantities[1]!.qtyGood = 0;
    await expect(caller.updateStep({ stepId: "rework-1", status: "COMPLETED", qtyDone: 3 }))
      .rejects.toThrow("ครบทุกไซซ์");
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("ปิดผลแก้ดี2เสีย1โดยเก็บยอดดี2ตามจริง ไม่ถือว่าดีครบ3", async () => {
    const { tx, step, caller } = harness();
    await caller.updateStep({ stepId: "rework-1", status: "COMPLETED" });
    expect(step).toMatchObject({ status: "COMPLETED", qtyDone: 2 });
    expect(tx.productionStep.update).toHaveBeenCalledOnce();
  });
});
