export type DashboardAttentionTone = "danger" | "warning";
export type DashboardAttentionKind =
  | "overdue-order"
  | "due-soon"
  | "outsource"
  | "stuck"
  | "overdue-invoice"
  | "quotation";

export interface DashboardPulseData {
  atRiskOrders: { overdue: number; dueSoon: number };
  outsource: { pending: number; overduePickup: number };
  todayQueue: { done: number; open: number };
  money: { overdueInvoices: number; quotationsAwaiting: number };
  stuckOrders: number;
}

export interface DashboardAttentionItem {
  kind: DashboardAttentionKind;
  title: string;
  detail: string;
  count: number;
  href: string;
  tone: DashboardAttentionTone;
  priority: number;
}

/**
 * แปลง Owner Pulse เป็นรายการที่ "ต้องเช็กก่อน" บนหน้าหลัก
 *
 * - ไม่สร้างการ์ดเลขศูนย์
 * - ไม่รวมเรื่องคนละความหมายเป็นเลขเดียว
 * - เรื่องเงินเข้า view-model ต่อเมื่อคนใช้มีสิทธิ์ไปยังปลายทางจริง
 */
export function buildDashboardAttentionItems(
  pulse: DashboardPulseData,
  permissions: {
    canViewBilling: boolean;
    canViewQuotations: boolean;
  },
): DashboardAttentionItem[] {
  const items: DashboardAttentionItem[] = [];

  if (pulse.atRiskOrders.overdue > 0) {
    items.push({
      kind: "overdue-order",
      title: "งานเลยกำหนดส่ง",
      detail: "ควรจัดลำดับและตามสถานะวันนี้",
      count: pulse.atRiskOrders.overdue,
      href: "/orders?attention=overdue",
      tone: "danger",
      priority: 100,
    });
  }

  if (permissions.canViewBilling && pulse.money.overdueInvoices > 0) {
    items.push({
      kind: "overdue-invoice",
      title: "บิลเลยกำหนด",
      detail: "รอติดตามการรับชำระ",
      count: pulse.money.overdueInvoices,
      href: "/billing?status=OVERDUE",
      tone: "danger",
      priority: 95,
    });
  }

  if (pulse.outsource.pending > 0) {
    items.push({
      kind: "outsource",
      title: "งานค้างร้านนอก",
      detail:
        pulse.outsource.overduePickup > 0
          ? `เลยกำหนดรับ ${pulse.outsource.overduePickup} งาน`
          : "กำลังรอรับงานกลับ",
      count: pulse.outsource.pending,
      // หน้าคิวร้านนอกถอดออก 2026-09-02 พร้อมโมดูลรายการผลิต — ระหว่างรอ ให้ไปดูรายการที่ My Tasks
      href: "/my-tasks",
      tone: pulse.outsource.overduePickup > 0 ? "danger" : "warning",
      priority: pulse.outsource.overduePickup > 0 ? 90 : 60,
    });
  }

  if (pulse.atRiskOrders.dueSoon > 0) {
    items.push({
      kind: "due-soon",
      title: "ครบกำหนดใน 48 ชั่วโมง",
      detail: "เช็กความพร้อมก่อนกลายเป็นงานสาย",
      count: pulse.atRiskOrders.dueSoon,
      href: "/orders?attention=due-soon",
      tone: "warning",
      priority: 80,
    });
  }

  if (pulse.stuckOrders > 0) {
    items.push({
      kind: "stuck",
      title: "งานนิ่งเกิน 3 วัน",
      detail: "ไม่มีความเคลื่อนไหวล่าสุด",
      count: pulse.stuckOrders,
      href: "/orders?attention=stuck",
      tone: "warning",
      priority: 70,
    });
  }

  if (permissions.canViewQuotations && pulse.money.quotationsAwaiting > 0) {
    items.push({
      kind: "quotation",
      title: "ใบเสนอราคาค้างตอบ",
      detail: "รอลูกค้าตัดสินใจ",
      count: pulse.money.quotationsAwaiting,
      href: "/quotations?status=SENT",
      tone: "warning",
      priority: 50,
    });
  }

  return items.sort((a, b) => b.priority - a.priority);
}
