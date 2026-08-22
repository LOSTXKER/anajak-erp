import { describe, expect, it, vi } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import { hashManufacturingCommand } from "./manufacturing-command";

import {
  assertCanCreateV2WorkOrder,
  createManufacturingWorkOrder,
  getManufacturingCreationContext,
} from "./manufacturing-work-order";

function creationGateHarness(
  internalStatus: "CONFIRMED" | "DESIGN_APPROVED",
  designs: Array<Record<string, unknown>>,
) {
  const dependency = {
    id: "route-dependency",
    predecessorOperationId: "routing-prep",
    successorOperationId: "routing-pack",
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    manufacturingCommand: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "ledger-1" }),
      update: vi.fn(),
    },
    order: {
      findUnique: vi.fn().mockResolvedValue({
        id: "order-1",
        orderNumber: "ORD-001",
        title: "ออเดอร์ทดสอบ",
        deadline: null,
        internalStatus,
        items: [
          {
            id: "item-1",
            prints: [],
            products: [
              {
                id: "item-product-1",
                description: "เสื้อยืด",
                itemSource: "FROM_STOCK",
                product: { sku: "TS-M" },
                variants: [
                  {
                    id: "variant-1",
                    size: "M",
                    color: "ดำ",
                    quantity: 10,
                  },
                ],
              },
            ],
          },
        ],
        designs,
      }),
      updateMany: vi.fn(),
    },
    production: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    routingVersion: {
      findUnique: vi.fn().mockResolvedValue({
        id: "routing-v1",
        versionNumber: 1,
        state: "RELEASED",
        releasedAt: new Date("2026-08-22T00:00:00.000Z"),
        routing: { id: "routing-1", code: "STANDARD", name: "งานมาตรฐาน" },
        operations: [
          {
            id: "routing-prep",
            operationCode: "PREP",
            name: "เตรียมงาน",
            sequence: 1,
            executionMode: "IN_HOUSE",
            phase: "PREPARATION",
            workCenterId: "center-prep",
            standardMinutes: null,
            instructions: null,
            referenceTemplate: null,
            successorLinks: [dependency],
          },
          {
            id: "routing-pack",
            operationCode: "FINAL_PACK",
            name: "แพ็กสุดท้าย",
            sequence: 2,
            executionMode: "IN_HOUSE",
            phase: "PACKING",
            workCenterId: "center-pack",
            standardMinutes: null,
            instructions: null,
            referenceTemplate: null,
            successorLinks: [],
          },
        ],
      }),
    },
    productionStep: { create: vi.fn() },
    operationQuantity: { createMany: vi.fn() },
    operationJobDependency: { createMany: vi.fn() },
    operationEvent: { create: vi.fn() },
    manufacturingReferenceSnapshot: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  } as unknown as ExtendedPrismaClient;
  return { prisma, tx };
}

describe("manufacturing work order creation boundary", () => {
  it("ไม่สร้างใบผลิตตั้งแต่สถานะยืนยันออเดอร์ เพราะแบบยังไม่พร้อม", async () => {
    const { prisma, tx } = creationGateHarness("CONFIRMED", []);

    await expect(
      createManufacturingWorkOrder(prisma, {
        orderId: "order-1",
        routingVersionId: "routing-v1",
        commandId: "create-before-design-approved",
        expectedRevision: 0,
        actorId: "manager-1",
      }),
    ).rejects.toThrow("ยังไม่อยู่ในช่วงที่เปิดใบสั่งผลิตได้");

    expect(tx.production.findFirst).not.toHaveBeenCalled();
    expect(tx.production.create).not.toHaveBeenCalled();
    expect(tx.productionStep.create).not.toHaveBeenCalled();
    expect(tx.operationEvent.create).not.toHaveBeenCalled();
  });

  it("ไม่สร้างใบผลิตหากสถานะพร้อมแต่ยังไม่มีแบบอนุมัติปัจจุบัน", async () => {
    const { prisma, tx } = creationGateHarness("DESIGN_APPROVED", []);

    await expect(
      createManufacturingWorkOrder(prisma, {
        orderId: "order-1",
        routingVersionId: "routing-v1",
        commandId: "create-without-current-approved-design",
        expectedRevision: 0,
        actorId: "manager-1",
      }),
    ).rejects.toThrow("ยังไม่มีแบบอนุมัติล่าสุด");

    expect(tx.production.create).not.toHaveBeenCalled();
    expect(tx.productionStep.create).not.toHaveBeenCalled();
    expect(tx.operationEvent.create).not.toHaveBeenCalled();
    expect(tx.manufacturingReferenceSnapshot.create).not.toHaveBeenCalled();
  });

  it("บล็อกใบ V2 ใบที่สองจนกว่าจะมี quantity allocation", () => {
    expect(() => assertCanCreateV2WorkOrder(null)).not.toThrow();
    expect(() =>
      assertCanCreateV2WorkOrder({
        id: "production-1",
        workOrderNumber: "MO-2608-0001",
      }),
    ).toThrow("จึงเปิดใบซ้ำไม่ได้");
    expect(() =>
      assertCanCreateV2WorkOrder({
        id: "legacy-production-1",
        workOrderNumber: null,
      }),
    ).toThrow("จึงเปิดใบสั่งผลิตจากหน้านี้ไม่ได้");
  });

  it("ส่งใบผลิตเดิมทุกแบบให้หน้าสร้างเห็นก่อนกดยืนยัน", async () => {
    const legacyProduction = {
      id: "legacy-production-1",
      workOrderNumber: null,
      workOrderState: "DRAFT",
    };
    const findOrder = vi.fn().mockResolvedValue({
      id: "order-1",
      orderNumber: "ORD-001",
      title: "ออเดอร์ทดสอบ",
      deadline: null,
      internalStatus: "PRODUCTION_QUEUE",
      customer: { name: "ลูกค้าทดสอบ" },
      productions: [legacyProduction],
    });
    const prisma = {
      order: { findUnique: findOrder },
      routingVersion: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as ExtendedPrismaClient;

    await expect(
      getManufacturingCreationContext(prisma, "order-1"),
    ).resolves.toMatchObject({ existingWorkOrders: [legacyProduction] });
    expect(findOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          productions: {
            select: {
              id: true,
              workOrderNumber: true,
              workOrderState: true,
            },
          },
        }),
      }),
    );
  });

  it("ปฏิเสธการสร้าง V2 ซ้อนใบผลิตเดิมหลัง lock โดยไม่สร้าง topology หรือ event", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      manufacturingCommand: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ commandId: "create-work-order-legacy" }),
        update: vi.fn(),
      },
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: "order-1",
          orderNumber: "ORD-001",
          title: "ออเดอร์ทดสอบ",
          deadline: null,
          internalStatus: "PRODUCTION_QUEUE",
          items: [],
          designs: [],
        }),
        updateMany: vi.fn(),
      },
      production: {
        findFirst: vi.fn().mockResolvedValue({
          id: "legacy-production-1",
          workOrderNumber: null,
        }),
        create: vi.fn(),
        update: vi.fn(),
      },
      routingVersion: { findUnique: vi.fn() },
      productionStep: { create: vi.fn() },
      operationQuantity: { createMany: vi.fn() },
      operationJobDependency: { createMany: vi.fn() },
      operationEvent: { create: vi.fn() },
      manufacturingReferenceSnapshot: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    } as unknown as ExtendedPrismaClient;

    await expect(
      createManufacturingWorkOrder(prisma, {
        orderId: "order-1",
        routingVersionId: "routing-v1",
        commandId: "create-work-order-legacy",
        expectedRevision: 0,
        actorId: "manager-1",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
    expect(tx.$queryRaw.mock.invocationCallOrder.at(-1)).toBeLessThan(
      tx.production.findFirst.mock.invocationCallOrder[0]!,
    );
    expect(tx.production.findFirst).toHaveBeenCalledWith({
      where: { orderId: "order-1" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, workOrderNumber: true },
    });
    expect(tx.production.create).not.toHaveBeenCalled();
    expect(tx.productionStep.create).not.toHaveBeenCalled();
    expect(tx.operationEvent.create).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it("retry command V2 ที่สำเร็จแล้วคืนผลเดิมก่อนตรวจ topology", async () => {
    const request = {
      orderId: "order-1",
      routingVersionId: "routing-v1",
      commandId: "create-work-order-replay",
      expectedRevision: 0,
      actorId: "manager-1",
    };
    const storedResult = {
      id: "production-v2-1",
      workOrderNumber: "MO-2608-0001",
      workOrderState: "DRAFT",
      revision: 0,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      manufacturingCommand: {
        findUnique: vi.fn().mockResolvedValue({
          commandType: "createWorkOrder",
          requestHash: hashManufacturingCommand({
            commandType: "createWorkOrder",
            expectedRevision: request.expectedRevision,
            actorId: request.actorId,
            payload: request,
          }),
          status: "SUCCEEDED",
          result: storedResult,
          errorCode: null,
          errorMessage: null,
        }),
        create: vi.fn(),
        update: vi.fn(),
      },
      production: { findFirst: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    } as unknown as ExtendedPrismaClient;

    await expect(
      createManufacturingWorkOrder(prisma, request),
    ).resolves.toEqual(storedResult);

    expect(tx.production.findFirst).not.toHaveBeenCalled();
    expect(tx.manufacturingCommand.create).not.toHaveBeenCalled();
  });

  it("ปฏิเสธเส้นทางที่มีสายงานไม่รวมเข้าขั้นแพ็กก่อนสร้างใบผลิต", async () => {
    const dependency = {
      id: "dependency-prep-pack",
      predecessorOperationId: "routing-prep",
      successorOperationId: "routing-pack",
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      manufacturingCommand: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ commandId: "create-invalid-route" }),
        update: vi.fn(),
      },
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: "order-1",
          orderNumber: "ORD-001",
          title: "ออเดอร์ทดสอบ",
          deadline: null,
          internalStatus: "PRODUCTION_QUEUE",
          items: [],
          designs: [],
        }),
        updateMany: vi.fn(),
      },
      production: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
      routingVersion: {
        findUnique: vi.fn().mockResolvedValue({
          id: "routing-v1",
          versionNumber: 1,
          state: "RELEASED",
          releasedAt: new Date("2026-08-22T00:00:00Z"),
          routing: { id: "routing-1", code: "STANDARD", name: "งานมาตรฐาน" },
          operations: [
            {
              id: "routing-prep",
              operationCode: "PREP",
              name: "เตรียมเสื้อ",
              sequence: 1,
              executionMode: "IN_HOUSE",
              phase: "PREPARATION",
              workCenterId: "work-center-prep",
              standardMinutes: null,
              instructions: null,
              referenceTemplate: null,
              successorLinks: [dependency],
            },
            {
              id: "routing-pack",
              operationCode: "FINAL_PACK",
              name: "แพ็กสุดท้าย",
              sequence: 2,
              executionMode: "IN_HOUSE",
              phase: "PACKING",
              workCenterId: "work-center-pack",
              standardMinutes: null,
              instructions: null,
              referenceTemplate: null,
              successorLinks: [],
            },
            {
              id: "routing-detached",
              operationCode: "OUTSOURCE",
              name: "งานร้านนอกที่ไม่ส่งต่อ",
              sequence: 3,
              executionMode: "OUTSOURCE",
              phase: "OUTSOURCE",
              workCenterId: "work-center-outsource",
              standardMinutes: null,
              instructions: null,
              referenceTemplate: null,
              successorLinks: [],
            },
          ],
        }),
      },
      productionStep: { create: vi.fn() },
      operationQuantity: { createMany: vi.fn() },
      operationJobDependency: { createMany: vi.fn() },
      operationEvent: { create: vi.fn() },
      manufacturingReferenceSnapshot: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    } as unknown as ExtendedPrismaClient;

    await expect(
      createManufacturingWorkOrder(prisma, {
        orderId: "order-1",
        routingVersionId: "routing-v1",
        commandId: "create-invalid-route",
        expectedRevision: 0,
        actorId: "manager-1",
      }),
    ).rejects.toThrow("จุดจบมากกว่าหนึ่งจุด");

    expect(tx.routingVersion.findUnique).toHaveBeenCalled();
    expect(tx.production.create).not.toHaveBeenCalled();
    expect(tx.productionStep.create).not.toHaveBeenCalled();
    expect(tx.operationEvent.create).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });
});
