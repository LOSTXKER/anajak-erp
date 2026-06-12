/**
 * ด่านพร้อมผลิต (FLOW-REDESIGN ก้อน 1 — หัวใจของรอบรื้อ ตาม docs/flow-redesign-2026-06-12.html)
 *
 * มาตรฐาน 3 อย่างครบ: เงินตามเทอม ✓ + แบบอนุมัติ ✓ + ของครบ ✓
 * งานที่ติดอย่างใดอย่างหนึ่ง "ห้ามโผล่ในคิวช่าง" — แยกกอง "ติดอะไร รอใคร" ให้หัวหน้า/ขาย/การเงินตามแก้
 *
 * ตีความต่อเช็ค (decision 2026-06-12):
 * - เงิน: เทอมมัดจำ/จ่ายล่วงหน้า = ต้องรับเงินถึงเกณฑ์ก่อน · เครดิตเทอม/COD/ไม่ระบุ = ไม่กั้น
 *   (ธุรกิจเครดิตเทอมคือฐานรายได้ — ผลิตก่อนเก็บทีหลังเป็นเรื่องปกติ)
 * - แบบ: มีลายพิมพ์ = ต้องมีแบบอนุมัติ (DesignVersion APPROVED) หรือออเดอร์เดินพ้นเฟส
 *   ออกแบบแล้ว (สถานะ = การตัดสินใจที่ระบบบันทึกไว้ เช่น งานสั่งซ้ำใช้ไฟล์เดิม)
 * - ของ: เสื้อจากสต๊อค = จองสำเร็จ (stockReservedAt) · เสื้อลูกค้า = ตรวจรับแล้ว
 *   (receivedInspected) · เสื้อโรงเย็บ (CUSTOM_MADE) "ไม่กั้น" — การเย็บเป็นขั้นแรกใน
 *   ใบผลิตเอง ของมาถึงทีหลังผ่านใบตรวจรับ (กั้นตรงนี้ = งานเย็บใหม่ไม่ได้เริ่มสักงาน)
 *
 * ด่านนี้เป็น soft-gate สำหรับหัวหน้า: เปิดใบผลิตได้แต่เห็นคำเตือนชัด (เคสด่วน/ยกเว้นมีจริง)
 * ส่วนช่าง (PRODUCTION_STAFF) ไม่เห็นงานติดด่านเลย
 */

import { getPaymentTerms } from "@/lib/payment-terms";
import type { ExtendedPrismaClient } from "@/lib/prisma";

export interface ReadinessCheck {
  key: "payment" | "design" | "materials";
  label: string;
  ok: boolean;
  detail: string;
  // ใครต้องขยับ — โชว์ในกอง "ติดอะไร รอใคร" (เฉพาะเช็คที่ไม่ผ่าน)
  waitingOn?: string;
}

export interface OrderReadiness {
  ready: boolean;
  checks: ReadinessCheck[];
}

export interface ReadinessOrderData {
  internalStatus: string;
  paymentTerms: string | null;
  totalAmount: number;
  paidAmount: number;
  hasApprovedDesign: boolean;
  printCount: number;
  stockReservedAt: Date | null;
  stockReservationError: string | null;
  products: Array<{
    itemSource: string | null;
    receivedInspected: boolean;
    description: string;
  }>;
}

// สถานะที่แปลว่า "เฟสออกแบบจบแล้ว" — ระบบบันทึกการตัดสินใจไว้ใน state machine
const PAST_DESIGN_PHASE = [
  "DESIGN_APPROVED",
  "PRODUCTION_QUEUE",
  "PRODUCING",
  "QUALITY_CHECK",
  "PACKING",
  "READY_TO_SHIP",
  "SHIPPED",
  "COMPLETED",
];

const fmtBaht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function evaluateReadiness(o: ReadinessOrderData): OrderReadiness {
  const checks: ReadinessCheck[] = [];

  // ── 1) เงินตามเทอม ──
  const terms = getPaymentTerms(o.paymentTerms);
  let requiredAmount = 0;
  if (terms?.kind === "prepay") requiredAmount = o.totalAmount;
  else if (terms?.kind === "deposit")
    requiredAmount = (o.totalAmount * (terms.depositPercent ?? 0)) / 100;
  // เทียบเงินแบบเผื่อเศษสตางค์จากการแปลง Decimal→number
  const paymentOk = o.totalAmount <= 0 || o.paidAmount >= requiredAmount - 0.005;
  checks.push({
    key: "payment",
    label: "เงินตามเทอม",
    ok: paymentOk,
    detail: !terms
      ? "ไม่ได้ตั้งเงื่อนไขชำระ — ไม่กั้น"
      : requiredAmount <= 0
        ? `${terms.label} — ไม่ต้องรอเงินก่อนผลิต`
        : `${terms.label}: รับแล้ว ${fmtBaht(o.paidAmount)}/${fmtBaht(requiredAmount)} บาท`,
    ...(paymentOk ? {} : { waitingOn: "รอเงินเข้า — ขาย/การเงินตามลูกค้า" }),
  });

  // ── 2) แบบอนุมัติ ──
  const needsDesign = o.printCount > 0;
  const designOk =
    !needsDesign || o.hasApprovedDesign || PAST_DESIGN_PHASE.includes(o.internalStatus);
  checks.push({
    key: "design",
    label: "แบบอนุมัติ",
    ok: designOk,
    detail: !needsDesign
      ? "ไม่มีลายพิมพ์ — ไม่ต้องรอแบบ"
      : designOk
        ? "แบบอนุมัติแล้ว"
        : "แบบยังไม่อนุมัติ",
    ...(designOk ? {} : { waitingOn: "กราฟิกส่งแบบ / รอลูกค้าอนุมัติ" }),
  });

  // ── 3) ของครบ ──
  const materialIssues: string[] = [];
  const hasFromStock = o.products.some((p) => p.itemSource === "FROM_STOCK");
  if (hasFromStock) {
    if (o.stockReservationError) {
      materialIssues.push(`จองสต๊อคไม่สำเร็จ: ${o.stockReservationError}`);
    } else if (!o.stockReservedAt) {
      materialIssues.push("ยังไม่ได้จองเสื้อจากสต๊อค (กดจองใหม่ที่หน้าออเดอร์)");
    }
  }
  const customerGarments = o.products.filter((p) => p.itemSource === "CUSTOMER_PROVIDED");
  const uninspected = customerGarments.filter((p) => !p.receivedInspected);
  if (uninspected.length > 0) {
    materialIssues.push(`เสื้อลูกค้ายังไม่ตรวจรับ ${uninspected.length} รายการ`);
  }
  // CUSTOM_MADE (โรงเย็บ) จงใจไม่กั้น — ดู comment หัวไฟล์
  const materialsOk = materialIssues.length === 0;
  checks.push({
    key: "materials",
    label: "ของครบ",
    ok: materialsOk,
    detail: materialsOk
      ? hasFromStock || customerGarments.length > 0
        ? "เสื้อพร้อม (จอง/ตรวจรับแล้ว)"
        : "ไม่มีของที่ต้องรอ"
      : materialIssues.join(" · "),
    ...(materialsOk ? {} : { waitingOn: "คลัง/แอดมินตรวจรับของเข้า" }),
  });

  return { ready: checks.every((c) => c.ok), checks };
}

// ============================================================
// batch loader — ใช้กับคิวหน้า /production (หลายออเดอร์) และ dialog เปิดใบผลิต (ใบเดียว)
// ============================================================

export async function getOrdersReadiness(
  prisma: ExtendedPrismaClient,
  orderIds: string[]
): Promise<Map<string, OrderReadiness>> {
  const result = new Map<string, OrderReadiness>();
  if (orderIds.length === 0) return result;

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: {
      id: true,
      internalStatus: true,
      paymentTerms: true,
      totalAmount: true,
      stockReservedAt: true,
      stockReservationError: true,
      designs: { where: { approvalStatus: "APPROVED" }, select: { id: true }, take: 1 },
      invoices: {
        where: { isVoided: false },
        select: { payments: { select: { amount: true } } },
      },
      items: {
        select: {
          prints: { select: { id: true } },
          products: {
            select: { itemSource: true, receivedInspected: true, description: true },
          },
        },
      },
    },
  });

  for (const o of orders) {
    const paidAmount = o.invoices
      .flatMap((inv) => inv.payments)
      .reduce((s, p) => s + p.amount, 0);
    result.set(
      o.id,
      evaluateReadiness({
        internalStatus: o.internalStatus,
        paymentTerms: o.paymentTerms,
        totalAmount: o.totalAmount,
        paidAmount,
        hasApprovedDesign: o.designs.length > 0,
        printCount: o.items.reduce((s, it) => s + it.prints.length, 0),
        stockReservedAt: o.stockReservedAt,
        stockReservationError: o.stockReservationError,
        products: o.items.flatMap((it) => it.products),
      })
    );
  }
  return result;
}
