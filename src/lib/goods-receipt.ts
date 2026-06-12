// ชนิดใบตรวจรับของเข้า/ใบคืน — ค่า + ป้าย ใช้ร่วม server (services/goods-receipt) และ UI
// (อยู่ lib เพราะ client component ห้าม import services — ลาก server code เข้า bundle)

export const RECEIPT_TYPES = [
  "CUSTOMER_GARMENT",
  "SEWING_GARMENT",
  "OUTSOURCE_RETURN",
  "CUSTOMER_RETURN",
] as const;
export type ReceiptType = (typeof RECEIPT_TYPES)[number];

export const RECEIPT_TYPE_LABELS: Record<ReceiptType, string> = {
  CUSTOMER_GARMENT: "รับเสื้อลูกค้า",
  SEWING_GARMENT: "รับเสื้อโรงเย็บ",
  OUTSOURCE_RETURN: "รับกลับร้านนอก",
  CUSTOMER_RETURN: "คืนของลูกค้า",
};
