/**
 * ตัวชี้วัดการผลิต (ROADMAP MFG1–3 · เบสสั่งลงจริง 2026-09-16) — อ่านอย่างเดียว ไม่มีเงิน ไม่เพิ่ม schema
 *
 * งวด = เดือนปฏิทินตามเวลาไทย · ย้อนได้ 6 เดือน
 * - ส่งตรงเวลา: วันส่งจริง (shippedAt ล่าสุดของใบส่งของออเดอร์) เทียบ deadline ตามวันไทย
 *   ไม่มี deadline / ยังไม่ส่ง / ออเดอร์ยกเลิก = ไม่นับ · งวดของออเดอร์ = เดือนที่ส่งครั้งล่าสุด
 * - ทำถูกตั้งแต่ครั้งแรก: ΣqtyGood / (ΣqtyGood + ΣqtyDefect) ของผลตรวจ QC ในงวด · ไม่มีผลตรวจ = null (ไม่หารศูนย์)
 * - ของเสีย: รวม QcDefect.qty แยกสาเหตุ/ไซซ์ในงวด
 * - เวลาต่อขั้น: completedAt − startedAt ของขั้นที่ปิดในงวด (ขั้นที่ไม่ได้กดเริ่มไม่นับ) · ร้านนอก = sentAt → receivedAt
 * - เปิดใบผลิต → ส่งเข้า QC: ใบผลิตที่ทุกขั้นปิดแล้ว และขั้นสุดท้ายปิดในงวด
 *
 * สูตรทั้งหมดอยู่ใน summarizeProductionMetrics (ฟังก์ชันล้วน ทดสอบได้โดยไม่มี DB) · loader ดึงข้อมูลดิบให้เท่านั้น
 */

import type { ExtendedPrismaClient } from "@/lib/prisma";
import { qcReasonLabel } from "@/lib/qc";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { BANGKOK_TZ } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
export const METRIC_MONTHS = 6;

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export type MetricMonth = { key: string; label: string; start: Date; end: Date };

function bangkokYearMonth(value: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: BANGKOK_TZ, year: "numeric", month: "2-digit" }).formatToParts(value);
  return { year: Number(parts.find((p) => p.type === "year")!.value), month: Number(parts.find((p) => p.type === "month")!.value) };
}

function bangkokDayKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BANGKOK_TZ }).format(value);
}

/** เดือนตามเวลาไทย เรียงเก่า → ใหม่ · ช่องสุดท้าย = เดือนปัจจุบัน */
export function metricMonths(now: Date, count = METRIC_MONTHS): MetricMonth[] {
  const { year, month } = bangkokYearMonth(now);
  return Array.from({ length: count }, (_, index) => {
    const offset = count - 1 - index;
    const monthIndex = (((month - 1 - offset) % 12) + 12) % 12;
    const y = year + Math.floor((month - 1 - offset) / 12);
    const nextY = monthIndex === 11 ? y + 1 : y;
    const nextM = monthIndex === 11 ? 0 : monthIndex + 1;
    const pad = (n: number) => String(n + 1).padStart(2, "0");
    return {
      key: `${y}-${pad(monthIndex)}`,
      label: TH_MONTHS[monthIndex]!,
      start: new Date(`${y}-${pad(monthIndex)}-01T00:00:00+07:00`),
      end: new Date(`${nextY}-${pad(nextM)}-01T00:00:00+07:00`),
    };
  });
}

export type RawShippedOrder = {
  orderNumber: string;
  customerName: string;
  internalStatus: string;
  deadline: Date | null;
  shippedAt: Date[];
};
export type RawQc = { checkedAt: Date; qtyGood: number; qtyDefect: number; defects: { qty: number; reason: string; size: string | null }[] };
export type RawStep = { stepType: string; customStepName: string | null; startedAt: Date | null; completedAt: Date | null };
export type RawOutsource = { sentAt: Date | null; receivedAt: Date | null };
export type RawProduction = { createdAt: Date; steps: { status: string; completedAt: Date | null }[] };

export type ProductionMetricsInput = {
  now: Date;
  monthIndex: number;
  orders: RawShippedOrder[];
  qc: RawQc[];
  steps: RawStep[];
  outsource: RawOutsource[];
  productions: RawProduction[];
};

const inRange = (value: Date | null | undefined, month: MetricMonth) => !!value && value >= month.start && value < month.end;
const ratio = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

function onTimeOf(orders: RawShippedOrder[], month: MetricMonth) {
  let counted = 0;
  let onTime = 0;
  const late: { orderNumber: string; customerName: string; daysLate: number }[] = [];
  for (const order of orders) {
    if (order.internalStatus === "CANCELLED" || !order.deadline || order.shippedAt.length === 0) continue;
    const shippedAt = new Date(Math.max(...order.shippedAt.map((d) => d.getTime())));
    if (!inRange(shippedAt, month)) continue;
    counted++;
    const shippedDay = bangkokDayKey(shippedAt);
    const deadlineDay = bangkokDayKey(order.deadline);
    if (shippedDay <= deadlineDay) onTime++;
    else
      late.push({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        daysLate: Math.round((Date.parse(`${shippedDay}T00:00:00Z`) - Date.parse(`${deadlineDay}T00:00:00Z`)) / DAY_MS),
      });
  }
  return { counted, onTime, percent: ratio(onTime, counted), late: late.sort((a, b) => b.daysLate - a.daysLate) };
}

export function summarizeProductionMetrics(input: ProductionMetricsInput) {
  const months = metricMonths(input.now);
  const index = Math.max(0, Math.min(months.length - 1, input.monthIndex));
  const month = months[index]!;
  const previous = index > 0 ? months[index - 1]! : null;

  const trend = months.map((m) => ({ key: m.key, label: m.label, percent: onTimeOf(input.orders, m).percent }));
  const onTime = onTimeOf(input.orders, month);

  const qcOf = (m: MetricMonth) => {
    const records = input.qc.filter((record) => inRange(record.checkedAt, m));
    const good = records.reduce((sum, r) => sum + r.qtyGood, 0);
    const defect = records.reduce((sum, r) => sum + r.qtyDefect, 0);
    return { good, defect, firstPass: ratio(good, good + defect) };
  };
  const qc = qcOf(month);
  const qcPrev = previous ? qcOf(previous) : null;

  const reasons = new Map<string, number>();
  const sizes = new Map<string, number>();
  for (const record of input.qc.filter((r) => inRange(r.checkedAt, month))) {
    for (const defect of record.defects) {
      reasons.set(defect.reason, (reasons.get(defect.reason) ?? 0) + defect.qty);
      const size = defect.size?.trim() || "ไม่ระบุ";
      sizes.set(size, (sizes.get(size) ?? 0) + defect.qty);
    }
  }

  const stepTimes = new Map<string, { hours: number; count: number }>();
  for (const step of input.steps) {
    if (!step.startedAt || !inRange(step.completedAt, month)) continue;
    const hours = (step.completedAt!.getTime() - step.startedAt.getTime()) / HOUR_MS;
    if (!Number.isFinite(hours) || hours < 0) continue;
    const label = step.customStepName || (STEP_TYPE_LABELS[step.stepType] ?? step.stepType);
    const current = stepTimes.get(label) ?? { hours: 0, count: 0 };
    stepTimes.set(label, { hours: current.hours + hours, count: current.count + 1 });
  }
  const outsourceTrips = input.outsource.filter((o) => o.sentAt && inRange(o.receivedAt, month) && o.receivedAt! >= o.sentAt);
  const outsourceDays = outsourceTrips.length
    ? outsourceTrips.reduce((sum, o) => sum + (o.receivedAt!.getTime() - o.sentAt!.getTime()) / DAY_MS, 0) / outsourceTrips.length
    : null;

  const cycles: number[] = [];
  for (const production of input.productions) {
    if (production.steps.length === 0 || production.steps.some((s) => s.status !== "COMPLETED" || !s.completedAt)) continue;
    const last = new Date(Math.max(...production.steps.map((s) => s.completedAt!.getTime())));
    if (!inRange(last, month)) continue;
    cycles.push((last.getTime() - production.createdAt.getTime()) / DAY_MS);
  }

  const round1 = (value: number) => Math.round(value * 10) / 10;
  return {
    months: months.map((m, i) => ({ key: m.key, label: m.label, index: i })),
    monthIndex: index,
    month: { key: month.key, label: month.label, isCurrent: index === months.length - 1 },
    onTime: {
      percent: onTime.percent,
      onTime: onTime.onTime,
      counted: onTime.counted,
      previousPercent: previous ? onTimeOf(input.orders, previous).percent : null,
    },
    firstPass: { percent: qc.firstPass, good: qc.good, total: qc.good + qc.defect, previousPercent: qcPrev?.firstPass ?? null },
    defects: {
      total: qc.defect,
      previousTotal: qcPrev?.defect ?? null,
      byReason: [...reasons].map(([reason, qty]) => ({ reason, label: qcReasonLabel(reason), qty })).sort((a, b) => b.qty - a.qty),
      bySize: [...sizes].map(([size, qty]) => ({ size, qty })),
    },
    cycleDays: { average: cycles.length ? round1(cycles.reduce((a, b) => a + b, 0) / cycles.length) : null, count: cycles.length },
    stepTimes: [
      ...[...stepTimes].map(([label, v]) => ({ label, value: round1(v.hours / v.count), unit: "ชม." as const, count: v.count })),
      ...(outsourceDays !== null ? [{ label: "ร้านนอก (ส่ง → รับกลับ)", value: round1(outsourceDays), unit: "วัน" as const, count: outsourceTrips.length }] : []),
    ].sort((a, b) => b.count - a.count),
    trend,
    late: onTime.late.slice(0, 10),
  };
}

export type ProductionMetrics = ReturnType<typeof summarizeProductionMetrics>;

export async function getProductionMetrics(prisma: ExtendedPrismaClient, options: { monthIndex: number; now?: Date }) {
  const now = options.now ?? new Date();
  const months = metricMonths(now);
  const from = months[0]!.start;
  const to = months[months.length - 1]!.end;

  const [deliveries, qc, steps, outsource, productions] = await Promise.all([
    prisma.delivery.findMany({
      where: { shippedAt: { gte: from, lt: to } },
      select: { orderId: true },
    }),
    prisma.qcRecord.findMany({
      where: { checkedAt: { gte: from, lt: to } },
      select: { checkedAt: true, qtyGood: true, qtyDefect: true, defects: { select: { qty: true, reason: true, size: true } } },
    }),
    prisma.productionStep.findMany({
      where: { completedAt: { gte: from, lt: to }, startedAt: { not: null } },
      select: { stepType: true, customStepName: true, startedAt: true, completedAt: true },
    }),
    prisma.outsourceOrder.findMany({
      where: { receivedAt: { gte: from, lt: to }, sentAt: { not: null } },
      select: { sentAt: true, receivedAt: true },
    }),
    prisma.production.findMany({
      where: { steps: { some: { completedAt: { gte: from, lt: to } } } },
      select: { createdAt: true, steps: { select: { status: true, completedAt: true } } },
    }),
  ]);

  const orderIds = [...new Set(deliveries.map((d) => d.orderId))];
  const orders = orderIds.length
    ? await prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: {
          orderNumber: true,
          internalStatus: true,
          deadline: true,
          customer: { select: { name: true } },
          deliveries: { where: { shippedAt: { not: null } }, select: { shippedAt: true } },
        },
      })
    : [];

  return summarizeProductionMetrics({
    now,
    monthIndex: options.monthIndex,
    orders: orders.map((order) => ({
      orderNumber: order.orderNumber,
      customerName: order.customer?.name ?? "ไม่ระบุลูกค้า",
      internalStatus: order.internalStatus,
      deadline: order.deadline,
      shippedAt: order.deliveries.map((d) => d.shippedAt!).filter(Boolean),
    })),
    qc,
    steps,
    outsource,
    productions,
  });
}
