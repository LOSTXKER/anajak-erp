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

/* ── ฝั่งอ่าน: สำเนาคู่สัญญาบนเอกสาร (เบสสั่ง 2026-08-12) ────────────────────
   เอกสารที่ออกตั้งแต่ 2026-08-12 พก snapshot ของตัวเอง — พิมพ์ซ้ำกี่ครั้งก็ได้
   ข้อมูลเดิมเป๊ะ · ใบที่ออกก่อนหน้านั้นคอลัมน์ยังว่าง จึงถอยไปอ่านค่าสดจาก
   Customer/Setting เหมือนเดิม (ไม่ backfill โดยตั้งใจ — ที่อยู่ ณ วันนั้นไม่มีใครรู้
   การเดาย้อนหลังด้วยค่าปัจจุบันคือการปลอมสำเนา)
   ────────────────────────────────────────────────────────────────────────── */

export interface DocPartySource {
  buyerName?: string | null;
  buyerCompany?: string | null;
  buyerTaxId?: string | null;
  buyerBranchNumber?: string | null;
  buyerPhone?: string | null;
  buyerAddress?: string | null;
  buyerSubDistrict?: string | null;
  buyerDistrict?: string | null;
  buyerProvince?: string | null;
  buyerPostalCode?: string | null;
}

export interface LiveCustomerSource extends CustomerDocAddressSource {
  name: string;
  company?: string | null;
  taxId?: string | null;
  branchNumber?: string | null;
  phone?: string | null;
}

export interface DocBuyerBlock {
  name: string;
  company: string | null;
  address: string | null;
  taxId: string | null;
  branch: string | undefined;
  phone: string | null;
}

/** บล็อกผู้ซื้อสำหรับ PartyBlock — snapshot ก่อน ไม่มีค่อยใช้ค่าสด
 *  เกณฑ์ "มี snapshot" = มี buyerName (เขียนพร้อมกันทั้งชุดที่จุดสร้างเอกสารเสมอ)
 *  — ห้ามผสมทีละช่อง เพราะจะได้ชื่อจากใบเก่าปนที่อยู่ปัจจุบัน = สำเนาที่ไม่เคยมีอยู่จริง */
export function resolveDocBuyer(
  doc: DocPartySource,
  live: LiveCustomerSource,
): DocBuyerBlock {
  const hasSnapshot = Boolean(text(doc.buyerName));
  if (!hasSnapshot) {
    return {
      name: live.name,
      company: live.company ?? null,
      address: formatCustomerDocAddress(live),
      taxId: live.taxId ?? null,
      branch: formatBranchLabel(live.branchNumber),
      phone: live.phone ?? null,
    };
  }

  const area = [
    text(doc.buyerSubDistrict),
    text(doc.buyerDistrict),
    text(doc.buyerProvince),
    text(doc.buyerPostalCode),
  ]
    .filter(Boolean)
    .join(" ");

  return {
    name: text(doc.buyerName),
    company: text(doc.buyerCompany) || null,
    address: [text(doc.buyerAddress), area].filter(Boolean).join("\n") || null,
    taxId: text(doc.buyerTaxId) || null,
    branch: formatBranchLabel(doc.buyerBranchNumber),
    phone: text(doc.buyerPhone) || null,
  };
}

export interface DocSellerSource {
  sellerName?: string | null;
  sellerAddress?: string | null;
  sellerTaxId?: string | null;
  sellerBranch?: string | null;
  sellerPhone?: string | null;
  sellerEmail?: string | null;
}

export interface CompanyProfileShape {
  name: string;
  address: string;
  taxId: string;
  branch: string;
  phone: string;
  email: string;
}

/** หัวกระดาษฝั่งเรา — snapshot ก่อน ไม่มีค่อยใช้ค่าปัจจุบันจาก Settings
 *  (ย้ายออฟฟิศแล้วใบเก่าต้องยังพิมพ์ที่อยู่เดิม — สำเนาต้องตรงต้นฉบับที่ลูกค้าถือ) */
export function resolveDocSeller(
  doc: DocSellerSource,
  live: CompanyProfileShape,
): CompanyProfileShape {
  if (!text(doc.sellerName)) return live;
  return {
    name: text(doc.sellerName),
    address: text(doc.sellerAddress),
    taxId: text(doc.sellerTaxId),
    branch: text(doc.sellerBranch),
    phone: text(doc.sellerPhone),
    email: text(doc.sellerEmail),
  };
}
