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
} from "lucide-react";
import type { OrderItemForm, OrderItemProductForm } from "@/types/order-form";
import { ITEM_SOURCES } from "@/types/order-form";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { CustomMadeDetail } from "./custom-made-detail";

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

  const sourceBadge = product.itemSource ? (
    <Badge
      variant={isFromStock ? "default" : isCustomMade ? "purple" : "warning"}
      className="text-[9px]"
    >
      {ITEM_SOURCES[product.itemSource] || product.itemSource}
    </Badge>
  ) : null;

  const productLabel = product.productName || product.description || "สินค้าใหม่";
  const variantLabel = [variant.color, variant.size].filter(Boolean).join(" ");

  return (
    <>
      {/* Main row */}
      <tr className="border-b border-slate-100 dark:border-slate-800">
        {/* Source badge */}
        <td className="py-2 pl-1 align-middle">
          {sourceBadge}
        </td>

        {/* Product info */}
        <td className="py-2 pr-2 align-middle">
          {isFromStock ? (
            <div className="flex items-center gap-2">
              {product.productImageUrl ? (
                <img src={product.productImageUrl} alt="" className="h-10 w-10 flex-shrink-0 rounded border border-slate-200 object-cover dark:border-slate-700" />
              ) : (
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                  <ImageIcon className="h-4 w-4 text-slate-300 dark:text-slate-600" />
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
            <div className="space-y-1">
              <Input
                value={product.description}
                onChange={(e) => updateProduct("description", e.target.value)}
                placeholder={isCustomerProvided ? "ชื่อสินค้า เช่น เสื้อยืดลูกค้า" : "ชื่อสินค้า เช่น เสื้อคอกลม Cotton"}
                className="h-8 text-xs"
              />
              <div className="flex items-center gap-1.5">
                <Input
                  value={variant.color}
                  onChange={(e) => updateVariantField("color", e.target.value)}
                  placeholder="สี"
                  className="h-7 w-20 px-2 text-[11px]"
                />
                <Input
                  value={variant.size}
                  onChange={(e) => updateVariantField("size", e.target.value)}
                  placeholder="ไซส์"
                  className="h-7 w-16 px-2 text-[11px]"
                />
                {isCustomMade && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDetail(!showDetail)}
                    className={cn(
                      "h-7 gap-1 px-2 text-[11px]",
                      showDetail
                        ? "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        : "border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/30",
                    )}
                  >
                    <Scissors className="h-3 w-3" />
                    {showDetail ? "ซ่อนสเปค" : "สเปคตัดเย็บ"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </td>

        {/* Price */}
        <td className="px-1.5 py-2 align-middle">
          {isCustomerProvided ? (
            <div className="text-center text-xs text-slate-400">—</div>
          ) : (
            <div>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={product.baseUnitPrice || ""}
                onChange={(e) => updateProduct("baseUnitPrice", parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="h-8 w-full text-xs"
              />
              {netPrice !== product.baseUnitPrice && (
                <span className="block text-[10px] text-slate-400 mt-0.5">สุทธิ {formatCurrency(netPrice)}</span>
              )}
            </div>
          )}
        </td>

        {/* Quantity */}
        <td className="px-1.5 py-2 align-middle">
          <Input
            type="number"
            min={0}
            value={qty || ""}
            onChange={(e) => updateVariantField("quantity", parseInt(e.target.value) || 0)}
            placeholder="0"
            className="h-8 w-full text-xs"
          />
        </td>

        {/* Discount */}
        <td className="px-1.5 py-2 align-middle">
          {isCustomerProvided ? (
            <div className="text-center text-xs text-slate-400">—</div>
          ) : (
            <Input
              type="number"
              min={0}
              step={0.01}
              value={product.discount || ""}
              onChange={(e) => updateProduct("discount", parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="h-8 w-full text-xs"
            />
          )}
        </td>

        {/* Packaging */}
        <td className="px-1.5 py-2 align-middle">
          {packagingOptions && packagingOptions.length > 0 ? (
            <NativeSelect
              value={product.packagingOptionId}
              onChange={(e) => updateProduct("packagingOptionId", e.target.value)}
              className="h-8 text-xs"
            >
              <option value="">—</option>
              {packagingOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
            </NativeSelect>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </td>

        {/* Actions: delete + reorder */}
        <td className="py-2 pr-1 align-middle">
          <div className="flex items-center gap-0.5">
            <div className="flex flex-col">
              <button type="button" onClick={() => moveProduct(-1)} disabled={prodIdx === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-30 dark:text-slate-600 dark:hover:text-slate-300">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => moveProduct(1)} disabled={prodIdx === totalProducts - 1} className="text-slate-300 hover:text-slate-600 disabled:opacity-30 dark:text-slate-600 dark:hover:text-slate-300">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={removeProduct} className="h-7 w-7 text-red-400 hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>

      {/* CUSTOM_MADE detail section */}
      {isCustomMade && showDetail && (
        <tr className="border-b border-amber-100 dark:border-amber-900/30">
          <td />
          <td colSpan={6} className="pb-3 pt-1 pr-1">
            <CustomMadeDetail product={product} updateProduct={updateProduct} />
          </td>
        </tr>
      )}
    </>
  );
}
