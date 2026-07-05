import { describe, it, expect } from "vitest";
import {
  planPaymentSettlement,
  assertVoidableInvoice,
  assertDebitNoteVoidKeepsFloor,
  statusAfterCreditNoteVoid,
  type SettlementInvoice,
} from "./billing-payment";
import { D } from "./money";

const inv = (over: Partial<SettlementInvoice> = {}): SettlementInvoice => ({
  type: "FINAL_INVOICE",
  isVoided: false,
  totalAmount: 1000,
  tax: 0,
  payments: [],
  adjustments: [],
  ...over,
});

const plan = (
  invoice: SettlementInvoice,
  amount: number,
  whtAmount = 0,
  openReceivableCount = 0
) =>
  planPaymentSettlement({
    invoice,
    amount: D(amount),
    whtAmount: D(whtAmount),
    openReceivableCount,
  });

describe("planPaymentSettlement — ด่านปฏิเสธ", () => {
  it("ใบที่ถูกยกเลิกแล้ว → ปฏิเสธ", () => {
    expect(() => plan(inv({ isVoided: true }), 100)).toThrow(/ยกเลิกแล้ว/);
  });

  it("ใบลดหนี้ = เงินฝั่งคืนลูกค้า → ปฏิเสธ", () => {
    expect(() => plan(inv({ type: "CREDIT_NOTE" }), 100)).toThrow(/ใบลดหนี้/);
  });

  it("ใบเสร็จปลายทาง: ออเดอร์มีใบเรียกเก็บอยู่ → ปฏิเสธ (Gate A1 กันเงินก้อนเดียวลงซ้ำสองใบ)", () => {
    expect(() => plan(inv({ type: "RECEIPT" }), 100, 0, 1)).toThrow(/เอกสารปลายทาง/);
  });

  it("ขายสดออกใบเสร็จตรง (ไม่มีใบเรียกเก็บ) → บันทึกได้", () => {
    expect(plan(inv({ type: "RECEIPT" }), 1000).paymentStatus).toBe("PAID");
  });

  it("เกินยอดคงเหลือ → ปฏิเสธ พร้อมบอกยอดที่เหลือ", () => {
    expect(() => plan(inv(), 1000.01)).toThrow(/เหลือ 1000\.00 บาท/);
  });

  it("ยอดคงเหลือหักทั้งเงินที่รับแล้ว + WHT + ใบลดหนี้ที่อ้างใบนี้ (Gate B1)", () => {
    const invoice = inv({
      payments: [{ amount: 291, whtAmount: 9 }],
      adjustments: [
        { type: "CREDIT_NOTE", totalAmount: 200, isVoided: false },
        { type: "CREDIT_NOTE", totalAmount: 999, isVoided: true }, // void — ไม่นับ
        { type: "DEBIT_NOTE", totalAmount: 999, isVoided: false }, // DN ไม่ใช่ตัวเคลียร์
      ],
    });
    // เคลียร์แล้ว 300 + CN 200 → เหลือ 500
    expect(() => plan(invoice, 500.01)).toThrow(/เหลือ 500\.00 บาท/);
    expect(plan(invoice, 500).paymentStatus).toBe("PAID");
    expect(plan(invoice, 300).paymentStatus).toBe("PARTIALLY_PAID");
  });
});

describe("planPaymentSettlement — ยอดเคลียร์ + สถานะ", () => {
  it("จ่ายครบพอดี → PAID · settled = เงินสด + WHT", () => {
    const result = plan(inv(), 970, 30);
    expect(result.paymentStatus).toBe("PAID");
    expect(result.settled.toNumber()).toBe(1000);
  });

  it("จ่ายบางส่วน → PARTIALLY_PAID", () => {
    expect(plan(inv(), 400).paymentStatus).toBe("PARTIALLY_PAID");
  });

  it("WHT ล้วนเคลียร์ 3% ค้าง (ใบ 50ทวิ ตามมาทีหลัง) → PAID", () => {
    const invoice = inv({ payments: [{ amount: 970, whtAmount: 0 }] });
    const result = plan(invoice, 0, 30);
    expect(result.paymentStatus).toBe("PAID");
    expect(result.settled.toNumber()).toBe(30);
  });
});

describe("planPaymentSettlement — ทะเบียน 50ทวิ", () => {
  it("ไม่มี WHT → ไม่เกิดแถวทะเบียน", () => {
    expect(plan(inv(), 100).whtCert).toBeNull();
  });

  it("ฐานโดยนัยจากอัตรา 3%: หัก 30 → ฐาน 1000 อัตรา 3%", () => {
    const cert = plan(inv({ totalAmount: 1070, tax: 70 }), 1040, 30).whtCert;
    expect(cert).toEqual({ baseAmount: 1000, ratePct: 3, amount: 30 });
  });

  it("จ่ายหลายงวด: แต่ละงวดได้ฐานตามยอดหักงวดนั้น (ฐานรวม = ฐานใบ)", () => {
    // ใบฐาน 1000 · งวดแรกหัก 12 → ฐาน 400 · งวดสองหัก 18 → ฐาน 600
    const first = plan(inv({ totalAmount: 1070, tax: 70 }), 416, 12).whtCert;
    expect(first).toEqual({ baseAmount: 400, ratePct: 3, amount: 12 });
    const second = plan(
      inv({ totalAmount: 1070, tax: 70, payments: [{ amount: 416, whtAmount: 12 }] }),
      624,
      18
    ).whtCert;
    expect(second).toEqual({ baseAmount: 600, ratePct: 3, amount: 18 });
  });

  it("ลูกค้าหักอัตราอื่น: ฐานโดยนัยทะลุฐานใบ → cap ที่ฐานใบ + ratePct สะท้อนอัตราจริง", () => {
    // ใบฐาน 1000 หัก 50 (5%) — ฐานโดยนัย 1666.67 เกินฐานใบ → cap 1000 · อัตรา 5%
    const cert = plan(inv({ totalAmount: 1070, tax: 70 }), 1020, 50).whtCert;
    expect(cert).toEqual({ baseAmount: 1000, ratePct: 5, amount: 50 });
  });
});

describe("assertVoidableInvoice", () => {
  const voidable = { isVoided: false, billingNoteItems: [], adjustments: [] };

  it("ใบปกติ ไม่มีเอกสารผูก → ผ่าน", () => {
    expect(() => assertVoidableInvoice(voidable)).not.toThrow();
  });

  it("void ซ้ำ → ปฏิเสธ (กัน totalSpent โดนหักสองรอบ)", () => {
    expect(() => assertVoidableInvoice({ ...voidable, isVoided: true })).toThrow(
      /ถูกยกเลิกไปแล้ว/
    );
  });

  it("ใบอยู่บนใบวางบิลที่ใช้งานอยู่ → ปฏิเสธ พร้อมบอกเลขใบวางบิล", () => {
    expect(() =>
      assertVoidableInvoice({
        ...voidable,
        billingNoteItems: [{ billingNote: { billingNoteNumber: "BN-2026-0001" } }],
      })
    ).toThrow(/BN-2026-0001/);
  });

  it("มีใบลดหนี้/เพิ่มหนี้อ้างอยู่ → ปฏิเสธ พร้อมบอกเลขใบลูก (ม.86/10)", () => {
    expect(() =>
      assertVoidableInvoice({
        ...voidable,
        adjustments: [{ invoiceNumber: "CN-2026-0001" }, { invoiceNumber: "DN-2026-0002" }],
      })
    ).toThrow(/CN-2026-0001, DN-2026-0002/);
  });
});

describe("assertDebitNoteVoidKeepsFloor", () => {
  const rec = (totalAmount: number) => ({
    type: "RECEIPT",
    totalAmount,
    isVoided: false,
    originalInvoiceType: null,
  });

  it("void DN แล้วกองใบเสร็จที่เหลือเกินยอดออเดอร์ → ปฏิเสธ", () => {
    // ออเดอร์ 1000 · เคยมี DN ขยายเพดานให้ REC 1200 — ตัด DN ออกแล้ว floor 1200 > 1000
    expect(() =>
      assertDebitNoteVoidKeepsFloor({ orderTotal: 1000, remainingInvoices: [rec(1200)] })
    ).toThrow(/เกินยอดออเดอร์/);
  });

  it("ใบเสร็จที่เหลือไม่เกินยอดออเดอร์ → ผ่าน", () => {
    expect(() =>
      assertDebitNoteVoidKeepsFloor({ orderTotal: 1000, remainingInvoices: [rec(1000)] })
    ).not.toThrow();
  });
});

describe("statusAfterCreditNoteVoid", () => {
  const original = (over: Record<string, unknown> = {}) => ({
    isVoided: false,
    type: "FINAL_INVOICE",
    paymentStatus: "PAID",
    totalAmount: 1000,
    payments: [] as { amount: number; whtAmount: number }[],
    adjustments: [] as { type: string; totalAmount: number; isVoided: boolean }[],
    ...over,
  });

  it("ใบเดิม void แล้ว / เป็นใบเสร็จ → ไม่แตะ (null)", () => {
    expect(statusAfterCreditNoteVoid(original({ isVoided: true }))).toBeNull();
    expect(statusAfterCreditNoteVoid(original({ type: "RECEIPT" }))).toBeNull();
  });

  it("PAID ที่เคลียร์ด้วยเงิน+CN → void CN แล้วถอยเป็น PARTIALLY_PAID", () => {
    expect(
      statusAfterCreditNoteVoid(original({ payments: [{ amount: 500, whtAmount: 0 }] }))
    ).toBe("PARTIALLY_PAID");
  });

  it("PAID ที่เคลียร์ด้วย CN ล้วน → void แล้วถอยเป็น UNPAID", () => {
    expect(statusAfterCreditNoteVoid(original())).toBe("UNPAID");
  });

  it("จ่ายด้วยเงินสดครบอยู่แล้ว → สถานะไม่เปลี่ยน (null)", () => {
    expect(
      statusAfterCreditNoteVoid(original({ payments: [{ amount: 1000, whtAmount: 0 }] }))
    ).toBeNull();
  });

  it("CN ตัวอื่นที่ยังไม่ void ยังนับเคลียร์อยู่", () => {
    expect(
      statusAfterCreditNoteVoid(
        original({
          payments: [{ amount: 500, whtAmount: 0 }],
          adjustments: [{ type: "CREDIT_NOTE", totalAmount: 500, isVoided: false }],
        })
      )
    ).toBeNull(); // 500 เงิน + 500 CN คงเหลือ = ยังครบ → PAID เท่าเดิม
  });

  it("ใบเดิมค้าง OVERDUE อยู่ → คงไว้ ไม่ถอยเป็น PARTIALLY_PAID (sweep ไม่ต้อง re-mark)", () => {
    expect(
      statusAfterCreditNoteVoid(
        original({ paymentStatus: "OVERDUE", payments: [{ amount: 300, whtAmount: 0 }] })
      )
    ).toBeNull();
  });

  it("OVERDUE แต่ยอดจริงครบ (เงินสดเต็มใบ) → เลื่อนเป็น PAID ได้", () => {
    expect(
      statusAfterCreditNoteVoid(
        original({ paymentStatus: "OVERDUE", payments: [{ amount: 1000, whtAmount: 0 }] })
      )
    ).toBe("PAID");
  });
});
