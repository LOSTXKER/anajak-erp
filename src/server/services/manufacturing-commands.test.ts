import { describe, expect, it, vi } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import {
  assignManufacturingOperation,
  completeManufacturingOperation,
  decideQcDisposition,
  executeManufacturingCommand,
  pauseManufacturingOperation,
  planManufacturingRework,
  raiseManufacturingException,
  reportManufacturingOutput,
  resequenceManufacturingOperation,
  resolveManufacturingException,
  startManufacturingOperation,
  syncManufacturingOrderAfterCompletion,
} from "./manufacturing-commands";
import { hashManufacturingCommand } from "./manufacturing-command";

type LedgerRow = {
  commandType: string;
  requestHash: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  result: unknown;
  errorMessage: string | null;
};

function harness(params: {
  revision?: number;
  qtyGood?: number;
  qtyScrap?: number;
  qtyRework?: number;
  operationState?: "PLANNED" | "READY" | "RUNNING" | "BLOCKED" | "COMPLETED" | "CANCELLED";
  predecessorState?: "COMPLETED" | "CANCELLED";
  isWorkCenterMember?: boolean;
  workCenterCode?: string;
  workCenterActive?: boolean;
  operationCode?: string;
  workOrderState?: "DRAFT" | "RELEASED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  orderStatus?: "DESIGN_APPROVED" | "PRODUCTION_QUEUE" | "PRODUCING" | "QUALITY_CHECK" | "PACKING" | "ON_HOLD" | "CANCELLED" | "COMPLETED";
  quantityLineCount?: number;
  openReworkQty?: number;
  reworkCaseQty?: number;
  sourceQuantityLineId?: string | null;
  workResourceState?: "AVAILABLE" | "IN_USE" | "DOWN" | "INACTIVE";
  workResourceActive?: boolean;
  stepType?: "DTF_PRINT" | "GARMENT_PICK" | "GARMENT_RECEIVE";
  prepIssued?: number;
  prepReturned?: number;
} = {}) {
  const ledger = new Map<string, LedgerRow>();
  const operation = {
    id: "step-1",
    productionId: "production-1",
    operationCode:
      params.operationCode ?? params.workCenterCode ?? "HEAT_PRESS",
    operationName: "งานสถานี",
    operationState: params.operationState ?? "RUNNING",
    executionEnabled: true,
    workCenterId: "wc-operation",
    workCenter: {
      code: params.workCenterCode ?? "HEAT_PRESS",
      isActive: params.workCenterActive ?? true,
    },
    workResourceId:
      params.workResourceState !== undefined ||
      params.workResourceActive !== undefined
        ? "resource-1"
        : null,
    workResource:
      params.workResourceState !== undefined ||
      params.workResourceActive !== undefined
        ? {
            state: params.workResourceState ?? "AVAILABLE",
            isActive: params.workResourceActive ?? true,
          }
        : null,
    assignedToId: "worker-1",
    dispatchSequence: 1,
    qtyPlanned: 10,
    qtyGood: params.qtyGood ?? 8,
    qtyScrap: params.qtyScrap ?? 2,
    qtyRework: params.qtyRework ?? 0,
    revision: params.revision ?? 3,
    startedAt: new Date("2026-08-22T00:00:00.000Z"),
    completedAt: null,
    sortOrder: 1,
    stepType: params.stepType ?? "DTF_PRINT",
    predecessorLinks: params.predecessorState
      ? [{ predecessorStep: { id: "predecessor-1", operationState: params.predecessorState } }]
      : [],
    exceptions: [],
    production: {
      id: "production-1",
      orderId: "order-1",
      workOrderState: params.workOrderState ?? "IN_PROGRESS",
      revision: 2,
      order: { internalStatus: params.orderStatus ?? "PRODUCING" },
    },
  };
  let findStepCalls = 0;
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ lock_result: "" }]),
    manufacturingCommand: {
      findUnique: vi.fn(async ({ where }: { where: { commandId: string } }) =>
        ledger.get(where.commandId) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        ledger.set(String(data.commandId), {
          commandType: String(data.commandType),
          requestHash: String(data.requestHash),
          status: "PENDING",
          result: null,
          errorMessage: null,
        });
        return { id: "ledger-1" };
      }),
      update: vi.fn(async ({ where, data }: { where: { commandId: string }; data: Record<string, unknown> }) => {
        const current = ledger.get(where.commandId)!;
        ledger.set(where.commandId, {
          ...current,
          status: data.status as LedgerRow["status"],
          result: data.result,
        });
        return { id: "ledger-1" };
      }),
    },
    production: {
      findUnique: vi.fn().mockResolvedValue({ id: "production-1", orderId: "order-1" }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        orderId: "order-1",
        workOrderState: params.workOrderState ?? "IN_PROGRESS",
        revision: 2,
        order: { internalStatus: params.orderStatus ?? "PRODUCING" },
        completionOwnerStepId: "step-pack",
        steps: [
          {
            id: "step-1",
            operationCode: params.operationCode ?? params.workCenterCode ?? "HEAT_PRESS",
            operationState: "COMPLETED",
          },
          {
            id: "step-pack",
            operationCode: "FINAL_PACK",
            operationState: "READY",
          },
        ],
      }),
      update: vi.fn().mockResolvedValue({ id: "production-1" }),
    },
    productionStep: {
      findUnique: vi.fn(async () => {
        findStepCalls += 1;
        return findStepCalls % 2 === 1
          ? {
              id: "step-1",
              productionId: "production-1",
              production: { orderId: "order-1" },
            }
          : operation;
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) =>
        data.qtyGood
          ? {
              id: "step-1",
              operationState: "RUNNING",
              qtyPlanned: 10,
              qtyGood: operation.qtyGood + Number((data.qtyGood as { increment: number }).increment),
              qtyScrap:
                operation.qtyScrap + Number((data.qtyScrap as { increment: number }).increment),
              qtyRework:
                operation.qtyRework +
                ("increment" in (data.qtyRework as object)
                  ? Number((data.qtyRework as { increment: number }).increment)
                  : -Number((data.qtyRework as { decrement: number }).decrement)),
              revision: operation.revision + 1,
            }
          : {
              id: "step-1",
              assignedToId: data.assignedToId ?? operation.assignedToId,
              workResourceId: data.workResourceId ?? null,
              revision: operation.revision + 1,
            },
      ),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ isActive: true }) },
    order: {
      findUniqueOrThrow: vi.fn(async ({ select }: { select?: Record<string, unknown> }) =>
        select && "productionCompletionOwnerId" in select
          ? { productionCompletionOwnerId: "production-1" }
          : {
              id: "order-1",
              orderNumber: "ORD-001",
              orderType: "CUSTOM",
              internalStatus: params.orderStatus ?? "PRODUCING",
              stockReservationError: null,
              items: [
                {
                  products: [
                    {
                      itemSource: "FROM_STOCK",
                      productId: "product-1",
                      description: "เสื้อยืด",
                      variants: [
                        { size: "M", color: "ดำ", quantity: 10 },
                      ],
                    },
                  ],
                },
              ],
            },
      ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    orderRevision: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "order-revision-1" }),
    },
    product: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "product-1",
          sku: "TSHIRT",
          name: "เสื้อยืด",
          variants: [
            { id: "variant-m", sku: "TS-M", size: "M", color: "ดำ" },
          ],
        },
      ]),
    },
    materialUsage: {
      findMany: vi.fn().mockResolvedValue([
        ...(params.prepIssued
          ? [
              {
                productId: "product-1",
                productVariantId: "variant-m",
                quantity: params.prepIssued,
                movementType: "ISSUE",
              },
            ]
          : []),
        ...(params.prepReturned
          ? [
              {
                productId: "product-1",
                productVariantId: "variant-m",
                quantity: params.prepReturned,
                movementType: "RETURN",
              },
            ]
          : []),
      ]),
    },
    orderItemProduct: { findMany: vi.fn().mockResolvedValue([]) },
    goodsReceiptLine: { findMany: vi.fn().mockResolvedValue([]) },
    workCenter: { findUnique: vi.fn().mockResolvedValue({ isActive: true }) },
    workResource: {
      findUnique: vi.fn().mockResolvedValue({
        workCenterId: "wc-operation",
        isActive: true,
        state: "AVAILABLE",
      }),
    },
    workCenterMember: {
      findUnique: vi.fn().mockResolvedValue(
        params.isWorkCenterMember === false ? null : { isActive: true },
      ),
    },
    operationEvent: {
      create: vi.fn().mockResolvedValue({ id: "event-1" }),
      findFirst: vi.fn().mockResolvedValue({ fromState: "RUNNING" }),
    },
    operationJobDependency: { findMany: vi.fn().mockResolvedValue([]) },
    productionException: {
      create: vi.fn().mockResolvedValue({
        id: "exception-new",
        productionStepId: "step-1",
        severity: "WARNING",
        state: "OPEN",
        blocksJob: true,
        revision: 0,
      }),
      findUnique: vi.fn().mockResolvedValue({
        productionId: "production-1",
        productionStepId: "step-1",
        sourceQcDefectId: "qc-defect-1",
        state: "OPEN",
        disposition: "REWORK",
      }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "exception-1",
        productionId: "production-1",
        productionStepId: "step-1",
        state: "OPEN",
        blocksJob: true,
        disposition: "HOLD",
        revision: 4,
        sourceQcDefect: {
          id: "qc-defect-1",
          qty: 2,
          disposition: "HOLD",
          operationQuantityId: "pack-line-1",
          qcRecord: { productionStepId: "step-1" },
        },
      }),
      update: vi.fn().mockResolvedValue({ id: "exception-1" }),
      count: vi.fn().mockResolvedValue(0),
    },
    qcDefect: {
      findUnique: vi.fn().mockResolvedValue({
        qty: 2,
        disposition: "REWORK",
        operationQuantityId: "pack-line-1",
        qcRecordId: "qc-record-1",
        qcRecord: { productionStepId: "step-1" },
        reworkCase: null,
      }),
      update: vi.fn().mockResolvedValue({ id: "qc-defect-1" }),
    },
    operationQuantity: {
      count: vi
        .fn()
        .mockResolvedValue(
          params.quantityLineCount ??
            (params.workCenterCode === "FINAL_PACK" ? 1 : 0),
        ),
      findUnique: vi.fn().mockResolvedValue({
        id: "pack-line-1",
        productionStepId: "step-1",
        qtyPlanned: 10,
        qtyGood: params.qtyGood ?? 8,
        qtyScrap: params.qtyScrap ?? 0,
        qtyRework: params.qtyRework ?? 0,
        revision: 1,
      }),
      update: vi.fn().mockResolvedValue({ id: "pack-line-1" }),
    },
    reworkCase: {
      findUnique: vi.fn().mockResolvedValue({
        id: "rework-1",
        productionId: "production-1",
        sourceOperationId: "step-1",
        sourceQcDefect:
          params.sourceQuantityLineId === null
            ? null
            : {
                operationQuantityId:
                  params.sourceQuantityLineId ?? "pack-line-1",
              },
        state: "AWAITING_REINSPECTION",
        qty: params.reworkCaseQty ?? 3,
        revision: 2,
      }),
      aggregate: vi.fn().mockResolvedValue({
        _sum: { qty: params.openReworkQty ?? 0 },
      }),
      create: vi.fn().mockResolvedValue({
        id: "rework-new",
        state: "PLANNED",
        qty: 1,
        revision: 0,
      }),
      update: vi.fn().mockResolvedValue({ id: "rework-1" }),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
  } as unknown as ExtendedPrismaClient;
  return { prisma, tx, ledger };
}

const command = {
  commandId: "command-output-0001",
  expectedRevision: 3,
  actorId: "worker-1",
  operationJobId: "step-1",
  qtyGood: 2,
  qtyScrap: 0,
  qtyRework: 0,
};

describe("manufacturing command execution", () => {
  it("คืน JSON-safe result เดียวกันทั้งครั้งแรกและ retry", async () => {
    const { prisma } = harness();
    const input = {
      commandId: "json-safe-ledger-command-1",
      expectedRevision: 0,
      actorId: "worker-1",
    };
    const execute = vi.fn().mockResolvedValue({
      productionId: "production-1",
      productionStepId: "step-1",
      result: { occurredAt: new Date("2026-08-22T00:00:00.000Z") },
    });

    const first = await executeManufacturingCommand(
      prisma,
      "reportOutput",
      input,
      execute,
    );
    const replay = await executeManufacturingCommand(
      prisma,
      "reportOutput",
      input,
      execute,
    );

    expect(first).toEqual({ occurredAt: "2026-08-22T00:00:00.000Z" });
    expect(replay).toEqual(first);
    expect(execute).toHaveBeenCalledOnce();
  });

  it("decide HOLD → REWORK เพิ่ม exact line/aggregate แบบ atomic และ retry ไม่ซ้ำ", async () => {
    const { prisma, tx } = harness({
      operationCode: "FINAL_QC",
      workCenterCode: "FINAL_QC",
      operationState: "BLOCKED",
      qtyGood: 8,
      qtyScrap: 0,
      qtyRework: 0,
    });
    tx.qcDefect.update.mockResolvedValue({
      id: "qc-defect-1",
      disposition: "REWORK",
    });
    tx.operationQuantity.update.mockResolvedValue({
      id: "pack-line-1",
      qtyScrap: 0,
      qtyRework: 2,
      revision: 2,
    });
    tx.productionException.update.mockResolvedValue({
      id: "exception-1",
      state: "OPEN",
      disposition: "REWORK",
      revision: 5,
    });
    tx.productionStep.update.mockResolvedValue({
      id: "step-1",
      operationState: "BLOCKED",
      qtyPlanned: 10,
      qtyGood: 8,
      qtyScrap: 0,
      qtyRework: 2,
      revision: 4,
    });
    const input = {
      commandId: "qc-hold-rework-command-1",
      expectedRevision: 4,
      actorId: "manager-1",
      exceptionId: "exception-1",
      disposition: "REWORK" as const,
      note: "ส่งกลับรีดใหม่",
    };

    const first = await decideQcDisposition(prisma, input);
    const replay = await decideQcDisposition(prisma, input);

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      exception: { state: "OPEN", disposition: "REWORK", revision: 5 },
      defect: { disposition: "REWORK" },
      operation: { operationState: "BLOCKED", qtyRework: 2 },
      quantityLine: { id: "pack-line-1", qtyRework: 2 },
      qty: 2,
    });
    expect(tx.operationQuantity.update).toHaveBeenCalledOnce();
    expect(tx.operationQuantity.update).toHaveBeenCalledWith({
      where: { id: "pack-line-1" },
      data: {
        qtyRework: { increment: 2 },
        revision: { increment: 1 },
      },
      select: expect.any(Object),
    });
    expect(tx.productionStep.update).toHaveBeenCalledOnce();
    expect(tx.productionStep.update).toHaveBeenCalledWith({
      where: { id: "step-1" },
      data: expect.objectContaining({
        qtyRework: { increment: 2 },
        operationState: "BLOCKED",
        status: "ON_HOLD",
        revision: { increment: 1 },
      }),
      select: expect.any(Object),
    });
    expect(tx.operationEvent.create).toHaveBeenCalledOnce();
    expect(tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        commandId: input.commandId,
        eventType: "QC_RECORDED",
        qtyReworkDelta: 2,
        qtyScrapDelta: 0,
      }),
    });
  });

  it("decide HOLD → SCRAP เพิ่ม exact line/aggregate และ resolve blocker ก่อนคืน RUNNING", async () => {
    const { prisma, tx } = harness({
      operationCode: "FINAL_QC",
      workCenterCode: "FINAL_QC",
      operationState: "BLOCKED",
      qtyGood: 8,
      qtyScrap: 0,
      qtyRework: 0,
    });
    tx.qcDefect.update.mockResolvedValue({
      id: "qc-defect-1",
      disposition: "SCRAP",
    });
    tx.operationQuantity.update.mockResolvedValue({
      id: "pack-line-1",
      qtyScrap: 2,
      qtyRework: 0,
      revision: 2,
    });
    tx.productionException.update.mockResolvedValue({
      id: "exception-1",
      state: "RESOLVED",
      disposition: "SCRAP",
      revision: 5,
    });
    tx.productionStep.update.mockResolvedValue({
      id: "step-1",
      operationState: "RUNNING",
      qtyPlanned: 10,
      qtyGood: 8,
      qtyScrap: 2,
      qtyRework: 0,
      revision: 4,
    });

    const result = await decideQcDisposition(prisma, {
      commandId: "qc-hold-scrap-command-1",
      expectedRevision: 4,
      actorId: "manager-1",
      exceptionId: "exception-1",
      disposition: "SCRAP",
      note: "คัดทิ้ง",
    });

    expect(result).toMatchObject({
      exception: { state: "RESOLVED", disposition: "SCRAP" },
      defect: { disposition: "SCRAP" },
      operation: { operationState: "RUNNING", qtyScrap: 2 },
      quantityLine: { qtyScrap: 2 },
      qty: 2,
    });
    expect(tx.productionException.update).toHaveBeenCalledWith({
      where: { id: "exception-1" },
      data: expect.objectContaining({
        disposition: "SCRAP",
        state: "RESOLVED",
        resolution: "คัดทิ้ง",
        acknowledgedAt: expect.any(Date),
        resolvedAt: expect.any(Date),
        revision: { increment: 1 },
      }),
      select: expect.any(Object),
    });
    expect(tx.productionStep.update).toHaveBeenCalledWith({
      where: { id: "step-1" },
      data: expect.objectContaining({
        qtyScrap: { increment: 2 },
        operationState: "RUNNING",
        status: "IN_PROGRESS",
      }),
      select: expect.any(Object),
    });
    expect(tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "QC_RECORDED",
        qtyScrapDelta: 2,
        qtyReworkDelta: 0,
        toState: "RUNNING",
      }),
    });
  });

  it("decide QC HOLD ปฏิเสธ stale exception revision ก่อนเพิ่มจำนวน", async () => {
    const { prisma, tx } = harness({
      operationCode: "FINAL_QC",
      workCenterCode: "FINAL_QC",
      operationState: "BLOCKED",
    });
    await expect(
      decideQcDisposition(prisma, {
        commandId: "qc-hold-stale-command-1",
        expectedRevision: 3,
        actorId: "manager-1",
        exceptionId: "exception-1",
        disposition: "REWORK",
      }),
    ).rejects.toThrow("revision 4");
    expect(tx.qcDefect.update).not.toHaveBeenCalled();
    expect(tx.operationQuantity.update).not.toHaveBeenCalled();
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("generic resolve รับ QC SCRAP ที่ defect ตรงกันและไม่เพิ่ม qtyRework", async () => {
    const { prisma, tx } = harness({
      operationCode: "OUTSOURCE",
      workCenterCode: "OUTSOURCE",
      operationState: "BLOCKED",
      qtyGood: 8,
      qtyScrap: 2,
      qtyRework: 0,
    });
    tx.productionException.findUniqueOrThrow.mockResolvedValue({
      id: "exception-1",
      productionId: "production-1",
      productionStepId: "step-1",
      code: "QC_DEFECT:qc-defect-1",
      state: "OPEN",
      blocksJob: false,
      disposition: "SCRAP",
      revision: 4,
      sourceQcDefect: {
        disposition: "SCRAP",
        reworkCase: null,
      },
    });
    tx.productionException.update.mockResolvedValue({
      id: "exception-1",
      state: "RESOLVED",
      disposition: "SCRAP",
      resolution: "รับทราบของเสีย",
      resolvedAt: new Date("2026-08-22T03:00:00.000Z"),
      revision: 5,
    });

    await expect(
      resolveManufacturingException(prisma, {
        commandId: "resolve-qc-scrap-command-1",
        expectedRevision: 4,
        actorId: "manager-1",
        exceptionId: "exception-1",
        resolution: "รับทราบของเสีย",
      }),
    ).resolves.toMatchObject({ state: "RESOLVED", disposition: "SCRAP" });
    expect(tx.productionStep.update).not.toHaveBeenCalled();
    expect(tx.operationQuantity.update).not.toHaveBeenCalled();
    expect(tx.qcDefect.update).not.toHaveBeenCalled();
    expect(tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "EXCEPTION_RESOLVED",
        qtyReworkDelta: 0,
      }),
    });
  });

  it("resolve หลัง PlanRework ใช้ disposition REWORK เดิมได้โดย UI ไม่ต้องส่งซ้ำ", async () => {
    const { prisma, tx } = harness({
      operationCode: "FINAL_QC",
      workCenterCode: "FINAL_QC",
      operationState: "BLOCKED",
      qtyGood: 8,
      qtyRework: 2,
    });
    tx.productionException.findUniqueOrThrow.mockResolvedValue({
      id: "exception-1",
      productionId: "production-1",
      productionStepId: "step-1",
      code: "QC_DEFECT:qc-defect-1",
      state: "OPEN",
      blocksJob: true,
      disposition: "REWORK",
      revision: 4,
      sourceQcDefect: {
        disposition: "REWORK",
        reworkCase: { id: "rework-1" },
      },
    });
    tx.productionException.count.mockResolvedValue(1);
    tx.productionException.update.mockResolvedValue({
      id: "exception-1",
      state: "RESOLVED",
      disposition: "REWORK",
      resolution: "ส่งงานแก้แล้ว",
      resolvedAt: new Date("2026-08-22T04:00:00.000Z"),
      revision: 5,
    });

    await expect(
      resolveManufacturingException(prisma, {
        commandId: "resolve-qc-rework-command-1",
        expectedRevision: 4,
        actorId: "manager-1",
        exceptionId: "exception-1",
        resolution: "ส่งงานแก้แล้ว",
      }),
    ).resolves.toMatchObject({ state: "RESOLVED", disposition: "REWORK" });
    expect(tx.operationQuantity.update).not.toHaveBeenCalled();
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("มอบหมายได้เฉพาะ active member ของ Work Center แม้ผู้สั่งเป็น supervisor", async () => {
    const denied = harness({ isWorkCenterMember: false });
    await expect(
      assignManufacturingOperation(denied.prisma, {
        commandId: "assign-operation-command-1",
        expectedRevision: 3,
        actorId: "manager-1",
        operationJobId: "step-1",
        assigneeId: "worker-2",
      }),
    ).rejects.toThrow("ไม่ได้เป็นสมาชิกที่เปิดใช้งาน");
    expect(denied.tx.productionStep.update).not.toHaveBeenCalled();

    const allowed = harness();
    await expect(
      assignManufacturingOperation(allowed.prisma, {
        commandId: "assign-operation-command-2",
        expectedRevision: 3,
        actorId: "manager-1",
        operationJobId: "step-1",
        assigneeId: "worker-2",
      }),
    ).resolves.toMatchObject({ assignedToId: "worker-2" });
    expect(allowed.tx.workCenterMember.findUnique).toHaveBeenCalledWith({
      where: {
        workCenterId_userId: {
          workCenterId: "wc-operation",
          userId: "worker-2",
        },
      },
      select: { isActive: true },
    });
  });

  it.each(["COMPLETED", "CANCELLED"] as const)(
    "ใบผลิต %s ห้ามมอบหมายหรือจัดคิวใหม่",
    async (workOrderState) => {
      const assigned = harness({ workOrderState });
      await expect(
        assignManufacturingOperation(assigned.prisma, {
          commandId: `assign-closed-${workOrderState}`,
          expectedRevision: 3,
          actorId: "manager-1",
          operationJobId: "step-1",
          assigneeId: null,
        }),
      ).rejects.toThrow("จัดแผนต่อไม่ได้");
      expect(assigned.tx.productionStep.update).not.toHaveBeenCalled();
      expect(assigned.tx.operationEvent.create).not.toHaveBeenCalled();

      const resequenced = harness({ workOrderState });
      await expect(
        resequenceManufacturingOperation(resequenced.prisma, {
          commandId: `resequence-closed-${workOrderState}`,
          expectedRevision: 3,
          actorId: "manager-1",
          operationJobId: "step-1",
          dispatchSequence: 2,
        }),
      ).rejects.toThrow("จัดแผนต่อไม่ได้");
      expect(resequenced.tx.productionStep.update).not.toHaveBeenCalled();
      expect(resequenced.tx.operationEvent.create).not.toHaveBeenCalled();
    },
  );

  it.each(["ON_HOLD", "CANCELLED", "COMPLETED"] as const)(
    "ออเดอร์ %s ห้ามมอบหมายหรือจัดคิวใหม่",
    async (orderStatus) => {
      const assigned = harness({ orderStatus });
      await expect(
        assignManufacturingOperation(assigned.prisma, {
          commandId: `assign-order-${orderStatus}`,
          expectedRevision: 3,
          actorId: "manager-1",
          operationJobId: "step-1",
          assigneeId: null,
        }),
      ).rejects.toThrow("จัดแผนต่อไม่ได้");
      expect(assigned.tx.productionStep.update).not.toHaveBeenCalled();

      const resequenced = harness({ orderStatus });
      await expect(
        resequenceManufacturingOperation(resequenced.prisma, {
          commandId: `resequence-order-${orderStatus}`,
          expectedRevision: 3,
          actorId: "manager-1",
          operationJobId: "step-1",
          dispatchSequence: 2,
        }),
      ).rejects.toThrow("จัดแผนต่อไม่ได้");
      expect(resequenced.tx.productionStep.update).not.toHaveBeenCalled();
    },
  );

  it("จุดงานที่ปิดใช้งานห้ามมอบหมายและจัดคิวใหม่", async () => {
    const assigned = harness({ workCenterActive: false });
    await expect(
      assignManufacturingOperation(assigned.prisma, {
        commandId: "assign-inactive-center",
        expectedRevision: 3,
        actorId: "manager-1",
        operationJobId: "step-1",
        assigneeId: null,
      }),
    ).rejects.toThrow("จุดทำงานนี้ปิดใช้งาน");
    expect(assigned.tx.productionStep.update).not.toHaveBeenCalled();

    const resequenced = harness({ workCenterActive: false });
    await expect(
      resequenceManufacturingOperation(resequenced.prisma, {
        commandId: "resequence-inactive-center",
        expectedRevision: 3,
        actorId: "manager-1",
        operationJobId: "step-1",
        dispatchSequence: 2,
      }),
    ).rejects.toThrow("จุดทำงานนี้ปิดใช้งาน");
    expect(resequenced.tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("ใบผลิต DRAFT ที่แบบพร้อมยังมอบหมายและจัดคิวล่วงหน้าได้", async () => {
    const assigned = harness({
      workOrderState: "DRAFT",
      orderStatus: "DESIGN_APPROVED",
      operationState: "PLANNED",
    });
    await expect(
      assignManufacturingOperation(assigned.prisma, {
        commandId: "assign-draft-planning",
        expectedRevision: 3,
        actorId: "manager-1",
        operationJobId: "step-1",
        assigneeId: null,
      }),
    ).resolves.toMatchObject({ revision: 4 });

    const resequenced = harness({
      workOrderState: "DRAFT",
      orderStatus: "DESIGN_APPROVED",
      operationState: "PLANNED",
    });
    await expect(
      resequenceManufacturingOperation(resequenced.prisma, {
        commandId: "resequence-draft-planning",
        expectedRevision: 3,
        actorId: "manager-1",
        operationJobId: "step-1",
        dispatchSequence: 2,
      }),
    ).resolves.toMatchObject({ revision: 4 });
  });

  it("เปลี่ยนเครื่องเดิมที่ DOWN เป็นเครื่องใหม่ที่พร้อมได้", async () => {
    const { prisma, tx } = harness({
      workResourceState: "DOWN",
      workResourceActive: true,
    });
    await expect(
      assignManufacturingOperation(prisma, {
        commandId: "replace-down-resource",
        expectedRevision: 3,
        actorId: "manager-1",
        operationJobId: "step-1",
        workResourceId: "resource-new",
      }),
    ).resolves.toMatchObject({ workResourceId: "resource-new", revision: 4 });
    expect(tx.workResource.findUnique).toHaveBeenCalledWith({
      where: { id: "resource-new" },
      select: { workCenterId: true, isActive: true, state: true },
    });
  });

  it.each([
    ["ใบผลิตยกเลิก", { workOrderState: "CANCELLED" as const }],
    ["ออเดอร์พัก", { orderStatus: "ON_HOLD" as const }],
    ["จุดงานปิด", { workCenterActive: false }],
  ])("%s ห้ามเปิดปัญหาใหม่บนขั้นงาน", async (_label, scope) => {
    const { prisma, tx } = harness(scope);
    await expect(
      raiseManufacturingException(
        prisma,
        {
          commandId: `raise-inactive-${_label}`,
          expectedRevision: 3,
          actorId: "worker-1",
          workOrderId: "production-1",
          operationJobId: "step-1",
          category: "MATERIAL_SHORTAGE",
          title: "ของไม่ครบ",
          severity: "WARNING",
          blocksJob: true,
        },
        { canSupervise: true },
      ),
    ).rejects.toThrow(/ทำต่อไม่ได้|ปิดใช้งาน/);
    expect(tx.productionException.create).not.toHaveBeenCalled();
    expect(tx.productionStep.update).not.toHaveBeenCalled();
    expect(tx.operationEvent.create).not.toHaveBeenCalled();
  });

  it("ใบผลิตที่ยกเลิกแล้วห้ามเปิดปัญหาระดับทั้งใบ", async () => {
    const { prisma, tx } = harness({ workOrderState: "CANCELLED" });
    await expect(
      raiseManufacturingException(
        prisma,
        {
          commandId: "raise-cancelled-work-order",
          expectedRevision: 2,
          actorId: "manager-1",
          workOrderId: "production-1",
          category: "GENERAL",
          title: "ปัญหาทั่วไป",
          severity: "WARNING",
          blocksJob: false,
        },
        { canSupervise: true },
      ),
    ).rejects.toThrow("ทำต่อไม่ได้");
    expect(tx.productionException.create).not.toHaveBeenCalled();
    expect(tx.production.update).not.toHaveBeenCalled();
    expect(tx.operationEvent.create).not.toHaveBeenCalled();
  });

  it("พนักงานนอก Work Center สั่งงานไม่ได้ แต่ supervisor bypass ได้", async () => {
    const denied = harness({ isWorkCenterMember: false });
    await expect(
      reportManufacturingOutput(denied.prisma, command, {
        canSupervise: false,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(denied.tx.productionStep.update).not.toHaveBeenCalled();

    const supervisor = harness({ isWorkCenterMember: false });
    await expect(
      reportManufacturingOutput(supervisor.prisma, command, {
        canSupervise: true,
      }),
    ).resolves.toMatchObject({ qtyGood: 10 });
    expect(supervisor.tx.workCenterMember.findUnique).not.toHaveBeenCalled();
  });

  it("Final Pack บันทึก quantity line และใช้ PACK_RECORDED โดยไม่แตะ shipping", async () => {
    const { prisma, tx } = harness({ workCenterCode: "FINAL_PACK" });
    await reportManufacturingOutput(
      prisma,
      {
        ...command,
        commandId: "pack-output-command-1",
        quantityLines: [
          {
            quantityLineId: "pack-line-1",
            expectedRevision: 1,
            qtyGood: 2,
            qtyScrap: 0,
            qtyRework: 0,
          },
        ],
      },
      { canSupervise: false },
    );

    expect(tx.operationQuantity.update).toHaveBeenCalledWith({
      where: { id: "pack-line-1" },
      data: {
        qtyGood: { increment: 2 },
        qtyScrap: { increment: 0 },
        qtyRework: { increment: 0 },
        revision: { increment: 1 },
      },
    });
    expect(tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: "PACK_RECORDED" }),
    });
    expect("delivery" in tx).toBe(false);
  });

  it("ตรวจ rework บางส่วนไม่ปิดทั้ง case และลด qtyRework ทั้ง aggregate/line", async () => {
    const { prisma, tx } = harness({
      operationCode: "FINAL_QC",
      workCenterCode: "FINAL_QC",
      operationState: "READY",
      qtyGood: 8,
      qtyRework: 3,
      quantityLineCount: 1,
      reworkCaseQty: 3,
    });
    await reportManufacturingOutput(
      prisma,
      {
        commandId: "reinspect-partial-command-1",
        expectedRevision: 3,
        actorId: "worker-1",
        operationJobId: "step-1",
        qtyGood: 0,
        qtyScrap: 0,
        qtyRework: 0,
        quantityLines: [{
          quantityLineId: "pack-line-1",
          expectedRevision: 1,
          qtyGood: 2,
          qtyScrap: 0,
          qtyRework: 2,
        }],
        reworkResolution: {
          reworkCaseId: "rework-1",
          expectedRevision: 2,
          qty: 2,
          disposition: "GOOD",
        },
      },
      { canSupervise: false },
    );

    expect(tx.reworkCase.update).toHaveBeenCalledWith({
      where: { id: "rework-1" },
      data: {
        qty: 1,
        state: "AWAITING_REINSPECTION",
        reinspectedAt: expect.any(Date),
        revision: { increment: 1 },
      },
    });
    expect(tx.operationQuantity.update).toHaveBeenCalledWith({
      where: { id: "pack-line-1" },
      data: {
        qtyGood: { increment: 2 },
        qtyScrap: { increment: 0 },
        qtyRework: { decrement: 2 },
        revision: { increment: 1 },
      },
    });
    expect(tx.productionStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operationState: "RUNNING",
          qtyGood: { increment: 2 },
          qtyRework: { decrement: 2 },
        }),
      }),
    );
  });

  it("ตรวจซ้ำเกินจำนวนคงเหลือใน case ถูกปฏิเสธก่อนแก้ quantity", async () => {
    const { prisma, tx } = harness({
      operationCode: "FINAL_QC",
      workCenterCode: "FINAL_QC",
      qtyGood: 6,
      qtyRework: 4,
      quantityLineCount: 1,
      reworkCaseQty: 2,
    });
    await expect(
      reportManufacturingOutput(
        prisma,
        {
          commandId: "reinspect-over-case-command-1",
          expectedRevision: 3,
          actorId: "worker-1",
          operationJobId: "step-1",
          qtyGood: 0,
          qtyScrap: 0,
          qtyRework: 0,
          quantityLines: [{
            quantityLineId: "pack-line-1",
            expectedRevision: 1,
            qtyGood: 3,
            qtyScrap: 0,
            qtyRework: 3,
          }],
          reworkResolution: {
            reworkCaseId: "rework-1",
            expectedRevision: 2,
            qty: 3,
            disposition: "GOOD",
          },
        },
        { canSupervise: false },
      ),
    ).rejects.toThrow("เกินจำนวนคงเหลือใน Rework Case");
    expect(tx.reworkCase.update).not.toHaveBeenCalled();
    expect(tx.operationQuantity.update).not.toHaveBeenCalled();
  });

  it("ตรวจซ้ำ good 1 ปิด rework 1 และพา line จาก good 9 กลับครบ planned 10", async () => {
    const { prisma, tx } = harness({
      operationCode: "FINAL_QC",
      workCenterCode: "FINAL_QC",
      qtyGood: 9,
      qtyRework: 1,
      quantityLineCount: 1,
      reworkCaseQty: 1,
    });
    const result = await reportManufacturingOutput(
      prisma,
      {
        commandId: "reinspect-to-planned-command-1",
        expectedRevision: 3,
        actorId: "worker-1",
        operationJobId: "step-1",
        qtyGood: 0,
        qtyScrap: 0,
        qtyRework: 0,
        quantityLines: [{
          quantityLineId: "pack-line-1",
          expectedRevision: 1,
          qtyGood: 1,
          qtyScrap: 0,
          qtyRework: 1,
        }],
        reworkResolution: {
          reworkCaseId: "rework-1",
          expectedRevision: 2,
          qty: 1,
          disposition: "GOOD",
        },
      },
      { canSupervise: false },
    );

    expect(result).toMatchObject({ qtyGood: 10, qtyRework: 0 });
    expect(tx.reworkCase.update).toHaveBeenCalledWith({
      where: { id: "rework-1" },
      data: expect.objectContaining({
        qty: 0,
        state: "COMPLETED",
        completedAt: expect.any(Date),
      }),
    });
    expect(tx.operationQuantity.update).toHaveBeenCalledWith({
      where: { id: "pack-line-1" },
      data: {
        qtyGood: { increment: 1 },
        qtyScrap: { increment: 0 },
        qtyRework: { decrement: 1 },
        revision: { increment: 1 },
      },
    });
  });

  it("ตรวจซ้ำต้องลง quantity line เดียวกับ QcDefect ต้นทาง", async () => {
    const { prisma, tx } = harness({
      operationCode: "FINAL_QC",
      workCenterCode: "FINAL_QC",
      qtyGood: 8,
      qtyRework: 2,
      quantityLineCount: 1,
      reworkCaseQty: 2,
      sourceQuantityLineId: "source-line-1",
    });

    await expect(
      reportManufacturingOutput(
        prisma,
        {
          commandId: "reinspect-wrong-line-command-1",
          expectedRevision: 3,
          actorId: "worker-1",
          operationJobId: "step-1",
          qtyGood: 0,
          qtyScrap: 0,
          qtyRework: 0,
          quantityLines: [{
            quantityLineId: "pack-line-1",
            expectedRevision: 1,
            qtyGood: 2,
            qtyScrap: 0,
            qtyRework: 2,
          }],
          reworkResolution: {
            reworkCaseId: "rework-1",
            expectedRevision: 2,
            qty: 2,
            disposition: "GOOD",
          },
        },
        { canSupervise: false },
      ),
    ).rejects.toThrow("quantity line เดียวกับของเสียต้นทาง");
    expect(tx.reworkCase.update).not.toHaveBeenCalled();
    expect(tx.operationQuantity.update).not.toHaveBeenCalled();
  });

  it("plan rework หัก case ที่ยังเปิดอยู่ก่อนรับ allocation ใหม่", async () => {
    const { prisma, tx } = harness({ qtyRework: 5, openReworkQty: 4 });
    await expect(
      planManufacturingRework(prisma, {
        commandId: "plan-rework-over-available-1",
        expectedRevision: 3,
        actorId: "manager-1",
        workOrderId: "production-1",
        sourceOperationJobId: "step-1",
        targetWorkCenterId: "wc-rework",
        qty: 2,
        reason: "รีดซ้ำ",
      }),
    ).rejects.toThrow("เกินยอดรอแก้ที่ยังไม่ได้วางแผน");
    expect(tx.reworkCase.create).not.toHaveBeenCalled();
  });

  it("plan rework จาก QC exception สืบ source defect และ quantity line ต่อโดยไม่ parse code", async () => {
    const { prisma, tx } = harness({
      qtyRework: 2,
      operationCode: "FINAL_QC",
      workCenterCode: "FINAL_QC",
    });
    await planManufacturingRework(prisma, {
      commandId: "plan-rework-from-exception-1",
      expectedRevision: 3,
      actorId: "manager-1",
      workOrderId: "production-1",
      sourceOperationJobId: "step-1",
      qcDefectId: "qc-defect-1",
      sourceExceptionId: "exception-1",
      targetWorkCenterId: "wc-rework",
      qty: 2,
      reason: "รีดซ้ำ",
    });

    expect(tx.reworkCase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceQcRecordId: "qc-record-1",
        sourceQcDefectId: "qc-defect-1",
        sourceExceptionId: "exception-1",
      }),
      select: expect.any(Object),
    });
    expect(tx.productionException.update).toHaveBeenCalledWith({
      where: { id: "exception-1" },
      data: {
        disposition: "REWORK",
        sourceQcDefectId: "qc-defect-1",
        revision: { increment: 1 },
      },
    });
  });

  it("QC rework ปฏิเสธ orphan/partial case ที่ไม่มี source ครบหรือแบ่ง defect ค้าง", async () => {
    const missingSource = harness({
      qtyRework: 2,
      operationCode: "FINAL_QC",
      workCenterCode: "FINAL_QC",
    });
    await expect(
      planManufacturingRework(missingSource.prisma, {
        commandId: "plan-qc-orphan-1",
        expectedRevision: 3,
        actorId: "manager-1",
        workOrderId: "production-1",
        sourceOperationJobId: "step-1",
        targetWorkCenterId: "wc-rework",
        qty: 2,
        reason: "รีดซ้ำ",
      }),
    ).rejects.toThrow("ต้องระบุทั้งของเสียและปัญหาต้นทาง");
    expect(missingSource.tx.reworkCase.create).not.toHaveBeenCalled();

    const outsourceMissingSource = harness({
      qtyRework: 2,
      operationCode: "OUTSOURCE",
      workCenterCode: "OUTSOURCE",
    });
    await expect(
      planManufacturingRework(outsourceMissingSource.prisma, {
        commandId: "plan-outsource-orphan-1",
        expectedRevision: 3,
        actorId: "manager-1",
        workOrderId: "production-1",
        sourceOperationJobId: "step-1",
        targetWorkCenterId: "wc-rework",
        qty: 2,
        reason: "แก้งานร้านนอก",
      }),
    ).rejects.toThrow("ต้องระบุทั้งของเสียและปัญหาต้นทาง");
    expect(outsourceMissingSource.tx.reworkCase.create).not.toHaveBeenCalled();

    const partial = harness({
      qtyRework: 2,
      operationCode: "FINAL_QC",
      workCenterCode: "FINAL_QC",
    });
    await expect(
      planManufacturingRework(partial.prisma, {
        commandId: "plan-qc-partial-1",
        expectedRevision: 3,
        actorId: "manager-1",
        workOrderId: "production-1",
        sourceOperationJobId: "step-1",
        qcDefectId: "qc-defect-1",
        sourceExceptionId: "exception-1",
        targetWorkCenterId: "wc-rework",
        qty: 1,
        reason: "รีดซ้ำบางส่วน",
      }),
    ).rejects.toThrow("ต้องวางแผนเต็มจำนวน");
    expect(partial.tx.reworkCase.create).not.toHaveBeenCalled();

    const outsourcePartial = harness({
      qtyRework: 2,
      operationCode: "OUTSOURCE",
      workCenterCode: "OUTSOURCE",
    });
    await expect(
      planManufacturingRework(outsourcePartial.prisma, {
        commandId: "plan-outsource-partial-1",
        expectedRevision: 3,
        actorId: "manager-1",
        workOrderId: "production-1",
        sourceOperationJobId: "step-1",
        qcDefectId: "qc-defect-1",
        sourceExceptionId: "exception-1",
        targetWorkCenterId: "wc-rework",
        qty: 1,
        reason: "แก้งานร้านนอกบางส่วน",
      }),
    ).rejects.toThrow("ต้องวางแผนเต็มจำนวน");
    expect(outsourcePartial.tx.reworkCase.create).not.toHaveBeenCalled();
  });

  it("งานที่มี quantity line ห้ามส่งยอดรวมอย่างเดียว", async () => {
    const { prisma, tx } = harness({ quantityLineCount: 1 });
    await expect(
      reportManufacturingOutput(prisma, command, { canSupervise: false }),
    ).rejects.toThrow("แยกตามสินค้า สี ไซซ์ และจุดพิมพ์");
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("generic report รับเฉพาะ good — scrap/rework ต้องผ่าน QC disposition", async () => {
    const { prisma, tx } = harness();
    await expect(
      reportManufacturingOutput(
        prisma,
        {
          ...command,
          commandId: "generic-scrap-command-1",
          qtyGood: 0,
          qtyScrap: 1,
        },
        { canSupervise: false },
      ),
    ).rejects.toThrow("ต้องบันทึกผ่าน QC พร้อม disposition");
    expect(tx.productionStep.update).not.toHaveBeenCalled();
    expect(tx.operationEvent.create).not.toHaveBeenCalled();
  });


  it("Heat Press เดิน qtyGood ถึงเป้าได้แม้มี scrap เดิม และเขียน event ใน transaction", async () => {
    const { prisma, tx } = harness();
    await expect(
      reportManufacturingOutput(prisma, command, { canSupervise: false }),
    ).resolves.toMatchObject({ qtyGood: 10, qtyScrap: 2, revision: 4 });

    expect(tx.productionStep.update).toHaveBeenCalledOnce();
    expect(tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        commandId: command.commandId,
        eventType: "OUTPUT_REPORTED",
        qtyGoodDelta: 2,
      }),
    });
    expect(tx.manufacturingCommand.update).toHaveBeenCalledWith({
      where: { commandId: command.commandId },
      data: expect.objectContaining({ status: "SUCCEEDED" }),
    });
  });

  it("DTF ต้องบันทึกผ่าน Print Run ห้ามกรอกยอดหรือเริ่มแบบทั่วไป", async () => {
    const report = harness({ operationCode: "DTF_PRINT", workCenterCode: "DTF_PRINT" });
    await expect(
      reportManufacturingOutput(report.prisma, command, { canSupervise: false }),
    ).rejects.toThrow("รอบพิมพ์ DTF");
    expect(report.tx.productionStep.update).not.toHaveBeenCalled();

    const start = harness({
      operationCode: "DTF_PRINT",
      workCenterCode: "DTF_PRINT",
      operationState: "READY",
    });
    await expect(
      startManufacturingOperation(
        start.prisma,
        {
          commandId: "command-dtf-start-specialized",
          expectedRevision: 3,
          actorId: "worker-1",
          operationJobId: "step-1",
        },
        { canSupervise: false },
      ),
    ).rejects.toThrow("รอบพิมพ์ DTF");
  });

  it("ใช้ completion owner ที่กำหนดไว้ล่วงหน้าและปฏิเสธ Work Order อื่น", async () => {
    const productionRows = {
      "production-1": {
        orderId: "order-1",
        workOrderState: "IN_PROGRESS",
        completionOwnerStepId: "pack-1",
        steps: [
          { id: "step-1", operationCode: "OTHER", operationState: "COMPLETED" },
          { id: "pack-1", operationCode: "FINAL_PACK", operationState: "COMPLETED" },
        ],
      },
      "production-2": {
        orderId: "order-1",
        workOrderState: "IN_PROGRESS",
        completionOwnerStepId: "pack-2",
        steps: [
          { id: "step-2", operationCode: "OTHER", operationState: "COMPLETED" },
          { id: "pack-2", operationCode: "FINAL_PACK", operationState: "COMPLETED" },
        ],
      },
    } as const;
    const productionUpdate = vi.fn().mockResolvedValue({});
    const tx = {
      production: {
        findUniqueOrThrow: vi.fn(
          async ({ where }: { where: { id: keyof typeof productionRows } }) =>
            productionRows[where.id],
        ),
        update: productionUpdate,
      },
      order: {
        findUniqueOrThrow: vi.fn(async () => ({
          productionCompletionOwnerId: "production-1",
        })),
      },
    };

    await syncManufacturingOrderAfterCompletion(
      tx as never,
      { id: "step-1", productionId: "production-1", operationCode: "OTHER" },
      "manager-1",
    );
    await expect(
      syncManufacturingOrderAfterCompletion(
        tx as never,
        { id: "step-2", productionId: "production-2", operationCode: "OTHER" },
        "manager-1",
      ),
    ).rejects.toThrow("เจ้าของการปิดงานที่แน่นอน");

    expect(productionUpdate).toHaveBeenCalledOnce();
    expect(productionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "production-1" },
        data: expect.objectContaining({ completionOwnerStepId: "pack-1" }),
      }),
    );
  });

  it("ไม่ยืนยันพร้อมส่งเมื่อ Final Pack จบแต่ยังมีสายงานอื่นค้าง", async () => {
    const productionUpdate = vi.fn();
    const tx = {
      production: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          orderId: "order-1",
          workOrderState: "IN_PROGRESS",
          completionOwnerStepId: "pack-1",
          steps: [
            {
              id: "lane-a",
              operationCode: "OUTSOURCE",
              operationState: "RUNNING",
            },
            {
              id: "pack-1",
              operationCode: "FINAL_PACK",
              operationState: "COMPLETED",
            },
          ],
        }),
        update: productionUpdate,
      },
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          productionCompletionOwnerId: "production-1",
        }),
      },
    };

    await expect(
      syncManufacturingOrderAfterCompletion(
        tx as never,
        {
          id: "pack-1",
          productionId: "production-1",
          operationCode: "FINAL_PACK",
        },
        "worker-1",
      ),
    ).rejects.toThrow("ยังมีขั้นงานที่ไม่เสร็จ");

    expect(productionUpdate).not.toHaveBeenCalled();
  });

  it("retry commandId เดิมคืนผลเดิมและไม่เพิ่ม qty/event ซ้ำ", async () => {
    const { prisma, tx } = harness();
    const first = await reportManufacturingOutput(prisma, command, { canSupervise: false });
    const second = await reportManufacturingOutput(prisma, command, { canSupervise: false });

    expect(second).toEqual(first);
    expect(tx.productionStep.update).toHaveBeenCalledOnce();
    expect(tx.operationEvent.create).toHaveBeenCalledOnce();
  });

  it("commandId เดิมกับ payload คนละชุดถูกปฏิเสธก่อน side effect", async () => {
    const { prisma, tx, ledger } = harness();
    ledger.set(command.commandId, {
      commandType: "reportOutput",
      requestHash: hashManufacturingCommand({
        commandType: "reportOutput",
        expectedRevision: 3,
        actorId: "worker-1",
        payload: { ...command, qtyGood: 1 },
      }),
      status: "SUCCEEDED",
      result: { id: "old" },
      errorMessage: null,
    });

    await expect(
      reportManufacturingOutput(prisma, command, { canSupervise: false }),
    ).rejects.toThrow("commandId นี้ถูกใช้กับคำสั่งคนละชุดข้อมูลแล้ว");
    expect(tx.productionStep.update).not.toHaveBeenCalled();
    expect(tx.operationEvent.create).not.toHaveBeenCalled();
  });

  it("expectedRevision เก่าถูกปฏิเสธก่อนเขียน output", async () => {
    const { prisma, tx } = harness({ revision: 4 });
    await expect(
      reportManufacturingOutput(prisma, command, { canSupervise: false }),
    ).rejects.toThrow("ถูกอัปเดตจากอีกจอแล้ว");
    expect(tx.productionStep.update).not.toHaveBeenCalled();
    expect(tx.operationEvent.create).not.toHaveBeenCalled();
  });

  it("startOperation ปฏิเสธงาน READY เมื่อ predecessor ถูก CANCELLED", async () => {
    const { prisma, tx } = harness({
      operationState: "READY",
      predecessorState: "CANCELLED",
    });
    await expect(
      startManufacturingOperation(
        prisma,
        {
          commandId: "command-start-cancelled-predecessor",
          expectedRevision: 3,
          actorId: "worker-1",
          operationJobId: "step-1",
        },
        { canSupervise: false },
      ),
    ).rejects.toThrow("ขั้นก่อนหน้ายังไม่เสร็จ");
    expect(tx.productionStep.update).not.toHaveBeenCalled();
    expect(tx.operationEvent.create).not.toHaveBeenCalled();
  });

  it("start/report/complete ไม่เดินต่อเมื่อออเดอร์พัก ยกเลิก หรือใบผลิตปิดแล้ว", async () => {
    const start = harness({ operationState: "READY", orderStatus: "ON_HOLD" });
    await expect(
      startManufacturingOperation(
        start.prisma,
        {
          commandId: "command-start-held-order",
          expectedRevision: 3,
          actorId: "worker-1",
          operationJobId: "step-1",
        },
        { canSupervise: false },
      ),
    ).rejects.toThrow("ถูกพัก ยกเลิก หรือปิดแล้ว");
    expect(start.tx.productionStep.update).not.toHaveBeenCalled();
    expect(start.tx.operationEvent.create).not.toHaveBeenCalled();

    const report = harness({ orderStatus: "CANCELLED" });
    await expect(
      reportManufacturingOutput(report.prisma, command, { canSupervise: false }),
    ).rejects.toThrow("ถูกพัก ยกเลิก หรือปิดแล้ว");
    expect(report.tx.productionStep.update).not.toHaveBeenCalled();
    expect(report.tx.operationEvent.create).not.toHaveBeenCalled();

    const complete = harness({ workOrderState: "COMPLETED" });
    await expect(
      completeManufacturingOperation(
        complete.prisma,
        {
          commandId: "command-complete-closed-work-order",
          expectedRevision: 3,
          actorId: "worker-1",
          operationJobId: "step-1",
        },
        { canSupervise: false },
      ),
    ).rejects.toThrow("ถูกพัก ยกเลิก หรือปิดแล้ว");
    expect(complete.tx.productionStep.update).not.toHaveBeenCalled();
    expect(complete.tx.operationEvent.create).not.toHaveBeenCalled();
  });

  it("คำสั่งเดินงานและบันทึกผลปฏิเสธ Work Center ที่ปิดใช้งาน", async () => {
    const start = harness({
      operationState: "READY",
      workCenterActive: false,
    });
    await expect(
      startManufacturingOperation(
        start.prisma,
        {
          commandId: "command-start-inactive-center",
          expectedRevision: 3,
          actorId: "worker-1",
          operationJobId: "step-1",
        },
        { canSupervise: false },
      ),
    ).rejects.toThrow("จุดทำงานนี้ปิดใช้งานอยู่");
    expect(start.tx.productionStep.update).not.toHaveBeenCalled();

    const report = harness({ workCenterActive: false });
    await expect(
      reportManufacturingOutput(
        report.prisma,
        { ...command, commandId: "command-report-inactive-center" },
        { canSupervise: false },
      ),
    ).rejects.toThrow("จุดทำงานนี้ปิดใช้งานอยู่");
    expect(report.tx.productionStep.update).not.toHaveBeenCalled();
    expect(report.tx.operationEvent.create).not.toHaveBeenCalled();
  });

  it.each([
    ["DOWN", true],
    ["INACTIVE", true],
    ["AVAILABLE", false],
  ] as const)(
    "startOperation ปฏิเสธเครื่อง state=%s active=%s",
    async (workResourceState, workResourceActive) => {
      const { prisma, tx } = harness({
        operationState: "READY",
        workResourceState,
        workResourceActive,
      });
      await expect(
        startManufacturingOperation(
          prisma,
          {
            commandId: `command-start-resource-${workResourceState}-${workResourceActive}`,
            expectedRevision: 3,
            actorId: "worker-1",
            operationJobId: "step-1",
          },
          { canSupervise: false },
        ),
      ).rejects.toThrow("เครื่องหรืออุปกรณ์ที่เลือกไม่พร้อมใช้งาน");
      expect(tx.productionStep.update).not.toHaveBeenCalled();
      expect(tx.operationEvent.create).not.toHaveBeenCalled();
    },
  );

  it("QC disposition และ plan rework ไม่เดินบน parent หรือ Work Center ที่ inactive", async () => {
    const qc = harness({
      operationCode: "FINAL_QC",
      workCenterCode: "FINAL_QC",
      operationState: "BLOCKED",
      orderStatus: "ON_HOLD",
    });
    await expect(
      decideQcDisposition(qc.prisma, {
        commandId: "qc-disposition-held-parent",
        expectedRevision: 4,
        actorId: "manager-1",
        exceptionId: "exception-1",
        disposition: "SCRAP",
      }),
    ).rejects.toThrow("ถูกพัก ยกเลิก หรือปิดแล้ว");
    expect(qc.tx.qcDefect.update).not.toHaveBeenCalled();
    expect(qc.tx.operationQuantity.update).not.toHaveBeenCalled();
    expect(qc.tx.productionException.update).not.toHaveBeenCalled();
    expect(qc.tx.operationEvent.create).not.toHaveBeenCalled();

    const rework = harness({
      qtyRework: 2,
      workCenterActive: false,
    });
    await expect(
      planManufacturingRework(rework.prisma, {
        commandId: "plan-rework-inactive-center",
        expectedRevision: 3,
        actorId: "manager-1",
        workOrderId: "production-1",
        sourceOperationJobId: "step-1",
        targetWorkCenterId: "wc-rework",
        qty: 1,
        reason: "แก้งาน",
      }),
    ).rejects.toThrow("จุดทำงานนี้ปิดใช้งานอยู่");
    expect(rework.tx.reworkCase.create).not.toHaveBeenCalled();
    expect(rework.tx.operationEvent.create).not.toHaveBeenCalled();

    const closedParent = harness({
      qtyRework: 2,
      workOrderState: "CANCELLED",
    });
    await expect(
      planManufacturingRework(closedParent.prisma, {
        commandId: "plan-rework-cancelled-parent",
        expectedRevision: 3,
        actorId: "manager-1",
        workOrderId: "production-1",
        sourceOperationJobId: "step-1",
        targetWorkCenterId: "wc-rework",
        qty: 1,
        reason: "แก้งาน",
      }),
    ).rejects.toThrow("ถูกพัก ยกเลิก หรือปิดแล้ว");
    expect(closedParent.tx.reworkCase.create).not.toHaveBeenCalled();
    expect(closedParent.tx.operationEvent.create).not.toHaveBeenCalled();
  });

  it("ยังพักงานที่กำลังทำได้เมื่อออเดอร์ถูกพัก เพื่อให้หน้างานหยุดอย่างปลอดภัย", async () => {
    const paused = harness({ operationState: "RUNNING", orderStatus: "ON_HOLD" });

    await expect(
      pauseManufacturingOperation(
        paused.prisma,
        {
          commandId: "command-pause-held-order",
          expectedRevision: 3,
          actorId: "worker-1",
          operationJobId: "step-1",
          reason: "หยุดตามคำสั่งหัวหน้า",
        },
        { canSupervise: false },
      ),
    ).resolves.toMatchObject({ id: "step-1" });
    expect(paused.tx.productionStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { operationState: "READY", revision: { increment: 1 } },
      }),
    );
    expect(paused.tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: "PAUSED" }),
    });
  });

  it("PREP ต้องคืนเสื้อส่วนเกินก่อนปิดงาน แม้ยอดดีครบแผนแล้ว", async () => {
    const outstanding = harness({
      operationCode: "PREP",
      workCenterCode: "PREP",
      stepType: "GARMENT_PICK",
      operationState: "RUNNING",
      qtyGood: 10,
      qtyScrap: 0,
      qtyRework: 0,
      prepIssued: 13,
      prepReturned: 0,
    });

    await expect(
      completeManufacturingOperation(
        outstanding.prisma,
        {
          commandId: "complete-prep-with-surplus",
          expectedRevision: 3,
          actorId: "worker-1",
          operationJobId: "step-1",
        },
        { canSupervise: false },
      ),
    ).rejects.toThrow("ยังมีเสื้อส่วนเกินค้างอยู่ 3 ตัว");
    expect(outstanding.tx.productionStep.update).not.toHaveBeenCalled();
    expect(outstanding.tx.operationEvent.create).not.toHaveBeenCalled();

    const returned = harness({
      operationCode: "PREP",
      workCenterCode: "PREP",
      stepType: "GARMENT_PICK",
      operationState: "RUNNING",
      qtyGood: 10,
      qtyScrap: 0,
      qtyRework: 0,
      prepIssued: 13,
      prepReturned: 3,
    });
    await expect(
      completeManufacturingOperation(
        returned.prisma,
        {
          commandId: "complete-prep-after-surplus-return",
          expectedRevision: 3,
          actorId: "worker-1",
          operationJobId: "step-1",
        },
        { canSupervise: false },
      ),
    ).resolves.toMatchObject({ id: "step-1" });
    expect(returned.tx.productionStep.update).toHaveBeenCalledWith({
      where: { id: "step-1" },
      data: expect.objectContaining({
        operationState: "COMPLETED",
        status: "COMPLETED",
      }),
      select: expect.any(Object),
    });
    expect(returned.tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: "COMPLETED" }),
    });
  });

  it("qtyGood เกินเป้าถูกปฏิเสธ แต่ scrap history ไม่ตัดสิทธิ์ reprint", async () => {
    const { prisma, tx } = harness({ qtyGood: 9, qtyScrap: 8 });
    await expect(
      reportManufacturingOutput(prisma, command, { canSupervise: false }),
    ).rejects.toThrow("จำนวนดีเกินจำนวนเป้าหมายตามแผน");
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });
});
