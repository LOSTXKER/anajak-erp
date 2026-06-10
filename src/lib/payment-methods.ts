// ช่องทางชำระเงิน — แหล่งเดียวทั้งระบบ (ค่า + ป้าย)
// เดิม dropdown ส่ง TRANSFER/PROMPTPAY แต่ตารางป้ายใช้ BANK_TRANSFER/QR_CODE
// → payment ที่บันทึกแล้วแสดงเป็นรหัสดิบ · DB ล้างตอน P0.3 แล้วจึงตั้งค่ามาตรฐานใหม่ได้เลย

export const PAYMENT_METHODS = [
  { value: "BANK_TRANSFER", label: "โอนเงิน" },
  { value: "CASH", label: "เงินสด" },
  { value: "QR_CODE", label: "QR Code / พร้อมเพย์" },
  { value: "CREDIT_CARD", label: "บัตรเครดิต" },
  { value: "CHECK", label: "เช็ค" },
  { value: "COD", label: "เก็บเงินปลายทาง" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export const PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label])
);

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = "BANK_TRANSFER";
