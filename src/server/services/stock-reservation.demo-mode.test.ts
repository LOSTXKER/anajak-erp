import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import type { StockApiClient } from "@/lib/stock-api";
import { syncOrderStockReservation } from "./stock-reservation";

const originalDemoMode = process.env.ANAJAK_ERP_DEMO_MODE;
const originalDatabaseUrl = process.env.DATABASE_URL;

beforeEach(() => {
  process.env.ANAJAK_ERP_DEMO_MODE = "1";
  process.env.DATABASE_URL =
    "postgresql://demo:demo@127.0.0.1:5433/anajak_erp_demo?schema=public";
});

afterEach(() => {
  if (originalDemoMode === undefined) delete process.env.ANAJAK_ERP_DEMO_MODE;
  else process.env.ANAJAK_ERP_DEMO_MODE = originalDemoMode;
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

function localReservationHarness(stock = 20) {
  const log: string[] = [];
  const orderUpdate = vi.fn().mockResolvedValue({});
  const tx = {
    $queryRaw: vi.fn(async (query: TemplateStringsArray) => {
      const sql = query.join(" ");
      log.push(sql.includes("FOR UPDATE") ? "order-lock" : "demo-lock");
      return [];
    }),
    order: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "order-1",
        orderNumber: "ORD-DEMO-1",
        internalStatus: "CONFIRMED",
        stockReservedAt: null,
        items: [
          {
            products: [
              {
                itemSource: "FROM_STOCK",
                productId: "product-1",
                description: "เสื้อยืด",
                variants: [{ size: "M", color: "ดำ", quantity: 10 }],
              },
            ],
          },
        ],
      }),
      findMany: vi.fn().mockResolvedValue([]),
      update: orderUpdate,
    },
    product: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "product-1",
          sku: "TS",
          name: "เสื้อยืด",
          variants: [
            {
              id: "variant-m",
              sku: "TS-M-BLACK",
              size: "M",
              color: "ดำ",
            },
          ],
        },
      ]),
    },
    productVariant: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "variant-m",
          sku: "TS-M-BLACK",
          stock,
          totalStock: stock,
        },
      ]),
    },
    materialUsage: { findMany: vi.fn().mockResolvedValue([]) },
    orderRevision: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "revision-1" }),
    },
  };
  const prisma = {
    $transaction: vi.fn(
      async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx),
    ),
  } as unknown as ExtendedPrismaClient;
  return { prisma, tx, orderUpdate, log };
}

describe("syncOrderStockReservation — local demo", () => {
  it("flag demo ที่ชี้ฐานอื่นหยุดก่อนอ่านหรือเขียนฐาน", async () => {
    process.env.DATABASE_URL =
      "postgresql://demo:demo@db.example.com:5432/anajak_erp_demo?schema=public";
    const harness = localReservationHarness();

    const outcome = await syncOrderStockReservation(harness.prisma, {
      orderId: "order-1",
      changedBy: "owner-1",
    });

    expect(outcome).toMatchObject({
      status: "error",
      message: expect.stringContaining(
        "อนุญาตเฉพาะ PostgreSQL 127.0.0.1:5433/anajak_erp_demo",
      ),
    });
    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
    expect(harness.orderUpdate).not.toHaveBeenCalled();
  });

  it("จองใน DB transaction โดยไม่เรียก Stock API และล็อก order ก่อน demo mutex", async () => {
    const harness = localReservationHarness();
    const reserveForOrder = vi.fn();
    const client = { reserveForOrder } as unknown as StockApiClient;

    const outcome = await syncOrderStockReservation(
      harness.prisma,
      { orderId: "order-1", changedBy: "owner-1" },
      client,
    );

    expect(outcome).toMatchObject({
      status: "reserved",
      lineCount: 1,
      totalQty: 10,
    });
    expect(reserveForOrder).not.toHaveBeenCalled();
    expect(harness.log).toEqual(["order-lock", "demo-lock"]);
    expect(harness.orderUpdate).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: {
        stockReservedAt: expect.any(Date),
        stockReservationError: null,
        reservationExpiryWarnedAt: null,
      },
    });
  });

  it("ของไม่พอไม่สร้าง marker จอง และบันทึก shortage", async () => {
    const harness = localReservationHarness(4);

    const outcome = await syncOrderStockReservation(harness.prisma, {
      orderId: "order-1",
      changedBy: "owner-1",
    });

    expect(outcome).toMatchObject({ status: "error" });
    expect(harness.orderUpdate).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: {
        stockReservedAt: null,
        stockReservationError: expect.stringContaining("ขาด 6 ตัว"),
      },
    });
  });

  it("product บางตัวไม่มี mirror ต้องล้มทั้งการจอง ไม่ mark reserved แค่ subset", async () => {
    const harness = localReservationHarness();
    harness.tx.order.findUniqueOrThrow.mockResolvedValue({
      id: "order-1",
      orderNumber: "ORD-DEMO-1",
      internalStatus: "CONFIRMED",
      stockReservedAt: new Date(),
      items: [
        {
          products: [
            {
              itemSource: "FROM_STOCK",
              productId: "product-1",
              description: "เสื้อที่ map แล้ว",
              variants: [{ size: "M", color: "ดำ", quantity: 5 }],
            },
            {
              itemSource: "FROM_STOCK",
              productId: "missing-product",
              description: "เสื้อที่ mirror หาย",
              variants: [{ size: "L", color: "ขาว", quantity: 5 }],
            },
          ],
        },
      ],
    });

    const outcome = await syncOrderStockReservation(harness.prisma, {
      orderId: "order-1",
      changedBy: "owner-1",
    });

    expect(outcome).toMatchObject({
      status: "error",
      message: expect.stringContaining("เสื้อที่ mirror หาย"),
    });
    expect(harness.orderUpdate).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: {
        stockReservedAt: null,
        stockReservationError: expect.stringContaining("เสื้อที่ mirror หาย"),
      },
    });
  });
});
