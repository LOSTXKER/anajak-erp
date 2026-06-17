/**
 * Auto-release จองสต๊อกค้าง — "ออเดอร์ผี" ที่จองเสื้อไว้แต่ลูกค้าหาย/ไม่จ่ายมัดจำ
 * (เบสเคาะ 2026-06-17: ปลดจองอัตโนมัติ + เตือนล่วงหน้า 1 วัน · เกณฑ์ = ยังไม่จ่ายมัดจำ + จองค้าง 3 วัน)
 *
 * กติกา:
 * - แตะเฉพาะออเดอร์ที่ "จองอยู่จริง" (stockReservedAt) + ยังไม่เริ่มผลิต (STOCK_COMMITTED_STATUSES)
 *   หลังเริ่มผลิตมีการเบิกตัดยอดจองไปแล้ว — ห้ามปลดทับ (ยอดจองเกินจริง)
 * - เกณฑ์ "ลูกค้าหาย" = เทอม*ต้อง*มัดจำ/จ่ายล่วงหน้า แต่รับเงินยังไม่ถึง (requiredUpfrontAmount)
 *   → เครดิตเทอม/COD/ไม่ระบุ "ไม่โดน" โดยอัตโนมัติ (requiredUpfront = 0 — ผลิตก่อนเก็บทีหลังเป็นปกติ)
 * - อายุจอง (วัด elapsed จาก stockReservedAt — ไม่ผูกกับเวลา cron ยิง):
 *     ≥ 3 วัน → ปลดจองคืน (releaseOrderStockReservation) + แจ้ง + จดประวัติ
 *     ≥ 2 วัน + ยังไม่เคยเตือน → เตือนล่วงหน้า "ใกล้ถูกปลด" + จำว่าเตือนแล้ว (กันเตือนซ้ำทุกวัน)
 * - จ่ายมัดจำครบ/เริ่มผลิต/แก้รายการ = หลุดเกณฑ์เอง · ปลด/จองใหม่ ล้าง warnedAt กลับ (ใน sync/release)
 * - reuse releaseOrderStockReservation ตัวเดิม (ปลดฝั่ง Stock + reset stockReservedAt + จด OrderRevision)
 */

import type { ExtendedPrismaClient } from "@/lib/prisma";
import { createNotification } from "@/server/helpers";
import { requiredUpfrontAmount } from "@/lib/payment-terms";
import { releaseOrderStockReservation } from "./stock-reservation";
import { claimThrottleSlot } from "./sweep-throttle";

// แจ้งคนที่ดูแลงาน/เงิน: เจ้าของออเดอร์ (createdById) + เจ้าของกิจการ + ผู้จัดการ
const NOTIFY_ROLES = ["OWNER", "MANAGER"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
export const RESERVATION_RELEASE_MS = 3 * DAY_MS; // ปลดจองเมื่อจองค้างครบ 3 วัน
export const RESERVATION_WARN_MS = 2 * DAY_MS; // เตือนล่วงหน้าเมื่อค้างครบ 2 วัน (1 วันก่อนปลด)

// ออเดอร์ที่ "จองอยู่และยังแก้/ปลดได้" — ก่อนเข้าผลิต (ชุดเดียวกับด่านจอง/จองใหม่ใน order router)
export const STOCK_COMMITTED_STATUSES = [
  "CONFIRMED",
  "DESIGNING",
  "DESIGN_APPROVED",
  "PRODUCTION_QUEUE",
] as const;

export type ReservationAction = "release" | "warn" | "skip";

export interface ReservationCandidate {
  internalStatus: string;
  paymentTerms: string | null;
  totalAmount: number;
  paidAmount: number;
  stockReservedAt: Date | null;
  reservationExpiryWarnedAt: Date | null;
}

// pure — ตัดสินว่าออเดอร์นี้ควร ปลด/เตือน/ปล่อยไว้ (เกราะหลัก มี unit test ครอบทุกเคส)
export function classifyReservation(o: ReservationCandidate, now: Date): ReservationAction {
  if (!o.stockReservedAt) return "skip"; // ไม่ได้จองอยู่
  if (!(STOCK_COMMITTED_STATUSES as readonly string[]).includes(o.internalStatus)) {
    return "skip"; // เริ่มผลิต/ปิดงาน/ยกเลิกแล้ว — ไม่แตะ
  }
  const required = requiredUpfrontAmount(o.paymentTerms, o.totalAmount);
  if (required <= 0) return "skip"; // เครดิต/COD/ไม่ระบุ — ไม่ต้องมัดจำ ไม่ยุ่ง
  if (o.paidAmount >= required - 0.005) return "skip"; // จ่ายมัดจำครบแล้ว (เผื่อเศษสตางค์ Decimal→number)

  const ageMs = now.getTime() - o.stockReservedAt.getTime();
  if (ageMs >= RESERVATION_RELEASE_MS) return "release";
  if (ageMs >= RESERVATION_WARN_MS && !o.reservationExpiryWarnedAt) return "warn";
  return "skip";
}

export interface ReservationSweepResult {
  released: number; // จำนวนออเดอร์ที่เพิ่งถูกปลดจองรอบนี้
  warned: number; // จำนวนออเดอร์ที่เพิ่งเตือนล่วงหน้ารอบนี้
  notified: number; // จำนวนการแจ้งเตือนที่ส่ง (รวมหลายผู้รับ)
}

export async function sweepStaleReservations(
  prisma: ExtendedPrismaClient,
  now = new Date()
): Promise<ReservationSweepResult> {
  // วงแคบตั้งแต่ query: เฉพาะออเดอร์ที่จองอยู่ + ยังไม่เริ่มผลิต
  const orders = await prisma.order.findMany({
    where: {
      stockReservedAt: { not: null },
      internalStatus: { in: [...STOCK_COMMITTED_STATUSES] },
    },
    select: {
      id: true,
      orderNumber: true,
      createdById: true,
      internalStatus: true,
      paymentTerms: true,
      totalAmount: true,
      stockReservedAt: true,
      reservationExpiryWarnedAt: true,
      customer: { select: { name: true } },
      invoices: {
        where: { isVoided: false },
        select: { payments: { select: { amount: true, whtAmount: true } } },
      },
    },
  });

  const toRelease: typeof orders = [];
  const toWarn: typeof orders = [];
  for (const o of orders) {
    // ภาษีหัก ณ ที่จ่ายนับเป็นชำระแล้ว (ชุดเดียวกับ production-readiness) — ลูกค้าหัก 3% ไม่โดนปลดปลอม
    const paidAmount = o.invoices
      .flatMap((inv) => inv.payments)
      .reduce((s, p) => s + p.amount + p.whtAmount, 0);
    const action = classifyReservation(
      {
        internalStatus: o.internalStatus,
        paymentTerms: o.paymentTerms,
        totalAmount: o.totalAmount,
        paidAmount,
        stockReservedAt: o.stockReservedAt,
        reservationExpiryWarnedAt: o.reservationExpiryWarnedAt,
      },
      now
    );
    if (action === "release") toRelease.push(o);
    else if (action === "warn") toWarn.push(o);
  }

  if (toRelease.length === 0 && toWarn.length === 0) {
    return { released: 0, warned: 0, notified: 0 };
  }

  const staff = await prisma.user.findMany({
    where: { role: { in: [...NOTIFY_ROLES] }, isActive: true },
    select: { id: true },
  });
  const staffIds = staff.map((s) => s.id);

  let released = 0;
  let warned = 0;
  let notified = 0;

  // ── ปลดจอง (จองค้างครบ 3 วัน) ──
  for (const o of toRelease) {
    // re-validate สดก่อนปลดจริง — กันลูกค้าจ่ายมัดจำ/ออเดอร์ขยับสถานะ ระหว่าง sweep รัน (TOCTOU)
    const fresh = await prisma.order.findUnique({
      where: { id: o.id },
      select: {
        internalStatus: true,
        paymentTerms: true,
        totalAmount: true,
        stockReservedAt: true,
        reservationExpiryWarnedAt: true,
        invoices: {
          where: { isVoided: false },
          select: { payments: { select: { amount: true, whtAmount: true } } },
        },
      },
    });
    if (!fresh) continue;
    const freshPaid = fresh.invoices
      .flatMap((inv) => inv.payments)
      .reduce((s, p) => s + p.amount + p.whtAmount, 0);
    if (classifyReservation({ ...fresh, paidAmount: freshPaid }, now) !== "release") continue;

    const outcome = await releaseOrderStockReservation(prisma, {
      orderId: o.id,
      changedBy: o.createdById, // ระบบทำแทน — บันทึกประวัติในนามผู้เปิดออเดอร์
      reason: "ปลดจองอัตโนมัติ — จองค้างเกิน 3 วันยังไม่จ่ายมัดจำ",
    });
    // นับ/แจ้งเฉพาะตอนที่ "เรา" เป็นคนปลดจริง — error (ท่อล่ม) หรือ skipped (แพ้ race ปลดซ้อน) ไม่นับ
    // release รีเซ็ต stockReservedAt + reservationExpiryWarnedAt = null ให้แล้ว (ในวงจรจอง)
    if (outcome.status !== "released") continue;
    released++;
    for (const userId of dedupe([o.createdById, ...staffIds])) {
      try {
        await createNotification(prisma, {
          userId,
          type: "SYSTEM",
          title: `ปลดจองสต๊อกอัตโนมัติ — ${o.orderNumber}`,
          message: `${o.customer.name}: จองค้างเกิน 3 วันยังไม่จ่ายมัดจำ → คืนเสื้อเข้าคลังแล้ว · ลูกค้าจ่ายแล้วกด "จองสต๊อกใหม่" ได้`,
          link: `/orders/${o.id}`,
          entityType: "ORDER",
          entityId: o.id,
        });
        notified++;
      } catch (e) {
        // notify ล้มต้องไม่ลากออเดอร์ที่เหลือในรอบนี้ร่วง (release commit ไปแล้ว)
        console.error("sweep release notify error:", e);
      }
    }
  }

  // ── เตือนล่วงหน้า (ครบ 2 วัน ยังไม่เคยเตือน) ──
  for (const o of toWarn) {
    // จำว่าเตือนแล้วก่อน (atomic — กันเตือนซ้ำแม้ sweep ซ้อนกัน/notify ล้ม)
    const claimed = await prisma.order.updateMany({
      where: { id: o.id, reservationExpiryWarnedAt: null },
      data: { reservationExpiryWarnedAt: now },
    });
    if (claimed.count === 0) continue; // มีรอบอื่นเตือนไปแล้ว
    warned++;
    for (const userId of dedupe([o.createdById, ...staffIds])) {
      try {
        await createNotification(prisma, {
          userId,
          type: "SYSTEM",
          title: `ใกล้ถูกปลดจองสต๊อก — ${o.orderNumber}`,
          message: `${o.customer.name}: จองเสื้อค้าง 2 วันยังไม่จ่ายมัดจำ · อีก 1 วันระบบจะคืนของเข้าคลังอัตโนมัติ`,
          link: `/orders/${o.id}`,
          entityType: "ORDER",
          entityId: o.id,
        });
        notified++;
      } catch (e) {
        // notify ล้มต้องไม่ลากออเดอร์ที่เหลือร่วง (warnedAt claim ไปแล้ว — รับว่าเตือนรอบนี้หาย)
        console.error("sweep warn notify error:", e);
      }
    }
  }

  return { released, warned, notified };
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}

const SWEEP_SETTING_KEY = "reservation_sweep_last_at";
const SWEEP_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

// กวาดอัตโนมัติไม่เกินทุก 6 ชม. — สะพานให้ทำงานจริงบนเครื่องเบสที่ยังไม่มี cron (เลียน maybeSweepOverdue)
export async function maybeSweepStaleReservations(
  prisma: ExtendedPrismaClient,
  now = new Date()
): Promise<ReservationSweepResult | null> {
  if (!(await claimThrottleSlot(prisma, SWEEP_SETTING_KEY, SWEEP_MIN_INTERVAL_MS, now))) {
    return null;
  }
  return sweepStaleReservations(prisma, now);
}
