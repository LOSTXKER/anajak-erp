"use client";

import { Input } from "@/components/ui/input";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { ImageIcon } from "lucide-react";
import type { OrderItemForm, OrderItemProductForm } from "@/types/order-form";
import { ITEM_SOURCES } from "@/types/order-form";
import { getProductSourcePresentation } from "@/lib/order-item-composer";
import { useProductRow } from "./use-product-row";
import { CustomMadeSpecSummary } from "./custom-made-spec-summary";
import { ProductDetailRail } from "./product-detail-rail";
import { SizeMatrix } from "./size-matrix";
import { ProductRowActions } from "./product-row-actions";

// แถวสินค้า 1 ชิ้น — 8 คอลัมน์: แหล่ง · สินค้า · แพค · ราคา · ส่วนลด · จำนวน · รวม · จัดการ
// ทุกแหล่งอยู่ตารางเดียวกัน (เบสเคาะ D 2026-09-06 จาก /proto/product-rows — เลิกกล่องเทา ProductAdaptiveCard)
// ตัดเย็บ/ลูกค้าส่งมาได้ "แถวลูก" พื้นขาวใต้แถว: ตารางไซส์กางตลอด · สเปคตัดเย็บเป็นสรุป + แก้ใน popup
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
    qty, variantLabel, isFromStock, isCustomMade, isCustomerProvided,
    multi, totalQty, lineTotal,
    productLabel,
  } = useProductRow(product, prodIdx, itemIdx, onSetItems);
  const sourcePresentation = product.itemSource
    ? getProductSourcePresentation(product.itemSource)
    : null;

  // แถวข้อมูลเก่า/จากใบเสนอ itemSource เป็น null — ต้องมีช่องให้เลือก ไม่งั้น validation บล็อกการเซฟ
  const sourceBadge = sourcePresentation ? (
    <Badge variant={sourcePresentation.variant} size="sm">
      {sourcePresentation.label}
    </Badge>
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

  const dash = <span className="text-xs text-muted">—</span>;

  return (
    <>
      <tr>
        {/* แหล่ง */}
        <td className="py-2 pl-1 pr-3 align-top">{sourceBadge}</td>

        {/* สินค้า */}
        <td className="py-2 pr-2 align-top">
          {isFromStock ? (
            <div className="flex items-center gap-2">
              {product.productImageUrl ? (
                /* Signed URLs มาจาก Stock หลาย host จึงใช้รูปเดิมโดยไม่ผ่าน Next image optimizer */
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.productImageUrl} alt={productLabel} className="h-9 w-9 flex-shrink-0 rounded-lg border border-border object-cover" />
              ) : (
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted">
                  <ImageIcon className="h-4 w-4 text-muted" />
                </div>
              )}
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium text-strong">{productLabel}</span>
                {variantLabel && <span className="block text-xs text-muted">{variantLabel}</span>}
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                  {product.productSku && <span>{product.productSku}</span>}
                  {product.stockAvailable != null && (
                    <span className={product.stockAvailable > 0 ? "text-green-600 dark:text-green-400" : "text-red-700 dark:text-red-300"}>คลัง {product.stockAvailable}</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <Input
              aria-label={`ชื่อสินค้า ${prodIdx + 1}`}
              value={product.description}
              onChange={(e) => updateProduct("description", e.target.value)}
              placeholder={isCustomerProvided ? "ชื่อสินค้า เช่น เสื้อยืดลูกค้า" : "ชื่อสินค้า เช่น เสื้อคอกลม Cotton"}
              size="dense"
            />
          )}
        </td>

        {/* แพค */}
        <td className="px-2 py-2 align-top">
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
            <div className="flex h-9 items-center justify-center" title="ยังไม่มีตัวเลือกแพค">
              {dash}
            </div>
          )}
        </td>

        {/* ราคา */}
        <td className="px-2 py-2 text-center align-top">
          {isCustomerProvided ? dash : (
            <MoneyInput aria-label={`ราคาสินค้า ${prodIdx + 1}`} value={product.baseUnitPrice} onValueChange={(v) => updateProduct("baseUnitPrice", v)} size="dense" className="w-full px-2" />
          )}
        </td>

        {/* ส่วนลดต่อชิ้น */}
        <td className="px-2 py-2 text-center align-top">
          {isCustomerProvided ? dash : (
            <MoneyInput aria-label={`ส่วนลดต่อชิ้น สินค้า ${prodIdx + 1}`} value={product.discount} onValueChange={(v) => updateProduct("discount", v)} size="dense" className="w-full px-2" />
          )}
        </td>

        {/* จำนวน */}
        <td className="px-2 py-2 align-top">
          {multi ? (
            <div className="flex h-9 items-center justify-center text-sm font-medium text-secondary">{totalQty}</div>
          ) : (
            <NumberInput integer aria-label={`จำนวนสินค้า ${prodIdx + 1}`} min={0} value={qty} onValueChange={(v) => updateVariantField("quantity", v)} placeholder="0" size="dense" className="w-full text-center" />
          )}
        </td>

        {/* รวม — กึ่งกลางตรงหัวคอลัมน์ (เบสเคาะ 2026-08-04) */}
        <td className="px-2 py-2 text-center align-top">
          {isCustomerProvided ? dash : (
            <div className="flex h-9 items-center justify-center text-sm font-semibold tabular-nums text-strong">{formatCurrency(lineTotal)}</div>
          )}
        </td>

        {/* จัดการ — เมนูเดียวพอดีกับคอลัมน์ 44px ไม่ซ้อนลูกศรสูง 72px */}
        <td className="py-2 pr-1 align-top">
          <ProductRowActions
            mode="menu"
            productIndex={prodIdx}
            totalProducts={totalProducts}
            onMove={moveProduct}
            onRemove={removeProduct}
          />
        </td>
      </tr>

      {/* แถวลูกของตัดเย็บ/ลูกค้าส่งมา — ไซส์กางตลอด · สเปคสรุป+popup (เบสเคาะ D 2026-09-06) */}
      {multi && (
        <tr>
          <td aria-hidden="true" />
          <td colSpan={7} className="pb-4 pr-2 pt-1">
            <ProductDetailRail className="space-y-3">
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
