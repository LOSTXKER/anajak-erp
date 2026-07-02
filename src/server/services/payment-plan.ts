import { Prisma } from "@prisma/client";
import type { InvoiceType } from "@prisma/client";
import { D, round2 } from "./money";
import { getPaymentTerms } from "@/lib/payment-terms";

// แผนการวางบิลจากเงื่อนไขชำระ (payment terms) ของออเดอร์ — แหล่งเดียวที่แปลง
// "เทอม" → ยอดบิลแนะนำ / ฐานภาษี+VAT / วันครบกำหนด / เพดานวางบิล
// ทั้ง suggest (UI prefill) และ guard ใน billing.create ใช้ logic ชุดนี้ร่วมกัน

// invoice ที่อ่านผ่าน result extension แล้ว (เงินเป็น number 2 ตำแหน่ง)
export interface InvoiceForPlan {
  type: string;
  totalAmount: number;
  isVoided: boolean;
  // ชนิดของใบเดิมที่ CN/DN อ้าง (Gate B1) — ใช้แยก CN สองความหมาย:
  // อ้างใบเรียกเก็บ/ไม่ผูกใบ = ลดมูลค่างานก่อนเก็บเงิน (หักเพดานใบเสร็จ) ·
  // อ้างใบเสร็จ = คืนเงินหลังรับ (มีเอกสารฝั่งลบแล้ว ไม่หักเพดานงวดถัดไป)
  originalInvoiceType?: string | null;
}

// กฎเพดาน: ใบแจ้งหนี้ (มัดจำ+ส่วนที่เหลือ) คือ "ยอดที่ขอเก็บ" — รวมกันห้ามเกินยอดออเดอร์
// ใบเสร็จคือ "ยอดที่รับแล้ว" นับแยกอีกกองด้วยเพดานเดียวกัน (flow มัดจำจริงมีทั้งสองกองคู่กัน:
// INV-D 50% → จ่าย → REC 50% → INV-F ที่เหลือ → จ่าย → REC ที่เหลือ — แต่ละกองรวม = ยอดออเดอร์)
// ใบลดหนี้/เพิ่มหนี้เป็นเอกสารแก้ไข ไม่เข้าเพดาน
const INVOICE_POOL: Partial<Record<InvoiceType, readonly string[]>> = {
  DEPOSIT_INVOICE: ["DEPOSIT_INVOICE", "FINAL_INVOICE"],
  FINAL_INVOICE: ["DEPOSIT_INVOICE", "FINAL_INVOICE"],
  RECEIPT: ["RECEIPT"],
};

export function billedTotal(
  invoices: InvoiceForPlan[],
  types: readonly string[]
): Prisma.Decimal {
  return invoices
    .filter((inv) => !inv.isVoided && types.includes(inv.type))
    .reduce((sum, inv) => sum.plus(inv.totalAmount), D(0));
}

// คงเหลือวางบิลได้ของชนิดนั้น (รวม VAT) — null = ชนิดที่ไม่มีเพดาน (ลดหนี้/เพิ่มหนี้)
// เพดานกองใบเสร็จ = ยอดออเดอร์ + ใบเพิ่มหนี้ − ใบลดหนี้ (เงินที่รับได้จริงทั้งหมด —
// ไม่งั้นเงินจากงานเพิ่มที่เรียกเก็บผ่าน DEBIT_NOTE จะออกใบเสร็จไม่ได้)
// กองใบแจ้งหนี้ D+F คงเพดานยอดออเดอร์: ส่วนเพิ่มเรียกเก็บผ่าน DEBIT_NOTE อยู่แล้ว
export function remainingBillable(
  orderTotal: number,
  invoices: InvoiceForPlan[],
  type: InvoiceType
): Prisma.Decimal | null {
  const pool = INVOICE_POOL[type];
  if (!pool) return null;
  // CN ที่หักเพดานใบเสร็จ = เฉพาะที่ลดมูลค่างานก่อนเก็บเงิน (อ้างใบเรียกเก็บ/ไม่ผูกใบ)
  // — CN อ้างใบเสร็จคือคืนเงินหลังรับ ถ้าหักด้วยจะ block ใบกำกับของงวดรับเงินถัดไป
  // ที่กฎหมายบังคับให้ออก (เคสมัดจำ+คืนเงินบางส่วนกลางทาง)
  const capReducingCredits = invoices
    .filter(
      (inv) =>
        !inv.isVoided &&
        inv.type === "CREDIT_NOTE" &&
        inv.originalInvoiceType !== "RECEIPT"
    )
    .reduce((sum, inv) => sum.plus(inv.totalAmount), D(0));
  const cap =
    type === "RECEIPT"
      ? D(orderTotal)
          .plus(billedTotal(invoices, ["DEBIT_NOTE"]))
          .minus(capReducingCredits)
      : D(orderTotal);
  const remaining = cap.minus(billedTotal(invoices, pool));
  return remaining.gt(0) ? remaining : D(0);
}

// แตกยอดรวม (รวม VAT แล้ว) เป็นฐานภาษี + VAT ตาม taxRate ของออเดอร์
// หน้า print ใช้ amount-discount เป็นฐานภาษีและ tax เป็น VAT ตรงๆ (ม.86/4)
// จึงต้องบันทึกแยกให้ถูกตั้งแต่เปิดบิล · ฐานปัด half-up แล้ว VAT = ส่วนต่าง (ผลรวมตรงเป๊ะเสมอ)
export function splitVatFromGross(
  gross: Prisma.Decimal,
  taxRate: number
): { base: Prisma.Decimal; vat: Prisma.Decimal } {
  const grossRounded = round2(gross);
  if (taxRate <= 0) return { base: grossRounded, vat: D(0) };
  const base = round2(grossRounded.times(100).div(D(100).plus(taxRate)));
  return { base, vat: grossRounded.minus(base) };
}

// วันที่ตามปฏิทินไทยของ instant นั้น เก็บเป็น UTC midnight — convention เดียวกับ
// dueDate ที่มาจาก <input type="date"> (new Date("YYYY-MM-DD"))
export function thaiDateUtcMidnight(date = new Date()): Date {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return new Date(`${day}T00:00:00Z`);
}

const DAY_MS = 24 * 60 * 60 * 1000;

// วันครบกำหนดจากเทอม — เฉพาะเครดิตเทอม (NET_X): วันนี้(ไทย) + X วัน
// มัดจำ/จ่ายล่วงหน้า/COD จ่ายผูกกับเหตุการณ์ (เริ่มงาน/รับของ) ไม่ใช่วันที่ → ไม่ตั้งให้
export function dueDateFromTerms(
  paymentTerms: string | null | undefined,
  now = new Date()
): Date | null {
  const terms = getPaymentTerms(paymentTerms);
  if (!terms || terms.kind !== "credit") return null;
  return new Date(thaiDateUtcMidnight(now).getTime() + terms.creditDays * DAY_MS);
}

export interface InvoiceSuggestion {
  type: InvoiceType; // ชนิดที่แนะนำ (เมื่อไม่ได้ระบุมา)
  amount: number; // ฐานภาษี (ก่อน VAT)
  tax: number; // VAT
  total: number; // ยอดรวมบิล = amount + tax
  dueDate: string | null; // "YYYY-MM-DD" สำหรับ <input type="date">
  remaining: number | null; // คงเหลือวางบิลได้ของกองนั้น (รวม VAT) · null = ไม่มีเพดาน
  taxRate: number; // อัตรา VAT ของออเดอร์ — UI ใช้คำนวณภาษีใหม่เมื่อผู้ใช้แก้ยอด
  // ใบลดหนี้ที่ "ยังไม่ผูกใบเดิม" (legacy/ผ่าน API เก่า) — ระบบหักให้ไม่ได้ UI ต้องเตือน
  // (CN ที่ผูกใบเดิมถูกหักจากยอดค้างอัตโนมัติแล้ว ไม่ต้องเตือน — Gate B1)
  creditNoteTotal: number;
}

// ยอดบิลแนะนำตามเทอมของออเดอร์ + บิลที่มีอยู่ — pure function (now ฉีดได้เพื่อ test)
export function suggestInvoice(params: {
  order: { paymentTerms: string | null; totalAmount: number; taxRate: number };
  invoices: InvoiceForPlan[];
  type?: InvoiceType;
  now?: Date;
}): InvoiceSuggestion {
  const { order, invoices, now } = params;
  const terms = getPaymentTerms(order.paymentTerms);

  const hasDeposit = invoices.some(
    (inv) => !inv.isVoided && inv.type === "DEPOSIT_INVOICE"
  );
  // เทอมมัดจำและยังไม่เคยออกใบมัดจำ → แนะนำใบมัดจำ · นอกนั้นใบแจ้งหนี้ปกติ
  const defaultType: InvoiceType =
    terms?.kind === "deposit" && !hasDeposit ? "DEPOSIT_INVOICE" : "FINAL_INVOICE";
  const type = params.type ?? defaultType;

  const remaining = remainingBillable(order.totalAmount, invoices, type);

  let gross = D(0);
  if (type === "DEPOSIT_INVOICE" && remaining) {
    // % มัดจำจากยอดออเดอร์เต็ม (เพดานคือยอดคงเหลือ) · เทอมไม่ใช่มัดจำ → เต็มยอดคงเหลือ
    const byPercent =
      terms?.kind === "deposit"
        ? round2(D(order.totalAmount).times(terms.depositPercent).div(100))
        : remaining;
    gross = byPercent.lt(remaining) ? byPercent : remaining;
  } else if ((type === "FINAL_INVOICE" || type === "RECEIPT") && remaining) {
    gross = remaining;
  }

  const { base, vat } = splitVatFromGross(gross, order.taxRate);
  const dueDate =
    type === "DEPOSIT_INVOICE" || type === "FINAL_INVOICE"
      ? dueDateFromTerms(order.paymentTerms, now)
      : null;

  return {
    type,
    amount: base.toNumber(),
    tax: vat.toNumber(),
    total: round2(base.plus(vat)).toNumber(),
    dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : null,
    remaining: remaining ? remaining.toNumber() : null,
    taxRate: order.taxRate,
    creditNoteTotal: invoices
      // == null ครอบทั้ง null (DB ไม่ผูกใบ) และ undefined (caller ไม่ได้โหลด field —
      // fallback อนุรักษ์นิยม: เตือนไว้ก่อน เหมือนพฤติกรรมเดิม)
      .filter(
        (inv) =>
          !inv.isVoided && inv.type === "CREDIT_NOTE" && inv.originalInvoiceType == null
      )
      .reduce((sum, inv) => sum.plus(inv.totalAmount), D(0))
      .toNumber(),
  };
}
