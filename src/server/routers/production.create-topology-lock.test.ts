import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { productionRouter } from "./production";

type ProductEvidence = {
  id: string;
  productType: string;
  productId: string | null;
  itemSource: string | null;
  receivedInspected: boolean;
  variants: Array<{ size: string; color: string | null; quantity: number }>;
};

type ReceiptEvidence = {
  orderItemProductId: string;
  size: string;
  color: string | null;
  qtyCounted: number;
  receipt: { receiptType: "CUSTOMER_GARMENT" | "CUSTOMER_RETURN" };
};

const customerProduct = (
  id: string,
  quantity: number,
  receivedInspected: boolean,
): ProductEvidence => ({
  id,
  productType: "TSHIRT",
  productId: id,
  itemSource: "CUSTOMER_PROVIDED",
  receivedInspected,
  variants: [{ size: "M", color: null, quantity }],
});

function receivedLedger(products: ProductEvidence[]): ReceiptEvidence[] {
  return products.flatMap((product) =>
    product.variants.map((variant) => ({
      orderItemProductId: product.id,
      size: variant.size,
      color: variant.color,
      qtyCounted: variant.quantity,
      receipt: { receiptType: "CUSTOMER_GARMENT" as const },
    })),
  );
}

function makeCreateHarness(
  products: ProductEvidence[],
  receiptEvidence: ReceiptEvidence[] = [],
) {
  const events: string[] = [];
  let createdSteps: Array<Record<string, unknown>> = [];
  let productionStatus = "PENDING";
  let orderStatus = "PRODUCING";
  const tx = {
    $queryRaw: vi.fn(async (...args: unknown[]) => {
      const query = String(args[0]);
      events.push(
        query.includes("pg_advisory_xact_lock")
          ? "topology-lock"
          : query.includes("orders")
            ? "order-lock"
            : "other-lock",
      );
      return [];
    }),
    orderItemProduct: {
      findMany: vi.fn(async () => {
        events.push("evidence-read");
        return products;
      }),
    },
    goodsReceiptLine: {
      findMany: vi.fn(async () => {
        events.push("receipt-ledger-read");
        return receiptEvidence;
      }),
    },
    production: {
      create: vi.fn(async (args: { data: { steps: { create: unknown[] } } }) => {
        events.push("production-insert");
        createdSteps = (args.data.steps.create as Array<Record<string, unknown>>).map(
          (step) => ({ status: "PENDING", ...step }),
        );
        return {
          id: "production-1",
          orderId: "order-1",
          status: productionStatus,
          steps: createdSteps,
        };
      }),
      update: vi.fn(async ({ data }: { data: { status: string } }) => {
        productionStatus = data.status;
        return { orderId: "order-1" };
      }),
      count: vi.fn().mockResolvedValue(0),
      findUniqueOrThrow: vi.fn(async () => ({
        id: "production-1",
        orderId: "order-1",
        status: productionStatus,
        steps: createdSteps,
      })),
    },
    productionStep: {
      findMany: vi.fn(async () =>
        createdSteps.map((step) => ({
          stepType: step.stepType,
          status: step.status,
        })),
      ),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    order: {
      findUniqueOrThrow: vi.fn(async () => ({
        orderType: "CUSTOM",
        internalStatus: orderStatus,
        stockReservationError: null,
      })),
      updateMany: vi.fn(async ({ data }: { data: { internalStatus: string } }) => {
        orderStatus = data.internalStatus;
        return { count: 1 };
      }),
    },
    orderRevision: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "revision-1" }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
  const transaction = vi.fn(
    async (callback: (transaction: typeof tx) => unknown) => callback(tx),
  );
  const ctx: Context = {
    prisma: { $transaction: transaction } as unknown as Context["prisma"],
    userId: "manager-1",
    userRole: "MANAGER",
    permissionOverrides: null,
  };
  return {
    ctx,
    tx,
    events,
    state: {
      productionStatus: () => productionStatus,
      orderStatus: () => orderStatus,
    },
  };
}

describe("production.create topology reconciliation", () => {
  it("อ่าน receipt evidence สดหลัง topology lock และก่อน insert ใบผลิต", async () => {
    const harness = makeCreateHarness([
      {
        id: "order-product-1",
        productType: "TSHIRT",
        productId: "product-1",
        itemSource: "FROM_STOCK",
        receivedInspected: false,
        variants: [{ size: "M", color: null, quantity: 12 }],
      },
    ]);

    await productionRouter.createCaller(harness.ctx).create({
      orderId: "order-1",
      steps: [{ stepType: "GARMENT_PICK", sortOrder: 1 }],
    });

    expect(harness.events).toEqual([
      "topology-lock",
      "order-lock",
      "evidence-read",
      "production-insert",
    ]);
    expect(harness.tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(String(harness.tx.$queryRaw.mock.calls[0]?.[0])).toContain(
      "pg_advisory_xact_lock",
    );
    expect(String(harness.tx.$queryRaw.mock.calls[1]?.[0])).toContain("orders");
    expect(harness.tx.orderItemProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderItem: { orderId: "order-1" } },
        select: expect.objectContaining({
          id: true,
          variants: { select: expect.objectContaining({ color: true }) },
        }),
      }),
    );
  });

  it("receipt-before-production ครบทุก customer product ปิด GARMENT_RECEIVE พร้อมจำนวน", async () => {
    const products = [
      customerProduct("customer-1", 3, false),
      customerProduct("customer-2", 2, false),
    ];
    products[0]!.variants = [
      { size: "M", color: null, quantity: 1 },
      { size: "L", color: null, quantity: 2 },
    ];
    const harness = makeCreateHarness(products, receivedLedger(products));

    await productionRouter.createCaller(harness.ctx).create({
      orderId: "order-1",
      steps: [
        { stepType: "GARMENT_RECEIVE", sortOrder: 1 },
        { stepType: "DTF_PRINT", sortOrder: 2 },
      ],
    });

    const createSteps = harness.tx.production.create.mock.calls[0]?.[0].data.steps.create;
    expect(createSteps[0]).toMatchObject({
      stepType: "GARMENT_RECEIVE",
      status: "COMPLETED",
      qtyTotal: 5,
      qtyDone: 5,
      completedAt: expect.any(Date),
    });
    expect(createSteps[1]).toEqual(
      expect.not.objectContaining({ status: "COMPLETED", completedAt: expect.any(Date) }),
    );
    expect(harness.tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        newValue: expect.objectContaining({ autoCompletedGarmentReceiveSteps: 1 }),
      }),
    });
    expect(harness.tx.production.update).not.toHaveBeenCalled();
    expect(harness.state.productionStatus()).toBe("PENDING");
    expect(harness.state.orderStatus()).toBe("PRODUCING");
  });

  it("มีเพียง GARMENT_RECEIVE ที่ auto-complete ต้องปิด production และดัน order เข้า QC", async () => {
    const products = [customerProduct("customer-1", 5, false)];
    const harness = makeCreateHarness(products, receivedLedger(products));

    const result = await productionRouter.createCaller(harness.ctx).create({
      orderId: "order-1",
      steps: [{ stepType: "GARMENT_RECEIVE", sortOrder: 1 }],
    });

    expect(harness.tx.production.update).toHaveBeenCalledWith({
      where: { id: "production-1" },
      data: { status: "COMPLETED", endDate: expect.any(Date) },
      select: { orderId: true },
    });
    expect(harness.tx.production.count).toHaveBeenCalledWith({
      where: { orderId: "order-1", status: { not: "COMPLETED" } },
    });
    expect(harness.tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ internalStatus: "QUALITY_CHECK" }) }),
    );
    expect(harness.state.productionStatus()).toBe("COMPLETED");
    expect(harness.state.orderStatus()).toBe("QUALITY_CHECK");
    expect(result).toMatchObject({ status: "COMPLETED" });
  });

  it.each([
    {
      label: "cache true แต่ไม่มี receipt ledger",
      products: [
        customerProduct("customer-1", 3, true),
        customerProduct("customer-2", 2, true),
      ],
    },
    {
      label: "ไม่มี customer product",
      products: [
        {
          id: "stock-order-product-1",
          productType: "TSHIRT",
          productId: "stock-1",
          itemSource: "FROM_STOCK",
          receivedInspected: false,
          variants: [{ size: "M", color: null, quantity: 5 }],
        },
      ],
    },
  ])("$label ต้องคง GARMENT_RECEIVE เป็น PENDING เดิม", async ({ products }) => {
    const harness = makeCreateHarness(products);

    await productionRouter.createCaller(harness.ctx).create({
      orderId: "order-1",
      steps: [{ stepType: "GARMENT_RECEIVE", sortOrder: 1 }],
    });

    const garmentStep = harness.tx.production.create.mock.calls[0]?.[0].data.steps.create[0];
    expect(garmentStep).toMatchObject({ stepType: "GARMENT_RECEIVE", qtyTotal: 5 });
    expect(garmentStep).not.toEqual(
      expect.objectContaining({ status: "COMPLETED", completedAt: expect.any(Date) }),
    );
    expect(harness.tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        newValue: expect.objectContaining({ autoCompletedGarmentReceiveSteps: 0 }),
      }),
    });
  });
});
