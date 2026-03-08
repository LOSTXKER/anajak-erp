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
};

export type AddonForm = {
  addonType: string;
  name: string;
  pricingType: "PER_PIECE" | "PER_ORDER" | string;
  unitPrice: number;
};

export type OrderItemForm = {
  productId?: string;
  productType: string;
  description: string;
  material: string;
  baseUnitPrice: number;
  variants: VariantForm[];
  prints: PrintForm[];
  addons: AddonForm[];
  notes: string;
  itemSource: string;
  needsPrinting: boolean;
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
  printType: "SILK_SCREEN",
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

export const EMPTY_ITEM: OrderItemForm = {
  productType: "T_SHIRT",
  description: "",
  material: "",
  baseUnitPrice: 0,
  variants: [{ ...EMPTY_VARIANT }],
  prints: [],
  addons: [],
  notes: "",
  itemSource: "",
  needsPrinting: true,
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
  ORDER_FROM_SUPPLIER: "สั่งจากซัพพลายเออร์",
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
  SILK_SCREEN: "Silk Screen",
  DTG: "DTG",
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

export type ItemValidationErrors = {
  description?: string;
  baseUnitPrice?: string;
  variants?: string;
  itemSource?: string;
};

export function validateOrderItem(item: OrderItemForm): ItemValidationErrors {
  const errors: ItemValidationErrors = {};
  if (!item.description.trim()) errors.description = "กรุณาระบุคำอธิบาย";
  if (item.itemSource !== "CUSTOMER_PROVIDED" && item.baseUnitPrice <= 0) {
    errors.baseUnitPrice = "กรุณาระบุราคา";
  }
  if (item.variants.length === 0 || item.variants.every((v) => !v.size.trim())) {
    errors.variants = "กรุณาระบุไซส์อย่างน้อย 1 รายการ";
  }
  if (!item.itemSource) errors.itemSource = "กรุณาเลือกแหล่งที่มาของสินค้า";
  return errors;
}
