"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Trash2,
  ImageIcon,
  Scissors,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
} from "lucide-react";
import type { OrderItemForm, OrderItemProductForm } from "@/types/order-form";
import { ITEM_SOURCES } from "@/types/order-form";
import { useProductRow } from "./use-product-row";
import { CustomMadeDetail } from "./custom-made-detail";
import { SizeMatrix } from "./size-matrix";

// แถวสินค้า 1 ชิ้น — 5 คอลัมน์หลัก: แหล่ง · สินค้า · ราคา · จำนวน · รวม (+ ลบ)
// ส่วนลด/แพค ย้ายไปใต้ "เพิ่มเติม" ต่อแถว (UX7 · ตารางแคบลง อ่านง่ายบนมือถือ)
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
    showDetail, setShowDetail,
    setShowMatrix,
    showMore, setShowMore,
    updateProduct, updateVariantField, removeProduct, moveProduct,
    packagingOptions,
    qty, variant, isFromStock, isCustomMade, isCustomerProvided,
    packName, canMatrix, multi, totalQty, lineTotal,
    productLabel, variantLabel,
  } = useProductRow(product, prodIdx, itemIdx, totalProducts, onSetItems);

  // แถวข้อมูลเก่า/จากใบเสนอ itemSource เป็น null — ต้องมีช่องให้เลือก ไม่งั้น validation บล็อกการเซฟ
  const sourceBadge = product.itemSource ? (
    <Badge variant={isFromStock ? "default" : isCustomMade ? "accent" : "warning"} size="sm">
      {ITEM_SOURCES[product.itemSource] || product.itemSource}
    </Badge>
  ) : (
    <NativeSelect
      value=""
      onChange={(e) => { if (e.target.value) updateProduct("itemSource", e.target.value); }}
      className="text-[11px]"
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
                <img src={product.productImageUrl} alt="" className="h-9 w-9 flex-shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
              ) : (
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                  <ImageIcon className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                </div>
              )}
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{productLabel}</span>
                {variantLabel && <span className="block text-xs text-slate-500">{variantLabel}</span>}
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
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
                value={product.description}
                onChange={(e) => updateProduct("description", e.target.value)}
                placeholder={isCustomerProvided ? "ชื่อสินค้า เช่น เสื้อยืดลูกค้า" : "ชื่อสินค้า เช่น เสื้อคอกลม Cotton"}
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {multi ? (
                  <span className="text-[11px] text-slate-500">หลายไซส์ · รวม {totalQty} ตัว{variant.color ? ` · ${variant.color}` : ""}</span>
                ) : (
                  <>
                    <Input value={variant.color} onChange={(e) => updateVariantField("color", e.target.value)} placeholder="สี" className="h-8 w-20 px-2 text-[11px]" />
                    <Input value={variant.size} onChange={(e) => updateVariantField("size", e.target.value)} placeholder="ไซส์" className="h-8 w-16 px-2 text-[11px]" />
                  </>
                )}
                {canMatrix && (
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => setShowMatrix((v) => !v)}
                    disabled={product.variants.length > 1}
                    className={cn("h-8 gap-1 px-2 text-[11px]", multi && "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-300")}
                    title={product.variants.length > 1 ? "ล้างจำนวนไซส์ให้เหลือไซส์เดียวก่อนปิด" : "กรอกหลายไซส์ในแถวเดียว"}
                  >
                    <LayoutGrid className="h-3 w-3" />{multi ? "ปิดหลายไซส์" : "หลายไซส์"}
                  </Button>
                )}
                {isCustomMade && (
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => setShowDetail(!showDetail)}
                    className={cn("h-8 gap-1 px-2 text-[11px]", showDetail && "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300")}
                  >
                    <Scissors className="h-3 w-3" />{showDetail ? "ซ่อนสเปค" : "สเปคตัดเย็บ"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </td>

        {/* ราคา */}
        <td className="px-1.5 py-2 align-top">
          {isCustomerProvided ? dash : (
            <Input type="number" min={0} step={0.01} value={product.baseUnitPrice || ""} onChange={(e) => updateProduct("baseUnitPrice", parseFloat(e.target.value) || 0)} placeholder="0" className="w-full text-right" />
          )}
        </td>

        {/* จำนวน */}
        <td className="px-1.5 py-2 align-top">
          {multi ? (
            <div className="flex h-9 items-center justify-center text-sm font-medium text-slate-700 dark:text-slate-200">{totalQty}</div>
          ) : (
            <Input type="number" min={0} value={qty || ""} onChange={(e) => updateVariantField("quantity", parseInt(e.target.value) || 0)} placeholder="0" className="w-full text-center" />
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
                <Button type="button" variant="ghost" size="icon" onClick={() => moveProduct(-1)} disabled={prodIdx === 0} className="h-5 w-5 text-slate-300 hover:text-slate-600 disabled:opacity-30 dark:text-slate-600 dark:hover:text-slate-300">
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => moveProduct(1)} disabled={prodIdx === totalProducts - 1} className="h-5 w-5 text-slate-300 hover:text-slate-600 disabled:opacity-30 dark:text-slate-600 dark:hover:text-slate-300">
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <Button type="button" variant="ghost" size="icon" onClick={removeProduct} className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>

      {/* UX7: แถว "เพิ่มเติม" — ส่วนลด + แพค ซ่อนไว้ (คนส่วนใหญ่ไม่ใช้) + badge สรุปค่าที่ตั้งแล้ว */}
      <tr className="border-b border-slate-100 dark:border-slate-800">
        <td />
        <td colSpan={5} className="pb-2 pl-1">
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showMore && "rotate-180")} />
            {showMore ? (
              "ซ่อนเพิ่มเติม"
            ) : (
              <span className="flex flex-wrap items-center gap-1">
                <span>เพิ่มเติม</span>
                {(product.discount || 0) > 0 && (
                  <Badge variant="outline" size="sm">ส่วนลด {formatCurrency(product.discount || 0)}</Badge>
                )}
                {packName && <Badge variant="outline" size="sm">{packName}</Badge>}
              </span>
            )}
          </button>
          {showMore && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              {!isCustomerProvided && (
                <label className="block">
                  <span className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">ส่วนลดต่อชิ้น</span>
                  <Input type="number" min={0} step={0.01} value={product.discount || ""} onChange={(e) => updateProduct("discount", parseFloat(e.target.value) || 0)} placeholder="0" className="w-full text-right" />
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">แพค</span>
                {packagingOptions && packagingOptions.length > 0 ? (
                  <NativeSelect value={product.packagingOptionId} onChange={(e) => updateProduct("packagingOptionId", e.target.value)}>
                    <option value="">—</option>
                    {packagingOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                  </NativeSelect>
                ) : (
                  <span className="text-xs text-slate-400">ยังไม่มีตัวเลือกแพค</span>
                )}
              </label>
            </div>
          )}
        </td>
      </tr>

      {/* สเปคตัดเย็บ (CUSTOM_MADE) — แถวเสริมเต็มกว้าง */}
      {isCustomMade && showDetail && (
        <tr className="border-b border-amber-100 dark:border-amber-900/30">
          <td />
          <td colSpan={5} className="pb-3 pt-1 pr-1">
            <CustomMadeDetail product={product} updateProduct={updateProduct} />
          </td>
        </tr>
      )}

      {/* หลายไซส์ — ตารางกรอกไซส์×จำนวน (ก้อน 4 / P1.12) */}
      {multi && (
        <tr className="border-b border-slate-100 dark:border-slate-800">
          <td />
          <td colSpan={5} className="pb-3 pt-1 pr-1">
            <SizeMatrix variants={product.variants} onChange={(v) => updateProduct("variants", v)} />
          </td>
        </tr>
      )}
    </>
  );
}
