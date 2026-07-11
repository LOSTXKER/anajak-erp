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
  type OrderItemForm,
  type PricingType,
} from "@/types/order-form";

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
