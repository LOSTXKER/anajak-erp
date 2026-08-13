"use client";

import { ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { FIELD_LABEL, RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
import { getProductSourcePresentation } from "@/lib/order-item-composer";
import { cn, formatCurrency } from "@/lib/utils";
import {
  ITEM_SOURCES,
  type OrderItemForm,
  type OrderItemProductForm,
} from "@/types/order-form";
import { CustomMadeDetail } from "./custom-made-detail";
import { ProductRowActions } from "./product-row-actions";
import { SizeMatrix } from "./size-matrix";
import { useProductRow } from "./use-product-row";

interface ProductAdaptiveCardProps {
  product: OrderItemProductForm;
  prodIdx: number;
  itemIdx: number;
  totalProducts: number;
  onSetItems: (updater: (prev: OrderItemForm[]) => OrderItemForm[]) => void;
}

export function ProductAdaptiveCard({
  product,
  prodIdx,
  itemIdx,
  totalProducts,
  onSetItems,
}: ProductAdaptiveCardProps) {
  const {
    updateProduct,
    updateVariantField,
    removeProduct,
    moveProduct,
    packagingOptions,
    qty,
    variant,
    isFromStock,
    isCustomMade,
    isCustomerProvided,
    lineTotal,
    productLabel,
    variantLabel,
  } = useProductRow(product, prodIdx, itemIdx, onSetItems);
  const sourcePresentation = product.itemSource
    ? getProductSourcePresentation(product.itemSource)
    : null;
  const stableId = product.formKey ?? `item-${itemIdx}-product-${prodIdx}`;
  const headingId = `${stableId}-heading`;
  const sizeIdPrefix = `${stableId}-sizes`;

  const packagingField = (
    <Field label="แพค">
      <Select
        value={product.packagingOptionId}
        onChange={(event) => updateProduct("packagingOptionId", event.target.value)}
      >
        <option value="">—</option>
        {packagingOptions?.map((option) => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
      </Select>
    </Field>
  );

  const priceFields = (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Field label="ราคา/ชิ้น">
        <MoneyInput
          value={product.baseUnitPrice}
          onValueChange={(value) => updateProduct("baseUnitPrice", value)}
        />
      </Field>
      <Field label="ส่วนลด/ชิ้น">
        <MoneyInput
          value={product.discount}
          onValueChange={(value) => updateProduct("discount", value)}
        />
      </Field>
      <div className="col-span-2 space-y-2 sm:col-span-1">
        <span className={FIELD_LABEL}>รวมตัวเสื้อ</span>
        <div className={cn(CONTROL_MIN_H, "flex items-center justify-end text-sm font-semibold tabular-nums text-strong")}>
          {formatCurrency(lineTotal)}
        </div>
      </div>
    </div>
  );

  const manualIdentityFields = (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)]">
      <Field label="ชื่อสินค้า">
        <Input
          value={product.description}
          onChange={(event) => updateProduct("description", event.target.value)}
          placeholder={isCustomerProvided ? "เช่น เสื้อยืดที่ลูกค้าส่งมา" : "เช่น เสื้อคอกลม Cotton"}
        />
      </Field>
      {packagingField}
    </div>
  );

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className={cn(SUNK_PANEL, RADIUS.inner, "p-3 sm:p-4")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h4 id={headingId} className="text-sm font-semibold text-strong">
            สินค้า {prodIdx + 1}/{totalProducts}
          </h4>
          {sourcePresentation ? (
            <Badge variant={sourcePresentation.variant} size="sm">
              {sourcePresentation.label}
            </Badge>
          ) : (
            <Select
              size="sm"
              value=""
              onChange={(event) => {
                if (event.target.value) updateProduct("itemSource", event.target.value);
              }}
              className="w-auto"
              aria-label="เลือกแหล่งที่มาของสินค้า"
            >
              <option value="">เลือกแหล่งสินค้า</option>
              {Object.entries(ITEM_SOURCES)
                .filter(([key]) => key !== "FROM_STOCK")
                .map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
          )}
        </div>
        <ProductRowActions
          productIndex={prodIdx}
          totalProducts={totalProducts}
          onMove={moveProduct}
          onRemove={removeProduct}
        />
      </div>

      <div className="mt-4 space-y-4">
        {isFromStock ? (
          <>
            <div className="flex min-w-0 items-center gap-3">
              {product.productImageUrl ? (
                /* Signed URLs มาจาก Stock หลาย host จึงใช้รูปเดิมโดยไม่ผ่าน Next image optimizer */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.productImageUrl}
                  alt={productLabel}
                  className={cn(RADIUS.item, "h-12 w-12 flex-shrink-0 border border-border object-cover")}
                />
              ) : (
                <div className={cn(RADIUS.item, "flex h-12 w-12 flex-shrink-0 items-center justify-center border border-border bg-surface")}>
                  <ImageIcon className="text-muted" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-strong">{productLabel}</p>
                {variantLabel && <p className="text-xs text-muted">{variantLabel}</p>}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                  {product.productSku && <span>{product.productSku}</span>}
                  {product.stockAvailable != null && <span>คงเหลือ {product.stockAvailable} ตัว</span>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {packagingField}
              <Field label="ราคา/ชิ้น">
                <MoneyInput value={product.baseUnitPrice} onValueChange={(value) => updateProduct("baseUnitPrice", value)} />
              </Field>
              <Field label="ส่วนลด/ชิ้น">
                <MoneyInput value={product.discount} onValueChange={(value) => updateProduct("discount", value)} />
              </Field>
              <Field label="จำนวน">
                <NumberInput
                  integer
                  min={0}
                  value={qty}
                  onValueChange={(value) => updateVariantField("quantity", value)}
                  className="text-center"
                />
              </Field>
              <div className="space-y-2">
                <span className={FIELD_LABEL}>รวม</span>
                <div className={cn(CONTROL_MIN_H, "flex items-center justify-end text-sm font-semibold tabular-nums text-strong")}>
                  {formatCurrency(lineTotal)}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {manualIdentityFields}

            {isCustomerProvided ? (
              <>
                <p className="text-xs text-secondary">
                  ตัวเสื้อเป็นของลูกค้า จึงไม่คิดราคาตัวเสื้อ
                </p>
                <div className="border-t border-divider pt-4">
                  <SizeMatrix
                    embedded
                    idPrefix={sizeIdPrefix}
                    title="จำนวนที่ลูกค้าส่งมา"
                    variants={product.variants}
                    onChange={(variants) => updateProduct("variants", variants)}
                  />
                </div>
              </>
            ) : isCustomMade ? (
              <>
                {priceFields}
                <div className="grid items-start gap-5 border-t border-divider pt-4 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]">
                  <CustomMadeDetail
                    embedded
                    product={product}
                    updateProduct={updateProduct}
                  />
                  <div className="min-w-0 lg:border-l lg:border-divider lg:pl-5">
                    <SizeMatrix
                      embedded
                      idPrefix={sizeIdPrefix}
                      title="ไซส์และจำนวน"
                      variants={product.variants}
                      onChange={(variants) => updateProduct("variants", variants)}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="สี">
                    <Input value={variant.color} onChange={(event) => updateVariantField("color", event.target.value)} />
                  </Field>
                  <Field label="ไซส์">
                    <Input value={variant.size} onChange={(event) => updateVariantField("size", event.target.value)} />
                  </Field>
                  <Field label="จำนวน">
                    <NumberInput integer min={0} value={qty} onValueChange={(value) => updateVariantField("quantity", value)} className="text-center" />
                  </Field>
                </div>
                {priceFields}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
