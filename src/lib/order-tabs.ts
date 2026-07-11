// แท็บของหน้ารายละเอียดออเดอร์ + ตัว map ข้อมูล → NextStepInput (แยกเป็น pure ให้ test ได้)
import type { NextStepInput, NextStepAction } from "./order-next-step";

export type TabKey = "overview" | "production" | "delivery" | "money" | "files" | "history";

export interface OrderTabDef {
  key: TabKey;
  label: string;
}

// UX6: แท็บ "เงิน/บิล" ใหม่ (gate canSeeMoney ที่หน้า — role ไม่เห็นเงินจะถูกกรองออก) ·
// "บิล/ไฟล์" เดิมไม่มีบิลจริง → เปลี่ยนชื่อเป็น "ไฟล์" (ป้ายตรงของจริง)
export const ORDER_TAB_DEFS: OrderTabDef[] = [
  { key: "overview", label: "ภาพรวม" },
  { key: "production", label: "งานผลิต" },
  { key: "delivery", label: "จัดส่ง" },
  { key: "money", label: "เงิน/บิล" },
  { key: "files", label: "ไฟล์" },
  { key: "history", label: "ประวัติ" },
];

export function normalizeOrderTab(value: string | null): TabKey | null {
  // deep link เก่าใช้ ?tab=docs — คงเข้าได้ แล้วหน้า canonicalize เป็น files
  if (value === "docs") return "files";
  return ORDER_TAB_DEFS.some((tab) => tab.key === value) ? value as TabKey : null;
}

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
// UX6: billing → แท็บ "เงิน/บิล" (เดิมคืน null ให้ scroll ใน sidebar · การ์ดบิลย้ายมาเป็นแท็บแล้ว)
export function tabForAnchor(
  target: "billing" | "design" | "production" | "delivery" | "qc"
): TabKey | null {
  switch (target) {
    case "design":
    case "production":
    case "qc": // การ์ดตรวจนับ QC อยู่แท็บงานผลิต (Gate B4: แถบขั้นต่อไปพาไปนับ ไม่พาข้ามด่าน)
      return "production";
    case "delivery":
      return "delivery";
    case "billing":
      return "money";
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
  invoices?: { isVoided: boolean; type: string; totalAmount: number | null }[] | null;
  designs?: { approvalStatus: string }[] | null;
  productions?: unknown[] | null;
  deliveries?: unknown[] | null;
}

export function buildNextStepInput(order: OrderLikeForNextStep): NextStepInput {
  const liveInvoices = (order.invoices ?? []).filter((inv) => !inv.isVoided);
  // สูตร billingHandled เป๊ะตาม server (src/server/routers/order.ts ~801-817):
  // handled = max(ผลรวมใบแจ้งหนี้ DEPOSIT+FINAL, ผลรวมใบเสร็จ) · ปิดงานได้เมื่อ handled ≥ ยอดออเดอร์
  // ห้าม drift จาก server ไม่งั้นแถบบอก "ปิดงานได้" แต่ server ปฏิเสธ
  // นโยบาย ⑦: viewer ที่ไม่เห็นเงิน (ช่าง/กราฟิก) ได้ totalAmount=null → นับเป็น 0 ทั้งยอดบิล
  // และยอดออเดอร์ → billingHandled อาจเป็น true ทั้งที่บิลยังไม่ครบ — ยอมรับได้ (เบสเคาะ:
  // ขั้นวางบิล/ปิดงานไม่ใช่งานของ role นั้น · server มีด่านจริงกันปิดงานก่อนบิลครบอยู่แล้ว)
  const sumOf = (types: string[]) =>
    liveInvoices
      .filter((inv) => types.includes(inv.type))
      .reduce((s, inv) => s + (inv.totalAmount ?? 0), 0);
  const handled = Math.max(sumOf(["DEPOSIT_INVOICE", "FINAL_INVOICE"]), sumOf(["RECEIPT"]));
  // ยอดสำหรับสูตร billingHandled เท่านั้น — null นับเป็น 0 ตามเคาะข้างบน · แต่ totalAmount
  // ที่ส่งต่อคง null ไว้ ให้แถบขั้นต่อไปละส่วนยอดเงินเอง (ไม่โชว์ "ยอดรวม 0 บาท" เลขปลอม)
  const totalForBilling = order.totalAmount ?? 0;

  return {
    internalStatus: order.internalStatus,
    orderType: order.orderType,
    itemCount: order.items?.length ?? 0,
    totalAmount: order.totalAmount,
    paymentTerms: order.paymentTerms,
    hasInvoice: liveInvoices.length > 0,
    hasPendingDesign: (order.designs ?? []).some((d) => d.approvalStatus === "PENDING"),
    hasApprovedDesign: (order.designs ?? []).some((d) => d.approvalStatus === "APPROVED"),
    hasProduction: (order.productions ?? []).length > 0,
    hasDelivery: (order.deliveries ?? []).length > 0,
    // totalAmount ≤ 0 = ไม่กั้น (ตรงกับ server ที่เช็คเฉพาะ old.totalAmount > 0) · เผื่อเศษสตางค์
    billingHandled: totalForBilling <= 0 || handled >= totalForBilling - 0.005,
  };
}
