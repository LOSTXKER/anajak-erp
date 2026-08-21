// แท็บของหน้ารายละเอียดออเดอร์ + ตัว map ข้อมูล → NextStepInput (แยกเป็น pure ให้ test ได้)
import type { NextStepInput, NextStepAction } from "./order-next-step";

export type TabKey =
  | "overview"
  | "items"
  | "production"
  | "delivery"
  | "money"
  | "files"
  | "history";

export interface OrderTabDef {
  key: TabKey;
  label: string;
}

// UX6: แท็บ "เงิน/บิล" ใหม่ (gate canSeeMoney ที่หน้า — role ไม่เห็นเงินจะถูกกรองออก) ·
// "บิล/ไฟล์" เดิมไม่มีบิลจริง → เปลี่ยนชื่อเป็น "ไฟล์" (ป้ายตรงของจริง)
// 2026-08-05 กลับมาใช้แท็บอีกครั้ง (เบสเคาะเอง หลังเคยสั่งเลิกซ่อน 2026-07-18)
//
// 2026-08-11 เบสสั่ง: "tab แรกเป็นแบบภาพรวมดีกว่า จะเป็นพวกผู้ติดต่อ และอื่นๆ
// แต่รายการ แยกไปอีก tab นึง" → แท็บ "ภาพรวม" ของจริงเกิดขึ้นเป็นตัวแรก
// แล้วตารางรายการย้ายไป key ใหม่ "items"
//
// ⚠️ key "overview" **เปลี่ยนความหมาย** (เดิม = ตารางรายการ · ตอนนี้ = ภาพรวม) โดยตั้งใจ
// ไม่ทำ alias overview→items เพราะแท็บภาพรวมต้องมี URL ของตัวเอง · ลิงก์เก่า ?tab=overview
// คือลิงก์ที่แปลว่า "เปิดออเดอร์นี้" อยู่แล้ว (มันคือค่าเริ่มต้นเดิม) พอค่าเริ่มต้นย้ายมาที่
// ภาพรวม ลิงก์เก่าก็ไปลงที่เดียวกับการเปิดใบเปล่า — ไม่มีใครเจอหน้าตาย
export const ORDER_TAB_DEFS: OrderTabDef[] = [
  { key: "overview", label: "ภาพรวม" },
  { key: "items", label: "รายการ" },
  { key: "production", label: "งานผลิต" },
  { key: "delivery", label: "จัดส่ง" },
  { key: "money", label: "เงิน & บิล" },
  // 2026-08-22 ม็อกอัพย้ายมาอยู่แท็บนี้เป็นบ้านเดียว — เดิมโผล่สองที่ (การ์ดงานออกแบบ
  // ในแท็บงานผลิต + สรุปในแท็บไฟล์) ยิง query เดียวกันซ้ำและคนอ่านไม่รู้ว่าอันไหนของจริง
  // ป้ายบอกทั้งสองอย่างเพราะข้างในเรียงตามชั้นไฟล์: ม็อกอัพ (ชั้น 2) → ไฟล์ดิบ/ไฟล์พิมพ์
  { key: "files", label: "ม็อกอัพ & ไฟล์" },
  { key: "history", label: "ประวัติ" },
];

/** แท็บที่เปิดมาเจอเสมอ — เบสเคาะ 2026-08-05 ให้ล็อกตายตัว ไม่เด้งตามสถานะ
 *  เหตุผลของเบส: ออเดอร์เดิมต้องเปิดเจอที่เดิมทุกครั้ง จะได้สั่งงานทางโทรศัพท์ได้
 *  ("เปิดออเดอร์นี้ ดูแท็บภาพรวม") · `defaultTabForStatus` ข้างล่างจึงไม่ได้ใช้ที่หน้าแล้ว
 *  แต่คงไว้พร้อมเทส เผื่อเปลี่ยนใจ — อย่าเอาไปต่อกลับโดยไม่ถามเบสก่อน */
export const ORDER_DEFAULT_TAB: TabKey = "overview";

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
    // 2026-08-22 งานออกแบบ = ม็อกอัพ ย้ายไปอยู่แท็บไฟล์แล้ว — เดิมชี้มาแท็บงานผลิต
    // ซึ่งตอนนี้ไม่มีตัวจัดการม็อกอัพอยู่ กดแล้วจะไปเจอแท็บที่ทำงานนั้นไม่ได้
    case "design":
      return "files";
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
