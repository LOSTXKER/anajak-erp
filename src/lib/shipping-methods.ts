// วิธีจัดส่ง — แหล่งเดียวทั้งระบบ (ค่า + ป้าย) · ชุดค่าตรง comment ของ
// Delivery.shippingMethod ใน prisma/schema.prisma
// เดิมนิยาม 3 ที่ไม่ตรงกัน: status-config มีคีย์ตาย (SHOPEE_EXPRESS/LAZADA_EXPRESS/
// SELF_DELIVERY ไม่มีฟอร์มไหนเขียนค่านี้) และไม่มี OTHER → เลือก "อื่นๆ" ในฟอร์มแล้ว
// ใบแนบกล่องพิมพ์คำว่า OTHER ดิบถึงมือลูกค้า · ฟอร์มใบส่งของ hardcode <option> เอง ·
// หน้า /status ลูกค้า map เองอีกชุด

export const SHIPPING_METHODS = [
  { value: "KERRY", label: "Kerry Express" },
  { value: "FLASH", label: "Flash Express" },
  { value: "THAILAND_POST", label: "ไปรษณีย์ไทย" },
  { value: "J_AND_T", label: "J&T Express" },
  { value: "GRAB", label: "Grab Express" },
  { value: "LALAMOVE", label: "Lalamove" },
  { value: "SHOPEE_SHIP", label: "Shopee" },
  { value: "LAZADA_SHIP", label: "Lazada" },
  { value: "PICKUP", label: "ลูกค้ารับเอง" },
  { value: "OTHER", label: "อื่นๆ" },
] as const;

export type ShippingMethod = (typeof SHIPPING_METHODS)[number]["value"];

export const SHIPPING_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  SHIPPING_METHODS.map((m) => [m.value, m.label])
);
