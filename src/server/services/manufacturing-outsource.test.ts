import { describe, expect, it, vi } from "vitest";

import type { ExtendedPrismaClient } from "@/lib/prisma";
import {
  cancelV2OutsourceOrder,
  createV2OutsourceOrder,
  transitionV2OutsourceOrder,
} from "./manufacturing-outsource";

function harness(options?: {
  outsourceStatus?: "DRAFT" | "SENT" | "RECEIVED_BACK";
  operationState?: "READY" | "RUNNING";
  operationRevision?: number;
  receiptCount?: number;
  executionEnabled?: boolean;
  quantityLines?: Array<{
    id: string;
    description: string;
    size: string | null;
    color: string | null;
    printPosition: string | null;
    qtyPlanned: number;
  }>;
  orderAllocations?: Array<{
    id: string;
    operationQuantityId: string;
    qty: number;
  }>;
  openAllocations?: Array<{ operationQuantityId: string; qty: number }>;
  otherExecutingOrders?: number;
  reworkCaseId?: string | null;
  workOrderState?: "DRAFT" | "RELEASED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  orderStatus?: "CONFIRMED" | "PRODUCTION_QUEUE" | "PRODUCING" | "QUALITY_CHECK" | "PACKING" | "ON_HOLD" | "CANCELLED";
  workCenterActive?: boolean;
  workResourceState?: "AVAILABLE" | "IN_USE" | "DOWN" | "INACTIVE";
}) {
  const ledger = new Map<string, Record<string, unknown>>();
  const lockLog: string[] = [];
  let outsourceStatus = options?.outsourceStatus ?? "DRAFT";
  let operationRevision = options?.operationRevision ?? 2;
  let qtyGood = 0;
  let qtyScrap = 0;
  let qtyRework = 0;
  let defectSequence = 0;
  let exceptionSequence = 0;
  const quantityLines = options?.quantityLines ?? [
    {
      id: "quantity-1",
      description: "เสื้อดำ L · หน้าอก",
      size: "L",
      color: "ดำ",
      printPosition: "หน้าอก",
      qtyPlanned: 10,
    },
  ];
  const orderAllocations =
    options?.orderAllocations ??
    quantityLines.map((line, index) => ({
      id: `allocation-${index + 1}`,
      operationQuantityId: line.id,
      qty: line.qtyPlanned,
    }));
  const openAllocations = [...(options?.openAllocations ?? [])];
  const operation = () => ({
    id: "operation-outsource-1",
    productionId: "production-1",
    operationCode: "OUTSOURCE",
    operationState: options?.operationState ?? "READY",
    executionEnabled: options?.executionEnabled ?? true,
    reworkCaseId: options?.reworkCaseId ?? null,
    workCenterId: "wc-outsource",
    assignedToId: null,
    qtyPlanned: 10,
    qtyGood,
    qtyScrap,
    qtyRework,
    revision: operationRevision,
    workCenter: {
      code: "OUTSOURCE",
      isActive: options?.workCenterActive ?? true,
    },
    workResourceId: options?.workResourceState ? "resource-1" : null,
    workResource: options?.workResourceState
      ? { isActive: true, state: options.workResourceState }
      : null,
    predecessorLinks: [
      { predecessorStep: { operationState: "COMPLETED" as const } },
    ],
    exceptions: [],
    production: {
      orderId: "order-1",
      workOrderState: options?.workOrderState ?? "IN_PROGRESS",
      order: { internalStatus: options?.orderStatus ?? "PRODUCING" },
    },
  });
  const outsourceOrder = () => ({
    id: "outsource-1",
    productionStepId: "operation-outsource-1",
    vendorId: "vendor-1",
    status: outsourceStatus,
    description: "ส่งปักโลโก้",
    quantity: 10,
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
    allocations: orderAllocations,
  });
  const tx = {
    $queryRaw: vi.fn(async (query: TemplateStringsArray) => {
      lockLog.push(String(query));
      return [];
    }),
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
        return { id: "command-row-1" };
      }),
      update: vi.fn(async ({ where, data }: {
        where: { commandId: string };
        data: Record<string, unknown>;
      }) => {
        ledger.set(where.commandId, {
          ...ledger.get(where.commandId),
          ...data,
        });
        return { id: "command-row-1" };
      }),
    },
    productionStep: {
      findUnique: vi.fn(async () => operation()),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const goodIncrement = Number(
          (data.qtyGood as { increment?: number } | undefined)?.increment ?? 0,
        );
        const scrapIncrement = Number(
          (data.qtyScrap as { increment?: number } | undefined)?.increment ?? 0,
        );
        const reworkIncrement = Number(
          (data.qtyRework as { increment?: number } | undefined)?.increment ?? 0,
        );
        qtyGood += goodIncrement;
        qtyScrap += scrapIncrement;
        qtyRework += reworkIncrement;
        operationRevision += 1;
        return {
          id: "operation-outsource-1",
          operationState:
            (data.operationState as string | undefined) ??
            options?.operationState ??
            "READY",
          qtyPlanned: 10,
          qtyGood,
          qtyScrap,
          qtyRework,
          revision: operationRevision,
        };
      }),
    },
    workCenterMember: {
      findUnique: vi.fn().mockResolvedValue({ isActive: true }),
    },
    production: { update: vi.fn().mockResolvedValue({}) },
    outsourceOrder: {
      findUnique: vi.fn(async () => outsourceOrder()),
      findUniqueOrThrow: vi.fn(async () => outsourceOrder()),
      create: vi.fn(async ({ data }: {
        data: {
          allocations?: {
            create?: Array<{ operationQuantityId: string; qty: number }>;
          };
        };
      }) => {
        for (const allocation of data.allocations?.create ?? []) {
          openAllocations.push(allocation);
        }
        return outsourceOrder();
      }),
      updateMany: vi.fn(async ({ where, data }: {
        where: { status: string };
        data: { status: typeof outsourceStatus };
      }) => {
        if (where.status !== outsourceStatus) return { count: 0 };
        outsourceStatus = data.status;
        return { count: 1 };
      }),
      deleteMany: vi.fn(async ({ where }: { where: { status: string } }) =>
        where.status === outsourceStatus ? { count: 1 } : { count: 0 },
      ),
      count: vi.fn().mockResolvedValue(options?.otherExecutingOrders ?? 0),
    },
    goodsReceipt: {
      count: vi.fn().mockResolvedValue(options?.receiptCount ?? 1),
    },
    operationQuantity: {
      findMany: vi.fn().mockImplementation(
        ({ where }: { where?: { id?: { in?: string[] } } }) => {
          const requestedIds = where?.id?.in;
          return Promise.resolve(
            quantityLines
              .filter((line) => !requestedIds || requestedIds.includes(line.id))
              .map((line) => ({
                ...line,
                productionStepId: "operation-outsource-1",
                qtyGood: 0,
                qtyScrap: 0,
                qtyRework: 0,
              })),
          );
        },
      ),
      count: vi.fn().mockResolvedValue(quantityLines.length),
      update: vi.fn().mockResolvedValue({ id: "quantity-1" }),
    },
    reworkCase: {
      findUnique: vi.fn().mockResolvedValue({
        id: options?.reworkCaseId ?? "rework-1",
        productionId: "production-1",
        sourceOperationId: "source-operation-1",
        sourceQcDefectId: "source-defect-1",
        state: "RELEASED",
        qty: 10,
      }),
      update: vi.fn().mockResolvedValue({ id: options?.reworkCaseId ?? "rework-1" }),
    },
    outsourceOrderLine: {
      findMany: vi.fn(async () => openAllocations),
    },
    qcRecord: {
      create: vi.fn().mockResolvedValue({ id: "qc-record-outsource-1" }),
    },
    qcDefect: {
      create: vi.fn(async () => {
        defectSequence += 1;
        return { id: `defect-outsource-${defectSequence}` };
      }),
    },
    productionException: {
      create: vi.fn(async () => {
        exceptionSequence += 1;
        return { id: `exception-outsource-${exceptionSequence}` };
      }),
    },
    operationEvent: { create: vi.fn().mockResolvedValue({ id: "event-1" }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as ExtendedPrismaClient;
  return { prisma, tx, lockLog };
}

describe("Production V2 outsource lifecycle", () => {
  it("V2 adapter ปฏิเสธ legacy step แม้เรียก service โดยตรง", async () => {
    const { prisma, tx } = harness({ executionEnabled: false });
    await expect(
      createV2OutsourceOrder(prisma, {
        productionStepId: "operation-outsource-1",
        vendorId: "vendor-1",
        description: "ส่งปักโลโก้",
        quantity: 10,
        quantityLines: [{ quantityLineId: "quantity-1", qty: 10 }],
        unitCost: 0,
        commandId: "outsource-create-legacy-command-1",
        expectedRevision: 2,
        actorId: "worker-1",
        canSupervise: false,
      }),
    ).rejects.toThrow("ยังไม่ถูกเปิดใช้ใน Production V2");
    expect(tx.outsourceOrder.create).not.toHaveBeenCalled();
  });

  it("สร้าง DRAFT ผ่าน command ledger และ retry ไม่สร้างใบ/event ซ้ำ", async () => {
    const { prisma, tx, lockLog } = harness();
    const input = {
      productionStepId: "operation-outsource-1",
      vendorId: "vendor-1",
      description: "ส่งปักโลโก้",
      quantity: 10,
      quantityLines: [{ quantityLineId: "quantity-1", qty: 10 }],
      unitCost: 0,
      commandId: "outsource-create-command-1",
      expectedRevision: 2,
      actorId: "worker-1",
      canSupervise: false,
    };

    const first = await createV2OutsourceOrder(prisma, input);
    const replay = await createV2OutsourceOrder(prisma, input);

    expect(first).toMatchObject({
      id: "outsource-1",
      operationJobId: "operation-outsource-1",
      operationRevision: 3,
    });
    expect(replay).toMatchObject({ id: "outsource-1" });
    expect(tx.outsourceOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantity: 10,
          allocations: {
            create: [{ operationQuantityId: "quantity-1", qty: 10 }],
          },
        }),
      }),
    );
    expect(tx.outsourceOrder.create).toHaveBeenCalledOnce();
    expect(tx.operationEvent.create).toHaveBeenCalledOnce();
    expect(
      lockLog.findIndex((sql) => sql.includes("FROM operation_quantities")),
    ).toBeGreaterThan(
      lockLog.findIndex((sql) => sql.includes("FROM orders")),
    );
  });

  it("create V2 ต้องรับ allocation ครบและผลรวมตรง scalar", async () => {
    const { prisma, tx } = harness();
    const baseInput = {
      productionStepId: "operation-outsource-1",
      vendorId: "vendor-1",
      description: "ส่งปักโลโก้",
      quantity: 10,
      unitCost: 0,
      commandId: "outsource-create-allocation-command-1",
      expectedRevision: 2,
      actorId: "manager-1",
      canSupervise: true,
    };

    await expect(
      createV2OutsourceOrder(prisma, {
        ...baseInput,
        quantityLines: [],
      }),
    ).rejects.toThrow("ต้องระบุจำนวนตามสินค้า");
    await expect(
      createV2OutsourceOrder(prisma, {
        ...baseInput,
        commandId: "outsource-create-allocation-command-2",
        quantityLines: [{ quantityLineId: "quantity-1", qty: 9 }],
      }),
    ).rejects.toThrow("ผลรวม quantity line");
    await expect(
      createV2OutsourceOrder(prisma, {
        ...baseInput,
        commandId: "outsource-create-allocation-command-3",
        quantityLines: [{ quantityLineId: "quantity-other-operation", qty: 10 }],
      }),
    ).rejects.toThrow("ไม่ได้อยู่ใน Operation Job นี้");
    expect(tx.outsourceOrder.create).not.toHaveBeenCalled();
  });

  it("ใบส่งแก้งานร้านนอกต้องใช้ defect line เดียวเต็มจำนวน", async () => {
    const full = harness({ reworkCaseId: "rework-1" });
    await expect(
      createV2OutsourceOrder(full.prisma, {
        productionStepId: "operation-outsource-1",
        vendorId: "vendor-1",
        description: "ส่งแก้งานร้านนอก",
        quantity: 10,
        quantityLines: [{ quantityLineId: "quantity-1", qty: 10 }],
        unitCost: 0,
        commandId: "outsource-create-rework-full-1",
        expectedRevision: 2,
        actorId: "manager-1",
        canSupervise: true,
      }),
    ).resolves.toMatchObject({ id: "outsource-1" });

    const partial = harness({ reworkCaseId: "rework-1" });
    await expect(
      createV2OutsourceOrder(partial.prisma, {
        productionStepId: "operation-outsource-1",
        vendorId: "vendor-1",
        description: "ส่งแก้งานร้านนอกบางส่วน",
        quantity: 4,
        quantityLines: [{ quantityLineId: "quantity-1", qty: 4 }],
        unitCost: 0,
        commandId: "outsource-create-rework-partial-1",
        expectedRevision: 2,
        actorId: "manager-1",
        canSupervise: true,
      }),
    ).rejects.toThrow("ต้องจัดสรรเต็มจำนวน");
    expect(partial.tx.outsourceOrder.create).not.toHaveBeenCalled();
  });

  it("หลายใบจัดสรร line เดียวกันได้ไม่เกิน remaining และ retry ไม่จองซ้ำ", async () => {
    const allowed = harness({
      openAllocations: [{ operationQuantityId: "quantity-1", qty: 6 }],
    });
    const allowedInput = {
      productionStepId: "operation-outsource-1",
      vendorId: "vendor-1",
      description: "ส่งปักโลโก้รอบสอง",
      quantity: 4,
      quantityLines: [{ quantityLineId: "quantity-1", qty: 4 }],
      unitCost: 0,
      commandId: "outsource-create-second-batch-command-1",
      expectedRevision: 2,
      actorId: "manager-1",
      canSupervise: true,
    };
    await createV2OutsourceOrder(allowed.prisma, allowedInput);
    await createV2OutsourceOrder(allowed.prisma, allowedInput);
    expect(allowed.tx.outsourceOrder.create).toHaveBeenCalledOnce();

    const over = harness({
      openAllocations: [{ operationQuantityId: "quantity-1", qty: 6 }],
    });
    await expect(
      createV2OutsourceOrder(over.prisma, {
        ...allowedInput,
        quantity: 5,
        quantityLines: [{ quantityLineId: "quantity-1", qty: 5 }],
        commandId: "outsource-create-over-allocation-command-1",
      }),
    ).rejects.toThrow("เกินยอดที่ยังไม่ได้จัดสรร (4 ตัว)");
    expect(over.tx.outsourceOrder.create).not.toHaveBeenCalled();
  });

  it("SENT ใช้ expectedRevision และ retry ไม่เดินสถานะซ้ำ", async () => {
    const { prisma, tx } = harness({ operationRevision: 3 });
    const input = {
      id: "outsource-1",
      status: "SENT" as const,
      commandId: "outsource-sent-command-1",
      expectedRevision: 3,
      actorId: "worker-1",
      canSupervise: false,
    };

    await transitionV2OutsourceOrder(prisma, input);
    await transitionV2OutsourceOrder(prisma, input);

    expect(tx.outsourceOrder.updateMany).toHaveBeenCalledOnce();
    expect(tx.operationEvent.create).toHaveBeenCalledOnce();
  });

  it("ห้ามส่งใบงานร้านนอกต่อเมื่อออเดอร์พัก แต่ยังยกเลิกร่างเพื่อเก็บกวาดได้", async () => {
    const blocked = harness({
      outsourceStatus: "DRAFT",
      operationState: "READY",
      orderStatus: "ON_HOLD",
    });
    await expect(
      transitionV2OutsourceOrder(blocked.prisma, {
        id: "outsource-1",
        status: "SENT",
        commandId: "outsource-held-send-command-1",
        expectedRevision: 2,
        actorId: "manager-1",
        canSupervise: true,
      }),
    ).rejects.toThrow("ถูกพัก ยกเลิก หรือปิดแล้ว");
    expect(blocked.tx.outsourceOrder.updateMany).not.toHaveBeenCalled();
    expect(blocked.tx.operationEvent.create).not.toHaveBeenCalled();

    const cleanup = harness({
      outsourceStatus: "DRAFT",
      operationState: "READY",
      orderStatus: "CANCELLED",
      workCenterActive: false,
      workResourceState: "DOWN",
    });
    await expect(
      cancelV2OutsourceOrder(cleanup.prisma, {
        id: "outsource-1",
        commandId: "outsource-cancel-after-order-command-1",
        expectedRevision: 2,
        actorId: "manager-1",
        canSupervise: true,
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(cleanup.tx.outsourceOrder.deleteMany).toHaveBeenCalledOnce();
    expect(cleanup.tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: "CANCELLED" }),
    });
  });

  it("ยกเลิกร่างหนึ่งใบไม่ถอย Operation เป็น READY ถ้ายังมีใบอื่นกำลังทำ", async () => {
    const { prisma, tx } = harness({
      outsourceStatus: "DRAFT",
      operationState: "RUNNING",
      operationRevision: 4,
      otherExecutingOrders: 1,
    });

    await cancelV2OutsourceOrder(prisma, {
      id: "outsource-1",
      commandId: "outsource-cancel-one-of-many-command-1",
      expectedRevision: 4,
      actorId: "manager-1",
      canSupervise: true,
    });

    expect(tx.productionStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ operationState: "RUNNING" }),
      }),
    );
  });

  it("รับกลับต้องมีใบตรวจนับ และ QC pass ต้องผูกยอดกับ quantity line", async () => {
    const noReceipt = harness({
      outsourceStatus: "SENT",
      operationState: "RUNNING",
      operationRevision: 4,
      receiptCount: 0,
    });
    await expect(
      transitionV2OutsourceOrder(noReceipt.prisma, {
        id: "outsource-1",
        status: "RECEIVED_BACK",
        commandId: "outsource-received-command-1",
        expectedRevision: 4,
        actorId: "worker-1",
        canSupervise: false,
      }),
    ).rejects.toThrow("ใบตรวจนับ");
    expect(noReceipt.tx.outsourceOrder.updateMany).not.toHaveBeenCalled();

    const passed = harness({
      outsourceStatus: "RECEIVED_BACK",
      operationState: "RUNNING",
      operationRevision: 5,
    });
    await expect(
      transitionV2OutsourceOrder(passed.prisma, {
        id: "outsource-1",
        status: "QC_PASSED",
        commandId: "outsource-qc-command-1",
        expectedRevision: 5,
        actorId: "manager-1",
        canSupervise: true,
        quantityLines: [
          {
            quantityLineId: "quantity-1",
            qtyGood: 10,
            qtyScrap: 0,
            qtyRework: 0,
          },
        ],
      }),
    ).resolves.toMatchObject({ status: "QC_PASSED", operationRevision: 6 });
    expect(passed.tx.operationQuantity.update).toHaveBeenCalledOnce();
    expect(passed.tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "QC_RECORDED",
        qtyGoodDelta: 10,
      }),
    });
  });

  it("QC fail ต้องเลือก REWORK/SCRAP และสร้าง blocker พร้อมยอด reject", async () => {
    const missingDisposition = harness({
      outsourceStatus: "RECEIVED_BACK",
      operationState: "RUNNING",
      operationRevision: 5,
    });
    await expect(
      transitionV2OutsourceOrder(missingDisposition.prisma, {
        id: "outsource-1",
        status: "QC_FAILED",
        commandId: "outsource-qc-fail-missing-command-1",
        expectedRevision: 5,
        actorId: "manager-1",
        canSupervise: true,
        quantityLines: [
          {
            quantityLineId: "quantity-1",
            qtyGood: 0,
            qtyScrap: 0,
            qtyRework: 10,
          },
        ],
      }),
    ).rejects.toThrow("ส่งแก้หรือคัดทิ้ง");
    expect(missingDisposition.tx.outsourceOrder.updateMany).not.toHaveBeenCalled();
    expect(missingDisposition.tx.productionException.create).not.toHaveBeenCalled();

    const failed = harness({
      outsourceStatus: "RECEIVED_BACK",
      operationState: "RUNNING",
      operationRevision: 5,
    });
    const failedInput = {
        id: "outsource-1",
        status: "QC_FAILED" as const,
        disposition: "REWORK" as const,
        qcNotes: "ด้ายหลุด",
        commandId: "outsource-qc-fail-command-1",
        expectedRevision: 5,
        actorId: "manager-1",
        canSupervise: true,
        quantityLines: [
          {
            quantityLineId: "quantity-1",
            qtyGood: 0,
            qtyScrap: 0,
            qtyRework: 10,
          },
        ],
      };
    await expect(
      transitionV2OutsourceOrder(failed.prisma, failedInput),
    ).resolves.toMatchObject({
      status: "QC_FAILED",
      operationRevision: 6,
      qcRecordId: "qc-record-outsource-1",
      exceptionId: "exception-outsource-1",
      exceptionIds: ["exception-outsource-1"],
      exceptionTraces: [
        {
          exceptionId: "exception-outsource-1",
          qcDefectId: "defect-outsource-1",
          quantityLineId: "quantity-1",
          qty: 10,
        },
      ],
    });
    await expect(
      transitionV2OutsourceOrder(failed.prisma, failedInput),
    ).resolves.toMatchObject({ exceptionId: "exception-outsource-1" });
    expect(failed.tx.qcRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order-1",
        productionStepId: "operation-outsource-1",
        qtyGood: 0,
        qtyDefect: 10,
      }),
      select: { id: true },
    });
    expect(failed.tx.qcDefect.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        qcRecordId: "qc-record-outsource-1",
        operationQuantityId: "quantity-1",
        qty: 10,
        disposition: "REWORK",
      }),
      select: { id: true },
    });
    expect(failed.tx.productionException.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productionStepId: "operation-outsource-1",
        sourceQcDefectId: "defect-outsource-1",
        disposition: "REWORK",
        blocksJob: true,
      }),
      select: { id: true },
    });
    expect(failed.tx.qcRecord.create).toHaveBeenCalledOnce();
    expect(failed.tx.qcDefect.create).toHaveBeenCalledOnce();
    expect(failed.tx.productionException.create).toHaveBeenCalledOnce();
    expect(failed.tx.operationEvent.create).toHaveBeenCalledOnce();
    expect(failed.tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "QC_RECORDED",
        toState: "BLOCKED",
        qtyReworkDelta: 10,
        payload: expect.objectContaining({
          qcRecordId: "qc-record-outsource-1",
          exceptionTraces: [
            {
              exceptionId: "exception-outsource-1",
              qcDefectId: "defect-outsource-1",
              quantityLineId: "quantity-1",
              qty: 10,
            },
          ],
        }),
      }),
    });
  });

  it("QC fail หลาย quantity line สร้าง defect และ exception แยกต่อ line โดย retry ไม่ซ้ำ", async () => {
    const failed = harness({
      outsourceStatus: "RECEIVED_BACK",
      operationState: "RUNNING",
      operationRevision: 5,
      quantityLines: [
        {
          id: "quantity-black-l",
          description: "เสื้อดำ L · หน้าอก",
          size: "L",
          color: "ดำ",
          printPosition: "หน้าอก",
          qtyPlanned: 4,
        },
        {
          id: "quantity-white-m",
          description: "เสื้อขาว M · ด้านหลัง",
          size: "M",
          color: "ขาว",
          printPosition: "ด้านหลัง",
          qtyPlanned: 6,
        },
      ],
    });
    const input = {
      id: "outsource-1",
      status: "QC_FAILED" as const,
      disposition: "REWORK" as const,
      qcNotes: "งานปักเบี้ยว",
      commandId: "outsource-qc-fail-multi-line-command-1",
      expectedRevision: 5,
      actorId: "manager-1",
      canSupervise: true,
      quantityLines: [
        {
          quantityLineId: "quantity-black-l",
          qtyGood: 0,
          qtyScrap: 0,
          qtyRework: 4,
        },
        {
          quantityLineId: "quantity-white-m",
          qtyGood: 0,
          qtyScrap: 0,
          qtyRework: 6,
        },
      ],
    };

    const first = await transitionV2OutsourceOrder(failed.prisma, input);
    const replay = await transitionV2OutsourceOrder(failed.prisma, input);

    expect(first).toMatchObject({
      qcRecordId: "qc-record-outsource-1",
      exceptionIds: ["exception-outsource-1", "exception-outsource-2"],
      exceptionTraces: [
        {
          qcDefectId: "defect-outsource-1",
          quantityLineId: "quantity-black-l",
          qty: 4,
        },
        {
          qcDefectId: "defect-outsource-2",
          quantityLineId: "quantity-white-m",
          qty: 6,
        },
      ],
    });
    expect(replay).toEqual(first);
    expect(failed.tx.qcRecord.create).toHaveBeenCalledOnce();
    expect(failed.tx.qcDefect.create).toHaveBeenCalledTimes(2);
    expect(failed.tx.productionException.create).toHaveBeenCalledTimes(2);
    expect(failed.tx.productionException.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          sourceQcDefectId: "defect-outsource-1",
          disposition: "REWORK",
        }),
      }),
    );
    expect(failed.tx.productionException.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          sourceQcDefectId: "defect-outsource-2",
          disposition: "REWORK",
        }),
      }),
    );
  });

  it("QC ห้ามสลับยอดข้าม line แม้ผลรวมเท่า allocation ของใบงาน", async () => {
    const failed = harness({
      outsourceStatus: "RECEIVED_BACK",
      operationState: "RUNNING",
      operationRevision: 5,
      quantityLines: [
        {
          id: "quantity-black-l",
          description: "เสื้อดำ L",
          size: "L",
          color: "ดำ",
          printPosition: "หน้าอก",
          qtyPlanned: 4,
        },
        {
          id: "quantity-white-m",
          description: "เสื้อขาว M",
          size: "M",
          color: "ขาว",
          printPosition: "ด้านหลัง",
          qtyPlanned: 6,
        },
      ],
    });

    await expect(
      transitionV2OutsourceOrder(failed.prisma, {
        id: "outsource-1",
        status: "QC_PASSED",
        commandId: "outsource-qc-swapped-allocation-command-1",
        expectedRevision: 5,
        actorId: "manager-1",
        canSupervise: true,
        quantityLines: [
          {
            quantityLineId: "quantity-black-l",
            qtyGood: 5,
            qtyScrap: 0,
            qtyRework: 0,
          },
          {
            quantityLineId: "quantity-white-m",
            qtyGood: 5,
            qtyScrap: 0,
            qtyRework: 0,
          },
        ],
      }),
    ).rejects.toThrow("ตรงกับ allocation ของแต่ละ quantity line");
    expect(failed.tx.outsourceOrder.updateMany).not.toHaveBeenCalled();
    expect(failed.tx.operationQuantity.update).not.toHaveBeenCalled();
  });

  it("QC fail แบบ SCRAP ผูก defect ต่อ line โดยไม่สร้างยอด rework ค้าง", async () => {
    const failed = harness({
      outsourceStatus: "RECEIVED_BACK",
      operationState: "RUNNING",
      operationRevision: 5,
    });

    await transitionV2OutsourceOrder(failed.prisma, {
      id: "outsource-1",
      status: "QC_FAILED",
      disposition: "SCRAP",
      commandId: "outsource-qc-fail-scrap-command-1",
      expectedRevision: 5,
      actorId: "manager-1",
      canSupervise: true,
      quantityLines: [
        {
          quantityLineId: "quantity-1",
          qtyGood: 0,
          qtyScrap: 10,
          qtyRework: 0,
        },
      ],
    });

    expect(failed.tx.qcDefect.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ disposition: "SCRAP", qty: 10 }),
      select: { id: true },
    });
    expect(failed.tx.productionException.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceQcDefectId: "defect-outsource-1",
        disposition: "SCRAP",
      }),
      select: { id: true },
    });
    expect(failed.tx.productionStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qtyScrap: { increment: 10 },
          qtyRework: { increment: 0 },
        }),
      }),
    );
  });
});
