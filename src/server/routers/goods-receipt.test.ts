import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";

const serviceMocks = vi.hoisted(() => ({
  createGoodsReceipt: vi.fn(),
  confirmCustomerGarmentEvidence: vi.fn(),
  correctCustomerGarmentReceipt: vi.fn(),
}));

vi.mock("@/server/services/goods-receipt", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/services/goods-receipt")>();
  return {
    ...original,
    createGoodsReceipt: serviceMocks.createGoodsReceipt,
    confirmCustomerGarmentEvidence: serviceMocks.confirmCustomerGarmentEvidence,
    correctCustomerGarmentReceipt: serviceMocks.correctCustomerGarmentReceipt,
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
    serviceMocks.correctCustomerGarmentReceipt
      .mockReset()
      .mockResolvedValue({ stepReopened: true, remainingProducts: 1 });
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

  it("V2 Station รับ operationJobId+expectedRevision และไม่ยอม revision หาย", async () => {
    await expect(
      caller("PRODUCTION_STAFF").create({
        ...input,
        operationJobId: "operation-prep-1",
        expectedRevision: 2,
      }),
    ).resolves.toMatchObject({ id: "receipt-1" });
    expect(serviceMocks.createGoodsReceipt).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        operationJobId: "operation-prep-1",
        expectedRevision: 2,
      }),
    );
    await expect(
      caller("PRODUCTION_STAFF").create({
        ...input,
        operationJobId: "operation-prep-1",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("V2 PREP คืนเสื้อลูกค้าได้จาก operation เดิม แต่ legacy target ยังใช้ทางนี้ไม่ได้", async () => {
    const customerReturn = {
      ...input,
      idempotencyKey: "customer-return-v2-0001",
      receiptType: "CUSTOMER_RETURN" as const,
      lines: [{
        orderItemProductId: "product-1",
        description: "เสื้อลูกค้า",
        qtyExpected: 0,
        qtyCounted: 3,
      }],
    };
    await expect(
      caller("PRODUCTION_STAFF").create({
        ...customerReturn,
        operationJobId: "operation-prep-1",
        expectedRevision: 3,
      }),
    ).resolves.toMatchObject({ id: "receipt-1" });
    expect(serviceMocks.createGoodsReceipt).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        receiptType: "CUSTOMER_RETURN",
        operationJobId: "operation-prep-1",
        expectedRevision: 3,
      }),
    );

    await expect(
      caller("PRODUCTION_STAFF").create({
        ...customerReturn,
        productionStepId: "legacy-prep-1",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller("PRODUCTION_STAFF").create({
        ...customerReturn,
        operationJobId: "operation-prep-1",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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

  it("ยืนยัน evidence V2 รับ operationJobId+commandId+expectedRevision เท่านั้น", async () => {
    await expect(
      caller("PRODUCTION_STAFF").confirmCustomerGarmentEvidence({
        operationJobId: "operation-prep-1",
        commandId: "confirm-evidence-0001",
        expectedRevision: 3,
      }),
    ).resolves.toMatchObject({ status: "COMPLETED" });
    expect(serviceMocks.confirmCustomerGarmentEvidence).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        operationJobId: "operation-prep-1",
        commandId: "confirm-evidence-0001",
        expectedRevision: 3,
        userId: "user-1",
      }),
    );

    await expect(
      caller("PRODUCTION_STAFF").confirmCustomerGarmentEvidence({
        operationJobId: "operation-prep-1",
        expectedRevision: 3,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller("PRODUCTION_STAFF").confirmCustomerGarmentEvidence({
        productionStepId: "step-receive-1",
        operationJobId: "operation-prep-1",
        commandId: "confirm-evidence-0002",
        expectedRevision: 3,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

/* ── แก้ยอดตรวจรับที่นับผิด (A15) — คำสั่งของหัวหน้าเท่านั้น และต้องมีเหตุผลเสมอ ── */
describe("goodsReceipt.correctCustomerGarment", () => {
  const fix = {
    orderId: "order-1",
    productionStepId: "step-receive-1",
    idempotencyKey: "fix-receipt-0001",
    reason: "นับซ้ำแล้วขาดจริง 3 ตัว",
    lines: [{ orderItemProductId: "product-1", description: "เสื้อลูกค้า", size: "S", qtyCorrect: 12 }],
  };

  beforeEach(() => {
    serviceMocks.correctCustomerGarmentReceipt
      .mockReset()
      .mockResolvedValue({ stepReopened: true, remainingProducts: 1 });
  });

  it("ช่างที่ไม่ได้เป็นหัวหน้าแก้ยอดไม่ได้", async () => {
    await expect(caller("PRODUCTION_STAFF").correctCustomerGarment(fix)).rejects.toThrow(
      "แก้ยอดตรวจรับได้เฉพาะหัวหน้าฝ่ายผลิต",
    );
    expect(serviceMocks.correctCustomerGarmentReceipt).not.toHaveBeenCalled();
  });

  it("หัวหน้าแก้ได้ และส่งต่อให้ service พร้อมผู้กดกับสิทธิ์", async () => {
    const result = await caller("MANAGER").correctCustomerGarment(fix);
    expect(result).toMatchObject({ stepReopened: true });
    expect(serviceMocks.correctCustomerGarmentReceipt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ...fix, userId: "user-1", canSupervise: true }),
    );
  });

  it("เหตุผลสั้นเกินไปถูกปฏิเสธตั้งแต่ผิว router", async () => {
    await expect(
      caller("MANAGER").correctCustomerGarment({ ...fix, reason: "ก" }),
    ).rejects.toThrow();
    expect(serviceMocks.correctCustomerGarmentReceipt).not.toHaveBeenCalled();
  });
});
