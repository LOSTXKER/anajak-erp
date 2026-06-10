import { describe, it, expect } from "vitest";
import {
  outstandingOf,
  agingBucketOf,
  buildAgingReport,
  computeCreditExposure,
  type AgingInvoiceInput,
} from "./receivables";

// now ตรึงไว้: 2026-06-10 ตอน 10 โมงเช้าไทย (03:00Z)
const NOW = new Date("2026-06-10T03:00:00Z");
const day = (s: string) => new Date(`${s}T00:00:00Z`);

const cust = { id: "c1", name: "ลูกค้า A", company: null };
const inv = (over: Partial<AgingInvoiceInput>): AgingInvoiceInput => ({
  type: "FINAL_INVOICE",
  totalAmount: 1000,
  isVoided: false,
  payments: [],
  dueDate: null,
  customer: cust,
  ...over,
});

describe("outstandingOf", () => {
  it("ยอดบิล − เงินรับสุทธิ (refund ติดลบหักกลับ)", () => {
    expect(
      outstandingOf(inv({ payments: [{ amount: 300 }, { amount: -100 }] })).toNumber()
    ).toBe(800);
  });

  it("จ่ายครบ/จ่ายเกิน → 0 ไม่ติดลบ", () => {
    expect(outstandingOf(inv({ payments: [{ amount: 1000 }] })).toNumber()).toBe(0);
    expect(outstandingOf(inv({ payments: [{ amount: 1200 }] })).toNumber()).toBe(0);
  });
});

describe("agingBucketOf — นิยามเดียวกับ overdue (พ้นสิ้นวันไทย)", () => {
  it("ไม่มี dueDate / ครบกำหนดวันนี้ / อนาคต → ยังไม่ครบกำหนด", () => {
    expect(agingBucketOf(null, NOW)).toBe("current");
    expect(agingBucketOf(day("2026-06-10"), NOW)).toBe("current");
    expect(agingBucketOf(day("2026-07-01"), NOW)).toBe("current");
  });

  it("ขอบถังตรงเป๊ะ: 1/30/31/60/61/90/91 วัน", () => {
    expect(agingBucketOf(day("2026-06-09"), NOW)).toBe("d1_30"); // 1 วัน
    expect(agingBucketOf(day("2026-05-11"), NOW)).toBe("d1_30"); // 30 วัน
    expect(agingBucketOf(day("2026-05-10"), NOW)).toBe("d31_60"); // 31 วัน
    expect(agingBucketOf(day("2026-04-11"), NOW)).toBe("d31_60"); // 60 วัน
    expect(agingBucketOf(day("2026-03-12"), NOW)).toBe("d61_90"); // 90 วัน
    expect(agingBucketOf(day("2026-03-11"), NOW)).toBe("d90plus"); // 91 วัน
  });

  it("ข้ามเที่ยงคืนไทยบน host UTC: 17:30Z = วันใหม่ไทย → ถังขยับ", () => {
    const lateNight = new Date("2026-06-10T17:30:00Z"); // 00:30 ไทยของ 11 มิ.ย.
    expect(agingBucketOf(day("2026-06-10"), lateNight)).toBe("d1_30");
  });
});

describe("buildAgingReport", () => {
  const custB = { id: "c2", name: "ลูกค้า B", company: "บจก. บี" };

  it("รวมต่อลูกค้า แยกถัง เรียงยอดมาก→น้อย + ตัดใบที่ไม่ใช่ลูกหนี้", () => {
    const report = buildAgingReport(
      [
        inv({ totalAmount: 500, dueDate: day("2026-06-09") }), // A: เลย 1 วัน
        inv({ totalAmount: 300, payments: [{ amount: 100 }] }), // A: current 200
        inv({ totalAmount: 9999, isVoided: true }), // voided ไม่นับ
        inv({ type: "RECEIPT", totalAmount: 800 }), // ใบเสร็จไม่ใช่ลูกหนี้
        inv({ type: "CREDIT_NOTE", totalAmount: 400 }), // ลดหนี้ไม่ใช่ลูกหนี้
        inv({ type: "DEBIT_NOTE", totalAmount: 250, customer: custB, dueDate: day("2026-04-01") }), // B: เลย 70 วัน
        inv({ totalAmount: 100, payments: [{ amount: 100 }] }), // จ่ายครบ ไม่นับ
      ],
      NOW
    );

    expect(report.rows).toHaveLength(2);
    expect(report.rows[0].customerId).toBe("c1"); // 700 > 250
    expect(report.rows[0].buckets.d1_30).toBe(500);
    expect(report.rows[0].buckets.current).toBe(200);
    expect(report.rows[0].total).toBe(700);
    expect(report.rows[1].buckets.d61_90).toBe(250);
    expect(report.totals.d1_30).toBe(500);
    expect(report.grandTotal).toBe(950);
  });
});

describe("computeCreditExposure", () => {
  it("ใบค้างชำระ + งานผูกพันที่ยังไม่วางบิล — ไม่นับซ้ำ", () => {
    const result = computeCreditExposure({
      orders: [
        { id: "o1", totalAmount: 10000 }, // วางบิลแล้ว 6000 → unbilled 4000
        { id: "o2", totalAmount: 3000 }, // ยังไม่วางบิลเลย → unbilled 3000
      ],
      invoices: [
        {
          orderId: "o1",
          type: "DEPOSIT_INVOICE",
          totalAmount: 6000,
          isVoided: false,
          payments: [{ amount: 2000 }], // ค้าง 4000
        },
        {
          orderId: "o1",
          type: "RECEIPT",
          totalAmount: 2000,
          isVoided: false,
          payments: [], // ใบเสร็จไม่ใช่ลูกหนี้ และไม่นับเป็นยอดวางบิล
        },
      ],
    });
    expect(result.invoiceOutstanding).toBe(4000);
    expect(result.unbilled).toBe(7000);
    expect(result.exposure).toBe(11000);
  });

  it("ใบเพิ่มหนี้ค้าง = ลูกหนี้ แต่ไม่ลด unbilled ของออเดอร์", () => {
    const result = computeCreditExposure({
      orders: [{ id: "o1", totalAmount: 1000 }],
      invoices: [
        { orderId: "o1", type: "DEBIT_NOTE", totalAmount: 200, isVoided: false, payments: [] },
      ],
    });
    expect(result.invoiceOutstanding).toBe(200);
    expect(result.unbilled).toBe(1000);
    expect(result.exposure).toBe(1200);
  });

  it("งานขายสด (ใบเสร็จล้วน ไม่มีใบแจ้งหนี้) → ไม่ค้างเป็น unbilled กินวงเงิน", () => {
    const result = computeCreditExposure({
      orders: [{ id: "o1", totalAmount: 1000 }],
      invoices: [
        { orderId: "o1", type: "RECEIPT", totalAmount: 1000, isVoided: false, payments: [] },
      ],
    });
    expect(result.exposure).toBe(0);
  });

  it("flow มัดจำออกทั้งใบแจ้งหนี้+ใบเสร็จต่อเงินก้อนเดียว → ใช้ max ไม่หักซ้ำ", () => {
    const result = computeCreditExposure({
      orders: [{ id: "o1", totalAmount: 1000 }],
      invoices: [
        {
          orderId: "o1",
          type: "DEPOSIT_INVOICE",
          totalAmount: 500,
          isVoided: false,
          payments: [{ amount: 500 }],
        },
        { orderId: "o1", type: "RECEIPT", totalAmount: 500, isVoided: false, payments: [] },
      ],
    });
    // มัดจำจ่ายครบ เหลือครึ่งหลังยังไม่วางบิล = exposure 500 (ไม่ใช่ 0 และไม่ใช่ 1000)
    expect(result.invoiceOutstanding).toBe(0);
    expect(result.unbilled).toBe(500);
    expect(result.exposure).toBe(500);
  });

  it("วางบิลเกินยอดออเดอร์ (มี DN) → unbilled ไม่ติดลบ", () => {
    const result = computeCreditExposure({
      orders: [{ id: "o1", totalAmount: 1000 }],
      invoices: [
        {
          orderId: "o1",
          type: "FINAL_INVOICE",
          totalAmount: 1000,
          isVoided: false,
          payments: [{ amount: 1000 }],
        },
      ],
    });
    expect(result.exposure).toBe(0);
  });
});
