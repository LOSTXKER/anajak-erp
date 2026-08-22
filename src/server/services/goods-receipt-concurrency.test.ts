import { describe, expect, it, vi } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import {
  confirmCustomerGarmentEvidence,
  createGoodsReceipt,
  getReceiptContext,
  type CreateReceiptParams,
} from "./goods-receipt";
import { completeManufacturingOperation } from "./manufacturing-commands";

type TopologyStep = {
  id: string;
  productionId: string;
  stepType: string;
  status: string;
  sortOrder: number;
  assignedToId: string | null;
  executionEnabled?: boolean;
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
  defectQty?: number;
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

describe("goods receipt context for V2 customer return", () => {
  const order = {
    id: "order-1",
    orderNumber: "ORD-1",
    items: [{
      products: [{
        id: "product-1",
        itemSource: "CUSTOMER_PROVIDED",
        description: "เสื้อลูกค้า",
        receivedInspected: false,
        variants: [{ size: "M", color: null, quantity: 100 }],
      }],
    }],
  };

  it("คืนได้เฉพาะตัวตำหนิหรือส่วนเกิน และหลังรับทดแทนไม่เกิดยอดคืนค้าง", async () => {
    const prior = [
      {
        orderItemProductId: "product-1",
        size: "M",
        color: null,
        qtyCounted: 100,
        defectQty: 5,
        receipt: { receiptType: "CUSTOMER_GARMENT" },
      },
    ];
    const prisma = {
      order: { findUniqueOrThrow: vi.fn().mockResolvedValue(order) },
      goodsReceiptLine: { findMany: vi.fn().mockImplementation(async () => prior) },
    } as unknown as ExtendedPrismaClient;

    await expect(
      getReceiptContext(prisma, "order-1", "CUSTOMER_RETURN"),
    ).resolves.toMatchObject({
      lines: [{ qtyExpected: 100, qtyReceivedNet: 100, qtyReturnable: 5 }],
    });

    prior.push(
      {
        orderItemProductId: "product-1",
        size: "M",
        color: null,
        qtyCounted: 5,
        defectQty: 0,
        receipt: { receiptType: "CUSTOMER_RETURN" },
      },
      {
        orderItemProductId: "product-1",
        size: "M",
        color: null,
        qtyCounted: 5,
        defectQty: 0,
        receipt: { receiptType: "CUSTOMER_GARMENT" },
      },
    );

    await expect(
      getReceiptContext(prisma, "order-1", "CUSTOMER_RETURN"),
    ).resolves.toMatchObject({
      lines: [{ qtyExpected: 100, qtyReceivedNet: 100, qtyReturnable: 0 }],
    });
  });
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
  productionCompletionOwnerId?: string | null;
  operationPlanned?: number;
  operationGood?: number;
} = {}) {
  let topology = (options.topology ?? baseTopology).map((step) => ({ ...step }));
  let receipts = new Map<string, {
    id: string;
    receiptType: string;
    productionStepId?: string;
    lines: Array<Record<string, unknown>>;
  }>();
  let audits = new Map<string, { newValue: unknown }>();
  let commands = new Map<string, Record<string, unknown>>();
  let activeProductions = options.activeProductions ?? 0;
  const memberProductIds = options.memberProductIds ?? ["product-1"];
  const products = options.products ?? memberProductIds.map((id) => ({
    id,
    itemSource: "CUSTOMER_PROVIDED",
    description: "เสื้อลูกค้า",
    variants: [{ size: "M", color: null, quantity: 1 }],
  }));
  const priorReceiptLines = options.priorReceiptLines ?? [];
  let operation = {
    operationState: "RUNNING",
    qtyPlanned:
      options.operationPlanned ??
      products.reduce(
        (sum, product) =>
          sum + product.variants.reduce((total, variant) => total + variant.quantity, 0),
        0,
      ),
    qtyGood: options.operationGood ?? 0,
    qtyScrap: 0,
    qtyRework: 0,
    revision: 0,
  };
  let operationQuantity = {
    id: "quantity-prep-1",
    productionStepId: "step-receive-1",
    sourceOrderItemProductId: "product-1",
    size: "M",
    color: null as string | null,
    printPosition: null,
    qtyPlanned: operation.qtyPlanned,
    qtyGood: operation.qtyGood,
    qtyScrap: 0,
    qtyRework: 0,
  };
  let receivedInspectedById = new Map(
    products.map((product) => [product.id, options.evidenceComplete ?? true]),
  );

  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    production: {
      findUnique: vi.fn().mockResolvedValue({
        id: "production-1",
        orderId: "order-1",
      }),
      findUniqueOrThrow: vi.fn(async () => ({
        orderId: "order-1",
        workOrderState: "IN_PROGRESS",
        completionOwnerStepId: "step-pack-final",
        steps: [
          {
            id: "step-receive-1",
            operationCode: "PREP",
            operationState: operation.operationState,
          },
          {
            id: "step-pack-final",
            operationCode: "FINAL_PACK",
            operationState: "PLANNED",
          },
        ],
      })),
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
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const step = topology.find((candidate) => candidate.id === where.id);
        if (!step) return null;
        return {
          id: step.id,
          productionId: step.productionId,
          operationCode: "PREP",
          operationName: "เตรียมเสื้อ",
          operationState: operation.operationState,
          executionEnabled: true,
          reworkCaseId: null,
          workCenterId: "wc-prep",
          assignedToId: null,
          qtyPlanned: operation.qtyPlanned,
          qtyGood: operation.qtyGood,
          qtyScrap: operation.qtyScrap,
          qtyRework: operation.qtyRework,
          revision: operation.revision,
          startedAt: new Date("2026-08-22T00:00:00.000Z"),
          completedAt: null,
          sortOrder: 1,
          stepType: "GARMENT_RECEIVE",
          workCenter: { code: "PREP", isActive: true },
          workResourceId: null,
          workResource: null,
          predecessorLinks: [],
          exceptions: [],
          production: {
            orderId: "order-1",
            workOrderState: "IN_PROGRESS",
            revision: 1,
            order: {
              internalStatus: options.orderStatus ?? "PRODUCING",
            },
          },
        };
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const step = topology.find((candidate) => candidate.id === where.id);
        if (!step) throw new Error("step not found");
        return {
          ...step,
          executionEnabled: step.executionEnabled ?? false,
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
        const incrementOf = (value: unknown) =>
          value && typeof value === "object" && "increment" in value
            ? Number((value as { increment: number }).increment)
            : 0;
        operation = {
          ...operation,
          ...(typeof data.operationState === "string"
            ? { operationState: data.operationState }
            : {}),
          qtyGood: operation.qtyGood + incrementOf(data.qtyGood),
          qtyScrap: operation.qtyScrap + incrementOf(data.qtyScrap),
          qtyRework: operation.qtyRework + incrementOf(data.qtyRework),
          revision: operation.revision + incrementOf(data.revision),
        };
        return { id: where.id, ...operation };
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
      findMany: vi.fn(async ({ where }: {
        where: { productionStepId: string; receiptType: string };
      }) => [...receipts.values()]
        .filter((receipt) =>
          receipt.productionStepId === where.productionStepId &&
          receipt.receiptType === where.receiptType,
        )
        .map((receipt) => ({ lines: receipt.lines }))),
      create: vi.fn(async ({ data }: {
        data: Record<string, unknown> & {
          lines: { create: Array<Record<string, unknown>> };
        };
      }) => {
        const created = {
          id: data.id as string,
          receiptType: data.receiptType as string,
          productionStepId: data.productionStepId as string | undefined,
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
          defectQty: line.defectQty ?? 0,
          receipt: { receiptType: line.receiptType },
        })),
        ...[...receipts.values()].flatMap((receipt) => receipt.lines
          .filter((line) => typeof line.orderItemProductId === "string")
          .map((line) => ({
            orderItemProductId: line.orderItemProductId,
            size: line.size ?? null,
            color: line.color ?? null,
            qtyCounted: line.qtyCounted,
            defectQty: line.defectQty ?? 0,
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
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "order-1",
        orderNumber: "ORD-001",
        title: "งานทดสอบ",
        items: [],
        internalStatus: options.orderStatus ?? "PRODUCING",
        orderType: "CUSTOM",
        productionCompletionOwnerId: options.productionCompletionOwnerId ?? null,
      }),
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
        if (args.select.variants && !args.select.id) {
          return products.map((product) => ({ variants: product.variants }));
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
    workCenterMember: {
      findUnique: vi.fn().mockResolvedValue({ isActive: true }),
    },
    operationEvent: { create: vi.fn().mockResolvedValue({ id: "event-1" }) },
    operationJobDependency: { findMany: vi.fn().mockResolvedValue([]) },
    reworkCase: { findUnique: vi.fn().mockResolvedValue(null) },
    product: { findMany: vi.fn().mockResolvedValue([]) },
    materialUsage: { findMany: vi.fn().mockResolvedValue([]) },
    operationQuantity: {
      findMany: vi.fn(async () => [{ ...operationQuantity }]),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const incrementOf = (value: unknown) =>
          value && typeof value === "object" && "increment" in value
            ? Number((value as { increment: number }).increment)
            : 0;
        operationQuantity = {
          ...operationQuantity,
          qtyGood: operationQuantity.qtyGood + incrementOf(data.qtyGood),
          qtyScrap: operationQuantity.qtyScrap + incrementOf(data.qtyScrap),
          qtyRework: operationQuantity.qtyRework + incrementOf(data.qtyRework),
        };
        return { ...operationQuantity };
      }),
    },
    manufacturingCommand: {
      findUnique: vi.fn(async ({ where }: { where: { commandId: string } }) =>
        commands.get(where.commandId) ?? null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        commands.set(data.commandId as string, { ...data, result: null });
        return data;
      }),
      update: vi.fn(async ({ where, data }: {
        where: { commandId: string };
        data: Record<string, unknown>;
      }) => {
        const next = { ...commands.get(where.commandId), ...data };
        commands.set(where.commandId, next);
        return next;
      }),
    },
    orderRevision: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({ id: "revision-1" }) },
  };

  let queue = Promise.resolve();
  const transaction = vi.fn(<T>(callback: (transaction: typeof tx) => Promise<T>) => {
    const run = queue.then(async () => {
      const receiptSnapshot = new Map(receipts);
      const auditSnapshot = new Map(audits);
      const commandSnapshot = new Map(commands);
      const topologySnapshot = topology.map((step) => ({ ...step }));
      const receivedSnapshot = new Map(receivedInspectedById);
      const operationSnapshot = { ...operation };
      const quantitySnapshot = { ...operationQuantity };
      try {
        return await callback(tx);
      } catch (error) {
        receipts = receiptSnapshot;
        audits = auditSnapshot;
        commands = commandSnapshot;
        topology = topologySnapshot;
        receivedInspectedById = receivedSnapshot;
        operation = operationSnapshot;
        operationQuantity = quantitySnapshot;
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
        production: { id: "production-1", orderId: "order-1" },
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
    getOperation: () => ({ ...operation }),
    getOperationQuantity: () => ({ ...operationQuantity }),
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
  it("V2 CUSTOMER_RETURN ต้องบันทึกจำนวนคืนจริง ห้ามสร้างใบนับศูนย์", async () => {
    const transaction = vi.fn();
    await expect(
      createGoodsReceipt(
        { $transaction: transaction } as unknown as ExtendedPrismaClient,
        stationInput({
          receiptType: "CUSTOMER_RETURN",
          productionStepId: undefined,
          operationJobId: "step-receive-1",
          expectedRevision: 0,
          lines: [{
            orderItemProductId: "product-1",
            description: "เสื้อลูกค้า",
            size: "M",
            qtyExpected: 0,
            qtyCounted: 0,
            defectQty: 0,
          }],
        }),
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("flag off ปฏิเสธ Goods Receipt/Evidence V2 ก่อนเริ่ม transaction", async () => {
    const harness = makeHarness();
    vi.stubEnv("PRODUCTION_V2_ENABLED", "0");
    try {
      await expect(
        createGoodsReceipt(
          harness.prisma,
          stationInput({
            productionStepId: undefined,
            operationJobId: "step-receive-1",
            expectedRevision: 0,
          }),
        ),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      await expect(
        confirmCustomerGarmentEvidence(harness.prisma, {
          operationJobId: "step-receive-1",
          commandId: "confirm-flag-off-command-1",
          expectedRevision: 0,
          userId: "user-1",
        }),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      expect(harness.tx.goodsReceipt.create).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("V2 ผูกใบรับกับ PREP Operation Job และเพิ่ม qty/event ใน transaction เดียวกัน", async () => {
    const harness = makeHarness({ productionCompletionOwnerId: "production-1" });
    await createGoodsReceipt(
      harness.prisma,
      stationInput({
        productionStepId: undefined,
        operationJobId: "step-receive-1",
        expectedRevision: 0,
      }),
    );

    expect(harness.tx.goodsReceipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ productionStepId: "step-receive-1" }),
      }),
    );
    expect(harness.tx.productionStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "step-receive-1" },
        data: expect.objectContaining({
          qtyGood: { increment: 1 },
          revision: { increment: 1 },
        }),
      }),
    );
    expect(harness.tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productionStepId: "step-receive-1",
        eventType: "RECEIPT_RECORDED",
        qtyGoodDelta: 1,
      }),
    });
  });

  it("V2 รับจริง 103 แต่ให้ PREP แค่ 100 แล้วคืนส่วนเกิน 3 ก่อนปิดงาน", async () => {
    const harness = makeHarness({
      productionCompletionOwnerId: "production-1",
      operationPlanned: 100,
      products: [{
        id: "product-1",
        itemSource: "CUSTOMER_PROVIDED",
        description: "เสื้อลูกค้า",
        variants: [{ size: "M", color: null, quantity: 100 }],
      }],
    });
    const received = await createGoodsReceipt(
      harness.prisma,
      stationInput({
        idempotencyKey: "v2-over-receive-103",
        productionStepId: undefined,
        operationJobId: "step-receive-1",
        expectedRevision: 0,
        lines: [{
          orderItemProductId: "product-1",
          description: "เสื้อลูกค้า",
          size: "M",
          qtyExpected: 100,
          qtyCounted: 103,
          defectQty: 0,
        }],
      }),
    );
    expect(received.lines).toContainEqual(
      expect.objectContaining({ qtyExpected: 100, qtyCounted: 103 }),
    );
    expect(harness.getOperation()).toMatchObject({ qtyGood: 100, revision: 1 });
    expect(harness.getOperationQuantity()).toMatchObject({ qtyGood: 100 });

    await expect(
      completeManufacturingOperation(
        harness.prisma,
        {
          commandId: "complete-before-customer-return",
          operationJobId: "step-receive-1",
          expectedRevision: 1,
          actorId: "user-1",
        },
        { canSupervise: true },
      ),
    ).rejects.toThrow("ยังมีเสื้อส่วนเกินค้างอยู่ 3 ตัว");

    const returned = await createGoodsReceipt(
      harness.prisma,
      stationInput({
        idempotencyKey: "v2-return-surplus-3",
        receiptType: "CUSTOMER_RETURN",
        productionStepId: undefined,
        operationJobId: "step-receive-1",
        expectedRevision: 1,
        lines: [{
          orderItemProductId: "product-1",
          description: "เสื้อลูกค้า",
          size: "M",
          qtyExpected: 0,
          qtyCounted: 3,
          defectQty: 0,
        }],
      }),
    );
    expect(returned.lines).toContainEqual(
      expect.objectContaining({ qtyCounted: 3 }),
    );
    expect(harness.getOperation()).toMatchObject({ qtyGood: 100, revision: 2 });
    expect(harness.tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "MATERIAL_RETURNED",
        qtyGoodDelta: 0,
      }),
    });

    await expect(
      completeManufacturingOperation(
        harness.prisma,
        {
          commandId: "complete-after-customer-return",
          operationJobId: "step-receive-1",
          expectedRevision: 2,
          actorId: "user-1",
        },
        { canSupervise: true },
      ),
    ).resolves.toMatchObject({ operationState: "COMPLETED" });
  });

  it("V2 คืนตัวตำหนิแล้วรับตัวทดแทน จึงให้ PREP ครบและปิดได้", async () => {
    const harness = makeHarness({
      productionCompletionOwnerId: "production-1",
      operationPlanned: 100,
      products: [{
        id: "product-1",
        itemSource: "CUSTOMER_PROVIDED",
        description: "เสื้อลูกค้า",
        variants: [{ size: "M", color: null, quantity: 100 }],
      }],
    });
    await createGoodsReceipt(
      harness.prisma,
      stationInput({
        idempotencyKey: "v2-receive-with-defect",
        productionStepId: undefined,
        operationJobId: "step-receive-1",
        expectedRevision: 0,
        lines: [{
          orderItemProductId: "product-1",
          description: "เสื้อลูกค้า",
          size: "M",
          qtyExpected: 100,
          qtyCounted: 100,
          defectQty: 5,
          defectNote: "รอยเปื้อน",
        }],
      }),
    );
    expect(harness.getOperation()).toMatchObject({ qtyGood: 95, revision: 1 });

    await createGoodsReceipt(
      harness.prisma,
      stationInput({
        idempotencyKey: "v2-return-defect-5",
        receiptType: "CUSTOMER_RETURN",
        productionStepId: undefined,
        operationJobId: "step-receive-1",
        expectedRevision: 1,
        lines: [{
          orderItemProductId: "product-1",
          description: "เสื้อลูกค้า",
          size: "M",
          qtyExpected: 0,
          qtyCounted: 5,
          defectQty: 0,
        }],
      }),
    );
    expect(harness.getOperation()).toMatchObject({ qtyGood: 95, revision: 2 });

    await createGoodsReceipt(
      harness.prisma,
      stationInput({
        idempotencyKey: "v2-receive-replacement-5",
        productionStepId: undefined,
        operationJobId: "step-receive-1",
        expectedRevision: 2,
        lines: [{
          orderItemProductId: "product-1",
          description: "เสื้อลูกค้า",
          size: "M",
          qtyExpected: 5,
          qtyCounted: 5,
          defectQty: 0,
        }],
      }),
    );
    expect(harness.getOperation()).toMatchObject({ qtyGood: 100, revision: 3 });

    await expect(
      completeManufacturingOperation(
        harness.prisma,
        {
          commandId: "complete-after-replacement",
          operationJobId: "step-receive-1",
          expectedRevision: 3,
          actorId: "user-1",
        },
        { canSupervise: true },
      ),
    ).resolves.toMatchObject({ operationState: "COMPLETED" });
  });

  it("ปฏิเสธใบรับที่ไม่ผูกงานสถานีเมื่อออเดอร์มีเจ้าของการผลิต V2", async () => {
    const harness = makeHarness({
      productionCompletionOwnerId: "production-1",
    });

    await expect(
      createGoodsReceipt(
        harness.prisma,
        stationInput({
          idempotencyKey: "unscoped-v2-receipt-1",
          productionStepId: undefined,
        }),
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(harness.tx.$queryRaw).toHaveBeenCalled();
    expect(harness.tx.goodsReceipt.create).not.toHaveBeenCalled();
    expect(harness.tx.orderItemProduct.update).not.toHaveBeenCalled();
    expect(harness.tx.operationEvent.create).not.toHaveBeenCalled();
  });

  it("ปฏิเสธ V2 Operation Job ที่ถูกส่งผ่าน legacy productionStepId หลังถือ lock", async () => {
    const harness = makeHarness({
      topology: [{ ...baseTopology[0]!, executionEnabled: true }],
    });

    await expect(
      createGoodsReceipt(harness.prisma, stationInput()),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(harness.tx.$queryRaw).toHaveBeenCalled();
    expect(harness.tx.goodsReceipt.create).not.toHaveBeenCalled();
    expect(harness.tx.operationEvent.create).not.toHaveBeenCalled();
  });

  it("ปฏิเสธยืนยันหลักฐาน V2 ผ่าน legacy productionStepId หลังถือ lock", async () => {
    const harness = makeHarness({
      topology: [{ ...baseTopology[0]!, executionEnabled: true }],
      evidenceComplete: true,
    });

    await expect(
      confirmCustomerGarmentEvidence(harness.prisma, {
        productionStepId: "step-receive-1",
        userId: "user-1",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(harness.tx.$queryRaw).toHaveBeenCalled();
    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
    expect(harness.tx.operationEvent.create).not.toHaveBeenCalled();
  });

  it("V2 รับหลักฐาน counted=0 เป็น event-only โดยไม่ปลอม quantity", async () => {
    const harness = makeHarness();
    await expect(
      createGoodsReceipt(
        harness.prisma,
        stationInput({
          idempotencyKey: "station-v2-zero-count-1",
          productionStepId: undefined,
          operationJobId: "step-receive-1",
          expectedRevision: 0,
          lines: [{
            orderItemProductId: "product-1",
            description: "เสื้อลูกค้า",
            size: "M",
            qtyExpected: 1,
            qtyCounted: 0,
            defectQty: 0,
          }],
        }),
      ),
    ).resolves.toMatchObject({ alreadyRecorded: false });
    expect(harness.tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "RECEIPT_RECORDED",
        qtyGoodDelta: 0,
        qtyScrapDelta: 0,
        qtyReworkDelta: 0,
      }),
    });
    expect(harness.tx.operationQuantity.update).not.toHaveBeenCalled();
  });

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

  it("ยืนยัน evidence V2 credit ไม่เกิน remaining และ replay command ไม่เพิ่มซ้ำ", async () => {
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
    const input = {
      operationJobId: "step-receive-1",
      commandId: "confirm-evidence-command-1",
      expectedRevision: 0,
      userId: "user-1",
    };

    const first = await confirmCustomerGarmentEvidence(harness.prisma, input);
    const replay = await confirmCustomerGarmentEvidence(harness.prisma, input);

    expect(first).toMatchObject({ creditedQty: 1, evidenceQty: 1 });
    expect(replay).toMatchObject({ creditedQty: 1, evidenceQty: 1 });
    expect(harness.tx.operationEvent.create).toHaveBeenCalledOnce();
    expect(harness.tx.manufacturingCommand.create).toHaveBeenCalledOnce();
    expect(harness.tx.productionStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "step-receive-1" },
        data: expect.objectContaining({
          qtyGood: { increment: 1 },
          revision: { increment: 1 },
        }),
      }),
    );
  });

  it("ยืนยัน evidence V2 ไม่เปลี่ยนเสื้อมีตำหนิให้เป็น qtyGood", async () => {
    const harness = makeHarness({
      evidenceComplete: true,
      priorReceiptLines: [{
        orderItemProductId: "product-1",
        size: "M",
        color: null,
        qtyCounted: 1,
        defectQty: 1,
        receiptType: "CUSTOMER_GARMENT",
      }],
    });
    const result = await confirmCustomerGarmentEvidence(harness.prisma, {
      operationJobId: "step-receive-1",
      commandId: "confirm-defect-evidence-1",
      expectedRevision: 0,
      userId: "user-1",
    });

    expect(result).toMatchObject({ evidenceQty: 0, creditedQty: 0 });
    expect(harness.tx.operationQuantity.update).not.toHaveBeenCalled();
    expect(harness.tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ qtyGoodDelta: 0 }),
    });
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
