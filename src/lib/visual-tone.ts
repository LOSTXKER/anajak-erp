export type VisualTone = "brand" | "production" | "product" | "finance" | "system";

/* ============================================================
   สีประจำหมวด — ที่เดียวของทั้งเว็บ

   `mark` เพิ่มเข้ามา 2026-08-31 หลังเบสดูหน้าลอง /proto/quiet แล้วเคาะ **แบบ B
   "ไม่มีกล่อง"** — คำต่อคำก่อนหน้านั้นคือ "ทั้งเว็บมีสีมันก็ดี แต่ฉันว่ามันดูเด่นไป
   อยากให้คลีนกว่านี้หน่อย"

   เส้นแบ่งที่ใช้ (สำคัญ — อย่ารวมสองอันนี้กลับเป็นค่าเดียว):
     `mark` = ไอคอน **นำหน้าหัวข้อ/ตัวเลข** → เหลือแต่สีไอคอน ไม่มีพื้น
              เพราะมันซ้ำเยอะที่สุด (63 จุด) พอหลายหมวดมาอยู่จอเดียวกันจะกลายเป็น
              แถบสีแย่งสายตากับเนื้อหา
     `soft` = ของที่ **ตัวมันเองคือกล่อง** → ยังมีพื้นสีอ่อนเหมือนเดิม
              (ป้ายประเภทออเดอร์ · ป้ายแท็กลูกค้า · กล่องประวัติลูกค้า 4 ช่อง ·
              ตราลูกค้า/รูปแทนงาน) — ถอดพื้นออกจากพวกนี้แล้วมันจะไม่เหลือรูปร่าง
   ============================================================ */
export const VISUAL_TONE_CLASSES: Record<
  VisualTone,
  { solid: string; soft: string; mark: string; text: string; border: string }
> = {
  brand: {
    solid: "bg-module-brand-solid text-white",
    soft: "bg-module-brand-surface text-module-brand-text",
    mark: "text-module-brand-text",
    text: "text-module-brand-text",
    border: "border-module-brand-border",
  },
  production: {
    solid: "bg-module-production-solid text-white",
    soft: "bg-module-production-surface text-module-production-text",
    mark: "text-module-production-text",
    text: "text-module-production-text",
    border: "border-module-production-border",
  },
  product: {
    solid: "bg-module-product-solid text-white",
    soft: "bg-module-product-surface text-module-product-text",
    mark: "text-module-product-text",
    text: "text-module-product-text",
    border: "border-module-product-border",
  },
  finance: {
    solid: "bg-module-finance-solid text-white",
    soft: "bg-module-finance-surface text-module-finance-text",
    mark: "text-module-finance-text",
    text: "text-module-finance-text",
    border: "border-module-finance-border",
  },
  system: {
    solid: "bg-module-system-solid text-white",
    soft: "bg-module-system-surface text-module-system-text",
    mark: "text-module-system-text",
    text: "text-module-system-text",
    border: "border-module-system-border",
  },
};

export function visualToneForLabel(label?: string | null): VisualTone {
  const text = label ?? "";
  if (/ผลิต|โรงงาน|สถานี|รอบพิมพ์|ฟิล์ม|ร้านนอก|จ้างผลิต|QC|แพ็ก/.test(text)) {
    return "production";
  }
  if (/สินค้า|แพทเทิร์น|บรรจุภัณฑ์|แพ็คเกจ|บริการ|สต๊อก/.test(text)) {
    return "product";
  }
  if (/บิล|การเงิน|ใบวางบิล|ลูกหนี้|หัก ณ ที่จ่าย|ภาษี|VAT|รายงาน|สถิติ|วิเคราะห์/.test(text)) {
    return "finance";
  }
  if (/ตั้งค่า|ระบบ|ผู้ใช้|สิทธิ์|กิจการ|บริษัท|ประวัติ|สำรองข้อมูล|แจ้งเตือน/.test(text)) {
    return "system";
  }
  return "brand";
}

export const NAVIGATION_GROUP_TONE = {
  main: "brand",
  sales: "brand",
  production: "production",
  products: "product",
  finance: "finance",
  system: "system",
} as const satisfies Record<string, VisualTone>;
