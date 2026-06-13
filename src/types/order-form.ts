export type VariantForm = {
  size: string;
  color: string;
  quantity: number;
};

export type PrintForm = {
  position: string;
  printType: string;
  colorCount: number;
  unitPrice: number;
  printSize: string;
  width: number;
  height: number;
  designNote: string;
  designImageUrl?: string;
  designImagePreview?: string;
  // ลิงก์คลังลายลูกค้า (ก้อน 4 ชิ้น 2) — ตามรอยครบ: order-mapping ทั้งสองขา + printSchema
  artworkId?: string;
};

export type AddonForm = {
  addonType: string;
  name: string;
  pricingType: "PER_PIECE" | "PER_ORDER" | string;
  unitPrice: number;
};

export type OrderItemProductForm = {
  productId?: string;
  productType: string;
  description: string;
  material: string;
  baseUnitPrice: number;
  discount: number;
  packagingOptionId: string;
  variants: VariantForm[];
  itemSource: string;
  fabricType: string;
  fabricWeight: string;
  fabricColor: string;
  processingType: string;
  // Display-only fields for FROM_STOCK
  productImageUrl?: string;
  productSku?: string;
  productName?: string;
  stockAvailable?: number;
  // Garment spec (CUSTOM_MADE)
  patternId?: string;
  patternMode: "catalog" | "custom";
  collarType: string;
  sleeveType: string;
  bodyFit: string;
  patternFileUrl: string;
  patternNote: string;
  // Receive tracking (CUSTOMER_PROVIDED)
  garmentCondition: string;
  receivedInspected: boolean;
  receiveNote: string;
};

export type OrderItemForm = {
  description: string;
  products: OrderItemProductForm[];
  prints: PrintForm[];
  addons: AddonForm[];
  notes: string;
};

export type OrderFeeForm = {
  feeType: string;
  name: string;
  amount: number;
};

export type ReferenceImage = {
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  preview?: string;
  printPosition?: string;
};

export const EMPTY_VARIANT: VariantForm = { size: "", color: "", quantity: 1 };

export const EMPTY_PRINT: PrintForm = {
  position: "FRONT",
  printType: "DTF", // default = งานหลักของโรงงาน (เดิม SILK_SCREEN ทำให้แถวใหม่กลายเป็นงาน outsource เงียบๆ)
  colorCount: 1,
  unitPrice: 0,
  printSize: "",
  width: 0,
  height: 0,
  designNote: "",
};

export const EMPTY_ADDON: AddonForm = {
  addonType: "",
  name: "",
  pricingType: "PER_PIECE",
  unitPrice: 0,
};

export const EMPTY_PRODUCT: OrderItemProductForm = {
  productType: "T_SHIRT",
  description: "",
  material: "",
  baseUnitPrice: 0,
  discount: 0,
  packagingOptionId: "",
  variants: [{ ...EMPTY_VARIANT }],
  itemSource: "",
  fabricType: "",
  fabricWeight: "",
  fabricColor: "",
  processingType: "",
  patternMode: "catalog",
  collarType: "",
  sleeveType: "",
  bodyFit: "",
  patternFileUrl: "",
  patternNote: "",
  garmentCondition: "",
  receivedInspected: false,
  receiveNote: "",
};

export const EMPTY_ITEM: OrderItemForm = {
  description: "",
  products: [],
  prints: [],
  addons: [],
  notes: "",
};

export const EMPTY_FEE: OrderFeeForm = { feeType: "", name: "", amount: 0 };

export const PRODUCT_TYPES: Record<string, string> = {
  T_SHIRT: "เสื้อยืดคอกลม",
  T_SHIRT_V: "เสื้อยืดคอวี",
  POLO: "เสื้อโปโล",
  LONG_SLEEVE: "เสื้อแขนยาว",
  TANK_TOP: "เสื้อกล้าม",
  HOODIE: "ฮู้ด",
  JACKET: "แจ็คเก็ต",
  WINDBREAKER: "เสื้อกันลม",
  JERSEY: "เสื้อกีฬา/เจอร์ซี่",
  SHORTS: "กางเกงขาสั้น",
  PANTS: "กางเกงขายาว",
  APRON: "ผ้ากันเปื้อน",
  CAP: "หมวก",
  MASK: "ผ้าปิดปาก",
  TOTE_BAG: "ถุงผ้า",
  OTHER: "อื่นๆ",
};

export const ITEM_SOURCES: Record<string, string> = {
  FROM_STOCK: "จากสต็อก",
  CUSTOM_MADE: "ตัดเย็บใหม่",
  CUSTOMER_PROVIDED: "ลูกค้าส่งมา",
};

export const PROCESSING_TYPES: Record<string, string> = {
  PRINT_ONLY: "สกรีน/พิมพ์อย่างเดียว",
  CUT_AND_SEW_PRINT: "ตัดเย็บ + สกรีน",
  CUT_AND_SEW_ONLY: "ตัดเย็บอย่างเดียว",
  PACK_ONLY: "แพ็คส่งอย่างเดียว",
  FULL_PRODUCTION: "ผลิตครบวงจร",
};

export const FABRIC_TYPES: Record<string, string> = {
  COTTON: "Cotton",
  POLYESTER: "Polyester",
  TC: "TC (65/35)",
  CVC: "CVC (60/40)",
  TK: "TK",
  MESH: "ผ้าเมช",
  DRYFIT: "Dry-Fit",
  MODAL: "Modal",
  JERSEY: "Jersey",
  INTERLOCK: "Interlock",
  RIB: "Rib",
  OTHER: "อื่นๆ",
};

export const PRINT_POSITIONS: Record<string, string> = {
  FRONT: "หน้า",
  BACK: "หลัง",
  SLEEVE_L: "แขนซ้าย",
  SLEEVE_R: "แขนขวา",
  COLLAR: "ปก",
  POCKET: "กระเป๋า",
};

export const PRINT_TYPES: Record<string, string> = {
  DTF: "DTF", // งานหลักของโรงงาน (70%)
  DTG: "DTG",
  SILK_SCREEN: "Silk Screen (outsource)",
  SUBLIMATION: "Sublimation",
  HEAT_TRANSFER: "Heat Transfer",
  EMBROIDERY: "ปัก",
};

export const PRINT_SIZES: Record<string, { label: string; width: number; height: number }> = {
  A5: { label: "A5 (14.8 × 21 ซม.)", width: 14.8, height: 21 },
  A4: { label: "A4 (21 × 29.7 ซม.)", width: 21, height: 29.7 },
  A3: { label: "A3 (29.7 × 42 ซม.)", width: 29.7, height: 42 },
  A2: { label: "A2 (42 × 59.4 ซม.)", width: 42, height: 59.4 },
  CUSTOM: { label: "กำหนดเอง", width: 0, height: 0 },
};

export const COLLAR_TYPES: Record<string, string> = {
  CREW_NECK: "คอกลม",
  V_NECK: "คอวี",
  POLO: "คอโปโล",
  MANDARIN: "คอจีน",
  DRESS_SHIRT: "คอเชิ้ต",
  CREW_SPLICED: "คอกลมตัดต่อ",
  HENLEY: "คอเฮนลี่",
  HOOD: "ฮู้ด",
  OTHER: "อื่นๆ",
};

export const SLEEVE_TYPES: Record<string, string> = {
  SHORT: "แขนสั้น",
  LONG: "แขนยาว",
  SLEEVELESS: "แขนกุด",
  THREE_QUARTER: "แขน 3/4",
  CUFF: "แขนจั๊ม",
  RAGLAN: "แขนราคลัน",
  OTHER: "อื่นๆ",
};

export const BODY_FITS: Record<string, string> = {
  SLIM: "Slim Fit",
  REGULAR: "Regular",
  RELAXED: "Relaxed",
  OVERSIZE: "Oversize",
};

export type PricingType = "PER_PIECE" | "PER_ORDER";

export const PRICING_TYPE_LABELS: Record<PricingType, string> = {
  PER_PIECE: "ต่อชิ้น",
  PER_ORDER: "ต่อออเดอร์",
};

export const GARMENT_CONDITIONS: Record<string, string> = {
  GOOD: "ดี",
  FAIR: "พอใช้",
  DAMAGED: "มีตำหนิ",
};

const FABRIC_SOURCES = new Set(["CUSTOM_MADE"]);

export function deriveProcessingType(itemSource: string, needsPrinting: boolean): string {
  const hasFabric = FABRIC_SOURCES.has(itemSource);
  if (hasFabric && needsPrinting) return "CUT_AND_SEW_PRINT";
  if (hasFabric && !needsPrinting) return "CUT_AND_SEW_ONLY";
  if (needsPrinting) return "PRINT_ONLY";
  return "PACK_ONLY";
}

// "รายการนี้มีเนื้อจริงไหม" — ตัวตัดสินเดียว ใช้ทั้งหน้าเปิดงาน (เปิดแบบสอบถาม vs คิดเงิน)
// และระบบ draft (เก็บ/ลบ localStorage) — สองที่นี้ต้องมองเหมือนกัน ไม่งั้น draft ค้าง/หาย
// จำนวนอย่างเดียวไม่นับเป็นเนื้อหา — แถวใหม่มี quantity default 1 ติดมา ถ้านับจะสลับ
// ฟอร์มเข้าโหมดคิดเงินทันทีที่กด "เพิ่มสินค้า" ทั้งที่ยังไม่กรอกอะไร (audit ข้อ 7)
export function itemHasContent(item: OrderItemForm): boolean {
  return (
    !!item.description ||
    item.prints.length > 0 ||
    item.addons.length > 0 ||
    item.products.some(
      (p) =>
        p.description ||
        p.productId ||
        p.itemSource ||
        p.variants.some((v) => v.size.trim() || v.color.trim())
    )
  );
}

export type ProductValidationErrors = {
  description?: string;
  baseUnitPrice?: string;
  variants?: string;
  itemSource?: string;
};

export type ItemValidationErrors = {
  products?: string;
};

export function validateOrderItemProduct(product: OrderItemProductForm): ProductValidationErrors {
  const errors: ProductValidationErrors = {};
  if (!product.description.trim()) errors.description = "กรุณาระบุคำอธิบาย";
  if (product.itemSource !== "CUSTOMER_PROVIDED" && product.baseUnitPrice <= 0) {
    errors.baseUnitPrice = "กรุณาระบุราคา";
  }
  if (product.variants.length === 0 || product.variants.every((v) => !v.size.trim())) {
    errors.variants = "กรุณาระบุไซส์อย่างน้อย 1 รายการ";
  } else if (product.variants.some((v) => v.size.trim() && v.quantity < 1)) {
    // server บังคับ quantity ≥ 1 — เช็คที่ฟอร์มก่อน ไม่งั้นผู้ใช้เจอ zod error อ่านไม่ออก
    // (เคสจริง: ลบเลขเพื่อพิมพ์ใหม่แล้วโดนแชทขัดจังหวะ — ค่าค้างเป็น 0 · audit ข้อ 2)
    errors.variants = "จำนวนต่อไซส์ต้องอย่างน้อย 1 ชิ้น (มีไซส์ที่จำนวนเป็น 0 อยู่)";
  }
  if (!product.itemSource) errors.itemSource = "กรุณาเลือกแหล่งที่มาของสินค้า";
  return errors;
}

export function validateOrderItem(item: OrderItemForm): ItemValidationErrors {
  const errors: ItemValidationErrors = {};
  if (item.products.length === 0) errors.products = "กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ";
  return errors;
}
