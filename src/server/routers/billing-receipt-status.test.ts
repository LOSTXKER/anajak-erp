import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { billingRouter } from "./billing";

vi.mock("@/server/services/document-party", () => ({
  buildDocumentPartySnapshot: vi.fn().mockResolvedValue({ buyerName: "ลูกค้าทดลอง" }),
}));

function fixture(paymentOverrides: Record<string, unknown> = {}) {
  const payment = {
    id: "payment-test", amount: 100, whtAmount: 0,
    createdAt: new Date("2026-09-12T18:15:00.000Z"),
    invoice: { orderId: "order-test", type: "DEPOSIT_INVOICE" }, receiptInvoice: null,
    ...paymentOverrides,
  };
  const createInvoice = vi.fn().mockImplementation(({ data }) => Promise.resolve({
    id: "receipt-test", paymentStatus: "UNPAID", paidAt: null, isVoided: false, ...data,
  }));
  const createPayment = vi.fn();
  const updateCustomer = vi.fn();
  const unlinkReceipt = vi.fn().mockResolvedValue({ count: 1 });
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    order: { findUniqueOrThrow: vi.fn().mockResolvedValue({ totalAmount: 1000 }) },
    invoice: { findMany: vi.fn().mockResolvedValue([]), create: createInvoice, updateMany: unlinkReceipt },
    payment: { findUnique: vi.fn().mockResolvedValue(payment), create: createPayment },
    customer: { update: updateCustomer },
    documentSequence: { upsert: vi.fn().mockResolvedValue({ lastNumber: 1 }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const ctx: Context = {
    userId: "accountant", userRole: "ACCOUNTANT",
    prisma: {
      order: { findUnique: vi.fn().mockResolvedValue({ id: "order-test", customerId: "customer-test", totalAmount: 1000, paymentTerms: "CASH" }) },
      $transaction: (fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx),
    } as unknown as Context["prisma"],
  };
  return { caller: billingRouter.createCaller(ctx), payment, createInvoice, createPayment, updateCustomer, unlinkReceipt };
}

const baseInput = { orderId: "order-test", customerId: "customer-test", type: "RECEIPT" as const, amount: 100 };

describe("receipt status follows its existing received payment", () => {
  it.each([
    [100, 0, 100],
    [97, 3, 100],
    [0, 3, 3],
  ])("receipt for cash %s + WHT %s is paid without recording the money twice", async (amount, whtAmount, gross) => {
    const { caller, payment, createPayment, updateCustomer } = fixture({ amount, whtAmount });
    const result = await caller.create({ ...baseInput, amount: gross, forPaymentId: payment.id });
    expect(result).toMatchObject({ paymentStatus: "PAID", paidAt: payment.createdAt, issueDate: payment.createdAt, totalAmount: gross, forPaymentId: payment.id });
    expect(createPayment).not.toHaveBeenCalled();
    expect(updateCustomer).not.toHaveBeenCalled();
    expect(payment).toMatchObject({ amount, whtAmount });
  });

  it("a corrected document date does not replace the timestamp of the received payment", async () => {
    const { caller, payment } = fixture();
    const result = await caller.create({ ...baseInput, forPaymentId: payment.id, issueDate: "2026-09-11" });
    expect(result).toMatchObject({ paymentStatus: "PAID", paidAt: payment.createdAt, issueDate: new Date("2026-09-11") });
  });

  it.each(["RECEIPT", "DEPOSIT_INVOICE", "FINAL_INVOICE"] as const)("%s without a received payment stays unpaid", async (type) => {
    const { caller, createPayment, updateCustomer } = fixture();
    const result = await caller.create({ ...baseInput, type });
    expect(result).toMatchObject({ paymentStatus: "UNPAID", paidAt: null, forPaymentId: null });
    expect(createPayment).not.toHaveBeenCalled();
    expect(updateCustomer).not.toHaveBeenCalled();
  });

  it("reissuing a voided receipt keeps the original received timestamp", async () => {
    const { caller, payment, unlinkReceipt } = fixture({ receiptInvoice: { id: "voided-receipt", invoiceNumber: "REC-OLD", isVoided: true } });
    const result = await caller.create({ ...baseInput, forPaymentId: payment.id });
    expect(result).toMatchObject({ paymentStatus: "PAID", paidAt: payment.createdAt });
    expect(unlinkReceipt).toHaveBeenCalledWith({ where: { forPaymentId: payment.id }, data: { forPaymentId: null } });
  });

  it.each([
    { amount: 99 },
    { amount: -100 },
    { invoice: { orderId: "other-order", type: "DEPOSIT_INVOICE" } },
    { invoice: { orderId: "order-test", type: "RECEIPT" } },
    { receiptInvoice: { id: "existing-receipt", invoiceNumber: "REC-EXISTING", isVoided: false } },
  ])("invalid received-payment link is rejected before creating a paid receipt: %j", async (paymentOverrides) => {
    const { caller, payment, createInvoice, createPayment } = fixture(paymentOverrides);
    await expect(caller.create({ ...baseInput, forPaymentId: payment.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createInvoice).not.toHaveBeenCalled();
    expect(createPayment).not.toHaveBeenCalled();
  });
});
