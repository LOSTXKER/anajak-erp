"use client";

import type { ReactNode } from "react";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { c, Thumb } from "@/components/kit/kit";
import { formatBaht } from "@/lib/utils";
import { ImageIcon, Scissors, Shirt } from "lucide-react";
import type { OrderItemForm, OrderItemProductForm } from "@/types/order-form";
import { ITEM_SOURCES } from "@/types/order-form";
import { getProductSourcePresentation } from "@/lib/order-item-composer";
import { useProductRow } from "./use-product-row";
import { CustomMadeSpecSummary } from "./custom-made-spec-summary";
import { ProductDetailRail } from "./product-detail-rail";
import { SizeMatrix } from "./size-matrix";
import { ProductRowActions } from "./product-row-actions";

/** สีชิปแหล่งตามต้นแบบ 2026-09-18: จากสต็อก = ฟ้า · ของที่ไม่ได้มาจากคลัง (ตัดเย็บ/ลูกค้าส่งมา) = ส้ม */
export const sourceChipClass = (source: string) => c("chip", source === "FROM_STOCK" ? "blue" : "warn");

/** คั่นข้อมูลบรรทัดรองด้วยจุดกลาง — ข้ามช่องที่ว่าง */
function joinDots(parts: ReactNode[]) {
  return parts
    .filter((part) => part !== null && part !== undefined && part !== false && part !== "")
    .flatMap((part, index) => (index === 0 ? [part] : [" · ", part]));
}

/** บรรทัดรองใต้ชื่อสินค้า (ใช้ทั้งแถวตารางและการ์ดจอแคบ)
 *  สต็อก: สี · ไซส์ · รหัส · คลัง N (เขียว/แดง) · ที่เหลือ: สี · ไซส์ที่มี หรือบอกว่ายังไม่ได้ใส่ */
export function ProductSubLine({ product }: { product: OrderItemProductForm }) {
  const variants = product.variants ?? [];
  const parts =
    product.itemSource === "FROM_STOCK"
      ? joinDots([
          variants[0]?.color,
          variants[0]?.size,
          product.productSku ? <span key="sku" className={c("mono")}>{product.productSku}</span> : null,
          product.stockAvailable != null ? (
            <span key="stock" className={c(product.stockAvailable > 0 ? "ok" : "no")}>
              คลัง {product.stockAvailable.toLocaleString("th-TH")}
            </span>
          ) : null,
        ])
      : joinDots([variants[0]?.color, variants.map((v) => v.size).filter(Boolean).join(", ")]);
  if (parts.length > 0) return <span className={c("sub")}>{parts}</span>;
  return product.itemSource === "FROM_STOCK" ? null : <span className={c("sub")}>ยังไม่ได้ใส่สี/ไซส์</span>;
}

// แถวสินค้า 1 ชิ้น — 8 คอลัมน์: แหล่ง · สินค้า · แพค · ราคา/ตัว · ส่วนลด/ตัว · จำนวน · รวม · จัดการ
// ทุกแหล่งอยู่ตารางเดียวกัน (เบสเคาะ D 2026-09-06 จาก /proto/product-rows — เลิกกล่องเทา ProductAdaptiveCard)
// ตัดเย็บ/ลูกค้าส่งมาได้ "แถวลูก" ใต้แถว: สเปคตัดเย็บเป็นสรุป + แก้ใน popup · ตารางไซส์กางตลอด
export function ProductTableRow({
  product, prodIdx, itemIdx, totalProducts, onSetItems,
}: {
  product: OrderItemProductForm;
  prodIdx: number;
  itemIdx: number;
  totalProducts: number;
  onSetItems: (updater: (prev: OrderItemForm[]) => OrderItemForm[]) => void;
}) {
  const {
    updateProduct, updateVariantField, removeProduct, moveProduct,
    packagingOptions,
    qty, isFromStock, isCustomMade, isCustomerProvided,
    multi, totalQty, lineTotal,
    productLabel,
  } = useProductRow(product, prodIdx, itemIdx, onSetItems);

  // แถวข้อมูลเก่า/จากใบเสนอ itemSource เป็น null — ต้องมีช่องให้เลือก ไม่งั้น validation บล็อกการเซฟ
  const sourceCell = product.itemSource ? (
    <span className={sourceChipClass(product.itemSource)}>
      {getProductSourcePresentation(product.itemSource).label}
    </span>
  ) : (
    <Select
      size="dense"
      value=""
      onChange={(e) => { if (e.target.value) updateProduct("itemSource", e.target.value); }}
      aria-label="เลือกแหล่งที่มาของสินค้า"
    >
      <option value="">แหล่ง...</option>
      {Object.entries(ITEM_SOURCES)
        .filter(([key]) => key !== "FROM_STOCK")
        .map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </Select>
  );

  // ขีดของช่องที่ไม่มีค่า (ลูกค้าส่งมาไม่มีราคาเสื้อ) — สูงเท่าช่องกรอกในแถวเดียวกัน
  const dash = <span className={c("ro dsh")}>—</span>;

  return (
    <>
      <tr className={multi ? c("prow") : undefined}>
        <td className={c("va")}>{sourceCell}</td>

        {/* สินค้า — ทุกแหล่งอ่านเป็นแบบเดียวกัน: รูปย่อ · ชื่อ · บรรทัดรอง
            (เบสทัก 2026-09-18 "ลูกค้าส่งมา กับ สั่งทำ ดูยาก ไม่เหมือนกับเสื้อสต๊อค") */}
        <td className={c("va")}>
          <span className={c("prod")}>
            {isFromStock ? (
              // รูปจริงจาก Stock (ต้นแบบวาดเสื้อสีงานแทนรูป)
              <Thumb cover={product.productImageUrl ?? null} alt="" />
            ) : (
              <span className={c("thumb ghost")} aria-hidden="true">
                {isCustomMade ? <Scissors /> : isCustomerProvided ? <Shirt /> : <ImageIcon />}
              </span>
            )}
            <span className={c("pcol")}>
              {isFromStock ? (
                <b>{productLabel}</b>
              ) : (
                <input
                  className={c("pname")}
                  aria-label={`ชื่อสินค้า ${prodIdx + 1}`}
                  value={product.description}
                  onChange={(e) => updateProduct("description", e.target.value)}
                  placeholder={isCustomerProvided ? "ชื่อสินค้า เช่น เสื้อยืดลูกค้า" : "ชื่อสินค้า เช่น เสื้อคอกลม Cotton"}
                />
              )}
              <ProductSubLine product={product} />
            </span>
          </span>
        </td>

        <td className={c("va")}>
          {packagingOptions && packagingOptions.length > 0 ? (
            <Select
              size="dense"
              aria-label={`แพคสินค้า ${prodIdx + 1}`}
              value={product.packagingOptionId}
              onChange={(e) => updateProduct("packagingOptionId", e.target.value)}
            >
              <option value="">—</option>
              {packagingOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          ) : (
            <span className={c("ro dsh")} title="ยังไม่มีตัวเลือกแพค">—</span>
          )}
        </td>

        <td className={c("va num")}>
          {isCustomerProvided ? dash : (
            <MoneyInput currency aria-label={`ราคาต่อตัว สินค้า ${prodIdx + 1}`} value={product.baseUnitPrice} onValueChange={(v) => updateProduct("baseUnitPrice", v)} size="dense" />
          )}
        </td>

        <td className={c("va num")}>
          {isCustomerProvided ? dash : (
            <MoneyInput currency aria-label={`ส่วนลดต่อตัว สินค้า ${prodIdx + 1}`} value={product.discount} onValueChange={(v) => updateProduct("discount", v)} size="dense" />
          )}
        </td>

        {/* หลายไซส์ = ผลรวมจากตารางไซส์ใต้แถว อ่านอย่างเดียว */}
        <td className={c("va ctr")}>
          {multi ? (
            <span className={c("ro")}>{totalQty.toLocaleString("th-TH")}</span>
          ) : (
            <NumberInput integer aria-label={`จำนวนสินค้า ${prodIdx + 1}`} min={0} value={qty} onValueChange={(v) => updateVariantField("quantity", v)} placeholder="0" size="dense" className="px-1 text-center" />
          )}
        </td>

        <td className={c("va num mono")}>
          {isCustomerProvided ? dash : (
            <span className={c("ro")}><b>{formatBaht(lineTotal)}</b></span>
          )}
        </td>

        {/* จัดการ — แถวเดียว = ปุ่มลบ · หลายแถว = เมนู เลื่อนขึ้น/ลง/ลบ */}
        <td className={c("va act")}>
          <ProductRowActions
            mode="menu"
            productIndex={prodIdx}
            totalProducts={totalProducts}
            onMove={moveProduct}
            onRemove={removeProduct}
          />
        </td>
      </tr>

      {multi && (
        <tr className={c("subrow")}>
          <td aria-hidden="true" />
          <td colSpan={7}>
            <ProductDetailRail>
              {isCustomMade && <CustomMadeSpecSummary product={product} updateProduct={updateProduct} />}
              <SizeMatrix
                embedded
                idPrefix={`desktop-size-${itemIdx}-${prodIdx}`}
                title={isCustomerProvided ? "จำนวนที่ลูกค้าส่งมา" : "ไซส์และจำนวน"}
                variants={product.variants}
                onChange={(v) => updateProduct("variants", v)}
              />
            </ProductDetailRail>
          </td>
        </tr>
      )}
    </>
  );
}
