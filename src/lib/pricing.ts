/**
 * Pricing calculation utilities for the Order system.
 *
 * These functions work with both Prisma model data and form state data,
 * using a common interface shape.
 */

// ============================================================
// TYPES
// ============================================================

export interface PricingPrint {
  unitPrice: number;
}

export interface PricingAddon {
  pricingType: string; // "PER_PIECE" | "PER_ORDER"
  unitPrice: number;
  quantity?: number | null;
}

export interface PricingProduct {
  baseUnitPrice: number;
  discount?: number;
  totalQuantity: number;
}

export interface PricingItem {
  baseUnitPrice: number;
  totalQuantity: number;
  prints: PricingPrint[];
  addons: PricingAddon[];
  products?: PricingProduct[];
}

export interface PricingFee {
  amount: number;
}

export interface PricingOrder {
  items: PricingItem[];
  fees: PricingFee[];
  discount: number;
  platformFee?: number | null;
}

// ============================================================
// ITEM-LEVEL CALCULATION
// ============================================================

/**
 * Calculate the subtotal for a single order item.
 *
 * Formula:
 *   baseCost  = totalQuantity * baseUnitPrice
 *   printCost = totalQuantity * SUM(prints.unitPrice)
 *   addonCost = SUM(
 *     PER_PIECE: (addon.quantity ?? totalQuantity) * addon.unitPrice
 *     PER_ORDER: addon.unitPrice
 *   )
 *   subtotal = baseCost + printCost + addonCost
 */
export function calculateItemSubtotal(item: PricingItem): number {
  const qty = item.totalQuantity;

  // Base garment cost (supports multi-product)
  let baseCost: number;
  if (item.products && item.products.length > 0) {
    baseCost = item.products.reduce((sum, p) => {
      const net = Math.max(0, p.baseUnitPrice - (p.discount || 0));
      return sum + p.totalQuantity * net;
    }, 0);
  } else {
    baseCost = qty * item.baseUnitPrice;
  }

  // All print positions cost (per piece, applied to total qty)
  const printCost =
    qty * item.prints.reduce((sum, p) => sum + p.unitPrice, 0);

  // Add-ons cost (mixed pricing)
  const addonCost = item.addons.reduce((sum, a) => {
    if (a.pricingType === "PER_PIECE") {
      return sum + (a.quantity ?? qty) * a.unitPrice;
    }
    return sum + a.unitPrice;
  }, 0);

  return baseCost + printCost + addonCost;
}

/**
 * Calculate the per-piece price (unit price including prints & per-piece addons)
 */
export function calculateItemUnitPrice(item: PricingItem): number {
  const printPerPiece = item.prints.reduce((sum, p) => sum + p.unitPrice, 0);

  const addonPerPiece = item.addons.reduce((sum, a) => {
    if (a.pricingType === "PER_PIECE") {
      return sum + a.unitPrice;
    }
    return sum;
  }, 0);

  return item.baseUnitPrice + printPerPiece + addonPerPiece;
}

// ============================================================
// ORDER-LEVEL CALCULATION
// ============================================================

/**
 * Calculate the full order total.
 *
 * Formula:
 *   subtotalItems = SUM(items.subtotal)
 *   subtotalFees  = SUM(fees.amount)
 *   totalAmount   = subtotalItems + subtotalFees - discount
 */
export function calculateOrderTotal(order: PricingOrder): {
  subtotalItems: number;
  subtotalFees: number;
  discount: number;
  totalAmount: number;
} {
  const subtotalItems = order.items.reduce(
    (sum, item) => sum + calculateItemSubtotal(item),
    0
  );

  const subtotalFees = order.fees.reduce((sum, f) => sum + f.amount, 0);

  const discount = order.discount || 0;

  const totalAmount = subtotalItems + subtotalFees - discount;

  return {
    subtotalItems,
    subtotalFees,
    discount,
    totalAmount: Math.max(0, totalAmount),
  };
}

/**
 * Calculate profit margin for an order.
 * profitMargin = (revenue - cost) / revenue * 100
 */
export function calculateProfitMargin(
  totalAmount: number,
  totalCost: number
): number | null {
  if (totalAmount <= 0) return null;
  return ((totalAmount - totalCost) / totalAmount) * 100;
}

/**
 * Calculate total quantity from variants
 */
export function calculateTotalQuantity(
  variants: { quantity: number }[]
): number {
  return variants.reduce((sum, v) => sum + v.quantity, 0);
}

// ============================================================
// FORM-TO-PRICING ADAPTER
// ============================================================

interface OrderItemFormLike {
  products: Array<{
    baseUnitPrice: number;
    discount?: number;
    variants: Array<{ quantity: number }>;
  }>;
  prints: Array<{ unitPrice: number; position?: string }>;
  addons: Array<{ pricingType: string; unitPrice: number; name?: string }>;
}

/**
 * Convert an OrderItemForm (or compatible shape) into a PricingItem
 * for use with calculateItemSubtotal and related functions.
 */
export function orderItemFormToPricingItem(item: OrderItemFormLike): PricingItem {
  const totalQuantity = item.products.reduce(
    (sum, p) => sum + calculateTotalQuantity(p.variants),
    0,
  );
  const products: PricingProduct[] = item.products.map((p) => ({
    baseUnitPrice: p.baseUnitPrice,
    discount: p.discount,
    totalQuantity: calculateTotalQuantity(p.variants),
  }));

  return {
    baseUnitPrice: products[0]?.baseUnitPrice ?? 0,
    totalQuantity,
    products,
    prints: item.prints.map((p) => ({ unitPrice: p.unitPrice })),
    addons: item.addons.map((a) => ({
      pricingType: a.pricingType,
      unitPrice: a.unitPrice,
    })),
  };
}

/**
 * Calculate the subtotal for an OrderItemForm directly.
 * Convenience wrapper: converts form → pricing item → calls calculateItemSubtotal.
 */
export function calculateFormItemSubtotal(item: OrderItemFormLike): number {
  return calculateItemSubtotal(orderItemFormToPricingItem(item));
}

/**
 * Get total quantity across all products in an OrderItemForm.
 */
export function getFormItemTotalQty(item: OrderItemFormLike): number {
  return item.products.reduce(
    (sum, p) => sum + calculateTotalQuantity(p.variants),
    0,
  );
}

// ============================================================
// PRICE BREAKDOWN (for display)
// ============================================================

export interface PriceBreakdownLine {
  label: string;
  unitPrice: number;
  total: number;
  type: "base" | "print" | "addon_piece" | "addon_order";
}

export interface PriceBreakdownResult {
  lines: PriceBreakdownLine[];
  unitPriceTotal: number;
  grandTotal: number;
  totalQuantity: number;
}

export function calculateItemPriceBreakdown(
  item: PricingItem & { prints: (PricingPrint & { position?: string })[]; },
  positionLabels?: Record<string, string>,
): PriceBreakdownResult {
  const qty = item.totalQuantity;
  const lines: PriceBreakdownLine[] = [];

  lines.push({
    label: "ตัวเปล่า",
    unitPrice: item.baseUnitPrice,
    total: qty * item.baseUnitPrice,
    type: "base",
  });

  for (const p of item.prints) {
    const posLabel = p.position && positionLabels?.[p.position]
      ? positionLabels[p.position]
      : p.position || "สกรีน";
    lines.push({
      label: `สกรีน${posLabel}`,
      unitPrice: p.unitPrice,
      total: qty * p.unitPrice,
      type: "print",
    });
  }

  for (const a of item.addons) {
    if (a.pricingType === "PER_PIECE") {
      const addonQty = a.quantity ?? qty;
      lines.push({
        label: (a as PricingAddon & { name?: string }).name || "Add-on",
        unitPrice: a.unitPrice,
        total: addonQty * a.unitPrice,
        type: "addon_piece",
      });
    } else {
      lines.push({
        label: (a as PricingAddon & { name?: string }).name || "Add-on",
        unitPrice: a.unitPrice,
        total: a.unitPrice,
        type: "addon_order",
      });
    }
  }

  const unitPriceTotal = item.baseUnitPrice
    + item.prints.reduce((s, p) => s + p.unitPrice, 0)
    + item.addons.filter(a => a.pricingType === "PER_PIECE").reduce((s, a) => s + a.unitPrice, 0);

  const grandTotal = lines.reduce((s, l) => s + l.total, 0);

  return { lines, unitPriceTotal, grandTotal, totalQuantity: qty };
}
