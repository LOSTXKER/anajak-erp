import { describe, expect, it, vi } from "vitest";
import type { Role } from "@prisma/client";
import type { Context } from "../trpc";
import { outsourceRouter } from "./outsource";

const REACHED_SERVICE = new Error("reached outsource service");

function context(role: Role, permissionOverrides: unknown = null): Context {
  return {
    prisma: {
      $transaction: vi.fn(async () => {
        throw REACHED_SERVICE;
      }),
      productionStep: {
        findUnique: vi.fn().mockResolvedValue({ executionEnabled: false }),
      },
      outsourceOrder: {
        findUnique: vi.fn().mockResolvedValue({
          productionStep: { executionEnabled: false },
        }),
      },
      vendor: { create: vi.fn().mockResolvedValue({ id: "vendor-1", name: "ร้าน" }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    } as unknown as Context["prisma"],
    userId: "actor-1",
    userRole: role,
    permissionOverrides,
  };
}

const createOrderInput = {
  productionStepId: "step-1",
  vendorId: "vendor-1",
  description: "ปักโลโก้",
  quantity: 10,
  unitCost: 0,
};

function v2ListOrder(options: {
  status?: "DRAFT" | "SENT" | "RECEIVED_BACK";
  orderStatus?: "PRODUCING" | "ON_HOLD" | "CANCELLED";
  workOrderState?: "RELEASED" | "CANCELLED";
  centerActive?: boolean;
  resource?: { isActive: boolean; state: "AVAILABLE" | "DOWN" | "INACTIVE" } | null;
} = {}) {
  const quantityLine = {
    id: "quantity-1",
    description: "เสื้อดำ L",
    size: "L",
    color: "ดำ",
    printPosition: "หน้าอก",
    qtyPlanned: 10,
    qtyGood: 2,
    qtyScrap: 0,
    qtyRework: 0,
    revision: 0,
  };
  return {
    id: "outsource-1",
    productionStepId: "operation-1",
    vendorId: "vendor-1",
    status: options.status ?? "DRAFT",
    description: "ปักโลโก้",
    quantity: 10,
    sentAt: null,
    expectedBackAt: null,
    receivedAt: null,
    qcPassed: null,
    qcNotes: null,
    notes: null,
    createdAt: new Date("2026-08-22T00:00:00.000Z"),
    updatedAt: new Date("2026-08-22T00:00:00.000Z"),
    vendor: { name: "ร้านปัก" },
    allocations: [
      {
        id: "allocation-1",
        operationQuantityId: "quantity-1",
        qty: 10,
        operationQuantity: {
          description: "เสื้อดำ L",
          size: "L",
          color: "ดำ",
          printPosition: "หน้าอก",
        },
      },
    ],
    productionStep: {
      id: "operation-1",
      productionId: "production-1",
      stepType: "CUSTOM",
      customStepName: "ร้านปัก",
      status: "IN_PROGRESS",
      operationCode: "OUTSOURCE",
      operationName: "งานร้านนอก",
      operationState: "READY",
      executionMode: "OUTSOURCE",
      workCenterId: "center-outsource",
      assignedToId: null,
      reworkCaseId: null,
      qtyPlanned: 10,
      qtyGood: 2,
      qtyScrap: 0,
      qtyRework: 0,
      revision: 7,
      executionEnabled: true,
      workCenter: {
        code: "OUTSOURCE",
        isActive: options.centerActive ?? true,
        members: [] as Array<{ id: string }>,
      },
      workResource:
        options.resource === undefined ? null : options.resource,
      predecessorLinks: [],
      exceptions: [],
      reworkCase: null,
      quantities: [quantityLine],
      production: {
        id: "production-1",
        orderId: "order-1",
        workOrderNumber: "MO-001",
        workOrderState: options.workOrderState ?? "RELEASED",
        revision: 3,
        order: {
          orderNumber: "ORD-001",
          title: "เสื้อทีม",
          internalStatus: options.orderStatus ?? "PRODUCING",
          customer: { name: "ลูกค้า" },
        },
      },
    },
  };
}

describe("outsource lifecycle permission", () => {
  it("listOrders คืน V2 operation identity, revision และ quantity lines ให้ worklist", async () => {
    const source = {
      ...v2ListOrder(),
      unitCost: 120,
      totalCost: 1_200,
      productionStep: {
        ...v2ListOrder().productionStep,
        estimatedCost: 500,
        actualCost: 450,
        production: {
          ...v2ListOrder().productionStep.production,
          totalCost: 450,
        },
      },
    };
    const quantityLine = source.productionStep.quantities[0];
    const findMany = vi.fn().mockResolvedValue([source]);
    const ctx = {
      ...context("MANAGER"),
      prisma: {
        outsourceOrder: {
          findMany,
        },
      } as unknown as Context["prisma"],
    } satisfies Context;

    const result = await outsourceRouter.createCaller(ctx).listOrders({});
    expect(result).toEqual([
      expect.objectContaining({
        executionEnabled: true,
        revision: 7,
        operationJobId: "operation-1",
        operationRevision: 7,
        quantityLines: [quantityLine],
        availableCommands: ["share", "cancelDraft", "markSent"],
        blockedReason: null,
        quantityAllocations: [
          {
            id: "allocation-1",
            quantityLineId: "quantity-1",
            qty: 10,
            description: "เสื้อดำ L",
            size: "L",
            color: "ดำ",
            printPosition: "หน้าอก",
          },
        ],
        productionStep: expect.objectContaining({
          operationJobId: "operation-1",
          quantityLines: [quantityLine],
          quantityAllocations: expect.any(Array),
        }),
      }),
    ]);
    expect(JSON.stringify(result).toLowerCase()).not.toMatch(
      /unitcost|totalcost|estimatedcost|actualcost/,
    );
    const queryShape = JSON.stringify(findMany.mock.calls[0]?.[0]).toLowerCase();
    expect(queryShape).toContain('"select"');
    expect(queryShape).not.toMatch(
      /unitcost|totalcost|estimatedcost|actualcost/,
    );
  });

  it.each([
    ["พักออเดอร์", { orderStatus: "ON_HOLD" as const }, "พัก"],
    ["ยกเลิกออเดอร์", { orderStatus: "CANCELLED" as const }, "ยกเลิก"],
    ["ยกเลิกใบผลิต", { workOrderState: "CANCELLED" as const }, "ยกเลิก"],
    ["ปิดจุดงาน", { centerActive: false }, "ปิดใช้งาน"],
    [
      "เครื่องไม่พร้อม",
      { resource: { isActive: true, state: "DOWN" as const } },
      "ไม่พร้อม",
    ],
  ])(
    "V2 ที่%s ไม่เสนอส่ง/รับ/QC แต่ยังคงแชร์และยกเลิกร่าง",
    async (_label, scope, reason) => {
      const findMany = vi.fn().mockResolvedValue([
        v2ListOrder({ status: "DRAFT", ...scope }),
        v2ListOrder({ status: "SENT", ...scope }),
        v2ListOrder({ status: "RECEIVED_BACK", ...scope }),
      ]);
      const ctx = {
        ...context("MANAGER"),
        prisma: {
          outsourceOrder: { findMany },
        } as unknown as Context["prisma"],
      } satisfies Context;

      const result = await outsourceRouter.createCaller(ctx).listOrders({});
      expect(result[0]?.availableCommands).toEqual(["share", "cancelDraft"]);
      expect(result[1]?.availableCommands).toEqual(["share"]);
      expect(result[2]?.availableCommands).toEqual(["share"]);
      expect(result.every((order) => order.blockedReason?.includes(reason))).toBe(
        true,
      );
      expect(result.flatMap((order) => order.availableCommands)).not.toEqual(
        expect.arrayContaining(["markSent", "receiveBack", "passQc", "failQc"]),
      );
    },
  );

  it("Production Staff ได้คำสั่งเดินงานเฉพาะเมื่อเป็นสมาชิกจุดงาน", async () => {
    const memberOrder = v2ListOrder({ status: "SENT" });
    memberOrder.productionStep.workCenter.members = [{ id: "member-1" }];
    const findMany = vi.fn().mockResolvedValue([memberOrder]);
    const ctx = {
      ...context("PRODUCTION_STAFF"),
      prisma: {
        outsourceOrder: { findMany },
      } as unknown as Context["prisma"],
    } satisfies Context;

    await expect(
      outsourceRouter.createCaller(ctx).listOrders({}),
    ).resolves.toEqual([
      expect.objectContaining({
        availableCommands: ["share", "receiveBack"],
        blockedReason: null,
      }),
    ]);
  });

  it("ใช้ supervise_operations แม้ถูกตัด manage_settings", async () => {
    const ctx = context("MANAGER", { manage_settings: false });
    await expect(
      outsourceRouter
        .createCaller(ctx)
        .createOrder(createOrderInput),
    ).rejects.toThrow(REACHED_SERVICE.message);
    expect(ctx.prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("มี manage_settings อย่างเดียวไม่พอสร้างใบงานนอก", async () => {
    await expect(
      outsourceRouter
        .createCaller(context("MANAGER", { supervise_operations: false }))
        .createOrder(createOrderInput),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("ยกเลิกร่างใช้ supervise_operations ไม่ผูก manage_settings", async () => {
    await expect(
      outsourceRouter
        .createCaller(context("MANAGER", { manage_settings: false }))
        .cancelDraftOrder({ id: "outsource-1" }),
    ).rejects.toThrow(REACHED_SERVICE.message);

    await expect(
      outsourceRouter
        .createCaller(context("MANAGER", { supervise_operations: false }))
        .cancelDraftOrder({ id: "outsource-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("ทะเบียน vendor ยังคงเป็นสิทธิ์ตั้งค่าระบบ", async () => {
    await expect(
      outsourceRouter
        .createCaller(context("PRODUCTION_STAFF", { supervise_operations: true }))
        .createVendor({ name: "ร้านใหม่", capabilities: [] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
