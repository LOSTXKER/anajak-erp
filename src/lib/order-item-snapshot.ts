// ภาพถ่ายรายการออเดอร์ ณ ก่อน/หลังแก้ — เก็บลง OrderRevision.oldValue/newValue
//
// ทำไมต้องมี: ทุกประตูที่แก้รายการ (saveForm · updateItems · applyChangeOrder) ลบแถวเดิมทิ้ง
// แล้วสร้างใหม่ (deleteMany + create) ส่วน revision เดิมจดไว้แค่ยอดเงินก่อน–หลัง ของจริงจึงหาย
// ถาวร — ย้อนดูไม่ได้เลยว่าเคยสั่งไซซ์/สี/ลายอะไร ซึ่งเป็นคำถามแรกเวลาลูกค้าเคลมหรือขอแก้งาน
// หลังรับของไปแล้ว (งานแก้/เคลม ก้อน 0 — เบสสั่ง 2026-09-18)
//
// เก็บเป็น JSON ย่อ ชื่อ field สั้นเพราะลงคอลัมน์ text และจดทุกครั้งที่มีการแก้
// ราคาอยู่ในนี้ด้วย — DTO ของ order.getById ตัด oldValue/newValue ทิ้งให้ role ที่ไม่เห็นเงิน
// อยู่แล้ว (นโยบาย ⑦) จึงไม่มีทางไหลถึง browser ของช่าง/กราฟิก

export interface OrderItemSnapshotVariant {
  /** ไซซ์ */
  s: string;
  /** สี (ถ้ามี) */
  c?: string;
  /** จำนวน */
  q: number;
}

export interface OrderItemSnapshotProduct {
  /** ชื่อ/คำอธิบายสินค้า */
  d: string;
  /** ราคาต่อตัวก่อนส่วนลด */
  u: number;
  v: OrderItemSnapshotVariant[];
}

export interface OrderItemSnapshotEntry {
  /** คำอธิบายชุดงาน */
  d: string;
  /** จำนวนรวมของชุด */
  q: number;
  p: OrderItemSnapshotProduct[];
  /** งานพิมพ์: "ตำแหน่ง · เทคนิค" */
  pr?: string[];
}

type DecimalLike = { toNumber(): number } | number | string | null | undefined;

function num(value: DecimalLike): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return typeof value.toNumber === "function" ? value.toNumber() : 0;
}

interface ItemLike {
  description?: string | null;
  totalQuantity?: number | null;
  products?: {
    description?: string | null;
    baseUnitPrice?: DecimalLike;
    variants?: { size?: string | null; color?: string | null; quantity?: number | null }[] | null;
  }[] | null;
  prints?: { position?: string | null; printType?: string | null }[] | null;
}

/** ย่อรายการที่อ่านมาจากฐาน (พร้อม products.variants และ prints) ให้เป็นภาพถ่ายชุดเดียว */
export function snapshotOrderItems(items: readonly ItemLike[] | null | undefined): OrderItemSnapshotEntry[] {
  return (items ?? []).map((item) => {
    const entry: OrderItemSnapshotEntry = {
      d: item.description ?? "",
      q: item.totalQuantity ?? 0,
      p: (item.products ?? []).map((product) => ({
        d: product.description ?? "",
        u: num(product.baseUnitPrice),
        v: (product.variants ?? []).map((variant) => {
          const line: OrderItemSnapshotVariant = {
            s: variant.size ?? "",
            q: variant.quantity ?? 0,
          };
          if (variant.color) line.c = variant.color;
          return line;
        }),
      })),
    };
    const prints = (item.prints ?? [])
      .map((print) => [print.position, print.printType].filter(Boolean).join(" · "))
      .filter((text) => text.length > 0);
    if (prints.length > 0) entry.pr = prints;
    return entry;
  });
}

/** select ของ prisma ที่ snapshotOrderItems ต้องใช้ — ให้ทุกประตูอ่านชุดเดียวกัน */
export const ORDER_ITEM_SNAPSHOT_INCLUDE = {
  products: { include: { variants: true } },
  prints: true,
} as const;
