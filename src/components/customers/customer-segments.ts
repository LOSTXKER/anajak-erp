/* กลุ่มลูกค้า — คำและลำดับชุดเดียวของทั้งโมดูล

   เดิมชื่อกลุ่มถูกประกาศในหน้ารายชื่อไฟล์เดียว หน้ารายละเอียดจึงไม่มีคำนี้ใช้เลย
   (บรรทัดรองใต้ชื่อลูกค้าตามต้นแบบต้องขึ้นต้นด้วยกลุ่ม) — ยกมาไว้ที่เดียวกันทั้งสองหน้า

   ลำดับยึดต้นแบบที่เบสเคาะ 2026-09-16: VIP · ขาประจำ · ค้าส่ง · ใหม่ · ไม่เคลื่อนไหว
   "ค้าปลีก" ต่อท้าย — ต้นแบบไม่มีกลุ่มนี้ แต่ของจริงมีในฐานข้อมูล ห้ามตัดทิ้ง

   กลุ่มลูกค้าไม่ใช่ "สถานะ" — ไม่มีอันไหนดีหรือร้าย (UI-2026 เฟส 3) จึงไม่ย้อมสี
   ความต่างอ่านจากคำ ไม่ใช่จากสี (ต้นแบบย้อม VIP น้ำเงิน/ไม่เคลื่อนไหวเทา — รอเบสเคาะ) */
export const CUSTOMER_SEGMENT_LABELS: Record<string, string> = {
  VIP: "VIP",
  REGULAR: "ขาประจำ",
  WHOLESALE: "ค้าส่ง",
  NEW: "ใหม่",
  INACTIVE: "ไม่เคลื่อนไหว",
  RETAIL: "ค้าปลีก",
};

/** ลำดับปุ่มกรองตามต้นแบบ (ค้าปลีกต่อท้ายเพราะต้นแบบไม่มี) */
export const CUSTOMER_SEGMENT_ORDER = [
  "VIP",
  "REGULAR",
  "WHOLESALE",
  "NEW",
  "INACTIVE",
  "RETAIL",
] as const;

export function customerSegmentLabel(segment: string | null | undefined): string {
  if (!segment) return "";
  return CUSTOMER_SEGMENT_LABELS[segment] ?? segment;
}

/** ตัวอักษรแรกของตราลูกค้า — ตัดคำนำหน้าที่ไม่ได้แยกความต่าง (ต้นแบบตัดชุดเดียวกัน) */
export function customerInitial(label: string): string {
  const trimmed = label
    .trim()
    .replace(/^(บริษัท|ห้างหุ้นส่วนจำกัด|หจก\.?|ร้าน|ทีม|ชมรม|โรงเรียน)\s*/u, "")
    .trim();
  return Array.from(trimmed || label.trim())[0] ?? "?";
}
