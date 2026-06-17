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
import { sumVariantQty } from "@/lib/size-matrix";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { CustomMadeDetail } from "./custom-made-detail";
import { SizeMatrix } from "./size-matrix";
import { Field } from "./print-table-row";

// การ์ดสินค้า 1 ชิ้น — โชว์เฉพาะ field ที่ชนิดงาน (itemSource) นั้นใช้ (guided by type)
// (ชื่อ export คงเดิม ProductTableRow ลด churn ฝั่ง order-item-card — แต่ render เป็นการ์ด ไม่ใช่ <tr> แล้ว)
export function ProductTableRow({
  product, prodIdx, itemIdx, totalProducts, onSetItems,
}: {
  product: OrderItemProductForm;
  prodIdx: number;
  itemIdx: number;
  totalProducts: number;
  onSetItems: (updater: (prev: OrderItemForm[]) => OrderItemForm[]) => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const { data: packagingOptions } = trpc.packaging.list.useQuery();

  const updateProduct = (field: string, value: unknown) => {
    onSetItems((prev) => {
      const copy = [...prev];
      const products = [...copy[itemIdx].products];
      products[prodIdx] = { ...products[prodIdx], [field]: value };
      copy[itemIdx] = { ...copy[itemIdx], products };
      return copy;
    });
  };

  const updateVariantField = (field: "quantity" | "size" | "color", value: string | number) => {
    onSetItems((prev) => {
      const copy = [...prev];
      const products = [...copy[itemIdx].products];
      const variants = [...products[prodIdx].variants];
      variants[0] = { ...variants[0], [field]: value };
      products[prodIdx] = { ...products[prodIdx], variants };
      copy[itemIdx] = { ...copy[itemIdx], products };
      return copy;
    });
  };

  const removeProduct = () => {
    onSetItems((prev) => {
      const copy = [...prev];
      copy[itemIdx] = { ...copy[itemIdx], products: copy[itemIdx].products.filter((_, i) => i !== prodIdx) };
      return copy;
    });
  };

  const moveProduct = (direction: -1 | 1) => {
    const newIdx = prodIdx + direction;
    if (newIdx < 0 || newIdx >= totalProducts) return;
    onSetItems((prev) => {
      const copy = [...prev];
      const products = [...copy[itemIdx].products];
      [products[prodIdx], products[newIdx]] = [products[newIdx], products[prodIdx]];
      copy[itemIdx] = { ...copy[itemIdx], products };
      return copy;
    });
  };

  const variant = product.variants[0] || { size: "", color: "", quantity: 0 };
  const qty = variant.quantity;
  const netPrice = Math.max(0, product.baseUnitPrice - (product.discount || 0));
  const isFromStock = product.itemSource === "FROM_STOCK";
  const isCustomMade = product.itemSource === "CUSTOM_MADE";
  const isCustomerProvided = product.itemSource === "CUSTOMER_PROVIDED";

  // โหมดหลายไซส์ (matrix) — เฉพาะสินค้าที่กรอกเอง (ไม่ใช่จากสต๊อค) · มี >1 variant = บังคับเปิด
  const canMatrix = !isFromStock;
  const multi = canMatrix && (showMatrix || product.variants.length > 1);
  const filledSizes = product.variants.filter((v) => v.size.trim());
  const totalQty = sumVariantQty(filledSizes);
  const effectiveQty = multi ? totalQty : qty;
  const lineTotal = netPrice * effectiveQty;

  // แถวข้อมูลเก่า/จากใบเสนอ itemSource เป็น null — ต้องมีช่องให้เลือก ไม่งั้น validation
  // บล็อกการเซฟทั้งใบโดยผู้ใช้แก้อะไรไม่ได้ (review 2026-06-11)
  const sourceBadge = product.itemSource ? (
    <Badge
      variant={isFromStock ? "default" : isCustomMade ? "accent" : "warning"}
      size="sm"
    >
      {ITEM_SOURCES[product.itemSource] || product.itemSource}
    </Badge>
  ) : (
    <NativeSelect
      value=""
      onChange={(e) => {
        if (e.target.value) updateProduct("itemSource", e.target.value);
      }}
      className="w-[140px] text-[11px]"
      aria-label="เลือกแหล่งที่มาของสินค้า"
    >
      <option value="">เลือกแหล่งที่มา...</option>
      {Object.entries(ITEM_SOURCES)
        .filter(([key]) => key !== "FROM_STOCK") // จากสต๊อกต้องผ่าน picker (ผูก SKU จริง)
        .map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
    </NativeSelect>
  );

  const productLabel = product.productName || product.description || "สินค้าใหม่";
  const variantLabel = [variant.color, variant.size].filter(Boolean).join(" ");

  return (
    <div className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-700/60">
      {/* Header: ชนิด + เลื่อน/ลบ */}
      <div className="mb-3 flex items-center justify-between gap-2">
        {sourceBadge}
        <div className="flex items-center gap-0.5">
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
      </div>

      {/* ── ตัวสินค้า ── */}
      {isFromStock ? (
        // จากสต๊อก: อ่านอย่างเดียวจาก picker (รูป/ชื่อ/sku/คลัง)
        <div className="flex items-center gap-3">
          {product.productImageUrl ? (
            <img src={product.productImageUrl} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
          ) : (
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              <ImageIcon className="h-5 w-5 text-slate-300 dark:text-slate-600" />
            </div>
          )}
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{productLabel}</span>
            {variantLabel && <span className="block text-xs text-slate-500">{variantLabel}</span>}
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
              {product.productSku && <span>{product.productSku}</span>}
              {product.stockAvailable != null && (
                <span className={product.stockAvailable > 0 ? "text-green-600" : "text-red-500"}>
                  คลัง {product.stockAvailable}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        // ตัดเย็บใหม่ / ลูกค้าส่งมา: กรอกชื่อ + สี/ไซส์ (single)
        <div className="space-y-3">
          <Field label="ชื่อสินค้า" required>
            <Input
              value={product.description}
              onChange={(e) => updateProduct("description", e.target.value)}
              placeholder={isCustomerProvided ? "เช่น เสื้อยืดลูกค้า" : "เช่น เสื้อคอกลม Cotton"}
            />
          </Field>
          {multi ? (
            <span className="block text-[11px] text-slate-500">
              หลายไซส์ · รวม {totalQty} ตัว{variant.color ? ` · ${variant.color}` : ""}
            </span>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="สี">
                <Input value={variant.color} onChange={(e) => updateVariantField("color", e.target.value)} placeholder="สี" />
              </Field>
              <Field label="ไซส์" required>
                <Input value={variant.size} onChange={(e) => updateVariantField("size", e.target.value)} placeholder="ไซส์" />
              </Field>
            </div>
          )}
        </div>
      )}

      {/* ── ราคา · จำนวน · รวม (ลูกค้าส่งมา = ไม่มีราคา/รวม) ── */}
      <div className={cn("mt-3 grid gap-3", isCustomerProvided ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
        {!isCustomerProvided && (
          <Field label="ราคา/ตัว" required>
            <Input type="number" min={0} step={0.01} value={product.baseUnitPrice || ""} onChange={(e) => updateProduct("baseUnitPrice", parseFloat(e.target.value) || 0)} placeholder="0" className="text-right" />
          </Field>
        )}
        <Field label="จำนวน" required>
          {multi ? (
            <div className="flex h-9 items-center justify-center text-sm font-medium text-slate-700 dark:text-slate-200">{totalQty}</div>
          ) : (
            <Input type="number" min={0} value={qty || ""} onChange={(e) => updateVariantField("quantity", parseInt(e.target.value) || 0)} placeholder="0" className="text-center" />
          )}
        </Field>
        {!isCustomerProvided && (
          <Field label="รวม">
            <div className="flex h-9 items-center justify-end text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
              {formatCurrency(lineTotal)}
            </div>
          </Field>
        )}
      </div>

      {/* ของรอง — โชว์ตรงๆ ไม่ซ่อนใต้ toggle (เบส: ไม่ต้องซ่อน แต่ดูง่าย) */}
      <div className="mt-3 grid grid-cols-2 items-end gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3 dark:border-slate-800">
        {!isCustomerProvided && (
          <Field label="ส่วนลด/ตัว">
            <Input type="number" min={0} step={0.01} value={product.discount || ""} onChange={(e) => updateProduct("discount", parseFloat(e.target.value) || 0)} placeholder="0" className="text-right" />
          </Field>
        )}
        {packagingOptions && packagingOptions.length > 0 && (
          <Field label="แพคเกจ">
            <NativeSelect value={product.packagingOptionId} onChange={(e) => updateProduct("packagingOptionId", e.target.value)}>
              <option value="">—</option>
              {packagingOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
            </NativeSelect>
          </Field>
        )}
        {canMatrix && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowMatrix((v) => !v)}
            // มี >1 variant = multi ถูกตรึงจากข้อมูล · setShowMatrix(false) ปิดไม่ได้ → disable กันกดแล้วงง
            disabled={product.variants.length > 1}
            className={cn("gap-1", multi && "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-300")}
            title={product.variants.length > 1 ? "ล้างจำนวนไซส์ในตารางให้เหลือไซส์เดียวก่อนถึงจะปิดได้" : "กรอกหลายไซส์ในแถวเดียว"}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {multi ? "ปิดหลายไซส์" : "หลายไซส์"}
          </Button>
        )}
        {isCustomMade && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowDetail(!showDetail)}
            className={cn("gap-1", showDetail && "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300")}
          >
            <Scissors className="h-3.5 w-3.5" />
            {showDetail ? "ซ่อนสเปค" : "สเปคตัดเย็บ"}
          </Button>
        )}
      </div>

      {/* สเปคตัดเย็บ (CUSTOM_MADE) */}
      {isCustomMade && showDetail && (
        <div className="mt-3">
          <CustomMadeDetail product={product} updateProduct={updateProduct} />
        </div>
      )}

      {/* หลายไซส์ — ตารางกรอกไซส์×จำนวน (ก้อน 4 / P1.12) */}
      {multi && (
        <div className="mt-3">
          <SizeMatrix variants={product.variants} onChange={(v) => updateProduct("variants", v)} />
        </div>
      )}
    </div>
  );
}
