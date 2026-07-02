import type { ExtendedPrismaClient } from "@/lib/prisma";
import { createNotification } from "@/server/helpers";
import { thaiDateUtcMidnight } from "./payment-plan";
import { claimThrottleSlot } from "./sweep-throttle";
import { RECEIVABLE_TYPES } from "./receivables";

// กวาดบิลเลยกำหนดชำระ → ตั้งสถานะ OVERDUE + แจ้งเตือนทีมการเงินในกระดิ่ง
// ตัวเรียกมี 3 ทาง: cron route (/api/cron/overdue) · billing.markOverdue (ปุ่ม manual)
// · maybeSweepOverdue ใน billing.stats (กวาดอัตโนมัติแบบ throttle ระหว่างยังไม่ deploy cron)

// "เลยกำหนด" = พ้นสิ้นวันไทยของ dueDate แล้ว — dueDate เก็บเป็น UTC midnight ของวันตามปฏิทิน
// (จาก <input type="date">) จึงเทียบกับ UTC midnight ของวันนี้(ไทย): ครบกำหนดวันนี้ยังไม่ถือว่าเลย
export function overdueCutoffUtc(now = new Date()): Date {
  return thaiDateUtcMidnight(now);
}

// กลุ่มที่ต้องรู้เรื่องเงินค้าง — ชุดเดียวกับ billingStaff ใน billing router
const NOTIFY_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"] as const;

export interface SweepResult {
  marked: number; // จำนวนบิลที่เพิ่งถูกตั้ง OVERDUE รอบนี้
  notified: number; // จำนวนผู้ใช้ที่ได้รับแจ้งเตือน
}

export async function sweepOverdueInvoices(
  prisma: ExtendedPrismaClient,
  now = new Date()
): Promise<SweepResult> {
  const cutoff = overdueCutoffUtc(now);

  return prisma.$transaction(async (tx) => {
    const due = await tx.invoice.findMany({
      where: {
        paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
        isVoided: false,
        dueDate: { lt: cutoff },
        // "ค้างชำระ" มีความหมายเฉพาะใบเรียกเก็บ — ใบเสร็จ/ใบลดหนี้ห้ามโดน OVERDUE ปลอม
        // (ใบเสร็จ flow ปกติค้าง UNPAID โดย design — เงินบันทึกที่ใบแจ้งหนี้ต้นทาง)
        type: { in: [...RECEIVABLE_TYPES] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        customer: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
    });
    if (due.length === 0) return { marked: 0, notified: 0 };

    // เช็คสถานะซ้ำใน where + คืนเฉพาะแถวที่ mark ได้จริงรอบนี้ — sweep ซ้อนกัน/จ่ายเงิน
    // คั่นกลาง ตัวที่มาช้าได้ 0 แถวจะไม่แจ้งซ้ำ และข้อความต้องตรงกับใบที่ mark จริง
    const marked = await tx.invoice.updateManyAndReturn({
      where: {
        id: { in: due.map((d) => d.id) },
        paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
      },
      data: { paymentStatus: "OVERDUE" },
      select: { id: true, invoiceNumber: true, totalAmount: true },
    });
    if (marked.length === 0) return { marked: 0, notified: 0 };

    const staff = await tx.user.findMany({
      where: { role: { in: [...NOTIFY_ROLES] }, isActive: true },
      select: { id: true },
    });

    const customerById = new Map(due.map((d) => [d.id, d.customer.name]));
    const lines = marked
      .slice(0, 5)
      .map(
        (m) =>
          `${m.invoiceNumber} — ${customerById.get(m.id) ?? ""} (${m.totalAmount.toFixed(2)} บาท)`
      );
    if (marked.length > 5) lines.push(`และอีก ${marked.length - 5} ใบ`);

    // แจ้งสรุปรอบละ 1 รายการต่อคน (ไม่แจ้งรายใบ — กัน spam กระดิ่ง)
    for (const user of staff) {
      await createNotification(tx, {
        userId: user.id,
        type: "PAYMENT",
        title: `บิลเลยกำหนดชำระ ${marked.length} ใบ`,
        message: lines.join("\n"),
        link: "/billing",
        entityType: "INVOICE",
      });
    }

    return { marked: marked.length, notified: staff.length };
  });
}

const SWEEP_SETTING_KEY = "overdue_last_sweep_at";
const SWEEP_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

// กวาดอัตโนมัติไม่เกินทุก 6 ชม. — สะพานให้ overdue ทำงานจริงบนเครื่องเบสที่ยังไม่มี cron
// เรียกจาก billing.stats (ทีมการเงินเปิดหน้า /billing ทุกวันอยู่แล้ว)
export async function maybeSweepOverdue(
  prisma: ExtendedPrismaClient,
  now = new Date()
): Promise<SweepResult | null> {
  if (!(await claimThrottleSlot(prisma, SWEEP_SETTING_KEY, SWEEP_MIN_INTERVAL_MS, now))) {
    return null;
  }
  return sweepOverdueInvoices(prisma, now);
}
