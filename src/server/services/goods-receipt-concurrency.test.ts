import { describe, expect, it, vi } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import {
  confirmCustomerGarmentEvidence,
  createGoodsReceipt,
  type CreateReceiptParams,
} from "./goods-receipt";

type TopologyStep = {
  id: string;
  productionId: string;
  stepType: string;
  status: string;
  sortOrder: number;
  assignedToId: string | null;
};

type CanonicalProduct = {
  id: string;
  itemSource: string;
  description: string;
  variants: Array<{ size: string; color: string | null; quantity: number }>;
};

type PriorReceiptLine = {
  orderItemProductId: string;
  size: string;
  color: string | null;
  qtyCounted: number;
  receiptType: string;
};

const baseTopology: TopologyStep[] = [
  { id: "step-receive-1", productionId: "production-1", stepType: "GARMENT_RECEIVE", status: "PENDING", sortOrder: 1, assignedToId: null },
  { id: "step-pack-1", productionId: "production-1", stepType: "PACKAGING", status: "PENDING", sortOrder: 9, assignedToId: null },
  { id: "step-receive-2", productionId: "production-2", stepType: "GARMENT_RECEIVE", status: "PENDING", sortOrder: 1, assignedToId: "other-user" },
];

const outsourceInput = (patch: Partial<CreateReceiptParams> = {}): CreateReceiptParams => ({
  orderId: "order-1",
  idempotencyKey: "receipt-request-0001",
  receiptType: "OUTSOURCE_RETURN",
  photoUrls: [],
  lines: [{ description: "งานร้านนอก", qtyExpected: 10, qtyCounted: 10, defectQty: 0 }],
  userId: "user-1",
  ...patch,
});

const stationInput = (patch: Partial<CreateReceiptParams> = {}): CreateReceiptParams => ({
  orderId: "order-1",
  idempotencyKey: "station-receipt-0001",
  receiptType: "CUSTOMER_GARMENT",
  productionStepId: "step-receive-1",
  photoUrls: [],
  lines: [{ orderItemProductId: "product-1", description: "เสื้อลูกค้า", size: "M", qtyExpected: 1, qtyCounted: 1, defectQty: 0 }],
  userId: "user-1",
  ...patch,
});

function makeHarness(options: {
  topology?: TopologyStep[];
  remaining?: number;
  memberProductIds?: string[];
  orderStatus?: string;
  auditFails?: boolean;
  notificationFails?: boolean;
  evidenceComplete?: boolean;
  products?: CanonicalProduct[];
  priorReceiptLines?: PriorReceiptLine[];
  activeProductions?: number;
} = {}) {
  let topology = (options.topology ?? baseTopology).map((step) => ({ ...step }));
  let receipts = new Map<string, { id: string; receiptType: string; lines: Array<Record<string, unknown>> }>();
  let audits = new Map<string, { newValue: unknown }>();
  let activeProductions = options.activeProductions ?? 0;
  const memberProductIds = options.memberProductIds ?? ["product-1"];
  const products = options.products ?? memberProductIds.map((id) => ({
    id,
    itemSource: "CUSTOMER_PROVIDED",
    description: "เสื้อลูกค้า",
    variants: [{ size: "M", color: null, quantity: 1 }],
  }));
  const priorReceiptLines = options.priorReceiptLines ?? [];
  let receivedInspectedById = new Map(
    products.map((product) => [product.id, options.evidenceComplete ?? true]),
  );

  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    production: {
      findMany: vi.fn(async () => {
        const ids = [...new Set(topology.map((step) => step.productionId))].sort();
        return ids.map((id) => ({ id, steps: topology.filter((step) => step.productionId === id).map((step) => ({ id: step.id })) }));
      }),
      update: vi.fn(async ({ where }: { where: { id: string } }) => ({ orderId: "order-1", id: where.id })),
      count: vi.fn(async (args?: { where?: { status?: { not?: string } } }) => {
        // finalizer ยังเห็นใบผลิตอื่นค้าง จึงไม่ดัน order status ใน harness นี้
        if (args?.where?.status?.not === "COMPLETED") return 1;
        return activeProductions;
      }),
    },
    productionStep: {
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const step = topology.find((candidate) => candidate.id === where.id);
        if (!step) throw new Error("step not found");
        return {
          ...step,
          production: {
            orderId: "order-1",
            steps: topology
              .filter((candidate) => candidate.productionId === step.productionId)
              .map(({ id, stepType, status, sortOrder }) => ({ id, stepType, status, sortOrder })),
          },
        };
      }),
      findMany: vi.fn(async (args: { where?: { id?: string; productionId?: string } }) => {
        if (args.where?.id) {
          return topology
            .filter((step) => step.id === args.where?.id && ["PENDING", "IN_PROGRESS"].includes(step.status))
            .map(({ id, productionId }) => ({ id, productionId }));
        }
        if (args.where?.productionId) {
          return topology
            .filter((step) => step.productionId === args.where?.productionId)
            .map(({ stepType, status }) => ({ stepType, status }));
        }
        return [];
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        topology = topology.map((step) => step.id === where.id ? { ...step, ...data } as TopologyStep : step);
        return topology.find((step) => step.id === where.id);
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { productionId: string }; data: Record<string, unknown> }) => {
        topology = topology.map((step) => step.productionId === where.productionId && step.stepType === "PACKAGING" ? { ...step, ...data } as TopologyStep : step);
        return { count: 1 };
      }),
      count: vi.fn(async (args?: { where?: { status?: { not?: string } } }) =>
        args?.where?.status?.not
          ? topology.filter((step) => step.status !== args.where?.status?.not).length
          : topology.length,
      ),
    },
    goodsReceipt: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => receipts.get(where.id) ?? null),
      create: vi.fn(async ({ data }: {
        data: Record<string, unknown> & {
          lines: { create: Array<Record<string, unknown>> };
        };
      }) => {
        const created = {
          id: data.id as string,
          receiptType: data.receiptType as string,
          lines: data.lines.create.map((line, index) => ({ id: `line-${index}`, ...line })),
        };
        receipts.set(created.id, created);
        return created;
      }),
    },
    goodsReceiptLine: {
      findMany: vi.fn(async () => [
        ...priorReceiptLines.map((line) => ({
          orderItemProductId: line.orderItemProductId,
          size: line.size,
          color: line.color,
          qtyCounted: line.qtyCounted,
          receipt: { receiptType: line.receiptType },
        })),
        ...[...receipts.values()].flatMap((receipt) => receipt.lines
          .filter((line) => typeof line.orderItemProductId === "string")
          .map((line) => ({
            orderItemProductId: line.orderItemProductId,
            size: line.size ?? null,
            color: line.color ?? null,
            qtyCounted: line.qtyCounted,
            receipt: { receiptType: receipt.receiptType },
          }))),
      ]),
    },
    auditLog: {
      findFirst: vi.fn(async ({ where }: { where: { entityId: string } }) => audits.get(where.entityId) ?? null),
      create: vi.fn(async ({ data }: { data: { entityId: string; newValue: unknown } }) => {
        if (options.auditFails) throw new Error("audit unavailable");
        const value = { newValue: data.newValue };
        audits.set(data.entityId, value);
        return value;
      }),
    },
    order: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "order-1", orderNumber: "ORD-001", title: "งานทดสอบ", internalStatus: options.orderStatus ?? "PRODUCING", orderType: "CUSTOM" }),
      update: vi.fn().mockResolvedValue({ id: "order-1" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    orderItemProduct: {
      findMany: vi.fn(async (args: { select: Record<string, boolean> }) => {
        if (args.select.receivedInspected) {
          return products.map((product) => ({
            id: product.id,
            receivedInspected: receivedInspectedById.get(product.id) ?? false,
          }));
        }
        return products.map((product) => ({
          ...product,
          totalQuantity: product.variants.reduce((sum, variant) => sum + variant.quantity, 0),
        }));
      }),
      update: vi.fn(async ({ where, data }: {
        where: { id: string };
        data: { receivedInspected?: boolean };
      }) => {
        if (typeof data.receivedInspected === "boolean") {
          receivedInspectedById.set(where.id, data.receivedInspected);
        }
        return { id: where.id };
      }),
      count: vi.fn().mockResolvedValue(options.remaining ?? 1),
    },
    outsourceOrder: { findUnique: vi.fn().mockResolvedValue(null) },
    orderRevision: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({ id: "revision-1" }) },
  };

  let queue = Promise.resolve();
  const transaction = vi.fn(<T>(callback: (transaction: typeof tx) => Promise<T>) => {
    const run = queue.then(async () => {
      const receiptSnapshot = new Map(receipts);
      const auditSnapshot = new Map(audits);
      const topologySnapshot = topology.map((step) => ({ ...step }));
      const receivedSnapshot = new Map(receivedInspectedById);
      try {
        return await callback(tx);
      } catch (error) {
        receipts = receiptSnapshot;
        audits = auditSnapshot;
        topology = topologySnapshot;
        receivedInspectedById = receivedSnapshot;
        throw error;
      }
    });
    queue = run.then(() => undefined, () => undefined);
    return run;
  });
  const notificationCreate = vi.fn(async () => {
    if (options.notificationFails) throw new Error("notification unavailable");
    return { id: "notification-1" };
  });
  const prisma = {
    $transaction: transaction,
    productionStep: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        production: { orderId: "order-1" },
      }),
    },
    order: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "order-1", orderNumber: "ORD-001", title: "งานทดสอบ" }) },
    user: { findMany: vi.fn().mockResolvedValue([{ id: "manager-1" }]) },
    notification: { create: notificationCreate },
  } as unknown as ExtendedPrismaClient;

  return {
    prisma,
    tx,
    notificationCreate,
    getReceiptCount: () => receipts.size,
    getAuditCount: () => audits.size,
    getTopology: () => topology,
    setStepStatus: (stepId: string, status: string) => {
      topology = topology.map((step) => step.id === stepId ? { ...step, status } : step);
    },
    setActiveProductions: (count: number) => {
      activeProductions = count;
    },
  };
}

describe("goods receipt idempotency + atomic evidence", () => {
  it("concurrent retry key เดิมคืนใบเดิมและไม่สร้าง receipt/audit ซ้ำ", async () => {
    const harness = makeHarness();
    const input = outsourceInput();
    const [first, replay] = await Promise.all([
      createGoodsReceipt(harness.prisma, input),
      createGoodsReceipt(harness.prisma, input),
    ]);

    expect(first.id).toBe(replay.id);
    expect(first.alreadyRecorded).toBe(false);
    expect(replay.alreadyRecorded).toBe(true);
    expect(harness.tx.goodsReceipt.create).toHaveBeenCalledOnce();
    expect(harness.tx.auditLog.create).toHaveBeenCalledOnce();
    expect(harness.getReceiptCount()).toBe(1);
  });

  it("key เดิมแต่ payload ต่างกันถูกปฏิเสธ", async () => {
    const harness = makeHarness();
    await createGoodsReceipt(harness.prisma, outsourceInput());
    await expect(createGoodsReceipt(harness.prisma, outsourceInput({
      lines: [{ description: "งานร้านนอก", qtyExpected: 10, qtyCounted: 9, defectQty: 0 }],
    }))).rejects.toMatchObject({ code: "CONFLICT" });
    expect(harness.getReceiptCount()).toBe(1);
  });

  it("audit fail rollback ใบพร้อมผลพวงทั้งหมด", async () => {
    const harness = makeHarness({ auditFails: true });
    await expect(createGoodsReceipt(harness.prisma, outsourceInput())).rejects.toThrow("audit unavailable");
    expect(harness.getReceiptCount()).toBe(0);
    expect(harness.getAuditCount()).toBe(0);
  });

  it("notification fail ไม่เปลี่ยนผลสำเร็จเป็น error และ retry ไม่ส่งซ้ำ", async () => {
    const harness = makeHarness({ notificationFails: true });
    const input = outsourceInput({
      lines: [{ description: "งานร้านนอก", qtyExpected: 10, qtyCounted: 8, defectQty: 0 }],
    });
    await expect(createGoodsReceipt(harness.prisma, input)).resolves.toMatchObject({ alreadyRecorded: false });
    await expect(createGoodsReceipt(harness.prisma, input)).resolves.toMatchObject({ alreadyRecorded: true });
    expect(harness.notificationCreate).toHaveBeenCalledOnce();
    expect(harness.getReceiptCount()).toBe(1);
  });
});

describe("goods receipt Station scope + topology locks", () => {
  it("lock advisory → steps sorted (รวม PACKAGING) → productions sorted → order ก่อน write", async () => {
    const harness = makeHarness();
    await createGoodsReceipt(harness.prisma, outsourceInput());
    expect(harness.tx.$queryRaw.mock.calls.map((call) => call[1])).toEqual([
      "order-1",
      "step-pack-1",
      "step-receive-1",
      "step-receive-2",
      "production-1",
      "production-2",
      "order-1",
    ]);
    expect(harness.tx.$queryRaw.mock.invocationCallOrder.at(-1)).toBeLessThan(harness.tx.goodsReceipt.create.mock.invocationCallOrder[0]);
    expect(harness.tx.production.findMany).toHaveBeenCalledTimes(2);
  });

  it("Station ปิดเฉพาะ GARMENT_RECEIVE ของ productionStepId ที่ส่งมา ไม่แตะอีกใบผลิต", async () => {
    const harness = makeHarness({ remaining: 0 });
    await createGoodsReceipt(harness.prisma, stationInput());
    expect(harness.tx.productionStep.findMany).toHaveBeenCalledWith({
      where: { id: "step-receive-1", stepType: "GARMENT_RECEIVE", status: { in: ["PENDING", "IN_PROGRESS"] } },
      select: { id: true, productionId: true },
    });
    expect(harness.tx.productionStep.update).toHaveBeenCalledWith({
      where: { id: "step-receive-1" },
      data: {
        status: "COMPLETED",
        completedAt: expect.any(Date),
        assignedToId: "user-1",
      },
    });
    expect(harness.getTopology().find((step) => step.id === "step-receive-2")?.status).toBe("PENDING");
    expect(harness.tx.productionStep.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ productionId: "production-1" }),
    }));
  });

  it("ใบรับทั่วไปที่ไม่ผูก productionStepId บันทึก evidence แต่ปิดขั้นผลิตไม่ได้", async () => {
    const harness = makeHarness({ remaining: 0 });
    await createGoodsReceipt(harness.prisma, stationInput({
      idempotencyKey: "general-receipt-0001",
      productionStepId: undefined,
    }));

    expect(harness.tx.goodsReceipt.create).toHaveBeenCalledOnce();
    expect(harness.tx.orderItemProduct.update).toHaveBeenCalled();
    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
    expect(harness.tx.productionStep.updateMany).not.toHaveBeenCalled();
  });

  it("กันขั้นอนาคตและขั้นของ owner คนอื่น", async () => {
    const futureHarness = makeHarness({ topology: [
      { id: "step-pick-1", productionId: "production-1", stepType: "GARMENT_PICK", status: "PENDING", sortOrder: 1, assignedToId: null },
      { ...baseTopology[0]!, sortOrder: 2 },
    ] });
    await expect(createGoodsReceipt(futureHarness.prisma, stationInput())).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(futureHarness.tx.goodsReceipt.create).not.toHaveBeenCalled();

    const ownerHarness = makeHarness({ topology: [{ ...baseTopology[0]!, assignedToId: "other-user" }] });
    await expect(createGoodsReceipt(ownerHarness.prisma, stationInput())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(ownerHarness.tx.goodsReceipt.create).not.toHaveBeenCalled();
  });

  it("CUSTOMER_GARMENT บังคับ productId ที่เป็นสมาชิกออเดอร์จริง", async () => {
    const missingIdHarness = makeHarness();
    await expect(createGoodsReceipt(missingIdHarness.prisma, stationInput({
      lines: [{ description: "เสื้อไม่ผูกสินค้า", qtyExpected: 1, qtyCounted: 1, defectQty: 0 }],
    }))).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const crossOrderHarness = makeHarness({ memberProductIds: [] });
    await expect(createGoodsReceipt(crossOrderHarness.prisma, stationInput())).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(crossOrderHarness.tx.orderItemProduct.update).not.toHaveBeenCalled();
  });

  it("ยอด M เกินไม่กลบ L ที่ขาดตอน refresh evidence", async () => {
    const harness = makeHarness({
      products: [{
        id: "product-1",
        itemSource: "CUSTOMER_PROVIDED",
        description: "เสื้อลูกค้า",
        variants: [
          { size: "M", color: null, quantity: 10 },
          { size: "L", color: null, quantity: 10 },
        ],
      }],
    });
    await createGoodsReceipt(harness.prisma, stationInput({
      idempotencyKey: "general-variant-evidence-0001",
      productionStepId: undefined,
      lines: [{
        orderItemProductId: "product-1",
        description: "ชื่อที่ client ส่งมาไม่ถูกนำไปเขียน",
        size: "M",
        qtyExpected: 10,
        qtyCounted: 20,
        defectQty: 0,
      }],
    }));

    expect(harness.tx.orderItemProduct.update).toHaveBeenCalledWith({
      where: { id: "product-1" },
      data: {
        receivedInspected: false,
        receiveNote: "รับสุทธิ 20/20",
      },
    });
    expect(harness.tx.goodsReceipt.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        lines: {
          create: [expect.objectContaining({ description: "เสื้อลูกค้า", size: "M" })],
        },
      }),
    }));
  });

  it("Station เก็บแถว counted=0 และบันทึกขาดเป็นหลักฐาน", async () => {
    const harness = makeHarness();
    const result = await createGoodsReceipt(harness.prisma, stationInput({
      idempotencyKey: "station-zero-count-0001",
      lines: [{
        orderItemProductId: "product-1",
        description: "เสื้อลูกค้า",
        size: "M",
        qtyExpected: 1,
        qtyCounted: 0,
        defectQty: 0,
      }],
    }));

    expect(result.lines).toEqual([
      expect.objectContaining({ size: "M", qtyExpected: 1, qtyCounted: 0 }),
    ]);
    expect(harness.tx.orderItemProduct.update).toHaveBeenCalledWith({
      where: { id: "product-1" },
      data: { receivedInspected: false, receiveNote: "รับสุทธิ 0/1" },
    });
    expect(harness.tx.productionStep.update).toHaveBeenCalledWith({
      where: { id: "step-receive-1" },
      data: {
        status: "IN_PROGRESS",
        startedAt: expect.any(Date),
        assignedToId: "user-1",
      },
    });
    expect(harness.getTopology().find((step) => step.id === "step-receive-1")).toMatchObject({
      status: "IN_PROGRESS",
      assignedToId: "user-1",
    });
  });

  it("Station reject เมื่อ canonical variant หาย หรือ qtyExpected เป็น snapshot เก่า", async () => {
    const products: CanonicalProduct[] = [{
      id: "product-1",
      itemSource: "CUSTOMER_PROVIDED",
      description: "เสื้อลูกค้า",
      variants: [
        { size: "M", color: null, quantity: 1 },
        { size: "L", color: null, quantity: 2 },
      ],
    }];
    const missingVariant = makeHarness({ products });
    await expect(createGoodsReceipt(missingVariant.prisma, stationInput())).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(missingVariant.tx.goodsReceipt.create).not.toHaveBeenCalled();

    const staleExpected = makeHarness({ products: [{
      ...products[0]!,
      variants: [{ size: "M", color: null, quantity: 1 }],
    }] });
    await expect(createGoodsReceipt(staleExpected.prisma, stationInput({
      lines: [{
        orderItemProductId: "product-1",
        description: "เสื้อลูกค้า",
        size: "M",
        qtyExpected: 2,
        qtyCounted: 1,
        defectQty: 0,
      }],
    }))).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(staleExpected.tx.goodsReceipt.create).not.toHaveBeenCalled();
  });

  it("CUSTOMER_RETURN ที่ทำ evidence ไม่ครบถูก reject แบบ atomic เมื่อ workflow เดินแล้ว", async () => {
    const harness = makeHarness({
      topology: [{ ...baseTopology[0]!, status: "COMPLETED" }],
      activeProductions: 1,
      priorReceiptLines: [{
        orderItemProductId: "product-1",
        size: "M",
        color: null,
        qtyCounted: 1,
        receiptType: "CUSTOMER_GARMENT",
      }],
    });
    await expect(createGoodsReceipt(harness.prisma, stationInput({
      idempotencyKey: "customer-return-active-0001",
      receiptType: "CUSTOMER_RETURN",
      productionStepId: undefined,
      lines: [{
        orderItemProductId: "product-1",
        description: "เสื้อลูกค้า",
        size: "M",
        qtyExpected: 0,
        qtyCounted: 1,
        defectQty: 0,
      }],
    }))).rejects.toMatchObject({ code: "CONFLICT" });
    expect(harness.tx.goodsReceipt.create).not.toHaveBeenCalled();
    expect(harness.tx.orderItemProduct.update).not.toHaveBeenCalled();
  });

  it("CUSTOMER_RETURN retry คืนใบเดิมก่อนเช็ก workflow state สด", async () => {
    const harness = makeHarness({
      topology: [{ ...baseTopology[0]!, status: "PENDING" }],
      priorReceiptLines: [{
        orderItemProductId: "product-1",
        size: "M",
        color: null,
        qtyCounted: 1,
        receiptType: "CUSTOMER_GARMENT",
      }],
    });
    const input = stationInput({
      idempotencyKey: "customer-return-replay-0001",
      receiptType: "CUSTOMER_RETURN",
      productionStepId: undefined,
      lines: [{
        orderItemProductId: "product-1",
        description: "เสื้อลูกค้า",
        size: "M",
        qtyExpected: 0,
        qtyCounted: 1,
        defectQty: 0,
      }],
    });
    await expect(createGoodsReceipt(harness.prisma, input)).resolves.toMatchObject({
      alreadyRecorded: false,
    });
    const guardCalls = harness.tx.productionStep.count.mock.calls.length;
    harness.setStepStatus("step-receive-1", "COMPLETED");
    harness.setActiveProductions(1);
    await expect(createGoodsReceipt(harness.prisma, input)).resolves.toMatchObject({
      alreadyRecorded: true,
    });
    expect(harness.tx.productionStep.count).toHaveBeenCalledTimes(guardCalls);
    expect(harness.tx.goodsReceipt.create).toHaveBeenCalledOnce();
  });

  it("ยืนยัน evidence เดิมปิด target เดียวและ retry เป็น no-op ไม่เขียน audit ซ้ำ", async () => {
    const harness = makeHarness({
      evidenceComplete: true,
      priorReceiptLines: [{
        orderItemProductId: "product-1",
        size: "M",
        color: null,
        qtyCounted: 1,
        receiptType: "CUSTOMER_GARMENT",
      }],
    });
    const first = await confirmCustomerGarmentEvidence(harness.prisma, {
      productionStepId: "step-receive-1",
      userId: "user-1",
    });
    const replay = await confirmCustomerGarmentEvidence(harness.prisma, {
      productionStepId: "step-receive-1",
      userId: "user-1",
    });

    expect(first.alreadyCompleted).toBe(false);
    expect(replay.alreadyCompleted).toBe(true);
    expect(harness.tx.auditLog.create).toHaveBeenCalledOnce();
    expect(harness.getTopology().find((step) => step.id === "step-receive-1")?.status).toBe("COMPLETED");
    expect(harness.getTopology().find((step) => step.id === "step-receive-2")?.status).toBe("PENDING");
  });

  it("ยืนยัน evidence เดิมไม่ผ่านเมื่อ ledger ยังรับไม่ครบ", async () => {
    const harness = makeHarness({ evidenceComplete: false });
    await expect(confirmCustomerGarmentEvidence(harness.prisma, {
      productionStepId: "step-receive-1",
      userId: "user-1",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("ยืนยัน evidence เดิมไม่เชื่อ cached true จากสูตรยอดรวม/manual เก่า", async () => {
    const harness = makeHarness({ evidenceComplete: true });
    await expect(confirmCustomerGarmentEvidence(harness.prisma, {
      productionStepId: "step-receive-1",
      userId: "user-1",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(harness.tx.orderItemProduct.update).toHaveBeenCalledWith({
      where: { id: "product-1" },
      data: { receivedInspected: false, receiveNote: "รับสุทธิ 0/1" },
    });
    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
  });
});
