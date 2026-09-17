import {
  calculateFormItemSubtotal,
  calculateTotalQuantity,
  getFormItemTotalQty,
} from "@/lib/pricing";
import {
  ITEM_SOURCES,
  PRICING_TYPE_LABELS,
  PRINT_POSITIONS,
  PRINT_TYPES,
  type OrderFeeForm,
  createOrderItemProduct,
  type OrderItemForm,
  type OrderItemProductForm,
  type PricingType,
} from "@/types/order-form";

/**
 * แถวสินค้าใหม่ตามแหล่ง · ตัดเย็บใหม่/ลูกค้าส่งมากรอกจำนวนผ่านตารางไซส์ จึงเริ่มแบบยังไม่มีไซส์
 * ค่าตั้งต้นของสินค้าเปล่ามีแถวไซส์ว่างจำนวน 1 — เคยทำให้หัวชุดงาน/แถวรวม/ยอดเงินนับเป็น 1 ตัว
 * ทั้งที่ตารางไซส์บอก 0 (เบสเจอ 2026-09-18) · ส่งฟอร์มยังต้องระบุไซส์ตาม validateOrderItemProduct
 */
export function createProductForSource(source: string): OrderItemProductForm {
  return createOrderItemProduct({
    itemSource: source,
    ...(source !== "FROM_STOCK" ? { variants: [] } : {}),
    ...(source === "CUSTOMER_PROVIDED" ? { baseUnitPrice: 0 } : {}),
  });
}

export interface OrderItemPriceSummaryLine {
  key: string;
  kind: "product" | "print" | "addon";
  label: string;
  detail: string;
  discount?: number;
  unitPrice: number;
  quantity: number;
  total: number;
}

export interface OrderItemPriceSummary {
  totalQuantity: number;
  subtotal: number;
  averageUnitPrice: number | null;
  lines: OrderItemPriceSummaryLine[];
}

export function moveOrderItemProduct(
  items: readonly OrderItemForm[],
  itemIdx: number,
  productIdx: number,
  direction: -1 | 1,
): OrderItemForm[] {
  const item = items[itemIdx];
  const targetIdx = productIdx + direction;
  if (
    !item
    || productIdx < 0
    || productIdx >= item.products.length
    || targetIdx < 0
    || targetIdx >= item.products.length
  ) {
    return [...items];
  }

  const products = [...item.products];
  [products[productIdx], products[targetIdx]] = [products[targetIdx], products[productIdx]];
  const next = [...items];
  next[itemIdx] = { ...item, products };
  return next;
}

/**
 * คัดลอกชุดงานทั้งใบไป "ท้ายรายการ" — ลาย สินค้า ไซส์ ส่วนเสริม และหมายเหตุมาครบ
 * ต่อท้ายเหมือนปุ่มเพิ่มรายการ ไม่แทรกกลาง เพราะเลข index ของชุดอื่นคือตัวชี้ของหน้า
 * (ชุดเป้าหมายของช่องเลือกสินค้าจากสต็อก · คีย์ของการ์ด · callback ที่ค้างจากการอัปโหลดไฟล์ลาย)
 * แถวสินค้าในชุดใหม่ต้องได้ตัวระบุใหม่ และไม่พาของที่ผูกกับตัวสินค้าจริงไป:
 *   formKey ใหม่ (กัน state ของสองแถวชนกัน) · ไม่พา savedProductId (ไม่งั้นหน้าแก้อ่านว่าเป็นแถวเดิม
 *   แล้วผูกใบตรวจรับผิดตัว) · ไม่พาหลักฐานการรับของ (สภาพ/หมายเหตุ/ตรวจรับแล้ว) ซึ่งเป็นของรอบรับจริง
 */
export function duplicateOrderItem(items: OrderItemForm[], itemIdx: number): OrderItemForm[] {
  const source = items[itemIdx];
  if (!source) return items;
  const clone: OrderItemForm = {
    ...structuredClone(source),
    products: source.products.map((product) => {
      const rest = { ...structuredClone(product) };
      delete rest.formKey;
      delete rest.savedProductId;
      return createOrderItemProduct({
        ...rest,
        garmentCondition: "",
        receiveNote: "",
        receivedInspected: false,
      });
    }),
  };
  return [...items, clone];
}

/**
 * สร้างข้อมูลสรุปเพื่อแสดงผลเท่านั้น โดยอาศัย pricing helper เดิมเป็นแหล่งจริงของยอดรวม
 * เพื่อให้ JSX ไม่ต้องตัดสินซ้ำว่าแถวไหนควรแสดงและใช้จำนวนใดคูณราคา
 */
export function buildOrderItemPriceSummary(
  item: OrderItemForm,
): OrderItemPriceSummary {
  const totalQuantity = getFormItemTotalQty(item);
  const subtotal = calculateFormItemSubtotal(item);
  const lines: OrderItemPriceSummaryLine[] = [];

  item.products.forEach((product, index) => {
    const quantity = calculateTotalQuantity(product.variants);
    if (quantity === 0) return;

    const discount = product.discount || 0;
    const unitPrice = Math.max(0, product.baseUnitPrice - discount);
    lines.push({
      key: `product-${index}`,
      kind: "product",
      label: product.productName || product.description || `สินค้า ${index + 1}`,
      detail: [product.variants[0]?.color, product.variants[0]?.size]
        .filter(Boolean)
        .join(" "),
      discount,
      unitPrice,
      quantity,
      total: quantity * unitPrice,
    });
  });

  item.prints.forEach((print, index) => {
    if (print.unitPrice === 0) return;

    lines.push({
      key: `print-${index}`,
      kind: "print",
      label: PRINT_TYPES[print.printType] || print.printType,
      detail: PRINT_POSITIONS[print.position] || print.position,
      unitPrice: print.unitPrice,
      quantity: totalQuantity,
      total: totalQuantity * print.unitPrice,
    });
  });

  item.addons.forEach((addon, index) => {
    if (addon.unitPrice === 0) return;

    const quantity = addon.pricingType === "PER_PIECE" ? totalQuantity : 1;
    lines.push({
      key: `addon-${index}`,
      kind: "addon",
      label: addon.name || `ส่วนเสริม ${index + 1}`,
      detail:
        PRICING_TYPE_LABELS[addon.pricingType as PricingType] ?? addon.pricingType,
      unitPrice: addon.unitPrice,
      quantity,
      total: quantity * addon.unitPrice,
    });
  });

  return {
    totalQuantity,
    subtotal,
    averageUnitPrice:
      totalQuantity > 0
        ? Math.round((subtotal / totalQuantity) * 100) / 100
        : null,
    lines,
  };
}

export type ProductSourceBadgeVariant = "default" | "accent" | "warning";

export function getProductSourcePresentation(source: string): {
  label: string;
  variant: ProductSourceBadgeVariant;
} {
  return {
    label: ITEM_SOURCES[source] || source,
    variant:
      source === "FROM_STOCK"
        ? "default"
        : source === "CUSTOM_MADE"
          ? "accent"
          : "warning",
  };
}

export interface FeeCatalogSelection {
  id: string;
  name: string;
  type: string;
  defaultPrice: number;
}

export function resolveFeeCatalogSelection(
  catalog: readonly FeeCatalogSelection[] | undefined,
  catalogId: string,
): OrderFeeForm | null {
  if (!catalogId || !catalog) return null;

  const item = catalog.find((entry) => entry.id === catalogId);
  if (!item) return null;

  return {
    feeType: item.type,
    name: item.name,
    amount: item.defaultPrice,
  };
}
