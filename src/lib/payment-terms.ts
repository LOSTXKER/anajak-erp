// เงื่อนไขการชำระเงิน — แหล่งเดียวทั้งระบบ (ค่า + ป้าย + ความหมายเชิงเงิน)
// เดิมเป็นแค่ป้ายใน order-status.ts และฟอร์มลูกค้า hardcode คนละชุด — ย้ายมารวมที่นี่
// depositPercent = % มัดจำก่อนเริ่มงาน · creditDays = จำนวนวันเครดิตนับจากวันออกบิล
// หมายเหตุ: COD ที่นี่คือ "เงื่อนไข" (จ่ายตอนรับของ) — คนละ concept กับ payment method COD

export type PaymentTermsKind = "cod" | "prepay" | "deposit" | "credit";

export const PAYMENT_TERMS = [
  { value: "COD", label: "เก็บเงินปลายทาง (COD)", kind: "cod" },
  { value: "FULL_PREPAY", label: "ชำระเต็มจำนวนล่วงหน้า", kind: "prepay" },
  { value: "DEPOSIT_30", label: "มัดจำ 30%", kind: "deposit", depositPercent: 30 },
  { value: "DEPOSIT_50", label: "มัดจำ 50%", kind: "deposit", depositPercent: 50 },
  { value: "NET_7", label: "เครดิต 7 วัน", kind: "credit", creditDays: 7 },
  { value: "NET_15", label: "เครดิต 15 วัน", kind: "credit", creditDays: 15 },
  { value: "NET_30", label: "เครดิต 30 วัน", kind: "credit", creditDays: 30 },
  { value: "NET_60", label: "เครดิต 60 วัน", kind: "credit", creditDays: 60 },
] as const;

export type PaymentTermsDef = (typeof PAYMENT_TERMS)[number];
export type PaymentTermsValue = PaymentTermsDef["value"];

// สำหรับ z.enum ฝั่ง server (order/customer routers)
export const PAYMENT_TERMS_VALUES = PAYMENT_TERMS.map((t) => t.value) as [
  PaymentTermsValue,
  ...PaymentTermsValue[],
];

export const PAYMENT_TERMS_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_TERMS.map((t) => [t.value, t.label])
);

// ค่าใน DB เป็น String? ไม่เคยถูก validate มาก่อน — ตัวอ่านต้องทน null/ค่าแปลกปลอม
export function getPaymentTerms(value: string | null | undefined): PaymentTermsDef | null {
  if (!value) return null;
  return PAYMENT_TERMS.find((t) => t.value === value) ?? null;
}

// ยอดที่ต้องชำระ "ก่อนเริ่มงาน" ตามเทอม — แหล่งเดียวทั้งระบบ (production-readiness + sweep จองค้างใช้ร่วม)
// จ่ายเต็มล่วงหน้า = เต็มจำนวน · มัดจำ = % ของยอด · เครดิต/COD/ไม่ระบุ = 0 (ไม่ต้องรับเงินก่อน)
export function requiredUpfrontAmount(
  termsValue: string | null | undefined,
  total: number
): number {
  const terms = getPaymentTerms(termsValue);
  if (terms?.kind === "prepay") return total;
  if (terms?.kind === "deposit") return (total * (terms.depositPercent ?? 0)) / 100;
  return 0;
}
