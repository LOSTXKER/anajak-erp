import { describe, expect, it, vi } from "vitest";

import type { ExtendedPrismaClient } from "@/lib/prisma";
import { releaseManufacturingRework } from "./manufacturing-commands";
import { transitionV2OutsourceOrder } from "./manufacturing-outsource";

function releaseHarness(
  targetCode: "OUTSOURCE" | "HEAT_PRESS",
  options: {
    workOrderState?: "RELEASED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    orderStatus?: "PRODUCING" | "QUALITY_CHECK" | "PACKING" | "ON_HOLD" | "CANCELLED";
  } = {},
) {
  const ledger = new Map<string, Record<string, unknown>>();
  const sourceQuantityLine = {
    id: "source-line-1",
    productionId: "production-1",
    productionStepId: "source-operation-1",
    scopeKey: "product-1:variant-1:print-1",
    scopeKind: "VARIANT_PRINT_POSITION" as const,
    sourceOrderItemId: "item-1",
    sourceOrderItemProductId: "product-1",
    sourceOrderItemVariantId: "variant-1",
    sourceOrderItemPrintId: "print-1",
    description: "เสื้อดำ L",
    sku: "TS-BLK-L",
    size: "L",
    color: "ดำ",
    printPosition: "หน้าอก",
    referenceSnapshot: { approvedMockupId: "mockup-1" },
  };
  const rework = {
    id: "rework-1",
    productionId: "production-1",
    sourceOperationId: "source-operation-1",
    sourceQcDefectId: targetCode === "OUTSOURCE" ? "defect-1" : null,
    sourceQcDefect:
      targetCode === "OUTSOURCE"
        ? {
            id: "defect-1",
            operationQuantityId: sourceQuantityLine.id,
            operationQuantity: sourceQuantityLine,
          }
        : null,
    targetWorkCenterId:
      targetCode === "OUTSOURCE" ? "wc-outsource" : "wc-heat",
    targetWorkCenter: { code: targetCode, isActive: true },
    state: "PLANNED" as const,
    qty: 2,
    reason: "แก้งานไม่ผ่าน QC",
    revision: 3,
    production: {
      workOrderState: options.workOrderState ?? "IN_PROGRESS",
      order: { internalStatus: options.orderStatus ?? "QUALITY_CHECK" },
    },
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    manufacturingCommand: {
      findUnique: vi.fn(async ({ where }: { where: { commandId: string } }) =>
        ledger.get(where.commandId) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        ledger.set(String(data.commandId), {
          commandType: data.commandType,
          requestHash: data.requestHash,
          status: "PENDING",
          result: null,
          errorCode: null,
          errorMessage: null,
        });
        return { id: "ledger-1" };
      }),
      update: vi.fn(async ({ where, data }: {
        where: { commandId: string };
        data: Record<string, unknown>;
      }) => {
        ledger.set(where.commandId, {
          ...ledger.get(where.commandId),
          ...data,
        });
        return { id: "ledger-1" };
      }),
    },
    production: {
      findUnique: vi.fn().mockResolvedValue({
        id: "production-1",
        orderId: "order-1",
      }),
    },
    reworkCase: {
      findUnique: vi.fn().mockResolvedValue({ productionId: "production-1" }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(rework),
      update: vi.fn().mockResolvedValue({
        id: "rework-1",
        state: "RELEASED",
        releasedAt: new Date("2026-08-22T12:00:00.000Z"),
        revision: 4,
      }),
    },
    productionStep: {
      findFirst: vi.fn().mockResolvedValue({
        sortOrder: 5,
        dispatchSequence: 5,
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "rework-operation-1",
        operationCode: data.operationCode,
        operationState: data.operationState,
        executionMode: data.executionMode,
        workCenterId: data.workCenterId,
        reworkCaseId: data.reworkCaseId,
        revision: 0,
      })),
    },
    operationQuantity: {
      create: vi.fn().mockResolvedValue({
        id: "rework-line-1",
        scopeKey: sourceQuantityLine.scopeKey,
        qtyPlanned: 2,
        revision: 0,
      }),
    },
    operationJobDependency: {
      create: vi.fn().mockResolvedValue({ id: "dependency-1" }),
    },
    operationEvent: { create: vi.fn().mockResolvedValue({ id: "event-1" }) },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as ExtendedPrismaClient;
  return { prisma, tx, sourceQuantityLine };
}

function outsourceReinspectionHarness(options?: {
  outsourceStatus?: "DRAFT" | "RECEIVED_BACK";
  operationState?: "READY" | "RUNNING";
  reworkState?: "RELEASED" | "IN_PROGRESS";
}) {
  const ledger = new Map<string, Record<string, unknown>>();
  let outsourceStatus = options?.outsourceStatus ?? "RECEIVED_BACK";
  let externalQtyGood = 0;
  let externalRevision = 2;
  const operation = () => ({
    id: "external-rework-operation-1",
    productionId: "production-1",
    operationCode: "OUTSOURCE",
    operationState: options?.operationState ?? "RUNNING",
    executionEnabled: true,
    reworkCaseId: "rework-1",
    workCenterId: "wc-outsource",
    assignedToId: null,
    qtyPlanned: 2,
    qtyGood: externalQtyGood,
    qtyScrap: 0,
    qtyRework: 0,
    revision: externalRevision,
    workCenter: { code: "OUTSOURCE", isActive: true },
    workResourceId: null,
    workResource: null,
    predecessorLinks: [],
    exceptions: [],
    production: {
      orderId: "order-1",
      workOrderState: "IN_PROGRESS",
      order: { internalStatus: "PRODUCING" },
    },
  });
  const order = () => ({
    id: "outsource-rework-1",
    productionStepId: "external-rework-operation-1",
    vendorId: "vendor-1",
    status: outsourceStatus,
    description: "ส่งแก้งานร้านนอก",
    quantity: 2,
    unitCost: 0,
    totalCost: 0,
    sentAt: null,
    expectedBackAt: null,
    receivedAt: null,
    qcPassed: null,
    qcNotes: null,
    notes: null,
    shareToken: null,
    shareTokenExpiresAt: null,
    createdAt: new Date("2026-08-22T00:00:00.000Z"),
    updatedAt: new Date("2026-08-22T00:00:00.000Z"),
    allocations: [
      {
        id: "allocation-1",
        operationQuantityId: "external-rework-line-1",
        qty: 2,
      },
    ],
  });
  const sourceQuantityLine = {
    id: "source-line-1",
    productionStepId: "source-operation-1",
    qtyPlanned: 10,
    qtyGood: 8,
    qtyScrap: 0,
    qtyRework: 2,
    revision: 5,
  };
  const sourceOperation = {
    id: "source-operation-1",
    productionId: "production-1",
    operationState: "BLOCKED" as const,
    qtyPlanned: 10,
    qtyGood: 8,
    qtyScrap: 0,
    qtyRework: 2,
  };
  const rework = {
    id: "rework-1",
    productionId: "production-1",
    sourceOperationId: sourceOperation.id,
    sourceQcDefectId: "defect-1",
    sourceExceptionId: "exception-1",
    state: options?.reworkState ?? ("IN_PROGRESS" as const),
    qty: 2,
    sourceQcDefect: {
      id: "defect-1",
      disposition: "REWORK" as const,
      operationQuantityId: sourceQuantityLine.id,
      operationQuantity: sourceQuantityLine,
    },
    sourceException: {
      id: "exception-1",
      productionStepId: sourceOperation.id,
      sourceQcDefectId: "defect-1",
      state: "OPEN" as const,
      disposition: "REWORK" as const,
      blocksJob: true,
    },
    sourceOperation,
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    manufacturingCommand: {
      findUnique: vi.fn(async ({ where }: { where: { commandId: string } }) =>
        ledger.get(where.commandId) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        ledger.set(String(data.commandId), {
          commandType: data.commandType,
          requestHash: data.requestHash,
          status: "PENDING",
          result: null,
          errorCode: null,
          errorMessage: null,
        });
        return { id: "ledger-1" };
      }),
      update: vi.fn(async ({ where, data }: {
        where: { commandId: string };
        data: Record<string, unknown>;
      }) => {
        ledger.set(where.commandId, {
          ...ledger.get(where.commandId),
          ...data,
        });
        return { id: "ledger-1" };
      }),
    },
    productionStep: {
      findUnique: vi.fn().mockImplementation(async () => operation()),
      update: vi.fn(async ({ where, data }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        if (where.id === sourceOperation.id) {
          return {
            id: sourceOperation.id,
            operationState: data.operationState,
            qtyGood: 10,
            qtyRework: 0,
            revision: 6,
          };
        }
        const goodIncrement = Number(
          (data.qtyGood as { increment?: number } | undefined)?.increment ?? 0,
        );
        externalQtyGood += goodIncrement;
        externalRevision += 1;
        return {
          id: "external-rework-operation-1",
          operationState:
            (data.operationState as string | undefined) ??
            options?.operationState ??
            "RUNNING",
          qtyPlanned: 2,
          qtyGood: externalQtyGood,
          qtyScrap: 0,
          qtyRework: 0,
          revision: externalRevision,
        };
      }),
    },
    workCenterMember: {
      findUnique: vi.fn().mockResolvedValue({ isActive: true }),
    },
    production: { update: vi.fn().mockResolvedValue({}) },
    outsourceOrder: {
      findUnique: vi.fn(async () => order()),
      findUniqueOrThrow: vi.fn(async () => order()),
      updateMany: vi.fn(async ({ where, data }: {
        where: { status: string };
        data: { status: typeof outsourceStatus };
      }) => {
        if (where.status !== outsourceStatus) return { count: 0 };
        outsourceStatus = data.status;
        return { count: 1 };
      }),
    },
    operationQuantity: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "external-rework-line-1",
          productionStepId: "external-rework-operation-1",
          qtyPlanned: 2,
          qtyGood: 0,
          qtyScrap: 0,
          qtyRework: 0,
        },
      ]),
      update: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === sourceQuantityLine.id
          ? { id: sourceQuantityLine.id, qtyGood: 10, qtyRework: 0, revision: 6 }
          : { id: "external-rework-line-1" },
      ),
    },
    reworkCase: {
      findUnique: vi.fn().mockResolvedValue(rework),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "rework-1",
        state: data.state,
        qty: data.qty ?? 2,
        reinspectedAt: data.reinspectedAt ?? null,
        completedAt: data.completedAt ?? null,
        revision: 4,
      })),
    },
    productionException: {
      update: vi.fn().mockResolvedValue({ id: "exception-1" }),
      count: vi.fn().mockResolvedValue(0),
    },
    operationEvent: { create: vi.fn().mockResolvedValue({ id: "event-1" }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as ExtendedPrismaClient;
  return { prisma, tx };
}

describe("external outsource rework release", () => {
  it.each([
    ["COMPLETED", "QUALITY_CHECK"],
    ["CANCELLED", "QUALITY_CHECK"],
    ["IN_PROGRESS", "ON_HOLD"],
  ] as const)(
    "ไม่ release Rework เมื่อใบผลิตเป็น %s หรือออเดอร์เป็น %s",
    async (workOrderState, orderStatus) => {
      const { prisma, tx } = releaseHarness("OUTSOURCE", {
        workOrderState,
        orderStatus,
      });

      await expect(
        releaseManufacturingRework(prisma, {
          reworkCaseId: "rework-1",
          commandId: `release-inactive-${workOrderState}-${orderStatus}`,
          expectedRevision: 3,
          actorId: "manager-1",
        }),
      ).rejects.toThrow("ถูกพัก ยกเลิก หรือปิดแล้ว");

      expect(tx.productionStep.create).not.toHaveBeenCalled();
      expect(tx.operationQuantity.create).not.toHaveBeenCalled();
      expect(tx.reworkCase.update).not.toHaveBeenCalled();
      expect(tx.operationEvent.create).not.toHaveBeenCalled();
    },
  );

  it("release ไป OUTSOURCE สร้าง specialized operation และ clone defect line แบบ exact", async () => {
    const { prisma, tx, sourceQuantityLine } = releaseHarness("OUTSOURCE");
    const input = {
      reworkCaseId: "rework-1",
      commandId: "release-external-rework-1",
      expectedRevision: 3,
      actorId: "manager-1",
    };

    const first = await releaseManufacturingRework(prisma, input);
    const replay = await releaseManufacturingRework(prisma, input);

    expect(first).toMatchObject({
      rework: { id: "rework-1", state: "RELEASED" },
      operation: {
        id: "rework-operation-1",
        operationCode: "OUTSOURCE",
        executionMode: "OUTSOURCE",
        workCenterId: "wc-outsource",
        reworkCaseId: "rework-1",
      },
      quantityLine: { id: "rework-line-1", qtyPlanned: 2 },
    });
    expect(replay).toEqual(first);
    expect(tx.productionStep.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        operationCode: "OUTSOURCE",
        executionMode: "OUTSOURCE",
        operationPhase: "OUTSOURCE",
        workCenterId: "wc-outsource",
        reworkCaseId: "rework-1",
        qtyPlanned: 2,
      }),
      select: expect.any(Object),
    });
    expect(tx.operationQuantity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productionId: "production-1",
        productionStepId: "rework-operation-1",
        scopeKey: sourceQuantityLine.scopeKey,
        qtyPlanned: 2,
        referenceSnapshot: expect.objectContaining({
          reworkCaseId: "rework-1",
          sourceQcDefectId: "defect-1",
          sourceOperationQuantityId: sourceQuantityLine.id,
        }),
      }),
      select: expect.any(Object),
    });
    expect(tx.productionStep.create).toHaveBeenCalledOnce();
    expect(tx.operationQuantity.create).toHaveBeenCalledOnce();
  });

  it("release งานแก้ในโรงงานคง generic IN_HOUSE และไม่สร้าง line เทียม", async () => {
    const { prisma, tx } = releaseHarness("HEAT_PRESS");

    const result = await releaseManufacturingRework(prisma, {
      reworkCaseId: "rework-1",
      commandId: "release-in-house-rework-1",
      expectedRevision: 3,
      actorId: "manager-1",
    });

    expect(result).toMatchObject({
      operation: {
        operationCode: expect.stringMatching(/^REWORK-/),
        executionMode: "IN_HOUSE",
        workCenterId: "wc-heat",
      },
      quantityLine: null,
    });
    expect(tx.operationQuantity.create).not.toHaveBeenCalled();
  });
});

describe("external outsource rework execution", () => {
  it("SENT เริ่ม Rework Case ใน transaction เดียวกับใบงาน", async () => {
    const { prisma, tx } = outsourceReinspectionHarness({
      outsourceStatus: "DRAFT",
      operationState: "READY",
      reworkState: "RELEASED",
    });

    await transitionV2OutsourceOrder(prisma, {
      id: "outsource-rework-1",
      status: "SENT",
      commandId: "send-external-rework-1",
      expectedRevision: 2,
      actorId: "manager-1",
      canSupervise: true,
    });

    expect(tx.reworkCase.update).toHaveBeenCalledWith({
      where: { id: "rework-1" },
      data: { state: "IN_PROGRESS", revision: { increment: 1 } },
    });
    expect(tx.outsourceOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SENT" }) }),
    );
  });

  it("QC_PASSED ตรวจซ้ำและปิด external rework แบบ atomic/idempotent", async () => {
    const { prisma, tx } = outsourceReinspectionHarness();
    const input = {
      id: "outsource-rework-1",
      status: "QC_PASSED" as const,
      quantityLines: [
        {
          quantityLineId: "external-rework-line-1",
          qtyGood: 2,
          qtyScrap: 0,
          qtyRework: 0,
        },
      ],
      commandId: "pass-external-rework-1",
      expectedRevision: 2,
      actorId: "manager-1",
      canSupervise: true,
    };

    const first = await transitionV2OutsourceOrder(prisma, input);
    const replay = await transitionV2OutsourceOrder(prisma, input);

    expect(replay).toEqual(first);
    expect(first).toMatchObject({
      status: "QC_PASSED",
      operationRevision: 4,
      reworkResolution: {
        rework: { id: "rework-1", state: "COMPLETED", qty: 0 },
        sourceOperation: {
          id: "source-operation-1",
          qtyGood: 10,
          qtyRework: 0,
        },
        sourceQuantityLine: {
          id: "source-line-1",
          qtyGood: 10,
          qtyRework: 0,
        },
        sourceExceptionId: "exception-1",
        qty: 2,
      },
    });
    expect(tx.productionException.update).toHaveBeenCalledWith({
      where: { id: "exception-1" },
      data: expect.objectContaining({
        state: "RESOLVED",
        resolution: "งานแก้ร้านนอกผ่านการตรวจซ้ำ",
        resolvedAt: expect.any(Date),
      }),
    });
    expect(tx.operationQuantity.update).toHaveBeenCalledWith({
      where: { id: "source-line-1" },
      data: {
        qtyGood: { increment: 2 },
        qtyRework: { decrement: 2 },
        revision: { increment: 1 },
      },
      select: expect.any(Object),
    });
    expect(tx.productionStep.update).toHaveBeenCalledWith({
      where: { id: "source-operation-1" },
      data: expect.objectContaining({
        operationState: "RUNNING",
        qtyGood: { increment: 2 },
        qtyRework: { decrement: 2 },
      }),
      select: expect.any(Object),
    });
    expect(tx.reworkCase.update).toHaveBeenCalledWith({
      where: { id: "rework-1" },
      data: expect.objectContaining({
        qty: 0,
        state: "COMPLETED",
        reinspectedAt: expect.any(Date),
        completedAt: expect.any(Date),
      }),
      select: expect.any(Object),
    });
    expect(tx.operationEvent.create).toHaveBeenCalledTimes(3);
    expect(tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productionStepId: "source-operation-1",
        eventType: "QC_RECORDED",
        sequence: 1,
        qtyGoodDelta: 2,
        qtyReworkDelta: -2,
      }),
    });
    expect(tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productionStepId: "external-rework-operation-1",
        eventType: "COMPLETED",
        sequence: 2,
      }),
    });
    expect(tx.productionException.update).toHaveBeenCalledOnce();
    expect(tx.reworkCase.update).toHaveBeenCalledOnce();
  });
});
