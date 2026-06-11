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
  payments: { amount: number }[];
}

export function isReceivable(inv: Pick<ReceivableInvoice, "type" | "isVoided">): boolean {
  return !inv.isVoided && (RECEIVABLE_TYPES as readonly string[]).includes(inv.type);
}

// ยอดคงเหลือของใบ = ยอดบิล − เงินรับสุทธิ (รายการคืนเงินเป็นลบ หักกลับให้เอง) ไม่ติดลบ
export function outstandingOf(inv: ReceivableInvoice): Prisma.Decimal {
  const paid = inv.payments.reduce((sum, p) => sum.plus(p.amount), D(0));
  const remaining = D(inv.totalAmount).minus(paid);
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

// นิยามเดียวกับ overdue sweep: เลยกำหนดเมื่อพ้นสิ้นวันไทยของ dueDate
// ครบกำหนดวันนี้/ไม่มี dueDate = ยังไม่ครบกำหนด
export function agingBucketOf(dueDate: Date | null, now = new Date()): AgingBucket {
  if (!dueDate) return "current";
  const daysPast = Math.floor(
    (thaiDateUtcMidnight(now).getTime() - dueDate.getTime()) / DAY_MS
  );
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
        payments: { select: { amount: true } },
      },
    }),
  ]);
  return computeCreditExposure({ orders, invoices });
}
