import { QUOTATION_STATUS_LABELS } from "@/lib/status-config";

// เส้นทางสถานะใบเสนอ — server ต้อง validate ทุกครั้งที่เปลี่ยน (Gate A3 · audit 2026-07-02:
// เดิม updateStatus เขียนตรงไม่เช็คสถานะเดิม → CONVERTED ถูกดึงกลับแล้ว convert ซ้ำเป็นออเดอร์ซ้อนได้)
// CONVERTED = ปลายทางตายตัว: ผูกออเดอร์ไปแล้ว แก้อะไรให้ไปทำที่ออเดอร์
export type QuotationStatus =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "CONVERTED";

export const QUOTATION_STATUS_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  // DRAFT→ACCEPTED ตรงได้ — เคสจริง: ตกลงราคากันใน LINE โดยไม่เคยกดส่งในระบบ
  DRAFT: ["SENT", "ACCEPTED"],
  SENT: ["DRAFT", "ACCEPTED", "REJECTED", "EXPIRED"],
  // ก่อนแปลงเป็นออเดอร์ ลูกค้าเปลี่ยนใจ/ขอแก้ราคาได้ — กลับร่างเพื่อแก้ หรือปิดเป็นปฏิเสธ
  ACCEPTED: ["DRAFT", "REJECTED"],
  REJECTED: ["DRAFT"],
  // ต่ออายุใบ = ดึงกลับร่าง แก้วันที่ "ใช้ได้ถึง" (ยืนราคาใหม่) แล้วส่งใหม่
  EXPIRED: ["DRAFT"],
  CONVERTED: [],
};

// รับ from เป็น string เพราะค่าจาก DB — สถานะไม่รู้จัก = ไปไหนไม่ได้ (fail-closed)
export function canQuotationTransition(from: string, to: QuotationStatus): boolean {
  return (QUOTATION_STATUS_TRANSITIONS[from as QuotationStatus] ?? []).includes(to);
}

export function quotationStatusLabel(status: string): string {
  // labels ประกาศเป็น Record ของ union — รับ string จาก DB จึงต้องเปิด index กว้าง
  return (QUOTATION_STATUS_LABELS as Record<string, string>)[status] ?? status;
}
