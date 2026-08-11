// โปรไฟล์ลูกค้าโตตามงาน — ตัวบอกว่ายังขาดข้อมูลอะไร ใช้ทั้งตอนเลือกลูกค้า/หน้าลูกค้า/ก่อนออกเอกสาร
// (ลูกค้าแชทเริ่มจากชื่ออย่างเดียวได้ — ป้ายนี้ช่วยให้แอดมินรู้ว่าต้องขออะไรเพิ่มตอนคุย)

export interface CustomerGapInput {
  phone?: string | null;
  lineId?: string | null;
  address?: string | null;
  customerType?: string | null;
  taxId?: string | null;
  billingAddress?: string | null;
}

export interface CustomerGap {
  key: "contact" | "address" | "taxInfo";
  label: string;
}

export function customerProfileGaps(c: CustomerGapInput): CustomerGap[] {
  const gaps: CustomerGap[] = [];
  if (!c.phone && !c.lineId) {
    gaps.push({ key: "contact", label: "ขาดช่องทางติดต่อ (เบอร์/LINE)" });
  }
  if (!c.address) {
    gaps.push({ key: "address", label: "ขาดที่อยู่ผู้ติดต่อ" });
  }
  // ข้อมูลใบกำกับภาษี: นิติบุคคลต้องมีเลขภาษี+ที่อยู่ออกบิล · บุคคลธรรมดาไม่บังคับ
  // ยอมรับที่อยู่ผู้ติดต่อแทนได้ เพราะหน้าพิมพ์ fallback ทางเดียวกัน (billingAddress || address)
  if (c.customerType === "CORPORATE" && (!c.taxId || !(c.billingAddress || c.address))) {
    gaps.push({
      key: "taxInfo",
      label: "ขาดข้อมูลใบกำกับภาษี (เลขภาษี/ที่อยู่ออกใบกำกับภาษี)",
    });
  }
  return gaps;
}
