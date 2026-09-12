import type { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { customerRouter } from "./customer";
import { orderRouter } from "./order";

vi.mock("@/server/services/stock-reservation-sweep", () => ({
  maybeSweepStaleReservations: vi.fn().mockResolvedValue(undefined),
}));

function fixture(role: Role, permissionOverrides: unknown) {
  const order = {
    id: "order-test", orderNumber: "ORD-TEST", internalStatus: "DRAFT",
    statusToken: "STATUS_SECRET_SENTINEL", uploadToken: "UPLOAD_SECRET_SENTINEL",
    statusTokenExpiresAt: new Date("2026-10-01"), uploadTokenExpiresAt: new Date("2026-10-02"),
    totalAmount: 107, totalCost: 50, profitMargin: 57,
    customer: { id: "customer-test", name: "ลูกค้าทดลอง", totalSpent: 107, creditLimit: 1000 },
    items: [], fees: [], revisions: [], designs: [], productions: [], invoices: [], costEntries: [],
  };
  const customer = { ...order.customer, orders: [order] };
  const ctx: Context = {
    userId: "actor", userRole: role, permissionOverrides,
    prisma: {
      order: {
        findMany: vi.fn().mockResolvedValue([order]),
        count: vi.fn().mockResolvedValue(1),
        groupBy: vi.fn().mockResolvedValue([{ internalStatus: "DRAFT", _count: { _all: 1 } }]),
        findUnique: vi.fn().mockResolvedValue(order),
      },
      customer: { findUniqueOrThrow: vi.fn().mockResolvedValue(customer) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as Context["prisma"],
  };
  return { order, orders: orderRouter.createCaller(ctx), customers: customerRouter.createCaller(ctx) };
}

describe("order reads do not expose customer-link bearer credentials", () => {
  it.each([
    ["PRODUCTION_STAFF", null, false],
    ["PRODUCTION_STAFF", { create_sales_docs: true, see_order_money: true }, true],
    ["SALES", null, true],
    ["OWNER", { create_sales_docs: false, see_order_money: false }, false],
    ["OWNER", null, true],
  ] as const)("%s / %j omits secrets from all three ordinary reads", async (role, overrides, canSeeMoney) => {
    const { order, orders, customers } = fixture(role, overrides);
    const list = await orders.list({});
    const detail = await orders.getById({ id: order.id });
    const customer = await customers.getById({ id: order.customer.id });
    for (const [endpoint, response] of [
      ["order.list", list.orders[0]],
      ["order.getById", detail],
      ["customer.getById.orders", customer.orders[0]],
    ] as const) {
      expect(response, endpoint).toMatchObject({ id: order.id, orderNumber: order.orderNumber, totalAmount: canSeeMoney ? 107 : null });
      for (const field of ["statusToken", "statusTokenExpiresAt", "uploadToken", "uploadTokenExpiresAt"]) {
        expect(Object.hasOwn(response, field), `${endpoint}.${field}`).toBe(false);
      }
      expect(JSON.stringify(response), endpoint).not.toContain("SECRET_SENTINEL");
    }
    expect(list).toMatchObject({ total: 1, pages: 1, statusCounts: { DRAFT: 1 } });
    // Response redaction must not revoke or change the stored customer links.
    expect(order).toMatchObject({ statusToken: "STATUS_SECRET_SENTINEL", uploadToken: "UPLOAD_SECRET_SENTINEL" });
    expect(order.statusTokenExpiresAt).toEqual(new Date("2026-10-01"));
    expect(order.uploadTokenExpiresAt).toEqual(new Date("2026-10-02"));
  });
});
