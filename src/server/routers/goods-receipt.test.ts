import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";

const serviceMocks = vi.hoisted(() => ({
  createGoodsReceipt: vi.fn(),
  confirmCustomerGarmentEvidence: vi.fn(),
}));

vi.mock("@/server/services/goods-receipt", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/services/goods-receipt")>();
  return {
    ...original,
    createGoodsReceipt: serviceMocks.createGoodsReceipt,
    confirmCustomerGarmentEvidence: serviceMocks.confirmCustomerGarmentEvidence,
  };
});

import { goodsReceiptRouter } from "./goods-receipt";

const input = {
  orderId: "order-1",
  idempotencyKey: "receipt-router-0001",
  receiptType: "CUSTOMER_GARMENT" as const,
  photoUrls: [],
  lines: [{ orderItemProductId: "product-1", description: "เสื้อลูกค้า", qtyCounted: 1 }],
};

function caller(role: Context["userRole"], permissionOverrides: unknown = null) {
  return goodsReceiptRouter.createCaller({
    prisma: {} as Context["prisma"],
    userId: "user-1",
    userRole: role,
    permissionOverrides,
  });
}

describe("goodsReceipt.create permission by surface", () => {
  beforeEach(() => {
    serviceMocks.createGoodsReceipt.mockReset().mockResolvedValue({ id: "receipt-1", lines: [] });
    serviceMocks.confirmCustomerGarmentEvidence
      .mockReset()
      .mockResolvedValue({ id: "step-receive-1", status: "COMPLETED" });
  });

  it("ใบทั่วไปใช้ manage_delivery แต่ Station ใช้ manage_production", async () => {
    await expect(caller("SALES").create(input)).resolves.toMatchObject({ id: "receipt-1" });
    await expect(
      caller("SALES").create({ ...input, productionStepId: "step-receive-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      caller("PRODUCTION_STAFF", { manage_delivery: false }).create({
        ...input,
        productionStepId: "step-receive-1",
      }),
    ).resolves.toMatchObject({ id: "receipt-1" });
    await expect(
      caller("PRODUCTION_STAFF", { manage_delivery: false }).create(input),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("ส่ง canSupervise จาก effective permission override ไม่ใช่ role อย่างเดียว", async () => {
    await caller("PRODUCTION_STAFF", { supervise_operations: true }).create({
      ...input,
      productionStepId: "step-receive-1",
    });
    expect(serviceMocks.createGoodsReceipt).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ canSupervise: true, productionStepId: "step-receive-1" }),
    );
  });

  it("ยืนยัน evidence เดิมใช้ manage_production และส่ง target เดียว", async () => {
    await expect(
      caller("SALES").confirmCustomerGarmentEvidence({ productionStepId: "step-receive-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller("PRODUCTION_STAFF").confirmCustomerGarmentEvidence({
        productionStepId: "step-receive-1",
      }),
    ).resolves.toMatchObject({ status: "COMPLETED" });
    expect(serviceMocks.confirmCustomerGarmentEvidence).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ productionStepId: "step-receive-1", userId: "user-1" }),
    );
  });
});
