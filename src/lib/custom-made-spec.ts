import { BODY_FITS, COLLAR_TYPES, FABRIC_TYPES, PRODUCT_TYPES, SLEEVE_TYPES } from "@/types/order-form";

/**
 * สรุปสเปคตัดเย็บของสินค้าหนึ่งรายการเป็น "ป้าย + ค่า" (เบสเคาะ D 2026-09-06: ฟอร์มโชว์สรุป · แก้ใน popup
 * แล้วทักว่าชิปค่าโดดๆ "ดูไม่รู้เรื่อง" → ต้องมีป้ายบอกว่าอะไรคืออะไร)
 * ประเภทสินค้ามีค่าตั้งต้นเสมอ จึงไม่นับเป็น "ระบุสเปคแล้ว" — นับจากช่องตัดเย็บจริงเท่านั้น
 */
export interface CustomMadeSpecInput {
  productType: string;
  patternId?: string;
  fabricType: string;
  material: string;
  fabricWeight: string;
  fabricColor: string;
  collarType: string;
  sleeveType: string;
  bodyFit: string;
  patternNote: string;
}

export interface SpecFact {
  label: string;
  value: string;
  /** ข้อความยาว (หมายเหตุ) กินเต็มแถว */
  wide?: boolean;
}

export function hasCustomMadeSpec(p: CustomMadeSpecInput): boolean {
  return Boolean(
    p.patternId || p.fabricType || p.material.trim() || p.fabricWeight.trim() || p.fabricColor.trim() ||
      p.collarType || p.sleeveType || p.bodyFit,
  );
}

/** ป้าย+ค่าเฉพาะช่องที่กรอกแล้ว เรียงตามลำดับที่ช่างอ่าน: แบบ → ผ้า → ทรง → หมายเหตุ */
export function customMadeSpecFacts(p: CustomMadeSpecInput, patternName?: string | null): SpecFact[] {
  const fabric = [FABRIC_TYPES[p.fabricType] ?? (p.fabricType || ""), p.material.trim(), p.fabricWeight.trim()]
    .filter(Boolean)
    .join(" ");
  const facts: Array<SpecFact | null> = [
    { label: "ประเภท", value: PRODUCT_TYPES[p.productType] ?? p.productType },
    patternName ? { label: "แพทเทิร์น", value: patternName } : null,
    fabric ? { label: "ผ้า", value: fabric } : null,
    p.fabricColor.trim() ? { label: "สีผ้า", value: p.fabricColor.trim() } : null,
    p.collarType ? { label: "คอ", value: COLLAR_TYPES[p.collarType] ?? p.collarType } : null,
    p.sleeveType ? { label: "แขน", value: SLEEVE_TYPES[p.sleeveType] ?? p.sleeveType } : null,
    p.bodyFit ? { label: "ทรง", value: BODY_FITS[p.bodyFit] ?? p.bodyFit } : null,
    p.patternNote.trim() ? { label: "หมายเหตุแพทเทิร์น", value: p.patternNote.trim(), wide: true } : null,
  ];
  return facts.filter((f): f is SpecFact => f !== null);
}
