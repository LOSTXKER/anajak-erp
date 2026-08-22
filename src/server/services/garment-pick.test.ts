import { describe, expect, it, vi } from "vitest";
import type { StockApiClient } from "@/lib/stock-api";
import { issueGarments, returnGarments } from "./garment-pick";

type Usage = {
  id: string;
  productionId: string;
  productionStepId?: string | null;
  productId: string;
  productVariantId: string | null;
  quantity: number;
  movementType: string;
  note?: string | null;
  stockMovementRef: string;
};

type Audit = {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  newValue?: unknown;
};

function garmentHarness(params?: {
  issued?: number;
  returned?: number;
  orderStatus?: string;
  stepStatus?: string;
  auditFails?: boolean;
  orderId?: string;
  executionEnabled?: boolean;
  stockDocuments?: Map<string, string>;
  siblings?: Array<{
    id: string;
    stepType: string;
    status: string;
    sortOrder: number;
  }>;
}) {
  const log: string[] = [];
  const usages: Usage[] = [];
  const audits: Audit[] = [];
  let usageSeq = 0;
  let auditSeq = 0;
  let revisionCount = 0;
  let auditFails = params?.auditFails ?? false;
  const orderId = params?.orderId ?? "order-1";
  const step = {
    id: "step-pick",
    productionId: "production-1",
    stepType: "GARMENT_PICK",
    status: params?.stepStatus ?? "PENDING",
    sortOrder: 1,
    assignedToId: null as string | null,
    qtyDone: 0,
    executionEnabled: params?.executionEnabled ?? false,
  };

  if ((params?.issued ?? 0) > 0) {
    usages.push({
      id: `usage-${++usageSeq}`,
      productionId: "production-1",
      productId: "product-1",
      productVariantId: "variant-m",
      quantity: params!.issued!,
      movementType: "ISSUE",
      stockMovementRef: "ISSUE-INITIAL",
    });
  }
  if ((params?.returned ?? 0) > 0) {
    usages.push({
      id: `usage-${++usageSeq}`,
      productionId: "production-1",
      productId: "product-1",
      productVariantId: "variant-m",
      quantity: params!.returned!,
      movementType: "RETURN",
      stockMovementRef: "RETURN-INITIAL",
    });
  }

  const tx = {
    $queryRaw: vi.fn(async (query: TemplateStringsArray) => {
      void query;
      log.push("lock");
      return [];
    }),
    production: {
      findUniqueOrThrow: vi.fn(async () => {
        log.push("production-read");
        return { id: "production-1", orderId };
      }),
      update: vi.fn().mockResolvedValue({ id: "production-1" }),
    },
    productionStep: {
      findFirst: vi.fn().mockResolvedValue(
        params?.executionEnabled ? { id: "step-pick" } : null,
      ),
      findUnique: vi.fn().mockResolvedValue({
        id: "step-pick",
        productionId: "production-1",
        operationCode: "PREP",
        operationState: "RUNNING",
        executionEnabled: true,
        workCenterId: "wc-prep",
        assignedToId: null,
        qtyPlanned: 10,
        qtyGood: 0,
        qtyScrap: 0,
        qtyRework: 0,
        revision: 0,
        workCenter: { code: "PREP", isActive: true },
        workResourceId: null,
        workResource: null,
        predecessorLinks: [],
        exceptions: [],
        production: {
          orderId,
          workOrderState: "IN_PROGRESS",
          order: { internalStatus: params?.orderStatus ?? "PRODUCING" },
        },
      }),
      findUniqueOrThrow: vi.fn(async () => {
        log.push("step-read");
        return { ...step };
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        log.push("step-write");
        if (typeof data.assignedToId === "string")
          step.assignedToId = data.assignedToId;
        if (typeof data.status === "string") step.status = data.status;
        const qtyDone = data.qtyDone as
          number | { increment?: number } | undefined;
        if (typeof qtyDone === "number") step.qtyDone = qtyDone;
        else if (qtyDone?.increment) step.qtyDone += qtyDone.increment;
        return { ...step };
      }),
      findMany: vi.fn(async () =>
        (params?.siblings ?? [step]).map((sibling) => ({ ...sibling })),
      ),
    },
    order: {
      findUniqueOrThrow: vi.fn(async () => {
        log.push("state-order-read");
        return {
          id: orderId,
          orderNumber: `ORD-${orderId}`,
          internalStatus: params?.orderStatus ?? "PRODUCING",
          items: [
            {
              products: [
                {
                  itemSource: "FROM_STOCK",
                  productId: "product-1",
                  description: "เสื้อยืด",
                  variants: [{ size: "M", color: "ดำ", quantity: 10 }],
                },
              ],
            },
          ],
        };
      }),
    },
    product: {
      findMany: vi.fn(async () => [
        {
          id: "product-1",
          sku: "TSHIRT",
          name: "เสื้อยืด",
          variants: [{ id: "variant-m", sku: "TS-M", size: "M", color: "ดำ" }],
        },
      ]),
    },
    orderItemProduct: {
      findMany: vi.fn().mockResolvedValue([
        { id: "order-product-1", productId: "product-1" },
      ]),
    },
    operationQuantity: {
      findMany: vi.fn().mockResolvedValue([{
        id: "quantity-prep-1",
        productionStepId: "step-pick",
        sourceOrderItemProductId: "order-product-1",
        size: "M",
        color: "ดำ",
        printPosition: null,
        qtyPlanned: 10,
        qtyGood: 0,
        qtyScrap: 0,
        qtyRework: 0,
      }]),
      update: vi.fn().mockResolvedValue({ id: "quantity-prep-1" }),
    },
    workCenterMember: {
      findUnique: vi.fn().mockResolvedValue({ isActive: true }),
    },
    operationEvent: { create: vi.fn().mockResolvedValue({ id: "event-1" }) },
    materialUsage: {
      findMany: vi.fn(
        async (args?: {
        where?: {
          stockMovementRef?: string;
          productionId?: string;
          movementType?: string;
          note?: { startsWith: string };
        };
      }) => {
        log.push("usage-read");
        if (args?.where?.note) {
          return usages
            .filter(
              (usage) =>
                  (!args.where!.movementType ||
                    usage.movementType === args.where!.movementType) &&
                usage.note?.startsWith(args.where!.note!.startsWith),
            )
              .map(({ quantity, stockMovementRef, note }) => ({
                quantity,
                stockMovementRef,
                note,
              }));
        }
        if (args?.where?.stockMovementRef) {
          return usages
            .filter(
              (usage) =>
                usage.stockMovementRef === args.where!.stockMovementRef &&
                  (!args.where!.movementType ||
                    usage.movementType === args.where!.movementType),
            )
            .map(({ quantity, note }) => ({ quantity, note }));
        }
          return usages.map(
            ({ productId, productVariantId, quantity, movementType }) => ({
          productId,
          productVariantId,
          quantity,
          movementType,
      }),
          );
        },
      ),
      findFirst: vi.fn(
        async ({ where }: { where: { stockMovementRef: string } }) =>
          usages.find(
            (usage) => usage.stockMovementRef === where.stockMovementRef,
          ) ?? null,
      ),
      deleteMany: vi.fn(
        async ({ where }: { where: { stockMovementRef: string } }) => {
        for (let index = usages.length - 1; index >= 0; index -= 1) {
            if (usages[index]!.stockMovementRef === where.stockMovementRef)
              usages.splice(index, 1);
        }
        return { count: 1 };
        },
      ),
      create: vi.fn(async ({ data }: { data: Omit<Usage, "id"> }) => {
        log.push("usage-write");
        const usage = { ...data, id: `usage-${++usageSeq}` };
        usages.push(usage);
        return usage;
      }),
    },
    orderRevision: {
      count: vi.fn(async () => revisionCount),
      create: vi.fn(async () => {
        revisionCount += 1;
        return { id: `revision-${revisionCount}` };
      }),
    },
    auditLog: {
      findFirst: vi.fn(
        async ({
        where,
      }: {
        where: { action: string; entityType: string; entityId: string };
      }) =>
        audits.find(
          (audit) =>
            audit.action === where.action &&
            audit.entityType === where.entityType &&
            audit.entityId === where.entityId,
        ) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Omit<Audit, "id"> }) => {
        log.push("audit-write");
        if (auditFails) throw new Error("audit unavailable");
        const audit = { ...data, id: `audit-${++auditSeq}` };
        audits.push(audit);
        return audit;
      }),
    },
  };

  let transactionTail = Promise.resolve();
  const prisma = {
    ...tx,
    $transaction: vi.fn(
      async <T>(callback: (client: typeof tx) => Promise<T>) => {
      const previous = transactionTail;
      let release: () => void = () => {};
      transactionTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      log.push("transaction-start");
      const usageSnapshot = usages.map((usage) => ({ ...usage }));
      const auditSnapshot = audits.map((audit) => ({ ...audit }));
      const stepSnapshot = { ...step };
      const usageSeqSnapshot = usageSeq;
      const auditSeqSnapshot = auditSeq;
      const revisionCountSnapshot = revisionCount;
      try {
        const result = await callback(tx);
        log.push("transaction-commit");
        return result;
      } catch (error) {
        usages.splice(0, usages.length, ...usageSnapshot);
        audits.splice(0, audits.length, ...auditSnapshot);
        Object.assign(step, stepSnapshot);
        usageSeq = usageSeqSnapshot;
        auditSeq = auditSeqSnapshot;
        revisionCount = revisionCountSnapshot;
        log.push("transaction-rollback");
        throw error;
      } finally {
        log.push("transaction-end");
        release();
      }
      },
    ),
  };

  const documents = params?.stockDocuments ?? new Map<string, string>();
  const createMovement = vi.fn(async (input: { idempotencyKey?: string }) => {
    log.push("stock");
    // เปิด timing window ให้ request คู่แข่งเดินถึง side effect ได้แน่นอนในโค้ดเก่า
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const key = input.idempotencyKey ?? "no-key";
    const existing = documents.get(key);
    const docNumber = existing ?? `STOCK-${documents.size + 1}`;
    documents.set(key, docNumber);
    return {
      success: true,
      data: {
        id: docNumber,
        docNumber,
        type: "MOVEMENT",
        status: "COMPLETED",
        linesCount: 1,
        duplicated: !!existing,
        createdAt: new Date(0).toISOString(),
      },
    };
  });
  const client = { createMovement } as unknown as StockApiClient;

  return {
    prisma,
    client,
    createMovement,
    log,
    usages,
    audits,
    step,
    setAuditFails(value: boolean) {
      auditFails = value;
    },
    get revisionCount() {
      return revisionCount;
    },
  };
}

describe("garment pick concurrency", () => {
  it("V2 ISSUE ผูกยอด fulfilled กับ quantity line ตามสินค้า/ไซซ์/สี", async () => {
    const harness = garmentHarness({ orderStatus: "PRODUCING" });

    await issueGarments(
      harness.prisma as never,
      {
        productionId: "production-1",
        operationJobId: "step-pick",
        expectedRevision: 0,
        lines: [{ sku: "TS-M", qty: 4 }],
        idempotencyKey: "issue-v2-quantity-line",
        userId: "user-a",
        canSupervise: false,
      },
      harness.client,
    );

    expect(harness.prisma.operationQuantity.update).toHaveBeenCalledWith({
      where: { id: "quantity-prep-1" },
      data: {
        qtyGood: { increment: 4 },
        qtyScrap: { increment: 0 },
        qtyRework: { increment: 0 },
        revision: { increment: 1 },
      },
    });
    expect(harness.prisma.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ qtyGoodDelta: 4 }),
    });
  });

  it("ปฏิเสธการส่ง V2 Operation Job ผ่าน legacy stepId หลังถือ lock", async () => {
    const harness = garmentHarness({ executionEnabled: true });

    await expect(
      issueGarments(
        harness.prisma as never,
        {
          productionId: "production-1",
          stepId: "step-pick",
          lines: [{ sku: "TS-M", qty: 4 }],
          idempotencyKey: "legacy-v2-operation-issue",
          userId: "user-a",
          canSupervise: true,
        },
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(harness.prisma.$queryRaw).toHaveBeenCalled();
    expect(harness.createMovement).not.toHaveBeenCalled();
    expect(harness.prisma.operationEvent.create).not.toHaveBeenCalled();
  });

  it("ปฏิเสธ V2 RETURN ที่ไม่ผูก operationJobId หลังถือ lock", async () => {
    const harness = garmentHarness({ issued: 13, executionEnabled: true });

    await expect(
      returnGarments(
        harness.prisma as never,
        {
          productionId: "production-1",
          lines: [{ sku: "TS-M", qty: 3 }],
          idempotencyKey: "legacy-v2-operation-return",
          userId: "user-a",
        },
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(harness.prisma.$queryRaw).toHaveBeenCalled();
    expect(harness.createMovement).not.toHaveBeenCalled();
    expect(harness.prisma.operationEvent.create).not.toHaveBeenCalled();
  });

  it("ยอม ISSUE เมื่อ order ยังเป็น PRODUCING และ response ไม่มีเงิน", async () => {
    const harness = garmentHarness({ orderStatus: "PRODUCING" });

    const result = await issueGarments(
      harness.prisma as never,
      {
      productionId: "production-1",
      stepId: "step-pick",
      lines: [{ sku: "TS-M", qty: 4 }],
      idempotencyKey: "issue-producing",
      userId: "user-a",
      canSupervise: false,
      },
      harness.client,
    );

    expect(harness.createMovement).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ issuedQty: 4, alreadyRecorded: false });
    expect(harness.usages).toEqual([
      expect.objectContaining({ productionStepId: "step-pick" }),
    ]);
    expect(JSON.stringify(result)).not.toMatch(/amount|price|cost/i);
    expect(harness.audits).toHaveLength(1);
    expect(harness.audits[0]).toMatchObject({
      action: "CREATE",
      entityType: "STOCK_ISSUE",
      entityId: result.docNumber,
    });
    expect(JSON.stringify(harness.audits[0])).not.toMatch(/amount|price|cost/i);
    expect(harness.log.indexOf("audit-write")).toBeLessThan(
      harness.log.indexOf("transaction-commit"),
    );
    expect(String(harness.prisma.$queryRaw.mock.calls[0]?.[0])).toContain(
      "pg_advisory_xact_lock",
    );
    expect(String(harness.prisma.$queryRaw.mock.calls[1]?.[0])).toContain(
      "production_steps",
    );
    expect(String(harness.prisma.$queryRaw.mock.calls[1]?.[0])).toContain(
      "ORDER BY id",
    );
    expect(String(harness.prisma.$queryRaw.mock.calls[2]?.[0])).toContain(
      "productions",
    );
    expect(String(harness.prisma.$queryRaw.mock.calls[3]?.[0])).toContain(
      "orders",
    );
    expect(
      harness.prisma.order.findUniqueOrThrow.mock.invocationCallOrder[0],
    ).toBeLessThan(harness.createMovement.mock.invocationCallOrder[0]);
  });

  it.each(["ON_HOLD", "CANCELLED"])(
    "ปฏิเสธ ISSUE เมื่อ order สดเป็น %s ก่อนยิง Stock",
    async (orderStatus) => {
      const harness = garmentHarness({ orderStatus });

      await expect(
        issueGarments(
          harness.prisma as never,
          {
          productionId: "production-1",
          stepId: "step-pick",
          lines: [{ sku: "TS-M", qty: 4 }],
          idempotencyKey: `issue-${orderStatus.toLowerCase()}`,
          userId: "user-a",
          canSupervise: false,
          },
          harness.client,
        ),
      ).rejects.toThrow("เบิกเสื้อไม่ได้");

      expect(harness.createMovement).not.toHaveBeenCalled();
      expect(harness.usages).toHaveLength(0);
    },
  );

  it.each(["FAILED", "ON_HOLD"])(
    "ปฏิเสธ ISSUE ใหม่เมื่อ GARMENT_PICK เป็น %s ก่อนยิง Stock",
    async (stepStatus) => {
      const harness = garmentHarness({ stepStatus });

      await expect(
        issueGarments(
          harness.prisma as never,
          {
          productionId: "production-1",
          stepId: "step-pick",
          lines: [{ sku: "TS-M", qty: 4 }],
          idempotencyKey: `issue-step-${stepStatus.toLowerCase()}`,
          userId: "user-a",
          canSupervise: false,
          },
          harness.client,
        ),
      ).rejects.toThrow("เบิกเสื้อไม่ได้");

      expect(harness.createMovement).not.toHaveBeenCalled();
      expect(harness.usages).toHaveLength(0);
    },
  );

  it("ปฏิเสธ GARMENT_PICK ขั้นอนาคตใน lane เดียวกันก่อนยิง Stock", async () => {
    const harness = garmentHarness({
      siblings: [
        {
          id: "step-pick-before",
          stepType: "GARMENT_PICK",
          status: "PENDING",
          sortOrder: 0,
        },
        {
          id: "step-pick",
          stepType: "GARMENT_PICK",
          status: "PENDING",
          sortOrder: 1,
        },
      ],
    });

    await expect(
      issueGarments(
        harness.prisma as never,
        {
        productionId: "production-1",
        stepId: "step-pick",
        lines: [{ sku: "TS-M", qty: 4 }],
        idempotencyKey: "issue-future-pick",
        userId: "user-a",
        canSupervise: false,
        },
        harness.client,
      ),
    ).rejects.toThrow("ขั้นก่อนหน้า");

    expect(harness.createMovement).not.toHaveBeenCalled();
  });

  it.each(["ON_HOLD", "CANCELLED"])(
    "ยังคืนเสื้อ cleanup ได้เมื่อ order เป็น %s",
    async (orderStatus) => {
      const harness = garmentHarness({ issued: 13, orderStatus });

      await expect(
        returnGarments(
          harness.prisma as never,
          {
          productionId: "production-1",
          lines: [{ sku: "TS-M", qty: 3 }],
          idempotencyKey: `return-${orderStatus.toLowerCase()}`,
          userId: "user-a",
          },
          harness.client,
        ),
      ).resolves.toMatchObject({ returnedQty: 3, alreadyRecorded: false });

      expect(harness.createMovement).toHaveBeenCalledOnce();
      expect(String(harness.prisma.$queryRaw.mock.calls[0]?.[0])).toContain(
        "pg_advisory_xact_lock",
      );
      expect(String(harness.prisma.$queryRaw.mock.calls[1]?.[0])).toContain(
        "productions",
      );
      expect(String(harness.prisma.$queryRaw.mock.calls[2]?.[0])).toContain(
        "orders",
      );
      expect(harness.audits[0]?.entityType).toBe("STOCK_RETURN");
      expect(harness.log.indexOf("audit-write")).toBeLessThan(
        harness.log.indexOf("transaction-commit"),
      );
    },
  );

  it("V2 RETURN บันทึก material/event-only โดยไม่ลด quantity ผลผลิต", async () => {
    const harness = garmentHarness({ issued: 13, orderStatus: "PRODUCING" });
    await returnGarments(
      harness.prisma as never,
      {
        productionId: "production-1",
        operationJobId: "step-pick",
        expectedRevision: 0,
        lines: [{ sku: "TS-M", qty: 3 }],
        idempotencyKey: "return-v2-event-only",
        userId: "user-a",
        canSupervise: false,
      },
      harness.client,
    );

    expect(harness.prisma.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "MATERIAL_RETURNED",
        qtyGoodDelta: 0,
        qtyScrapDelta: 0,
        qtyReworkDelta: 0,
      }),
    });
    expect(harness.prisma.operationQuantity.update).not.toHaveBeenCalled();
  });

  it("V2 RETURN ยังคืนเสื้อได้หลังออเดอร์ถูกยกเลิก", async () => {
    const harness = garmentHarness({ issued: 13, orderStatus: "CANCELLED" });

    await expect(
      returnGarments(
        harness.prisma as never,
        {
          productionId: "production-1",
          operationJobId: "step-pick",
          expectedRevision: 0,
          lines: [{ sku: "TS-M", qty: 3 }],
          idempotencyKey: "return-v2-after-cancel",
          userId: "user-a",
          canSupervise: false,
        },
        harness.client,
      ),
    ).resolves.toMatchObject({ returnedQty: 3 });

    expect(harness.createMovement).toHaveBeenCalledOnce();
    expect(harness.prisma.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: "MATERIAL_RETURNED" }),
    });
  });

  it("serialize และอ่าน assignee สดก่อน ISSUE — สอง staff/key ตัด Stock ได้ครั้งเดียว", async () => {
    const harness = garmentHarness();

    const results = await Promise.allSettled([
      issueGarments(
        harness.prisma as never,
        {
        productionId: "production-1",
        stepId: "step-pick",
        lines: [{ sku: "TS-M", qty: 5 }],
        idempotencyKey: "issue-user-a",
        userId: "user-a",
        canSupervise: false,
        },
        harness.client,
      ),
      issueGarments(
        harness.prisma as never,
        {
        productionId: "production-1",
        stepId: "step-pick",
        lines: [{ sku: "TS-M", qty: 5 }],
        idempotencyKey: "issue-user-b",
        userId: "user-b",
        canSupervise: false,
        },
        harness.client,
      ),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(harness.createMovement).toHaveBeenCalledOnce();
    expect(
      harness.usages.filter((usage) => usage.movementType === "ISSUE"),
    ).toHaveLength(1);
    expect(["user-a", "user-b"]).toContain(harness.step.assignedToId);
    expect(harness.log.indexOf("lock")).toBeLessThan(
      harness.log.indexOf("stock"),
    );
    expect(harness.log.indexOf("step-read")).toBeLessThan(
      harness.log.indexOf("stock"),
    );
    expect(harness.log.indexOf("usage-read")).toBeLessThan(
      harness.log.indexOf("stock"),
    );
  });

  it("serialize และอ่านยอดคืนสดก่อน RETURN — สอง key คืนเศษก้อนเดียวได้ครั้งเดียว", async () => {
    const harness = garmentHarness({ issued: 13 });

    const results = await Promise.allSettled([
      returnGarments(
        harness.prisma as never,
        {
        productionId: "production-1",
        lines: [{ sku: "TS-M", qty: 3 }],
        idempotencyKey: "return-user-a",
        userId: "user-a",
        },
        harness.client,
      ),
      returnGarments(
        harness.prisma as never,
        {
        productionId: "production-1",
        lines: [{ sku: "TS-M", qty: 3 }],
        idempotencyKey: "return-user-b",
        userId: "user-b",
        },
        harness.client,
      ),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(harness.createMovement).toHaveBeenCalledOnce();
    expect(
      harness.usages
        .filter((usage) => usage.movementType === "RETURN")
        .reduce((sum, usage) => sum + usage.quantity, 0),
    ).toBe(3);
    expect(harness.log.indexOf("lock")).toBeLessThan(
      harness.log.indexOf("stock"),
    );
    expect(harness.log.indexOf("usage-read")).toBeLessThan(
      harness.log.indexOf("stock"),
    );
  });

  it("retry ISSUE ด้วย key เดิมไม่เพิ่ม usage, qtyDone หรือ revision ซ้ำ", async () => {
    const harness = garmentHarness();
    const input = {
      productionId: "production-1",
      stepId: "step-pick",
      lines: [{ sku: "TS-M", qty: 4 }],
      idempotencyKey: "same-issue-key",
      userId: "user-a",
      canSupervise: false,
    };

    await issueGarments(harness.prisma as never, input, harness.client);
    await issueGarments(harness.prisma as never, input, harness.client);

    expect(harness.createMovement).toHaveBeenCalledOnce();
    expect(
      harness.usages.filter((usage) => usage.movementType === "ISSUE"),
    ).toHaveLength(1);
    expect(harness.step.qtyDone).toBe(4);
    expect(harness.revisionCount).toBe(1);
    expect(harness.audits).toHaveLength(1);
    expect(harness.prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it("เบิกเผื่อเสียได้ แต่ qtyDone ถูก cap ที่ยอดต้องใช้", async () => {
    const harness = garmentHarness({
      siblings: [
        {
          id: "step-pick",
          stepType: "GARMENT_PICK",
          status: "PENDING",
          sortOrder: 1,
        },
        {
          id: "step-dtf",
          stepType: "DTF_PRINT",
          status: "PENDING",
          sortOrder: 2,
        },
      ],
    });

    await issueGarments(
      harness.prisma as never,
      {
        productionId: "production-1",
        stepId: "step-pick",
        lines: [{ sku: "TS-M", qty: 12 }],
        idempotencyKey: "issue-with-spares",
        userId: "user-a",
        canSupervise: false,
      },
      harness.client,
    );

    expect(harness.step.qtyDone).toBe(10);
    expect(harness.step.status).toBe("COMPLETED");
    expect(
      harness.usages
        .filter((usage) => usage.movementType === "ISSUE")
        .reduce((sum, usage) => sum + usage.quantity, 0),
    ).toBe(12);
  });

  it("retry ISSUE ที่ commit แล้วตอบซ้ำได้แม้ step ถูกแจ้ง FAILED ภายหลัง", async () => {
    const harness = garmentHarness();
    const input = {
      productionId: "production-1",
      stepId: "step-pick",
      lines: [{ sku: "TS-M", qty: 4 }],
      idempotencyKey: "replay-before-state-guard",
      userId: "user-a",
      canSupervise: false,
    };

    await issueGarments(harness.prisma as never, input, harness.client);
    harness.step.status = "FAILED";
    await expect(
      issueGarments(harness.prisma as never, input, harness.client),
    ).resolves.toMatchObject({ alreadyRecorded: true, issuedQty: 4 });

    expect(harness.createMovement).toHaveBeenCalledOnce();
    expect(harness.revisionCount).toBe(1);
    expect(harness.audits).toHaveLength(1);
  });

  it("retry RETURN เต็มเพดานเศษด้วย key เดิมเป็น no-op ก่อน plan ที่อิงยอดใหม่", async () => {
    const harness = garmentHarness({ issued: 13 });
    const input = {
      productionId: "production-1",
      lines: [{ sku: "TS-M", qty: 3 }],
      idempotencyKey: "same-return-key",
      userId: "user-a",
    };

    await returnGarments(harness.prisma as never, input, harness.client);
    await returnGarments(harness.prisma as never, input, harness.client);

    expect(harness.createMovement).toHaveBeenCalledOnce();
    expect(
      harness.usages
        .filter((usage) => usage.movementType === "RETURN")
        .reduce((sum, usage) => sum + usage.quantity, 0),
    ).toBe(3);
    expect(harness.revisionCount).toBe(1);
    expect(harness.audits).toHaveLength(1);
    expect(harness.audits[0]?.entityType).toBe("STOCK_RETURN");
    expect(harness.prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it("replay ISSUE ซ่อม audit เก่าที่หายหนึ่งครั้ง แล้ว retry ต่อไม่สร้างซ้ำ", async () => {
    const harness = garmentHarness();
    const input = {
      productionId: "production-1",
      stepId: "step-pick",
      lines: [{ sku: "TS-M", qty: 4 }],
      idempotencyKey: "issue-audit-backfill",
      userId: "user-a",
      canSupervise: false,
    };

    await issueGarments(harness.prisma as never, input, harness.client);
    harness.audits.splice(0);

    await expect(
      issueGarments(harness.prisma as never, input, harness.client),
    ).resolves.toMatchObject({ alreadyRecorded: true, issuedQty: 4 });
    await issueGarments(harness.prisma as never, input, harness.client);

    expect(harness.createMovement).toHaveBeenCalledOnce();
    expect(harness.audits).toHaveLength(1);
    expect(harness.audits[0]).toMatchObject({
      entityType: "STOCK_ISSUE",
      entityId: "STOCK-1",
    });
    expect(harness.prisma.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it("replay RETURN ซ่อม audit เก่าที่หายหนึ่งครั้ง แล้ว retry ต่อไม่สร้างซ้ำ", async () => {
    const harness = garmentHarness({ issued: 13 });
    const input = {
      productionId: "production-1",
      lines: [{ sku: "TS-M", qty: 3 }],
      idempotencyKey: "return-audit-backfill",
      userId: "user-a",
    };

    await returnGarments(harness.prisma as never, input, harness.client);
    harness.audits.splice(0);

    await expect(
      returnGarments(harness.prisma as never, input, harness.client),
    ).resolves.toMatchObject({ alreadyRecorded: true, returnedQty: 3 });
    await returnGarments(harness.prisma as never, input, harness.client);

    expect(harness.createMovement).toHaveBeenCalledOnce();
    expect(harness.audits).toHaveLength(1);
    expect(harness.audits[0]).toMatchObject({
      entityType: "STOCK_RETURN",
      entityId: "STOCK-1",
    });
    expect(harness.prisma.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it("Stock ISSUE สำเร็จแต่ audit rollback แล้ว retry payload ใหม่ต้อง fail-closed", async () => {
    const harness = garmentHarness({ auditFails: true });
    const input = {
      productionId: "production-1",
      stepId: "step-pick",
      lines: [{ sku: "TS-M", qty: 4 }],
      idempotencyKey: "issue-audit-rollback",
      userId: "user-a",
      canSupervise: false,
    };

    await expect(
      issueGarments(harness.prisma as never, input, harness.client),
    ).rejects.toThrow("audit unavailable");
    expect(harness.usages).toHaveLength(0);
    expect(harness.step).toMatchObject({
      status: "PENDING",
      qtyDone: 0,
      assignedToId: null,
    });
    expect(harness.revisionCount).toBe(0);
    expect(harness.audits).toHaveLength(0);

    harness.setAuditFails(false);
    await expect(
      issueGarments(
        harness.prisma as never,
        { ...input, lines: [{ sku: "TS-M", qty: 5 }] },
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(harness.createMovement).toHaveBeenCalledTimes(2);
    expect(
      harness.usages.filter((usage) => usage.movementType === "ISSUE"),
    ).toHaveLength(0);
    expect(harness.audits).toHaveLength(0);
    expect(harness.revisionCount).toBe(0);
  });

  it("Stock RETURN สำเร็จแต่ audit rollback แล้ว retry payload ใหม่ต้อง fail-closed", async () => {
    const harness = garmentHarness({ issued: 13, auditFails: true });
    const input = {
      productionId: "production-1",
      lines: [{ sku: "TS-M", qty: 3 }],
      idempotencyKey: "return-audit-rollback",
      userId: "user-a",
    };

    await expect(
      returnGarments(harness.prisma as never, input, harness.client),
    ).rejects.toThrow("audit unavailable");
    expect(
      harness.usages.filter((usage) => usage.movementType === "RETURN"),
    ).toHaveLength(0);
    expect(
      harness.usages.filter((usage) => usage.movementType === "ISSUE"),
    ).toHaveLength(1);
    expect(harness.revisionCount).toBe(0);

    harness.setAuditFails(false);
    await expect(
      returnGarments(
        harness.prisma as never,
        { ...input, lines: [{ sku: "TS-M", qty: 2 }] },
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(harness.createMovement).toHaveBeenCalledTimes(2);
    expect(
      harness.usages.filter((usage) => usage.movementType === "RETURN"),
    ).toHaveLength(0);
    expect(
      harness.usages.filter((usage) => usage.movementType === "ISSUE"),
    ).toHaveLength(1);
    expect(harness.audits).toHaveLength(0);
    expect(harness.revisionCount).toBe(0);
  });

  it("ISSUE key เดิมแต่จำนวนต่างกันถูกปฏิเสธก่อนยิง Stock ซ้ำ", async () => {
    const harness = garmentHarness();
    const base = {
      productionId: "production-1",
      stepId: "step-pick",
      idempotencyKey: "issue-fingerprint-qty",
      userId: "user-a",
      canSupervise: false,
    };

    await issueGarments(
      harness.prisma as never,
      { ...base, lines: [{ sku: "TS-M", qty: 4 }] },
      harness.client,
    );
    await expect(
      issueGarments(
        harness.prisma as never,
        { ...base, lines: [{ sku: "TS-M", qty: 5 }] },
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(harness.createMovement).toHaveBeenCalledOnce();
    expect(harness.step.qtyDone).toBe(4);
    expect(harness.audits).toHaveLength(1);
  });

  it("ISSUE key เดิมแต่ location ต่างกันถูกปฏิเสธ", async () => {
    const harness = garmentHarness();
    const base = {
      productionId: "production-1",
      stepId: "step-pick",
      lines: [{ sku: "TS-M", qty: 4 }],
      idempotencyKey: "issue-fingerprint-location",
      userId: "user-a",
      canSupervise: false,
    };

    await issueGarments(harness.prisma as never, base, harness.client);
    await expect(
      issueGarments(
        harness.prisma as never,
        { ...base, fromLocation: "SECONDARY" },
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(harness.createMovement).toHaveBeenCalledOnce();
  });

  it("RETURN key เดิมแต่ note/location ต่างกันถูกปฏิเสธ", async () => {
    const harness = garmentHarness({ issued: 13 });
    const base = {
      productionId: "production-1",
      lines: [{ sku: "TS-M", qty: 3 }],
      idempotencyKey: "return-fingerprint-semantic",
      note: "เศษงานล็อตแรก",
      userId: "user-a",
    };

    await returnGarments(harness.prisma as never, base, harness.client);
    await expect(
      returnGarments(
        harness.prisma as never,
        { ...base, note: "เศษงานคนละล็อต" },
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      returnGarments(
        harness.prisma as never,
        { ...base, toLocation: "SECONDARY" },
        harness.client,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(harness.createMovement).toHaveBeenCalledOnce();
  });

  it("fingerprint รวม SKU ซ้ำและไม่ขึ้นกับลำดับบรรทัด", async () => {
    const harness = garmentHarness();
    const base = {
      productionId: "production-1",
      stepId: "step-pick",
      idempotencyKey: "issue-canonical-lines",
      userId: "user-a",
      canSupervise: false,
    };

    await issueGarments(
      harness.prisma as never,
      {
        ...base,
        lines: [
          { sku: "TS-M", qty: 1 },
          { sku: "TS-M", qty: 3 },
        ],
      },
      harness.client,
    );
    await expect(
      issueGarments(
        harness.prisma as never,
        {
          ...base,
          lines: [
            { sku: "TS-M", qty: 3 },
            { sku: "TS-M", qty: 1 },
          ],
        },
        harness.client,
      ),
    ).resolves.toMatchObject({ alreadyRecorded: true, issuedQty: 4 });

    expect(harness.createMovement).toHaveBeenCalledOnce();
    expect(harness.revisionCount).toBe(1);
    expect(harness.audits).toHaveLength(1);
  });

  it("namespace Stock key แยกออเดอร์แม้ client key เดียวกัน", async () => {
    const stockDocuments = new Map<string, string>();
    const orderA = garmentHarness({ orderId: "order-a", stockDocuments });
    const orderB = garmentHarness({ orderId: "order-b", stockDocuments });
    const input = {
      productionId: "production-1",
      stepId: "step-pick",
      lines: [{ sku: "TS-M", qty: 4 }],
      idempotencyKey: "shared-client-key",
      userId: "user-a",
      canSupervise: false,
    };

    const first = await issueGarments(
      orderA.prisma as never,
      input,
      orderA.client,
    );
    const second = await issueGarments(
      orderB.prisma as never,
      input,
      orderB.client,
    );

    expect(first.docNumber).not.toBe(second.docNumber);
    expect(stockDocuments).toHaveLength(2);
    expect(orderA.createMovement.mock.calls[0]?.[0]?.idempotencyKey).not.toBe(
      orderB.createMovement.mock.calls[0]?.[0]?.idempotencyKey,
    );
  });
});
