/**
 * ข้อมูลตัวอย่างของ "แท็บรายการ" ในหน้าออเดอร์ สำหรับหน้าลอง /proto/order-items
 *
 * ปลอมทั้งหมด ไม่ยิงฐานข้อมูล — แต่ต้องครบทุกช่องที่ `OrderItemsDisplay` (ของจริง) อ่าน
 * ไม่งั้นหน้าลองจะโชว์แต่เคสสวย แล้วพอลงของจริงเจอช่องที่ไม่เคยเห็น (กฎ "เอาของมาให้ครบ")
 *
 * สองใบ:
 *   · `simple`  = ใบจริงที่เบสส่งรูปมา (6 ก.ย.) — ฐานทดลอง: เสื้อยืด Heavy Cotton สต๊อกทดสอบ
 *                 2 ตัว (M/S) · DTG หน้า 1 ตัว ฿130 · ป้ายไซส์ 2 ชิ้น ฿5 = ฿480
 *   · `complex` = ใบที่เจอจริงในโรงงาน: 2 ชุดงาน — โปโลตัดเย็บใหม่ 90 ตัว 5 ไซส์ มีส่วนลด/ชิ้น
 *                 ปัก + DTF · ป้ายคอต่อชิ้น + ค่าบล็อกต่อออเดอร์ · ชุดสอง เสื้อลูกค้าส่งมา 40 ตัว
 *                 (มีบันทึกตรวจรับ) + DTF หลัง · ค่าธรรมเนียม 2 รายการ · ชื่อสินค้ายาว
 *
 * ชนิด = `RouterOutput["order"]["getById"]["items"]` ของจริง (cast ตอนท้าย) — เขียนเท่าที่
 * หน้าจอใช้ ช่องที่ไม่มีใน object แต่มีใน type จะเป็น undefined ซึ่งของจริงก็ปล่อยผ่านเหมือนกัน
 */

import type { RouterOutput } from "@/lib/trpc";

type OrderData = RouterOutput["order"]["getById"];
export type DemoItems = OrderData["items"];
export type DemoFees = OrderData["fees"];
export type DemoItem = DemoItems[number];

export type DemoVariant = "simple" | "complex";

/* รูปจริงในrepo (public/demo-mockups) — ไม่ใช้กล่องเทาแทนรูปที่ของจริงมี */
const IMG = {
  tee: "/demo-mockups/front.svg",
  poloFront: "/demo-mockups/polo-front.svg",
  poloBack: "/demo-mockups/polo-back.svg",
  poloSleeve: "/demo-mockups/polo-sleeve.svg",
  logo: "/demo-mockups/ref-logo.svg",
} as const;

/* ---------------------------------------------------------------- ตัวช่วยสร้าง */

function variant(id: string, size: string, quantity: number, color: string | null = null) {
  return { id, size, color, quantity };
}

const EMPTY_PRODUCT = {
  description: "",
  material: null,
  productType: null,
  fabricType: null,
  fabricWeight: null,
  fabricColor: null,
  collarType: null,
  sleeveType: null,
  bodyFit: null,
  patternNote: null,
  patternFileUrl: null,
  patternId: null,
  processingType: null,
  packagingOptionId: null,
  packagingOption: null,
  garmentCondition: null,
  receivedInspected: false,
  receiveNote: null,
  discount: 0,
  product: null,
  productId: null,
  variantId: null,
};

const EMPTY_PRINT = {
  colorCount: null,
  width: null,
  height: null,
  printSize: null,
  designNote: null,
  designImageUrl: null,
  artworkId: null,
};

/* ---------------------------------------------------------------- ใบง่าย */

const SIMPLE_ITEMS = [
  {
    id: "item-simple-1",
    description: null,
    notes: null,
    subtotal: 480,
    products: [
      {
        ...EMPTY_PRODUCT,
        id: "prod-s1",
        itemSource: "FROM_STOCK",
        productType: "T_SHIRT",
        productId: "stock-demo-tee",
        product: {
          id: "stock-demo-tee",
          name: "เสื้อยืด Heavy Cotton · สต๊อกทดสอบ",
          sku: "DEMO-TEE-SHORT",
          imageUrl: IMG.tee,
        },
        baseUnitPrice: 105,
        discount: 0,
        packagingOptionId: "pack-opp-s",
        packagingOption: { id: "pack-opp-s", name: "ถุง OPP เล็ก" },
        variants: [variant("v-s1", "M", 1, "ครีม")],
      },
      {
        ...EMPTY_PRODUCT,
        id: "prod-s2",
        itemSource: "FROM_STOCK",
        productType: "T_SHIRT",
        productId: "stock-demo-tee",
        product: {
          id: "stock-demo-tee",
          name: "เสื้อยืด Heavy Cotton · สต๊อกทดสอบ",
          sku: "DEMO-TEE-SHORT",
          imageUrl: IMG.tee,
        },
        baseUnitPrice: 105,
        discount: 0,
        packagingOptionId: "pack-opp-s",
        packagingOption: { id: "pack-opp-s", name: "ถุง OPP เล็ก" },
        variants: [variant("v-s2", "S", 1, "ครีม")],
      },
    ],
    prints: [
      {
        ...EMPTY_PRINT,
        id: "print-s1",
        position: "FRONT",
        printType: "DTG",
        colorCount: 1,
        printSize: "A3",
        width: 29.7,
        height: 42,
        unitPrice: 130,
        designImageUrl: IMG.tee,
      },
    ],
    addons: [
      {
        id: "addon-s1",
        addonType: "SIZE_LABEL",
        name: "ป้ายไซส์",
        pricingType: "PER_PIECE",
        unitPrice: 5,
        quantity: 2,
        description: null,
        notes: null,
      },
    ],
  },
];

/* ---------------------------------------------------------------- ใบซับซ้อน */

const POLO_NAME =
  "เสื้อโปโลคอปกสีกรมท่า ผ้า TC ปกและปลายแขนขลิบขาว ปักโลโก้อกซ้าย สกรีน DTF หลังเต็มแผ่น";

const COMPLEX_ITEMS = [
  {
    id: "item-complex-1",
    description: "โปโลพนักงานสาขา รอบ 2/2569",
    notes: "สีกรมท่าต้องตรงกับล็อตรอบแรก (เก็บตัวอย่างไว้ที่โต๊ะ QC) · ห้ามพับทับลายหลัง",
    // 90 × (189-10) = 16,110 · ปัก 45×90 = 4,050 · DTF 65×90 = 5,850 · ป้ายคอ 8×90 = 720 · บล็อก 350
    subtotal: 27_080,
    products: [
      {
        ...EMPTY_PRODUCT,
        id: "prod-c1",
        itemSource: "CUSTOM_MADE",
        productType: "POLO",
        description: POLO_NAME,
        material: "TC",
        fabricType: "TC",
        fabricWeight: "220 แกรม",
        fabricColor: "กรมท่า",
        collarType: "POLO",
        sleeveType: "SHORT",
        bodyFit: "REGULAR",
        patternNote: "ขลิบปก/ปลายแขนสีขาว 1 ซม. · กระเป๋าอกซ้ายไม่มี",
        baseUnitPrice: 189,
        discount: 10,
        packagingOptionId: "pack-opp-l",
        packagingOption: { id: "pack-opp-l", name: "ถุง OPP ใหญ่ + กระดาษรอง" },
        variants: [
          variant("v-c1-s", "S", 10, "กรมท่า"),
          variant("v-c1-m", "M", 25, "กรมท่า"),
          variant("v-c1-l", "L", 30, "กรมท่า"),
          variant("v-c1-xl", "XL", 20, "กรมท่า"),
          variant("v-c1-2xl", "2XL", 5, "กรมท่า"),
        ],
      },
    ],
    prints: [
      {
        ...EMPTY_PRINT,
        id: "print-c1",
        position: "FRONT",
        printType: "EMBROIDERY",
        colorCount: 3,
        printSize: "CUSTOM",
        width: 8,
        height: 8,
        unitPrice: 45,
        designImageUrl: IMG.logo,
        designNote: "ปักอกซ้าย เหนือขอบกระเป๋า 2 ซม. · ด้ายทอง #1187",
      },
      {
        ...EMPTY_PRINT,
        id: "print-c2",
        position: "BACK",
        printType: "DTF",
        colorCount: null,
        printSize: "A3",
        width: 29.7,
        height: 42,
        unitPrice: 65,
        designImageUrl: IMG.poloBack,
      },
    ],
    addons: [
      {
        id: "addon-c1",
        addonType: "NECK_LABEL",
        name: "ป้ายคอทอ โลโก้ลูกค้า",
        pricingType: "PER_PIECE",
        unitPrice: 8,
        quantity: 90,
        description: null,
        notes: null,
      },
      {
        id: "addon-c2",
        addonType: "SETUP",
        name: "ค่าบล็อกปัก (ครั้งแรก)",
        pricingType: "PER_ORDER",
        unitPrice: 350,
        quantity: 1,
        description: null,
        notes: null,
      },
    ],
  },
  {
    id: "item-complex-2",
    description: "เสื้อยืดลูกค้าส่งมา สกรีนหลัง",
    notes: null,
    // ตัวเสื้อของลูกค้า ไม่คิด · DTF 55 × 40 = 2,200
    subtotal: 2_200,
    products: [
      {
        ...EMPTY_PRODUCT,
        id: "prod-c2",
        itemSource: "CUSTOMER_PROVIDED",
        productType: "T_SHIRT",
        description: "เสื้อยืดคอกลมสีดำ (ลูกค้าส่งมา 2 ลัง)",
        baseUnitPrice: 0,
        discount: 0,
        garmentCondition: "FAIR",
        receivedInspected: true,
        receiveNote: "รับ 40 ตัว มีรอยเปื้อนจาง 2 ตัว (ไซส์ L) แจ้งลูกค้าแล้ว",
        variants: [
          variant("v-c2-m", "M", 15, "ดำ"),
          variant("v-c2-l", "L", 15, "ดำ"),
          variant("v-c2-xl", "XL", 10, "ดำ"),
        ],
      },
    ],
    prints: [
      {
        ...EMPTY_PRINT,
        id: "print-c3",
        position: "BACK",
        printType: "DTF",
        printSize: "A4",
        width: 21,
        height: 29.7,
        unitPrice: 55,
        designImageUrl: IMG.poloSleeve,
      },
    ],
    addons: [],
  },
];

const COMPLEX_FEES = [
  { id: "fee-c1", feeType: "SHIPPING", name: "ค่าส่ง Kerry 3 ลัง", amount: 450 },
  { id: "fee-c2", feeType: "RUSH", name: "ค่าเร่งงาน (ส่งก่อนกำหนด 3 วัน)", amount: 1_500 },
];

/* ---------------------------------------------------------------- ส่งออก */

export function demoItems(variant: DemoVariant): DemoItems {
  const raw = variant === "simple" ? SIMPLE_ITEMS : COMPLEX_ITEMS;
  return raw as unknown as DemoItems;
}

export function demoFees(variant: DemoVariant): DemoFees {
  return (variant === "simple" ? [] : COMPLEX_FEES) as unknown as DemoFees;
}

/** ตัวเลขที่ต้องรู้ก่อนตัดสิน — นับจากข้อมูลชุดเดียวกัน ไม่ใช่ความเห็น */
export function demoFacts(variant: DemoVariant) {
  const items = demoItems(variant);
  const products = items.reduce((s, it) => s + (it.products?.length ?? 0), 0);
  const variants = items.reduce(
    (s, it) => s + (it.products ?? []).reduce((ps, p) => ps + (p.variants?.length ?? 0), 0),
    0,
  );
  const prints = items.reduce((s, it) => s + (it.prints?.length ?? 0), 0);
  const addons = items.reduce((s, it) => s + (it.addons?.length ?? 0), 0);
  return { items: items.length, products, variants, prints, addons };
}
