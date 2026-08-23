import { describe, expect, it, vi } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/prisma";

import {
  cancelPrintRun,
  completePrintRun,
  createPrintRun,
  markPrintRunPrinted,
} from "./print-run";

function harness() {
  const item = {
    id: "item-1",
    printRunId: "run-1",
    productionStepId: "operation-dtf-1",
    orderId: "order-1",
    qty: 10,
    extraQty: 0,
    qtyGood: 0,
    qtyScrap: 0,
    qtyReprint: 0,
    resultReportedAt: null,
    order: {
      id: "order-1",
      orderNumber: "ORD-1",
      title: "งาน DTF",
      customerId: "customer-1",
      internalStatus: "PRODUCING",
    },
    productionStep: {
      assignedToId: "worker-1",
      executionEnabled: true,
      workCenter: { code: "DTF_PRINT" },
    },
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    printRun: {
      findUnique: vi.fn().mockResolvedValue({
        items: [{ productionStepId: "operation-dtf-1" }],
      }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "run-1",
        runNumber: "FR-1",
        status: "PRINTED",
        createdById: "worker-1",
        items: [item],
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    productionStep: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "operation-dtf-1",
          productionId: "production-1",
          production: { orderId: "order-1" },
        },
      ]),
      findUnique: vi.fn().mockResolvedValue({
        id: "operation-dtf-1",
        productionId: "production-1",
        operationCode: "DTF_PRINT",
        operationState: "RUNNING",
        executionEnabled: true,
        workCenterId: "wc-dtf",
        assignedToId: "worker-1",
        qtyPlanned: 10,
        qtyGood: 0,
        qtyScrap: 0,
        qtyRework: 0,
        revision: 4,
        workCenter: { code: "DTF_PRINT", isActive: true },
        workResourceId: null,
        workResource: null,
        predecessorLinks: [],
        exceptions: [],
        production: {
          orderId: "order-1",
          workOrderState: "IN_PROGRESS",
          order: { internalStatus: "PRODUCING" },
        },
      }),
      update: vi.fn().mockResolvedValue({
        id: "operation-dtf-1",
        operationState: "RUNNING",
        qtyPlanned: 10,
        qtyGood: 8,
        qtyScrap: 2,
        qtyRework: 0,
        revision: 5,
      }),
    },
    workCenterMember: {
      findUnique: vi.fn().mockResolvedValue({ isActive: true }),
    },
    operationQuantity: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "quantity-line-1",
          productionStepId: "operation-dtf-1",
          qtyPlanned: 10,
          qtyGood: 0,
          qtyScrap: 0,
          qtyRework: 0,
        },
      ]),
      update: vi.fn().mockResolvedValue({ id: "quantity-line-1" }),
    },
    printRunItem: {
      update: vi.fn().mockResolvedValue({ id: "item-1" }),
    },
    operationEvent: { create: vi.fn().mockResolvedValue({ id: "event-1" }) },
    production: { update: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as ExtendedPrismaClient;
  return { prisma, tx };
}

function lifecycleHarness(options?: {
  itemCount?: number;
  staleItemIndex?: number;
  member?: boolean;
  operationState?: "READY" | "RUNNING" | "BLOCKED";
  hasBlockingException?: boolean;
  qtyGood?: number;
}) {
  const itemCount = options?.itemCount ?? 1;
  const state = { runStatus: "PRINTING" as "PRINTING" | "PRINTED" | "CANCELLED" };
  const operations = Array.from({ length: itemCount }, (_, index) => ({
    id: `operation-dtf-${index + 1}`,
    productionId: `production-${index + 1}`,
    operationCode: "DTF_PRINT",
    operationState: options?.operationState ?? "RUNNING" as
      | "READY"
      | "RUNNING"
      | "BLOCKED",
    executionEnabled: true,
    workCenterId: "wc-dtf",
    assignedToId: "worker-1",
    qtyPlanned: 10,
    qtyGood: options?.qtyGood ?? 0,
    qtyScrap: 0,
    qtyRework: 0,
    revision: index === options?.staleItemIndex ? 9 : 4,
    workCenter: { code: "DTF_PRINT", isActive: true },
    workResourceId: null,
    workResource: null,
    predecessorLinks: [],
    exceptions: options?.hasBlockingException ? [{ id: "exception-1" }] : [],
    production: {
      orderId: `order-${index + 1}`,
      workOrderState: "IN_PROGRESS",
      order: { internalStatus: "PRODUCING" },
    },
  }));
  const runItems = operations.map((operation, index) => ({
    id: `item-${index + 1}`,
    productionStepId: operation.id,
    order: {
      id: `order-${index + 1}`,
      orderNumber: `ORD-${index + 1}`,
      internalStatus: "PRODUCING",
    },
    productionStep: operation,
  }));
  const ledger = new Map<string, {
    requestHash: string;
    status: "PENDING" | "SUCCEEDED" | "FAILED";
    result: unknown;
    errorCode: string | null;
    errorMessage: string | null;
  }>();
  const lifecycleResultItems = () => runItems.map((item) => ({
    itemId: item.id,
    expectedRevision: 4,
  }));
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    printRun: {
      findUnique: vi.fn().mockImplementation(async () => ({
        items: runItems.map((item) => ({
          productionStepId: item.productionStepId,
        })),
      })),
      findUniqueOrThrow: vi.fn().mockImplementation(async () => ({
        id: "run-1",
        runNumber: "FR-1",
        createdById: "worker-1",
        status: state.runStatus,
        items: runItems,
      })),
      updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
        if (where.status !== state.runStatus) return { count: 0 };
        state.runStatus = data.status;
        return { count: 1 };
      }),
    },
    productionStep: {
      findMany: vi.fn().mockImplementation(async () =>
        operations.map((operation) => ({
          id: operation.id,
          productionId: operation.productionId,
          production: { orderId: operation.production.orderId },
        }))),
      findUnique: vi.fn().mockImplementation(async ({ where }) =>
        operations.find((operation) => operation.id === where.id) ?? null),
      update: vi.fn().mockImplementation(async ({ where, data }) => {
        const operation = operations.find((candidate) => candidate.id === where.id)!;
        if (data.operationState) operation.operationState = data.operationState;
        if (data.revision?.increment) operation.revision += data.revision.increment;
        return {
          id: operation.id,
          operationState: operation.operationState,
          qtyPlanned: operation.qtyPlanned,
          qtyGood: operation.qtyGood,
          qtyScrap: operation.qtyScrap,
          qtyRework: operation.qtyRework,
          revision: operation.revision,
        };
      }),
    },
    workCenterMember: {
      findUnique: vi.fn().mockResolvedValue(
        options?.member === false ? null : { isActive: true },
      ),
    },
    manufacturingCommand: {
      findUnique: vi.fn().mockImplementation(async ({ where }) =>
        ledger.get(where.commandId) ?? null),
      create: vi.fn().mockImplementation(async ({ data }) => {
        ledger.set(data.commandId, {
          requestHash: data.requestHash,
          status: "PENDING",
          result: null,
          errorCode: null,
          errorMessage: null,
        });
        return data;
      }),
      update: vi.fn().mockImplementation(async ({ where, data }) => {
        const current = ledger.get(where.commandId)!;
        ledger.set(where.commandId, { ...current, ...data });
        return ledger.get(where.commandId);
      }),
    },
    printRunItem: { count: vi.fn().mockResolvedValue(0) },
    operationEvent: { create: vi.fn().mockResolvedValue({ id: "event-1" }) },
    production: { update: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
      callback(tx)),
  } as unknown as ExtendedPrismaClient;
  return { prisma, tx, state, operations, lifecycleResultItems };
}

describe("DTF print-run V2 adapter", () => {
  it("flag off ปฏิเสธการปิด DTF batch V2 ก่อนเขียนผล", async () => {
    const { prisma, tx } = harness();
    vi.stubEnv("PRODUCTION_V2_ENABLED", "0");
    try {
      await expect(
        completePrintRun(prisma, {
          runId: "run-1",
          commandId: "dtf-flag-off-command-1",
          results: [{
            itemId: "item-1",
            expectedRevision: 4,
            qtyGood: 8,
            qtyScrap: 2,
            qtyReprint: 2,
            quantityLines: [
              { quantityLineId: "quantity-line-1", qtyGood: 8, qtyScrap: 2 },
            ],
          }],
          userId: "worker-1",
          canSupervise: false,
        }),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      expect(tx.printRun.updateMany).not.toHaveBeenCalled();
      expect(tx.printRunItem.update).not.toHaveBeenCalled();
      expect(tx.operationQuantity.update).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("flag off ปฏิเสธการสร้าง DTF batch V2 ก่อนเข้า transaction", async () => {
    vi.stubEnv("PRODUCTION_V2_ENABLED", "0");
    try {
      await expect(
        createPrintRun({} as ExtendedPrismaClient, {
          items: [{
            operationJobId: "operation-dtf-1",
            expectedRevision: 4,
            qty: 10,
          }],
          commandId: "dtf-create-flag-off-command-1",
          userId: "worker-1",
          canSupervise: false,
        }),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("ปิด batch ด้วย good/scrap/reprint และเพิ่ม Operation qty/event ตามผลจริง", async () => {
    const { prisma, tx } = harness();
    await completePrintRun(prisma, {
      runId: "run-1",
      commandId: "dtf-complete-command-1",
      results: [
        {
          itemId: "item-1",
          expectedRevision: 4,
          qtyGood: 8,
          qtyScrap: 2,
          qtyReprint: 2,
          quantityLines: [
            { quantityLineId: "quantity-line-1", qtyGood: 8, qtyScrap: 2 },
          ],
        },
      ],
      userId: "worker-1",
      canSupervise: false,
    });

    expect(tx.printRunItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: expect.objectContaining({
        qtyGood: 8,
        qtyScrap: 2,
        qtyReprint: 2,
        resultReportedAt: expect.any(Date),
      }),
    });
    expect(tx.productionStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qtyGood: { increment: 8 },
          qtyScrap: { increment: 2 },
        }),
      }),
    );
    expect(tx.operationQuantity.update).toHaveBeenCalledWith({
      where: { id: "quantity-line-1" },
      data: {
        qtyGood: { increment: 8 },
        qtyScrap: { increment: 2 },
        qtyRework: { increment: 0 },
        revision: { increment: 1 },
      },
    });
    expect(tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "OUTPUT_REPORTED",
        qtyGoodDelta: 8,
        qtyScrapDelta: 2,
      }),
    });
  });

  it("ปฏิเสธ good เกินเป้ารอบก่อนเขียนผล item/operation", async () => {
    const { prisma, tx } = harness();
    await expect(
      completePrintRun(prisma, {
        runId: "run-1",
        commandId: "dtf-complete-command-2",
        results: [
          {
            itemId: "item-1",
            expectedRevision: 4,
            qtyGood: 11,
            qtyScrap: 0,
            qtyReprint: 0,
            quantityLines: [
              { quantityLineId: "quantity-line-1", qtyGood: 11, qtyScrap: 0 },
            ],
          },
        ],
        userId: "worker-1",
        canSupervise: false,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(tx.printRunItem.update).not.toHaveBeenCalled();
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("ปฏิเสธผลรวม quantity line ที่ไม่ตรง aggregate ก่อนปิดรอบ", async () => {
    const { prisma, tx } = harness();
    await expect(
      completePrintRun(prisma, {
        runId: "run-1",
        commandId: "dtf-complete-command-3",
        results: [
          {
            itemId: "item-1",
            expectedRevision: 4,
            qtyGood: 8,
            qtyScrap: 2,
            qtyReprint: 1,
            quantityLines: [
              { quantityLineId: "quantity-line-1", qtyGood: 7, qtyScrap: 2 },
            ],
          },
        ],
        userId: "worker-1",
        canSupervise: false,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(tx.printRun.updateMany).not.toHaveBeenCalled();
    expect(tx.printRunItem.update).not.toHaveBeenCalled();
    expect(tx.operationQuantity.update).not.toHaveBeenCalled();
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("markPrinted อัปเดต run + revision/event และ retry command เดิมไม่เขียนซ้ำ", async () => {
    const harness = lifecycleHarness();
    const input = {
      runId: "run-1",
      commandId: "dtf-mark-printed-command-1",
      items: harness.lifecycleResultItems(),
      userId: "worker-1",
      canOperate: true,
      canSupervise: false,
    };

    const first = await markPrintRunPrinted(harness.prisma, input);
    const replay = await markPrintRunPrinted(harness.prisma, input);

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      runId: "run-1",
      status: "PRINTED",
      operations: [{
        operationJobId: "operation-dtf-1",
        operationState: "RUNNING",
        revision: 5,
      }],
    });
    expect(harness.state.runStatus).toBe("PRINTED");
    expect(harness.tx.printRun.updateMany).toHaveBeenCalledTimes(1);
    expect(harness.tx.productionStep.update).toHaveBeenCalledTimes(1);
    expect(harness.tx.operationEvent.create).toHaveBeenCalledTimes(1);
    expect(harness.tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "OUTPUT_REPORTED",
        fromState: "RUNNING",
        toState: "RUNNING",
        qtyGoodDelta: 0,
        payload: expect.objectContaining({ action: "PRINT_RUN_MARKED_PRINTED" }),
      }),
    });
    expect(harness.tx.manufacturingCommand.create).toHaveBeenCalledTimes(1);
    expect(harness.tx.manufacturingCommand.update).toHaveBeenCalledTimes(1);
  });

  it("markPrinted ตรวจ revision ของทุก item ก่อนเขียน run แบบ atomic", async () => {
    const harness = lifecycleHarness({ itemCount: 2, staleItemIndex: 1 });

    await expect(markPrintRunPrinted(harness.prisma, {
      runId: "run-1",
      commandId: "dtf-mark-stale-command-1",
      items: harness.lifecycleResultItems(),
      userId: "worker-1",
      canOperate: true,
      canSupervise: false,
    })).rejects.toMatchObject({ code: "CONFLICT" });

    expect(harness.tx.printRun.updateMany).not.toHaveBeenCalled();
    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
    expect(harness.tx.operationEvent.create).not.toHaveBeenCalled();
  });

  it("markPrinted บังคับส่ง revision ครบทุก item ใน batch", async () => {
    const harness = lifecycleHarness({ itemCount: 2 });

    await expect(markPrintRunPrinted(harness.prisma, {
      runId: "run-1",
      commandId: "dtf-mark-incomplete-command-1",
      items: [harness.lifecycleResultItems()[0]!],
      userId: "worker-1",
      canOperate: true,
      canSupervise: false,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(harness.tx.manufacturingCommand.create).not.toHaveBeenCalled();
    expect(harness.tx.printRun.updateMany).not.toHaveBeenCalled();
  });

  it("cancel คืน Operation ที่ยังไม่มียอดเป็น READY พร้อม revision/event และ retry ไม่ซ้ำ", async () => {
    const harness = lifecycleHarness();
    const input = {
      runId: "run-1",
      commandId: "dtf-cancel-command-1",
      items: harness.lifecycleResultItems(),
      userId: "worker-1",
      canOperate: true,
      canSupervise: false,
    };

    const first = await cancelPrintRun(harness.prisma, input);
    const replay = await cancelPrintRun(harness.prisma, input);

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      status: "CANCELLED",
      operations: [{ operationState: "READY", revision: 5 }],
    });
    expect(harness.operations[0]?.operationState).toBe("READY");
    expect(harness.tx.printRun.updateMany).toHaveBeenCalledTimes(1);
    expect(harness.tx.productionStep.update).toHaveBeenCalledTimes(1);
    expect(harness.tx.operationEvent.create).toHaveBeenCalledTimes(1);
    expect(harness.tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "CANCELLED",
        fromState: "RUNNING",
        toState: "READY",
      }),
    });
  });

  it("V2 lifecycle ปฏิเสธคนที่ไม่ใช่สมาชิก DTF ก่อนสร้าง ledger/เขียนสถานะ", async () => {
    const harness = lifecycleHarness({ member: false });

    await expect(cancelPrintRun(harness.prisma, {
      runId: "run-1",
      commandId: "dtf-cancel-no-member-1",
      items: harness.lifecycleResultItems(),
      userId: "worker-1",
      canOperate: true,
      canSupervise: false,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(harness.tx.manufacturingCommand.create).not.toHaveBeenCalled();
    expect(harness.tx.printRun.updateMany).not.toHaveBeenCalled();
    expect(harness.tx.operationEvent.create).not.toHaveBeenCalled();
  });
});
