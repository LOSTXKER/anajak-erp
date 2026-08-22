import { describe, expect, it, vi } from "vitest";

import type { ExtendedPrismaClient } from "@/lib/prisma";
import { releaseManufacturingWorkOrder } from "./manufacturing-commands";

type LedgerRow = {
  commandType: string;
  requestHash: string;
  status: "PENDING" | "SUCCEEDED";
  result: unknown;
  errorCode: null;
  errorMessage: null;
};

function approvedDesign(versionNumber: number) {
  return {
    id: `design-${versionNumber}`,
    versionNumber,
    fileUrl: `/mockup-v${versionNumber}.png`,
    thumbnailUrl: `/mockup-v${versionNumber}-thumb.png`,
    approvedAt: new Date(`2026-08-${20 + versionNumber}T03:00:00.000Z`),
    files: [
      {
        fileUrl: `/mockup-v${versionNumber}-front.png`,
        thumbnailUrl: null,
        position: "FRONT",
        caption: "ด้านหน้า",
      },
    ],
  };
}

function designSnapshot(design: ReturnType<typeof approvedDesign>) {
  return JSON.parse(
    JSON.stringify({
      designId: design.id,
      versionNumber: design.versionNumber,
      fileUrl: design.fileUrl,
      thumbnailUrl: design.thumbnailUrl,
      approvedAt: design.approvedAt,
      files: design.files,
    }),
  ) as Record<string, unknown>;
}

function releaseHarness(options?: {
  orderStatus?:
    | "CONFIRMED"
    | "DESIGNING"
    | "DESIGN_APPROVED"
    | "PRODUCTION_QUEUE"
    | "PRODUCING";
  currentDesign?: ReturnType<typeof approvedDesign> | null;
}) {
  const firstDesign = approvedDesign(1);
  const currentDesign =
    options && "currentDesign" in options
      ? options.currentDesign
      : approvedDesign(2);
  const ledger = new Map<string, LedgerRow>();
  const production = {
    id: "production-1",
    workOrderNumber: "MO-2608-0001",
    workOrderState: "DRAFT" as "DRAFT" | "RELEASED",
    routingVersionId: "routing-version-1",
    revision: 7,
    routingSnapshot: { versionId: "routing-version-1" },
    instructionSnapshot: { operations: [] },
    approvedMockupSnapshot: designSnapshot(firstDesign),
    snapshots: [{ version: 1 }],
    order: {
      internalStatus: options?.orderStatus ?? "PRODUCING",
      designs: currentDesign ? [currentDesign] : [],
    },
    routingVersion: {
      state: "RELEASED",
      operations: [{ id: "routing-prep" }, { id: "routing-pack" }],
    },
    steps: [
      {
        id: "step-prep",
        operationCode: "PREP",
        operationName: "เตรียมงาน",
        workCenterId: "center-prep",
        routingOperationId: "routing-prep",
        qtyPlanned: 10,
        referenceSnapshot: {
          routingOperationId: "routing-prep",
          approvedMockup: designSnapshot(firstDesign),
        },
        workCenter: { isActive: true },
        predecessorLinks: [],
      },
      {
        id: "step-pack",
        operationCode: "FINAL_PACK",
        operationName: "แพ็กสุดท้าย",
        workCenterId: "center-pack",
        routingOperationId: "routing-pack",
        qtyPlanned: 10,
        referenceSnapshot: {
          routingOperationId: "routing-pack",
          approvedMockup: designSnapshot(firstDesign),
        },
        workCenter: { isActive: true },
        predecessorLinks: [{ predecessorStepId: "step-prep" }],
      },
    ],
  };
  const productionUpdate = vi.fn(
    async ({ data }: { data: Record<string, unknown> }) => {
      production.workOrderState = "RELEASED";
      production.revision += 1;
      production.approvedMockupSnapshot = data.approvedMockupSnapshot as Record<
        string,
        unknown
      >;
      return {
        id: production.id,
        workOrderNumber: production.workOrderNumber,
        workOrderState: production.workOrderState,
        revision: production.revision,
      };
    },
  );
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    manufacturingCommand: {
      findUnique: vi.fn(
        async ({ where }: { where: { commandId: string } }) =>
          ledger.get(where.commandId) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: LedgerRow & { commandId: string } }) => {
        ledger.set(data.commandId, {
          commandType: data.commandType,
          requestHash: data.requestHash,
          status: "PENDING",
          result: null,
          errorCode: null,
          errorMessage: null,
        });
        return { id: "ledger-1" };
      }),
      update: vi.fn(
        async ({ where, data }: { where: { commandId: string }; data: Record<string, unknown> }) => {
          const row = ledger.get(where.commandId)!;
          ledger.set(where.commandId, {
            ...row,
            status: "SUCCEEDED",
            result: data.result,
          });
          return { id: "ledger-1" };
        },
      ),
    },
    production: {
      findUnique: vi.fn().mockResolvedValue({
        id: production.id,
        orderId: "order-1",
      }),
      findUniqueOrThrow: vi.fn(async () => production),
      update: productionUpdate,
    },
    productionStep: {
      update: vi.fn().mockResolvedValue({ id: "step-1" }),
    },
    operationJobDependency: {
      findMany: vi.fn().mockResolvedValue([
        {
          predecessorStepId: "step-prep",
          successorStepId: "step-pack",
        },
      ]),
    },
    manufacturingReferenceSnapshot: {
      create: vi.fn().mockResolvedValue({ id: "snapshot-release" }),
    },
    operationEvent: {
      create: vi.fn().mockResolvedValue({ id: "event-1" }),
    },
    order: {
      findUniqueOrThrow: vi.fn(async () => ({
        orderType: "CUSTOM",
        internalStatus: production.order.internalStatus,
      })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    orderRevision: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "revision-1" }),
    },
  };
  const prisma = {
    $transaction: vi.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  } as unknown as ExtendedPrismaClient;
  return { prisma, tx, production, currentDesign, productionUpdate };
}

describe("manufacturing release state and approved snapshot", () => {
  it.each(["CONFIRMED", "DESIGNING"] as const)(
    "ไม่ปล่อยใบผลิตเมื่อออเดอร์ถอยไป %s",
    async (orderStatus) => {
      const { prisma, tx } = releaseHarness({ orderStatus });

      await expect(
        releaseManufacturingWorkOrder(prisma, {
          workOrderId: "production-1",
          commandId: `release-invalid-status-${orderStatus}`,
          expectedRevision: 7,
          actorId: "manager-1",
        }),
      ).rejects.toThrow("ออเดอร์ยังไม่พร้อมเริ่มผลิต");

      expect(tx.productionStep.update).not.toHaveBeenCalled();
      expect(tx.production.update).not.toHaveBeenCalled();
      expect(tx.manufacturingReferenceSnapshot.create).not.toHaveBeenCalled();
      expect(tx.operationEvent.create).not.toHaveBeenCalled();
    },
  );

  it("ไม่ปล่อยใบผลิตเมื่อไม่มีแบบอนุมัติปัจจุบัน", async () => {
    const { prisma, tx } = releaseHarness({ currentDesign: null });

    await expect(
      releaseManufacturingWorkOrder(prisma, {
        workOrderId: "production-1",
        commandId: "release-without-approved-design",
        expectedRevision: 7,
        actorId: "manager-1",
      }),
    ).rejects.toThrow("ยังไม่มีแบบอนุมัติล่าสุด");

    expect(tx.productionStep.update).not.toHaveBeenCalled();
    expect(tx.production.update).not.toHaveBeenCalled();
    expect(tx.manufacturingReferenceSnapshot.create).not.toHaveBeenCalled();
  });

  it("refresh แบบล่าสุดตอน release แล้วไม่ยอมเปลี่ยน snapshot หลังปล่อยใบผลิต", async () => {
    const { prisma, tx, production, currentDesign } = releaseHarness();
    const expectedSnapshot = designSnapshot(currentDesign!);

    await expect(
      releaseManufacturingWorkOrder(prisma, {
        workOrderId: "production-1",
        commandId: "release-refresh-approved-design",
        expectedRevision: 7,
        actorId: "manager-1",
      }),
    ).resolves.toMatchObject({
      id: "production-1",
      workOrderState: "RELEASED",
      revision: 8,
    });

    expect(tx.production.update).toHaveBeenCalledWith({
      where: { id: "production-1" },
      data: expect.objectContaining({
        workOrderState: "RELEASED",
        approvedMockupSnapshot: expectedSnapshot,
      }),
      select: expect.any(Object),
    });
    expect(tx.productionStep.update).toHaveBeenCalledTimes(2);
    for (const call of tx.productionStep.update.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            referenceSnapshot: expect.objectContaining({
              approvedMockup: expectedSnapshot,
            }),
          }),
        }),
      );
    }
    expect(tx.manufacturingReferenceSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productionId: "production-1",
        kind: "APPROVED_MOCKUP",
        version: 2,
        sourceEntityId: currentDesign!.id,
        payload: expectedSnapshot,
      }),
    });

    production.order.designs = [approvedDesign(3)];
    await expect(
      releaseManufacturingWorkOrder(prisma, {
        workOrderId: "production-1",
        commandId: "release-cannot-refresh-after-release",
        expectedRevision: 8,
        actorId: "manager-1",
      }),
    ).rejects.toThrow("เฉพาะใบสั่งผลิตสถานะร่าง");

    expect(tx.production.update).toHaveBeenCalledOnce();
    expect(tx.productionStep.update).toHaveBeenCalledTimes(2);
    expect(tx.manufacturingReferenceSnapshot.create).toHaveBeenCalledOnce();
    expect(production.approvedMockupSnapshot).toEqual(expectedSnapshot);
  });
});
