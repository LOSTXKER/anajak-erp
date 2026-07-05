import { Prisma } from "@prisma/client";
import { D, round2 } from "./money";
import { settledOf, paymentStatusForSettled } from "./receivables";
import { billedFloor, type InvoiceForPlan } from "./payment-plan";
import { badRequest } from "@/server/errors";

// กติกาบันทึกรับเงิน + ยกเลิกบิล (pure calc — แยกจาก tx writes ใน routers/billing.ts
// เพื่อ unit test ได้ไม่ต้อง DB) · caller ต้องโหลดใบภายใต้ lockInvoiceRow ใน $transaction
// แล้วค่อยเรียก — ฟังก์ชันชุดนี้ตัดสิน/คำนวณจากข้อมูลที่โหลดแล้วเท่านั้น

// ---------- recordPayment ----------

export interface SettlementInvoice {
  type: string;
  isVoided: boolean;
  totalAmount: number;
  tax: number;
  payments: { amount: number; whtAmount: number }[];
  adjustments?: { type: string; totalAmount: number; isVoided: boolean }[];
}

export interface PaymentSettlementPlan {
  // ยอดเคลียร์รอบนี้ = เงินสด + WHT (ยอดที่ increment totalSpent ลูกค้า)
  settled: Prisma.Decimal;
  paymentStatus: "PAID" | "PARTIALLY_PAID" | "UNPAID";
  // แถวทะเบียน 50ทวิ — null เมื่อไม่มี WHT
  whtCert: { baseAmount: number; ratePct: number; amount: number } | null;
}

// ตรวจ + คำนวณผลบันทึกรับเงินหนึ่งรายการ — throw BAD_REQUEST เมื่อผิดกติกา
// openReceivableCount = ใบเรียกเก็บ (ไม่ void) บนออเดอร์เดียวกัน — ใช้เฉพาะกติกา
// ใบเสร็จปลายทาง (caller นับเมื่อ type = RECEIPT · ชนิดอื่นส่ง 0 ได้)
export function planPaymentSettlement(params: {
  invoice: SettlementInvoice;
  amount: Prisma.Decimal; // เงินสด (moneyInput แล้ว)
  whtAmount: Prisma.Decimal; // ภาษีหัก ณ ที่จ่าย (moneyInput แล้ว)
  openReceivableCount: number;
}): PaymentSettlementPlan {
  const { invoice, amount, whtAmount: wht } = params;

  if (invoice.isVoided) {
    badRequest("ไม่สามารถบันทึกการชำระเงินสำหรับใบแจ้งหนี้ที่ถูกยกเลิกแล้ว");
  }

  // Gate A1 (audit 2026-07-02): เงินก้อนเดียวห้ามลงซ้ำสองใบ (เดิมลงได้ทั้ง INV+REC
  // → totalSpent/รับชำระเดือนนับ ×2) — แต่ "ขายสดออกใบเสร็จตรง" (ไม่มีใบเรียกเก็บ)
  // เป็น flow ที่ระบบรองรับ ต้องบันทึกเงินบนใบเสร็จได้ ไม่งั้นเงินสดหายจากระบบ
  if (invoice.type === "CREDIT_NOTE") {
    badRequest("ใบลดหนี้เป็นเงินฝั่งคืนลูกค้า — บันทึกรับเงินบนใบลดหนี้ไม่ได้");
  }
  if (invoice.type === "RECEIPT" && params.openReceivableCount > 0) {
    badRequest(
      "ออเดอร์นี้มีใบแจ้งหนี้/ใบเพิ่มหนี้อยู่ — บันทึกรับเงินที่ใบนั้นแทน (ใบเสร็จเป็นเอกสารปลายทาง กันยอดนับซ้ำ)"
    );
  }

  // ยอดที่เคลียร์บิลแล้ว = เงินสด + ภาษีที่ถูกหัก + ใบลดหนี้ที่อ้างใบนี้
  // (กันบิลค้างผี 3% โดน sweep ปลอม + กันรับเงินเกินส่วนที่ลดหนี้ไปแล้ว — Gate B1)
  const previouslySettled = settledOf(invoice);
  const total = D(invoice.totalAmount);
  const remaining = total.minus(previouslySettled);
  const settled = amount.plus(wht);

  if (settled.gt(remaining)) {
    badRequest(`จำนวนเงิน+ภาษีหัก ณ ที่จ่ายเกินยอดคงเหลือ (เหลือ ${remaining.toFixed(2)} บาท)`);
  }

  return {
    settled,
    paymentStatus: paymentStatusForSettled(previouslySettled.plus(settled), total),
    whtCert: wht.gt(0) ? whtCertPlan({ total, tax: invoice.tax, wht }) : null,
  };
}

// ทะเบียน 50ทวิ — ฐานโดยนัยจากอัตรามาตรฐาน 3% (จ้างทำของ): base = ยอดหัก ÷ 3%
// ตรงหนังสือรับรองจริงทั้งเคสจ่ายครั้งเดียว/หลายงวด/บันทึก WHT ตามหลัง (97 ก่อน 3 ทีหลัง)
// — ใบฐาน 100 หัก 3: ได้ฐาน 100 เสมอ ไม่ขึ้นกับว่าบันทึกกี่ครั้ง · cap ที่ฐานใบ
// (ลูกค้าหักอัตราอื่น ฐานจะถูก cap แล้ว ratePct สะท้อนอัตราจริง)
function whtCertPlan(params: {
  total: Prisma.Decimal;
  tax: number;
  wht: Prisma.Decimal;
}): { baseAmount: number; ratePct: number; amount: number } {
  const fullBase = params.total.minus(params.tax);
  const impliedBase = round2(params.wht.times(100).div(3));
  const base = impliedBase.gt(fullBase) && fullBase.gt(0) ? fullBase : impliedBase;
  return {
    baseAmount: base.toNumber(),
    ratePct: base.gt(0) ? round2(params.wht.div(base).times(100)).toNumber() : 3,
    amount: params.wht.toNumber(),
  };
}

// ---------- voidInvoice ----------

// ด่านก่อน void — ลำดับใบต้องถูก: ใบบนใบวางบิล/ใบที่มีใบลูกอ้างอยู่ ต้องยกเลิกใบเหล่านั้นก่อน
export function assertVoidableInvoice(invoice: {
  isVoided: boolean;
  // เฉพาะที่ยังใช้งานอยู่ (caller กรอง isVoided: false มาแล้ว)
  billingNoteItems: { billingNote: { billingNoteNumber: string } }[];
  adjustments: { invoiceNumber: string }[];
}): void {
  // กัน void ซ้ำ — เดิมกดซ้ำได้ ทำให้ totalSpent ของลูกค้าโดนหักสองรอบ
  if (invoice.isVoided) {
    badRequest("ใบแจ้งหนี้นี้ถูกยกเลิกไปแล้ว");
  }
  // ใบที่อยู่บนใบวางบิลที่ใช้งานอยู่ — ยอดบนใบวางบิลจะค้างผี ต้องยกเลิกใบวางบิลก่อน
  if (invoice.billingNoteItems.length > 0) {
    badRequest(
      `ใบนี้อยู่บนใบวางบิล ${invoice.billingNoteItems[0].billingNote.billingNoteNumber} — ยกเลิกใบวางบิลก่อน`
    );
  }
  // ใบที่มีใบลดหนี้/เพิ่มหนี้อ้างอยู่ — void แล้วใบอ้างอิงจะชี้เอกสารตาย (ม.86/10
  // ใบลดหนี้ต้องอ้างใบกำกับที่ใช้งานจริง) ต้องยกเลิกใบลูกก่อนตามลำดับ
  if (invoice.adjustments.length > 0) {
    badRequest(
      `มีใบลดหนี้/เพิ่มหนี้อ้างอิงใบนี้อยู่ (${invoice.adjustments.map((a) => a.invoiceNumber).join(", ")}) — ยกเลิกใบเหล่านั้นก่อน`
    );
  }
}

// เพดานขาที่สอง (B9) ตอน void ใบเพิ่มหนี้: DN ขยายเพดานกองใบเสร็จอยู่ — void แล้ว
// ใบเสร็จที่ออกไปแล้วอาจเกินยอดออเดอร์ ต้องยกเลิกใบเสร็จก่อนตามลำดับ
// (void ใบชนิดอื่นมีแต่ทำ floor ลด — ไม่ต้องเช็ค) · caller ล็อกแถวออเดอร์ก่อนโหลด
// remainingInvoices = ใบไม่ void ที่เหลือ "หลังตัดใบที่กำลังจะ void ออก"
export function assertDebitNoteVoidKeepsFloor(params: {
  orderTotal: number;
  remainingInvoices: InvoiceForPlan[];
}): void {
  const floorAfterVoid = billedFloor(params.remainingInvoices);
  if (floorAfterVoid.gt(params.orderTotal)) {
    badRequest(
      `ยกเลิกใบเพิ่มหนี้นี้แล้ว ยอดบิลที่เหลือ (${floorAfterVoid.toFixed(2)} บาท) จะเกินยอดออเดอร์ (${D(params.orderTotal).toFixed(2)} บาท) — ยกเลิกใบเสร็จที่พึ่งใบเพิ่มหนี้นี้ก่อน`
    );
  }
}

// void ใบลดหนี้ = ยอดที่เคยหักให้ใบเดิมหายไป — คำนวณสถานะใบเดิมใหม่จากของจริง
// (PAID ที่เคลียร์ด้วย CN อาจถอยกลับ PARTIALLY_PAID/UNPAID · sweep รอบถัดไป mark
// OVERDUE เองถ้าเลยกำหนด) · original ต้องโหลด "หลัง" CN ถูก mark void แล้ว —
// adjustments ที่ส่งมาจะกรองใบที่เพิ่ง void ออกเอง (isVoided = true แล้ว)
// คืน null = ไม่ต้องอัปเดต (ใบเดิม void แล้ว/เป็นใบเสร็จ/สถานะไม่เปลี่ยน)
export function statusAfterCreditNoteVoid(original: {
  isVoided: boolean;
  type: string;
  paymentStatus: string;
  totalAmount: number;
  payments: { amount: number; whtAmount: number }[];
  adjustments?: { type: string; totalAmount: number; isVoided: boolean }[];
}): "PAID" | "PARTIALLY_PAID" | "UNPAID" | "OVERDUE" | null {
  if (original.isVoided || original.type === "RECEIPT") return null;
  let next: "PAID" | "PARTIALLY_PAID" | "UNPAID" | "OVERDUE" = paymentStatusForSettled(
    settledOf(original),
    D(original.totalAmount)
  );
  // ใบเดิมค้าง OVERDUE อยู่ก่อนแล้ว → คงไว้ (sweep ไม่ต้อง re-mark/แจ้งซ้ำ)
  if (next !== "PAID" && original.paymentStatus === "OVERDUE") {
    next = "OVERDUE";
  }
  return next === original.paymentStatus ? null : next;
}
