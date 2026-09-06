/**
 * ข้อมูลปลอมของหน้าลอง "สินค้าในชุดงาน (ฟอร์ม)" — โครงเดียวกับ OrderItemProductForm ตัวจริง
 * ไม่ยิงฐานข้อมูล · ชื่อ/ราคา/ไซส์ยกจากใบจริงที่เบสส่งรูปมา (2026-09-06) + เคสยากที่เจอจริง
 */
import { EMPTY_PRODUCT, type OrderItemProductForm } from "@/types/order-form";

export type DemoCase = "simple" | "complex";

export const PACKAGING = [
  { id: "pack-opp-s", name: "ถุง OPP เล็ก" },
  { id: "pack-opp-l", name: "ถุง OPP ใหญ่ + กระดาษรอง" },
  { id: "pack-box", name: "กล่องลูกฟูก" },
];

export const PATTERNS = [
  { id: "pat-polo-std", name: "โปโลมาตรฐาน", description: "คอโปโล แขนสั้น Regular" },
  { id: "pat-tee-oversize", name: "เสื้อยืดโอเวอร์ไซส์", description: "คอกลม แขนสั้น Relaxed" },
];

const IMG_TEE = "/demo-mockups/front.svg";

function product(partial: Partial<OrderItemProductForm>): OrderItemProductForm {
  return { ...EMPTY_PRODUCT, ...partial };
}

/** ใบในรูปของเบส: เสื้อลูกค้าส่งมา 1 รายการ 4 ไซส์ ชื่อ "dfdf" (พิมพ์ทดสอบ) */
const SIMPLE: OrderItemProductForm[] = [
  product({
    formKey: "p-customer-1",
    itemSource: "CUSTOMER_PROVIDED",
    productType: "T_SHIRT",
    description: "dfdf",
    packagingOptionId: "",
    baseUnitPrice: 0,
    discount: 0,
    variants: [
      { size: "S", color: "ดำ", quantity: 1 },
      { size: "M", color: "ดำ", quantity: 1 },
      { size: "L", color: "ดำ", quantity: 1 },
      { size: "XL", color: "ดำ", quantity: 2 },
    ],
  }),
];

/** เคสยาก: สต๊อก + ตัดเย็บใหม่ 5 ไซส์มีสเปคครบ + ลูกค้าส่งมา — อยู่ในชุดงานเดียวกัน */
const COMPLEX: OrderItemProductForm[] = [
  product({
    formKey: "p-stock-1",
    itemSource: "FROM_STOCK",
    productId: "prod-tee",
    productType: "T_SHIRT",
    productName: "เสื้อยืด Heavy Cotton · สต๊อกทดสอบ",
    productSku: "DEMO-TEE-SHORT",
    productImageUrl: IMG_TEE,
    stockAvailable: 148,
    description: "",
    packagingOptionId: "pack-opp-s",
    baseUnitPrice: 105,
    discount: 0,
    variants: [{ size: "M", color: "ครีม", quantity: 20 }],
  }),
  product({
    formKey: "p-custom-1",
    itemSource: "CUSTOM_MADE",
    productType: "POLO",
    description: "เสื้อโปโลคอปกสีกรมท่า ผ้า TC ปกและปลายแขนแถบขาว ปักโลโก้อกซ้าย สกรีน DTF หลังเต็มแผ่น",
    packagingOptionId: "pack-opp-l",
    baseUnitPrice: 189,
    discount: 10,
    patternId: "pat-polo-std",
    fabricType: "TC",
    material: "TC",
    fabricWeight: "220 แกรม",
    fabricColor: "กรมท่า",
    collarType: "POLO",
    sleeveType: "SHORT",
    bodyFit: "REGULAR",
    patternNote: "ขลิบปก/ปลายแขนสีขาว 1 ซม. กระเป๋าอกซ้ายไม่มี",
    variants: [
      { size: "S", color: "กรมท่า", quantity: 10 },
      { size: "M", color: "กรมท่า", quantity: 25 },
      { size: "L", color: "กรมท่า", quantity: 30 },
      { size: "XL", color: "กรมท่า", quantity: 20 },
      { size: "2XL", color: "กรมท่า", quantity: 5 },
    ],
  }),
  product({
    formKey: "p-customer-2",
    itemSource: "CUSTOMER_PROVIDED",
    productType: "T_SHIRT",
    description: "เสื้อยืดคอกลมสีดำ (ลูกค้าส่งมา 2 ลัง)",
    packagingOptionId: "",
    baseUnitPrice: 0,
    discount: 0,
    variants: [
      { size: "M", color: "ดำ", quantity: 15 },
      { size: "L", color: "ดำ", quantity: 15 },
      { size: "XL", color: "ดำ", quantity: 10 },
    ],
  }),
];

export function demoProducts(demo: DemoCase): OrderItemProductForm[] {
  // clone ลึกพอสำหรับ state ของหน้าลอง (variants เป็น array ของ object แบน)
  const src = demo === "simple" ? SIMPLE : COMPLEX;
  return src.map((p) => ({ ...p, variants: p.variants.map((v) => ({ ...v })) }));
}
