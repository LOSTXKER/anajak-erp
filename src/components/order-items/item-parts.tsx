/* ============================================================
   ชิ้นส่วนที่วาดรายการสินค้า — ใช้ร่วมหน้าออเดอร์กับใบผลิต

   ไม่มี query ไม่มีเงินในตัวเอง: หน้าออเดอร์ส่งบล็อกราคาเข้ามาทาง prop `cost`
   ใบผลิตไม่ส่งอะไรเลย จึงไม่มีทางที่เงินจะหลุดขึ้นจอผลิต (SPEC: ใบผลิตห้ามมีเงิน)
   ============================================================ */

import type { ReactNode } from "react";
import { FileText, ImageIcon } from "lucide-react";

import { c, Thumb } from "@/components/kit/kit";
import { TechChip } from "@/components/orders/orders-ui";
import { getProductSourcePresentation } from "@/lib/order-item-composer";
import { isImageUrl } from "@/lib/utils";
import { PRODUCT_TYPES } from "@/types/order-form";
import {
  positionLabel,
  printSubLine,
  productName,
  techLabel,
  unique,
  type ItemLike,
  type PieceRow,
  type PrintLike,
  type ProductLike,
} from "./rows";

/** รูปลาย: ของจริงจากคลังลายก่อน แล้วค่อยไฟล์ที่แนบตอนขาย */
export const printImage = (print: PrintLike): string | null =>
  [print.artwork?.imageUrl, print.designImageUrl].find((url) => isImageUrl(url)) ?? null;

export function PrintThumb({ print }: { print: PrintLike }) {
  const image = printImage(print);
  const alt = `ลาย ${positionLabel(print)}`;
  if (image) {
    return (
      <a href={image} target="_blank" rel="noreferrer" title="เปิดภาพเต็ม" className={c("thumb")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- รูปลายจากคลัง/ไฟล์ที่อัปโหลด */}
        <img src={image} alt={alt} loading="lazy" decoding="async" />
      </a>
    );
  }
  if (print.designImageUrl) {
    // มีไฟล์แต่ไม่ใช่รูป (เช่น .ai/.pdf) — ยังต้องกดเปิดได้ ไม่ใช่ขึ้นว่าไม่มีไฟล์
    return (
      <a
        href={print.designImageUrl}
        target="_blank"
        rel="noreferrer"
        title="เปิดไฟล์แบบ"
        aria-label={`เปิดไฟล์แบบ ${alt}`}
        className={c("thumb")}
      >
        <FileText aria-hidden="true" />
      </a>
    );
  }
  return (
    <span className={c("thumb")} title="ยังไม่มีไฟล์แบบ">
      <ImageIcon aria-hidden="true" />
      <span className={c("sr")}>ยังไม่มีไฟล์แบบ</span>
    </span>
  );
}

/**
 * ลายของชุดงาน — แถบเดียวเหนือตาราง ไม่ซ้ำทุกแถว (เบสเคาะ 2026-09-17 จากต้นแบบ
 * "ทำหน้ารายการใหม่ แต่เป็นแบบตารางเหมือนเดิม") · เหตุผลเดิมของการแยกแถวละตัวคือ
 * "สกรีนกรอกครั้งเดียว แต่เสื้อมีหลายไซส์" การแปะลายซ้ำทุกแถวจึงขัดกับเหตุผลนั้นเอง
 *
 * ใบผลิตส่ง prints ที่กรองตามชนิดขั้นเข้ามา (ขั้นรีดร้อนไม่ต้องเห็นลายปัก) และส่ง
 * extraNote สำหรับค่าความร้อนของขั้นนั้น
 */
export function PrintStrip({
  prints,
  cost,
  extraNote,
}: {
  prints: PrintLike[];
  /** บล็อกราคาทางขวา — หน้าออเดอร์เท่านั้น */
  cost?: ReactNode;
  extraNote?: (print: PrintLike) => string | null;
}) {
  if (prints.length === 0) return null;
  return (
    <div className={c("pstrip")}>
      <div className={c("pstrip-list")}>
        {prints.map((print) => {
          const extra = extraNote?.(print) ?? null;
          const note = [print.designNote?.trim() || null, extra].filter(Boolean).join(" · ") || null;
          return (
            <div key={print.id} className={c("prod")}>
              <PrintThumb print={print} />
              <div style={{ minWidth: 0 }}>
                <b style={{ fontWeight: 500 }}>
                  {techLabel(print)} <span className={c("chip gray")}>{positionLabel(print)}</span>
                </b>
                <span className={c("sub")}>{printSubLine(print)}</span>
                {note ? (
                  <span className={c("sub")} style={{ overflowWrap: "anywhere" }}>
                    {note}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {cost}
    </div>
  );
}

/** บรรทัดรองของช่องสินค้า: สี · รหัส · แพค · ชนิดสินค้าเมื่อไม่ใช่ของในสต๊อก */
export function productSubLine(row: PieceRow): string[] {
  const { prod } = row;
  return [
    row.color,
    prod.product?.sku ?? null,
    prod.packagingOption?.name ? `แพค ${prod.packagingOption.name}` : null,
    prod.itemSource && prod.itemSource !== "FROM_STOCK" && prod.productType
      ? (PRODUCT_TYPES[prod.productType] ?? prod.productType)
      : null,
  ].filter((part): part is string => Boolean(part));
}

/** ช่อง "สินค้า" ที่คร่อมทุกแถวไซซ์ของสินค้าตัวเดียวกัน */
export function ProductCell({ row, rowSpan }: { row: PieceRow; rowSpan: number }) {
  const sub = productSubLine(row);
  return (
    <td className={c("pcell")} rowSpan={rowSpan}>
      <div className={c("prod")}>
        <Thumb cover={row.prod.product?.imageUrl ?? null} alt="" />
        <div style={{ minWidth: 0 }}>
          <b style={{ fontWeight: 500, overflowWrap: "anywhere" }}>{productName(row.prod)}</b>
          {sub.length > 0 ? <span className={c("sub")}>{sub.join(" · ")}</span> : null}
        </div>
      </div>
    </td>
  );
}

/** ที่มาเสื้อที่ต้องบอก (ของลูกค้า/ตัดเย็บ) — ของในสต๊อกเป็นค่าปกติ ไม่ต้องมีป้าย */
export const itemSourceLabels = (products: ProductLike[]): string[] =>
  unique(
    products
      .map((prod) => prod.itemSource)
      .filter((source): source is string => Boolean(source) && source !== "FROM_STOCK"),
  ).map((source) => getProductSourcePresentation(source).label);

/** หัวชุดงาน: เลขลำดับ · ชื่อ · ที่มาเสื้อ · วิธีพิมพ์ · (ใบผลิตเติมจำนวนท้ายแถว) */
export function ItemHead({
  item,
  index,
  right,
  prints,
}: {
  item: ItemLike;
  index: number;
  right?: ReactNode;
  /** ชิปวิธีพิมพ์ — ใบผลิตส่งเฉพาะลายของขั้นนั้น จะได้ไม่บอกว่าขั้นรีดร้อนต้องปักด้วย */
  prints?: PrintLike[];
}) {
  return (
    <div className={c("item-head")}>
      <span className={c("item-no")}>{index + 1}</span>
      <b>{item.description || `รายการที่ ${index + 1}`}</b>
      {itemSourceLabels(item.products ?? []).map((label) => (
        <span key={label} className={c("chip line")}>
          {label}
        </span>
      ))}
      {unique((prints ?? item.prints ?? []).map(techLabel)).map((tech) => (
        <TechChip key={tech} label={tech} />
      ))}
      {right}
    </div>
  );
}
