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
  laneSteps?: Array<{ id: string; stepType: string; status: string; sortOrder: number }>;
  assignedToId?: string | null;
  runCreatedById?: string;
  runItemAssignedToIds?: Array<string | null>;
}) {
  const log: string[] = [];
  const orderStatus = params?.orderStatus ?? "PRODUCING";
  let runStatus = params?.runStatus ?? "PRINTING";
  const assignedToId = params?.assignedToId === undefined ? "user-1" : params.assignedToId;
  const runCreatedById = params?.runCreatedById ?? "user-1";
  const runItemAssignedToIds = params?.runItemAssignedToIds ?? [assignedToId];
  const order = {
    id: "order-1",
    orderNumber: "ORD-1",
    title: "งานทดสอบ",
    customerId: "customer-1",
    internalStatus: orderStatus,
    items: [{ totalQuantity: 10 }],
    designs: [{ id: "design-1" }],
  };
  const laneSteps = params?.laneSteps ?? [
    { id: "step-1", stepType: "DTF_PRINT", status: "PENDING", sortOrder: 1 },
  ];
  const step = {
    id: "step-1",
    productionId: "production-1",
    stepType: "DTF_PRINT",
    status: "PENDING",
    assignedToId,
    qtyDone: 0,
    qtyTotal: 10,
    printRunItems: [] as Array<{ id: string }>,
    production: { order, steps: laneSteps },
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
    productionStep: { assignedToId: runItemAssignedToIds[0] ?? null },
  };

  const tx = {
    $queryRaw: vi.fn(async (query: TemplateStringsArray) => {
      const sql = String(query);
      if (sql.includes("pg_advisory_xact_lock")) {
        log.push("lock:topology");
        return [];
      }
      const table = sql.match(/FROM\s+(\w+)/i)?.[1] ?? "unknown";
      log.push(`lock:${table}`);
      return [];
    }),
    productionStep: {
      findMany: vi.fn(async (args: { select?: Record<string, unknown> }) => {
        if (!args.select?.stepType) {
          return [{
            id: "step-1",
            productionId: "production-1",
            production: { orderId: "order-1" },
          }];
        }
        log.push("read:steps-live");
        return [{ ...step }];
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        log.push("write:step");
        if (typeof data.status === "string") step.status = data.status;
        if (typeof data.assignedToId === "string" || data.assignedToId === null) {
          step.assignedToId = data.assignedToId;
        }
        const increment = (data.qtyDone as { increment?: number } | undefined)?.increment;
        if (increment) step.qtyDone += increment;
        return { qtyDone: step.qtyDone, qtyTotal: step.qtyTotal, productionId: step.productionId };
      }),
      updateMany: vi.fn(async () => {
        log.push("write:step");
        return { count: 1 };
      }),
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
            runNumber: "FR-1",
            createdById: runCreatedById,
            status: runStatus,
            items: runItemAssignedToIds.map((itemAssignedToId) => ({
              order: { orderNumber: order.orderNumber, internalStatus: orderStatus },
              productionStep: { assignedToId: itemAssignedToId },
            })),
          };
        }
        return {
          id: "run-1",
          runNumber: "FR-1",
          createdById: runCreatedById,
          status: runStatus,
          items: runItemAssignedToIds.map((itemAssignedToId, index) => ({
            ...item,
            id: `item-${index + 1}`,
            productionStep: { assignedToId: itemAssignedToId },
          })),
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
    auditLog: {
      create: vi.fn(async () => {
        log.push("write:audit");
        return { id: "audit-1" };
      }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async <T>(callback: (client: typeof tx) => Promise<T>) => {
      const result = await callback(tx);
      log.push("tx:commit");
      return result;
    }),
  } as unknown as ExtendedPrismaClient;
  return { prisma, tx, log, step, get runStatus() { return runStatus; } };
}

function multiOrderCompleteHarness() {
  const log: string[] = [];
  const references = [
    { id: "step-z-dtf", productionId: "production-z", production: { orderId: "order-z" } },
    { id: "step-a-dtf", productionId: "production-a", production: { orderId: "order-a" } },
  ];
  const quantities = new Map(references.map((reference) => [reference.id, 0]));
  const items = references.map((reference) => ({
    id: `item-${reference.id}`,
    printRunId: "run-multi",
    productionStepId: reference.id,
    orderId: reference.production.orderId,
    qty: 10,
    extraQty: 0,
    createdAt: new Date(0),
    order: {
      id: reference.production.orderId,
      orderNumber: reference.production.orderId.toUpperCase(),
      title: "งานทดสอบหลายออเดอร์",
      customerId: `customer-${reference.production.orderId}`,
      internalStatus: "PRODUCING",
    },
    productionStep: { assignedToId: "user-1" },
  }));

  const tx = {
    $queryRaw: vi.fn(async (query: TemplateStringsArray, id: string) => {
      const sql = String(query);
      if (sql.includes("pg_advisory_xact_lock")) {
        log.push(`lock:topology:${id}`);
        return [];
      }
      const table = sql.match(/FROM\s+(\w+)/i)?.[1] ?? "unknown";
      log.push(`lock:${table}:${id}${sql.includes("ORDER BY id") ? ":ordered" : ""}`);
      return [];
    }),
    productionStep: {
      findMany: vi.fn(async () => references),
      update: vi.fn(async ({ where, data }: {
        where: { id: string };
        data: { qtyDone?: { increment: number } };
      }) => {
        log.push(`write:step:${where.id}`);
        const next = (quantities.get(where.id) ?? 0) + (data.qtyDone?.increment ?? 0);
        quantities.set(where.id, next);
        return {
          qtyDone: next,
          qtyTotal: 10,
          productionId: references.find((reference) => reference.id === where.id)!.productionId,
        };
      }),
    },
    printRun: {
      findUnique: vi.fn(async () => ({
        items: items.map((item) => ({ productionStepId: item.productionStepId })),
      })),
      findUniqueOrThrow: vi.fn(async () => ({
        id: "run-multi",
        runNumber: "FR-MULTI",
        createdById: "user-1",
        status: "PRINTED",
        items,
      })),
      updateMany: vi.fn(async () => {
        log.push("write:run");
        return { count: 1 };
      }),
    },
    printRunItem: { count: vi.fn(async () => 0), update: vi.fn() },
    filmStock: { create: vi.fn() },
    auditLog: {
      create: vi.fn(async () => {
        log.push("write:audit");
        return { id: "audit-1" };
      }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async <T>(callback: (client: typeof tx) => Promise<T>) => {
      const result = await callback(tx);
      log.push("tx:commit");
      return result;
    }),
  } as unknown as ExtendedPrismaClient;
  return { prisma, tx, log };
}

function expectProductionLockOrder(log: readonly string[]) {
  const topology = log.indexOf("lock:topology");
  const step = log.indexOf("lock:production_steps");
  const production = log.indexOf("lock:productions");
  const order = log.indexOf("lock:orders");
  expect(topology).toBeGreaterThanOrEqual(0);
  expect(step).toBeGreaterThan(topology);
  expect(production).toBeGreaterThan(step);
  expect(order).toBeGreaterThan(production);
  return { topology, step, production, order };
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
      canSupervise: false,
    })).resolves.toMatchObject({ runNumber: "FR-1" });

    const locks = expectProductionLockOrder(harness.log);
    expect(harness.log.indexOf("read:steps-live")).toBeGreaterThan(locks.order);
    expect(harness.log.indexOf("write:run")).toBeGreaterThan(locks.order);
    const stepLock = harness.tx.$queryRaw.mock.calls.find((call) =>
      String(call[0]).includes("production_steps"),
    );
    expect(String(stepLock?.[0])).toContain("ORDER BY id");
    expect(harness.log.indexOf("write:audit")).toBeGreaterThan(
      harness.log.indexOf("write:step"),
    );
    expect(harness.log.indexOf("tx:commit")).toBeGreaterThan(
      harness.log.indexOf("write:audit"),
    );
  });

  it("รอบหลายออเดอร์จอง topology ตาม orderId sorted แล้วล็อกทุก sibling step ก่อน finalizer", async () => {
    const harness = multiOrderCompleteHarness();
    serviceMocks.finalizeProductionIfComplete.mockImplementation(async (_tx, input) => {
      harness.log.push(`finalize:${input.productionId}`);
      return false;
    });

    await expect(completePrintRun(harness.prisma, {
      runId: "run-multi",
      userId: "user-1",
      canSupervise: false,
    })).resolves.toMatchObject({ runNumber: "FR-MULTI" });

    expect(harness.log.slice(0, 9)).toEqual([
      "lock:topology:order-a",
      "lock:topology:order-z",
      "lock:production_steps:production-a:ordered",
      "lock:production_steps:production-z:ordered",
      "lock:productions:production-a",
      "lock:productions:production-z",
      "lock:orders:order-a",
      "lock:orders:order-z",
      "lock:print_runs:run-multi",
    ]);
    expect(harness.log.indexOf("write:run")).toBeGreaterThan(
      harness.log.indexOf("lock:print_runs:run-multi"),
    );
    expect(harness.log.indexOf("finalize:production-a")).toBeGreaterThan(
      harness.log.indexOf("lock:orders:order-z"),
    );
    expect(harness.log.indexOf("finalize:production-z")).toBeGreaterThan(
      harness.log.indexOf("finalize:production-a"),
    );
    expect(harness.log.indexOf("write:audit")).toBeGreaterThan(
      harness.log.indexOf("finalize:production-z"),
    );
    expect(harness.log.indexOf("tx:commit")).toBeGreaterThan(
      harness.log.indexOf("write:audit"),
    );
  });

  it("audit เปิดรอบล้มแล้ว transaction ไม่คืน success/commit", async () => {
    const harness = printRunHarness();
    harness.tx.auditLog.create.mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(createPrintRun(harness.prisma, {
      items: [{ stepId: "step-1", qty: 10 }],
      userId: "user-1",
      canSupervise: false,
    })).rejects.toThrow("audit unavailable");
    expect(harness.log).toContain("write:run");
    expect(harness.log).not.toContain("tx:commit");
  });

  it("audit ปิดรอบล้มแล้ว transaction ไม่คืน success/commit", async () => {
    const harness = printRunHarness({ runStatus: "PRINTED" });
    harness.tx.auditLog.create.mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(completePrintRun(harness.prisma, {
      runId: "run-1",
      userId: "user-1",
      canSupervise: false,
    })).rejects.toThrow("audit unavailable");
    expect(harness.log).toContain("write:run");
    expect(harness.log).not.toContain("tx:commit");
  });

  it.each([
    ["พิมพ์จบ", "PRINTING", markPrintRunPrinted],
    ["ยกเลิก", "PRINTING", cancelPrintRun],
  ] as const)(
    "audit %s ล้มแล้ว transaction ไม่คืน success/commit",
    async (_label, runStatus, mutate) => {
      const harness = printRunHarness({ runStatus });
      harness.tx.auditLog.create.mockRejectedValueOnce(new Error("audit unavailable"));

      await expect(mutate(harness.prisma, {
        runId: "run-1",
        userId: "user-1",
        canSupervise: false,
      })).rejects.toThrow("audit unavailable");
      expect(harness.log).toContain("write:run");
      expect(harness.log).not.toContain("tx:commit");
    },
  );

  it.each([
    ["พิมพ์จบ", "PRINTED", markPrintRunPrinted],
    ["ยกเลิก", "CANCELLED", cancelPrintRun],
  ] as const)("retry %s ที่สถานะเปลี่ยนแล้วไม่สร้าง audit ซ้ำ", async (_label, runStatus, mutate) => {
    const harness = printRunHarness({ runStatus });

    await expect(mutate(harness.prisma, {
      runId: "run-1",
      userId: "user-1",
      canSupervise: false,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(harness.tx.auditLog.create).not.toHaveBeenCalled();
    expect(harness.log).not.toContain("write:step");
  });

  it("สมาชิก run เปลี่ยนระหว่างรอ lock แล้วหยุดก่อนเขียน", async () => {
    const harness = printRunHarness({ runStatus: "PRINTING" });
    harness.tx.printRun.findUnique
      .mockResolvedValueOnce({ items: [{ productionStepId: "step-1" }] })
      .mockResolvedValueOnce({
        items: [
          { productionStepId: "step-1" },
          { productionStepId: "step-from-another-screen" },
        ],
      });

    await expect(markPrintRunPrinted(harness.prisma, {
      runId: "run-1",
      userId: "user-1",
      canSupervise: false,
    })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(harness.log).not.toContain("write:run");
  });

  it("ไม่เปิดรอบให้ DTF อนาคตเมื่อขั้นก่อนหน้าใน lane ยังไม่เสร็จ", async () => {
    const harness = printRunHarness({
      laneSteps: [
        { id: "dtf-before", stepType: "DTF_PRINT", status: "PENDING", sortOrder: 1 },
        { id: "step-1", stepType: "DTF_PRINT", status: "PENDING", sortOrder: 1 },
      ],
    });

    await expect(createPrintRun(harness.prisma, {
      items: [{ stepId: "step-1", qty: 10 }],
      userId: "user-1",
      canSupervise: false,
    })).rejects.toThrow("ขั้นก่อนหน้า");
    expect(harness.log).not.toContain("write:run");
    expect(harness.log).not.toContain("write:step");
  });

  it.each(["ON_HOLD", "CANCELLED", "QUALITY_CHECK", "PACKING", "COMPLETED"])(
    "ไม่เปิดรอบเมื่อ order สดเป็น %s",
    async (orderStatus) => {
      const harness = printRunHarness({ orderStatus });
      await expect(createPrintRun(harness.prisma, {
        items: [{ stepId: "step-1", qty: 10 }],
        userId: "user-1",
        canSupervise: false,
      })).rejects.toThrow("ทำรอบพิมพ์ต่อไม่ได้");
      expect(harness.log).not.toContain("write:run");
    },
  );

  it("กดพิมพ์จบได้เมื่อ PRODUCING และล็อกถึง order + run ก่อนเขียน", async () => {
    const harness = printRunHarness({ runStatus: "PRINTING" });
    await expect(markPrintRunPrinted(harness.prisma, {
      runId: "run-1",
      userId: "user-1",
      canSupervise: false,
    })).resolves.toBeUndefined();
    const locks = expectProductionLockOrder(harness.log);
    expect(harness.log.indexOf("lock:print_runs")).toBeGreaterThan(locks.order);
    expect(harness.log.indexOf("read:run-live")).toBeGreaterThan(harness.log.indexOf("lock:print_runs"));
    expect(harness.log.indexOf("write:run")).toBeGreaterThan(harness.log.indexOf("lock:print_runs"));
    expect(harness.log.indexOf("write:audit")).toBeGreaterThan(harness.log.indexOf("write:run"));
    expect(harness.log.indexOf("tx:commit")).toBeGreaterThan(harness.log.indexOf("write:audit"));
    expect(harness.tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        entityType: "PRINT_RUN",
        entityId: "run-1",
      }),
    });
  });

  it.each(["ON_HOLD", "CANCELLED", "QUALITY_CHECK", "PACKING"])(
    "ไม่กดพิมพ์จบเมื่อ order สดเป็น %s",
    async (orderStatus) => {
      const harness = printRunHarness({ orderStatus, runStatus: "PRINTING" });
      await expect(markPrintRunPrinted(harness.prisma, {
        runId: "run-1",
        userId: "user-1",
        canSupervise: false,
      })).rejects.toThrow(
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
      canSupervise: false,
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
        canSupervise: false,
      })).rejects.toThrow("ทำรอบพิมพ์ต่อไม่ได้");
      expect(harness.log).not.toContain("write:run");
      expect(harness.log).not.toContain("write:step");
    },
  );

  it("ยังยกเลิกรอบเพื่อคืนงานได้เมื่อ ON_HOLD โดยใช้ lock order เดียวกัน", async () => {
    const harness = printRunHarness({ orderStatus: "ON_HOLD", runStatus: "PRINTING" });
    await expect(cancelPrintRun(harness.prisma, {
      runId: "run-1",
      userId: "user-1",
      canSupervise: false,
    })).resolves.toBeUndefined();
    const locks = expectProductionLockOrder(harness.log);
    expect(harness.log.indexOf("lock:print_runs")).toBeGreaterThan(locks.order);
    expect(harness.runStatus).toBe("CANCELLED");
    expect(harness.log.indexOf("write:audit")).toBeGreaterThan(harness.log.indexOf("write:step"));
    expect(harness.log.indexOf("tx:commit")).toBeGreaterThan(harness.log.indexOf("write:audit"));
  });
});

describe("DTF print-run ownership", () => {
  it("เปิดรอบแล้ว claim ขั้นที่ยังไม่มีเจ้าของให้ผู้สร้างใต้ lock", async () => {
    const harness = printRunHarness({ assignedToId: null });

    await createPrintRun(harness.prisma, {
      items: [{ stepId: "step-1", qty: 10 }],
      userId: "worker-1",
      canSupervise: false,
    });

    expect(harness.step.assignedToId).toBe("worker-1");
    expect(harness.tx.productionStep.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ assignedToId: "worker-1" }),
    }));
  });

  it("ช่างเปิดรอบจากขั้นที่มอบให้คนอื่นไม่ได้ และไม่เขียนอะไร", async () => {
    const harness = printRunHarness({ assignedToId: "worker-2" });

    await expect(createPrintRun(harness.prisma, {
      items: [{ stepId: "step-1", qty: 10 }],
      userId: "worker-1",
      canSupervise: false,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(harness.log).not.toContain("write:run");
    expect(harness.log).not.toContain("write:step");
    expect(harness.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("หัวหน้าเปิดรอบขั้นที่มีเจ้าของแล้วได้โดยไม่แย่ง assignment", async () => {
    const harness = printRunHarness({ assignedToId: "worker-2" });

    await createPrintRun(harness.prisma, {
      items: [{ stepId: "step-1", qty: 10 }],
      userId: "manager-1",
      canSupervise: true,
    });

    expect(harness.step.assignedToId).toBe("worker-2");
  });

  it.each([
    ["mark", "PRINTING"],
    ["complete", "PRINTED"],
    ["cancel", "PRINTING"],
  ] as const)(
    "ช่างที่ไม่ใช่ผู้สร้างหรือผู้รับผิดชอบทำ %s ไม่ได้",
    async (action, runStatus) => {
      const harness = printRunHarness({
        runStatus,
        runCreatedById: "creator-1",
        runItemAssignedToIds: ["worker-2"],
      });
      const access = { runId: "run-1", userId: "worker-3", canSupervise: false };

      const result = action === "mark"
        ? markPrintRunPrinted(harness.prisma, access)
        : action === "complete"
          ? completePrintRun(harness.prisma, access)
          : cancelPrintRun(harness.prisma, access);
      await expect(result).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(harness.log).not.toContain("write:run");
      expect(harness.log).not.toContain("write:step");
      expect(harness.tx.auditLog.create).not.toHaveBeenCalled();
    },
  );

  it("ผู้รับผิดชอบทุกงานในรอบจัดการรอบที่คนอื่นเปิดไว้ได้", async () => {
    const harness = printRunHarness({
      runStatus: "PRINTING",
      runCreatedById: "creator-1",
      runItemAssignedToIds: ["worker-2"],
    });

    await expect(markPrintRunPrinted(harness.prisma, {
      runId: "run-1",
      userId: "worker-2",
      canSupervise: false,
    })).resolves.toBeUndefined();
  });

  it("รอบที่มีงานของหลายคนห้ามช่างคนเดียวจัดการทั้งรอบ", async () => {
    const harness = printRunHarness({
      runStatus: "PRINTING",
      runCreatedById: "manager-1",
      runItemAssignedToIds: ["worker-1", "worker-2"],
    });

    await expect(markPrintRunPrinted(harness.prisma, {
      runId: "run-1",
      userId: "worker-1",
      canSupervise: false,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(harness.log).not.toContain("write:run");
  });

  it("หัวหน้าจัดการรอบของคนอื่นได้", async () => {
    const harness = printRunHarness({
      runStatus: "PRINTING",
      runCreatedById: "creator-1",
      runItemAssignedToIds: ["worker-2"],
    });

    await expect(cancelPrintRun(harness.prisma, {
      runId: "run-1",
      userId: "manager-1",
      canSupervise: true,
    })).resolves.toBeUndefined();
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
        steps: [{ id: "step-1", stepType: "DTF_PRINT", status: "PENDING", sortOrder: 1 }],
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
    const result = await getPrintQueue(
      { productionStep: { findMany } } as never,
      { userId: "user-1", canSupervise: false },
    );

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        production: { order: { internalStatus: "PRODUCING" } },
        OR: [{ assignedToId: "user-1" }, { assignedToId: null }],
      }),
    }));
    expect(JSON.stringify(result)).not.toMatch(/amount|price|cost/i);
  });

  it("คิวหัวหน้าเห็นทุก assignment แต่ยังคง no-money select", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    await getPrintQueue(
      { productionStep: { findMany } } as never,
      { userId: "manager-1", canSupervise: true },
    );

    const query = findMany.mock.calls[0]?.[0];
    expect(query.where).not.toHaveProperty("OR");
    expect(JSON.stringify(query.select)).not.toMatch(/amount|price|cost/i);
  });

  it("คิวซ่อน DTF อนาคตใน lane เดียวกัน", async () => {
    const findMany = vi.fn().mockResolvedValue([{
      id: "step-future",
      productionId: "production-1",
      qtyDone: 0,
      qtyTotal: 10,
      printRunItems: [],
      production: {
        steps: [
          { id: "step-future", stepType: "DTF_PRINT", status: "PENDING", sortOrder: 1 },
          { id: "step-a-now", stepType: "DTF_PRINT", status: "PENDING", sortOrder: 1 },
        ],
        order: {
          id: "order-1",
          orderNumber: "ORD-1",
          title: "งานทดสอบ",
          internalStatus: "PRODUCING",
          deadline: null,
          customer: { name: "ลูกค้า" },
          items: [{ totalQuantity: 10 }],
          designs: [{ versionNumber: 1, fileUrl: "/design.pdf", thumbnailUrl: null }],
        },
      },
    }]);

    await expect(getPrintQueue(
      { productionStep: { findMany } } as never,
      { userId: "user-1", canSupervise: false },
    )).resolves.toEqual([]);
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
