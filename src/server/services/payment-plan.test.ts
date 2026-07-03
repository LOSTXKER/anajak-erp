import { describe, it, expect } from "vitest";
import {
  billedTotal,
  remainingBillable,
  billedFloor,
  splitVatFromGross,
  thaiDateUtcMidnight,
  dueDateFromTerms,
  suggestInvoice,
  type InvoiceForPlan,
} from "./payment-plan";
import { D } from "./money";

const inv = (type: string, totalAmount: number, isVoided = false): InvoiceForPlan => ({
  type,
  totalAmount,
  isVoided,
});

describe("splitVatFromGross", () => {
  it("แตกยอดรวม VAT 7% เป็นฐาน+VAT ที่บวกกลับได้เป๊ะ", () => {
    const { base, vat } = splitVatFromGross(D(1605), 7);
    expect(base.toNumber()).toBe(1500);
    expect(vat.toNumber()).toBe(105);
  });

  it("เคสปัดเศษ: ฐานปัด half-up แล้ว VAT = ส่วนต่าง (ผลรวมต้องตรงยอดเดิมเสมอ)", () => {
    const { base, vat } = splitVatFromGross(D(100), 7);
    expect(base.toNumber()).toBe(93.46); // 100/1.07 = 93.4579...
    expect(vat.toNumber()).toBe(6.54);
    expect(base.plus(vat).toNumber()).toBe(100);
  });

  it("taxRate 0 → ฐาน = ยอดเต็ม ไม่มี VAT", () => {
    const { base, vat } = splitVatFromGross(D(999.99), 0);
    expect(base.toNumber()).toBe(999.99);
    expect(vat.toNumber()).toBe(0);
  });
});

describe("billedTotal / remainingBillable", () => {
  const invoices = [
    inv("DEPOSIT_INVOICE", 500),
    inv("FINAL_INVOICE", 300),
    inv("FINAL_INVOICE", 1000, true), // voided — ไม่นับ
    inv("RECEIPT", 500),
    inv("CREDIT_NOTE", 100),
  ];

  it("ใบแจ้งหนี้นับรวมกองเดียว (มัดจำ+ส่วนที่เหลือ) ข้ามใบ voided", () => {
    expect(billedTotal(invoices, ["DEPOSIT_INVOICE", "FINAL_INVOICE"]).toNumber()).toBe(800);
  });

  it("คงเหลือกองใบแจ้งหนี้ = ยอดออเดอร์ - ที่วางแล้ว", () => {
    expect(remainingBillable(1000, invoices, "FINAL_INVOICE")!.toNumber()).toBe(200);
    expect(remainingBillable(1000, invoices, "DEPOSIT_INVOICE")!.toNumber()).toBe(200);
  });

  it("กองใบเสร็จนับแยกจากใบแจ้งหนี้ + ขยายตามใบเพิ่มหนี้ หดตามใบลดหนี้", () => {
    // เพดานใบเสร็จ = 1000 + 0(DN) - 100(CN ไม่ผูกใบ = หักแบบอนุรักษ์นิยม) = 900 · ออกแล้ว 500 → เหลือ 400
    expect(remainingBillable(1000, invoices, "RECEIPT")!.toNumber()).toBe(400);
    // มี DN 200 → เพดาน = 1000 + 200 - 100 = 1100 → เหลือ 600
    expect(
      remainingBillable(1000, [...invoices, inv("DEBIT_NOTE", 200)], "RECEIPT")!.toNumber()
    ).toBe(600);
  });

  it("CN แยกตาม linkage (Gate B1): อ้างใบเสร็จ = คืนเงินหลังรับ ไม่หักเพดานใบเสร็จงวดถัดไป", () => {
    const cnLinked = (origType: string, amt: number): InvoiceForPlan => ({
      type: "CREDIT_NOTE",
      totalAmount: amt,
      isVoided: false,
      originalInvoiceType: origType,
    });
    // เคสจริง: ออเดอร์ 1000 · REC งวดแรก 500 · CN 300 อ้าง INV-D (ลดมูลค่างานก่อนเก็บ)
    // → เพดาน REC = 700 · ออกแล้ว 500 → งวดถัดไปออกได้ 200
    expect(
      remainingBillable(
        1000,
        [inv("RECEIPT", 500), cnLinked("DEPOSIT_INVOICE", 300)],
        "RECEIPT"
      )!.toNumber()
    ).toBe(200);
    // CN 300 อ้าง REC (คืนเงินหลังรับ — มีเอกสารฝั่งลบแล้ว) → เพดานคง 1000 · เหลือ 500
    // (ไม่งั้นใบกำกับของงวดรับเงินถัดไปที่กฎหมายบังคับออก จะโดน block)
    expect(
      remainingBillable(
        1000,
        [inv("RECEIPT", 500), cnLinked("RECEIPT", 300)],
        "RECEIPT"
      )!.toNumber()
    ).toBe(500);
  });

  it("ใบเพิ่มหนี้ไม่ขยายเพดานกองใบแจ้งหนี้ (ส่วนเพิ่มเรียกเก็บผ่าน DEBIT_NOTE เอง)", () => {
    expect(
      remainingBillable(1000, [...invoices, inv("DEBIT_NOTE", 200)], "FINAL_INVOICE")!.toNumber()
    ).toBe(200);
  });

  it("วางเกินแล้ว → คงเหลือ 0 ไม่ติดลบ", () => {
    expect(remainingBillable(700, invoices, "FINAL_INVOICE")!.toNumber()).toBe(0);
  });

  it("ใบลดหนี้/เพิ่มหนี้ไม่มีเพดาน", () => {
    expect(remainingBillable(1000, invoices, "CREDIT_NOTE")).toBeNull();
    expect(remainingBillable(1000, invoices, "DEBIT_NOTE")).toBeNull();
  });
});

// เพดานขาที่สอง (Gate B9) — ยอดออเดอร์ต่ำสุดที่ยังคุ้มบิลที่ออกแล้ว
// invariant คู่ remainingBillable: ยอดออเดอร์ = billedFloor พอดี → ทุกกองต้องวางเพิ่มได้ ≥ 0
describe("billedFloor", () => {
  const cnLinked = (origType: string | null, amt: number): InvoiceForPlan => ({
    type: "CREDIT_NOTE",
    totalAmount: amt,
    isVoided: false,
    originalInvoiceType: origType,
  });

  it("ไม่มีบิล → 0 (ลดยอดได้อิสระ)", () => {
    expect(billedFloor([]).toNumber()).toBe(0);
  });

  it("กองใบแจ้งหนี้: floor = Σ(มัดจำ+ส่วนที่เหลือ) ข้ามใบ voided", () => {
    expect(
      billedFloor([
        inv("DEPOSIT_INVOICE", 500),
        inv("FINAL_INVOICE", 300),
        inv("FINAL_INVOICE", 1000, true), // voided — ไม่นับ
      ]).toNumber()
    ).toBe(800);
  });

  it("กองใบเสร็จ: floor = Σ(REC) − Σ(DN) + CN ที่ไม่อ้างใบเสร็จ", () => {
    // REC 500 · DN 200 (งานเพิ่มที่เรียกเก็บแยก ไม่ต้องพึ่งยอดออเดอร์) → floor 300
    expect(
      billedFloor([inv("RECEIPT", 500), inv("DEBIT_NOTE", 200)]).toNumber()
    ).toBe(300);
    // CN 100 อ้างใบเรียกเก็บ (ลดมูลค่างานก่อนเก็บ — เพดาน REC หด) → floor ดันกลับขึ้น 400
    expect(
      billedFloor([
        inv("RECEIPT", 500),
        inv("DEBIT_NOTE", 200),
        cnLinked("DEPOSIT_INVOICE", 100),
      ]).toNumber()
    ).toBe(400);
  });

  it("CN อ้างใบเสร็จ (คืนเงินหลังรับ) ไม่ดัน floor — คู่ขนานกับที่ไม่หักเพดานใน remainingBillable", () => {
    expect(
      billedFloor([inv("RECEIPT", 500), cnLinked("RECEIPT", 300)]).toNumber()
    ).toBe(500);
  });

  it("CN legacy ไม่ผูกใบเดิม (originalInvoiceType null — ข้อมูลก่อน B1) → ดัน floor แบบอนุรักษ์นิยม", () => {
    expect(
      billedFloor([inv("RECEIPT", 500), cnLinked(null, 200)]).toNumber()
    ).toBe(700);
  });

  it("สองกองเอาค่าสูงสุด — flow มัดจำจริงมีทั้ง INV และ REC คู่กัน", () => {
    // INV-D 500 + INV-F 500 = 1000 · REC 500 (จ่ายมัดจำแล้ว) → floor = 1000 (กอง INV ชนะ)
    expect(
      billedFloor([
        inv("DEPOSIT_INVOICE", 500),
        inv("FINAL_INVOICE", 500),
        inv("RECEIPT", 500),
      ]).toNumber()
    ).toBe(1000);
  });

  it("DN เกินยอดใบเสร็จ → floor 0 ไม่ติดลบ", () => {
    expect(
      billedFloor([inv("RECEIPT", 100), inv("DEBIT_NOTE", 500)]).toNumber()
    ).toBe(0);
  });

  it("invariant คู่ขาแรก: ยอดออเดอร์ = floor พอดี → remainingBillable ทุกกองไม่ติดลบ", () => {
    const invoices = [
      inv("DEPOSIT_INVOICE", 500),
      inv("RECEIPT", 500),
      cnLinked("DEPOSIT_INVOICE", 100),
    ];
    const floor = billedFloor(invoices).toNumber();
    expect(remainingBillable(floor, invoices, "FINAL_INVOICE")!.gte(0)).toBe(true);
    expect(remainingBillable(floor, invoices, "RECEIPT")!.gte(0)).toBe(true);
  });
});

describe("thaiDateUtcMidnight / dueDateFromTerms", () => {
  it("คืน UTC midnight ของวันที่ตามปฏิทินไทย", () => {
    // 18:30Z = 01:30 ไทยของวันถัดไป
    expect(thaiDateUtcMidnight(new Date("2026-06-10T18:30:00Z")).toISOString()).toBe(
      "2026-06-11T00:00:00.000Z"
    );
    expect(thaiDateUtcMidnight(new Date("2026-06-10T16:00:00Z")).toISOString()).toBe(
      "2026-06-10T00:00:00.000Z"
    );
  });

  it("เครดิตเทอม → วันนี้(ไทย) + X วัน", () => {
    const due = dueDateFromTerms("NET_7", new Date("2026-06-10T03:00:00Z"));
    expect(due!.toISOString()).toBe("2026-06-17T00:00:00.000Z");
  });

  it("รอยต่อวันไทย: หลังเที่ยงคืนไทยต้องนับจากวันใหม่", () => {
    const due = dueDateFromTerms("NET_30", new Date("2026-06-10T18:30:00Z"));
    expect(due!.toISOString()).toBe("2026-07-11T00:00:00.000Z");
  });

  it("เทอมที่ไม่ใช่เครดิต / null / ค่าแปลกปลอม → ไม่ตั้งวันครบกำหนด", () => {
    expect(dueDateFromTerms("DEPOSIT_50")).toBeNull();
    expect(dueDateFromTerms("COD")).toBeNull();
    expect(dueDateFromTerms("FULL_PREPAY")).toBeNull();
    expect(dueDateFromTerms(null)).toBeNull();
    expect(dueDateFromTerms("NET_999")).toBeNull();
  });
});

describe("suggestInvoice", () => {
  const order50 = { paymentTerms: "DEPOSIT_50", totalAmount: 3210, taxRate: 7 };

  it("เทอมมัดจำ 50% ยังไม่มีใบมัดจำ → แนะนำใบมัดจำครึ่งหนึ่ง แตก VAT ถูก", () => {
    const s = suggestInvoice({ order: order50, invoices: [] });
    expect(s.type).toBe("DEPOSIT_INVOICE");
    expect(s.total).toBe(1605);
    expect(s.amount).toBe(1500);
    expect(s.tax).toBe(105);
    expect(s.remaining).toBe(3210);
    expect(s.dueDate).toBeNull(); // มัดจำไม่มีวันครบกำหนดอัตโนมัติ
  });

  it("มีใบมัดจำแล้ว → แนะนำใบแจ้งหนี้ส่วนที่เหลือ", () => {
    const s = suggestInvoice({ order: order50, invoices: [inv("DEPOSIT_INVOICE", 1605)] });
    expect(s.type).toBe("FINAL_INVOICE");
    expect(s.total).toBe(1605);
    expect(s.remaining).toBe(1605);
  });

  it("ใบมัดจำที่ voided ไม่นับ → ยังแนะนำใบมัดจำ", () => {
    const s = suggestInvoice({
      order: order50,
      invoices: [inv("DEPOSIT_INVOICE", 1605, true)],
    });
    expect(s.type).toBe("DEPOSIT_INVOICE");
    expect(s.total).toBe(1605);
  });

  it("มัดจำ 30% ไม่ใช่ 50% hardcode เดิม", () => {
    const s = suggestInvoice({
      order: { paymentTerms: "DEPOSIT_30", totalAmount: 1000, taxRate: 0 },
      invoices: [],
    });
    expect(s.type).toBe("DEPOSIT_INVOICE");
    expect(s.total).toBe(300);
  });

  it("% มัดจำเกินยอดคงเหลือ → ไม่ทะลุเพดาน", () => {
    const s = suggestInvoice({
      order: { paymentTerms: "DEPOSIT_50", totalAmount: 1000, taxRate: 0 },
      invoices: [inv("FINAL_INVOICE", 800)],
      type: "DEPOSIT_INVOICE",
    });
    expect(s.total).toBe(200);
  });

  it("เครดิตเทอม → ใบแจ้งหนี้เต็มยอด + วันครบกำหนดอัตโนมัติ", () => {
    const s = suggestInvoice({
      order: { paymentTerms: "NET_30", totalAmount: 5000, taxRate: 7 },
      invoices: [],
      now: new Date("2026-06-10T03:00:00Z"),
    });
    expect(s.type).toBe("FINAL_INVOICE");
    expect(s.total).toBe(5000);
    expect(s.dueDate).toBe("2026-07-10");
  });

  it("ไม่ระบุเทอม / ค่าแปลกปลอม → ใบแจ้งหนี้เต็มยอดคงเหลือ ไม่มีวันครบกำหนด", () => {
    for (const paymentTerms of [null, "WEIRD_VALUE"]) {
      const s = suggestInvoice({
        order: { paymentTerms, totalAmount: 1000, taxRate: 0 },
        invoices: [],
      });
      expect(s.type).toBe("FINAL_INVOICE");
      expect(s.total).toBe(1000);
      expect(s.dueDate).toBeNull();
    }
  });

  it("ใบเสร็จใช้กองของตัวเอง — ใบแจ้งหนี้ที่ออกแล้วไม่กินโควต้าใบเสร็จ", () => {
    const s = suggestInvoice({
      order: order50,
      invoices: [inv("DEPOSIT_INVOICE", 1605), inv("RECEIPT", 1605)],
      type: "RECEIPT",
    });
    expect(s.total).toBe(1605); // 3210 - 1605 ที่ออกใบเสร็จแล้ว
    expect(s.remaining).toBe(1605);
  });

  it("ใบลดหนี้ → ไม่แนะนำยอด ไม่มีเพดาน", () => {
    const s = suggestInvoice({ order: order50, invoices: [], type: "CREDIT_NOTE" });
    expect(s.total).toBe(0);
    expect(s.remaining).toBeNull();
  });

  it("ส่ง taxRate ของออเดอร์ + ยอดใบลดหนี้สุทธิกลับให้ UI", () => {
    const s = suggestInvoice({
      order: order50,
      invoices: [inv("CREDIT_NOTE", 200), inv("CREDIT_NOTE", 300, true)],
    });
    expect(s.taxRate).toBe(7);
    expect(s.creditNoteTotal).toBe(200); // ใบ voided ไม่นับ
  });
});
