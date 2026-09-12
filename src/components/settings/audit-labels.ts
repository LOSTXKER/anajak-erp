export const AUDIT_ENTITIES: Record<string, string> = {
  ORDER: "ออเดอร์", CUSTOMER: "ลูกค้า", CUSTOMER_ARTWORK: "ลายในคลังลูกค้า",
  QUOTATION: "ใบเสนอราคา", INVOICE: "ใบแจ้งหนี้", PAYMENT: "การรับเงิน",
  BILLING_NOTE: "ใบวางบิล", WHT_CERTIFICATE: "ภาษีหัก ณ ที่จ่าย", DELIVERY: "การจัดส่ง",
  PRODUCTION: "ใบผลิต", PRODUCTION_STEP: "ขั้นผลิต", DESIGN_VERSION: "แบบงาน",
  FILM_STOCK: "ฟิล์มในคลัง", PRINT_RUN: "รอบพิมพ์", QC_RECORD: "ผลตรวจคุณภาพ",
  GOODS_RECEIPT: "รับสินค้าเข้า", OUTSOURCE_ORDER: "งานร้านนอก", VENDOR: "ร้านนอก",
  USER: "ผู้ใช้", DATABASE_BACKUP: "ไฟล์สำรองข้อมูล",
};

const AUDIT_ACTIONS: Record<string, string> = {
  REPORT_PROBLEM: "แจ้งปัญหา",
  CREATE: "สร้าง", UPDATE: "แก้ไข", DELETE: "ลบ", VOID: "ยกเลิกเอกสาร", EXPORT: "ส่งออก",
  PRINT_RUN_CANCELLED: "ยกเลิกรอบพิมพ์", PRINT_RUN_MARKED_PRINTED: "บันทึกพิมพ์เสร็จ",
  OUTSOURCE_REWORK_COMPLETED: "บันทึกแก้งานเสร็จ", OUTSOURCE_REWORK_REINSPECTED: "ตรวจงานแก้ซ้ำ",
  QC_DISPOSITION_DECIDED: "ตัดสินผลตรวจ", addRevisionFee: "เพิ่มค่าแก้งาน",
  applyChangeOrder: "เปลี่ยนรายละเอียดงาน", saveForm: "บันทึกฟอร์ม", updateFees: "แก้ค่าใช้จ่าย",
  updateItems: "แก้สินค้า", updateReceiveTracking: "แก้เลขติดตามรับเข้า",
};

export const auditActionLabel = (action: string) => AUDIT_ACTIONS[action] ?? action;
export const auditEntityLabel = (entityType: string) => AUDIT_ENTITIES[entityType] ?? entityType;
export function auditRecordHref(entityType: string, entityId: string): string | null {
  const routes: Record<string, string> = { ORDER: "/orders", CUSTOMER: "/customers", QUOTATION: "/quotations", PRODUCTION: "/production" };
  return routes[entityType] ? `${routes[entityType]}/${encodeURIComponent(entityId)}` : null;
}
