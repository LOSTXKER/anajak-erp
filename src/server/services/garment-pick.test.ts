import { describe, expect, it, vi } from "vitest";
import type { StockApiClient } from "@/lib/stock-api";
import { issueGarments, returnGarments } from "./garment-pick";

type Usage = {
  id: string;
  productionId: string;
  productId: string;
  productVariantId: string | null;
  quantity: number;
  movementType: string;
  note?: string | null;
  stockMovementRef: string;
};

function garmentHarness(params?: {
  issued?: number;
  returned?: number;
  orderStatus?: string;
}) {
  const log: string[] = [];
  const usages: Usage[] = [];
  let usageSeq = 0;
  let revisionCount = 0;
  const step = {
    id: "step-pick",
    productionId: "production-1",
    stepType: "GARMENT_PICK",
    status: "PENDING",
    assignedToId: null as string | null,
    qtyDone: 0,
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
        return { id: "production-1", orderId: "order-1" };
      }),
    },
    productionStep: {
      findUniqueOrThrow: vi.fn(async () => {
        log.push("step-read");
        return { ...step };
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        log.push("step-write");
        if (typeof data.assignedToId === "string") step.assignedToId = data.assignedToId;
        if (typeof data.status === "string") step.status = data.status;
        const qtyDone = data.qtyDone as { increment?: number } | undefined;
        if (qtyDone?.increment) step.qtyDone += qtyDone.increment;
        return { ...step };
      }),
    },
    order: {
      findUniqueOrThrow: vi.fn(async () => {
        log.push("state-order-read");
        return {
          id: "order-1",
          orderNumber: "ORD-1",
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
    materialUsage: {
      findMany: vi.fn(async (args?: {
        where?: {
          stockMovementRef?: string;
          movementType?: string;
          note?: { startsWith: string };
        };
      }) => {
        log.push("usage-read");
        if (args?.where?.note) {
          return usages
            .filter(
              (usage) =>
                (!args.where!.movementType || usage.movementType === args.where!.movementType) &&
                usage.note?.startsWith(args.where!.note!.startsWith),
            )
            .map(({ quantity, stockMovementRef }) => ({ quantity, stockMovementRef }));
        }
        if (args?.where?.stockMovementRef) {
          return usages
            .filter(
              (usage) =>
                usage.stockMovementRef === args.where!.stockMovementRef &&
                (!args.where!.movementType || usage.movementType === args.where!.movementType),
            )
            .map(({ quantity }) => ({ quantity }));
        }
        return usages.map(({ productId, productVariantId, quantity, movementType }) => ({
          productId,
          productVariantId,
          quantity,
          movementType,
        }));
      }),
      findFirst: vi.fn(async ({ where }: { where: { stockMovementRef: string } }) =>
        usages.find((usage) => usage.stockMovementRef === where.stockMovementRef) ?? null,
      ),
      deleteMany: vi.fn(async ({ where }: { where: { stockMovementRef: string } }) => {
        for (let index = usages.length - 1; index >= 0; index -= 1) {
          if (usages[index]!.stockMovementRef === where.stockMovementRef) usages.splice(index, 1);
        }
        return { count: 1 };
      }),
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
  };

  let transactionTail = Promise.resolve();
  const prisma = {
    ...tx,
    $transaction: vi.fn(async <T>(callback: (client: typeof tx) => Promise<T>) => {
      const previous = transactionTail;
      let release: () => void = () => {};
      transactionTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      log.push("transaction-start");
      try {
        return await callback(tx);
      } finally {
        log.push("transaction-end");
        release();
      }
    }),
  };

  const documents = new Map<string, string>();
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

  return { prisma, client, createMovement, log, usages, step, get revisionCount() { return revisionCount; } };
}

describe("garment pick concurrency", () => {
  it("ยอม ISSUE เมื่อ order ยังเป็น PRODUCING และ response ไม่มีเงิน", async () => {
    const harness = garmentHarness({ orderStatus: "PRODUCING" });

    const result = await issueGarments(harness.prisma as never, {
      productionId: "production-1",
      stepId: "step-pick",
      lines: [{ sku: "TS-M", qty: 4 }],
      idempotencyKey: "issue-producing",
      userId: "user-a",
      canSupervise: false,
    }, harness.client);

    expect(harness.createMovement).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ issuedQty: 4, alreadyRecorded: false });
    expect(JSON.stringify(result)).not.toMatch(/amount|price|cost/i);
    expect(String(harness.prisma.$queryRaw.mock.calls[0]?.[0])).toContain("production_steps");
    expect(String(harness.prisma.$queryRaw.mock.calls[1]?.[0])).toContain("productions");
    expect(String(harness.prisma.$queryRaw.mock.calls[2]?.[0])).toContain("orders");
    expect(
      harness.prisma.order.findUniqueOrThrow.mock.invocationCallOrder[0],
    ).toBeLessThan(harness.createMovement.mock.invocationCallOrder[0]);
  });

  it.each(["ON_HOLD", "CANCELLED"])(
    "ปฏิเสธ ISSUE เมื่อ order สดเป็น %s ก่อนยิง Stock",
    async (orderStatus) => {
      const harness = garmentHarness({ orderStatus });

      await expect(
        issueGarments(harness.prisma as never, {
          productionId: "production-1",
          stepId: "step-pick",
          lines: [{ sku: "TS-M", qty: 4 }],
          idempotencyKey: `issue-${orderStatus.toLowerCase()}`,
          userId: "user-a",
          canSupervise: false,
        }, harness.client),
      ).rejects.toThrow("เบิกเสื้อไม่ได้");

      expect(harness.createMovement).not.toHaveBeenCalled();
      expect(harness.usages).toHaveLength(0);
    },
  );

  it.each(["ON_HOLD", "CANCELLED"])(
    "ยังคืนเสื้อ cleanup ได้เมื่อ order เป็น %s",
    async (orderStatus) => {
      const harness = garmentHarness({ issued: 13, orderStatus });

      await expect(
        returnGarments(harness.prisma as never, {
          productionId: "production-1",
          lines: [{ sku: "TS-M", qty: 3 }],
          idempotencyKey: `return-${orderStatus.toLowerCase()}`,
          userId: "user-a",
        }, harness.client),
      ).resolves.toMatchObject({ returnedQty: 3, alreadyRecorded: false });

      expect(harness.createMovement).toHaveBeenCalledOnce();
    },
  );

  it("serialize และอ่าน assignee สดก่อน ISSUE — สอง staff/key ตัด Stock ได้ครั้งเดียว", async () => {
    const harness = garmentHarness();

    const results = await Promise.allSettled([
      issueGarments(harness.prisma as never, {
        productionId: "production-1",
        stepId: "step-pick",
        lines: [{ sku: "TS-M", qty: 5 }],
        idempotencyKey: "issue-user-a",
        userId: "user-a",
        canSupervise: false,
      }, harness.client),
      issueGarments(harness.prisma as never, {
        productionId: "production-1",
        stepId: "step-pick",
        lines: [{ sku: "TS-M", qty: 5 }],
        idempotencyKey: "issue-user-b",
        userId: "user-b",
        canSupervise: false,
      }, harness.client),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(harness.createMovement).toHaveBeenCalledOnce();
    expect(harness.usages.filter((usage) => usage.movementType === "ISSUE")).toHaveLength(1);
    expect(["user-a", "user-b"]).toContain(harness.step.assignedToId);
    expect(harness.log.indexOf("lock")).toBeLessThan(harness.log.indexOf("stock"));
    expect(harness.log.indexOf("step-read")).toBeLessThan(harness.log.indexOf("stock"));
    expect(harness.log.indexOf("usage-read")).toBeLessThan(harness.log.indexOf("stock"));
  });

  it("serialize และอ่านยอดคืนสดก่อน RETURN — สอง key คืนเศษก้อนเดียวได้ครั้งเดียว", async () => {
    const harness = garmentHarness({ issued: 13 });

    const results = await Promise.allSettled([
      returnGarments(harness.prisma as never, {
        productionId: "production-1",
        lines: [{ sku: "TS-M", qty: 3 }],
        idempotencyKey: "return-user-a",
        userId: "user-a",
      }, harness.client),
      returnGarments(harness.prisma as never, {
        productionId: "production-1",
        lines: [{ sku: "TS-M", qty: 3 }],
        idempotencyKey: "return-user-b",
        userId: "user-b",
      }, harness.client),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(harness.createMovement).toHaveBeenCalledOnce();
    expect(
      harness.usages
        .filter((usage) => usage.movementType === "RETURN")
        .reduce((sum, usage) => sum + usage.quantity, 0),
    ).toBe(3);
    expect(harness.log.indexOf("lock")).toBeLessThan(harness.log.indexOf("stock"));
    expect(harness.log.indexOf("usage-read")).toBeLessThan(harness.log.indexOf("stock"));
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
    expect(harness.usages.filter((usage) => usage.movementType === "ISSUE")).toHaveLength(1);
    expect(harness.step.qtyDone).toBe(4);
    expect(harness.revisionCount).toBe(1);
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
  });
});
