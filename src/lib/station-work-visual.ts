const SHIRT_DIAGRAM_PRODUCT_TYPES: ReadonlySet<string> = new Set([
  "T_SHIRT",
  "T_SHIRT_V",
  "POLO",
  "LONG_SLEEVE",
  "TANK_TOP",
  "HOODIE",
  "JACKET",
  "WINDBREAKER",
  "JERSEY",
]);

/**
 * แผนภาพ Station ตอนนี้มีเฉพาะทรงเสื้อช่วงตัว จึงใช้ได้เมื่อสินค้าทุกชิ้น
 * ใน item เป็นเสื้อที่รูปทรงนี้สื่อได้เท่านั้น; unknown/ผสม/หมวก/ถุงผ้าต้อง fail closed.
 */
export function canUseStationShirtDiagram(
  productTypes: readonly (string | null | undefined)[],
): boolean {
  return (
    productTypes.length > 0 &&
    productTypes.every(
      (productType) =>
        typeof productType === "string" &&
        SHIRT_DIAGRAM_PRODUCT_TYPES.has(productType),
    )
  );
}
