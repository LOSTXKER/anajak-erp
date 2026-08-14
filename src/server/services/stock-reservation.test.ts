import { describe, it, expect, vi } from "vitest";
import {
  buildReserveLines,
  syncOrderStockReservation,
  toReserveLines,
  type MirrorProduct,
} from "./stock-reservation";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import type { StockApiClient } from "@/lib/stock-api";

// สร้างบรรทัดจองจากเนื้อออเดอร์ — หัวใจคือ: เลือกเฉพาะ FROM_STOCK · จับคู่ variant
// แบบเดียวกับด่านเช็คสต๊อคตอนเปิดงาน · รวมยอดต่อ SKU · variant ไม่เจอ = จองระดับสินค้า+จดปัญหา

const mirror: MirrorProduct[] = [
  {
    id: "p1",
    sku: "TS-001",
    name: "เสื้อยืดคอกลม",
    variants: [
      { id: "v1", sku: "TS-001-S-BLACK", size: "S", color: "ดำ" },
      { id: "v2", sku: "TS-001-M-BLACK", size: "M", color: "ดำ" },
      { id: "v3", sku: "TS-001-M-WHITE", size: "M", color: "ขาว" },
    ],
  },
  {
    id: "p2",
    sku: "CAP-01",
    name: "หมวกแก๊ป",
    variants: [],
  },
];

// เทียบเฉพาะส่วนที่ยิงไป Stock API (sku/qty/note) — metadata เต็มทดสอบแยก
const apiLines = (r: ReturnType<typeof buildReserveLines>) => toReserveLines(r.lines);

describe("buildReserveLines", () => {
  it("จองรายไซส์-สีด้วย variant SKU และรวมยอดบรรทัดซ้ำ", () => {
    const r = buildReserveLines(
      [
        {
          itemSource: "FROM_STOCK",
          productId: "p1",
          description: "เสื้อยืด",
          variants: [
            { size: "S", color: "ดำ", quantity: 10 },
            { size: "M", color: "ดำ", quantity: 5 },
          ],
        },
        {
          itemSource: "FROM_STOCK",
          productId: "p1",
          description: "เสื้อยืด (อีกรายการ)",
          variants: [{ size: "M", color: "ดำ", quantity: 3 }],
        },
      ],
      mirror
    );
    expect(apiLines(r)).toEqual([
      { sku: "TS-001-S-BLACK", qty: 10 },
      { sku: "TS-001-M-BLACK", qty: 8 },
    ]);
    // metadata ครบสำหรับใบเบิก (garment-pick ใช้ตัวเดียวกัน)
    expect(r.lines[0]).toMatchObject({
      productId: "p1",
      variantId: "v1",
      productName: "เสื้อยืดคอกลม",
      size: "S",
      color: "ดำ",
    });
    expect(r.totalQty).toBe(18);
    expect(r.problems).toEqual([]);
  });

  it("ข้ามรายการที่ไม่ใช่ FROM_STOCK / ไม่มี productId / qty 0", () => {
    const r = buildReserveLines(
      [
        {
          itemSource: "CUSTOM_MADE",
          productId: "p1",
          description: "เสื้อสั่งเย็บ",
          variants: [{ size: "M", color: "ดำ", quantity: 100 }],
        },
        {
          itemSource: "FROM_STOCK",
          productId: null,
          description: "ของไม่มี product",
          variants: [{ size: "M", color: "ดำ", quantity: 5 }],
        },
        {
          itemSource: "FROM_STOCK",
          productId: "p1",
          description: "เสื้อยืด",
          variants: [{ size: "M", color: "ดำ", quantity: 0 }],
        },
      ],
      mirror
    );
    expect(r.lines).toEqual([]);
    expect(r.totalQty).toBe(0);
  });

  it("ไม่ระบุสี = จับ variant ตัวแรกที่ไซส์ตรง (กติกาเดียวกับด่านเช็คสต๊อคตอนเปิดงาน)", () => {
    const r = buildReserveLines(
      [
        {
          itemSource: "FROM_STOCK",
          productId: "p1",
          description: "เสื้อยืด",
          variants: [{ size: "M", color: null, quantity: 4 }],
        },
      ],
      mirror
    );
    expect(apiLines(r)).toEqual([{ sku: "TS-001-M-BLACK", qty: 4 }]);
  });

  it("variant ไม่เจอ → จองระดับสินค้า (product SKU) + จดปัญหา", () => {
    const r = buildReserveLines(
      [
        {
          itemSource: "FROM_STOCK",
          productId: "p1",
          description: "เสื้อยืด",
          variants: [{ size: "3XL", color: "เขียว", quantity: 2 }],
        },
        {
          itemSource: "FROM_STOCK",
          productId: "p2",
          description: "หมวก",
          variants: [{ size: "FREE", color: null, quantity: 6 }],
        },
      ],
      mirror
    );
    expect(apiLines(r)).toEqual([
      { sku: "TS-001", qty: 2, note: "ไม่พบ variant 3XL/เขียว — จองระดับสินค้า" },
      { sku: "CAP-01", qty: 6, note: "ไม่พบ variant FREE — จองระดับสินค้า" },
    ]);
    // จองระดับสินค้า = variantId null (ใบเบิกใช้แยกบรรทัด product-level)
    expect(r.lines.map((l) => l.variantId)).toEqual([null, null]);
    expect(r.problems).toHaveLength(2);
  });

  it("product ไม่อยู่ใน mirror (ยังไม่ sync) → ข้าม + จดปัญหา", () => {
    const r = buildReserveLines(
      [
        {
          itemSource: "FROM_STOCK",
          productId: "ghost",
          description: "ของหาย",
          variants: [{ size: "M", color: "ดำ", quantity: 1 }],
        },
      ],
      mirror
    );
    expect(r.lines).toEqual([]);
    expect(r.problems).toEqual(['ไม่พบสินค้า "ของหาย" ในข้อมูล sync จาก Stock']);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function reservationOrder(params: {
  updatedAt: Date;
  internalStatus: string;
  productId?: "p1" | "p2";
  quantity?: number;
  stockReservedAt?: Date | null;
}) {
  return {
    id: "order-1",
    orderNumber: "ORD-1",
    updatedAt: params.updatedAt,
    internalStatus: params.internalStatus,
    stockReservedAt: params.stockReservedAt ?? null,
    stockReservationError: null as string | null,
    items: params.productId
      ? [
          {
            products: [
              {
                itemSource: "FROM_STOCK",
                productId: params.productId,
                description: params.productId,
                variants: [
                  { size: "M", color: "ดำ", quantity: params.quantity ?? 1 },
                ],
              },
            ],
          },
        ]
      : [],
  };
}

const reservationMirror: MirrorProduct[] = [
  {
    id: "p1",
    sku: "P1",
    name: "สินค้าเก่า",
    variants: [{ id: "p1-m", sku: "P1-M", size: "M", color: "ดำ" }],
  },
  {
    id: "p2",
    sku: "P2",
    name: "สินค้าใหม่",
    variants: [{ id: "p2-m", sku: "P2-M", size: "M", color: "ดำ" }],
  },
];

function versionedPrisma(initial: ReturnType<typeof reservationOrder>) {
  const holder = { state: initial };
  const userFindMany = vi.fn().mockResolvedValue([]);
  const notificationCreate = vi.fn();
  const orderUpdateMany = vi.fn(
    async (args: {
      where: { updatedAt?: Date; internalStatus?: string };
      data: Record<string, unknown>;
    }) => {
      const sameVersion =
        !args.where.updatedAt ||
        holder.state.updatedAt.getTime() === args.where.updatedAt.getTime();
      const sameStatus =
        !args.where.internalStatus ||
        holder.state.internalStatus === args.where.internalStatus;
      if (!sameVersion || !sameStatus) return { count: 0 };
      holder.state = {
        ...holder.state,
        ...args.data,
        updatedAt: new Date(holder.state.updatedAt.getTime() + 1),
      } as ReturnType<typeof reservationOrder>;
      return { count: 1 };
    },
  );
  const prisma = {
    order: {
      findUniqueOrThrow: vi.fn(async () => holder.state),
      update: vi.fn(),
      updateMany: orderUpdateMany,
    },
    product: { findMany: vi.fn().mockResolvedValue(reservationMirror) },
    orderRevision: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
    },
    user: { findMany: userFindMany },
    notification: { create: notificationCreate },
  } as unknown as ExtendedPrismaClient;
  return {
    holder,
    prisma,
    orderUpdateMany,
    userFindMany,
    notificationCreate,
  };
}

describe("syncOrderStockReservation stale response reconciliation", () => {
  it("reserve รอบเก่ากลับมาหลังยกเลิก ต้องปลดซ้ำและห้าม mark ว่าจองอยู่", async () => {
    const v1 = new Date("2026-08-14T10:00:00.000Z");
    const v2 = new Date("2026-08-14T10:01:00.000Z");
    const db = versionedPrisma(
      reservationOrder({
        updatedAt: v1,
        internalStatus: "CONFIRMED",
        productId: "p1",
        quantity: 2,
        stockReservedAt: new Date("2026-08-14T09:00:00.000Z"),
      }),
    );
    const firstReserve = deferred<unknown>();
    const client = {
      reserveForOrder: vi.fn().mockReturnValueOnce(firstReserve.promise),
      releaseReservations: vi.fn().mockResolvedValue(1),
    } as unknown as StockApiClient;

    const syncing = syncOrderStockReservation(
      db.prisma,
      { orderId: "order-1", changedBy: "sales-1", expectedUpdatedAt: v1 },
      client,
    );
    await vi.waitFor(() => expect(client.reserveForOrder).toHaveBeenCalledTimes(1));
    db.holder.state = reservationOrder({
      updatedAt: v2,
      internalStatus: "CANCELLED",
    });
    firstReserve.resolve({});

    await expect(syncing).resolves.toMatchObject({ status: "released" });
    expect(client.releaseReservations).toHaveBeenCalledWith("ORD-1");
    expect(db.holder.state.stockReservedAt).toBeNull();
    expect(db.holder.state.internalStatus).toBe("CANCELLED");
  });

  it("reserve รอบเก่ากลับมาหลังแก้รายการ ต้อง replace ซ้ำด้วย snapshot ล่าสุด", async () => {
    const v1 = new Date("2026-08-14T10:00:00.000Z");
    const v2 = new Date("2026-08-14T10:01:00.000Z");
    const db = versionedPrisma(
      reservationOrder({
        updatedAt: v1,
        internalStatus: "CONFIRMED",
        productId: "p1",
        quantity: 2,
      }),
    );
    const firstReserve = deferred<unknown>();
    const client = {
      reserveForOrder: vi
        .fn()
        .mockReturnValueOnce(firstReserve.promise)
        .mockResolvedValue({}),
      releaseReservations: vi.fn().mockResolvedValue(0),
    } as unknown as StockApiClient;

    const syncing = syncOrderStockReservation(
      db.prisma,
      { orderId: "order-1", changedBy: "sales-1", expectedUpdatedAt: v1 },
      client,
    );
    await vi.waitFor(() => expect(client.reserveForOrder).toHaveBeenCalledTimes(1));
    db.holder.state = reservationOrder({
      updatedAt: v2,
      internalStatus: "CONFIRMED",
      productId: "p2",
      quantity: 7,
    });
    firstReserve.resolve({});

    await expect(syncing).resolves.toMatchObject({
      status: "reserved",
      lineCount: 1,
      totalQty: 7,
    });
    expect(client.reserveForOrder).toHaveBeenNthCalledWith(1, {
      orderRef: "ORD-1",
      lines: [{ sku: "P1-M", qty: 2 }],
    });
    expect(client.reserveForOrder).toHaveBeenNthCalledWith(2, {
      orderRef: "ORD-1",
      lines: [{ sku: "P2-M", qty: 7 }],
    });
    expect(db.orderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ updatedAt: v2, internalStatus: "CONFIRMED" }),
      }),
    );
    expect(db.holder.state.stockReservedAt).toBeInstanceOf(Date);
    expect(db.holder.state.stockReservationError).toBeNull();
  });

  it("สถานะ ON_HOLD ยังต้อง reconcile ด้วยยอดล่าสุด ไม่ปลดภาระสต๊อค", async () => {
    const v1 = new Date("2026-08-14T10:00:00.000Z");
    const v2 = new Date("2026-08-14T10:01:00.000Z");
    const db = versionedPrisma(
      reservationOrder({
        updatedAt: v1,
        internalStatus: "DESIGN_APPROVED",
        productId: "p1",
        quantity: 2,
      }),
    );
    const firstReserve = deferred<unknown>();
    const client = {
      reserveForOrder: vi
        .fn()
        .mockReturnValueOnce(firstReserve.promise)
        .mockResolvedValue({}),
      releaseReservations: vi.fn().mockResolvedValue(0),
    } as unknown as StockApiClient;

    const syncing = syncOrderStockReservation(
      db.prisma,
      { orderId: "order-1", changedBy: "sales-1", expectedUpdatedAt: v1 },
      client,
    );
    await vi.waitFor(() => expect(client.reserveForOrder).toHaveBeenCalledTimes(1));
    db.holder.state = reservationOrder({
      updatedAt: v2,
      internalStatus: "ON_HOLD",
      productId: "p2",
      quantity: 4,
      stockReservedAt: new Date("2026-08-14T09:00:00.000Z"),
    });
    firstReserve.resolve({});

    await expect(syncing).resolves.toMatchObject({
      status: "reserved",
      totalQty: 4,
    });
    expect(client.reserveForOrder).toHaveBeenNthCalledWith(2, {
      orderRef: "ORD-1",
      lines: [{ sku: "P2-M", qty: 4 }],
    });
    expect(client.releaseReservations).not.toHaveBeenCalled();
  });

  it("ถ้าหลุดถึง PRODUCING หลัง response เก่า ห้าม replace/release และแจ้งให้ตรวจมือ", async () => {
    const v1 = new Date("2026-08-14T10:00:00.000Z");
    const v2 = new Date("2026-08-14T10:01:00.000Z");
    const db = versionedPrisma(
      reservationOrder({
        updatedAt: v1,
        internalStatus: "PRODUCTION_QUEUE",
        productId: "p1",
        quantity: 2,
      }),
    );
    db.userFindMany.mockResolvedValue([{ id: "owner-1" }]);
    const firstReserve = deferred<unknown>();
    const client = {
      reserveForOrder: vi.fn().mockReturnValueOnce(firstReserve.promise),
      releaseReservations: vi.fn().mockResolvedValue(0),
    } as unknown as StockApiClient;

    const syncing = syncOrderStockReservation(
      db.prisma,
      { orderId: "order-1", changedBy: "sales-1", expectedUpdatedAt: v1 },
      client,
    );
    await vi.waitFor(() => expect(client.reserveForOrder).toHaveBeenCalledTimes(1));
    db.holder.state = reservationOrder({
      updatedAt: v2,
      internalStatus: "PRODUCING",
      productId: "p1",
      quantity: 2,
      stockReservedAt: new Date("2026-08-14T09:00:00.000Z"),
    });
    firstReserve.resolve({});

    await expect(syncing).resolves.toMatchObject({
      status: "error",
      message: expect.stringContaining("ตรวจยอดจอง"),
    });
    expect(client.reserveForOrder).toHaveBeenCalledTimes(1);
    expect(client.releaseReservations).not.toHaveBeenCalled();
    expect(db.holder.state.stockReservationError).toContain("แก้ไขด้วยมือ");
    expect(db.notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "owner-1", entityId: "order-1" }),
    });
  });
});
