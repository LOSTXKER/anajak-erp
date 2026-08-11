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

// ============================================================
// ORDER-LEVEL CALCULATION
// ============================================================

/**
 * สรุปยอดออเดอร์สำหรับ preview ฝั่ง client — สูตร A เดียวกับ server
 * (ตัวจริงอยู่ src/server/services/pricing.ts computeOrderTotals — แก้สูตรต้องแก้คู่กันเสมอ)
 *
 * platformFee ไม่บวกเข้ายอดและไม่เข้าฐาน VAT — เป็นเงินที่ marketplace หักจากยอดโอน (ฝั่งต้นทุน)
 */
export interface OrderSummaryInput {
  itemSubtotals: number[];
  feeAmounts: number[];
  discount: number;
  taxRate: number; // เปอร์เซ็นต์ 0-100
}

export function calculateOrderSummary(input: OrderSummaryInput): {
  subtotalItems: number;
  subtotalFees: number;
  discount: number;
  taxAmount: number;
  grandTotal: number;
} {
  const subtotalItems = input.itemSubtotals.reduce((s, v) => s + v, 0);
  const subtotalFees = input.feeAmounts.reduce((s, v) => s + v, 0);
  const discount = input.discount || 0;
  const subtotalBeforeTax = subtotalItems + subtotalFees - discount;
  const taxAmount = input.taxRate > 0 ? subtotalBeforeTax * (input.taxRate / 100) : 0;
  return {
    subtotalItems,
    subtotalFees,
    discount,
    taxAmount,
    grandTotal: Math.max(0, subtotalBeforeTax + taxAmount),
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
// แจกแจงราคาเป็นบรรทัด (สำหรับตาราง "สรุปราคา" บนหน้าออเดอร์)
// ============================================================

/**
 * แตกยอดของ 1 รายการออกเป็นบรรทัด ราคา/หน่วย × จำนวน = รวม
 *
 * ทำไมต้องมี: หน้าออเดอร์เดิมโชว์ตัวเลขกระจาย 4 ที่ (ราคาเสื้อ/ชิ้น · ยอดเสื้อ ·
 * ราคาพิมพ์/ชิ้น · ยอดรวมรายการ) โดยไม่มีอะไรบอกว่าอันไหนรวมเป็นอันไหน — ยอดพิมพ์
 * (ราคา/ชิ้น × จำนวน) ไม่เคยโผล่บนจอเลย และ**ส่วนเสริมแบบต่อชิ้นโชว์แค่ราคา/หน่วย**
 * ทั้งที่ระบบเก็บเงิน unitPrice × จำนวน → อ่านผิดแล้วไปเถียงกับลูกค้าผิดเงินจริง
 *
 * สูตรตรงกับ `calculateItemSubtotal` ข้างบนและ server (`services/pricing.ts`) เป๊ะ —
 * ผลรวมของ `total` ทุกบรรทัดต้องเท่ากับ subtotal ของรายการเสมอ (มีเทสยืนยัน)
 * แก้สูตรที่ไหนต้องแก้ครบทั้งสามที่
 */
export interface PriceLine {
  kind: "product" | "print" | "addon";
  /** ตำแหน่งใน array ต้นทาง — ผู้เรียกเอาไปหยิบชื่อ/ป้ายไทยมาแสดงเอง (ที่นี่ไม่รู้จักภาษา) */
  index: number;
  unitPrice: number;
  quantity: number;
  total: number;
}

export function buildItemPriceLines(item: PricingItem): PriceLine[] {
  const qty = item.totalQuantity;
  const lines: PriceLine[] = [];

  (item.products ?? []).forEach((p, index) => {
    const unitPrice = Math.max(0, p.baseUnitPrice - (p.discount || 0));
    lines.push({
      kind: "product",
      index,
      unitPrice,
      quantity: p.totalQuantity,
      total: unitPrice * p.totalQuantity,
    });
  });

  item.prints.forEach((pr, index) => {
    // งานพิมพ์คิดต่อชิ้นเสมอ กับจำนวนรวมทั้งรายการ (ไม่ใช่ต่อ product)
    lines.push({
      kind: "print",
      index,
      unitPrice: pr.unitPrice,
      quantity: qty,
      total: pr.unitPrice * qty,
    });
  });

  item.addons.forEach((a, index) => {
    // PER_PIECE: ใช้จำนวนของ addon เองถ้าระบุ ไม่งั้นเท่าจำนวนรวมรายการ · อื่นๆ = ต่อออเดอร์ (×1)
    const quantity = a.pricingType === "PER_PIECE" ? (a.quantity ?? qty) : 1;
    lines.push({
      kind: "addon",
      index,
      unitPrice: a.unitPrice,
      quantity,
      total: a.unitPrice * quantity,
    });
  });

  return lines;
}

/** จำนวนชิ้นรวมทั้งใบ — บวกข้ามรายการและข้ามสินค้า (หน้าออเดอร์ถามคำถามนี้ก่อนเพื่อน) */
export function sumOrderQuantity(
  items: { products?: { variants?: { quantity: number }[] | null }[] | null }[] | null | undefined,
): number {
  if (!items?.length) return 0;
  return items.reduce(
    (sum, item) =>
      sum +
      (item.products ?? []).reduce(
        (s, p) => s + calculateTotalQuantity(p.variants ?? []),
        0,
      ),
    0,
  );
}
