import type { OrderItemForm } from "@/types/order-form";
import { EMPTY_ITEM, EMPTY_PRODUCT } from "@/types/order-form";
import type { SelectedVariantItem } from "@/components/product-picker";

// รวมสินค้าที่หยิบจากสต๊อกเข้า items ของฟอร์ม — logic เดียวใช้ทั้งหน้าเปิดงาน (orders/new)
// และ dialog แก้รายการบนหน้าออเดอร์ (ห้ามก๊อปสองชุด เดี๋ยว drift เหมือนฟอร์มรายการเดิม)
//
// กติกา (review 2026-06-11 — สองกับดักที่ต้องไม่กลับมา):
// 1. ยึด "item เป้าหมาย" ด้วย identity ไม่ใช่ index หลัง filter — item ที่เพิ่งกดเพิ่ม (ยังเปล่า)
//    ต้องเป็นที่ลงของของที่หยิบ ไม่ใช่ถูกตัดทิ้งแล้วของไหลไป item แรก
// 2. pruneEmpty: orders/new = true (ตัด placeholder ที่พิมพ์ค้าง) · dialog แก้รายการ = false
//    (item จาก DB ที่ "ดูว่าง" คือข้อมูลจริงที่จ่ายเงินแล้ว — ห้ามลบเงียบ)
function itemLooksEmpty(it: OrderItemForm): boolean {
  return (
    !it.description &&
    !it.notes &&
    it.prints.length === 0 &&
    it.addons.length === 0 &&
    !it.products.some(
      (p) => p.description || p.productId || p.itemSource || p.variants.some((v) => v.size || v.color)
    )
  );
}

export function mergeStockVariantsIntoItems(
  prev: OrderItemForm[],
  selected: SelectedVariantItem[],
  expandedItemIdx: number | null,
  options?: { pruneEmpty?: boolean }
): { items: OrderItemForm[]; targetIdx: number } {
  const pruneEmpty = options?.pruneEmpty ?? true;

  // ยึดเป้าหมายก่อนแตะ array — การ์ดที่กางอยู่คือที่ที่ผู้ใช้ตั้งใจให้ของลง
  const target =
    expandedItemIdx !== null && expandedItemIdx >= 0 && expandedItemIdx < prev.length
      ? prev[expandedItemIdx]
      : prev[0];

  const kept = pruneEmpty
    ? prev.filter((it) => it === target || !itemLooksEmpty(it))
    : [...prev];
  const result = kept.length > 0 ? kept : [structuredClone(EMPTY_ITEM)];
  const foundIdx = target ? result.indexOf(target) : -1;
  const targetIdx = foundIdx >= 0 ? foundIdx : 0;

  const targetItem = result[targetIdx];
  const updatedProducts = [...targetItem.products];

  for (const v of selected) {
    const dupIdx = updatedProducts.findIndex(
      (p) =>
        p.productId === v.productId &&
        p.itemSource === "FROM_STOCK" &&
        p.variants[0]?.size === v.size &&
        p.variants[0]?.color === v.color
    );

    if (dupIdx >= 0) {
      const ep = updatedProducts[dupIdx];
      const newVariants = [...ep.variants];
      newVariants[0] = { ...newVariants[0], quantity: newVariants[0].quantity + v.quantity };
      updatedProducts[dupIdx] = { ...ep, variants: newVariants };
    } else {
      const isEmptyFirst =
        updatedProducts.length === 1 &&
        !updatedProducts[0].productId &&
        !updatedProducts[0].description &&
        !updatedProducts[0].itemSource;
      const newProd: typeof EMPTY_PRODUCT = {
        ...structuredClone(EMPTY_PRODUCT),
        productId: v.productId,
        itemSource: "FROM_STOCK",
        productType: v.productType,
        description: v.name,
        baseUnitPrice: v.basePrice,
        variants: [{ size: v.size, color: v.color, quantity: v.quantity }],
        productImageUrl: v.imageUrl,
        productSku: v.sku,
        productName: v.name,
        stockAvailable: v.stock,
      };
      if (isEmptyFirst) {
        updatedProducts[0] = newProd;
      } else {
        updatedProducts.push(newProd);
      }
    }
  }

  const next = [...result];
  next[targetIdx] = { ...targetItem, products: updatedProducts };
  return { items: next, targetIdx };
}
