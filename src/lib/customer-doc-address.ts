// ที่อยู่ลูกค้าบนเอกสาร (ใบเสนอราคา · ใบแจ้งหนี้/ใบกำกับ/ใบเสร็จ · ใบวางบิล) — สูตรเดียวทั้งระบบ
//
// บั๊กที่ปิดด้วยไฟล์นี้ (เบสสั่ง 2026-08-12): เอกสารทั้ง 3 ใบพิมพ์ `billingAddress || address`
// เป็นสตริงเดียว — **ทิ้ง billingSubDistrict/District/Province/PostalCode ทั้ง 4 ช่อง**
// ลูกค้ากรอกครบ บนจอเห็นครบ (หน้า /customers/[id]) แต่กระดาษที่ส่งลูกค้าพิมพ์แค่บรรทัดแรก
// → ใบกำกับภาษีเต็มรูปต้องมีที่อยู่ผู้ซื้อครบตาม ม.86/4
//
// กติกาที่คงไว้เหมือนเดิม: ไม่มีที่อยู่ออกใบกำกับ → ถอยไปใช้ที่อยู่ผู้ติดต่อ (customer.address)
// ซึ่งเป็นก้อนเดียว ไม่มีช่องย่อย · ตรงกับด่านเตือนใน lib/customer-gaps.ts

export interface CustomerDocAddressSource {
  address?: string | null;
  billingAddress?: string | null;
  billingSubDistrict?: string | null;
  billingDistrict?: string | null;
  billingProvince?: string | null;
  billingPostalCode?: string | null;
}

const text = (v?: string | null) => (v ?? "").trim();

/** ที่อยู่ผู้ซื้อสำหรับพิมพ์ — บรรทัดที่อยู่ + บรรทัดตำบล/อำเภอ/จังหวัด/ไปรษณีย์
 *  คืน null เมื่อไม่มีที่อยู่เลย (PartyBlock จะไม่วาดบรรทัดว่าง) */
export function formatCustomerDocAddress(
  c: CustomerDocAddressSource | null | undefined,
): string | null {
  if (!c) return null;

  const billing = text(c.billingAddress);
  const area = [
    text(c.billingSubDistrict),
    text(c.billingDistrict),
    text(c.billingProvince),
    text(c.billingPostalCode),
  ]
    .filter(Boolean)
    .join(" ");

  // มีช่องย่อยแต่ไม่ได้กรอกบรรทัดแรก ก็ยังต้องพิมพ์ — ข้อมูลที่กรอกไว้ห้ามหายจากกระดาษ
  if (billing || area) {
    return [billing, area].filter(Boolean).join("\n");
  }

  return text(c.address) || null;
}

/** ป้ายสาขาบนเอกสาร — "00000" คือรหัสสำนักงานใหญ่ ไม่ใช่เลขสาขาที่พิมพ์ตรงๆ ได้
 *  (ใบเสนอราคาเคยพิมพ์ว่า "สาขา 00000" ต่างจากใบกำกับ/ใบวางบิลที่แปลงถูกอยู่แล้ว) */
export function formatBranchLabel(
  branchNumber?: string | null,
): string | undefined {
  const branch = text(branchNumber);
  if (!branch) return undefined;
  return branch === "00000" ? "สำนักงานใหญ่" : `สาขา ${branch}`;
}
