// ไฟล์ 3 ชั้น (FLOW-REDESIGN ก้อน 4 — มาตรฐาน YoPrint/DecoNetwork)
// กันเหตุ "เอาแบบ mockup ไปพิมพ์" และ "ส่งไฟล์พิมพ์ดิบให้ลูกค้าเห็น"
//
// ชั้น 1 RAW      = ไฟล์ดิบจากลูกค้า (รูปจากแชท/โลโก้/brief) — Attachment
// ชั้น 2 APPROVAL = แบบขออนุมัติ — DesignVersion (โมดูล design เดิม ไม่ย้าย)
//                   ลูกค้าเห็น "ชั้นนี้เท่านั้น" ผ่านลิงก์ token
// ชั้น 3 PRINT    = ไฟล์พิมพ์จริง (gang sheet / ไฟล์ปัก DST / ไฟล์ production)
//                   — Attachment ภายในเท่านั้น ห้ามหลุดถึงลูกค้าทุกช่องทาง

export type FileLayer = "RAW" | "APPROVAL" | "PRINT";

export const FILE_LAYERS: Record<
  FileLayer,
  { label: string; description: string; customerVisible: boolean }
> = {
  RAW: {
    label: "ชั้น 1 — ไฟล์ดิบลูกค้า",
    description: "รูป/ไฟล์ที่ลูกค้าส่งมา (จากแชท หรือลิงก์อัปโหลด)",
    customerVisible: false,
  },
  APPROVAL: {
    label: "ชั้น 2 — แบบขออนุมัติ",
    description: "แบบที่ส่งให้ลูกค้าตัดสิน — ลูกค้าเห็นชั้นนี้เท่านั้น",
    customerVisible: true,
  },
  PRINT: {
    label: "ชั้น 3 — ไฟล์พิมพ์จริง",
    description: "ไฟล์ production (gang sheet/ไฟล์ปัก) — ภายในเท่านั้น",
    customerVisible: false,
  },
};

// category ของ Attachment ทั้งหมดที่ระบบรู้จัก (schema เก็บเป็น String? —
// ค่าเดิมใน DB มีแค่ REFERENCE_IMAGE · PO_DOCUMENT/PAYMENT_SLIP/PHOTO/OTHER
// อยู่ใน comment schema มาแต่แรกแต่ยังไม่เคยถูกเขียน — คงไว้กัน forward compat)
export const ATTACHMENT_CATEGORIES = [
  "REFERENCE_IMAGE",
  "PRINT_FILE",
  "PO_DOCUMENT",
  "PAYMENT_SLIP",
  "PHOTO",
  "OTHER",
] as const;

export type AttachmentCategory = (typeof ATTACHMENT_CATEGORIES)[number];

export const ATTACHMENT_CATEGORY_LABELS: Record<AttachmentCategory, string> = {
  REFERENCE_IMAGE: "รูป/ไฟล์อ้างอิงจากลูกค้า",
  PRINT_FILE: "ไฟล์พิมพ์จริง",
  PO_DOCUMENT: "เอกสาร PO",
  PAYMENT_SLIP: "สลิปโอน",
  PHOTO: "รูปถ่าย",
  OTHER: "อื่นๆ",
};

/** ชั้นของ attachment ตาม category — category อื่น/ไม่ระบุ = ชั้น 1 (ไฟล์ดิบ/เอกสารแนบทั่วไป) */
export function layerForCategory(category: string | null | undefined): FileLayer {
  return category === "PRINT_FILE" ? "PRINT" : "RAW";
}
