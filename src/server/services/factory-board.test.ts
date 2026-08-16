import { describe, expect, it, vi } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import {
  buildFactoryStageTotals,
  buildPackQueue,
  buildPrepQueue,
  buildPressQueue,
  buildProblems,
  buildQcQueue,
  buildReadyToShipQueue,
  buildUrgentOrders,
  endOfBangkokToday,
  factoryBoardWindow,
} from "@/server/services/factory-board";

describe("factoryBoardWindow", () => {
  it("ตัดวันตามเวลาไทยแม้ server รัน UTC", () => {
    const now = new Date("2026-08-15T18:30:00.000Z"); // 16 ส.ค. 01:30 ที่กรุงเทพ

    expect(factoryBoardWindow(now)).toEqual({
      startOfToday: new Date("2026-08-15T17:00:00.000Z"),
      endOfTomorrow: new Date("2026-08-17T16:59:59.999Z"),
    });
    expect(endOfBangkokToday(now)).toEqual(new Date("2026-08-16T16:59:59.999Z"));
  });
});

describe("factory stage totals", () => {
  it("นับ DTF เป็นจำนวนงานหน่วยเดียว และนับรีดที่เริ่มแล้วแม้ qtyDone ยังเป็นศูนย์", () => {
    const totals = buildFactoryStageTotals({
      prepTotal: 12,
      prepActiveTotal: 3,
      activeRuns: [{ jobs: [{}, {}] }, { jobs: [{}] }],
      printQueue: [{}, {}],
      pressQueue: [{ status: "IN_PROGRESS" }, { status: "PENDING" }],
      qcTotal: 9,
      packTotal: 11,
    });

    expect(totals).toEqual({
      prep: { total: 12, activeTotal: 3 },
      dtf: { total: 5, activeTotal: 3 },
      press: { total: 2, activeTotal: 1 },
      qc: { total: 9, activeTotal: 0 },
      pack: { total: 11, activeTotal: 0 },
    });
  });
});

describe("buildPrepQueue", () => {
  it("รวมเฉพาะสองขั้นเตรียมเสื้อที่ยังเดินอยู่ และไม่มี field เงิน", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "step-prep",
        stepType: "GARMENT_PICK",
        status: "IN_PROGRESS",
        qtyDone: 20,
        qtyTotal: 50,
        assignedTo: { name: "ช่างเอ" },
        production: {
          id: "production-1",
          order: {
            orderNumber: "ORD-2608-0040",
            title: "เสื้อทีม",
            deadline: new Date("2026-08-19T00:00:00.000Z"),
            customer: { name: "ลูกค้าเอ" },
          },
        },
      },
    ]);
    const prisma = { productionStep: { findMany } } as unknown as ExtendedPrismaClient;

    const result = await buildPrepQueue(prisma, 8);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          stepType: { in: ["GARMENT_PICK", "GARMENT_RECEIVE"] },
          status: { in: ["PENDING", "IN_PROGRESS"] },
          production: { order: { internalStatus: "PRODUCING" } },
        },
        take: 8,
      }),
    );
    expect(result[0]).toMatchObject({
      orderNumber: "ORD-2608-0040",
      stepLabel: "เบิกเสื้อจากสต๊อค",
      qtyDone: 20,
      qtyTotal: 50,
      assignedToName: "ช่างเอ",
    });
    expect(JSON.stringify(findMany.mock.calls[0][0].select)).not.toMatch(
      /amount|price|cost|payment/i,
    );
    expect(JSON.stringify(result)).not.toMatch(/amount|price|cost|payment/i);
  });
});

describe("buildProblems", () => {
  it("ไม่ประกาศ PACKAGING รุ่นเก่าเป็นปัญหาก่อน QC บนจอทีวี", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      productionStep: { findMany },
    } as unknown as ExtendedPrismaClient;

    await buildProblems(prisma);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ stepType: { not: "PACKAGING" } }),
      }),
    );
  });
});

describe("buildPressQueue", () => {
  it("คืน status เพื่อให้ TV รู้ว่างานกำลังรีดแม้ยังนับได้ 0 ตัว", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "step-press",
        status: "IN_PROGRESS",
        qtyDone: 0,
        qtyTotal: 50,
        assignedTo: { name: "ช่างรีด" },
        production: {
          id: "production-press",
          steps: [],
          order: {
            orderNumber: "ORD-2608-0043",
            title: "เสื้อทีม",
            deadline: null,
            customer: { name: "ลูกค้าซี" },
          },
        },
      },
    ]);
    const prisma = { productionStep: { findMany } } as unknown as ExtendedPrismaClient;

    const result = await buildPressQueue(prisma, { limit: 8 });

    expect(result[0]).toMatchObject({
      stepId: "step-press",
      status: "IN_PROGRESS",
      qtyDone: 0,
      qtyTotal: 50,
    });
    expect(findMany.mock.calls[0][0]).not.toHaveProperty("take");
  });
});

describe("buildUrgentOrders", () => {
  it("กันที่ให้งาน URGENT ก่อน แล้วเติมงานเลยกำหนดจากสถานะโรงงานที่ยังเดินอยู่", async () => {
    const startOfToday = new Date("2026-08-16T00:00:00.000Z");
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "order-urgent",
          orderNumber: "ORD-2608-0002",
          deadline: new Date("2026-08-20T00:00:00.000Z"),
          priority: "URGENT",
          customer: { name: "ลูกค้าด่วน" },
        },
      ])
      .mockResolvedValueOnce([
        {
        id: "order-overdue",
        orderNumber: "ORD-2608-0001",
        deadline: new Date("2026-08-15T00:00:00.000Z"),
        priority: "HIGH",
        customer: { name: "ลูกค้าเก่า" },
        },
      ]);
    const prisma = { order: { findMany } } as unknown as ExtendedPrismaClient;

    const result = await buildUrgentOrders(prisma, 8, {
      startOfToday,
      endOfTomorrow: new Date("2026-08-17T23:59:59.999Z"),
    });

    expect(findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          internalStatus: {
            in: [
              "PRODUCTION_QUEUE",
              "PRODUCING",
              "QUALITY_CHECK",
              "PACKING",
              "READY_TO_SHIP",
            ],
          },
          priority: "URGENT",
        },
        take: 8,
      }),
    );
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          internalStatus: {
            in: [
              "PRODUCTION_QUEUE",
              "PRODUCING",
              "QUALITY_CHECK",
              "PACKING",
              "READY_TO_SHIP",
            ],
          },
          priority: { not: "URGENT" },
          deadline: { lt: startOfToday },
        },
        take: 8,
      }),
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ orderId: "order-urgent", priority: "URGENT" });
    expect(result[1]).toMatchObject({ orderId: "order-overdue", priority: "HIGH" });
    expect(JSON.stringify(findMany.mock.calls[0][0].select)).not.toMatch(
      /amount|price|cost|payment/i,
    );
  });

  it("เก็บโควตาทั้งงานด่วนและงานเลยกำหนดเมื่อแต่ละกลุ่มยาวเกิน rail", async () => {
    const row = (kind: "urgent" | "overdue", index: number) => ({
      id: `${kind}-${index}`,
      orderNumber: `ORD-${kind}-${index}`,
      deadline: new Date(
        kind === "urgent" ? `2026-08-${20 + index}T00:00:00.000Z` : `2026-08-${1 + index}T00:00:00.000Z`,
      ),
      priority: kind === "urgent" ? "URGENT" : "HIGH",
      customer: { name: `ลูกค้า ${kind} ${index}` },
    });
    const findMany = vi
      .fn()
      .mockResolvedValueOnce(Array.from({ length: 8 }, (_, index) => row("urgent", index)))
      .mockResolvedValueOnce(Array.from({ length: 8 }, (_, index) => row("overdue", index)));
    const prisma = { order: { findMany } } as unknown as ExtendedPrismaClient;

    const result = await buildUrgentOrders(prisma, 8, {
      startOfToday: new Date("2026-08-16T00:00:00.000Z"),
      endOfTomorrow: new Date("2026-08-17T23:59:59.999Z"),
    });

    expect(result).toHaveLength(8);
    expect(result.filter((item) => item.priority === "URGENT")).toHaveLength(4);
    expect(result.filter((item) => item.priority !== "URGENT")).toHaveLength(4);
    expect(result.slice(0, 2).map((item) => item.priority)).toEqual(["URGENT", "HIGH"]);
  });
});

describe("buildPackQueue", () => {
  it("อ่านแพ็กสุดท้ายจากสถานะออเดอร์ PACKING ไม่ใช่ PACKAGING ก่อน QC", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "order-pack",
        orderNumber: "ORD-2608-0041",
        title: "เสื้อทีมหน้าร้าน",
        deadline: new Date("2026-08-20T00:00:00.000Z"),
        priority: "HIGH",
        blindShip: true,
        customer: { name: "ลูกค้าเอ" },
        items: [{ totalQuantity: 50 }],
      },
    ]);
    const prisma = {
      order: { findMany },
      productionStep: {
        findMany: vi.fn(() => {
          throw new Error("ห้ามอ่าน PACKAGING production step");
        }),
      },
    } as unknown as ExtendedPrismaClient;

    await expect(buildPackQueue(prisma, { limit: 8 })).resolves.toEqual([
      {
        stepId: "pack:order-pack",
        orderId: "order-pack",
        productionId: null,
        orderNumber: "ORD-2608-0041",
        title: "เสื้อทีมหน้าร้าน",
        customerName: "ลูกค้าเอ",
        deadline: new Date("2026-08-20T00:00:00.000Z"),
        priority: "HIGH",
        totalQuantity: 50,
        blindShip: true,
        assignedToName: null,
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { internalStatus: "PACKING" },
        orderBy: { deadline: "asc" },
        take: 8,
      }),
    );
  });
});

describe("post-production queues", () => {
  const order = {
    id: "order-post",
    orderNumber: "ORD-2608-0042",
    title: "เสื้ออีเวนต์",
    deadline: new Date("2026-08-21T00:00:00.000Z"),
    priority: "NORMAL",
    blindShip: false,
    customer: { name: "ลูกค้าบี" },
    items: [{ totalQuantity: 40 }, { totalQuantity: 10 }],
  };

  it("อ่าน QC จาก QUALITY_CHECK และรวมจำนวนสินค้า", async () => {
    const findMany = vi.fn().mockResolvedValue([order]);
    const prisma = { order: { findMany } } as unknown as ExtendedPrismaClient;

    const result = await buildQcQueue(prisma, 8);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { internalStatus: "QUALITY_CHECK" }, take: 8 }),
    );
    expect(result[0]).toMatchObject({
      key: "qc:order-post",
      orderNumber: "ORD-2608-0042",
      totalQuantity: 50,
    });
    expect(JSON.stringify(findMany.mock.calls[0][0].select)).not.toMatch(
      /amount|price|cost|payment/i,
    );
    expect(JSON.stringify(result)).not.toMatch(/amount|price|cost|payment/i);
  });

  it("อ่านผลลัพธ์พร้อมส่งจาก READY_TO_SHIP แยกจากคิวแพ็ก", async () => {
    const findMany = vi.fn().mockResolvedValue([order]);
    const prisma = { order: { findMany } } as unknown as ExtendedPrismaClient;

    const result = await buildReadyToShipQueue(prisma, 8);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { internalStatus: "READY_TO_SHIP" }, take: 8 }),
    );
    expect(result[0]).toMatchObject({
      key: "ready:order-post",
      orderNumber: "ORD-2608-0042",
      totalQuantity: 50,
    });
  });
});
