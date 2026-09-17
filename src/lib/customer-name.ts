/**
 * ชื่อที่ใช้เรียกลูกค้าหนึ่งราย — ที่เดียวของทั้งเว็บ
 *
 * นิติบุคคลไม่ต้องกรอกชื่อผู้ติดต่อก็ได้ (เบสสั่ง 2026-09-18) ฐานบังคับให้ฟิลด์ name
 * มีค่าเสมอ จึงเก็บเป็นค่าว่างแทน — ทุกจุดที่แสดงชื่อจึงต้องถอยไปใช้ชื่อบริษัท
 * ไม่งั้นจอผลิต/แจ้งเตือน/ผลค้นหา จะขึ้นช่องว่างให้คนอ่าน
 *
 * เดิม `company || name` ถูกเขียนซ้ำ 7 จุดฝั่ง server และอีกหลายจุดฝั่งจอ
 * ส่วนบางจุดใช้ name เดี่ยว ๆ ซึ่งจะว่างทันทีที่ลูกค้าไม่มีชื่อผู้ติดต่อ
 */

export interface CustomerNameLike {
  name?: string | null;
  company?: string | null;
}

/** ชื่อหลักที่คนอ่าน: บริษัทมาก่อน ไม่มีบริษัทค่อยใช้ชื่อคน */
export function customerDisplayName(customer: CustomerNameLike | null | undefined): string {
  return customer?.company?.trim() || customer?.name?.trim() || "";
}

/** เหมือน customerDisplayName แต่การันตีว่ามีอะไรให้แสดงเสมอ (ตาราง/การ์ดที่ช่องว่างอ่านเป็นข้อมูลหาย) */
export function customerDisplayNameOrDash(customer: CustomerNameLike | null | undefined): string {
  return customerDisplayName(customer) || "—";
}

/** ชื่อผู้ติดต่อที่ควรขึ้นเป็นบรรทัดรอง — ไม่มี หรือซ้ำกับชื่อหลัก = ไม่ต้องขึ้น */
export function customerContactName(customer: CustomerNameLike | null | undefined): string | null {
  const name = customer?.name?.trim() || "";
  const company = customer?.company?.trim() || "";
  if (!name || !company || name === company) return null;
  return name;
}
