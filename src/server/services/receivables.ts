import { Prisma } from "@prisma/client";
import { D } from "./money";
import { thaiDateUtcMidnight } from "./payment-plan";
import { badRequest } from "@/server/errors";
import type { PrismaTx } from "@/lib/prisma";

// ลูกหนี้การค้า — แหล่งเดียวของนิยาม "ยอดค้าง" ทั้งระบบ:
// ใบวางบิล (ยอดคงเหลือต่อใบ) · รายงาน aging (ถังอายุหนี้) · วงเงินเครดิต (exposure)

// เอกสารที่นับเป็นลูกหนี้ = ใบขอเก็บเงิน: มัดจำ/ส่วนที่เหลือ/เพิ่มหนี้
// (ใบเสร็จ = เงินที่รับแล้ว · ใบลดหนี้ = เอกสารแก้ไข — ไม่ใช่ลูกหนี้)
export const RECEIVABLE_TYPES = ["DEPOSIT_INVOICE", "FINAL_INVOICE", "DEBIT_NOTE"] as const;

export interface ReceivableInvoice {
  type: string;
  totalAmount: number;
  isVoided: boolean;
  // whtAmount = ภาษีที่ลูกค้าหัก ณ ที่จ่าย — เคลียร์บิลเหมือนเงินสด (เครดิตภาษีของเรา)
  payments: { amount: number; whtAmount: number }[];
  // ใบลดหนี้ที่อ้างใบนี้ (relation `adjustments`) — เคลียร์ยอดค้างเหมือนเงินรับ (Gate B1:
  // เดิม CN ไม่ลดยอดค้าง → OVERDUE ปลอม/ทวงเกิน) · optional รับ caller เก่า แต่ loader
  // ทุกตัวในไฟล์นี้โหลดครบแล้ว — query ใหม่ที่จะใช้ outstandingOf ต้อง include ด้วยเสมอ
  adjustments?: { type: string; totalAmount: number; isVoided: boolean }[];
}

export function isReceivable(inv: Pick<ReceivableInvoice, "type" | "isVoided">): boolean {
  return !inv.isVoided && (RECEIVABLE_TYPES as readonly string[]).includes(inv.type);
}

// ยอดใบลดหนี้ (ไม่ void) ที่อ้างใบนี้ — ส่วนของหนี้ที่ "ยกให้" ไปแล้วตามกฎหมาย
export function creditedOf(inv: Pick<ReceivableInvoice, "adjustments">): Prisma.Decimal {
  return (inv.adjustments ?? [])
    .filter((a) => !a.isVoided && a.type === "CREDIT_NOTE")
    .reduce((sum, a) => sum.plus(a.totalAmount), D(0));
}

// เงินรับสุทธิบนใบ = Σ(เงินสด + ภาษีหัก ณ ที่จ่าย) — รายการคืนเงิน (payment ติดลบ) หักในตัว
export function paidOf(payments: { amount: number; whtAmount: number }[]): Prisma.Decimal {
  return payments.reduce((sum, p) => sum.plus(p.amount).plus(p.whtAmount), D(0));
}

// ยอดที่เคลียร์บิลแล้ว = เงินรับ + ภาษีหัก ณ ที่จ่าย + ใบลดหนี้ที่อ้างใบนี้
export function settledOf(inv: ReceivableInvoice): Prisma.Decimal {
  return paidOf(inv.payments).plus(creditedOf(inv));
}

// สถานะจ่ายจากยอดที่เคลียร์แล้ว — ใช้ชุดเดียวทั้ง recordPayment / ออก-void ใบลดหนี้
export function paymentStatusForSettled(
  settled: Prisma.Decimal,
  total: Prisma.Decimal
): "PAID" | "PARTIALLY_PAID" | "UNPAID" {
  if (settled.gte(total)) return "PAID";
  return settled.gt(0) ? "PARTIALLY_PAID" : "UNPAID";
}

// ยอดคงเหลือของใบ = ยอดบิล − (เงินรับสุทธิ + WHT + ใบลดหนี้) ไม่ติดลบ —
// ลูกค้าหัก 3%/ได้ใบลดหนี้แล้ว บิลต้องไม่ค้างผีใน aging/วงเงิน/ใบวางบิล
export function outstandingOf(inv: ReceivableInvoice): Prisma.Decimal {
  const remaining = D(inv.totalAmount).minus(settledOf(inv));
  return remaining.gt(0) ? remaining : D(0);
}

// ---------- aging ----------

export const AGING_BUCKETS = ["current", "d1_30", "d31_60", "d61_90", "d90plus"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "ยังไม่ครบกำหนด",
  d1_30: "เลย 1-30 วัน",
  d31_60: "เลย 31-60 วัน",
  d61_90: "เลย 61-90 วัน",
  d90plus: "เลยเกิน 90 วัน",
};

const DAY_MS = 24 * 60 * 60 * 1000;

// จำนวนวันที่เลยกำหนด — นิยามเดียวกับ overdue sweep (พ้นสิ้นวันไทยของ dueDate)
// คืน 0 เมื่อ: ไม่มี dueDate · ครบกำหนดวันนี้/ยังไม่ครบ (ไม่คืนค่าลบ)
export function daysOverdue(dueDate: Date | null, now = new Date()): number {
  if (!dueDate) return 0;
  const past = Math.floor(
    (thaiDateUtcMidnight(now).getTime() - dueDate.getTime()) / DAY_MS
  );
  return past > 0 ? past : 0;
}

// นิยามเดียวกับ overdue sweep: เลยกำหนดเมื่อพ้นสิ้นวันไทยของ dueDate
// ครบกำหนดวันนี้/ไม่มี dueDate = ยังไม่ครบกำหนด
export function agingBucketOf(dueDate: Date | null, now = new Date()): AgingBucket {
  const daysPast = daysOverdue(dueDate, now);
  if (daysPast <= 0) return "current";
  if (daysPast <= 30) return "d1_30";
  if (daysPast <= 60) return "d31_60";
  if (daysPast <= 90) return "d61_90";
  return "d90plus";
}

export interface AgingInvoiceInput extends ReceivableInvoice {
  dueDate: Date | null;
  customer: { id: string; name: string; company: string | null };
}

export interface AgingRow {
  customerId: string;
  name: string;
  company: string | null;
  buckets: Record<AgingBucket, number>;
  total: number;
}

const emptyBuckets = () =>
  Object.fromEntries(AGING_BUCKETS.map((b) => [b, D(0)])) as Record<AgingBucket, Prisma.Decimal>;

// รายงานลูกหนี้แยกถังอายุหนี้ต่อลูกค้า — เรียงยอดค้างมาก→น้อย
export function buildAgingReport(
  invoices: AgingInvoiceInput[],
  now = new Date()
): { rows: AgingRow[]; totals: Record<AgingBucket, number>; grandTotal: number } {
  const byCustomer = new Map<
    string,
    { name: string; company: string | null; buckets: Record<AgingBucket, Prisma.Decimal> }
  >();
  const totals = emptyBuckets();

  for (const inv of invoices) {
    if (!isReceivable(inv)) continue;
    const outstanding = outstandingOf(inv);
    if (outstanding.lte(0)) continue;

    const bucket = agingBucketOf(inv.dueDate, now);
    const row =
      byCustomer.get(inv.customer.id) ??
      { name: inv.customer.name, company: inv.customer.company, buckets: emptyBuckets() };
    row.buckets[bucket] = row.buckets[bucket].plus(outstanding);
    totals[bucket] = totals[bucket].plus(outstanding);
    byCustomer.set(inv.customer.id, row);
  }

  const rows: AgingRow[] = [...byCustomer.entries()]
    .map(([customerId, r]) => {
      const buckets = Object.fromEntries(
        AGING_BUCKETS.map((b) => [b, r.buckets[b].toNumber()])
      ) as Record<AgingBucket, number>;
      const total = AGING_BUCKETS.reduce((s, b) => s.plus(r.buckets[b]), D(0)).toNumber();
      return { customerId, name: r.name, company: r.company, buckets, total };
    })
    .sort((a, b) => b.total - a.total);

  return {
    rows,
    totals: Object.fromEntries(
      AGING_BUCKETS.map((b) => [b, totals[b].toNumber()])
    ) as Record<AgingBucket, number>,
    grandTotal: AGING_BUCKETS.reduce((s, b) => s.plus(totals[b]), D(0)).toNumber(),
  };
}

// ---------- วงเงินเครดิต ----------

// ภาระหนี้รวมของลูกค้า = ใบแจ้งหนี้ค้างชำระ + มูลค่างานผูกพันที่ยังไม่ได้วางบิล
// (ออเดอร์ CONFIRMED ขึ้นไปคือคำมั่นแล้ว — รอวางบิลตอนส่งมอบ ไม่นับ = วงเงินรั่ว)
export function computeCreditExposure(params: {
  orders: { id: string; totalAmount: number }[]; // ออเดอร์ผูกพัน (ไม่รวม DRAFT/INQUIRY/CANCELLED)
  invoices: (ReceivableInvoice & { orderId: string })[]; // ใบแจ้งหนี้ไม่ void ทั้งหมดของลูกค้า
}): { invoiceOutstanding: number; unbilled: number; exposure: number } {
  const receivables = params.invoices.filter(isReceivable);

  const invoiceOutstanding = receivables.reduce(
    (sum, inv) => sum.plus(outstandingOf(inv)),
    D(0)
  );

  // ยอดที่ "จัดการแล้ว" ต่อออเดอร์ = max(วางบิลแล้ว D+F, ออกใบเสร็จแล้ว) —
  // งานขายสดออกแต่ใบเสร็จไม่มีใบแจ้งหนี้ ถ้านับเฉพาะ D+F จะค้างเป็น unbilled กินวงเงินถาวร
  // (ใช้ max ไม่ใช่บวก เพราะ flow มัดจำออกทั้งคู่ต่อเงินก้อนเดียว — บวกจะหักซ้ำ)
  const billedByOrder = new Map<string, Prisma.Decimal>();
  const receiptedByOrder = new Map<string, Prisma.Decimal>();
  for (const inv of params.invoices) {
    if (inv.isVoided) continue;
    if (inv.type === "DEPOSIT_INVOICE" || inv.type === "FINAL_INVOICE") {
      billedByOrder.set(
        inv.orderId,
        (billedByOrder.get(inv.orderId) ?? D(0)).plus(inv.totalAmount)
      );
    } else if (inv.type === "RECEIPT") {
      receiptedByOrder.set(
        inv.orderId,
        (receiptedByOrder.get(inv.orderId) ?? D(0)).plus(inv.totalAmount)
      );
    }
  }
  const unbilled = params.orders.reduce((sum, order) => {
    const billed = billedByOrder.get(order.id) ?? D(0);
    const receipted = receiptedByOrder.get(order.id) ?? D(0);
    const handled = billed.gt(receipted) ? billed : receipted;
    const rest = D(order.totalAmount).minus(handled);
    return rest.gt(0) ? sum.plus(rest) : sum;
  }, D(0));

  return {
    invoiceOutstanding: invoiceOutstanding.toNumber(),
    unbilled: unbilled.toNumber(),
    exposure: invoiceOutstanding.plus(unbilled).toNumber(),
  };
}

// สถานะออเดอร์ที่ยังไม่ผูกพัน — ไม่นับเข้า exposure · ด่านวงเงินยิงเฉพาะตอนข้ามจาก
// สถานะกลุ่มนี้ไป CONFIRMED (ปลดพัก ON_HOLD ไม่ใช่ภาระหนี้ใหม่ — ยอดถูกนับใน exposure อยู่แล้ว)
export const UNCOMMITTED_STATUSES = ["DRAFT", "INQUIRY", "CANCELLED"] as const;

// ด่านวงเงินตอนผูกพันออเดอร์ — เฉพาะ SALES: เกินวงเงินต้องส่งให้ผู้จัดการ/บัญชีทำแทน
// (role อื่นเห็นคำเตือนใน UI แล้วตัดสินใจเองได้ · ลูกค้าไม่ตั้งวงเงิน = ไม่จำกัด)
export async function assertSalesWithinCreditLimit(
  db: PrismaTx,
  params: {
    userRole: string | null;
    customerId: string;
    additionalAmount: number;
    actionLabel: string; // เช่น "ยืนยันออเดอร์" / "แปลงเป็นออเดอร์"
  }
) {
  if (params.userRole !== "SALES") return;
  const customer = await db.customer.findUniqueOrThrow({
    where: { id: params.customerId },
    select: { creditLimit: true },
  });
  if (customer.creditLimit == null) return;
  const { exposure } = await creditExposureForCustomer(db, params.customerId);
  if (D(exposure).plus(params.additionalAmount).gt(customer.creditLimit)) {
    badRequest(
      `เกินวงเงินเครดิตของลูกค้า (ภาระหนี้ ${exposure.toFixed(2)} + ออเดอร์นี้ ${params.additionalAmount.toFixed(2)} > วงเงิน ${customer.creditLimit.toFixed(2)} บาท) — ให้ผู้จัดการ/บัญชีเป็นคน${params.actionLabel}`
    );
  }
}

export async function creditExposureForCustomer(db: PrismaTx, customerId: string) {
  const [orders, invoices] = await Promise.all([
    db.order.findMany({
      where: { customerId, internalStatus: { notIn: [...UNCOMMITTED_STATUSES] } },
      select: { id: true, totalAmount: true },
    }),
    db.invoice.findMany({
      where: { customerId, isVoided: false },
      select: {
        orderId: true,
        type: true,
        totalAmount: true,
        isVoided: true,
        payments: { select: { amount: true, whtAmount: true } },
        adjustments: { select: { type: true, totalAmount: true, isVoided: true } },
      },
    }),
  ]);
  return computeCreditExposure({ orders, invoices });
}

// ---------- loaders (query แหล่งเดียว — ใช้ร่วมระหว่าง router และ MCP กันนิยาม where drift) ----------

// ใบลูกหนี้ค้างทั้งระบบ (UNPAID/PARTIALLY_PAID/OVERDUE) พร้อมข้อมูลพอทำ aging
// ทั้ง billing-note.aging และ MCP tool ลูกหนี้เรียกตัวนี้ — where เดียวกันเสมอ
export async function loadAgingInvoices(
  db: Pick<PrismaTx, "invoice">
): Promise<AgingInvoiceInput[]> {
  return db.invoice.findMany({
    where: {
      isVoided: false,
      type: { in: [...RECEIVABLE_TYPES] },
      paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
    },
    select: {
      type: true,
      totalAmount: true,
      isVoided: true,
      dueDate: true,
      payments: { select: { amount: true, whtAmount: true } },
      adjustments: { select: { type: true, totalAmount: true, isVoided: true } },
      customer: { select: { id: true, name: true, company: true } },
    },
  });
}

export interface ReceivableInvoiceRow {
  invoiceNumber: string;
  orderNumber: string | null;
  type: string;
  dueDate: Date | null;
  outstanding: number; // หัก WHT แล้ว · > 0 เท่านั้น
}

// รายใบลูกหนี้ค้างของลูกค้ารายเดียว (เก่า→ใหม่) — สำหรับร่างทวง/แสดงรายใบ · คืนเฉพาะ outstanding > 0
// ใช้ฐาน where เดียวกับ billing-note.eligibleInvoices (isVoided/type/paymentStatus) แต่ "จงใจไม่กรอง"
// ใบที่อยู่บนใบวางบิลแล้ว — ทวงจากยอดค้างจริงทุกใบ (วางบิลแล้วแต่ยังไม่จ่าย = ยังเป็นหนี้)
export async function loadReceivablesByCustomer(
  db: Pick<PrismaTx, "invoice">,
  customerId: string
): Promise<ReceivableInvoiceRow[]> {
  const invoices = await db.invoice.findMany({
    where: {
      customerId,
      isVoided: false,
      type: { in: [...RECEIVABLE_TYPES] },
      paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
    },
    select: {
      invoiceNumber: true,
      type: true,
      dueDate: true,
      totalAmount: true,
      isVoided: true,
      payments: { select: { amount: true, whtAmount: true } },
      adjustments: { select: { type: true, totalAmount: true, isVoided: true } },
      order: { select: { orderNumber: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return invoices
    .map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      orderNumber: inv.order?.orderNumber ?? null,
      type: inv.type,
      dueDate: inv.dueDate,
      outstanding: outstandingOf(inv).toNumber(),
    }))
    .filter((r) => r.outstanding > 0);
}
