import type { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { factoryRouter } from "./factory";

const deadline = new Date("2026-08-20T00:00:00.000Z");
const createdAt = new Date("2026-08-16T00:00:00.000Z");

function production(id: string) {
  return {
    id,
    status: "IN_PROGRESS",
    createdAt,
    steps: [
      {
        id: `step-${id}`,
        stepType: "HEAT_PRESS",
        customStepName: null,
        status: "PENDING",
        sortOrder: 2,
        qtyDone: 0,
        qtyTotal: 50,
        assignedTo: null,
      },
    ],
  };
}

function orderRecord(
  productions = [production("prod-1")],
  internalStatus = "PACKING",
) {
  return {
    id: "order-1",
    orderNumber: "ORD-2608-0041",
    title: "เสื้อทีมหน้าร้าน",
    internalStatus,
    deadline,
    priority: "HIGH",
    blindShip: true,
    blindShipSenderName: "แบรนด์ลูกค้า",
    shippingRecipientName: "คุณเอ",
    shippingPhone: "0812345678",
    shippingAddress: "99 ถนนสุขุมวิท",
    shippingSubDistrict: "คลองตัน",
    shippingDistrict: "วัฒนา",
    shippingProvince: "กรุงเทพฯ",
    shippingPostalCode: "10110",
    customer: {
      name: "ลูกค้าเอ",
      phone: "0899999999",
      address: "88 ถนนพระราม 9",
    },
    items: [
      {
        totalQuantity: 50,
        products: [
          {
            description: "เสื้อทีม",
            fabricColor: "ดำ",
            totalQuantity: 50,
            variants: [{ size: "M", color: "ดำ", quantity: 50 }],
          },
        ],
        prints: [
          {
            position: "FRONT",
            printType: "DTF",
            printSize: "A4",
            designNote: "กลางอก",
          },
        ],
      },
    ],
    productions,
    deliveries: [{ id: "delivery-1" }, { id: "delivery-2" }],
  };
}

function makeCtx(role: Role = "PRODUCTION_STAFF") {
  const findOrder = vi.fn();
  const findOrders = vi.fn();
  const findProduction = vi.fn();
  const ctx: Context = {
    prisma: {
      order: { findUnique: findOrder, findMany: findOrders },
      production: { findUnique: findProduction },
    } as unknown as Context["prisma"],
    userId: "factory-user",
    userRole: role,
    permissionOverrides: null,
  };
  return { ctx, findOrder, findOrders, findProduction };
}

describe("factory.stationQueue", () => {
  it("คืนคิวสถานีแบบ no-money แม้ caller เป็น OWNER", async () => {
    const stub = makeCtx("OWNER");
    stub.findOrders.mockResolvedValueOnce([orderRecord()]);

    const result = await factoryRouter.createCaller(stub.ctx).stationQueue();

    const query = stub.findOrders.mock.calls[0][0];
    expect(JSON.stringify(query.select)).not.toMatch(/amount|price|cost|payment/i);
    expect(JSON.stringify(result)).not.toMatch(/amount|price|cost|payment/i);
    expect(result[0]).toMatchObject({
      orderNumber: "ORD-2608-0041",
      customerName: "ลูกค้าเอ",
      totalQuantity: 50,
      readiness: null,
    });
  });
});

describe("factory.markReadyToShip", () => {
  it("ยืนยันผ่าน status service + packing evidence และคืน ack ไม่มีเงิน", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      order: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            id: "order-1",
            internalStatus: "PACKING",
            customerStatus: "IN_PROGRESS",
          })
          .mockResolvedValueOnce({
            items: [
              {
                products: [
                  {
                    description: "เสื้อยืด",
                    variants: [{ size: "M", color: "ดำ", quantity: 5 }],
                  },
                ],
              },
            ],
            deliveries: [
              {
                status: "PREPARING",
                lines: [{ description: "เสื้อยืด", size: "M", color: "ดำ", qty: 5 }],
              },
            ],
          })
          .mockResolvedValueOnce({
            orderType: "CUSTOM",
            internalStatus: "PACKING",
            stockReservationError: null,
          })
          .mockResolvedValueOnce({
            id: "order-1",
            internalStatus: "READY_TO_SHIP",
            customerStatus: "READY_TO_SHIP",
          }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      orderRevision: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "revision-1" }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    };
    const ctx: Context = {
      prisma: {
        $transaction: vi.fn(
          async (callback: (transaction: unknown) => unknown) => callback(tx),
        ),
      } as unknown as Context["prisma"],
      userId: "factory-user",
      userRole: "PRODUCTION_STAFF",
      permissionOverrides: null,
    };

    const result = await factoryRouter
      .createCaller(ctx)
      .markReadyToShip({ orderId: "order-1" });

    expect(result).toEqual({
      id: "order-1",
      internalStatus: "READY_TO_SHIP",
      customerStatus: "READY_TO_SHIP",
    });
    expect(JSON.stringify(result)).not.toMatch(/amount|price|cost/i);
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });

  it("ปฏิเสธการย้อนออเดอร์ที่ออกจากขั้นแพ็กแล้วกลับมา READY_TO_SHIP", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "order-1",
          internalStatus: "SHIPPED",
          customerStatus: "SHIPPED",
        }),
      },
    };
    const ctx: Context = {
      prisma: {
        $transaction: vi.fn(
          async (callback: (transaction: unknown) => unknown) => callback(tx),
        ),
      } as unknown as Context["prisma"],
      userId: "factory-user",
      userRole: "PRODUCTION_STAFF",
      permissionOverrides: null,
    };

    await expect(
      factoryRouter.createCaller(ctx).markReadyToShip({ orderId: "order-1" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(tx.order.findUniqueOrThrow).toHaveBeenCalledOnce();
  });
});

describe("factory.resolveStationScan", () => {
  it("resolve เลขออเดอร์แบบ exact และเปิดใบผลิตเดียวได้", async () => {
    const stub = makeCtx();
    stub.findOrder.mockResolvedValueOnce(orderRecord([production("prod-1")], "PRODUCING"));

    const result = await factoryRouter
      .createCaller(stub.ctx)
      .resolveStationScan({ value: "\r\nord-2608-0041\r\n" });

    expect(stub.findOrder).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderNumber: "ORD-2608-0041" } }),
    );
    expect(result).toMatchObject({
      kind: "production",
      productionId: "prod-1",
      orderId: "order-1",
      orderNumber: "ORD-2608-0041",
      station: null,
    });
  });

  it("คืน multiple ทุกใบให้ UI เลือกและไม่หยิบใบแรกเงียบ ๆ", async () => {
    const stub = makeCtx();
    stub.findOrder.mockResolvedValueOnce(
      orderRecord([production("prod-1"), production("prod-2")], "PRODUCING"),
    );

    const result = await factoryRouter
      .createCaller(stub.ctx)
      .resolveStationScan({
        value: "/factory/station?station=heat-press&orderId=order-1",
      });

    expect(result).toMatchObject({
      kind: "multiple",
      orderId: "order-1",
      orderNumber: "ORD-2608-0041",
      station: "heat-press",
      productions: [{ id: "prod-1" }, { id: "prod-2" }],
    });
    expect(result).not.toHaveProperty("productionId");
  });

  it("สแกนออเดอร์ที่ถึง QC/แพ็กแล้วเปิด workspace ออเดอร์ แม้มีใบผลิตเก่าค้าง", async () => {
    const stub = makeCtx();
    stub.findOrder.mockResolvedValueOnce(orderRecord([production("prod-legacy")], "PACKING"));

    await expect(
      factoryRouter.createCaller(stub.ctx).resolveStationScan({ value: "ORD-2608-0041" }),
    ).resolves.toMatchObject({
      kind: "order",
      orderId: "order-1",
      station: "final-pack",
    });
  });

  it("สถานะหลังผลิตชนะ station เก่าที่ฝังใน QR", async () => {
    const stub = makeCtx();
    stub.findOrder.mockResolvedValueOnce(orderRecord([], "QUALITY_CHECK"));

    await expect(
      factoryRouter.createCaller(stub.ctx).resolveStationScan({
        value: "/factory/station?station=final-pack&orderId=order-1",
      }),
    ).resolves.toMatchObject({
      kind: "order",
      orderId: "order-1",
      station: "qc",
    });
  });

  it("คืน order เมื่อยังไม่มีใบผลิต แทนการเดาเส้นทาง", async () => {
    const stub = makeCtx();
    stub.findOrder.mockResolvedValueOnce(orderRecord([]));

    await expect(
      factoryRouter
        .createCaller(stub.ctx)
        .resolveStationScan({ value: "/orders/order-1" }),
    ).resolves.toMatchObject({
      kind: "order",
      orderId: "order-1",
      orderNumber: "ORD-2608-0041",
    });
  });

  it("QR production ชี้ใบผลิตนั้นตรง ๆ แม้ออเดอร์มีหลายใบ", async () => {
    const stub = makeCtx();
    stub.findProduction.mockResolvedValueOnce({
      id: "prod-2",
      status: "IN_PROGRESS",
      order: {
        id: "order-1",
        orderNumber: "ORD-2608-0041",
        internalStatus: "PRODUCING",
      },
    });

    await expect(
      factoryRouter
        .createCaller(stub.ctx)
        .resolveStationScan({ value: "/production/prod-2" }),
    ).resolves.toMatchObject({
      kind: "production",
      productionId: "prod-2",
      productionStatus: "IN_PROGRESS",
      orderId: "order-1",
      orderNumber: "ORD-2608-0041",
      internalStatus: "PRODUCING",
    });
    const query = stub.findProduction.mock.calls[0][0];
    expect(JSON.stringify(query.select)).not.toMatch(/amount|price|cost/i);
    expect(stub.findOrder).not.toHaveBeenCalled();
  });

  it("ปฏิเสธ URL ภายนอกก่อนยิงฐานข้อมูล", async () => {
    const stub = makeCtx();

    await expect(
      factoryRouter.createCaller(stub.ctx).resolveStationScan({
        value: "https://evil.example/production/prod-1",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(stub.findOrder).not.toHaveBeenCalled();
    expect(stub.findProduction).not.toHaveBeenCalled();
  });
});

describe("factory.stationContext", () => {
  it("คืนเฉพาะบริบทหน้างาน/ที่อยู่/ใบผลิต active และจำนวนใบส่งที่ไม่คืน", async () => {
    const stub = makeCtx();
    stub.findOrder.mockResolvedValueOnce(orderRecord());

    const result = await factoryRouter
      .createCaller(stub.ctx)
      .stationContext({ orderId: "order-1" });

    expect(stub.findOrder).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "order-1" } }),
    );
    const query = stub.findOrder.mock.calls[0][0];
    expect(query.select.productions.where).toEqual({ status: { not: "COMPLETED" } });
    expect(query.select.deliveries.where).toEqual({ status: { not: "RETURNED" } });
    expect(JSON.stringify(query.select)).not.toMatch(/amount|price|cost/i);
    expect(result).toMatchObject({
      order: {
        id: "order-1",
        orderNumber: "ORD-2608-0041",
        title: "เสื้อทีมหน้าร้าน",
        internalStatus: "PACKING",
        deadline,
        priority: "HIGH",
        blindShip: true,
        blindShipSenderName: "แบรนด์ลูกค้า",
        shippingName: "คุณเอ",
        shippingPhone: "0812345678",
        shippingAddress: "99 ถนนสุขุมวิท",
        shippingSubDistrict: "คลองตัน",
        shippingDistrict: "วัฒนา",
        shippingProvince: "กรุงเทพฯ",
        shippingPostalCode: "10110",
      },
      customer: {
        name: "ลูกค้าเอ",
        phone: "0899999999",
        address: "88 ถนนพระราม 9",
        hasAddress: true,
      },
      activeProductions: [{ id: "prod-1" }],
      nonReturnedDeliveryCount: 2,
      inspection: {
        garmentLines: [
          { product: "เสื้อทีม · ดำ", size: "M", color: "ดำ", quantity: 50 },
        ],
        printChecks: [
          { position: "FRONT", printType: "DTF", printSize: "A4", note: "กลางอก" },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/amount|price|cost/i);
  });
});
