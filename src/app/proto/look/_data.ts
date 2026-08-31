/**
 * ข้อมูลตัวอย่างของหน้าลอง /proto/look — ปลอมทั้งหมด ไม่ยิงฐานข้อมูล
 *
 * เคสลูกค้าสองใบตั้งใจเลือกให้ตรงกับสิ่งที่เบสถ่ายมาให้ดู 2026-08-31:
 *   · `PLAIN` = ใบที่เบสถ่าย — ยอดซื้อสะสม ฿0 แต่สั่งมาแล้ว 6 ครั้ง (เกิดจริงเมื่อยัง
 *     ไม่เคยวางบิลปิดสักใบ) · ไม่มีบริษัท ไม่มีเลขภาษี ไม่มีวงเงิน
 *     → เป็นด่านของทุกแบบ: ช่องตัวเลขสวย ๆ จะดูโล่งหรือดูพังตอนค่าเป็นศูนย์ไหม
 *   · `LOYAL` = ลูกค้าประจำข้อมูลครบ ยอดหลักล้าน มีวงเงิน มีป้ายกำกับ 4 ป้าย
 *
 * ตัวเลข "ใช้วงเงินไปเท่าไร" มีจริงในระบบ (customer.creditStatus → exposure /
 * creditLimit − exposure) แต่หน้าใบงานวันนี้ยังไม่ได้ยิงมาใช้ — ใครเลือกแบบที่โชว์
 * แถบวงเงิน ต้องรู้ว่าต้องขอข้อมูลเพิ่มหนึ่งก้อน ไม่ใช่ของฟรี
 */

export type LookCustomer = {
  name: string;
  company: string | null;
  type: "นิติบุคคล" | "บุคคลธรรมดา";
  totalSpent: number;
  totalOrders: number;
  /** ป้ายวันที่ตายตัว — หน้าลองห้ามเรียก Date.now() (SSR/CSR จะได้คนละค่า) */
  lastOrderLabel: string | null;
  creditLimit: number | null;
  /** ภาระหนี้ที่ใช้วงเงินไปแล้ว — null เมื่อยังไม่ตั้งวงเงิน */
  creditUsed: number | null;
  taxId: string | null;
  branchLabel: string | null;
  phone: string | null;
  lineId: string | null;
  paymentTerms: string;
  tags: string[];
};

/** ลูกค้าประจำ ข้อมูลครบ — ยกมาจากใบตัวอย่างเดียวกับ /proto/order-detail */
export const LOYAL: LookCustomer = {
  name: "คุณพิมพ์ชนก เรืองวัฒนกิจ",
  company: "บริษัท บางกอกเมดิคอลซัพพลายแอนด์เซอร์วิส จำกัด (สำนักงานใหญ่)",
  type: "นิติบุคคล",
  totalSpent: 1_284_500,
  totalOrders: 27,
  lastOrderLabel: "2 ก.ค. 2569",
  creditLimit: 300_000,
  creditUsed: 184_500,
  taxId: "0105558123456",
  branchLabel: "สำนักงานใหญ่",
  phone: "02-116-4820 ต่อ 118",
  lineId: "@bkkmed-purchase",
  paymentTerms: "มัดจำ 50%",
  tags: ["ลูกค้าประจำ", "เครดิต 30 วัน", "ต้องมี PO", "ออกใบกำกับเต็มรูป"],
};

/** ใบที่เบสถ่ายมา — ยอด ฿0 · 6 ครั้ง · ไม่มีอะไรให้โชว์เลยนอกจากชื่อ */
export const PLAIN: LookCustomer = {
  name: "Best",
  company: null,
  type: "บุคคลธรรมดา",
  totalSpent: 0,
  totalOrders: 6,
  lastOrderLabel: "12 ส.ค. 2569",
  creditLimit: null,
  creditUsed: null,
  taxId: null,
  branchLabel: null,
  phone: "089-441-2270",
  lineId: null,
  paymentTerms: "โอนก่อนส่ง",
  tags: [],
};

export function lookCustomer(plain: boolean): LookCustomer {
  return plain ? PLAIN : LOYAL;
}

/* ─────────────────────── ② แถวตัวเลขสรุปหน้าแรก ─────────────────────── */

export type LookStat = {
  key: string;
  label: string;
  value: string;
  caption: string;
  /** ความหมายของตัวเลข — ใช้เลือกสีในแบบที่ใส่สี */
  kind: "production" | "ship" | "finance" | "late";
  danger?: boolean;
};

export const STATS: LookStat[] = [
  { key: "wip", label: "งานอยู่ในโรงงาน", value: "12", caption: "ใบงาน", kind: "production" },
  { key: "ship", label: "ต้องส่งใน 3 วัน", value: "5", caption: "ใบงาน", kind: "ship" },
  { key: "ar", label: "ค้างชำระเกินกำหนด", value: "฿284,300", caption: "6 ใบวางบิล", kind: "finance", danger: true },
  { key: "late", label: "เลยกำหนดส่งแล้ว", value: "3", caption: "ใบงาน", kind: "late", danger: true },
];
