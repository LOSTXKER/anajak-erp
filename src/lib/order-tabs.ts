// แท็บของหน้ารายละเอียดออเดอร์ + ตัว map ข้อมูล → NextStepInput (แยกเป็น pure ให้ test ได้)
import type { NextStepInput, NextStepAction } from "./order-next-step";

export type TabKey = "overview" | "production" | "delivery" | "docs" | "history";

export interface OrderTabDef {
  key: TabKey;
  label: string;
}

export const ORDER_TAB_DEFS: OrderTabDef[] = [
  { key: "overview", label: "ภาพรวม" },
  { key: "production", label: "งานผลิต" },
  { key: "delivery", label: "จัดส่ง" },
  { key: "docs", label: "บิล/ไฟล์" },
  { key: "history", label: "ประวัติ" },
];

// แท็บเริ่มต้นตามสถานะ — เปิดออเดอร์มาให้ตรงกับ "งานที่ต้องทำตอนนี้" (แก้ปัญหา "ไม่รู้จะทำอะไร")
export function defaultTabForStatus(status: string): TabKey {
  switch (status) {
    case "DESIGNING":
    case "DESIGN_APPROVED":
    case "PRODUCTION_QUEUE":
    case "PRODUCING":
    case "QUALITY_CHECK":
    case "PACKING":
      return "production";
    case "READY_TO_SHIP":
    case "SHIPPED":
      return "delivery";
    default:
      // DRAFT / INQUIRY / CONFIRMED / COMPLETED / CANCELLED / ON_HOLD
      return "overview";
  }
}

// ANCHOR action ของ next-step → แท็บที่ต้องสลับไป
// billing คืน null โดยตั้งใจ — บิลอยู่ sidebar (ไม่ใช่แท็บ) ให้ scroll ไป order-section-billing แทน
export function tabForAnchor(
  target: "billing" | "design" | "production" | "delivery"
): TabKey | null {
  switch (target) {
    case "design":
    case "production":
      return "production";
    case "delivery":
      return "delivery";
    case "billing":
      return null;
  }
}

// แถบขั้นต่อไปควรบล็อกปุ่มด้วย "ด่านพร้อมผลิต" ไหม — เฉพาะ STATUS→PRODUCTION_QUEUE (เข้าคิวผลิตจริง)
// เท่านั้นที่ server ใช้ readiness เป็น soft-gate · ยืนยัน/ส่งออกแบบ/QC/แพ็ค/ปิดงาน server ไม่เช็ค readiness
// → ห้าม gate ไม่งั้นบล็อกผิด (เช่น CONFIRMED→DESIGNING วงกลม, SHIPPED→COMPLETED ขัด server)
export function shouldGateOnReadiness(
  action: NextStepAction,
  readiness: { ready: boolean } | null
): boolean {
  return (
    action.type === "STATUS" &&
    action.to === "PRODUCTION_QUEUE" &&
    readiness != null &&
    !readiness.ready
  );
}

// ── map order (ผลจาก trpc.order.getById) → NextStepInput ──
interface OrderLikeForNextStep {
  internalStatus: string;
  orderType: string;
  totalAmount: number | null;
  paymentTerms: string | null;
  items?: unknown[] | null;
  invoices?: { isVoided: boolean; type: string; totalAmount: number }[] | null;
  designs?: { approvalStatus: string }[] | null;
  productions?: unknown[] | null;
  deliveries?: unknown[] | null;
}

export function buildNextStepInput(order: OrderLikeForNextStep): NextStepInput {
  const liveInvoices = (order.invoices ?? []).filter((inv) => !inv.isVoided);
  // สูตร billingHandled เป๊ะตาม server (src/server/routers/order.ts ~801-817):
  // handled = max(ผลรวมใบแจ้งหนี้ DEPOSIT+FINAL, ผลรวมใบเสร็จ) · ปิดงานได้เมื่อ handled ≥ ยอดออเดอร์
  // ห้าม drift จาก server ไม่งั้นแถบบอก "ปิดงานได้" แต่ server ปฏิเสธ
  const sumOf = (types: string[]) =>
    liveInvoices
      .filter((inv) => types.includes(inv.type))
      .reduce((s, inv) => s + inv.totalAmount, 0);
  const handled = Math.max(sumOf(["DEPOSIT_INVOICE", "FINAL_INVOICE"]), sumOf(["RECEIPT"]));
  const totalAmount = order.totalAmount ?? 0;

  return {
    internalStatus: order.internalStatus,
    orderType: order.orderType,
    itemCount: order.items?.length ?? 0,
    totalAmount,
    paymentTerms: order.paymentTerms,
    hasInvoice: liveInvoices.length > 0,
    hasPendingDesign: (order.designs ?? []).some((d) => d.approvalStatus === "PENDING"),
    hasApprovedDesign: (order.designs ?? []).some((d) => d.approvalStatus === "APPROVED"),
    hasProduction: (order.productions ?? []).length > 0,
    hasDelivery: (order.deliveries ?? []).length > 0,
    // totalAmount ≤ 0 = ไม่กั้น (ตรงกับ server ที่เช็คเฉพาะ old.totalAmount > 0) · เผื่อเศษสตางค์
    billingHandled: totalAmount <= 0 || handled >= totalAmount - 0.005,
  };
}
