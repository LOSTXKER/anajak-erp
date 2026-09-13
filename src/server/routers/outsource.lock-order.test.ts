import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";

const serviceMocks = vi.hoisted(() => ({
  finalizeProductionIfComplete: vi.fn(),
}));

vi.mock("@/server/services/order-status", () => ({
  finalizeProductionIfComplete: serviceMocks.finalizeProductionIfComplete,
}));

import { outsourceRouter } from "./outsource";

type HarnessOptions = {
  orderStatus?: string;
  stepType?: string;
  stepStatus?: string;
  qtyDone?: number;
  qtyTotal?: number | null;
  outsourceStatus?: string;
  siblings?: Array<{ id: string; stepType: string; status: string; sortOrder: number }>;
  remainingOrders?: number;
  executionEnabled?: boolean;
};

function makeHarness(options: HarnessOptions = {}) {
  const log: string[] = [];
  let outsourceStatus = options.outsourceStatus ?? "RECEIVED_BACK";
  const step = {
    id: "step-outsource",
    productionId: "production-1",
    stepType: options.stepType ?? "EMBROIDERY",
    status: options.stepStatus ?? "IN_PROGRESS",
    sortOrder: 2,
    qtyDone: options.qtyDone ?? 0,
    qtyTotal: options.qtyTotal === undefined ? 10 : options.qtyTotal,
    executionEnabled: options.executionEnabled ?? false,
  };
  const siblings = options.siblings ?? [
    { id: step.id, stepType: step.stepType, status: step.status, sortOrder: step.sortOrder },
    { id: "step-packaging", stepType: "PACKAGING", status: "PENDING", sortOrder: 9 },
  ];
  const outsourceOrder = {
    id: "outsource-1",
    status: outsourceStatus,
    productionStepId: step.id,
    vendorId: "vendor-1",
    description: "ส่งปักโลโก้",
    quantity: 10,
    unitCost: 0,
    totalCost: 0,
    productionStep: {
      productionId: step.productionId,
      stepType: step.stepType,
      status: step.status,
      qtyDone: step.qtyDone,
      executionEnabled: step.executionEnabled,
      production: { orderId: "order-1" },
    },
  };

  function currentOutsource() {
    return {
      ...outsourceOrder,
      status: outsourceStatus,
      productionStep: {
        ...outsourceOrder.productionStep,
        status: step.status,
        qtyDone: step.qtyDone,
      },
    };
  }

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
    outsourceOrder: {
      findUniqueOrThrow: vi.fn(async (args: { select?: Record<string, unknown> }) => {
        if (!args.select) log.push("read:outsource-result");
        else if (args.select.status && args.select.productionStep) log.push("read:outsource-live");
        else log.push("read:outsource-reference");
        return currentOutsource();
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        log.push("write:outsource-create");
        return { id: "outsource-new", ...data, totalCost: data.totalCost ?? 0 };
      }),
      updateMany: vi.fn(async ({ where, data }: {
        where: { status: string };
        data: { status: string };
      }) => {
        if (where.status !== outsourceStatus) return { count: 0 };
        log.push("write:outsource-status");
        outsourceStatus = data.status;
        return { count: 1 };
      }),
      deleteMany: vi.fn(async ({ where }: { where: { status: string } }) => {
        if (where.status !== outsourceStatus) return { count: 0 };
        log.push("write:outsource-delete");
        return { count: 1 };
      }),
      count: vi.fn(async () => options.remainingOrders ?? 0),
    },
    productionStep: {
      findUniqueOrThrow: vi.fn(async () => ({ ...step })),
      findMany: vi.fn(async () => siblings.map((sibling) =>
        sibling.id === step.id
          ? { ...sibling, status: step.status }
          : { ...sibling },
      )),
      update: vi.fn(async ({ data }: {
        data: { qtyDone?: { increment: number }; status?: string };
      }) => {
        log.push("write:step");
        if (data.qtyDone?.increment) step.qtyDone += data.qtyDone.increment;
        if (data.status) step.status = data.status;
        return {
          qtyDone: step.qtyDone,
          qtyTotal: step.qtyTotal,
          productionId: step.productionId,
        };
      }),
      updateMany: vi.fn(async ({ where, data }: {
        where: { status?: string; qtyDone?: number };
        data: { status: string };
      }) => {
        log.push("write:step-conditional");
        if (
          (where.status === undefined || where.status === step.status) &&
          (where.qtyDone === undefined || where.qtyDone === step.qtyDone)
        ) {
          step.status = data.status;
          return { count: 1 };
        }
        return { count: 0 };
      }),
    },
    production: {
      findUniqueOrThrow: vi.fn(async () => ({ orderId: "order-1" })),
    },
    order: {
      findUniqueOrThrow: vi.fn(async () => ({
        internalStatus: options.orderStatus ?? "PRODUCING",
        orderNumber: "ORD-1",
      })),
    },
    goodsReceipt: { count: vi.fn(async () => 1) },
    auditLog: {
      create: vi.fn(async () => {
        log.push("write:audit");
        return { id: "audit-1" };
      }),
    },
    vendor: { findUniqueOrThrow: vi.fn() },
    costEntry: { upsert: vi.fn() },
  };
  const ctx: Context = {
    prisma: {
      $transaction: vi.fn(async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx)),
      productionStep: {
        findUnique: vi.fn().mockResolvedValue({
          executionEnabled: step.executionEnabled,
        }),
      },
      outsourceOrder: {
        findUnique: vi.fn().mockResolvedValue({
          productionStep: { executionEnabled: step.executionEnabled },
        }),
      },
    } as unknown as Context["prisma"],
    userId: "manager-1",
    userRole: "MANAGER",
    permissionOverrides: null,
  };

  return { ctx, tx, log, step, get outsourceStatus() { return outsourceStatus; } };
}

function expectProductionChainBefore(log: readonly string[], marker: string) {
  const topology = log.indexOf("lock:topology:order-1");
  const steps = log.indexOf("lock:production_steps:production-1:ordered");
  const production = log.indexOf("lock:productions:production-1");
  const order = log.indexOf("lock:orders:order-1");
  const write = log.indexOf(marker);
  expect(topology).toBeGreaterThanOrEqual(0);
  expect(steps).toBeGreaterThan(topology);
  expect(production).toBeGreaterThan(steps);
  expect(order).toBeGreaterThan(production);
  expect(write).toBeGreaterThan(order);
}

beforeEach(() => {
  vi.clearAllMocks();
  serviceMocks.finalizeProductionIfComplete.mockResolvedValue(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("outsource production boundary + lock order", () => {
  it("ปิด V2 lifecycle API เมื่อ rollout flag ปิด โดย legacy path ไม่ถูกแตะ", async () => {
    vi.stubEnv("PRODUCTION_V2_ENABLED", "0");
    const harness = makeHarness({
      stepStatus: "PENDING",
      executionEnabled: true,
    });

    await expect(
      outsourceRouter.createCaller(harness.ctx).createOrder({
        productionStepId: "step-outsource",
        vendorId: "vendor-1",
        description: "ส่งปักโลโก้",
        quantity: 10,
        unitCost: 0,
        commandId: "outsource-command-1",
        expectedRevision: 0,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(harness.log).not.toContain("write:outsource-create");
  });

  it("legacy outsource writer ปฏิเสธ Operation Job ของ Production V2", async () => {
    const harness = makeHarness({
      stepStatus: "PENDING",
      executionEnabled: true,
    });

    await expect(
      outsourceRouter.createCaller(harness.ctx).createOrder({
        productionStepId: "step-outsource",
        vendorId: "vendor-1",
        description: "ส่งปักโลโก้",
        quantity: 10,
        unitCost: 0,
      }),
    ).rejects.toThrow("Production V2");
    expect(harness.log).not.toContain("write:outsource-create");
    expect(harness.log).not.toContain("write:step");
  });

  it("เปิดใบร้านบน current outsource step หลัง topology → all steps → production → order", async () => {
    const harness = makeHarness({ stepStatus: "PENDING" });

    await expect(outsourceRouter.createCaller(harness.ctx).createOrder({
      productionStepId: "step-outsource",
      vendorId: "vendor-1",
      description: "ส่งปักโลโก้",
      quantity: 10,
      unitCost: 0,
    })).resolves.toMatchObject({ id: "outsource-new" });

    expectProductionChainBefore(harness.log, "write:outsource-create");
    expect(harness.log.indexOf("write:step")).toBeGreaterThan(
      harness.log.indexOf("write:outsource-create"),
    );
    expect(harness.log.indexOf("write:audit")).toBeGreaterThan(
      harness.log.indexOf("write:step"),
    );
    expect(harness.step.status).toBe("IN_PROGRESS");
  });

  it.each([
    {
      label: "order พ้น PRODUCING",
      options: { orderStatus: "ON_HOLD" },
      message: "ไม่ได้อยู่สถานะกำลังผลิต",
    },
    {
      label: "service-managed DTF",
      options: { stepType: "DTF_PRINT" },
      message: "เฉพาะขั้นที่กำหนดให้ส่งร้านนอก",
    },
    {
      label: "FAILED exception",
      options: { stepStatus: "FAILED" },
      message: "มีปัญหาอยู่",
    },
    {
      label: "future step ใน lane เดียวกัน",
      options: {
        stepType: "DTG_PRINT",
        siblings: [
          { id: "dtg-before", stepType: "DTG_PRETREAT", status: "PENDING", sortOrder: 1 },
          { id: "step-outsource", stepType: "DTG_PRINT", status: "PENDING", sortOrder: 2 },
        ],
      },
      message: "ขั้นก่อนหน้า",
    },
  ])("ไม่เปิดใบร้านเมื่อ $label", async ({ options, message }) => {
    const harness = makeHarness({ ...options, stepStatus: options.stepStatus ?? "PENDING" });

    await expect(outsourceRouter.createCaller(harness.ctx).createOrder({
      productionStepId: "step-outsource",
      vendorId: "vendor-1",
      description: "ส่งร้าน",
      quantity: 1,
      unitCost: 0,
    })).rejects.toThrow(message);

    expect(harness.log).not.toContain("write:outsource-create");
    expect(harness.log).not.toContain("write:step");
    expect(harness.log).not.toContain("write:audit");
  });

  it("QC_PASSED ล็อก sibling PACKAGING ก่อน CAS/step/finalizer และ retry ไม่บวกซ้ำ", async () => {
    const harness = makeHarness({ outsourceStatus: "RECEIVED_BACK", stepStatus: "IN_PROGRESS" });
    serviceMocks.finalizeProductionIfComplete.mockImplementation(async () => {
      harness.log.push("finalize");
      return false;
    });

    await expect(outsourceRouter.createCaller(harness.ctx).updateOrderStatus({
      id: "outsource-1",
      status: "QC_PASSED",
      qcNotes: "ผ่าน",
    })).resolves.toMatchObject({ status: "QC_PASSED" });

    expectProductionChainBefore(harness.log, "write:outsource-status");
    expect(harness.log.indexOf("write:step")).toBeGreaterThan(
      harness.log.indexOf("write:outsource-status"),
    );
    expect(harness.log.indexOf("finalize")).toBeGreaterThan(
      harness.log.lastIndexOf("write:step"),
    );
    expect(harness.log.indexOf("write:audit")).toBeGreaterThan(
      harness.log.indexOf("finalize"),
    );
    expect(harness.step.qtyDone).toBe(10);

    await expect(outsourceRouter.createCaller(harness.ctx).updateOrderStatus({
      id: "outsource-1",
      status: "QC_PASSED",
    })).rejects.toThrow("เปลี่ยนเป็น");
    expect(harness.step.qtyDone).toBe(10);
    expect(serviceMocks.finalizeProductionIfComplete).toHaveBeenCalledOnce();
    expect(harness.tx.auditLog.create).toHaveBeenCalledOnce();
  });

  it("QC ไม่ทับ FAILED exception ของ legacy outsource record", async () => {
    const harness = makeHarness({
      outsourceStatus: "RECEIVED_BACK",
      stepStatus: "FAILED",
      stepType: "EMBROIDERY",
    });

    await expect(outsourceRouter.createCaller(harness.ctx).updateOrderStatus({
      id: "outsource-1",
      status: "QC_PASSED",
    })).rejects.toThrow("ถูกแจ้งปัญหา");

    expectProductionChainBefore(harness.log, "read:outsource-live");
    expect(harness.log).not.toContain("write:outsource-status");
    expect(harness.log).not.toContain("write:step");
    expect(serviceMocks.finalizeProductionIfComplete).not.toHaveBeenCalled();
    expect(harness.log).not.toContain("write:audit");
  });

  it("QC ไม่เดิน future outsource step ข้ามขั้นก่อนหน้าใน lane", async () => {
    const harness = makeHarness({
      outsourceStatus: "RECEIVED_BACK",
      stepStatus: "IN_PROGRESS",
      stepType: "DTG_PRINT",
      siblings: [
        { id: "dtg-before", stepType: "DTG_PRETREAT", status: "PENDING", sortOrder: 1 },
        { id: "step-outsource", stepType: "DTG_PRINT", status: "IN_PROGRESS", sortOrder: 2 },
      ],
    });

    await expect(outsourceRouter.createCaller(harness.ctx).updateOrderStatus({
      id: "outsource-1",
      status: "QC_PASSED",
    })).rejects.toThrow("ขั้นก่อนหน้า");
    expect(harness.log).not.toContain("write:outsource-status");
    expect(harness.log).not.toContain("write:step");
    expect(serviceMocks.finalizeProductionIfComplete).not.toHaveBeenCalled();
  });

  it("ยกเลิก draft หลัง split-round ผ่านบางส่วนแล้วไม่ถอย step เป็น PENDING", async () => {
    const harness = makeHarness({
      outsourceStatus: "DRAFT",
      stepStatus: "IN_PROGRESS",
      qtyDone: 4,
      remainingOrders: 0,
    });

    await expect(outsourceRouter.createCaller(harness.ctx).cancelDraftOrder({
      id: "outsource-1",
    })).resolves.toEqual({ ok: true });

    expectProductionChainBefore(harness.log, "write:outsource-delete");
    expect(harness.tx.productionStep.updateMany).not.toHaveBeenCalled();
    expect(harness.step.status).toBe("IN_PROGRESS");
    expect(harness.log.indexOf("write:audit")).toBeGreaterThan(
      harness.log.indexOf("write:outsource-delete"),
    );
  });

  it("ยกเลิก draft แรกที่ยังไม่มียอดและไม่มีใบค้างจึงคืน PENDING แบบมีเงื่อนไข", async () => {
    const harness = makeHarness({
      outsourceStatus: "DRAFT",
      stepStatus: "IN_PROGRESS",
      qtyDone: 0,
      remainingOrders: 0,
    });

    await outsourceRouter.createCaller(harness.ctx).cancelDraftOrder({ id: "outsource-1" });

    expect(harness.tx.productionStep.updateMany).toHaveBeenCalledWith({
      where: { id: "step-outsource", status: "IN_PROGRESS", qtyDone: 0 },
      data: { status: "PENDING" },
    });
    expect(harness.step.status).toBe("PENDING");
  });

  it("cancel draft ใช้ CAS จึงไม่ลบใบที่อีกจอส่งร้านไปแล้วระหว่างรอ", async () => {
    const harness = makeHarness({
      outsourceStatus: "DRAFT",
      stepStatus: "IN_PROGRESS",
      qtyDone: 0,
    });
    harness.tx.outsourceOrder.deleteMany.mockResolvedValueOnce({ count: 0 });

    await expect(outsourceRouter.createCaller(harness.ctx).cancelDraftOrder({
      id: "outsource-1",
    })).rejects.toMatchObject({ code: "CONFLICT" });

    expect(harness.tx.outsourceOrder.deleteMany).toHaveBeenCalledWith({
      where: { id: "outsource-1", status: "DRAFT" },
    });
    expect(harness.tx.productionStep.updateMany).not.toHaveBeenCalled();
    expect(harness.log).not.toContain("write:audit");
  });
});
