"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { trpc } from "@/lib/trpc";
import { cn, formatCurrency } from "@/lib/utils";
import { FIELD_SURFACE, FOCUS_BUTTON, FOCUS_FIELD, INTERACTIVE_SELECTED, OVERLAY_PANEL, RADIUS, TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { QueryError } from "@/components/ui/query-error";
import { SearchInput } from "@/components/ui/search-input";
import { Package, X, ChevronDown, ChevronRight, Minus, Plus } from "lucide-react";
import { CONTROL_H_SM } from "@/components/ui/control-size";

export interface SelectedVariantItem {
  productId: string;
  productVariantId: string;
  sku: string;
  productSku: string;
  name: string;
  productType: string;
  basePrice: number;
  costPrice: number;
  size: string;
  color: string;
  stock: number;
  quantity: number;
  imageUrl?: string;
}

/** @deprecated Use SelectedVariantItem[] via the new multi-select flow */
export interface SelectedProduct {
  productId: string;
  sku: string;
  name: string;
  productType: string;
  basePrice: number;
  costPrice: number;
  unit: string | null;
  source: string;
  variants: Array<{
    id: string;
    size: string;
    color: string;
    sku: string;
    stock: number;
    priceAdj: number;
    sellingPrice: number;
  }>;
}

export interface ProductPickerProps {
  open: boolean;
  onClose: () => void;
  onSelectVariants: (items: SelectedVariantItem[]) => void;
  itemType?: string;
}

const ITEM_TYPE_FILTERS = [
  { key: undefined as string | undefined, label: "ทั้งหมด" },
  { key: "FINISHED_GOOD", label: "สินค้าสำเร็จรูป" },
  { key: "RAW_MATERIAL", label: "วัตถุดิบ" },
  { key: "CONSUMABLE", label: "วัสดุสิ้นเปลือง" },
] as const;

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  T_SHIRT: "เสื้อยืด",
  POLO: "โปโล",
  HOODIE: "ฮู้ด",
  JACKET: "แจ็คเก็ต",
  TOTE_BAG: "ถุงผ้า",
  FABRIC: "ผ้า",
  INK: "หมึก",
  THREAD: "ด้าย",
  LABEL: "ป้าย",
  PACKAGING: "บรรจุภัณฑ์",
  OTHER: "อื่นๆ",
};

type VariantSelection = Record<string, number>;

export function ProductPickerDialog({
  open,
  onClose,
  onSelectVariants,
  itemType: initialGroup,
}: ProductPickerProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(initialGroup);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selections, setSelections] = useState<VariantSelection>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (open) {
      setSearch("");
      setDebouncedSearch("");
      setSelectedGroup(initialGroup);
      setExpandedId(null);
      setSelections({});
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, initialGroup]);

  const { data: products, isLoading, isError, refetch } = trpc.product.searchForOrder.useQuery(
    { search: debouncedSearch || undefined, itemType: selectedGroup, limit: 20 },
    { enabled: open },
  );

  const totalSelected = Object.values(selections).filter((q) => q > 0).length;

  const toggleVariant = (variantId: string) => {
    setSelections((prev) => {
      const current = prev[variantId] ?? 0;
      if (current > 0) {
        const next = { ...prev };
        delete next[variantId];
        return next;
      }
      return { ...prev, [variantId]: 1 };
    });
  };

  const setVariantQty = (variantId: string, qty: number) => {
    setSelections((prev) => ({
      ...prev,
      [variantId]: Math.max(0, qty),
    }));
  };

  const handleConfirm = useCallback(() => {
    if (!products) return;
    const items: SelectedVariantItem[] = [];

    for (const product of products) {
      for (const v of product.variants) {
        const qty = selections[v.id];
        if (!qty || qty <= 0) continue;
        items.push({
          productId: product.id,
          productVariantId: v.id,
          sku: v.sku,
          productSku: product.sku,
          name: product.name,
          productType: product.productType,
          basePrice: v.sellingPrice > 0 ? v.sellingPrice : product.basePrice,
          costPrice: product.costPrice ?? 0,
          size: v.size,
          color: v.color,
          stock: v.totalStock ?? v.stock,
          quantity: qty,
          imageUrl: product.imageUrl ?? undefined,
        });
      }
    }

    if (items.length > 0) {
      onSelectVariants(items);
      onClose();
    }
  }, [products, selections, onSelectVariants, onClose]);

  const handleManualEntry = () => onClose();

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-backdrop backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            OVERLAY_PANEL,
            "fixed inset-x-4 top-[5%] z-50 mx-auto flex max-h-[90vh] max-w-2xl flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
            <Dialog.Title className="flex min-w-0 items-start gap-2 text-lg font-semibold leading-tight text-slate-900 dark:text-white">
              <Package className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              เลือกสินค้าจากแค็ตตาล็อก
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="ปิดหน้าต่างเลือกสินค้า">
                <X />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            ค้นหาสินค้าและเลือกสี ไซส์ และจำนวนที่ต้องการเพิ่มลงในรายการงาน
          </Dialog.Description>

          {/* Search & Filters */}
          <div className="space-y-3 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
            <SearchInput
              surface="field"
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อสินค้า, SKU, บาร์โค้ด..."
            />
            <div className="flex flex-wrap gap-1.5">
              {ITEM_TYPE_FILTERS.map((g) => (
                <button
                  key={g.label}
                  type="button"
                  onClick={() => setSelectedGroup(g.key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    selectedGroup === g.key
                      ? INTERACTIVE_SELECTED
                      : "bg-surface-muted text-secondary hover:bg-interactive-hover active:bg-interactive-pressed",
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Product list */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                <Spinner size="xl" />
                <p className="mt-3 text-sm">กำลังโหลด...</p>
              </div>
            ) : isError ? (
              // query พัง ≠ ไม่มีสินค้า — เดิมโชว์ "ไม่พบสินค้า" ตอนเน็ตล่ม ผู้ใช้เข้าใจผิด
              <QueryError message="โหลดรายการสินค้าไม่สำเร็จ" onRetry={() => void refetch()} />
            ) : !products || products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                <Package className="h-10 w-10" />
                <p className="mt-3 text-sm">ไม่พบสินค้า</p>
                {search && (
                  <p className="mt-1 text-xs">ลองค้นหาด้วยคำอื่น หรือเพิ่มรายการด้วยตนเอง</p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {products.map((product) => {
                  const isExpanded = expandedId === product.id;
                  const totalStock =
                    product.totalStock ??
                    product.variants.reduce((sum, v) => sum + (v.totalStock ?? v.stock), 0);
                  const selectedFromProduct = product.variants.filter(
                    (v) => (selections[v.id] ?? 0) > 0,
                  ).length;

                  return (
                    <div key={product.id} className="rounded-lg">
                      {/* Product row -- click to expand, not to select */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(product.id)}
                        className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-interactive-hover active:bg-interactive-pressed dark:hover:bg-interactive-hover dark:active:bg-interactive-pressed"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
                              {product.name}
                            </span>
                            <span className="inline-flex flex-shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {PRODUCT_TYPE_LABELS[product.productType] ?? product.productType}
                            </span>
                            {selectedFromProduct > 0 && (
                              <span className="inline-flex flex-shrink-0 items-center rounded-full bg-blue-100 px-2 py-0.5 text-2xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                เลือก {selectedFromProduct}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono">{product.sku}</span>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span>
                              ราคา{" "}
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {formatCurrency(product.basePrice)}
                              </span>
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span>
                              คงเหลือ{" "}
                              <span
                                className={cn(
                                  "font-medium",
                                  totalStock > 10
                                    ? "text-green-600 dark:text-green-400"
                                    : totalStock > 0
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-red-700 dark:text-red-300",
                                )}
                              >
                                {totalStock}
                              </span>
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Expanded: variant selection with checkboxes + qty */}
                      {isExpanded && product.variants.length > 0 && (
                        <div className="mx-1 mb-1 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/50 sm:ml-10 sm:mr-3">
                          <table className="block w-full text-xs sm:table sm:table-fixed">
                            <thead className={cn(TABLE_HEAD_SURFACE, "hidden sm:table-header-group")}>
                              <tr>
                                <th scope="col" aria-label="เลือก" className="w-9 px-2 py-1.5" />
                                <th className="px-3 py-1.5 text-left font-medium">SKU</th>
                                <th className="w-[14%] px-3 py-1.5 text-left font-medium">สี</th>
                                <th className="w-[12%] px-3 py-1.5 text-left font-medium">ไซส์</th>
                                <th className="w-[14%] px-3 py-1.5 text-right font-medium">คงเหลือ</th>
                                <th className="w-[14%] px-3 py-1.5 text-right font-medium">ราคา</th>
                                <th className="w-28 px-3 py-1.5 text-center font-medium">จำนวน</th>
                              </tr>
                            </thead>
                            <tbody className="block sm:table-row-group">
                              {product.variants.map((v) => {
                                const vStock = v.totalStock ?? v.stock;
                                const qty = selections[v.id] ?? 0;
                                const isChecked = qty > 0;
                                const exceedsStock = isChecked && qty > vStock;

                                return (
                                  <tr
                                    key={v.id}
                                    className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-slate-100 px-3 py-3 last:border-0 dark:border-slate-700/50 sm:table-row sm:p-0"
                                  >
                                    <td className="col-start-1 row-span-2 row-start-1 flex p-0 sm:table-cell sm:px-2 sm:py-1.5 sm:text-center">
                                      <label htmlFor={`variant-select-${v.id}`} className="flex h-11 w-11 cursor-pointer items-center justify-center sm:inline-flex sm:h-auto sm:w-auto">
                                        <Checkbox
                                          id={`variant-select-${v.id}`}
                                          aria-label={`เลือก ${v.sku} สี ${v.color || "ไม่ระบุ"} ไซส์ ${v.size}`}
                                          checked={isChecked}
                                          onChange={() => toggleVariant(v.id)}
                                          className="h-5 w-5 sm:h-3.5 sm:w-3.5"
                                        />
                                      </label>
                                    </td>
                                    <td className="col-span-2 col-start-2 row-start-1 min-w-0 break-all p-0 font-mono text-slate-500 dark:text-slate-400 sm:table-cell sm:truncate sm:px-3 sm:py-1.5">
                                      {v.sku}
                                    </td>
                                    <td className="col-start-2 min-w-0 p-0 text-slate-600 dark:text-slate-400 sm:table-cell sm:px-3 sm:py-1.5">
                                      <span className="block text-2xs text-muted sm:hidden">
                                        สี
                                      </span>
                                      <span className="block truncate">{v.color || "-"}</span>
                                    </td>
                                    <td className="col-start-3 min-w-0 p-0 font-medium text-slate-700 dark:text-slate-300 sm:table-cell sm:px-3 sm:py-1.5">
                                      <span className="block text-2xs font-normal text-muted sm:hidden">
                                        ไซส์
                                      </span>
                                      <span className="block truncate">{v.size}</span>
                                    </td>
                                    <td className="col-start-2 p-0 sm:table-cell sm:px-3 sm:py-1.5 sm:text-right">
                                      <span className="mb-1 block text-2xs text-muted sm:hidden">
                                        คงเหลือ
                                      </span>
                                      <Badge
                                        variant={
                                          vStock > 10
                                            ? "success"
                                            : vStock > 0
                                              ? "warning"
                                              : "destructive"
                                        }
                                        size="sm"
                                        className="min-w-[2rem] justify-center"
                                      >
                                        {vStock}
                                      </Badge>
                                    </td>
                                    <td className="col-start-3 min-w-0 p-0 font-medium text-slate-700 dark:text-slate-300 sm:table-cell sm:px-3 sm:py-1.5 sm:text-right">
                                      <span className="block text-2xs font-normal text-muted sm:hidden">
                                        ราคา
                                      </span>
                                      <span className="block break-words">
                                        {v.sellingPrice > 0
                                          ? formatCurrency(v.sellingPrice)
                                          : formatCurrency(product.basePrice)}
                                      </span>
                                    </td>
                                    <td className="col-span-3 col-start-1 p-0 sm:table-cell sm:w-28 sm:px-3 sm:py-1.5">
                                      <div
                                        className={cn(
                                          "mt-1 items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-700 sm:mt-0 sm:justify-center sm:gap-1.5 sm:border-0 sm:pt-0",
                                          isChecked ? "flex" : "hidden sm:flex sm:invisible",
                                        )}
                                      >
                                        <span className="font-medium text-slate-600 dark:text-slate-300 sm:hidden">
                                          จำนวน
                                        </span>
                                        <button
                                          type="button"
                                          aria-label={`ลดจำนวน ${v.sku}`}
                                          tabIndex={isChecked ? 0 : -1}
                                          onClick={() => setVariantQty(v.id, qty - 1)}
                                          className={cn(
                                            CONTROL_H_SM,
                                            FOCUS_BUTTON,
                                            RADIUS.item,
                                            "flex w-11 items-center justify-center text-muted hover:bg-interactive-hover hover:text-secondary active:bg-interactive-pressed sm:w-8",
                                          )}
                                        >
                                          <Minus className="h-3 w-3" />
                                        </button>
                                        <input
                                          type="number"
                                          inputMode="numeric"
                                          aria-label={`จำนวน ${v.sku}`}
                                          min={1}
                                          tabIndex={isChecked ? 0 : -1}
                                          value={isChecked ? qty : ""}
                                          onChange={(e) =>
                                            setVariantQty(v.id, parseInt(e.target.value) || 0)
                                          }
                                          className={cn(
                                            CONTROL_H_SM,
                                            FOCUS_FIELD,
                                            FIELD_SURFACE,
                                            "w-14 rounded px-1 text-center text-sm sm:h-6 sm:min-h-0 sm:w-12 sm:text-xs",
                                            exceedsStock &&
                                              "border-amber-400 dark:border-amber-600",
                                          )}
                                        />
                                        <button
                                          type="button"
                                          aria-label={`เพิ่มจำนวน ${v.sku}`}
                                          tabIndex={isChecked ? 0 : -1}
                                          onClick={() => setVariantQty(v.id, qty + 1)}
                                          className={cn(
                                            CONTROL_H_SM,
                                            FOCUS_BUTTON,
                                            RADIUS.item,
                                            "flex w-11 items-center justify-center text-muted hover:bg-interactive-hover hover:text-secondary active:bg-interactive-pressed sm:w-8",
                                          )}
                                        >
                                          <Plus className="h-3 w-3" />
                                        </button>
                                      </div>
                                      {exceedsStock && (
                                        <p className="text-center text-2xs text-amber-600 dark:text-amber-400">
                                          เกินสต็อก (ต้องสั่งเพิ่ม)
                                        </p>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* No variants -- allow direct manual add */}
                      {isExpanded && product.variants.length === 0 && (
                        <div className="mb-1 ml-10 mr-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                          สินค้านี้ไม่มี variant -- ใช้ &quot;เพิ่มรายการด้วยตนเอง&quot; แทน
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
            <button
              type="button"
              onClick={handleManualEntry}
              className={cn(
                FOCUS_BUTTON,
                "min-h-11 text-center text-sm text-slate-500 underline-offset-2 transition-colors hover:text-slate-700 hover:underline sm:min-h-0 sm:text-left dark:text-slate-400 dark:hover:text-slate-300",
              )}
            >
              เพิ่มรายการด้วยตนเอง
            </button>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
              >
                ปิด
              </Button>
              {totalSelected > 0 && (
                <Button type="button" onClick={handleConfirm}>
                  เพิ่ม {totalSelected} รายการ
                </Button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
