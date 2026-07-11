import { describe, expect, it, vi } from "vitest";
import type { Role } from "@prisma/client";
import type { Context } from "../trpc";
import { searchRouter } from "./search";

function makeCtx(role: Role, permissionOverrides: unknown = null) {
  const findOrders = vi.fn().mockResolvedValue([]);
  const findCustomers = vi.fn().mockResolvedValue([]);
  const findQuotations = vi.fn().mockResolvedValue([]);
  const findInvoices = vi.fn().mockResolvedValue([]);

  const ctx: Context = {
    prisma: {
      order: { findMany: findOrders },
      customer: { findMany: findCustomers },
      quotation: { findMany: findQuotations },
      invoice: { findMany: findInvoices },
    } as unknown as Context["prisma"],
    userId: "search-user",
    userRole: role,
    permissionOverrides,
  };

  return { ctx, findOrders, findCustomers, findQuotations, findInvoices };
}

describe("search.global permission boundary", () => {
  it("ช่างค้นออเดอร์/ลูกค้าได้ แต่ query เงินไม่ถูกเรียก", async () => {
    const stub = makeCtx("PRODUCTION_STAFF");

    await expect(searchRouter.createCaller(stub.ctx).global({ q: "AN" })).resolves.toEqual({
      orders: [],
      customers: [],
      quotations: [],
      invoices: [],
    });

    expect(stub.findOrders).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    expect(stub.findCustomers).toHaveBeenCalledOnce();
    expect(stub.findQuotations).not.toHaveBeenCalled();
    expect(stub.findInvoices).not.toHaveBeenCalled();
  });

  it("override เพิ่มสิทธิ์เห็นเงินให้ช่าง → ค้นใบเสนอและบิลได้", async () => {
    const stub = makeCtx("PRODUCTION_STAFF", { see_order_money: true });

    await searchRouter.createCaller(stub.ctx).global({ q: "AN", limit: 3 });

    expect(stub.findQuotations).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
    expect(stub.findInvoices).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
  });

  it("override ตัดสิทธิ์จากฝ่ายขาย → ไม่ยิง query ใบเสนอและบิล", async () => {
    const stub = makeCtx("SALES", { see_order_money: false });

    await searchRouter.createCaller(stub.ctx).global({ q: "AN" });

    expect(stub.findQuotations).not.toHaveBeenCalled();
    expect(stub.findInvoices).not.toHaveBeenCalled();
  });

  it("คืนลิงก์ไปหน้าทำงานต่อ โดยผลค้นหาไม่มีตัวเลขเงิน", async () => {
    const stub = makeCtx("SALES");
    stub.findOrders.mockResolvedValueOnce([
      {
        id: "order-1",
        orderNumber: "AN-001",
        title: "เสื้อทีม",
        customer: { name: "ลูกค้าเอ", company: null },
      },
    ]);
    stub.findCustomers.mockResolvedValueOnce([
      { id: "customer-1", name: "ลูกค้าเอ", company: null, phone: "081", email: null },
    ]);
    stub.findQuotations.mockResolvedValueOnce([
      {
        id: "quotation-1",
        quotationNumber: "QT-001",
        title: "เสนอเสื้อทีม",
        customer: { name: "ลูกค้าเอ" },
      },
    ]);
    stub.findInvoices.mockResolvedValueOnce([
      {
        id: "invoice-1",
        invoiceNumber: "INV-001",
        orderId: "order-1",
        order: { orderNumber: "AN-001" },
        customer: { name: "ลูกค้าเอ" },
      },
    ]);

    const result = await searchRouter.createCaller(stub.ctx).global({ q: "001" });

    expect(result.orders[0]).toMatchObject({ href: "/orders/order-1", title: "AN-001" });
    expect(result.customers[0]).toMatchObject({ href: "/customers/customer-1" });
    expect(result.quotations[0]).toMatchObject({ href: "/quotations/quotation-1" });
    expect(result.invoices[0]).toMatchObject({ href: "/orders/order-1?tab=money" });
    expect(JSON.stringify(result)).not.toContain("totalAmount");
  });
});
