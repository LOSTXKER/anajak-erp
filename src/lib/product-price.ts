type ProductPrice = { source: string; basePrice: number };
type VariantPrice = { sellingPrice: number; priceAdj?: number };

/** null = ยังไม่มีราคาขายจากแหล่งสินค้า ไม่ใช้ต้นทุนเป็นราคาขายแทน */
export function productSellingPrice(product: ProductPrice, variant?: VariantPrice, includeAdjustment = true): number | null {
  const base = variant && variant.sellingPrice > 0
    ? variant.sellingPrice
    : product.source === "LOCAL" ? product.basePrice : null;
  return base === null ? null : Math.round((base + (includeAdjustment ? variant?.priceAdj ?? 0 : 0)) * 100) / 100;
}
