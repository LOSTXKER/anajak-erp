"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
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

// แถวสินค้า 1 ชิ้น — 5 คอลัมน์หลัก: แหล่ง · สินค้า · ราคา · จำนวน · รวม (+ ลบ)
// ส่วนลด/แพคและสเปคที่เกี่ยวข้องกางให้เห็นตลอดตามชนิดสินค้า
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
    <NativeSelect
      value=""
      onChange={(e) => { if (e.target.value) updateProduct("itemSource", e.target.value); }}
      className="text-xs"
      aria-label="เลือกแหล่งที่มาของสินค้า"
    >
      <option value="">แหล่ง...</option>
      {Object.entries(ITEM_SOURCES)
        .filter(([key]) => key !== "FROM_STOCK")
        .map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </NativeSelect>
  );

  const dash = <span className="text-xs text-slate-300">—</span>;

  return (
    <>
      <tr className="border-b border-slate-100 dark:border-slate-800">
        {/* แหล่ง */}
        <td className="py-2 pl-1 align-top">{sourceBadge}</td>

        {/* สินค้า */}
        <td className="py-2 pr-2 align-top">
          {isFromStock ? (
            <div className="flex items-center gap-2">
              {product.productImageUrl ? (
                /* Signed URLs มาจาก Stock หลาย host จึงใช้รูปเดิมโดยไม่ผ่าน Next image optimizer */
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.productImageUrl} alt={productLabel} className="h-9 w-9 flex-shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
              ) : (
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                  <ImageIcon className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                </div>
              )}
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{productLabel}</span>
                {variantLabel && <span className="block text-xs text-slate-500">{variantLabel}</span>}
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                  {product.productSku && <span>{product.productSku}</span>}
                  {product.stockAvailable != null && (
                    <span className={product.stockAvailable > 0 ? "text-green-600" : "text-red-500"}>คลัง {product.stockAvailable}</span>
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
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {multi ? (
                  <span className="text-xs text-slate-500">หลายไซส์ · รวม {totalQty} ตัว{variant.color ? ` · ${variant.color}` : ""}</span>
                ) : (
                  <>
                    <Input aria-label={`สีสินค้า ${prodIdx + 1}`} value={variant.color} onChange={(e) => updateVariantField("color", e.target.value)} placeholder="สี" className="w-20 px-2 sm:h-9 sm:text-xs" />
                    <Input aria-label={`ไซส์สินค้า ${prodIdx + 1}`} value={variant.size} onChange={(e) => updateVariantField("size", e.target.value)} placeholder="ไซส์" className="w-16 px-2 sm:h-9 sm:text-xs" />
                  </>
                )}
                {canMatrix && (
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => setShowMatrix((v) => !v)}
                    aria-expanded={multi}
                    disabled={product.variants.length > 1}
                    className={cn("h-8 gap-1 px-2 text-xs", multi && "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-300")}
                    title={product.variants.length > 1 ? "ล้างจำนวนไซส์ให้เหลือไซส์เดียวก่อนปิด" : "กรอกหลายไซส์ในแถวเดียว"}
                  >
                    <LayoutGrid className="h-3 w-3" />{multi ? "ปิดหลายไซส์" : "หลายไซส์"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </td>

        {/* ราคา */}
        <td className="px-1.5 py-2 align-top">
          {isCustomerProvided ? dash : (
            <Input aria-label={`ราคาสินค้า ${prodIdx + 1}`} type="number" min={0} step={0.01} value={product.baseUnitPrice || ""} onChange={(e) => updateProduct("baseUnitPrice", parseFloat(e.target.value) || 0)} placeholder="0" className="w-full text-right" />
          )}
        </td>

        {/* จำนวน */}
        <td className="px-1.5 py-2 align-top">
          {multi ? (
            <div className="flex h-9 items-center justify-center text-sm font-medium text-slate-700 dark:text-slate-200">{totalQty}</div>
          ) : (
            <Input aria-label={`จำนวนสินค้า ${prodIdx + 1}`} type="number" min={0} value={qty || ""} onChange={(e) => updateVariantField("quantity", parseInt(e.target.value) || 0)} placeholder="0" className="w-full text-center" />
          )}
        </td>

        {/* รวม */}
        <td className="px-1.5 py-2 text-right align-top">
          {isCustomerProvided ? dash : (
            <div className="flex h-9 items-center justify-end text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">{formatCurrency(lineTotal)}</div>
          )}
        </td>

        {/* ลบ + เลื่อนลำดับ */}
        <td className="py-2 pr-1 align-top">
          <div className="flex items-center justify-end gap-0.5">
            {totalProducts > 1 && (
              <div className="flex flex-col">
                <Button type="button" variant="ghost" size="icon" aria-label={`เลื่อนสินค้า ${prodIdx + 1} ขึ้น`} onClick={() => moveProduct(-1)} disabled={prodIdx === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-30 sm:min-w-9 dark:text-slate-600 dark:hover:text-slate-300">
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`เลื่อนสินค้า ${prodIdx + 1} ลง`} onClick={() => moveProduct(1)} disabled={prodIdx === totalProducts - 1} className="text-slate-300 hover:text-slate-600 disabled:opacity-30 sm:min-w-9 dark:text-slate-600 dark:hover:text-slate-300">
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <Button type="button" variant="ghost" size="icon" aria-label={`ลบสินค้า ${prodIdx + 1}`} onClick={removeProduct} className="text-red-500 hover:bg-red-50 hover:text-red-600 sm:min-w-9 dark:hover:bg-red-950/40">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>

      {/* ส่วนลด + แพค — แสดงตลอด ไม่ซ่อนค่าที่ตั้งไว้ */}
      <tr className="border-b border-slate-100 dark:border-slate-800">
        <td aria-hidden="true" />
        <td colSpan={5} className="pb-3 pl-1 pt-1">
            <div className="grid grid-cols-2 gap-3">
              {!isCustomerProvided && (
                <Field label="ส่วนลดต่อชิ้น">
                  <Input type="number" min={0} step={0.01} value={product.discount || ""} onChange={(e) => updateProduct("discount", parseFloat(e.target.value) || 0)} placeholder="0" className="w-full text-right" />
                </Field>
              )}
              {packagingOptions && packagingOptions.length > 0 ? (
                <Field label="แพค">
                  <NativeSelect value={product.packagingOptionId} onChange={(e) => updateProduct("packagingOptionId", e.target.value)}>
                    <option value="">—</option>
                    {packagingOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                  </NativeSelect>
                </Field>
              ) : (
                <div>
                  <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">แพค</p>
                  <span className="text-xs text-slate-400">ยังไม่มีตัวเลือกแพค</span>
                </div>
              )}
            </div>
        </td>
      </tr>

      {/* สเปคตัดเย็บ (CUSTOM_MADE) — แถวเสริมเต็มกว้าง */}
      {isCustomMade && (
        <tr className="border-b border-amber-100 dark:border-amber-900/30">
          <td aria-hidden="true" />
          <td colSpan={5} className="pb-3 pt-1 pr-1">
            <CustomMadeDetail product={product} updateProduct={updateProduct} />
          </td>
        </tr>
      )}

      {/* หลายไซส์ — ตารางกรอกไซส์×จำนวน (ก้อน 4 / P1.12) */}
      {multi && (
        <tr className="border-b border-slate-100 dark:border-slate-800">
          <td aria-hidden="true" />
          <td colSpan={5} className="pb-3 pt-1 pr-1">
            <SizeMatrix variants={product.variants} onChange={(v) => updateProduct("variants", v)} />
          </td>
        </tr>
      )}
    </>
  );
}
