import { describe, expect, it } from "vitest";
import {
  billingActionAvailability,
  billingOverview,
  canCreateInvoiceForOrder,
  canIssueReceiptForPayment,
  cashAmountForRemaining,
  invoiceBalance,
  paymentSettlementPreview,
  receiptAmounts,
  suggestedWht,
  type BillingUiInvoice,
} from "./billing-ui";

const invoice = (overrides: Partial<BillingUiInvoice> = {}): BillingUiInvoice => ({
  type: "DEPOSIT_INVOICE",
  totalAmount: 107,
  amount: 100,
  discount: 0,
  tax: 7,
  isVoided: false,
  paymentStatus: "UNPAID",
  payments: [],
  adjustments: [],
  ...overrides,
});

describe("billing UI policy", () => {
  it("สรุปยอดเฉพาะบิล active และนับ WHT เป็นยอดเคลียร์", () => {
    const overview = billingOverview([
      invoice({
        payments: [
          { amount: 97, whtAmount: 3, receiptInvoice: null },
          { amount: 7, whtAmount: 0, receiptInvoice: { isVoided: false } },
        ],
      }),
      invoice({ totalAmount: 50, payments: [{ amount: 50, whtAmount: 0 }] }),
      invoice({ totalAmount: 999, isVoided: true, payments: [{ amount: 999, whtAmount: 0 }] }),
    ]);

    expect(overview).toMatchObject({
      totalInvoiced: 157,
      totalPaid: 157,
      // ใบแรกเคลียร์ครบ (107) · ใบสอง 50 ชำระครบ · ใบ void ไม่นับ → ค้าง 0
      totalOutstanding: 0,
      pendingReceiptCount: 2,
      hasLiveReceivable: true,
    });
  });

  it("totalOutstanding รวมเฉพาะใบเรียกเก็บที่ยังมีผล นิยามเดียวกับ remaining รายใบ", () => {
    expect(
      billingOverview([
        invoice({ totalAmount: 200, payments: [{ amount: 97, whtAmount: 3 }] }),
        invoice({ totalAmount: 50 }),
        // ใบเสร็จ/ใบ void ไม่ใช่ลูกหนี้ — ห้ามปนเข้ายอดค้าง
        invoice({ type: "RECEIPT", totalAmount: 30, forPaymentId: "p1" }),
        invoice({ totalAmount: 999, isVoided: true }),
      ]).totalOutstanding
    ).toBe(150);
  });

  it("นับใบเสร็จไม่ผูกงวดเฉพาะใบ active", () => {
    expect(
      billingOverview([
        invoice({ type: "RECEIPT", forPaymentId: null }),
        invoice({ type: "RECEIPT", forPaymentId: "payment-1" }),
        invoice({ type: "RECEIPT", forPaymentId: null, isVoided: true }),
      ]).unlinkedReceiptCount
    ).toBe(1);
  });

  it("คำนวณยอดค้างจากเงินสด WHT และใบลดหนี้ที่ยังใช้งาน", () => {
    expect(
      invoiceBalance(
        invoice({
          totalAmount: 200,
          payments: [
            { amount: 97, whtAmount: 3 },
            { amount: -20, whtAmount: 0 },
          ],
          adjustments: [
            { type: "CREDIT_NOTE", totalAmount: 25, isVoided: false },
            { type: "CREDIT_NOTE", totalAmount: 40, isVoided: true },
            { type: "DEBIT_NOTE", totalAmount: 10, isVoided: false },
          ],
        })
      )
    ).toEqual({ paid: 80, credited: 25, remaining: 95, netCash: 77 });
  });

  it("เปิด action ต่อใบตาม permission สถานะ และชนิดเอกสาร", () => {
    const receivable = invoice({ payments: [{ amount: 20, whtAmount: 0 }] });
    expect(
      billingActionAvailability({
        invoice: receivable,
        netCash: 20,
        canRecordMoney: true,
        hasLiveReceivable: true,
      })
    ).toEqual({ canRecordPayment: true, canRecordRefund: true, canVoid: true });

    expect(
      billingActionAvailability({
        invoice: invoice({ type: "CREDIT_NOTE", payments: [{ amount: 20, whtAmount: 0 }] }),
        netCash: 20,
        canRecordMoney: true,
        hasLiveReceivable: true,
      })
    ).toEqual({ canRecordPayment: false, canRecordRefund: false, canVoid: true });

    expect(
      billingActionAvailability({
        invoice: invoice({ type: "RECEIPT" }),
        netCash: 0,
        canRecordMoney: true,
        hasLiveReceivable: true,
      }).canRecordPayment
    ).toBe(false);
    expect(
      billingActionAvailability({
        invoice: invoice({ type: "RECEIPT" }),
        netCash: 0,
        canRecordMoney: true,
        hasLiveReceivable: false,
      }).canRecordPayment
    ).toBe(true);
  });

  it("ซ่อน action ทั้งหมดเมื่อไม่มีสิทธิ์หรือใบถูก void", () => {
    expect(
      billingActionAvailability({
        invoice: invoice({ payments: [{ amount: 20, whtAmount: 0 }] }),
        netCash: 20,
        canRecordMoney: false,
        hasLiveReceivable: true,
      })
    ).toEqual({ canRecordPayment: false, canRecordRefund: false, canVoid: false });
    expect(
      billingActionAvailability({
        invoice: invoice({ isVoided: true, payments: [{ amount: 20, whtAmount: 0 }] }),
        netCash: 20,
        canRecordMoney: true,
        hasLiveReceivable: true,
      })
    ).toEqual({ canRecordPayment: false, canRecordRefund: false, canVoid: false });
  });

  it("ออกใบเสร็จได้เฉพาะเงินรับบนใบเรียกเก็บ active ที่ยังไม่มีใบ active", () => {
    const params = {
      invoice: invoice(),
      payment: { amount: 97, whtAmount: 3, receiptInvoice: null },
      canBill: true,
    };
    expect(canIssueReceiptForPayment(params)).toBe(true);
    expect(
      canIssueReceiptForPayment({
        ...params,
        payment: { ...params.payment, receiptInvoice: { isVoided: false } },
      })
    ).toBe(false);
    expect(
      canIssueReceiptForPayment({ ...params, invoice: invoice({ type: "RECEIPT" }) })
    ).toBe(false);
    expect(canIssueReceiptForPayment({ ...params, canBill: false })).toBe(false);
    expect(
      canIssueReceiptForPayment({
        ...params,
        payment: { amount: 0, whtAmount: 0, receiptInvoice: null },
      })
    ).toBe(false);
  });

  it("คงกติกาสถานะที่สร้างบิลได้", () => {
    expect(canCreateInvoiceForOrder("CONFIRMED")).toBe(true);
    expect(canCreateInvoiceForOrder("INQUIRY")).toBe(false);
    expect(canCreateInvoiceForOrder("CANCELLED")).toBe(false);
    expect(canCreateInvoiceForOrder("COMPLETED")).toBe(false);
  });

  it("แบ่งฐานและ VAT ของใบเสร็จตามใบต้นทาง", () => {
    expect(
      receiptAmounts({
        invoice: invoice(),
        payment: { amount: 48.5, whtAmount: 1.5 },
      })
    ).toEqual({ gross: 50, amount: 46.73, tax: 3.27 });
  });

  it("คำนวณ WHT เงินสด และยอดเคลียร์โดยมี epsilon เดิม", () => {
    expect(suggestedWht(invoice())).toBe(3);
    expect(cashAmountForRemaining(107, 3)).toBe(104);
    expect(
      paymentSettlementPreview({ cash: 104, wht: 3, whtEnabled: true, remaining: 107 })
    ).toEqual({ settled: 107, exceedsRemaining: false });
    expect(
      paymentSettlementPreview({ cash: 107.005, wht: 0, whtEnabled: false, remaining: 107 })
        .exceedsRemaining
    ).toBe(false);
    expect(
      paymentSettlementPreview({ cash: 107.006, wht: 0, whtEnabled: false, remaining: 107 })
        .exceedsRemaining
    ).toBe(true);
  });
});
