import type { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";

const stockMocks = vi.hoisted(() => ({
  sync: vi.fn(),
  release: vi.fn(),
}));

vi.mock("@/server/services/stock-reservation", () => ({
  STOCK_RESERVATION_PENDING_MESSAGE: "รอเชื่อมสต๊อก",
  syncOrderStockReservation: stockMocks.sync,
  releaseOrderStockReservation: stockMocks.release,
}));

import { orderRouter } from "./order";
import { quotationRouter } from "./quotation";

const CUSTOMER_ID = "customer-credit-ordering";
const LINKED_ORDER_ID = "linked-order-credit-ordering";

function orderResult(overrides: Record<string, unknown> = {}) {
  return {
    id: LINKED_ORDER_ID,
    orderNumber: "ORD-2608-0001",
    orderType: "CUSTOM",
    channel: "LINE",
    customerId: CUSTOMER_ID,
    internalStatus: "CONFIRMED",
    title: "ออเดอร์ล่าสุด",
    paymentTerms: "NET_30",
    subtotalItems: 900,
    subtotalFees: 0,
    discount: 0,
    taxAmount: 0,
    totalAmount: 900,
    platformFee: 0,
    totalCost: 0,
    profitMargin: 100,
    ...overrides,
  };
}

function acceptedQuotation(orderId: string | null, totalAmount = 100) {
  return {
    id: "quotation-credit-ordering",
    quotationNumber: "QT-2608-0001",
    orderId,
    customerId: CUSTOMER_ID,
    status: "ACCEPTED",
    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    title: "งานตามใบเสนอ",
    description: null,
    subtotal: totalAmount,
    discount: 0,
    tax: 0,
    totalAmount,
    items: [],
  };
}

function quotationContext(params: {
  role: Role;
  quotation: ReturnType<typeof acceptedQuotation>;
  tx: Record<string, unknown>;
}): Context {
  return {
    prisma: {
      quotation: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(params.quotation),
      },
      customer: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          defaultPaymentTerms: "COD",
        }),
      },
      $transaction: vi.fn(
        async (callback: (transaction: unknown) => unknown) =>
          callback(params.tx),
      ),
    } as unknown as Context["prisma"],
    userId: "sales-doc-user",
    userRole: params.role,
    permissionOverrides: null,
  };
}

function linkedQuotationTx(params: {
  status?: "DRAFT" | "INQUIRY" | "CONFIRMED";
  totalAmount?: number;
  itemCount?: number;
  creditLimit?: number | null;
}) {
  const liveOrder = orderResult({
    internalStatus: params.status ?? "CONFIRMED",
    totalAmount: params.totalAmount ?? 900,
  });
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    order: {
      findUniqueOrThrow: vi.fn().mockImplementation(
        (args: {
          select?: { customerId?: boolean; orderType?: boolean };
        }) =>
          args.select?.orderType && !args.select.customerId
            ? {
                orderType: liveOrder.orderType,
                internalStatus: liveOrder.internalStatus,
              }
            : liveOrder,
      ),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    orderItem: {
      count: vi.fn().mockResolvedValue(params.itemCount ?? 1),
    },
    quotation: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    customer: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        creditLimit: params.creditLimit ?? null,
      }),
      update: vi.fn().mockResolvedValue({ id: CUSTOMER_ID }),
    },
    invoice: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

describe("credit lock ordering across new-order writers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stockMocks.sync.mockResolvedValue({ status: "skipped" });
    stockMocks.release.mockResolvedValue({ status: "skipped" });
  });

  it("order.create จองเลข ORDER ก่อน lock ลูกค้าสำหรับออเดอร์ที่เกิดเป็น CONFIRMED", async () => {
    const created = orderResult({
      id: "created-order",
      orderType: "READY_MADE",
      internalStatus: "CONFIRMED",
      totalAmount: 100,
    });
    const tx = {
      documentSequence: {
        upsert: vi.fn().mockResolvedValue({ lastNumber: 1 }),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
      customer: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ creditLimit: null }),
        update: vi.fn().mockResolvedValue({ id: CUSTOMER_ID }),
      },
      order: {
        create: vi.fn().mockResolvedValue(created),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    };
    const ctx = {
      prisma: {
        $transaction: vi.fn(
          async (callback: (transaction: unknown) => unknown) => callback(tx),
        ),
      } as unknown as Context["prisma"],
      userId: "sales-1",
      userRole: "SALES" as const,
      permissionOverrides: null,
    };

    await orderRouter.createCaller(ctx).create({
      customerId: CUSTOMER_ID,
      title: "เสื้อพร้อมขาย",
      taxRate: 0,
      items: [
        {
          description: "เสื้อเปล่า",
          products: [
            {
              productType: "T_SHIRT",
              description: "เสื้อคอกลม",
              baseUnitPrice: 100,
              variants: [{ size: "M", quantity: 1 }],
            },
          ],
          prints: [],
          addons: [],
        },
      ],
    });

    expect(tx.documentSequence.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      tx.$queryRaw.mock.invocationCallOrder[0],
    );
    expect(tx.$queryRaw.mock.calls[0]?.[1]).toBe(CUSTOMER_ID);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.order.create.mock.invocationCallOrder[0],
    );
  });

  it("quotation.convert ใบลอยจองเลข ORDER ก่อน lock ลูกค้า", async () => {
    const quotation = acceptedQuotation(null, 100);
    const created = orderResult({ id: "order-from-quotation", totalAmount: 100 });
    const tx = {
      documentSequence: {
        upsert: vi.fn().mockResolvedValue({ lastNumber: 2 }),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
      quotation: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({ id: quotation.id }),
      },
      customer: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ creditLimit: null }),
        update: vi.fn().mockResolvedValue({ id: CUSTOMER_ID }),
      },
      order: {
        create: vi.fn().mockResolvedValue(created),
      },
      orderRevision: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "revision-1" }),
      },
    };
    const ctx = quotationContext({ role: "SALES", quotation, tx });

    await quotationRouter.createCaller(ctx).convertToOrder({ id: quotation.id });

    expect(tx.documentSequence.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      tx.$queryRaw.mock.invocationCallOrder[0],
    );
    expect(tx.$queryRaw.mock.calls[0]?.[1]).toBe(CUSTOMER_ID);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.order.create.mock.invocationCallOrder[0],
    );
  });
});

describe("quotation.convert linked-order snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stockMocks.sync.mockResolvedValue({ status: "skipped" });
  });

  it.each(["OWNER", "MANAGER"] as const)(
    "role %s ก็ lock ออเดอร์ผูกก่อนอ่านและเขียน",
    async (role) => {
      const quotation = acceptedQuotation(LINKED_ORDER_ID, 100);
      const tx = linkedQuotationTx({ status: "CONFIRMED", itemCount: 1 });
      const ctx = quotationContext({ role, quotation, tx });

      await quotationRouter.createCaller(ctx).convertToOrder({ id: quotation.id });

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.$queryRaw.mock.calls[0]?.[1]).toBe(LINKED_ORDER_ID);
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.order.findUniqueOrThrow.mock.invocationCallOrder[0],
      );
      expect(tx.quotation.updateMany).toHaveBeenCalledOnce();
    },
  );

  it("SALES ใช้ยอดและจำนวนรายการสดที่อ่านหลัง order lock ก่อนตรวจวงเงิน", async () => {
    const quotation = acceptedQuotation(LINKED_ORDER_ID, 100);
    const tx = linkedQuotationTx({
      status: "INQUIRY",
      totalAmount: 900,
      itemCount: 1,
      creditLimit: 500,
    });
    const ctx = quotationContext({ role: "SALES", quotation, tx });

    await expect(
      quotationRouter.createCaller(ctx).convertToOrder({ id: quotation.id }),
    ).rejects.toThrow(/ออเดอร์นี้ 900\.00 > วงเงิน 500\.00/);

    expect(tx.$queryRaw.mock.calls.map((call) => call[1])).toEqual([
      LINKED_ORDER_ID,
      CUSTOMER_ID,
    ]);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.order.findUniqueOrThrow.mock.invocationCallOrder[0],
    );
    expect(tx.order.findUniqueOrThrow.mock.invocationCallOrder[0]).toBeLessThan(
      tx.$queryRaw.mock.invocationCallOrder[1],
    );
    expect(tx.quotation.updateMany).not.toHaveBeenCalled();
  });

  it("ออเดอร์ที่ถูกยืนยันไปแล้วไม่นับยอดเดิมซ้ำตอน SALES แปลงใบเสนอ", async () => {
    const quotation = acceptedQuotation(LINKED_ORDER_ID, 100);
    const tx = linkedQuotationTx({
      status: "CONFIRMED",
      totalAmount: 900,
      itemCount: 1,
      creditLimit: 950,
    });
    tx.order.findMany.mockResolvedValue([
      { id: LINKED_ORDER_ID, totalAmount: 900 },
    ]);
    const ctx = quotationContext({ role: "SALES", quotation, tx });

    await expect(
      quotationRouter.createCaller(ctx).convertToOrder({ id: quotation.id }),
    ).resolves.toMatchObject({ id: LINKED_ORDER_ID });

    expect(tx.quotation.updateMany).toHaveBeenCalledOnce();
  });
});
