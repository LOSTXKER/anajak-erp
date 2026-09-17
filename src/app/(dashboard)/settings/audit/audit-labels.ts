import type { Tone } from "@/components/kit/kit";
import { BLIND_SHIP_LABEL, INTERNAL_STATUS_LABELS } from "@/lib/order-status";

/* ============================================================
   คำไทยของประวัติระบบ — แปลง action/entityType ที่ server เขียนไว้ให้คนอ่านรู้เรื่อง

   ต้นแบบ (setaudit) เขียนคอลัมน์ "เรื่อง" เป็นคำไทย + จุดสีตามความหนักของเหตุการณ์
   ส่วนของจริงเก็บเป็นค่าดิบ ("UPDATE" / "ORDER") ซึ่งบนจอแปลว่าอ่านไม่ออก

   กติกา: ค่าที่ยังไม่มีในตารางนี้ต้อง "ตกกลับเป็นค่าดิบ" ห้ามซ่อนหรือเดา —
   ประวัติระบบเป็นหลักฐาน ถ้าแปลไม่ได้ต้องยังเห็นว่าระบบบันทึกอะไรไว้
   รายการทั้งหมดมาจาก createAuditLog ของจริงใน src/server เท่านั้น
   ============================================================ */

/** ประเภทข้อมูลที่ระบบเขียนลง audit จริง (ไล่จาก createAuditLog ทุกจุด) */
export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  ORDER: "ออเดอร์",
  QUOTATION: "ใบเสนอราคา",
  CUSTOMER: "ลูกค้า",
  CUSTOMER_ARTWORK: "คลังลายลูกค้า",
  DESIGN_VERSION: "ไฟล์ออกแบบ",
  INVOICE: "ใบกำกับ/ใบแจ้งหนี้",
  PAYMENT: "การรับเงิน",
  BILLING_NOTE: "ใบลด/เพิ่มหนี้",
  WHT_CERTIFICATE: "หนังสือรับรองหัก ณ ที่จ่าย",
  PRODUCTION: "ใบผลิต",
  PRODUCTION_STEP: "ขั้นผลิต",
  PRINT_RUN: "รอบพิมพ์ DTF",
  QC_RECORD: "ผลตรวจคุณภาพ",
  OUTSOURCE_ORDER: "งานร้านนอก",
  VENDOR: "ร้านรับจ้างภายนอก",
  GOODS_RECEIPT: "การรับของเข้า",
  STOCK_ISSUE: "การเบิกเสื้อ",
  STOCK_RETURN: "การคืนเสื้อ",
  FILM_STOCK: "สต๊อกฟิล์ม",
  DELIVERY: "การจัดส่ง",
  USER: "ผู้ใช้",
  DATABASE_BACKUP: "การสำรองข้อมูล",
};

/** ตัวเลือกของช่อง "ประเภทเหตุการณ์" — มีเฉพาะค่าที่ระบบเขียนจริง กรองแล้วไม่มีทางว่างเปล่าโดยดีไซน์ */
export const AUDIT_ENTITY_FILTERS: Array<{ value: string; label: string }> = [
  "ORDER",
  "QUOTATION",
  "CUSTOMER",
  "CUSTOMER_ARTWORK",
  "DESIGN_VERSION",
  "INVOICE",
  "PAYMENT",
  "BILLING_NOTE",
  "WHT_CERTIFICATE",
  "PRODUCTION",
  "PRODUCTION_STEP",
  "PRINT_RUN",
  "QC_RECORD",
  "OUTSOURCE_ORDER",
  "VENDOR",
  "GOODS_RECEIPT",
  "STOCK_ISSUE",
  "STOCK_RETURN",
  "FILM_STOCK",
  "DELIVERY",
  "USER",
  "DATABASE_BACKUP",
].map((value) => ({ value, label: AUDIT_ENTITY_LABELS[value] ?? value }));

/** action ทั่วไป — ต่อกับชื่อประเภทข้อมูลเป็นประโยคเดียว เช่น "ยกเลิก" + "ใบกำกับ" */
const GENERIC_ACTIONS: Record<string, string> = {
  CREATE: "สร้าง",
  UPDATE: "แก้ไข",
  DELETE: "ลบ",
  VOID: "ยกเลิก",
  EXPORT: "ดาวน์โหลด",
};

/** action ที่บอกเรื่องครบในตัวแล้ว — ไม่ต้องต่อชื่อประเภทข้อมูลซ้ำ */
const NAMED_ACTIONS: Record<string, string> = {
  saveForm: "บันทึกฟอร์มออเดอร์",
  updateItems: "แก้รายการในออเดอร์",
  updateFees: "แก้ค่าบริการเพิ่ม",
  addRevisionFee: "เพิ่มค่าแก้งาน",
  applyChangeOrder: "ใช้ใบสั่งเปลี่ยนแปลง",
  updateReceiveTracking: "อัปเดตการรับของ",
  PRINT_RUN_CANCELLED: "ยกเลิกรอบพิมพ์",
  PRINT_RUN_MARKED_PRINTED: "ปิดรอบพิมพ์",
  QC_DISPOSITION_DECIDED: "ตัดสินผลตรวจคุณภาพ",
  OUTSOURCE_REWORK_COMPLETED: "ร้านนอกแก้งานเสร็จ",
  OUTSOURCE_REWORK_REINSPECTED: "ตรวจซ้ำงานที่ร้านนอกแก้",
};

const BAD_ACTIONS = new Set(["VOID", "DELETE", "PRINT_RUN_CANCELLED"]);
const MONEY_IN_ENTITIES = new Set(["PAYMENT", "GOODS_RECEIPT"]);
const FLOW_ENTITIES = new Set([
  "ORDER",
  "PRODUCTION",
  "PRODUCTION_STEP",
  "PRINT_RUN",
  "OUTSOURCE_ORDER",
  "DELIVERY",
  "QC_RECORD",
]);

/** เหตุการณ์ร้าย = ยกเลิก/ลบ — ใช้ทั้งจุดสีและเส้นขอบซ้ายของแถว */
export function isSevereAudit(action: string): boolean {
  return BAD_ACTIONS.has(action);
}

/** เรื่องที่เกิดขึ้น (คำไทย) + โทนของจุดสี · แปลไม่ได้ = คืนค่าดิบ ไม่ซ่อน */
export function auditSubject(action: string, entityType: string): { label: string; tone: Tone } {
  const entity = AUDIT_ENTITY_LABELS[entityType];
  const named = NAMED_ACTIONS[action];
  const generic = GENERIC_ACTIONS[action];

  const label = named
    ? named
    : generic && entity
      ? `${generic}${entity}`
      : generic
        ? `${generic} ${entityType}`
        : entity
          ? `${action} · ${entity}`
          : `${action} · ${entityType}`;

  const tone: Tone = BAD_ACTIONS.has(action)
    ? "bad"
    : action === "CREATE" && MONEY_IN_ENTITIES.has(entityType)
      ? "good"
      : action === "EXPORT"
        ? "warn"
        : FLOW_ENTITIES.has(entityType)
          ? "blue"
          : "gray";

  return { label, tone };
}

/** เลขเอกสารที่คนอ่านออก (ORD-2609-0142) — entityId ส่วนใหญ่เป็นรหัสภายใน ไม่เอาขึ้นตาราง */
export function isDocumentNumber(value: string | null | undefined): boolean {
  return !!value && /^[A-Z]{2,5}-[0-9]/.test(value);
}

const FIELD_LABELS: Record<string, string> = {
  internalStatus: "สถานะภายใน",
  customerStatus: "สถานะที่ลูกค้าเห็น",
  totalAmount: "ยอดรวม",
  subtotalItems: "ยอดรายการ",
  itemCount: "จำนวนรายการ",
  feeCount: "จำนวนค่าบริการ",
  quantity: "จำนวน",
  name: "ชื่อ",
  role: "บทบาท",
  isActive: "เปิดใช้งาน",
  voided: "ยกเลิกแล้ว",
  refundedAmount: "ยอดคืน",
  tableCount: "จำนวนตาราง",
  rowCount: "จำนวนแถว",
  blindShip: `ส่งแบบ${BLIND_SHIP_LABEL}`,
  blindShipSenderName: "ชื่อผู้ส่งบนกล่อง",
  action: "การทำงาน",
  note: "หมายเหตุ",
};

export const auditFieldLabel = (key: string) => FIELD_LABELS[key] ?? key;

/** ค่าที่อ่านออก: สถานะออเดอร์เป็นคำไทย · true/false เป็นใช่/ไม่ใช่ · ที่เหลือคงรูปเดิม */
export function auditValueText(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่ใช่";
  if (typeof value === "number") return value.toLocaleString("th-TH");
  if (typeof value === "string") {
    if (key === "internalStatus") {
      // สถานะลูกค้าเป็นคนละชุดคำ จึงแปลเฉพาะสถานะภายใน — ที่แปลไม่ได้คงค่าดิบไว้
      const labels: Record<string, string | undefined> = INTERNAL_STATUS_LABELS;
      return labels[value] ?? value;
    }
    return value;
  }
  return JSON.stringify(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export interface AuditChange {
  key: string;
  before: unknown;
  after: unknown;
}

/** คีย์ที่เปลี่ยนจริงระหว่าง oldValue → newValue (ไม่มี oldValue = ถือว่าค่าใหม่ทั้งชุด) */
export function auditChanges(oldValue: unknown, newValue: unknown): AuditChange[] {
  const before = asRecord(oldValue);
  const after = asRecord(newValue);
  if (!after && !before) return [];
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: AuditChange[] = [];
  for (const key of keys) {
    const a = before?.[key];
    const b = after?.[key];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    changes.push({ key, before: a, after: b });
  }
  return changes;
}

/** บรรทัด "รายละเอียด" ในตาราง — เลขเอกสาร · สิ่งที่เปลี่ยน หรือเหตุผลที่บันทึกไว้ */
export function auditSummary(log: {
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
}): string {
  const parts: string[] = [];
  if (isDocumentNumber(log.entityId)) parts.push(log.entityId as string);

  const statusChange = auditChanges(log.oldValue, log.newValue).find(
    (change) => change.key === "internalStatus",
  );
  if (statusChange) {
    parts.push(
      `${auditValueText("internalStatus", statusChange.before)} → ${auditValueText("internalStatus", statusChange.after)}`,
    );
  } else if (log.reason) {
    parts.push(log.reason);
  } else {
    const after = asRecord(log.newValue);
    const named = typeof after?.action === "string" ? (after.action as string) : null;
    if (named) parts.push(NAMED_ACTIONS[named] ?? named);
  }

  return parts.join(" · ");
}
