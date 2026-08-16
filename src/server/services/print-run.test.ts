import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/prisma";

const serviceMocks = vi.hoisted(() => ({
  nextDocumentNumber: vi.fn(),
  finalizeProductionIfComplete: vi.fn(),
  resolveSoleOrderArtworkId: vi.fn(),
}));

vi.mock("@/server/services/document-number", () => ({
  nextDocumentNumber: serviceMocks.nextDocumentNumber,
}));
vi.mock("@/server/services/order-status", () => ({
  finalizeProductionIfComplete: serviceMocks.finalizeProductionIfComplete,
}));
vi.mock("@/server/services/artwork", () => ({
  resolveSoleOrderArtworkId: serviceMocks.resolveSoleOrderArtworkId,
}));

import {
  cancelPrintRun,
  completePrintRun,
  createPrintRun,
  getPrintQueue,
  listPrintRuns,
  markPrintRunPrinted,
} from "./print-run";

function printRunHarness(params?: {
  orderStatus?: string;
  runStatus?: "PRINTING" | "PRINTED" | "COMPLETED" | "CANCELLED";
}) {
  const log: string[] = [];
  const orderStatus = params?.orderStatus ?? "PRODUCING";
  let runStatus = params?.runStatus ?? "PRINTING";
  const order = {
    id: "order-1",
    orderNumber: "ORD-1",
    title: "งานทดสอบ",
    customerId: "customer-1",
    internalStatus: orderStatus,
    items: [{ totalQuantity: 10 }],
    designs: [{ id: "design-1" }],
  };
  const step = {
    id: "step-1",
    productionId: "production-1",
    stepType: "DTF_PRINT",
    status: "PENDING",
    qtyDone: 0,
    qtyTotal: 10,
    printRunItems: [] as Array<{ id: string }>,
    production: { order },
  };
  const item = {
    id: "item-1",
    printRunId: "run-1",
    productionStepId: "step-1",
    orderId: "order-1",
    qty: 10,
    extraQty: 0,
    createdAt: new Date(0),
    order,
  };

  const tx = {
    $queryRaw: vi.fn(async (query: TemplateStringsArray) => {
      const table = String(query[0]).match(/FROM\s+(\w+)/i)?.[1] ?? "unknown";
      log.push(`lock:${table}`);
      return [];
    }),
    productionStep: {
      findMany: vi.fn(async (args: { select?: Record<string, unknown> }) => {
        if (Object.keys(args.select ?? {}).length === 1 && args.select?.productionId) {
          return [{ productionId: "production-1" }];
        }
        log.push("read:steps-live");
        return [{ ...step }];
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        log.push("write:step");
        if (typeof data.status === "string") step.status = data.status;
        const increment = (data.qtyDone as { increment?: number } | undefined)?.increment;
        if (increment) step.qtyDone += increment;
        return { qtyDone: step.qtyDone, qtyTotal: step.qtyTotal, productionId: step.productionId };
      }),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    production: {
      findMany: vi.fn(async () => [{ orderId: "order-1" }]),
    },
    printRun: {
      findUnique: vi.fn(async () => ({ items: [{ productionStepId: "step-1" }] })),
      findUniqueOrThrow: vi.fn(async (args: { select?: Record<string, unknown> }) => {
        log.push("read:run-live");
        if (args.select) {
          return {
            status: runStatus,
            items: [{ order: { orderNumber: order.orderNumber, internalStatus: orderStatus } }],
          };
        }
        return {
          id: "run-1",
          runNumber: "FR-1",
          status: runStatus,
          items: [{ ...item }],
        };
      }),
      updateMany: vi.fn(async ({ where, data }: {
        where: { status: string };
        data: { status: typeof runStatus };
      }) => {
        if (runStatus !== where.status) return { count: 0 };
        log.push("write:run");
        runStatus = data.status;
        return { count: 1 };
      }),
      create: vi.fn(async () => {
        log.push("write:run");
        return { id: "run-1", runNumber: "FR-1", items: [{ id: "item-1" }] };
      }),
    },
    printRunItem: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => [{ productionStepId: "step-1" }]),
      update: vi.fn(),
    },
    filmStock: { create: vi.fn() },
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx)),
  } as unknown as ExtendedPrismaClient;
  return { prisma, tx, log, step, get runStatus() { return runStatus; } };
}

function expectProductionLockOrder(log: readonly string[]) {
  const step = log.indexOf("lock:production_steps");
  const production = log.indexOf("lock:productions");
  const order = log.indexOf("lock:orders");
  expect(step).toBeGreaterThanOrEqual(0);
  expect(production).toBeGreaterThan(step);
  expect(order).toBeGreaterThan(production);
  return { step, production, order };
}

beforeEach(() => {
  vi.clearAllMocks();
  serviceMocks.nextDocumentNumber.mockResolvedValue("FR-1");
  serviceMocks.finalizeProductionIfComplete.mockResolvedValue(false);
  serviceMocks.resolveSoleOrderArtworkId.mockResolvedValue(null);
});

describe("DTF print-run order status guard", () => {
  it("เปิดรอบได้เมื่อ order สดยัง PRODUCING และล็อก step → production → order ก่อนเขียน", async () => {
    const harness = printRunHarness();

    await expect(createPrintRun(harness.prisma, {
      items: [{ stepId: "step-1", qty: 10 }],
      userId: "user-1",
    })).resolves.toMatchObject({ runNumber: "FR-1" });

    const locks = expectProductionLockOrder(harness.log);
    expect(harness.log.indexOf("read:steps-live")).toBeGreaterThan(locks.order);
    expect(harness.log.indexOf("write:run")).toBeGreaterThan(locks.order);
  });

  it.each(["ON_HOLD", "CANCELLED", "QUALITY_CHECK", "PACKING", "COMPLETED"])(
    "ไม่เปิดรอบเมื่อ order สดเป็น %s",
    async (orderStatus) => {
      const harness = printRunHarness({ orderStatus });
      await expect(createPrintRun(harness.prisma, {
        items: [{ stepId: "step-1", qty: 10 }],
        userId: "user-1",
      })).rejects.toThrow("ทำรอบพิมพ์ต่อไม่ได้");
      expect(harness.log).not.toContain("write:run");
    },
  );

  it("กดพิมพ์จบได้เมื่อ PRODUCING และล็อกถึง order + run ก่อนเขียน", async () => {
    const harness = printRunHarness({ runStatus: "PRINTING" });
    await expect(markPrintRunPrinted(harness.prisma, "run-1")).resolves.toBeUndefined();
    const locks = expectProductionLockOrder(harness.log);
    expect(harness.log.indexOf("lock:print_runs")).toBeGreaterThan(locks.order);
    expect(harness.log.indexOf("read:run-live")).toBeGreaterThan(harness.log.indexOf("lock:print_runs"));
    expect(harness.log.indexOf("write:run")).toBeGreaterThan(harness.log.indexOf("lock:print_runs"));
  });

  it.each(["ON_HOLD", "CANCELLED", "QUALITY_CHECK", "PACKING"])(
    "ไม่กดพิมพ์จบเมื่อ order สดเป็น %s",
    async (orderStatus) => {
      const harness = printRunHarness({ orderStatus, runStatus: "PRINTING" });
      await expect(markPrintRunPrinted(harness.prisma, "run-1")).rejects.toThrow(
        "ทำรอบพิมพ์ต่อไม่ได้",
      );
      expect(harness.log).not.toContain("write:run");
    },
  );

  it("ปิดรอบได้เมื่อ PRODUCING และ guard เกิดก่อนเขียน run/step", async () => {
    const harness = printRunHarness({ runStatus: "PRINTED" });
    await expect(completePrintRun(harness.prisma, {
      runId: "run-1",
      userId: "user-1",
    })).resolves.toMatchObject({ runNumber: "FR-1" });
    const locks = expectProductionLockOrder(harness.log);
    expect(harness.log.indexOf("lock:print_runs")).toBeGreaterThan(locks.order);
    expect(harness.log.indexOf("read:run-live")).toBeGreaterThan(harness.log.indexOf("lock:print_runs"));
    expect(harness.log.indexOf("write:run")).toBeGreaterThan(harness.log.indexOf("lock:print_runs"));
    expect(harness.log.indexOf("write:step")).toBeGreaterThan(harness.log.indexOf("write:run"));
  });

  it.each(["ON_HOLD", "CANCELLED", "QUALITY_CHECK", "PACKING"])(
    "ไม่ปิดรอบหรือบวกยอดขั้นเมื่อ order สดเป็น %s",
    async (orderStatus) => {
      const harness = printRunHarness({ orderStatus, runStatus: "PRINTED" });
      await expect(completePrintRun(harness.prisma, {
        runId: "run-1",
        userId: "user-1",
      })).rejects.toThrow("ทำรอบพิมพ์ต่อไม่ได้");
      expect(harness.log).not.toContain("write:run");
      expect(harness.log).not.toContain("write:step");
    },
  );

  it("ยังยกเลิกรอบเพื่อคืนงานได้เมื่อ ON_HOLD โดยใช้ lock order เดียวกัน", async () => {
    const harness = printRunHarness({ orderStatus: "ON_HOLD", runStatus: "PRINTING" });
    await expect(cancelPrintRun(harness.prisma, "run-1")).resolves.toBeUndefined();
    const locks = expectProductionLockOrder(harness.log);
    expect(harness.log.indexOf("lock:print_runs")).toBeGreaterThan(locks.order);
    expect(harness.runStatus).toBe("CANCELLED");
  });
});

describe("DTF queue/list DTO", () => {
  it("คิว query เฉพาะ PRODUCING และ response ไม่ส่งข้อมูลเงิน", async () => {
    const findMany = vi.fn().mockResolvedValue([{
      id: "step-1",
      productionId: "production-1",
      qtyDone: 0,
      qtyTotal: 10,
      printRunItems: [],
      production: {
        order: {
          id: "order-1",
          orderNumber: "ORD-1",
          title: "งานทดสอบ",
          internalStatus: "PRODUCING",
          deadline: null,
          customer: { name: "ลูกค้า" },
          items: [{ totalQuantity: 10 }],
          designs: [],
        },
      },
    }]);
    const result = await getPrintQueue({ productionStep: { findMany } } as never);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ production: { order: { internalStatus: "PRODUCING" } } }),
    }));
    expect(JSON.stringify(result)).not.toMatch(/amount|price|cost/i);
  });

  it("active run ที่ order พ้น PRODUCING มี blockedReason และ list ใช้ explicit no-money select", async () => {
    const findMany = vi.fn().mockResolvedValue([{
      id: "run-1",
      runNumber: "FR-1",
      status: "PRINTED",
      note: null,
      printedAt: new Date(0),
      completedAt: null,
      createdAt: new Date(0),
      createdBy: { name: "ช่างพิมพ์" },
      items: [{
        id: "item-1",
        qty: 10,
        extraQty: 0,
        order: {
          orderNumber: "ORD-1",
          title: "งานทดสอบ",
          deadline: null,
          internalStatus: "ON_HOLD",
          designs: [],
        },
        productionStep: { status: "IN_PROGRESS", qtyDone: 0, qtyTotal: 10 },
      }],
    }]);
    const result = await listPrintRuns({ printRun: { findMany } } as never);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ select: expect.any(Object) }));
    expect(findMany.mock.calls[0]?.[0]).not.toHaveProperty("include");
    expect(result[0]?.blockedReason).toContain("พักงาน");
    expect(JSON.stringify(result)).not.toMatch(/amount|price|cost/i);
  });
});
