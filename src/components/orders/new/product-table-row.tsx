"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Trash2,
  ImageIcon,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
} from "lucide-react";
import type { OrderItemForm, OrderItemProductForm } from "@/types/order-form";
import { ITEM_SOURCES } from "@/types/order-form";
import { getProductSourcePresentation } from "@/lib/order-item-composer";
import { useProductRow } from "./use-product-row";
import { CustomMadeDetail } from "./custom-made-detail";
import { SizeMatrix } from "./size-matrix";

// แถวสินค้า 1 ชิ้น — 8 คอลัมน์: แหล่ง · สินค้า · แพค · ราคา · ส่วนลด · จำนวน · รวม · จัดการ
// สเปคตัดเย็บและหลายไซส์ยังอยู่แถวเสริมเต็มกว้าง เพราะเป็นข้อมูลหลายช่องในตัวเอง
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
    setShowMatrix,
    updateProduct, updateVariantField, removeProduct, moveProduct,
    packagingOptions,
    qty, variant, isFromStock, isCustomMade, isCustomerProvided,
    canMatrix, multi, totalQty, lineTotal,
    productLabel, variantLabel,
  } = useProductRow(product, prodIdx, itemIdx, totalProducts, onSetItems);
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
                <img src={product.productImageUrl} alt={productLabel} className="h-9 w-9 flex-shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
              ) : (
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.06]">
                  <ImageIcon className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                </div>
              )}
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{productLabel}</span>
                {variantLabel && <span className="block text-xs text-muted">{variantLabel}</span>}
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                  {product.productSku && <span>{product.productSku}</span>}
                  {product.stockAvailable != null && (
                    <span className={product.stockAvailable > 0 ? "text-green-600 dark:text-green-400" : "text-red-700 dark:text-red-300"}>คลัง {product.stockAvailable}</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Input
                aria-label={`ชื่อสินค้า ${prodIdx + 1}`}
                value={product.description}
                onChange={(e) => updateProduct("description", e.target.value)}
                placeholder={isCustomerProvided ? "ชื่อสินค้า เช่น เสื้อยืดลูกค้า" : "ชื่อสินค้า เช่น เสื้อคอกลม Cotton"}
                size="dense"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {multi ? (
                  <span className="text-xs text-muted">หลายไซส์ · รวม {totalQty} ตัว{variant.color ? ` · ${variant.color}` : ""}</span>
                ) : (
                  <>
                    <Input aria-label={`สีสินค้า ${prodIdx + 1}`} value={variant.color} onChange={(e) => updateVariantField("color", e.target.value)} placeholder="สี" size="dense" className="w-20 px-2" />
                    <Input aria-label={`ไซส์สินค้า ${prodIdx + 1}`} value={variant.size} onChange={(e) => updateVariantField("size", e.target.value)} placeholder="ไซส์" size="dense" className="w-16 px-2" />
                  </>
                )}
                {canMatrix && (
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => setShowMatrix((v) => !v)}
                    aria-expanded={multi}
                    disabled={product.variants.length > 1}
                    className={cn("h-8 gap-1.5 px-2 text-xs", multi && "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-300")}
                    title={product.variants.length > 1 ? "ล้างจำนวนไซส์ให้เหลือไซส์เดียวก่อนปิด" : "กรอกหลายไซส์ในแถวเดียว"}
                  >
                    <LayoutGrid />{multi ? "ปิดหลายไซส์" : "หลายไซส์"}
                  </Button>
                )}
              </div>
            </div>
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
            <div className="flex h-9 items-center justify-center text-sm font-medium text-slate-700 dark:text-slate-200">{totalQty}</div>
          ) : (
            <NumberInput integer aria-label={`จำนวนสินค้า ${prodIdx + 1}`} min={0} value={qty} onValueChange={(v) => updateVariantField("quantity", v)} placeholder="0" size="dense" className="w-full text-center" />
          )}
        </td>

        {/* รวม — กึ่งกลางตรงหัวคอลัมน์ (เบสเคาะ 2026-08-04) */}
        <td className="px-2 py-2 text-center align-top">
          {isCustomerProvided ? dash : (
            <div className="flex h-9 items-center justify-center text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">{formatCurrency(lineTotal)}</div>
          )}
        </td>

        {/* ลบ + เลื่อนลำดับ */}
        <td className="py-2 pr-1 align-top">
          <div className="flex items-center justify-end gap-0.5">
            {totalProducts > 1 && (
              <div className="flex flex-col">
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`เลื่อนสินค้า ${prodIdx + 1} ขึ้น`} onClick={() => moveProduct(-1)} disabled={prodIdx === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-30 dark:text-slate-600 dark:hover:text-slate-300">
                  <ChevronUp />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`เลื่อนสินค้า ${prodIdx + 1} ลง`} onClick={() => moveProduct(1)} disabled={prodIdx === totalProducts - 1} className="text-slate-300 hover:text-slate-600 disabled:opacity-30 dark:text-slate-600 dark:hover:text-slate-300">
                  <ChevronDown />
                </Button>
              </div>
            )}
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`ลบสินค้า ${prodIdx + 1}`} onClick={removeProduct} className="text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400">
              <Trash2 />
            </Button>
          </div>
        </td>
      </tr>

      {/* สเปคตัดเย็บ (CUSTOM_MADE) — แถวเสริมเต็มกว้าง */}
      {isCustomMade && (
        <tr>
          <td aria-hidden="true" />
          <td colSpan={7} className="pb-3 pt-1 pr-1">
            <CustomMadeDetail product={product} updateProduct={updateProduct} />
          </td>
        </tr>
      )}

      {/* หลายไซส์ — ตารางกรอกไซส์×จำนวน (ก้อน 4 / P1.12) */}
      {multi && (
        <tr>
          <td aria-hidden="true" />
          <td colSpan={7} className="pb-3 pt-1 pr-1">
            <SizeMatrix variants={product.variants} onChange={(v) => updateProduct("variants", v)} />
          </td>
        </tr>
      )}
    </>
  );
}
