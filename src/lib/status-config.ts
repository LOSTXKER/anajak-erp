type BadgeVariant = "default" | "success" | "warning" | "destructive" | "secondary" | "purple";

interface StatusConfig {
  label: string;
  variant: BadgeVariant;
}

function buildConfig<T extends string>(
  entries: Record<T, StatusConfig>
): { labels: Record<T, string>; variants: Record<T, BadgeVariant> } {
  const labels = {} as Record<T, string>;
  const variants = {} as Record<T, BadgeVariant>;
  for (const key of Object.keys(entries) as T[]) {
    labels[key] = entries[key].label;
    variants[key] = entries[key].variant;
  }
  return { labels, variants };
}

// Payment status (used in billing section)
const _paymentStatus = buildConfig({
  UNPAID: { label: "ยังไม่ชำระ", variant: "default" },
  PARTIALLY_PAID: { label: "ชำระบางส่วน", variant: "warning" },
  PAID: { label: "ชำระแล้ว", variant: "success" },
  OVERDUE: { label: "เกินกำหนด", variant: "destructive" },
  VOIDED: { label: "ยกเลิก", variant: "secondary" },
});
export const PAYMENT_STATUS_LABELS = _paymentStatus.labels;
export const PAYMENT_STATUS_VARIANTS = _paymentStatus.variants;

// Delivery status
const _deliveryStatus = buildConfig({
  PENDING: { label: "รอดำเนินการ", variant: "secondary" },
  PREPARING: { label: "กำลังเตรียม", variant: "default" },
  SHIPPED: { label: "จัดส่งแล้ว", variant: "purple" },
  DELIVERED: { label: "ส่งถึงแล้ว", variant: "success" },
  RETURNED: { label: "ตีกลับ", variant: "destructive" },
});
export const DELIVERY_STATUS_LABELS = _deliveryStatus.labels;
export const DELIVERY_STATUS_VARIANTS = _deliveryStatus.variants;

// Production step status
const _stepStatus = buildConfig({
  PENDING: { label: "รอดำเนินการ", variant: "secondary" },
  IN_PROGRESS: { label: "กำลังทำ", variant: "default" },
  COMPLETED: { label: "เสร็จแล้ว", variant: "success" },
  ON_HOLD: { label: "พักไว้", variant: "warning" },
  FAILED: { label: "มีปัญหา", variant: "destructive" },
});
export const STEP_STATUS_LABELS = _stepStatus.labels;
export const STEP_STATUS_VARIANTS = _stepStatus.variants;

// Design approval status
const _approvalStatus = buildConfig({
  PENDING: { label: "รอตรวจสอบ", variant: "default" },
  APPROVED: { label: "อนุมัติแล้ว", variant: "success" },
  REVISION_REQUESTED: { label: "ขอแก้ไข", variant: "warning" },
  REJECTED: { label: "ปฏิเสธ", variant: "destructive" },
});
export const APPROVAL_STATUS_LABELS = _approvalStatus.labels;
export const APPROVAL_STATUS_VARIANTS = _approvalStatus.variants;

// Quotation status
const _quotationStatus = buildConfig({
  DRAFT: { label: "ฉบับร่าง", variant: "secondary" },
  SENT: { label: "ส่งแล้ว", variant: "default" },
  ACCEPTED: { label: "อนุมัติ", variant: "success" },
  REJECTED: { label: "ปฏิเสธ", variant: "destructive" },
  EXPIRED: { label: "หมดอายุ", variant: "warning" },
  CONVERTED: { label: "แปลงเป็นออเดอร์", variant: "purple" },
});
export const QUOTATION_STATUS_LABELS = _quotationStatus.labels;
export const QUOTATION_STATUS_VARIANTS = _quotationStatus.variants;

// Payment method labels
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "เงินสด",
  BANK_TRANSFER: "โอนเงิน",
  CREDIT_CARD: "บัตรเครดิต",
  QR_CODE: "QR Code / พร้อมเพย์",
  CHECK: "เช็ค",
  COD: "เก็บเงินปลายทาง",
};

// Shipping method labels
export const SHIPPING_METHOD_LABELS: Record<string, string> = {
  KERRY: "Kerry Express",
  FLASH: "Flash Express",
  THAILAND_POST: "ไปรษณีย์ไทย",
  J_AND_T: "J&T Express",
  SHOPEE_EXPRESS: "Shopee Express",
  LAZADA_EXPRESS: "Lazada Express",
  GRAB: "Grab Express",
  LALAMOVE: "Lalamove",
  SELF_DELIVERY: "จัดส่งเอง",
  PICKUP: "ลูกค้ารับเอง",
};
