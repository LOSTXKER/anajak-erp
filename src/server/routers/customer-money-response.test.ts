import type { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { customerRouter } from "./customer";

function fixture(role: Role, permissionOverrides: unknown = null) {
  const customer = { id: "customer-test", name: "ลูกค้าทดลอง", email: null, creditLimit: 12345, totalSpent: 98765 };
  const create = vi.fn().mockResolvedValue(customer);
  const update = vi.fn().mockResolvedValue(customer);
  const audit = vi.fn().mockResolvedValue({});
  const ctx: Context = {
    userId: "actor", userRole: role, permissionOverrides,
    prisma: { customer: { create, update, findUniqueOrThrow: vi.fn().mockResolvedValue(customer) }, auditLog: { create: audit } } as unknown as Context["prisma"],
  };
  return { customer, create, update, audit, caller: customerRouter.createCaller(ctx) };
}

describe("customer mutation money visibility", () => {
  it.each([
    ["PRODUCTION_STAFF", { manage_customers: true, see_order_money: false }, false],
    ["MANAGER", { see_order_money: false }, false],
    ["OWNER", { see_order_money: false }, false],
    ["PRODUCTION_STAFF", { manage_customers: true, see_order_money: true }, true],
    ["MANAGER", null, true],
    ["SALES", null, true],
  ] as const)("%s / %j returns money only with the effective permission", async (role, overrides, canSeeMoney) => {
    const { caller, customer, audit } = fixture(role, overrides);
    const created = await caller.create({ name: customer.name });
    const updated = await caller.update({ id: customer.id, notes: "แก้โน้ตได้" });
    for (const result of [created, updated]) {
      expect(result).toMatchObject({ id: customer.id, name: customer.name,
        creditLimit: canSeeMoney ? 12345 : null, totalSpent: canSeeMoney ? 98765 : null });
    }
    expect(customer).toMatchObject({ creditLimit: 12345, totalSpent: 98765 });
    expect(audit).toHaveBeenCalledTimes(2);
    expect(audit.mock.calls[1][0].data.oldValue).toMatchObject({ creditLimit: 12345, totalSpent: 98765 });
  });

  it("preserves write permission and the sales credit-limit restriction", async () => {
    const worker = fixture("PRODUCTION_STAFF");
    await expect(worker.caller.create({ name: "ไม่ได้รับสิทธิ์" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(worker.caller.update({ id: "customer-test", notes: "ไม่ได้รับสิทธิ์" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(worker.create).not.toHaveBeenCalled();
    expect(worker.update).not.toHaveBeenCalled();
    const sales = fixture("SALES");
    await expect(sales.caller.create({ name: "ลูกค้า", creditLimit: 100 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(sales.caller.update({ id: "customer-test", creditLimit: 100 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(sales.create).not.toHaveBeenCalled();
    expect(sales.update).not.toHaveBeenCalled();
  });
});
