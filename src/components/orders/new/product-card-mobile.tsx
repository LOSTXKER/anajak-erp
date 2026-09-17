"use client";

import { Input } from "@/components/ui/input";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { c, Thumb } from "@/components/kit/kit";
import { formatBaht } from "@/lib/utils";
import type { OrderItemForm, OrderItemProductForm } from "@/types/order-form";
import { ITEM_SOURCES } from "@/types/order-form";
import { getProductSourcePresentation } from "@/lib/order-item-composer";
import { useProductRow } from "./use-product-row";
import { CustomMadeSpecSummary } from "./custom-made-spec-summary";
import { ProductDetailRail } from "./product-detail-rail";
import { SizeMatrix } from "./size-matrix";
import { ProductRowActions } from "./product-row-actions";
import { ProductSubLine, sourceChipClass } from "./product-table-row";

// การ์ดสินค้า 1 ชิ้น — เวอร์ชันพื้นที่แคบ · เรียงแนวตั้ง ไม่ต้องเลื่อนซ้ายขวา (UX7)
// logic เดียวกับ ProductTableRow ผ่าน useProductRow · ชิป/รูปย่อ/ช่องเงินชุดเดียวกับแถวตาราง
// ช่องกรอกคงขนาด control กลาง (44px บนจอทัช) และปุ่มเลื่อน/ลบแบบกดด้วยนิ้ว
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
    productLabel,
  } = useProductRow(product, prodIdx, itemIdx, onSetItems);

  const fieldLabel = "mb-1 block text-xs text-muted";
  const dash = <div className={`flex h-9 items-center ${c("dsh")}`}>—</div>;

  return (
    <div className="space-y-2.5 rounded-lg border border-border p-3">
      {/* หัวการ์ด: แหล่ง + เลื่อนลำดับ/ลบ */}
      <div className="flex items-center justify-between gap-2">
        {product.itemSource ? (
          <span className={sourceChipClass(product.itemSource)}>
            {getProductSourcePresentation(product.itemSource).label}
          </span>
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
        <div className={c("prod")}>
          <Thumb cover={product.productImageUrl ?? null} alt="" />
          <div className="min-w-0">
            <b className="block text-sm font-medium text-strong [overflow-wrap:anywhere]">{productLabel}</b>
            <ProductSubLine product={product} />
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
          <span className={fieldLabel}>ราคา/ตัว</span>
          {isCustomerProvided ? dash : (
            <MoneyInput currency value={product.baseUnitPrice} onValueChange={(v) => updateProduct("baseUnitPrice", v)} />
          )}
        </label>
        <label className="block">
          <span className={fieldLabel}>จำนวน</span>
          {multi ? (
            <div className="flex h-9 items-center justify-center text-sm font-medium tabular-nums text-secondary">{totalQty.toLocaleString("th-TH")}</div>
          ) : (
            <NumberInput integer min={0} value={qty} onValueChange={(v) => updateVariantField("quantity", v)} placeholder="0" className="w-full text-center" />
          )}
        </label>
        <div className="block">
          <span className={fieldLabel}>รวม</span>
          {isCustomerProvided ? (
            <div className={`flex h-9 items-center justify-end ${c("dsh")}`}>—</div>
          ) : (
            <div className={`flex h-9 items-center justify-end text-sm font-semibold text-strong ${c("mono")}`}>{formatBaht(lineTotal)}</div>
          )}
        </div>
      </div>

      {/* ส่วนลด + แพค — แสดงตลอด */}
      <div className="grid grid-cols-2 gap-3">
        {!isCustomerProvided && (
          <div>
            <label htmlFor={`mobile-product-discount-${itemIdx}-${prodIdx}`} className={fieldLabel}>ส่วนลด/ตัว</label>
            <MoneyInput currency id={`mobile-product-discount-${itemIdx}-${prodIdx}`} value={product.discount} onValueChange={(v) => updateProduct("discount", v)} />
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

      {/* ตัดเย็บ/ลูกค้าส่งมา — สเปคสรุป+popup · ไซส์กางตลอด (เบสเคาะ D 2026-09-06) */}
      {multi && (
        <ProductDetailRail>
          {isCustomMade && <CustomMadeSpecSummary product={product} updateProduct={updateProduct} />}
          <SizeMatrix
            embedded
            idPrefix={`mobile-size-${itemIdx}-${prodIdx}`}
            title={isCustomerProvided ? "จำนวนที่ลูกค้าส่งมา" : "ไซส์และจำนวน"}
            variants={product.variants}
            onChange={(v) => updateProduct("variants", v)}
          />
        </ProductDetailRail>
      )}
    </div>
  );
}
