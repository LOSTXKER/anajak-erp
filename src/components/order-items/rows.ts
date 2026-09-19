/* ============================================================
   รายการสินค้าของออเดอร์ — ตัวเลขและป้ายที่ใช้ร่วมกัน (ไม่มี JSX ไม่มี query)

   ใช้ทั้งแท็บ "รายการ" ของหน้าออเดอร์ และใบผลิต /production/[id]
   (เบสสั่ง 2026-09-19 "ควรเรียงสินค้าเป็นตารางแบบหน้าออเดอร์")

   ชนิดข้อมูลที่รับเป็นโครงขั้นต่ำ ไม่ผูกกับ DTO ตัวใดตัวหนึ่ง — order.getById มีเงิน
   ส่วน production.getById ไม่มี ทั้งสองจึงส่งเข้ามาได้โดยเงินไม่ติดมาในชนิดร่วมนี้
   ============================================================ */

import { PRINT_POSITIONS, PRINT_SIZES, PRINT_TYPES, PRODUCT_TYPES } from "@/types/order-form";

export interface PrintLike {
  id: string;
  position: string;
  printType: string;
  printSize: string | null;
  width: number | null;
  height: number | null;
  colorCount: number | null;
  designNote: string | null;
  designImageUrl: string | null;
  /**
   * ลายที่โยงกลับคลังลายของลูกค้า — ใบผลิตใช้รูปตัวนี้ก่อน (คมกว่าไฟล์แนบตอนขาย)
   * และค่ารีดที่กรอกครั้งเดียวไว้ที่คลังลาย ใช้บนขั้นรีดร้อน
   */
  artwork?: {
    imageUrl: string | null;
    heatTempC?: number | null;
    heatPressSec?: number | null;
    heatPressure?: string | null;
  } | null;
}

export interface VariantLike {
  id: string;
  size: string | null;
  color: string | null;
  quantity: number;
}

export interface ProductLike {
  id: string;
  productType: string | null;
  description: string | null;
  fabricColor: string | null;
  totalQuantity: number;
  variants: VariantLike[];
  product?: { name: string; sku?: string | null; imageUrl?: string | null } | null;
  packagingOption?: { name: string } | null;
  itemSource?: string | null;
}

export interface ItemLike {
  id: string;
  description?: string | null;
  products: ProductLike[];
  prints: PrintLike[];
}

/**
 * หนึ่งแถว = เสื้อหนึ่งสี/ไซซ์ของชุดงาน
 * ชนิดของ `prod` ตามของที่ส่งเข้ามา — หน้าออเดอร์จึงยังอ่านราคาจากแถวได้ ส่วนใบผลิตไม่มีให้อ่าน
 */
export interface PieceRow<P extends ProductLike = ProductLike> {
  key: string;
  prod: P;
  /** ไซซ์ของแถวนี้ — null = สินค้าที่ยังไม่ได้ใส่ไซซ์ */
  size: string | null;
  color: string | null;
  qty: number;
  /** id ของ variant จริง — null = แถวจำลองของสินค้าที่ยังไม่มีไซซ์ (กรอกยอดไม่ได้) */
  variantId: string | null;
}

export const productQty = (prod: ProductLike): number =>
  prod.variants?.reduce((sum, v) => sum + v.quantity, 0) ?? 0;

export const itemQty = (item: ItemLike): number =>
  item.products?.reduce((sum, prod) => sum + productQty(prod), 0) ?? 0;

export const productName = (prod: ProductLike): string =>
  prod.product?.name || prod.description || PRODUCT_TYPES[prod.productType ?? ""] || "สินค้า";

export const techLabel = (print: PrintLike): string => PRINT_TYPES[print.printType] ?? print.printType;

export const positionLabel = (print: PrintLike): string => PRINT_POSITIONS[print.position] ?? print.position;

/** ป้ายขนาดลายแบบเดียวกับช่อง "ขนาด" ในฟอร์ม (A3 / A4 / กำหนดเอง) */
export function printSizeLabel(print: PrintLike): string {
  const key = print.printSize;
  if (key && PRINT_SIZES[key]) return key === "CUSTOM" ? PRINT_SIZES.CUSTOM.label : key;
  return print.width || print.height ? "กำหนดเอง" : "—";
}

export function printDims(print: PrintLike): string | null {
  return print.width || print.height ? `${print.width || 0} × ${print.height || 0}` : null;
}

/** บรรทัดรองของลาย: ขนาด · กว้าง×สูง ซม. · จำนวนสี */
export function printSubLine(print: PrintLike): string {
  const dims = printDims(print);
  return (
    [printSizeLabel(print), dims ? `${dims} ซม.` : null, print.colorCount != null ? `${print.colorCount} สี` : null]
      .filter((part) => part && part !== "—")
      .join(" · ") || "—"
  );
}

export function itemPieceRows<I extends ItemLike>(item: I): PieceRow<I["products"][number]>[] {
  return (item.products ?? []).flatMap((prod): PieceRow<I["products"][number]>[] => {
    const variants = prod.variants ?? [];
    // สินค้าที่ยังไม่มีไซซ์ = แถวเดียวจำนวน 0 (ให้เห็นว่ามีสินค้าแต่ยังไม่ได้ใส่จำนวน)
    if (variants.length === 0) return [{ key: prod.id, prod, color: null, size: null, qty: 0, variantId: null }];
    return variants.map((v) => ({
      key: v.id,
      prod,
      color: v.color ?? null,
      size: v.size || null,
      qty: v.quantity,
      variantId: v.id,
    }));
  });
}

/** จำนวนแถวที่ช่อง "สินค้า" ต้องคร่อม — 0 = แถวนี้ใช้ช่องของแถวก่อนหน้า */
export function productSpans(rows: PieceRow[]): number[] {
  const spans = rows.map(() => 0);
  rows.forEach((row, i) => {
    if (i > 0 && row.prod.id === rows[i - 1].prod.id) return;
    spans[i] = 1;
    for (let j = i + 1; j < rows.length && rows[j].prod.id === row.prod.id; j++) spans[i] += 1;
  });
  return spans;
}

export const unique = <T,>(values: T[]): T[] => [...new Set(values)];

/** จำนวนไซซ์ที่ไม่ซ้ำในชุดแถว — ใช้ในแถวรวมของแต่ละรายการ */
export const sizeCountOf = (rows: PieceRow[]): number => unique(rows.map((row) => row.size ?? "")).length;

/** เลขแถวแรกของแต่ละชุดงาน — ชุดงาน 2 เริ่มต่อจากแถวสุดท้ายของชุดงาน 1 (นับต่อกันทั้งใบเหมือนบิล) */
export function itemRowStarts(items: ItemLike[]): number[] {
  const starts: number[] = [];
  items.forEach((_, i) => {
    starts.push(i === 0 ? 0 : starts[i - 1] + itemPieceRows(items[i - 1]).length);
  });
  return starts;
}
