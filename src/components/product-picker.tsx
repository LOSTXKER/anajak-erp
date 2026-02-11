"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { trpc } from "@/lib/trpc";
import { cn, formatCurrency } from "@/lib/utils";
import { Search, Package, X, ChevronDown, ChevronRight } from "lucide-react";

// ============================================================
// TYPES
// ============================================================

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
  onSelect: (product: SelectedProduct) => void;
  productGroup?: string; // "GARMENT" | "MATERIAL" | "SUPPLY"
}

// ============================================================
// CONSTANTS
// ============================================================

const GROUP_FILTERS = [
  { key: undefined as string | undefined, label: "ทั้งหมด" },
  { key: "GARMENT", label: "เสื้อสำเร็จ" },
  { key: "MATERIAL", label: "วัตถุดิบ" },
  { key: "SUPPLY", label: "อุปกรณ์" },
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

// ============================================================
// COMPONENT
// ============================================================

export function ProductPickerDialog({
  open,
  onClose,
  onSelect,
  productGroup: initialGroup,
}: ProductPickerProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(
    initialGroup,
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearch("");
      setDebouncedSearch("");
      setSelectedGroup(initialGroup);
      setExpandedId(null);
      // Focus search input after animation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, initialGroup]);

  // Query products
  const { data: products, isLoading } = trpc.product.searchForOrder.useQuery(
    {
      search: debouncedSearch || undefined,
      productGroup: selectedGroup,
      limit: 20,
    },
    { enabled: open },
  );

  const handleSelect = useCallback(
    (product: NonNullable<typeof products>[number]) => {
      const selected: SelectedProduct = {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        productType: product.productType,
        basePrice: product.basePrice,
        costPrice: product.costPrice ?? 0,
        unit: product.unit ?? null,
        source: product.source,
        variants: product.variants.map((v) => ({
          id: v.id,
          size: v.size,
          color: v.color,
          sku: v.sku,
          stock: v.totalStock ?? v.stock,
          priceAdj: v.priceAdj,
          sellingPrice: v.sellingPrice,
        })),
      };
      onSelect(selected);
      onClose();
    },
    [onSelect, onClose],
  );

  const handleManualEntry = () => {
    onClose();
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-x-4 top-[5%] z-50 mx-auto flex max-h-[90vh] max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:border-slate-700 dark:bg-slate-900">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
            <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              เลือกสินค้าจากแค็ตตาล็อก
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Search & Filters */}
          <div className="space-y-3 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
            {/* Search input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อสินค้า, SKU, บาร์โค้ด..."
                className="flex h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Group filter pills */}
            <div className="flex flex-wrap gap-1.5">
              {GROUP_FILTERS.map((g) => (
                <button
                  key={g.label}
                  type="button"
                  onClick={() => setSelectedGroup(g.key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    selectedGroup === g.key
                      ? "bg-blue-600 text-white dark:bg-blue-500"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700",
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
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 dark:border-slate-600 dark:border-t-blue-400" />
                <p className="mt-3 text-sm">กำลังโหลด...</p>
              </div>
            ) : !products || products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                <Package className="h-10 w-10" />
                <p className="mt-3 text-sm">ไม่พบสินค้า</p>
                {search && (
                  <p className="mt-1 text-xs">
                    ลองค้นหาด้วยคำอื่น หรือเพิ่มรายการด้วยตนเอง
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {products.map((product) => {
                  const isExpanded = expandedId === product.id;
                  const totalStock = product.totalStock ?? product.variants.reduce(
                    (sum, v) => sum + (v.totalStock ?? v.stock),
                    0,
                  );

                  return (
                    <div key={product.id} className="rounded-lg">
                      {/* Product row */}
                      <button
                        type="button"
                        onClick={() => handleSelect(product)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/40"
                      >
                        {/* Expand toggle */}
                        <button
                          type="button"
                          onClick={(e) => toggleExpand(product.id, e)}
                          className="flex-shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>

                        {/* Product info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
                              {product.name}
                            </span>
                            <span className="inline-flex flex-shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {PRODUCT_TYPE_LABELS[product.productType] ??
                                product.productType}
                            </span>
                            <span
                              className={cn(
                                "inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                                product.source === "STOCK"
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                              )}
                            >
                              {product.source === "STOCK" ? "Stock" : "Local"}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono">{product.sku}</span>
                            <span className="text-slate-300 dark:text-slate-600">
                              |
                            </span>
                            <span>
                              ราคา{" "}
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {formatCurrency(product.basePrice)}
                              </span>
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">
                              |
                            </span>
                            <span>
                              คงเหลือ{" "}
                              <span
                                className={cn(
                                  "font-medium",
                                  totalStock > 10
                                    ? "text-green-600 dark:text-green-400"
                                    : totalStock > 0
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-red-500 dark:text-red-400",
                                )}
                              >
                                {totalStock}
                              </span>
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Expanded variant details */}
                      {isExpanded && product.variants.length > 0 && (
                        <div className="mb-1 ml-10 mr-3 rounded-lg border border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/50">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                <th className="px-3 py-1.5 text-left font-medium">
                                  ไซส์
                                </th>
                                <th className="px-3 py-1.5 text-left font-medium">
                                  สี
                                </th>
                                <th className="px-3 py-1.5 text-left font-medium">
                                  SKU
                                </th>
                                <th className="px-3 py-1.5 text-right font-medium">
                                  คงเหลือ
                                </th>
                                <th className="px-3 py-1.5 text-right font-medium">
                                  ราคาขาย
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {product.variants.map((v) => {
                                const vStock = v.totalStock ?? v.stock;
                                return (
                                  <tr
                                    key={v.id}
                                    className="border-b border-slate-100 last:border-0 dark:border-slate-700/50"
                                  >
                                    <td className="px-3 py-1.5 font-medium text-slate-700 dark:text-slate-300">
                                      {v.size}
                                    </td>
                                    <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">
                                      {v.color || "-"}
                                    </td>
                                    <td className="px-3 py-1.5 font-mono text-slate-500 dark:text-slate-400">
                                      {v.sku}
                                    </td>
                                    <td className="px-3 py-1.5 text-right">
                                      <span
                                        className={cn(
                                          "inline-flex min-w-[2rem] justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                          vStock > 10
                                            ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                            : vStock > 0
                                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
                                        )}
                                      >
                                        {vStock}
                                      </span>
                                    </td>
                                    <td className="px-3 py-1.5 text-right font-medium text-slate-700 dark:text-slate-300">
                                      {v.sellingPrice > 0
                                        ? formatCurrency(v.sellingPrice)
                                        : "-"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-slate-700">
            <button
              type="button"
              onClick={handleManualEntry}
              className="text-sm text-slate-500 underline-offset-2 transition-colors hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-300"
            >
              เพิ่มรายการด้วยตนเอง
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              ปิด
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
