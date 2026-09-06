"use client";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { ImageIcon } from "lucide-react";
import type { OrderItemForm, OrderItemProductForm } from "@/types/order-form";
import { ITEM_SOURCES } from "@/types/order-form";
import { useProductRow } from "./use-product-row";
import { CustomMadeSpecSummary } from "./custom-made-spec-summary";
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
    updateProduct, updateVariantField, removeProduct, moveProduct,
    packagingOptions,
    qty, isFromStock, isCustomMade, isCustomerProvided,
    multi, totalQty, lineTotal,
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
        />
      )}

      {/* ราคา · จำนวน · รวม */}
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className={fieldLabel}>ราคา/ชิ้น</span>
          {isCustomerProvided ? (
            <div className="flex h-9 items-center text-xs text-muted">—</div>
          ) : (
            <Input type="number" min={0} step={0.01} value={product.baseUnitPrice || ""} onChange={(e) => updateProduct("baseUnitPrice", parseFloat(e.target.value) || 0)} placeholder="0" className="w-full text-right" />
          )}
        </label>
        <label className="block">
          <span className={fieldLabel}>จำนวน</span>
          {multi ? (
            <div className="flex h-9 items-center justify-center text-sm font-medium text-secondary">{totalQty}</div>
          ) : (
            <Input type="number" min={0} value={qty || ""} onChange={(e) => updateVariantField("quantity", parseInt(e.target.value) || 0)} placeholder="0" className="w-full text-center" />
          )}
        </label>
        <div className="block">
          <span className={fieldLabel}>รวม</span>
          {isCustomerProvided ? (
            <div className="flex h-9 items-center justify-end text-xs text-muted">—</div>
          ) : (
            <div className="flex h-9 items-center justify-end text-sm font-semibold tabular-nums text-strong">{formatCurrency(lineTotal)}</div>
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
                <><p className={fieldLabel}>แพค</p><span className="text-xs text-muted">ยังไม่มีตัวเลือกแพค</span></>
              )}
            </div>
      </div>

      {/* ตัดเย็บ/ลูกค้าส่งมา — ไซส์กางตลอด · สเปคสรุป+popup (เบสเคาะ D 2026-09-06) */}
      {multi && (
        <div className="space-y-3 border-t border-divider pt-3">
          {isCustomMade && <CustomMadeSpecSummary product={product} updateProduct={updateProduct} />}
          {isCustomerProvided && (
            <p className="text-xs text-secondary">ตัวเสื้อเป็นของลูกค้า จึงไม่คิดราคาตัวเสื้อ</p>
          )}
          <SizeMatrix
            embedded
            idPrefix={`mobile-size-${itemIdx}-${prodIdx}`}
            title={isCustomerProvided ? "จำนวนที่ลูกค้าส่งมา" : "ไซส์และจำนวน"}
            variants={product.variants}
            onChange={(v) => updateProduct("variants", v)}
          />
        </div>
      )}
    </div>
  );
}
