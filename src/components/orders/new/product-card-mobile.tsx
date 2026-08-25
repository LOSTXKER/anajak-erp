"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { cn, formatCurrency } from "@/lib/utils";
import { ImageIcon, LayoutGrid } from "lucide-react";
import type { OrderItemForm, OrderItemProductForm } from "@/types/order-form";
import { ITEM_SOURCES } from "@/types/order-form";
import { useProductRow } from "./use-product-row";
import { CustomMadeDetail } from "./custom-made-detail";
import { SizeMatrix } from "./size-matrix";
import { ProductRowActions } from "./product-row-actions";

// การ์ดสินค้า 1 ชิ้น — เวอร์ชันมือถือ (จอ < sm) · เรียงแนวตั้ง ไม่ต้องเลื่อนซ้ายขวา (UX7)
// logic เดียวกับ ProductTableRow (เดสก์ท็อป) ผ่าน useProductRow — JSX ต่างแค่ layout
export function ProductCardMobile({
  product,
  prodIdx,
  itemIdx,
  totalProducts,
  onSetItems,
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
  } = useProductRow(product, prodIdx, itemIdx, onSetItems);

  const fieldLabel = "mb-1 block text-xs text-muted";

  return (
    <div className="space-y-2.5 rounded-lg border border-border p-3">
      {/* หัวการ์ด: แหล่ง + เลื่อนลำดับ/ลบ */}
      <div className="flex items-center justify-between gap-2">
        {product.itemSource ? (
          <Badge variant={isFromStock ? "default" : isCustomMade ? "accent" : "warning"} size="sm">
            {ITEM_SOURCES[product.itemSource] || product.itemSource}
          </Badge>
        ) : (
          <Select size="sm"
            value=""
            onChange={(e) => { if (e.target.value) updateProduct("itemSource", e.target.value); }}
            className="w-auto"
            aria-label="เลือกแหล่งที่มาของสินค้า"
          >
            <option value="">แหล่ง...</option>
            {Object.entries(ITEM_SOURCES)
              .filter(([key]) => key !== "FROM_STOCK")
              .map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </Select>
        )}
        <ProductRowActions
          productIndex={prodIdx}
          totalProducts={totalProducts}
          onMove={moveProduct}
          onRemove={removeProduct}
        />
      </div>

      {/* สินค้า */}
      {isFromStock ? (
        <div className="flex items-center gap-2">
          {product.productImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={product.productImageUrl} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg border border-border object-cover" />
          ) : (
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted">
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
            value={product.description}
            onChange={(e) => updateProduct("description", e.target.value)}
            placeholder={isCustomerProvided ? "ชื่อสินค้า เช่น เสื้อยืดลูกค้า" : "ชื่อสินค้า เช่น เสื้อคอกลม Cotton"}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {multi ? (
              <span className="text-xs text-muted">หลายไซส์ · รวม {totalQty} ตัว{variant.color ? ` · ${variant.color}` : ""}</span>
            ) : (
              <>
                {/* การ์ดนี้โผล่เฉพาะจอเล็ก — text-xs เปล่า (12px) ทำให้ iOS ซูมจอทุกครั้งที่แตะ
                    ปล่อยให้ Input คุมขนาดอักษรเอง (16px มือถือ / 14px เดสก์ท็อป) */}
                <Input value={variant.color} onChange={(e) => updateVariantField("color", e.target.value)} placeholder="สี" className="w-24 px-2" />
                <Input value={variant.size} onChange={(e) => updateVariantField("size", e.target.value)} placeholder="ไซส์" className="w-20 px-2" />
              </>
            )}
            {canMatrix && (
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => setShowMatrix((v) => !v)}
                disabled={product.variants.length > 1}
                className={cn("h-9 gap-1.5 px-2 text-xs", multi && "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-300")}
                title={product.variants.length > 1 ? "ล้างจำนวนไซส์ให้เหลือไซส์เดียวก่อนปิด" : "กรอกหลายไซส์ในแถวเดียว"}
              >
                <LayoutGrid />{multi ? "ปิดหลายไซส์" : "หลายไซส์"}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ราคา · จำนวน · รวม */}
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className={fieldLabel}>ราคา/ชิ้น</span>
          {isCustomerProvided ? (
            <div className="flex h-9 items-center text-xs text-slate-300">—</div>
          ) : (
            <Input type="number" min={0} step={0.01} value={product.baseUnitPrice || ""} onChange={(e) => updateProduct("baseUnitPrice", parseFloat(e.target.value) || 0)} placeholder="0" className="w-full text-right" />
          )}
        </label>
        <label className="block">
          <span className={fieldLabel}>จำนวน</span>
          {multi ? (
            <div className="flex h-9 items-center justify-center text-sm font-medium text-slate-700 dark:text-slate-200">{totalQty}</div>
          ) : (
            <Input type="number" min={0} value={qty || ""} onChange={(e) => updateVariantField("quantity", parseInt(e.target.value) || 0)} placeholder="0" className="w-full text-center" />
          )}
        </label>
        <div className="block">
          <span className={fieldLabel}>รวม</span>
          {isCustomerProvided ? (
            <div className="flex h-9 items-center justify-end text-xs text-slate-300">—</div>
          ) : (
            <div className="flex h-9 items-center justify-end text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">{formatCurrency(lineTotal)}</div>
          )}
        </div>
      </div>

      {/* ส่วนลด + แพค — แสดงตลอด */}
      <div className="grid grid-cols-2 gap-3">
            {!isCustomerProvided && (
              <div>
                <label htmlFor={`mobile-product-discount-${itemIdx}-${prodIdx}`} className={fieldLabel}>ส่วนลดต่อชิ้น</label>
                <Input id={`mobile-product-discount-${itemIdx}-${prodIdx}`} type="number" min={0} step={0.01} value={product.discount || ""} onChange={(e) => updateProduct("discount", parseFloat(e.target.value) || 0)} placeholder="0" className="w-full text-right" />
              </div>
            )}
            <div>
              {packagingOptions && packagingOptions.length > 0 ? (
                <>
                <label htmlFor={`mobile-product-packaging-${itemIdx}-${prodIdx}`} className={fieldLabel}>แพค</label>
                <Select id={`mobile-product-packaging-${itemIdx}-${prodIdx}`} value={product.packagingOptionId} onChange={(e) => updateProduct("packagingOptionId", e.target.value)}>
                  <option value="">—</option>
                  {packagingOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                </Select>
                </>
              ) : (
                <><p className={fieldLabel}>แพค</p><span className="text-xs text-slate-400">ยังไม่มีตัวเลือกแพค</span></>
              )}
            </div>
      </div>

      {/* สเปคตัดเย็บ (CUSTOM_MADE) */}
      {isCustomMade && (
        /* กรอบเหลืองชั้นนอกถูกถอด — CustomMadeDetail เป็นกล่องเทาในตัวแล้ว (ไม่ซ้อน 2 กรอบ) */
        <CustomMadeDetail product={product} updateProduct={updateProduct} />
      )}

      {/* หลายไซส์ — ตารางกรอกไซส์×จำนวน */}
      {multi && (
        <SizeMatrix
          idPrefix={`mobile-size-${itemIdx}-${prodIdx}`}
          variants={product.variants}
          onChange={(v) => updateProduct("variants", v)}
        />
      )}
    </div>
  );
}
