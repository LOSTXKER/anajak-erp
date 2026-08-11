// ก๊อปที่อยู่ข้ามฟอร์ม — "ใช้ที่อยู่ลูกค้า" / "ใช้ที่อยู่จัดส่งของงานนี้" (เบสสั่ง 2026-08-12)
//
// ที่อยู่ในระบบมี 3 ชนิด อยู่คนละที่และมีโครงไม่เท่ากัน:
//   ที่อยู่ผู้ติดต่อ      Customer.address        ก้อนเดียว (ไม่มีตำบล/อำเภอ/จังหวัด/ไปรษณีย์แยก)
//   ที่อยู่ออกใบกำกับภาษี  Customer.billing*       5 ช่อง — ไม่ใช่ที่อยู่ส่งของ ห้ามเอามาก๊อปลงช่องจัดส่ง
//   ที่อยู่จัดส่ง         Order.shipping*         7 ช่อง (มีชื่อผู้รับ+เบอร์) · ของใบงานนั้นใบเดียว
//
// ไฟล์นี้เป็น pure ทั้งหมด (เทสได้ ไม่ต้อง render) — ตัวปุ่มอยู่ที่ฟอร์มแต่ละใบ

export interface AddressFill {
  recipientName: string;
  phone: string;
  address: string;
  subDistrict: string;
  district: string;
  province: string;
  postalCode: string;
}

export const EMPTY_ADDRESS_FILL: AddressFill = {
  recipientName: "",
  phone: "",
  address: "",
  subDistrict: "",
  district: "",
  province: "",
  postalCode: "",
};

export interface CustomerAddressSource {
  name?: string | null;
  company?: string | null;
  phone?: string | null;
  /** ที่อยู่ผู้ติดต่อ — ก้อนเดียว */
  address?: string | null;
}

export interface OrderShippingSource {
  shippingRecipientName?: string | null;
  shippingPhone?: string | null;
  shippingAddress?: string | null;
  shippingSubDistrict?: string | null;
  shippingDistrict?: string | null;
  shippingProvince?: string | null;
  shippingPostalCode?: string | null;
}

const text = (v?: string | null) => (v ?? "").trim();

/** ที่อยู่ผู้ติดต่อของลูกค้า → ชุดช่องที่อยู่จัดส่ง
 *  โปรไฟล์เก็บที่อยู่เป็นก้อนเดียว จึงลงได้แค่ช่อง "ที่อยู่" — อีก 4 ช่องปล่อยว่างให้คนเติมเอง
 *  (ห้ามเดาแยกตำบล/อำเภอจากข้อความ: เดาผิดแล้วไปโผล่บนใบส่งของและใบกำกับ) */
export function fillFromCustomer(c: CustomerAddressSource | null | undefined): AddressFill {
  if (!c) return EMPTY_ADDRESS_FILL;
  return {
    ...EMPTY_ADDRESS_FILL,
    recipientName: text(c.company) || text(c.name),
    phone: text(c.phone),
    address: text(c.address),
  };
}

/** ที่อยู่จัดส่งที่กรอกไว้บนใบงาน → ชุดช่องที่อยู่ (ใช้ตอนสร้างใบส่งของ) */
export function fillFromOrderShipping(
  o: OrderShippingSource | null | undefined,
): AddressFill {
  if (!o) return EMPTY_ADDRESS_FILL;
  return {
    recipientName: text(o.shippingRecipientName),
    phone: text(o.shippingPhone),
    address: text(o.shippingAddress),
    subDistrict: text(o.shippingSubDistrict),
    district: text(o.shippingDistrict),
    province: text(o.shippingProvince),
    postalCode: text(o.shippingPostalCode),
  };
}

/** มีที่อยู่พอให้ก๊อปไหม — ชื่อผู้รับ/เบอร์อย่างเดียวไม่นับ (ปุ่มก๊อปที่อยู่ต้องได้ที่อยู่จริง) */
export function hasAddressContent(fill: AddressFill): boolean {
  return Boolean(
    fill.address ||
      fill.subDistrict ||
      fill.district ||
      fill.province ||
      fill.postalCode,
  );
}

/** ที่อยู่ที่ค้างอยู่ในฟอร์มยังใช้กับลูกค้ารายใหม่ได้หรือไม่ — ใช้ตอนสลับลูกค้าในหน้าเปิดงาน
 *
 *  เดิมหน้าเปิดงาน prefill ที่อยู่ลูกค้าให้เงียบๆ ทุกครั้งที่เลือกลูกค้า แต่ **ไม่เปิดสวิตช์
 *  "จัดส่งตามที่อยู่"** → ช่องดูเหมือนกรอกแล้วแต่จาง และตอนกดเปิดงานที่อยู่ถูกทิ้งทั้งชุด
 *  ไม่มีคำเตือน (บั๊กที่เบสสั่งเก็บ 2026-08-12) · ตอนนี้เติมเมื่อคนกดปุ่มเท่านั้น
 *
 *  แต่ต้องคงกันพลาดเดิมไว้: ที่อยู่ที่ก๊อปมาจากลูกค้า A ห้ามค้างอยู่เมื่อสลับไปลูกค้า B
 *  ส่วนที่อยู่ที่ "พิมพ์เอง" (เช่นที่อยู่ไซต์งาน) ต้องรักษาไว้แม้เปลี่ยนลูกค้าวางบิล */
export function shouldClearShippingOnCustomerChange(
  filledFromCustomerId: string | null,
  nextCustomerId: string | null,
): boolean {
  if (!filledFromCustomerId) return false;
  return filledFromCustomerId !== nextCustomerId;
}
