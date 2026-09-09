import { describe, expect, it, vi } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import { createQcRecord } from "./qc";

interface QcDefectFixture {
  qty: number;
  size: string | null;
  color: string | null;
  printLabel: string | null;
  reason: string;
  photoUrls: string[];
  note: string | null;
}

interface QcRecordFixture {
  id: string;
  orderId: string;
  qtyGood: number;
  qtyDefect: number;
  notes: string | null;
  checkedById: string;
  defects: QcDefectFixture[];
}

interface QcCreateDataFixture {
  id: string;
  orderId: string;
  qtyGood: number;
  qtyDefect: number;
  notes?: string;
  checkedById: string;
  defects: { create: Array<Omit<QcDefectFixture, "size" | "color" | "printLabel" | "note"> & {
    size?: string;
    color?: string;
    printLabel?: string;
    note?: string;
  }> };
}

interface RevisionFixture {
  id: string;
  changeType: string;
  newValue: string | null;
  version: number;
}

function createPartialQcFixture() {
  const state: {
    records: QcRecordFixture[];
    revisions: RevisionFixture[];
    audits: Array<{ data: Record<string, unknown> }>;
    failAudit: boolean;
    orphanV2Step: boolean;
  } = { records: [], revisions: [], audits: [], failAudit: false, orphanV2Step: false };
  const items = [{ products: [{
    id: "order-product-1", itemSource: "CUSTOMER_PROVIDED", productId: null,
    description: "เสื้อลูกค้า",
    variants: [{ id: "order-variant-m", size: "M", color: "BLACK", quantity: 10 }],
  }] }];

  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    production: { findMany: vi.fn(async () => state.orphanV2Step
      ? [{ id: "orphan-production", steps: [{ id: "orphan-v2-step" }] }] : []) },
    order: {
      findUniqueOrThrow: vi.fn(async (args: { select: Record<string, unknown> }) => {
        if (args.select.productionCompletionOwnerId) {
          return {
            productionCompletionOwnerId: null,
            productions: state.orphanV2Step ? [{
              workOrderNumber: null, completionOwnerStepId: null,
              steps: [{ executionEnabled: true }],
            }] : [],
          };
        }
        if (args.select.productions) {
          return {
            id: "order-1",
            orderNumber: "ORD-1",
            internalStatus: "QUALITY_CHECK",
            items,
            qcRecords: state.records,
            revisions: state.revisions,
            productions: [],
          };
        }
        return {
          id: "order-1",
          orderNumber: "ORD-1",
          items,
          qcRecords: state.records,
          revisions: state.revisions,
        };
      }),
    },
    product: { findMany: vi.fn().mockResolvedValue([]) },
    materialUsage: { findMany: vi.fn().mockResolvedValue([]) },
    orderRevision: {
      count: vi.fn(async () => state.revisions.length),
      create: vi.fn(async ({ data }: { data: Omit<RevisionFixture, "id" | "newValue"> & { newValue?: string } }) => {
        const revision = { ...data, id: `revision-${data.version}`, newValue: data.newValue ?? null };
        state.revisions.push(revision);
        return revision;
      }),
    },
    qcRecord: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        state.records.find((record) => record.id === where.id) ?? null
      ),
      create: vi.fn(async ({ data }: { data: QcCreateDataFixture }) => {
        const record: QcRecordFixture = {
          id: data.id,
          orderId: data.orderId,
          qtyGood: data.qtyGood,
          qtyDefect: data.qtyDefect,
          notes: data.notes ?? null,
          checkedById: data.checkedById,
          defects: data.defects.create.map((defect) => ({
            qty: defect.qty,
            size: defect.size ?? null,
            color: defect.color ?? null,
            printLabel: defect.printLabel ?? null,
            reason: defect.reason,
            photoUrls: defect.photoUrls,
            note: defect.note ?? null,
          })),
        };
        state.records.push(record);
        return record;
      }),
    },
    auditLog: {
      findFirst: vi.fn(async ({ where }: { where: { entityId: string } }) => {
        const audit = state.audits.find((row) => row.data.entityId === where.entityId);
        return audit ? { newValue: audit.data.newValue } : null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (state.failAudit) throw new Error("audit unavailable");
        const audit = { data };
        state.audits.push(audit);
        return audit;
      }),
    },
  };

  const prisma = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => {
      const recordsBefore = structuredClone(state.records);
      const revisionsBefore = structuredClone(state.revisions);
      const auditsBefore = structuredClone(state.audits);
      try {
        return await callback(tx);
      } catch (error) {
        state.records.splice(0, state.records.length, ...recordsBefore);
        state.revisions.splice(0, state.revisions.length, ...revisionsBefore);
        state.audits.splice(0, state.audits.length, ...auditsBefore);
        throw error;
      }
    }),
  } as unknown as ExtendedPrismaClient;

  return { prisma, state, tx };
}

describe("createQcRecord lifecycle", () => {
  it("ห้ามใช้ QC เดิมเมื่อเหลือขั้น V2 แม้หมายเลขใบและเจ้าของปิดงานหายไป", async () => {
    const { prisma, state, tx } = createPartialQcFixture();
    state.orphanV2Step = true;
    await expect(createQcRecord(prisma, {
      orderId: "order-1", qtyGood: 2, defects: [], userId: "staff-1",
      idempotencyKey: "qc-orphan-v2-0001",
    })).rejects.toThrow("Final QC ในโหมดสถานี");
    expect(tx.qcRecord.create).not.toHaveBeenCalled();
    expect(state.records).toHaveLength(0);
    expect(state.revisions).toHaveLength(0);
    expect(state.audits).toHaveLength(0);
  });

  it("retry key เดิมเป็น no-op และ key ใหม่ยังบันทึก partial รอบถัดไปได้", async () => {
    const { prisma, state } = createPartialQcFixture();
    const firstInput = {
      orderId: "order-1",
      qtyGood: 2,
      defects: [],
      userId: "staff-1",
      idempotencyKey: "qc-partial-0001",
    } as Parameters<typeof createQcRecord>[1];

    const first = await createQcRecord(prisma, firstInput);
    const retry = await createQcRecord(prisma, firstInput);
    const next = await createQcRecord(prisma, {
      ...firstInput,
      qtyGood: 3,
      idempotencyKey: "qc-partial-0002",
    });

    expect(retry.record.id).toBe(first.record.id);
    expect(retry).toMatchObject({ alreadyRecorded: true, movedToPacking: false });
    expect(next).toMatchObject({ alreadyRecorded: false, movedToPacking: false });
    expect(state.records.map((record) => record.qtyGood)).toEqual([2, 3]);
    expect(state.revisions.map((revision) => JSON.parse(revision.newValue!))).toEqual([
      expect.objectContaining({ qcRecordId: first.record.id, lines: [{ variantId: "order-variant-m", qtyGood: 2 }] }),
      expect.objectContaining({ qcRecordId: next.record.id, lines: [{ variantId: "order-variant-m", qtyGood: 3 }] }),
    ]);
    expect(state.audits).toHaveLength(2);
    expect(JSON.stringify(first)).not.toMatch(/price|cost|amount|money/i);
  });

  it("audit พังต้อง rollback ผล QC และ retry key เดิมต้องบันทึกได้เพียงครั้งเดียว", async () => {
    const { prisma, state } = createPartialQcFixture();
    const input = {
      orderId: "order-1",
      qtyGood: 2,
      defects: [],
      notes: "ตรวจช่วงเช้า",
      userId: "staff-1",
      idempotencyKey: "qc-audit-0001",
    } as Parameters<typeof createQcRecord>[1];

    state.failAudit = true;
    await expect(createQcRecord(prisma, input)).rejects.toThrow("audit unavailable");
    expect(state.records).toHaveLength(0);
    expect(state.revisions).toHaveLength(0);

    state.failAudit = false;
    await createQcRecord(prisma, input);
    await createQcRecord(prisma, input);

    expect(state.records).toHaveLength(1);
    expect(state.revisions).toHaveLength(1);
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]?.data.newValue).toEqual(
      expect.objectContaining({
        orderId: "order-1",
        qtyGood: 2,
        qtyDefect: 0,
        requestFingerprint: expect.any(String),
      })
    );
    expect(JSON.stringify(state.audits[0]?.data.newValue)).not.toMatch(
      /price|cost|amount|money/i
    );
  });

  it("key เดิมแต่ payload ต่างต้อง reject โดยไม่เพิ่มยอดหรือ audit", async () => {
    const { prisma, state } = createPartialQcFixture();
    const firstInput = {
      orderId: "order-1",
      qtyGood: 2,
      defects: [],
      userId: "staff-1",
      idempotencyKey: "qc-conflict-0001",
    } as Parameters<typeof createQcRecord>[1];

    await createQcRecord(prisma, firstInput);
    await expect(
      createQcRecord(prisma, { ...firstInput, qtyGood: 3 })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(state.records.map((record) => record.qtyGood)).toEqual([2]);
    expect(state.revisions).toHaveLength(1);
    expect(state.audits).toHaveLength(1);
  });

  it("ล็อกออเดอร์ก่อนอ่านยอดเสื้อสด และส่งเข้าแพ็กเมื่อของดีครบแม้เสื้อเผื่อเสีย", async () => {
    const outerOrderRead = vi.fn(async (args: { select?: Record<string, unknown> }) => {
      if (args.select?.items) {
        throw new Error("garment state escaped the locked transaction");
      }
      return { orderNumber: "ORD-1" };
    });
    const outerProductRead = vi.fn();
    const outerUsageRead = vi.fn();
    const lockOrder = vi.fn().mockResolvedValue([]);
    const liveUsageRead = vi.fn().mockResolvedValue([
      {
        productId: "product-1",
        productVariantId: "variant-1",
        quantity: 105,
        movementType: "ISSUE",
      },
    ]);
    const storedRevisions: RevisionFixture[] = [];
    const items = [{ products: [{
      id: "order-product-1", itemSource: "FROM_STOCK", productId: "product-1", description: "เสื้อยืด",
      variants: [{ id: "order-variant-m", size: "M", color: "BLACK", quantity: 100 }],
    }] }];

    const txOrderRead = vi.fn(async (args: { select: Record<string, unknown> }) => {
      if (args.select.revisions) {
        return { items, revisions: storedRevisions, qcRecords: storedRecord ? [storedRecord] : [] };
      }
      if (args.select.productions) {
        return {
          id: "order-1",
          orderNumber: "ORD-1",
          internalStatus: "QUALITY_CHECK",
          items,
          qcRecords: [],
          productions: [],
        };
      }
      if (args.select.orderNumber && args.select.items) {
        return {
          id: "order-1",
          orderNumber: "ORD-1",
          items,
        };
      }
      if (args.select.customerId) {
        return { id: "order-1", customerId: "customer-1", items: [] };
      }
      if (args.select.stockReservationError) {
        return {
          orderType: "CUSTOM",
          internalStatus: "QUALITY_CHECK",
          stockReservationError: null,
        };
      }
      return { orderType: "CUSTOM", internalStatus: "QUALITY_CHECK" };
    });

    let storedRecord: QcRecordFixture | null = null;
    let storedAudit: { newValue: unknown } | null = null;
    let liveStatus = "QUALITY_CHECK";
    const updateOrder = vi.fn(async (args: { data?: { internalStatus?: string } }) => {
      if (args.data?.internalStatus) liveStatus = args.data.internalStatus;
      return { count: 1 };
    });
    const tx = {
      $queryRaw: lockOrder,
      production: { findMany: vi.fn().mockResolvedValue([]) },
      order: {
        findUniqueOrThrow: txOrderRead,
        updateMany: updateOrder,
      },
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "product-1",
            sku: "TEE",
            name: "เสื้อยืด",
            variants: [
              { id: "variant-1", sku: "TEE-M-BLACK", size: "M", color: "BLACK" },
            ],
          },
        ]),
      },
      materialUsage: { findMany: liveUsageRead },
      qcRecord: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
          storedRecord?.id === where.id ? storedRecord : null
        ),
        create: vi.fn(async ({ data }: { data: QcCreateDataFixture }) => {
          storedRecord = {
            id: data.id,
            orderId: data.orderId,
            qtyGood: data.qtyGood,
            qtyDefect: data.qtyDefect,
            notes: data.notes ?? null,
            checkedById: data.checkedById,
            defects: data.defects.create.map((defect) => ({
              ...defect,
              size: defect.size ?? null,
              color: defect.color ?? null,
              printLabel: defect.printLabel ?? null,
              note: defect.note ?? null,
            })),
          };
          return storedRecord;
        }),
      },
      auditLog: {
        findFirst: vi.fn(async () => storedAudit),
        create: vi.fn(async ({ data }: { data: { newValue: unknown } }) => {
          storedAudit = { newValue: data.newValue };
          return { id: "audit-1" };
        }),
      },
      orderRevision: {
        count: vi.fn(async () => storedRevisions.length),
        create: vi.fn(async ({ data }: { data: Omit<RevisionFixture, "id" | "newValue"> & { newValue?: string } }) => {
          const revision = { ...data, id: `revision-${data.version}`, newValue: data.newValue ?? null };
          storedRevisions.push(revision);
          return revision;
        }),
      },
      orderItemPrint: { findMany: vi.fn().mockResolvedValue([]) },
      filmStock: { updateMany: vi.fn() },
    };
    const notificationCreate = vi.fn().mockRejectedValue(new Error("notification unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const userRead = vi.fn().mockResolvedValue([{ id: "manager-1" }]);
    const prisma = {
      order: { findUniqueOrThrow: outerOrderRead },
      product: { findMany: outerProductRead },
      materialUsage: { findMany: outerUsageRead },
      user: { findMany: userRead },
      notification: { create: notificationCreate },
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    } as unknown as ExtendedPrismaClient;

    const input = {
      orderId: "order-1",
      qtyGood: 100,
      defects: [{ qty: 5, reason: "PRINT_PEEL" }],
      userId: "staff-1",
      idempotencyKey: "qc-full-0001",
    } as Parameters<typeof createQcRecord>[1];
    const result = await createQcRecord(prisma, input);
    const retry = await createQcRecord(prisma, input);

    expect(result).toMatchObject({
      qtyDefect: 5,
      spareAvailable: 5,
      reworkOpened: false,
      heldForStock: false,
      movedToPacking: true,
      alreadyRecorded: false,
    });
    expect(retry).toMatchObject({
      record: { id: result.record.id },
      qtyDefect: 5,
      movedToPacking: true,
      alreadyRecorded: true,
    });
    expect(updateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ internalStatus: "PACKING" }) }),
    );
    expect(updateOrder).toHaveBeenCalledTimes(1);
    expect(tx.qcRecord.create).toHaveBeenCalledTimes(1);
    expect(storedRevisions.filter((revision) => revision.changeType === "QC_COUNT")).toHaveLength(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(result.record.id).not.toContain(input.idempotencyKey);
    expect(liveStatus).toBe("PACKING");
    expect(userRead).toHaveBeenCalledTimes(1);
    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "qc defect notification error:",
      expect.objectContaining({ message: "notification unavailable" })
    );
    expect(lockOrder.mock.invocationCallOrder[0]).toBeLessThan(
      liveUsageRead.mock.invocationCallOrder[0],
    );
    expect(outerProductRead).not.toHaveBeenCalled();
    expect(outerUsageRead).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
