import { describe, expect, it, vi } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/prisma";

import { createQcRecord } from "./qc";

function harness() {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    production: {
      findMany: vi.fn().mockResolvedValue([
        { id: "production-1", steps: [{ id: "operation-qc-1" }] },
      ]),
      update: vi.fn().mockResolvedValue({}),
    },
    productionStep: {
      findUnique: vi.fn().mockResolvedValue({
        id: "operation-qc-1",
        productionId: "production-1",
        operationCode: "FINAL_QC",
        operationState: "RUNNING",
        executionEnabled: true,
        workCenterId: "wc-qc",
        assignedToId: "worker-1",
        qtyPlanned: 10,
        qtyGood: 0,
        qtyScrap: 0,
        qtyRework: 0,
        revision: 5,
        workCenter: { code: "FINAL_QC", isActive: true },
        workResourceId: null,
        workResource: null,
        predecessorLinks: [],
        exceptions: [],
        production: {
          orderId: "order-1",
          workOrderState: "IN_PROGRESS",
          order: { internalStatus: "QUALITY_CHECK" },
        },
      }),
      update: vi.fn().mockResolvedValue({
        id: "operation-qc-1",
        operationState: "BLOCKED",
        qtyPlanned: 10,
        qtyGood: 8,
        qtyScrap: 0,
        qtyRework: 2,
        revision: 6,
      }),
    },
    workCenterMember: {
      findUnique: vi.fn().mockResolvedValue({ isActive: true }),
    },
    order: {
      findUniqueOrThrow: vi.fn(
        async ({ select }: { select: Record<string, unknown> }) =>
          select.productionCompletionOwnerId
            ? {
                productionCompletionOwnerId: "production-1",
                productions: [{
                  workOrderNumber: "WO-1",
                  completionOwnerStepId: "operation-pack-1",
                }],
              }
            : select.productions
            ? {
                id: "order-1",
                orderNumber: "ORD-1",
                internalStatus: "QUALITY_CHECK",
                items: [{ products: [{ variants: [{ quantity: 10 }] }] }],
                qcRecords: [],
                productions: [{
                  id: "production-1",
                  workOrderNumber: "WO-1",
                  completionOwnerStepId: "operation-pack-1",
                }],
              }
            : {
                id: "order-1",
                orderNumber: "ORD-1",
                items: [],
              },
      ),
      updateMany: vi.fn(),
    },
    product: { findMany: vi.fn().mockResolvedValue([]) },
    materialUsage: { findMany: vi.fn().mockResolvedValue([]) },
    qcRecord: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(async ({
        data,
      }: {
        data: Record<string, unknown> & {
          defects: { create: Array<Record<string, unknown>> };
        };
      }) => ({
        id: data.id,
        orderId: data.orderId,
        productionStepId: data.productionStepId,
        qtyGood: data.qtyGood,
        qtyDefect: data.qtyDefect,
        defects: data.defects.create.map(
          (defect: Record<string, unknown>, index: number) => ({
            id: `defect-${index + 1}`,
            ...defect,
          }),
        ),
      })),
    },
    operationEvent: { create: vi.fn().mockResolvedValue({ id: "event-1" }) },
    operationQuantity: {
      findMany: vi.fn().mockResolvedValue([{
        id: "quantity-qc-1",
        productionStepId: "operation-qc-1",
        qtyPlanned: 10,
        qtyGood: 0,
        qtyScrap: 0,
        qtyRework: 0,
      }]),
      update: vi.fn().mockResolvedValue({ id: "quantity-qc-1" }),
    },
    productionException: { create: vi.fn().mockResolvedValue({ id: "exception-1" }) },
    auditLog: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
      callback(tx),
    ),
    order: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ orderNumber: "ORD-1" }),
    },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    notification: { create: vi.fn() },
  } as unknown as ExtendedPrismaClient;
  return { prisma, tx };
}

describe("QC V2 adapter", () => {
  it("flag off ปฏิเสธ QC V2 ก่อนเริ่ม transaction", async () => {
    const { prisma, tx } = harness();
    vi.stubEnv("PRODUCTION_V2_ENABLED", "0");
    try {
      await expect(
        createQcRecord(prisma, {
          orderId: "order-1",
          idempotencyKey: "qc-v2-flag-off-1",
          operationJobId: "operation-qc-1",
          expectedRevision: 5,
          qtyGood: 0,
          defects: [],
          userId: "worker-1",
        }),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      expect(tx.qcRecord.create).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("ปฏิเสธ legacy QC writer ของใบผลิต V2 ก่อนสร้าง record หรือเปลี่ยนสถานะ", async () => {
    const { prisma, tx } = harness();

    await expect(
      createQcRecord(prisma, {
        orderId: "order-1",
        idempotencyKey: "qc-v2-legacy-downgrade-1",
        qtyGood: 10,
        defects: [],
        userId: "worker-1",
      }),
    ).rejects.toThrow("ต้องบันทึกผลตรวจจากงาน Final QC");

    expect(tx.qcRecord.findUnique).not.toHaveBeenCalled();
    expect(tx.qcRecord.create).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.productionStep.update).not.toHaveBeenCalled();
    expect(tx.operationEvent.create).not.toHaveBeenCalled();
  });

  it("ผูก QcRecord, เก็บ disposition, qty rework, exception และ event แบบ atomic", async () => {
    const { prisma, tx } = harness();
    await createQcRecord(prisma, {
      orderId: "order-1",
      idempotencyKey: "qc-v2-command-1",
      operationJobId: "operation-qc-1",
      expectedRevision: 5,
      qtyGood: 8,
      quantityLines: [{ quantityLineId: "quantity-qc-1", qtyGood: 8 }],
      defects: [
        {
          quantityLineId: "quantity-qc-1",
          qty: 2,
          reason: "PRINT_PEEL",
          disposition: "REWORK",
        },
      ],
      userId: "worker-1",
    });

    expect(tx.qcRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productionStepId: "operation-qc-1",
          defects: {
            create: [expect.objectContaining({
              disposition: "REWORK",
              operationQuantityId: "quantity-qc-1",
            })],
          },
        }),
      }),
    );
    expect(tx.productionStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operationState: "BLOCKED",
          qtyGood: { increment: 8 },
          qtyRework: { increment: 2 },
        }),
      }),
    );
    expect(tx.productionException.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        disposition: "REWORK",
        blocksJob: true,
        productionStepId: "operation-qc-1",
        sourceQcDefectId: "defect-1",
      }),
    });
    expect(tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "QC_RECORDED",
        qtyGoodDelta: 8,
        qtyReworkDelta: 2,
      }),
    });
    expect(tx.operationQuantity.update).toHaveBeenCalledWith({
      where: { id: "quantity-qc-1" },
      data: {
        qtyGood: { increment: 8 },
        qtyScrap: { increment: 0 },
        qtyRework: { increment: 2 },
        revision: { increment: 1 },
      },
    });
  });

  it("reject V2 ที่ไม่มี disposition ก่อนสร้าง QcRecord", async () => {
    const { prisma, tx } = harness();
    await expect(
      createQcRecord(prisma, {
        orderId: "order-1",
        idempotencyKey: "qc-v2-command-2",
        operationJobId: "operation-qc-1",
        expectedRevision: 5,
        qtyGood: 8,
        quantityLines: [{ quantityLineId: "quantity-qc-1", qtyGood: 8 }],
        defects: [{ quantityLineId: "quantity-qc-1", qty: 2, reason: "PRINT_PEEL" }],
        userId: "worker-1",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(tx.qcRecord.create).not.toHaveBeenCalled();
  });

  it("QC HOLD ที่ยังไม่มี good/scrap/rework บันทึก event-only และ BLOCKED ได้", async () => {
    const { prisma, tx } = harness();
    await createQcRecord(prisma, {
      orderId: "order-1",
      idempotencyKey: "qc-v2-hold-zero-1",
      operationJobId: "operation-qc-1",
      expectedRevision: 5,
      qtyGood: 0,
      defects: [{
        quantityLineId: "quantity-qc-1",
        qty: 2,
        reason: "PRINT_PEEL",
        disposition: "HOLD",
      }],
      userId: "worker-1",
    });

    expect(tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "QC_RECORDED",
        toState: "BLOCKED",
        qtyGoodDelta: 0,
        qtyScrapDelta: 0,
        qtyReworkDelta: 0,
      }),
    });
    expect(tx.operationQuantity.update).not.toHaveBeenCalled();
  });

  it("reject quantity line ของ defect ที่อยู่นอก Operation Job แม้เป็น HOLD แบบ zero-delta", async () => {
    const { prisma, tx } = harness();
    tx.operationQuantity.findMany.mockResolvedValueOnce([]);

    await expect(
      createQcRecord(prisma, {
        orderId: "order-1",
        idempotencyKey: "qc-v2-foreign-line-1",
        operationJobId: "operation-qc-1",
        expectedRevision: 5,
        qtyGood: 0,
        defects: [{
          quantityLineId: "quantity-other-operation",
          qty: 1,
          reason: "PRINT_PEEL",
          disposition: "HOLD",
        }],
        userId: "worker-1",
      }),
    ).rejects.toThrow("ไม่ได้อยู่ใน Operation Job นี้");
    expect(tx.qcRecord.create).not.toHaveBeenCalled();
  });

  it("reject good + defect ที่เกิน remaining ของ quantity line แม้ defect เป็น HOLD", async () => {
    const { prisma, tx } = harness();
    await expect(
      createQcRecord(prisma, {
        orderId: "order-1",
        idempotencyKey: "qc-v2-over-line-1",
        operationJobId: "operation-qc-1",
        expectedRevision: 5,
        qtyGood: 10,
        quantityLines: [{ quantityLineId: "quantity-qc-1", qtyGood: 10 }],
        defects: [{
          quantityLineId: "quantity-qc-1",
          qty: 1,
          reason: "PRINT_PEEL",
          disposition: "HOLD",
        }],
        userId: "worker-1",
      }),
    ).rejects.toThrow("เกินจำนวนคงเหลือของ quantity line");
    expect(tx.qcRecord.create).not.toHaveBeenCalled();
    expect(tx.operationQuantity.update).not.toHaveBeenCalled();
  });

  it("รับ planned 10 เป็น good 9 + rework 1 โดยผูก line เดียวกัน", async () => {
    const { prisma, tx } = harness();
    await createQcRecord(prisma, {
      orderId: "order-1",
      idempotencyKey: "qc-v2-nine-one-1",
      operationJobId: "operation-qc-1",
      expectedRevision: 5,
      qtyGood: 9,
      quantityLines: [{ quantityLineId: "quantity-qc-1", qtyGood: 9 }],
      defects: [{
        quantityLineId: "quantity-qc-1",
        qty: 1,
        reason: "PRINT_PEEL",
        disposition: "REWORK",
      }],
      userId: "worker-1",
    });
    expect(tx.operationQuantity.update).toHaveBeenCalledWith({
      where: { id: "quantity-qc-1" },
      data: {
        qtyGood: { increment: 9 },
        qtyScrap: { increment: 0 },
        qtyRework: { increment: 1 },
        revision: { increment: 1 },
      },
    });
  });
});
