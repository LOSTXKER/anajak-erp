import type { ReserveLine } from "@/lib/stock-api";

export interface ReservableVariant {
  size: string;
  color: string | null;
  quantity: number;
}

export interface ReservableProduct {
  itemSource: string | null;
  productId: string | null;
  description: string;
  variants: ReservableVariant[];
}

export interface MirrorVariant {
  id: string;
  sku: string;
  size: string;
  color: string;
}

export interface MirrorProduct {
  id: string;
  sku: string;
  name: string;
  variants: MirrorVariant[];
}

export interface RichReserveLine {
  sku: string;
  qty: number;
  note?: string;
  productId: string;
  variantId: string | null;
  productName: string;
  size: string;
  color: string | null;
}

export interface BuildReserveLinesResult {
  lines: RichReserveLine[];
  totalQty: number;
  problems: string[];
}

export function toReserveLines(lines: RichReserveLine[]): ReserveLine[] {
  return lines.map((line) => ({
    sku: line.sku,
    qty: line.qty,
    ...(line.note ? { note: line.note } : {}),
  }));
}

export function buildReserveLines(
  products: ReservableProduct[],
  mirror: MirrorProduct[],
): BuildReserveLinesResult {
  const mirrorById = new Map(mirror.map((product) => [product.id, product]));
  const bySku = new Map<string, RichReserveLine>();
  const problems: string[] = [];

  for (const product of products) {
    if (product.itemSource !== "FROM_STOCK" || !product.productId) continue;
    const mirroredProduct = mirrorById.get(product.productId);
    if (!mirroredProduct) {
      problems.push(
        `ไม่พบสินค้า "${product.description}" ในข้อมูล sync จาก Stock`,
      );
      continue;
    }

    for (const variant of product.variants) {
      if (variant.quantity <= 0) continue;
      const mirroredVariant = mirroredProduct.variants.find(
        (candidate) =>
          candidate.size === variant.size &&
          (!variant.color || candidate.color === variant.color),
      );
      let sku = mirroredVariant?.sku;
      let note: string | undefined;
      if (!sku) {
        sku = mirroredProduct.sku;
        note = `ไม่พบ variant ${variant.size}${variant.color ? `/${variant.color}` : ""} — จองระดับสินค้า`;
        problems.push(
          `${mirroredProduct.name}: ไม่พบ variant ไซส์ ${variant.size}${variant.color ? ` สี ${variant.color}` : ""}`,
        );
      }

      const entry = bySku.get(sku) ?? {
        sku,
        qty: 0,
        productId: mirroredProduct.id,
        variantId: mirroredVariant?.id ?? null,
        productName: mirroredProduct.name,
        size: variant.size,
        color: variant.color,
      };
      entry.qty += variant.quantity;
      if (note) entry.note = note;
      bySku.set(sku, entry);
    }
  }

  const lines = [...bySku.values()];
  return {
    lines,
    totalQty: lines.reduce((sum, line) => sum + line.qty, 0),
    problems,
  };
}
