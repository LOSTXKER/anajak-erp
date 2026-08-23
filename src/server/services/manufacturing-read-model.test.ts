import { describe, expect, it, vi } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import {
  getManufacturingControlList,
  getManufacturingExceptionList,
  getManufacturingStationDispatch,
  getManufacturingStationHandoff,
  getManufacturingStationJob,
  getManufacturingStationOrderContext,
  getManufacturingWorkOrder,
  getManufacturingWorkCenterLoad,
} from "./manufacturing-read-model";

function stationRow(
  id: string,
  operationState: "READY" | "RUNNING" | "BLOCKED",
  assignedToId: string | null,
) {
  return {
    id,
    operationCode: "PREP",
    operationName: "เตรียมเสื้อ",
    operationState,
    executionMode: "IN_HOUSE",
    executionEnabled: true,
    dispatchSequence: 1,
    revision: 0,
    qtyPlanned: 10,
    qtyGood: 0,
    qtyScrap: 0,
    qtyRework: 0,
    plannedStartAt: null,
    plannedEndAt: null,
    readyAt: new Date("2026-08-22T00:00:00.000Z"),
    startedAt: operationState === "RUNNING" ? new Date("2026-08-22T01:00:00.000Z") : null,
    completedAt: null,
    assignedToId,
    assignedTo: assignedToId ? { id: assignedToId, name: assignedToId } : null,
    workCenter: {
      id: "wc-prep",
      code: "PREP",
      name: "เตรียมงาน",
      isActive: true,
      resources: [],
    },
    workResource: null,
    exceptions: [],
    instructionSnapshot: { text: "ตรวจจำนวนตามใบงาน" },
    referenceSnapshot: null,
    quantities: [],
    predecessorLinks: [],
    sourceReworkCases: [],
    production: {
      id: "production-1",
      workOrderNumber: "MO-001",
      workOrderState: "IN_PROGRESS",
      revision: 1,
      approvedMockupSnapshot: null as unknown,
      order: {
        id: "order-1",
        orderNumber: "ORD-001",
        title: "เสื้อทีม",
        deadline: new Date("2026-08-30T00:00:00.000Z"),
        priority: "HIGH",
        internalStatus: "PRODUCING",
        customer: { name: "ลูกค้า" },
        designs: [] as Array<Record<string, unknown>>,
        items: [],
      },
    },
  };
}

function controlRow(id: string, priority: string) {
  return {
    id,
    workOrderNumber: `MO-${id}`,
    workOrderState: "RELEASED",
    revision: 0,
    plannedStartAt: null,
    plannedEndAt: null,
    updatedAt: new Date("2026-08-22T00:00:00.000Z"),
    order: {
      id: `order-${id}`,
      orderNumber: `ORD-${id}`,
      title: id,
      deadline: new Date("2026-08-30T00:00:00.000Z"),
      priority,
      internalStatus: "PRODUCTION_QUEUE",
      customer: { name: "ลูกค้า" },
    },
    steps: [],
    exceptions: [],
  };
}

const access = {
  actorId: "supervisor-1",
  canOperate: true,
  canSupervise: true,
};

describe("manufacturing station read model", () => {
  it("พนักงานที่ไม่เป็น active member เปิดศูนย์/งาน Station ไม่ได้", async () => {
    const row = stationRow("ready-1", "READY", null);
    const prisma = {
      workCenter: {
        findUnique: vi.fn().mockResolvedValue({
          id: "wc-prep",
          code: "PREP",
          name: "เตรียมงาน",
          isActive: true,
        }),
      },
      workCenterMember: { findUnique: vi.fn().mockResolvedValue(null) },
      productionStep: { findUnique: vi.fn().mockResolvedValue(row) },
    } as unknown as ExtendedPrismaClient;
    const workerAccess = {
      actorId: "worker-1",
      canOperate: true,
      canSupervise: false,
    };

    await expect(
      getManufacturingStationDispatch(
        prisma,
        { workCenterCode: "PREP", limit: 10 },
        workerAccess,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      getManufacturingStationJob(prisma, "ready-1", workerAccess),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it.each([
    ["CANCELLED", "PRODUCING"],
    ["IN_PROGRESS", "ON_HOLD"],
    ["COMPLETED", "PACKING"],
    ["IN_PROGRESS", "CANCELLED"],
  ] as const)(
    "stationJob ไม่คืนงานเมื่อใบผลิตเป็น %s หรือออเดอร์เป็น %s",
    async (workOrderState, internalStatus) => {
      const row = stationRow("inactive-1", "RUNNING", "supervisor-1");
      row.production.workOrderState = workOrderState;
      row.production.order.internalStatus = internalStatus;
      const prisma = {
        productionStep: { findUnique: vi.fn().mockResolvedValue(row) },
      } as unknown as ExtendedPrismaClient;

      await expect(
        getManufacturingStationJob(prisma, "inactive-1", access),
      ).resolves.toBeNull();
    },
  );

  it("stationJob ไม่คืนงานจากศูนย์งานที่ปิดใช้งาน", async () => {
    const row = stationRow("inactive-center", "READY", null);
    row.workCenter.isActive = false;
    const prisma = {
      productionStep: { findUnique: vi.fn().mockResolvedValue(row) },
      workCenterMember: { findUnique: vi.fn() },
    } as unknown as ExtendedPrismaClient;

    await expect(
      getManufacturingStationJob(prisma, "inactive-center", access),
    ).resolves.toBeNull();
    expect(prisma.workCenterMember.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    [false, "AVAILABLE"],
    [true, "DOWN"],
    [true, "INACTIVE"],
  ] as const)(
    "stationJob ไม่คืนงานเมื่อเครื่องพร้อมใช้เป็น %s และสถานะเป็น %s",
    async (isActive, state) => {
      const row = {
        ...stationRow("unavailable-resource", "READY", null),
        workResource: {
          id: "resource-1",
          code: "PRESS-1",
          name: "เครื่องรีด 1",
          isActive,
          state,
        },
      };
      const prisma = {
        productionStep: { findUnique: vi.fn().mockResolvedValue(row) },
      } as unknown as ExtendedPrismaClient;

      await expect(
        getManufacturingStationJob(prisma, "unavailable-resource", access),
      ).resolves.toBeNull();
    },
  );

  it("workCenterLoad ยังเห็นครบและส่ง availableForStation แยกตามสมาชิก", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "wc-prep",
        code: "PREP",
        name: "เตรียมงาน",
        capacityUnit: "PIECE",
        capacityPerDay: null,
        resources: [],
        members: [{ id: "member-1" }],
        operationJobs: [],
        exceptions: [],
      },
      {
        id: "wc-dtf",
        code: "DTF_PRINT",
        name: "พิมพ์ DTF",
        capacityUnit: "PIECE",
        capacityPerDay: null,
        resources: [],
        members: [],
        operationJobs: [],
        exceptions: [],
      },
    ]);
    const prisma = {
      workCenter: {
        findMany,
      },
    } as unknown as ExtendedPrismaClient;
    const result = await getManufacturingWorkCenterLoad(
      prisma,
      new Date("2026-08-22T00:00:00.000Z"),
      { actorId: "worker-1", canOperate: true, canSupervise: false },
    );
    expect(result.map((center) => center.availableForStation)).toEqual([
      true,
      false,
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          resources: expect.objectContaining({
            where: {
              isActive: true,
              state: { notIn: ["DOWN", "INACTIVE"] },
            },
          }),
          operationJobs: expect.objectContaining({
            where: expect.objectContaining({
              production: {
                workOrderState: { in: ["RELEASED", "IN_PROGRESS"] },
                order: {
                  internalStatus: {
                    in: [
                      "PRODUCTION_QUEUE",
                      "PRODUCING",
                      "QUALITY_CHECK",
                      "PACKING",
                    ],
                  },
                },
              },
              AND: [{
                OR: [
                  { workResourceId: null },
                  {
                    workResource: {
                      is: {
                        isActive: true,
                        state: { in: ["AVAILABLE", "IN_USE"] },
                      },
                    },
                  },
                ],
              }],
            }),
          }),
        }),
      }),
    );
  });

  it("current เป็น RUNNING ของ actor และไม่กิน slot/nextCursor ของ queue", async () => {
    const current = stationRow("current", "RUNNING", "supervisor-1");
    const otherRunning = stationRow("other-running", "RUNNING", "worker-2");
    const ready1 = stationRow("ready-1", "READY", null);
    const ready2 = stationRow("ready-2", "READY", null);
    const blocked = stationRow("blocked-1", "BLOCKED", null);
    const rowsByState = {
      RUNNING: [otherRunning],
      READY: [ready1, ready2],
      BLOCKED: [blocked],
    };
    const productionStep = {
      findFirst: vi.fn().mockResolvedValue(current),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = [...rowsByState.RUNNING, ...rowsByState.READY, ...rowsByState.BLOCKED]
          .find((item) => item.id === where.id);
        return row ? { operationState: row.operationState } : null;
      }),
      findMany: vi.fn(async (args: {
        where: { operationState: keyof typeof rowsByState };
        cursor?: { id: string };
        take: number;
      }) => {
        const bucket = rowsByState[args.where.operationState];
        const cursorIndex = args.cursor
          ? bucket.findIndex((row) => row.id === args.cursor?.id) + 1
          : 0;
        return bucket.slice(cursorIndex, cursorIndex + args.take);
      }),
    };
    const prisma = {
      workCenter: {
        findUnique: vi.fn().mockResolvedValue({
          id: "wc-prep",
          code: "PREP",
          name: "เตรียมงาน",
          isActive: true,
        }),
      },
      productionStep,
    } as unknown as ExtendedPrismaClient;

    const result = await getManufacturingStationDispatch(
      prisma,
      { workCenterCode: "PREP", limit: 2 },
      access,
    );

    expect(result?.currentJob?.operation.id).toBe("current");
    expect(result?.queue.map((job) => job.operation.id)).toEqual([
      "other-running",
      "ready-1",
    ]);
    expect(result?.nextCursor).toBe("ready-1");
    expect(productionStep.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          operationState: "RUNNING",
          assignedToId: "supervisor-1",
          production: {
            workOrderState: { in: ["RELEASED", "IN_PROGRESS"] },
            order: {
              internalStatus: {
                in: ["PRODUCTION_QUEUE", "PRODUCING", "QUALITY_CHECK", "PACKING"],
              },
            },
          },
        }),
      }),
    );
    expect(productionStep.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        where: expect.objectContaining({
          id: { not: "current" },
          operationState: "RUNNING",
        }),
      }),
    );

    const second = await getManufacturingStationDispatch(
      prisma,
      { workCenterCode: "PREP", limit: 2, cursor: "ready-1" },
      access,
    );
    expect(second?.queue.map((job) => job.operation.id)).toEqual([
      "ready-2",
      "blocked-1",
    ]);
    expect(second?.nextCursor).toBeNull();
  });

  it("Station DTO ไม่มี key ราคา/ต้นทุน/ยอดเงินโดยโครงสร้าง", async () => {
    const prisma = {
      workCenter: {
        findUnique: vi.fn().mockResolvedValue({
          id: "wc-prep",
          code: "PREP",
          name: "เตรียมงาน",
          isActive: true,
        }),
      },
      productionStep: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn(async (args: { where: { operationState: string } }) =>
          args.where.operationState === "READY"
            ? [{
                ...stationRow("ready-1", "READY", null),
                instructionSnapshot: {
                  text: "ตรวจจำนวนตามใบงาน",
                  unitPrice: 120,
                  nested: { productionNote: "ใช้ถุงใส", cost: 50 },
                },
                referenceSnapshot: { sku: "SKU-1", margin: 20 },
                production: {
                  ...stationRow("ready-1", "READY", null).production,
                  approvedMockupSnapshot: { imageUrl: "/mockup.png", totalAmount: 999 },
                },
              }]
            : [],
        ),
      },
    } as unknown as ExtendedPrismaClient;
    const result = await getManufacturingStationDispatch(
      prisma,
      { workCenterCode: "PREP", limit: 10 },
      access,
    );
    const serialized = JSON.stringify(result).toLowerCase();
    expect(serialized).not.toMatch(/unitprice|cost|amount|margin/);
    expect(serialized).toContain("productionnote");
    expect(JSON.stringify(result?.queue[0]?.approvedMockupSnapshot).toLowerCase())
      .not.toMatch(/price|cost|amount|total|margin/);
  });

  it("Station คงแบบ snapshot ตอนปล่อย v1 แม้ออเดอร์มีแบบอนุมัติ v2 ภายหลัง", async () => {
    const row = stationRow("released-v1", "READY", null);
    row.production.approvedMockupSnapshot = {
      designId: "design-v1",
      versionNumber: 1,
      fileUrl: "/mockups/v1.png",
      files: [{ fileUrl: "/mockups/v1-front.png", position: "FRONT" }],
    };
    row.production.order.designs = [{
      id: "design-v2",
      versionNumber: 2,
      fileUrl: "/mockups/v2.png",
      files: [{ fileUrl: "/mockups/v2-front.png", position: "FRONT" }],
    }];
    const findUnique = vi.fn().mockResolvedValue(row);
    const prisma = {
      productionStep: { findUnique },
    } as unknown as ExtendedPrismaClient;

    const result = await getManufacturingStationJob(
      prisma,
      "released-v1",
      access,
    );

    expect(result?.approvedMockupSnapshot).toEqual(
      expect.objectContaining({
        designId: "design-v1",
        versionNumber: 1,
        fileUrl: "/mockups/v1.png",
      }),
    );
    expect(result).not.toHaveProperty("approvedMockups");
    expect(JSON.stringify(result)).not.toContain("/mockups/v2");
    const select = findUnique.mock.calls[0]?.[0]?.select;
    expect(select.production.select.order.select).not.toHaveProperty("designs");
  });

  it("PREP ซ่อนปุ่มปิดงานจนคืนเสื้อลูกค้าส่วนเกินครบ", async () => {
    const prepPrisma = (returned: number) => {
      const row = stationRow("prep-running", "RUNNING", "supervisor-1");
      row.qtyGood = 10;
      return {
        productionStep: { findUnique: vi.fn().mockResolvedValue(row) },
        order: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: "order-1",
            orderNumber: "ORD-001",
            items: [],
          }),
        },
        orderItemProduct: {
          findMany: vi.fn().mockResolvedValue([{
            id: "customer-product-1",
            variants: [{ size: "M", color: "ดำ", quantity: 10 }],
          }]),
        },
        goodsReceiptLine: {
          findMany: vi.fn().mockResolvedValue([
            {
              orderItemProductId: "customer-product-1",
              size: "M",
              color: "ดำ",
              qtyCounted: 13,
              receipt: { receiptType: "CUSTOMER_GARMENT" },
            },
            ...(returned > 0
              ? [{
                  orderItemProductId: "customer-product-1",
                  size: "M",
                  color: "ดำ",
                  qtyCounted: returned,
                  receipt: { receiptType: "CUSTOMER_RETURN" },
                }]
              : []),
          ]),
        },
      } as unknown as ExtendedPrismaClient;
    };

    const outstanding = await getManufacturingStationJob(
      prepPrisma(0),
      "prep-running",
      access,
    );
    expect(outstanding?.operation.availableCommands).not.toContain(
      "completeOperation",
    );
    expect(outstanding?.operation.blockers).toContainEqual(
      expect.objectContaining({
        title: "ยังมีเสื้อส่วนเกินค้างอยู่ 3 ตัว กรุณาคืนส่วนเกินก่อนปิดงาน",
      }),
    );
    expect(outstanding?.prepGarmentSurplus).toMatchObject({
      customerSurplusQty: 3,
      totalSurplusQty: 3,
    });

    const cleared = await getManufacturingStationJob(
      prepPrisma(3),
      "prep-running",
      access,
    );
    expect(cleared?.operation.availableCommands).toContain(
      "completeOperation",
    );
    expect(cleared?.prepGarmentSurplus).toMatchObject({
      customerSurplusQty: 0,
      totalSurplusQty: 0,
    });
  });

  it("handoff และ order QR คืนเฉพาะ Station-safe DTO ไม่เรียก Control Record", async () => {
    const row = {
      ...stationRow("ready-next", "READY", null),
      instructionSnapshot: { text: "ทำงานต่อ", unitCost: 120 },
      referenceSnapshot: { color: "ดำ", totalAmount: 999 },
    };
    const findMany = vi.fn().mockResolvedValue([row]);
    const prisma = {
      productionStep: { findMany },
    } as unknown as ExtendedPrismaClient;

    const handoff = await getManufacturingStationHandoff(
      prisma,
      { workOrderId: "production-1", completedOperationId: "done-1" },
      access,
    );
    const qrContext = await getManufacturingStationOrderContext(
      prisma,
      "order-1",
      access,
    );

    expect(JSON.stringify({ handoff, qrContext }).toLowerCase()).not.toMatch(
      /unitcost|amount|price|margin/,
    );
    expect(handoff[0]?.operation.instructionSnapshot).toEqual({ text: "ทำงานต่อ" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productionId: "production-1",
          production: expect.objectContaining({
            workOrderState: { in: ["RELEASED", "IN_PROGRESS"] },
          }),
          id: { not: "done-1" },
          executionMode: "IN_HOUSE",
        }),
      }),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          production: expect.objectContaining({
            orderId: "order-1",
            workOrderState: { in: ["RELEASED", "IN_PROGRESS"] },
          }),
          executionMode: "IN_HOUSE",
        }),
      }),
    );
  });

  it("stationJob ส่ง itemSource และ rework ที่รอตรวจซ้ำให้ Station", async () => {
    const baseRow = stationRow("qc-1", "RUNNING", "supervisor-1");
    const row = {
      ...baseRow,
      operationCode: "FINAL_QC",
      production: {
        ...baseRow.production,
        order: {
          ...baseRow.production.order,
          items: [{
            id: "item-1",
            products: [{
              description: "เสื้อลูกค้า",
              productType: "TSHIRT",
              itemSource: "CUSTOMER_PROVIDED",
              fabricColor: "ดำ",
              totalQuantity: 1,
              variants: [],
            }],
            prints: [],
          }],
        },
      },
      sourceReworkCases: [{
        id: "rework-1",
        state: "AWAITING_REINSPECTION",
        qty: 1,
        reason: "รีดไม่ติด",
        requiresReinspection: true,
        revision: 2,
        sourceQcRecordId: "qc-record-1",
        sourceQcDefectId: "qc-defect-1",
        sourceQcDefect: {
          id: "qc-defect-1",
          operationQuantityId: "quantity-qc-1",
          qty: 1,
          disposition: "REWORK",
        },
        sourceExceptionId: null,
        targetWorkCenter: { id: "wc-heat", code: "HEAT_PRESS", name: "รีดร้อน" },
      }],
    };
    const prisma = {
      productionStep: { findUnique: vi.fn().mockResolvedValue(row) },
    } as unknown as ExtendedPrismaClient;

    const result = await getManufacturingStationJob(prisma, "qc-1", access);
    expect(result?.workGroups[0]?.products[0]?.itemSource).toBe("CUSTOMER_PROVIDED");
    expect(result?.sourceReworkCases).toEqual([
      expect.objectContaining({
        id: "rework-1",
        state: "AWAITING_REINSPECTION",
        sourceQcDefect: {
          id: "qc-defect-1",
          quantityLineId: "quantity-qc-1",
          qty: 1,
          disposition: "REWORK",
        },
      }),
    ]);
    expect(result?.availableCommands).toContain("reinspectQuality");
  });

  it("workOrder ส่ง source QC defect และ quantity line โดยไม่ให้ UI parse exception code", async () => {
    const sourceQcDefect = {
      id: "qc-defect-1",
      operationQuantityId: "quantity-qc-1",
      qty: 2,
      disposition: "REWORK",
    };
    const holdQcDefect = {
      id: "qc-defect-hold",
      operationQuantityId: "quantity-qc-hold",
      qty: 1,
      disposition: "HOLD",
    };
    const productionRow = {
          id: "production-1",
          workOrderNumber: "MO-001",
          workOrderState: "IN_PROGRESS",
          revision: 4,
          plannedStartAt: null,
          plannedEndAt: null,
          releasedAt: new Date("2026-08-22T00:00:00.000Z"),
          routingSnapshot: null,
          instructionSnapshot: null,
          approvedMockupSnapshot: null,
          order: {
            id: "order-1",
            orderNumber: "ORD-001",
            title: "เสื้อทีม",
            deadline: null,
            priority: "HIGH",
            internalStatus: "PRODUCING",
            customer: { name: "ลูกค้า" },
            designs: [],
          },
          steps: [{
            id: "qc-1",
            operationCode: "FINAL_QC",
            operationName: "ตรวจขั้นสุดท้าย",
            operationState: "BLOCKED",
            executionMode: "IN_HOUSE",
            executionEnabled: true,
            routingOperationId: "routing-qc",
            dispatchSequence: 4,
            revision: 2,
            qtyPlanned: 10,
            qtyGood: 7,
            qtyScrap: 0,
            qtyRework: 3,
            plannedStartAt: null,
            plannedEndAt: null,
            readyAt: null,
            startedAt: null,
            completedAt: null,
            assignedToId: null,
            assignedTo: null,
            workCenter: {
              id: "wc-qc",
              code: "FINAL_QC",
              name: "ตรวจขั้นสุดท้าย",
              isActive: true,
              resources: [],
            },
            workResource: null,
            exceptions: [],
            predecessorLinks: [],
          }],
          quantityLines: [],
          events: [],
          exceptions: [
            {
              id: "exception-1",
              productionStepId: "qc-1",
              workCenterId: "wc-qc",
              code: "QC_DEFECT:qc-defect-1",
              title: "QC ไม่ผ่าน",
              description: null,
              severity: "CRITICAL",
              state: "OPEN",
              blocksJob: true,
              disposition: "REWORK",
              sourceQcDefect,
              ownerId: null,
              resolution: null,
              revision: 1,
              createdAt: new Date("2026-08-22T01:00:00.000Z"),
              acknowledgedAt: null,
              resolvedAt: null,
            },
            {
              id: "exception-hold",
              productionStepId: "qc-1",
              workCenterId: "wc-qc",
              code: "QC_DEFECT:qc-defect-hold",
              title: "QC รอตัดสิน",
              description: null,
              severity: "CRITICAL",
              state: "OPEN",
              blocksJob: true,
              disposition: "HOLD",
              sourceQcDefect: holdQcDefect,
              ownerId: null,
              resolution: null,
              revision: 2,
              createdAt: new Date("2026-08-22T02:00:00.000Z"),
              acknowledgedAt: null,
              resolvedAt: null,
            },
          ],
          reworkCases: [{
            id: "rework-1",
            sourceOperationId: "qc-1",
            sourceQcRecordId: "qc-record-1",
            sourceQcDefectId: "qc-defect-1",
            sourceQcDefect,
            sourceExceptionId: "exception-1",
            targetWorkCenterId: "wc-heat",
            targetWorkCenter: {
              code: "HEAT_PRESS",
              isActive: true,
            },
            state: "PLANNED",
            qty: 2,
            reason: "รีดซ้ำ",
            requiresReinspection: true,
            revision: 0,
            releasedAt: null,
            completedAt: null,
          }],
    };
    const prisma = {
      production: {
        findUnique: vi.fn().mockImplementation(async () => productionRow),
      },
      operationJobDependency: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as ExtendedPrismaClient;

    const result = await getManufacturingWorkOrder(
      prisma,
      "production-1",
      access,
    );
    expect(result?.exceptions[0]?.sourceQcDefect).toEqual({
      id: "qc-defect-1",
      quantityLineId: "quantity-qc-1",
      qty: 2,
      disposition: "REWORK",
    });
    expect(result?.reworkCases[0]).toEqual(
      expect.objectContaining({
        sourceQcDefectId: "qc-defect-1",
        sourceQcDefect: {
          id: "qc-defect-1",
          quantityLineId: "quantity-qc-1",
          qty: 2,
          disposition: "REWORK",
        },
      }),
    );
    expect(
      result?.exceptions.find((exception) => exception.id === "exception-hold")
        ?.availableCommands,
    ).toEqual(["decideQcDisposition"]);
    expect(result?.reworkCases[0]?.availableCommands).toEqual([
      "releaseRework",
    ]);
    expect(result?.operations[0]?.availableCommands).toEqual([
      "assignOperation",
      "resequenceOperation",
      "raiseException",
    ]);

    productionRow.workOrderState = "CANCELLED";
    const inactive = await getManufacturingWorkOrder(
      prisma,
      "production-1",
      access,
    );
    expect(
      inactive?.exceptions.find((exception) => exception.id === "exception-hold")
        ?.availableCommands,
    ).toEqual([]);
    expect(
      inactive?.exceptions.find((exception) => exception.id === "exception-1")
        ?.availableCommands,
    ).toEqual(["resolveException"]);
    expect(inactive?.reworkCases[0]?.availableCommands).toEqual([]);
    expect(inactive?.operations[0]?.availableCommands).toEqual([]);

    productionRow.workOrderState = "IN_PROGRESS";
    productionRow.order.internalStatus = "ON_HOLD";
    const heldOrder = await getManufacturingWorkOrder(
      prisma,
      "production-1",
      access,
    );
    expect(heldOrder?.operations[0]?.availableCommands).toEqual([]);

    productionRow.order.internalStatus = "PRODUCING";
    productionRow.steps[0]!.workCenter.isActive = false;
    const inactiveCenter = await getManufacturingWorkOrder(
      prisma,
      "production-1",
      access,
    );
    expect(inactiveCenter?.operations[0]?.availableCommands).toEqual([]);
  });

  it("workOrder เปิด release command เฉพาะเมื่อ readiness เดียวกับ command ผ่าน", async () => {
    const step = {
      id: "step-1",
      operationCode: "PREP",
      operationName: "เตรียมงาน",
      operationState: "PLANNED",
      executionMode: "IN_HOUSE",
      executionEnabled: true,
      routingOperationId: "route-operation-1",
      dispatchSequence: 1,
      revision: 0,
      qtyPlanned: 10,
      qtyGood: 0,
      qtyScrap: 0,
      qtyRework: 0,
      plannedStartAt: null,
      plannedEndAt: null,
      readyAt: null,
      startedAt: null,
      completedAt: null,
      assignedToId: null,
      assignedTo: null,
      workCenter: {
        id: "wc-prep",
        code: "PREP",
        name: "เตรียมงาน",
        isActive: true,
        resources: [],
      },
      workResource: null,
      exceptions: [],
      predecessorLinks: [],
    };
    const finalPackStep = {
      ...step,
      id: "step-pack",
      operationCode: "FINAL_PACK",
      operationName: "แพ็กขั้นสุดท้าย",
      routingOperationId: "route-operation-pack",
      dispatchSequence: 2,
      workCenter: {
        ...step.workCenter,
        id: "wc-pack",
        code: "FINAL_PACK",
        name: "แพ็กขั้นสุดท้าย",
      },
    };
    const draft = {
      id: "production-draft",
      workOrderNumber: "MO-DRAFT",
      workOrderState: "DRAFT",
      revision: 0,
      plannedStartAt: null,
      plannedEndAt: null,
      releasedAt: null,
      routingVersionId: "routing-version-1",
      routingSnapshot: { version: 1 },
      instructionSnapshot: { note: "ทำตามแบบ" },
      approvedMockupSnapshot: null,
      routingVersion: {
        state: "RELEASED",
        operations: [
          { id: "route-operation-1" },
          { id: "route-operation-pack" },
        ],
      },
      order: {
        id: "order-draft",
        orderNumber: "ORD-DRAFT",
        title: "งานร่าง",
        deadline: null,
        priority: "NORMAL",
        internalStatus: "DESIGN_APPROVED",
        customer: { name: "ลูกค้า" },
        designs: [],
      },
      steps: [step, finalPackStep],
      quantityLines: [],
      events: [],
      exceptions: [],
      reworkCases: [],
    };
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce({
        ...draft,
        order: {
          ...draft.order,
          designs: [{ id: "design-v2", versionNumber: 2 }],
        },
      })
      .mockResolvedValueOnce({
        ...draft,
        order: {
          ...draft.order,
          designs: [{ id: "design-v2", versionNumber: 2 }],
        },
      })
      .mockResolvedValueOnce({
        ...draft,
        order: {
          ...draft.order,
          internalStatus: "CONFIRMED",
          designs: [{ id: "design-v2", versionNumber: 2 }],
        },
      });
    const dependency = {
      predecessorStepId: "step-1",
      successorStepId: "step-pack",
    };
    const prisma = {
      production: { findUnique },
      operationJobDependency: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([dependency])
          .mockResolvedValueOnce([dependency])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([dependency]),
      },
    } as unknown as ExtendedPrismaClient;

    const blocked = await getManufacturingWorkOrder(
      prisma,
      "production-draft",
      access,
    );
    expect(blocked?.availableCommands).toEqual([]);
    expect(blocked?.releaseBlockers).toContain(
      "ยังไม่มีแบบอนุมัติล่าสุด จึงเริ่มผลิตไม่ได้",
    );

    const ready = await getManufacturingWorkOrder(
      prisma,
      "production-draft",
      access,
    );
    expect(ready?.releaseBlockers).toEqual([]);
    expect(ready?.availableCommands).toEqual(["releaseWorkOrder"]);
    expect(ready?.operations[0]?.availableCommands).toEqual([
      "assignOperation",
      "resequenceOperation",
    ]);

    const secondSink = await getManufacturingWorkOrder(
      prisma,
      "production-draft",
      access,
    );
    expect(secondSink?.availableCommands).toEqual([]);
    expect(secondSink?.releaseBlockers).toContain(
      "เส้นทางผลิตมีจุดจบมากกว่าหนึ่งจุด ทุกสายต้องรวมที่ขั้นแพ็กสุดท้าย",
    );

    const wrongOrderState = await getManufacturingWorkOrder(
      prisma,
      "production-draft",
      access,
    );
    expect(wrongOrderState?.availableCommands).toEqual([]);
    expect(wrongOrderState?.releaseBlockers).toContain(
      "สถานะออเดอร์ยังไม่พร้อมเริ่มผลิต",
    );
  });

  it("exceptionList ส่ง HOLD source line และ decideQcDisposition เฉพาะ supervisor", async () => {
    const row = {
      id: "exception-hold",
      productionStepId: "qc-1",
      code: "QC_DEFECT:qc-defect-hold",
      title: "QC รอตัดสิน",
      description: null,
      severity: "CRITICAL",
      state: "OPEN",
      blocksJob: true,
      disposition: "HOLD",
      sourceQcDefect: {
        id: "qc-defect-hold",
        operationQuantityId: "quantity-qc-hold",
        qty: 1,
        disposition: "HOLD",
        reworkCase: null,
      },
      ownerId: null,
      revision: 2,
      createdAt: new Date("2026-08-22T02:00:00.000Z"),
      acknowledgedAt: null,
      resolvedAt: null,
      resolution: null,
      workCenter: { id: "wc-qc", code: "FINAL_QC", name: "ตรวจขั้นสุดท้าย" },
      production: {
        id: "production-1",
        workOrderNumber: "MO-001",
        workOrderState: "IN_PROGRESS",
        order: {
          id: "order-1",
          orderNumber: "ORD-001",
          title: "เสื้อทีม",
          deadline: null,
          priority: "HIGH",
          internalStatus: "PRODUCING",
          customer: { name: "ลูกค้า" },
        },
      },
      productionStep: {
        id: "qc-1",
        executionEnabled: true,
        operationCode: "FINAL_QC",
        operationState: "BLOCKED",
        qtyRework: 0,
        workCenter: {
          code: "FINAL_QC",
          isActive: true,
        },
        sourceReworkCases: [],
      },
    };
    const prisma = {
      productionException: { findMany: vi.fn().mockResolvedValue([row]) },
    } as unknown as ExtendedPrismaClient;

    const supervisor = await getManufacturingExceptionList(
      prisma,
      { limit: 20 },
      access,
    );
    expect(supervisor.items[0]).toMatchObject({
      sourceQcDefect: {
        id: "qc-defect-hold",
        quantityLineId: "quantity-qc-hold",
        qty: 1,
        disposition: "HOLD",
      },
      availableCommands: ["decideQcDisposition"],
    });

    const staff = await getManufacturingExceptionList(
      prisma,
      { limit: 20 },
      { actorId: "worker-1", canOperate: true, canSupervise: false },
    );
    expect(staff.items[0]?.availableCommands).toEqual([]);

    const warningPrisma = {
      productionException: {
        findMany: vi.fn().mockResolvedValue([
          { ...row, id: "exception-warning", blocksJob: false },
        ]),
      },
    } as unknown as ExtendedPrismaClient;
    const warning = await getManufacturingExceptionList(
      warningPrisma,
      { limit: 20 },
      access,
    );
    expect(warning.items[0]?.availableCommands).not.toContain(
      "decideQcDisposition",
    );

    const inactiveParent = {
      ...row,
      production: {
        ...row.production,
        workOrderState: "CANCELLED",
      },
    };
    const inactivePrisma = {
      productionException: {
        findMany: vi.fn().mockResolvedValue([
          inactiveParent,
          {
            ...inactiveParent,
            id: "exception-machine",
            code: "MACHINE_STOP",
            disposition: null,
            sourceQcDefect: null,
          },
        ]),
      },
    } as unknown as ExtendedPrismaClient;
    const inactive = await getManufacturingExceptionList(
      inactivePrisma,
      { limit: 20 },
      access,
    );
    expect(inactive.items[0]?.availableCommands).toEqual([]);
    expect(inactive.items[1]?.availableCommands).toEqual([
      "resolveException",
    ]);
  });
});

describe("manufacturing control list priority pagination", () => {
  it("เรียง URGENT > HIGH > NORMAL > LOW แบบ server-side และ cursor ต่อหน้าไม่ซ้ำ", async () => {
    const calls: Array<{ priority: string; cursor?: string }> = [];
    const findMany = vi.fn(async (args: {
      where: { order: { priority: string } };
      cursor?: { id: string };
    }) => {
      const priority = args.where.order.priority;
      calls.push({ priority, cursor: args.cursor?.id });
      if (priority === "URGENT") return [controlRow("urgent-1", "URGENT")];
      if (priority === "HIGH") {
        return args.cursor
          ? [controlRow("high-2", "HIGH")]
          : [controlRow("high-1", "HIGH"), controlRow("high-2", "HIGH")];
      }
      if (priority === "NORMAL") {
        return [controlRow("normal-1", "NORMAL"), controlRow("normal-2", "NORMAL")];
      }
      return [controlRow("low-1", "LOW")];
    });
    const prisma = {
      production: {
        findMany,
        findUnique: vi.fn().mockResolvedValue({ order: { priority: "HIGH" } }),
      },
    } as unknown as ExtendedPrismaClient;

    const first = await getManufacturingControlList(
      prisma,
      { sort: "priority", limit: 2 },
      access,
    );
    expect(first.items.map((item) => item.order.priority)).toEqual(["URGENT", "HIGH"]);
    expect(first.nextCursor).toBe("high-1");
    expect(calls.map((call) => call.priority)).toEqual(["URGENT", "HIGH"]);

    calls.length = 0;
    const second = await getManufacturingControlList(
      prisma,
      { sort: "priority", limit: 2, cursor: "high-1" },
      access,
    );
    expect(second.items.map((item) => item.id)).toEqual(["high-2", "normal-1"]);
    expect(second.nextCursor).toBe("normal-1");
    expect(calls).toEqual([
      { priority: "HIGH", cursor: "high-1" },
      { priority: "NORMAL", cursor: undefined },
    ]);
  });
});
