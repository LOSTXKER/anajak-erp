"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import {
  calculateItemSubtotal,
  calculateTotalQuantity,
  calculateItemPriceBreakdown,
} from "@/lib/pricing";
import {
  Plus,
  Trash2,
  Package,
  Palette,
  Printer,
  Copy,
  AlertCircle,
  Search,
  ImageIcon,
  Pencil,
  Check,
} from "lucide-react";
import type { OrderItemForm, ItemValidationErrors } from "@/types/order-form";
import {
  PRODUCT_TYPES,
  ITEM_SOURCES,
  FABRIC_TYPES,
  PRINT_POSITIONS,
  PRINT_TYPES,
  PRINT_SIZES,
  COLLAR_TYPES,
  SLEEVE_TYPES,
  BODY_FITS,
  validateOrderItem,
} from "@/types/order-form";
import { SizeMatrix } from "./size-matrix";
import { useState, useMemo, useRef, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { uploadFile } from "@/lib/supabase";
import { Scissors, Upload, Loader2, X } from "lucide-react";

const selectClass =
  "flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

const labelClass =
  "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

interface OrderItemCardProps {
  item: OrderItemForm;
  itemIdx: number;
  canRemove: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  allItems?: OrderItemForm[];
  printCatalog?: Array<{ id: string; name: string; type: string; defaultPrice: number; pricingType: string }>;
  addonCatalog?: Array<{ id: string; name: string; type: string; defaultPrice: number; pricingType: string }>;
  onUpdateItem: (idx: number, field: string, value: unknown) => void;
  onRemoveItem: (idx: number) => void;
  onAddPrint: (idx: number) => void;
  onRemovePrint: (itemIdx: number, pIdx: number) => void;
  onUpdatePrint: (itemIdx: number, pIdx: number, field: string, value: unknown) => void;
  onAddAddon: (idx: number) => void;
  onRemoveAddon: (itemIdx: number, aIdx: number) => void;
  onUpdateAddon: (itemIdx: number, aIdx: number, field: string, value: unknown) => void;
  onOpenPicker: () => void;
  onSetItems: (updater: (prev: OrderItemForm[]) => OrderItemForm[]) => void;
}

// ============================================================
// HELPER: build summary text
// ============================================================

function buildVariantsSummary(item: OrderItemForm): string {
  const sizes = [...new Set(item.variants.map((v) => v.size).filter(Boolean))];
  const colors = [...new Set(item.variants.map((v) => v.color).filter(Boolean))];
  const parts: string[] = [];
  if (sizes.length > 0) parts.push(sizes.length <= 4 ? sizes.join(",") : `${sizes[0]}-${sizes[sizes.length - 1]}`);
  if (colors.length > 0) parts.push(`(${colors.length <= 3 ? colors.join(",") : `${colors.length} สี`})`);
  return parts.join(" ") || "—";
}

function getItemLabel(item: OrderItemForm): string {
  if (item.productName) return item.productName;
  if (item.description) return item.description;
  return "รายการใหม่";
}

// ============================================================
// COMPACT ROW (collapsed state)
// ============================================================

function OrderItemRow({
  item,
  itemIdx,
  canRemove,
  isExpanded,
  onToggleExpand,
  onRemoveItem,
  totalQty,
  itemSubtotal,
  errorCount,
}: {
  item: OrderItemForm;
  itemIdx: number;
  canRemove: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRemoveItem: (idx: number) => void;
  totalQty: number;
  itemSubtotal: number;
  errorCount: number;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 transition-colors",
        isExpanded
          ? "border-b border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/40",
      )}
    >
      {/* # */}
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {itemIdx + 1}
      </span>

      {/* Source badge */}
      {item.itemSource ? (
        <Badge
          variant={item.itemSource === "FROM_STOCK" ? "default" : item.itemSource === "CUSTOMER_PROVIDED" ? "warning" : item.itemSource === "CUSTOM_MADE" ? "purple" : "default"}
          className="flex-shrink-0 text-[10px]"
        >
          {ITEM_SOURCES[item.itemSource] || item.itemSource}
        </Badge>
      ) : (
        <Badge variant="secondary" className="flex-shrink-0 text-[10px]">ยังไม่ระบุ</Badge>
      )}

      {/* Product name */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-700 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400"
      >
        {getItemLabel(item)}
      </button>

      {/* Variants summary */}
      <span className="hidden flex-shrink-0 text-xs text-slate-500 dark:text-slate-400 sm:block">
        {buildVariantsSummary(item)}
      </span>

      {/* Qty */}
      <span className="w-12 flex-shrink-0 text-center text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
        {totalQty > 0 ? totalQty : "—"}
      </span>

      {/* Print count */}
      <span className="hidden w-16 flex-shrink-0 text-center text-xs text-slate-500 dark:text-slate-400 md:block">
        {item.needsPrinting && item.prints.length > 0 ? `${item.prints.length} ลาย` : "—"}
      </span>

      {/* Subtotal */}
      <span className="w-20 flex-shrink-0 text-right text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400">
        {itemSubtotal > 0 ? formatCurrency(itemSubtotal) : "—"}
      </span>

      {/* Error indicator */}
      {errorCount > 0 && !isExpanded && (
        <span className="flex-shrink-0">
          <AlertCircle className="h-4 w-4 text-red-500" />
        </span>
      )}

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggleExpand}
          className={cn("h-7 w-7 p-0", isExpanded ? "text-blue-600" : "text-slate-400 hover:text-blue-600")}
        >
          {isExpanded ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
        </Button>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onRemoveItem(itemIdx); }}
            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// VALIDATED FIELD WRAPPER
// ============================================================

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label} {required && <span className="text-red-400">*</span>}</label>
      {children}
      {error && <p className="mt-0.5 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle className="h-3 w-3 flex-shrink-0" />{error}</p>}
    </div>
  );
}

// ============================================================
// PRINT TABLE ROW (inline table row for each print)
// ============================================================

function PrintTableRow({
  print, printIdx,
  onUpdate, onRemove,
  printCatalog, onApplyCatalog,
}: {
  print: import("@/types/order-form").PrintForm;
  printIdx: number;
  onUpdate: (field: string, value: unknown) => void;
  onRemove: () => void;
  printCatalog?: Array<{ id: string; name: string; type: string; defaultPrice: number; pricingType: string }>;
  onApplyCatalog: (catalogId: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isCustomSize = print.printSize === "CUSTOM" || !print.printSize;
  const showColorCount = print.printType === "SILK_SCREEN" || print.printType === "HEAT_TRANSFER";
  const imageUrl = print.designImagePreview || print.designImageUrl;

  const handleSizePreset = (preset: string) => {
    onUpdate("printSize", preset);
    const sizeConfig = PRINT_SIZES[preset];
    if (sizeConfig && preset !== "CUSTOM") {
      onUpdate("width", sizeConfig.width);
      onUpdate("height", sizeConfig.height);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 10 * 1024 * 1024) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => onUpdate("designImagePreview", ev.target?.result as string);
    reader.readAsDataURL(file);
    try {
      const ext = file.name.split(".").pop() || "file";
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const url = await uploadFile("designs", `orders/prints/${uniqueName}`, file);
      onUpdate("designImageUrl", url);
    } catch {
      onUpdate("designImagePreview", undefined);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <tr className="group border-b border-slate-100 last:border-0 dark:border-slate-800">
      {/* Remove + Image */}
      <td className="py-2 pr-2 align-top">
        <div className="flex items-start gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="h-7 w-7 flex-shrink-0 text-red-400 hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <input ref={inputRef} type="file" accept="image/*,.pdf,.ai,.psd" onChange={handleImageUpload} className="hidden" />
          {imageUrl ? (
            <div className="group/img relative flex-shrink-0">
              <img src={imageUrl} alt={`ลาย ${printIdx + 1}`} className="h-10 w-10 cursor-pointer rounded border border-slate-200 object-cover dark:border-slate-700" onClick={() => inputRef.current?.click()} />
              <button type="button" onClick={() => { onUpdate("designImageUrl", undefined); onUpdate("designImagePreview", undefined); }} className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white opacity-0 shadow-sm transition-opacity group-hover/img:opacity-100"><X className="h-2.5 w-2.5" /></button>
            </div>
          ) : (
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-purple-400 hover:text-purple-500 dark:border-slate-600">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </button>
          )}
        </div>
      </td>

      {/* Print type */}
      <td className="px-1.5 py-2 align-top">
        {printCatalog && printCatalog.length > 0 && (
          <select value="" onChange={(e) => { if (e.target.value) onApplyCatalog(e.target.value); }} className="mb-1 block w-full rounded border-0 bg-purple-50 px-1.5 py-0.5 text-[10px] text-purple-600 dark:bg-purple-950/30 dark:text-purple-400">
            <option value="">แค็ตตาล็อก...</option>
            {printCatalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select value={print.printType} onChange={(e) => onUpdate("printType", e.target.value)} className={`${selectClass} h-8 text-xs`}>
          {Object.entries(PRINT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {showColorCount && (
          <div className="mt-1 flex items-center gap-1">
            <span className="text-[10px] text-slate-400">สี:</span>
            <Input type="number" min={1} value={print.colorCount} onChange={(e) => onUpdate("colorCount", parseInt(e.target.value) || 1)} className="h-6 w-12 px-1.5 text-center text-xs" />
          </div>
        )}
      </td>

      {/* Print size */}
      <td className="px-1.5 py-2 align-top">
        <select value={print.printSize || ""} onChange={(e) => handleSizePreset(e.target.value)} className={`${selectClass} h-8 text-xs`}>
          <option value="">-- ขนาด --</option>
          {Object.entries(PRINT_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {isCustomSize && (
          <div className="mt-1 flex items-center gap-1">
            <Input type="number" min={0} step={0.1} value={print.width || ""} onChange={(e) => onUpdate("width", parseFloat(e.target.value) || 0)} placeholder="กว้าง" className="h-6 w-14 px-1 text-center text-[11px]" />
            <span className="text-[10px] text-slate-400">×</span>
            <Input type="number" min={0} step={0.1} value={print.height || ""} onChange={(e) => onUpdate("height", parseFloat(e.target.value) || 0)} placeholder="สูง" className="h-6 w-14 px-1 text-center text-[11px]" />
            <span className="text-[10px] text-slate-400">ซม.</span>
          </div>
        )}
      </td>

      {/* Position */}
      <td className="px-1.5 py-2 align-top">
        <select value={print.position} onChange={(e) => onUpdate("position", e.target.value)} className={`${selectClass} h-8 text-xs`}>
          {Object.entries(PRINT_POSITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </td>

      {/* Unit price */}
      <td className="pl-1.5 py-2 align-top">
        <Input type="number" min={0} step={0.01} value={print.unitPrice || ""} onChange={(e) => onUpdate("unitPrice", parseFloat(e.target.value) || 0)} placeholder="0.00" className="h-8 w-full text-xs" />
      </td>
    </tr>
  );
}

// ============================================================
// STOCK ITEM VIEW (FROM_STOCK)
// ============================================================

function StockItemView({ item, itemIdx, onOpenPicker, onSetItems }: { item: OrderItemForm; itemIdx: number; onOpenPicker: () => void; onSetItems: (updater: (prev: OrderItemForm[]) => OrderItemForm[]) => void }) {
  const handleVariantsChange = (newVariants: typeof item.variants) => {
    onSetItems((prev) => { const copy = [...prev]; copy[itemIdx] = { ...copy[itemIdx], variants: newVariants }; return copy; });
  };
  const totalQty = calculateTotalQuantity(item.variants);

  if (!item.productId) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/30 px-6 py-8 dark:border-blue-800 dark:bg-blue-950/20">
        <Package className="h-8 w-8 text-blue-300 dark:text-blue-700" />
        <p className="text-sm text-slate-500 dark:text-slate-400">เลือกสินค้าจากสต็อก</p>
        <Button type="button" variant="outline" size="sm" onClick={onOpenPicker} className="gap-1 border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400">
          <Search className="h-3.5 w-3.5" />เลือกสินค้า
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/30 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="flex items-center justify-between border-b border-blue-100 px-4 py-2.5 dark:border-blue-900/50">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">สินค้าที่ต้องสั่งผลิต</span>
          {totalQty > 0 && <Badge variant="default" className="text-[10px]">{totalQty} ชิ้น</Badge>}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onOpenPicker} className="h-7 text-xs text-blue-600 dark:text-blue-400">เปลี่ยนสินค้า</Button>
      </div>
      <div className="overflow-x-auto p-3">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <th className="w-8 pb-2" />
              <th className="pb-2 pr-2">สินค้า</th>
              <th className="min-w-[100px] pb-2 px-1.5">ราคา (ต่อหน่วย)</th>
              <th className="min-w-[100px] pb-2 px-1.5">จำนวนที่สั่งผลิต (ตัว)</th>
              <th className="min-w-[80px] pb-2 pl-1.5">สต็อก</th>
            </tr>
          </thead>
          <tbody>
            {item.variants.map((v, idx) => (
              <tr key={idx} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="py-2 align-middle">
                  {item.variants.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleVariantsChange(item.variants.filter((_, i) => i !== idx))} className="h-7 w-7 text-red-400 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2">
                    {item.productImageUrl ? (
                      <img src={item.productImageUrl} alt={item.productName || ""} className="h-10 w-10 rounded border border-slate-200 object-cover dark:border-slate-700" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"><ImageIcon className="h-4 w-4 text-slate-300 dark:text-slate-600" /></div>
                    )}
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">{item.productName || item.description}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{[v.color, v.size].filter(Boolean).join(" · ")}{item.productSku ? ` · ${item.productSku}` : ""}</span>
                    </div>
                  </div>
                </td>
                <td className="px-1.5 py-2 align-middle">
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{formatCurrency(item.baseUnitPrice)}</span>
                </td>
                <td className="px-1.5 py-2 align-middle">
                  <Input type="number" min={1} value={v.quantity} onChange={(e) => { const copy = [...item.variants]; copy[idx] = { ...copy[idx], quantity: parseInt(e.target.value) || 1 }; handleVariantsChange(copy); }} className="h-8 w-20 text-center text-sm" />
                </td>
                <td className="pl-1.5 py-2 align-middle">
                  {item.stockAvailable != null && (
                    <span className={cn("text-xs font-medium", item.stockAvailable > 10 ? "text-green-600" : item.stockAvailable > 0 ? "text-amber-600" : "text-red-500")}>
                      จำนวนคงคลัง: {item.stockAvailable}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// CUSTOM MADE VIEW (CUSTOM_MADE)
// ============================================================

function CustomMadeView({ item, itemIdx, touched, markTouched, errors, onUpdateItem, onSetItems }: { item: OrderItemForm; itemIdx: number; touched: Set<string>; markTouched: (f: string) => void; errors: ItemValidationErrors; onUpdateItem: (idx: number, field: string, value: unknown) => void; onSetItems: (updater: (prev: OrderItemForm[]) => OrderItemForm[]) => void }) {
  const handleVariantsChange = (newVariants: typeof item.variants) => {
    markTouched("variants");
    onSetItems((prev) => { const copy = [...prev]; copy[itemIdx] = { ...copy[itemIdx], variants: newVariants }; return copy; });
  };
  const totalQty = calculateTotalQuantity(item.variants);

  return (
    <div className="space-y-3">
      {/* PRODUCT INFO — table row */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/30 dark:border-blue-900 dark:bg-blue-950/20">
        <div className="flex items-center gap-2 border-b border-blue-100 px-4 py-2.5 dark:border-blue-900/50">
          <Package className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">ข้อมูลสินค้า</span>
          {touched.has("description") && errors.description && <span className="ml-auto flex items-center gap-1 text-xs text-red-500"><AlertCircle className="h-3 w-3" />{errors.description}</span>}
        </div>
        <div className="overflow-x-auto p-3">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <th className="min-w-[110px] pb-2 pr-1.5">ประเภท</th>
                <th className="min-w-[160px] pb-2 px-1.5">คำอธิบาย *</th>
                <th className="min-w-[120px] pb-2 px-1.5">วัสดุ</th>
                <th className="min-w-[100px] pb-2 pl-1.5">ราคาเสื้อเปล่า/ชิ้น *</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1 pr-1.5 align-top"><select value={item.productType} onChange={(e) => onUpdateItem(itemIdx, "productType", e.target.value)} className={`${selectClass} h-8 text-xs`}>{Object.entries(PRODUCT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                <td className="px-1.5 py-1 align-top"><Input value={item.description} onChange={(e) => onUpdateItem(itemIdx, "description", e.target.value)} onBlur={() => markTouched("description")} placeholder="รายละเอียดงาน..." className={cn("h-8 text-xs", touched.has("description") && errors.description && "border-red-300 focus:ring-red-500")} required /></td>
                <td className="px-1.5 py-1 align-top"><Input value={item.material} onChange={(e) => onUpdateItem(itemIdx, "material", e.target.value)} placeholder="เช่น Cotton 100%" className="h-8 text-xs" /></td>
                <td className="pl-1.5 py-1 align-top"><Input type="number" min={0} step={0.01} value={item.baseUnitPrice || ""} onChange={(e) => onUpdateItem(itemIdx, "baseUnitPrice", parseFloat(e.target.value) || 0)} onBlur={() => markTouched("baseUnitPrice")} placeholder="0.00" className={cn("h-8 text-xs", touched.has("baseUnitPrice") && errors.baseUnitPrice && "border-red-300 focus:ring-red-500")} required /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* FABRIC & GARMENT SPEC — table rows */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/30 dark:border-amber-900 dark:bg-amber-950/20">
        <div className="flex items-center gap-2 border-b border-amber-100 px-4 py-2.5 dark:border-amber-900/50">
          <Scissors className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">ผ้า / สเปคตัดเย็บ</span>
        </div>
        <div className="overflow-x-auto p-3">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <th className="min-w-[110px] pb-2 pr-1.5">ชนิดผ้า</th>
                <th className="min-w-[100px] pb-2 px-1.5">น้ำหนักผ้า</th>
                <th className="min-w-[100px] pb-2 px-1.5">สีผ้า</th>
                <th className="min-w-[100px] pb-2 px-1.5">ทรงคอ</th>
                <th className="min-w-[100px] pb-2 px-1.5">แขน</th>
                <th className="min-w-[100px] pb-2 pl-1.5">ทรงตัว (Fit)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1 pr-1.5 align-top"><select value={item.fabricType} onChange={(e) => onUpdateItem(itemIdx, "fabricType", e.target.value)} className={`${selectClass} h-8 text-xs`}><option value="">-- เลือก --</option>{Object.entries(FABRIC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                <td className="px-1.5 py-1 align-top"><Input value={item.fabricWeight} onChange={(e) => onUpdateItem(itemIdx, "fabricWeight", e.target.value)} placeholder="160gsm" className="h-8 text-xs" /></td>
                <td className="px-1.5 py-1 align-top"><Input value={item.fabricColor} onChange={(e) => onUpdateItem(itemIdx, "fabricColor", e.target.value)} placeholder="ขาว, ดำ" className="h-8 text-xs" /></td>
                <td className="px-1.5 py-1 align-top"><select value={item.collarType} onChange={(e) => onUpdateItem(itemIdx, "collarType", e.target.value)} className={`${selectClass} h-8 text-xs`}><option value="">-- เลือก --</option>{Object.entries(COLLAR_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                <td className="px-1.5 py-1 align-top"><select value={item.sleeveType} onChange={(e) => onUpdateItem(itemIdx, "sleeveType", e.target.value)} className={`${selectClass} h-8 text-xs`}><option value="">-- เลือก --</option>{Object.entries(SLEEVE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                <td className="pl-1.5 py-1 align-top"><select value={item.bodyFit} onChange={(e) => onUpdateItem(itemIdx, "bodyFit", e.target.value)} className={`${selectClass} h-8 text-xs`}><option value="">-- เลือก --</option>{Object.entries(BODY_FITS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
              </tr>
            </tbody>
          </table>
        </div>
        {/* Pattern section (compact) */}
        <GarmentSpecSection item={item} itemIdx={itemIdx} onUpdateItem={onUpdateItem} onSetItems={onSetItems} />
      </div>

      {/* VARIANTS — flat section */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/30 dark:border-slate-700 dark:bg-slate-800/20">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 dark:border-slate-700/50">
          <Package className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">ไซส์ / สี / จำนวน</span>
          {totalQty > 0 && <Badge variant="secondary" className="text-[10px]">{totalQty} ชิ้น</Badge>}
          {touched.has("variants") && errors.variants && <span className="ml-auto flex items-center gap-1 text-xs text-red-500"><AlertCircle className="h-3 w-3" />{errors.variants}</span>}
        </div>
        <div className="p-3">
          <SizeMatrix variants={item.variants} onChange={handleVariantsChange} />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CUSTOMER PROVIDED VIEW (CUSTOMER_PROVIDED)
// ============================================================

function CustomerProvidedView({ item, itemIdx, touched, markTouched, errors, onUpdateItem, onSetItems }: { item: OrderItemForm; itemIdx: number; touched: Set<string>; markTouched: (f: string) => void; errors: ItemValidationErrors; onUpdateItem: (idx: number, field: string, value: unknown) => void; onSetItems: (updater: (prev: OrderItemForm[]) => OrderItemForm[]) => void }) {
  const handleVariantsChange = (newVariants: typeof item.variants) => {
    markTouched("variants");
    onSetItems((prev) => { const copy = [...prev]; copy[itemIdx] = { ...copy[itemIdx], variants: newVariants }; return copy; });
  };
  const totalQty = calculateTotalQuantity(item.variants);

  return (
    <div className="space-y-3">
      {/* Description */}
      <Field label="คำอธิบาย (สินค้าที่ลูกค้าส่งมา)" required error={touched.has("description") ? errors.description : undefined}>
        <Input value={item.description} onChange={(e) => onUpdateItem(itemIdx, "description", e.target.value)} onBlur={() => markTouched("description")} placeholder="เช่น เสื้อยืดคอกลมสีขาว ลูกค้าส่งมาเอง..." className={cn("text-base", touched.has("description") && errors.description && "border-red-300 focus:ring-red-500")} required />
      </Field>

      {/* VARIANTS — flat section */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/30 dark:border-slate-700 dark:bg-slate-800/20">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 dark:border-slate-700/50">
          <Package className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">ไซส์ / จำนวน (กรอกเอง)</span>
          {totalQty > 0 && <Badge variant="secondary" className="text-[10px]">{totalQty} ชิ้น</Badge>}
          {touched.has("variants") && errors.variants && <span className="ml-auto flex items-center gap-1 text-xs text-red-500"><AlertCircle className="h-3 w-3" />{errors.variants}</span>}
        </div>
        <div className="p-3">
          <SizeMatrix variants={item.variants} onChange={handleVariantsChange} listOnly />
        </div>
      </div>

      {/* Receive tracking removed — handled in order detail page after creation */}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function OrderItemCard({
  item, itemIdx, canRemove, isExpanded, onToggleExpand,
  allItems, printCatalog, addonCatalog,
  onUpdateItem, onRemoveItem,
  onAddPrint, onRemovePrint, onUpdatePrint,
  onAddAddon, onRemoveAddon, onUpdateAddon,
  onOpenPicker, onSetItems,
}: OrderItemCardProps) {
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const markTouched = (field: string) => { setTouched((prev) => { if (prev.has(field)) return prev; const next = new Set(prev); next.add(field); return next; }); };

  const errors: ItemValidationErrors = useMemo(() => validateOrderItem(item), [item]);
  const errorCount = Object.keys(errors).length;
  const totalQty = calculateTotalQuantity(item.variants);
  const itemSubtotal = calculateItemSubtotal({ baseUnitPrice: item.baseUnitPrice, totalQuantity: totalQty, prints: item.prints, addons: item.addons });
  const breakdown = calculateItemPriceBreakdown({ baseUnitPrice: item.baseUnitPrice, totalQuantity: totalQty, prints: item.prints.map((p) => ({ ...p, position: p.position })), addons: item.addons.map((a) => ({ ...a, name: a.name })) }, PRINT_POSITIONS);

  const otherItemsWithPrints = (allItems ?? []).map((it, idx) => ({ it, idx })).filter(({ idx }) => idx !== itemIdx).filter(({ it }) => it.prints.length > 0);
  const copyPrintsFrom = (sourceIdx: number) => { const source = allItems?.[sourceIdx]; if (!source) return; onSetItems((prev) => { const copy = [...prev]; copy[itemIdx] = { ...copy[itemIdx], prints: source.prints.map((p) => ({ ...p })), needsPrinting: true }; return copy; }); };
  const applyPrintFromCatalog = (pIdx: number, catalogId: string) => { const catalogItem = printCatalog?.find((c) => c.id === catalogId); if (!catalogItem) return; onSetItems((prev) => { const copy = [...prev]; const prints = [...copy[itemIdx].prints]; prints[pIdx] = { ...prints[pIdx], printType: catalogItem.type, unitPrice: catalogItem.defaultPrice }; copy[itemIdx] = { ...copy[itemIdx], prints }; return copy; }); };
  const applyAddonFromCatalog = (aIdx: number, catalogId: string) => { const catalogItem = addonCatalog?.find((c) => c.id === catalogId); if (!catalogItem) return; onSetItems((prev) => { const copy = [...prev]; const addons = [...copy[itemIdx].addons]; addons[aIdx] = { ...addons[aIdx], addonType: catalogItem.type, name: catalogItem.name, pricingType: catalogItem.pricingType as "PER_PIECE" | "PER_ORDER", unitPrice: catalogItem.defaultPrice }; copy[itemIdx] = { ...copy[itemIdx], addons }; return copy; }); };

  const handleItemSourceChange = (source: string) => {
    markTouched("itemSource");
    onSetItems((prev) => {
      const copy = [...prev];
      const updates: Partial<OrderItemForm> = { itemSource: source };
      if (source === "CUSTOMER_PROVIDED" && copy[itemIdx].itemSource !== "CUSTOMER_PROVIDED") {
        updates.baseUnitPrice = 0;
      }
      copy[itemIdx] = { ...copy[itemIdx], ...updates };
      return copy;
    });
  };

  return (
    <div className={cn("rounded-xl border bg-white shadow-sm dark:bg-slate-900", isExpanded ? "border-blue-300 dark:border-blue-800" : "border-slate-200 dark:border-slate-700")}>
      {/* COMPACT ROW (always visible) */}
      <OrderItemRow
        item={item} itemIdx={itemIdx} canRemove={canRemove}
        isExpanded={isExpanded} onToggleExpand={onToggleExpand}
        onRemoveItem={onRemoveItem} totalQty={totalQty}
        itemSubtotal={itemSubtotal} errorCount={errorCount}
      />

      {/* EXPANDED FORM */}
      {isExpanded && (
        <div className="space-y-3 border-t border-slate-100 p-4 dark:border-slate-800">
          {/* SOURCE SELECTOR */}
          <div>
            <label className={labelClass}>สินค้ามาจากไหน? {touched.has("itemSource") && errors.itemSource && <span className="text-red-500">— {errors.itemSource}</span>}</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ITEM_SOURCES).map(([k, v]) => (
                <button key={k} type="button" onClick={() => handleItemSourceChange(k)} className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors", item.itemSource === k ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800")}>{v}</button>
              ))}
            </div>
          </div>

          {/* SOURCE-SPECIFIC VIEW */}
          {item.itemSource === "FROM_STOCK" && <StockItemView item={item} itemIdx={itemIdx} onOpenPicker={onOpenPicker} onSetItems={onSetItems} />}
          {item.itemSource === "CUSTOM_MADE" && <CustomMadeView item={item} itemIdx={itemIdx} touched={touched} markTouched={markTouched} errors={errors} onUpdateItem={onUpdateItem} onSetItems={onSetItems} />}
          {item.itemSource === "CUSTOMER_PROVIDED" && <CustomerProvidedView item={item} itemIdx={itemIdx} touched={touched} markTouched={markTouched} errors={errors} onUpdateItem={onUpdateItem} onSetItems={onSetItems} />}
          {!item.itemSource && (
            <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-200 py-8 text-slate-400 dark:border-slate-700 dark:text-slate-500">
              <Package className="h-8 w-8" /><p className="text-sm">เลือกแหล่งที่มาด้านบนเพื่อเริ่มกรอกข้อมูล</p>
            </div>
          )}

          {/* SHARED: PRINTING + ADDONS + NOTES */}
          {item.itemSource && (
            <>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/30 dark:hover:bg-slate-800/50">
                <input type="checkbox" checked={item.needsPrinting} onChange={(e) => onUpdateItem(itemIdx, "needsPrinting", e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                <Printer className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">ต้องสกรีน/พิมพ์</span>
                {item.needsPrinting && item.prints.length > 0 && <Badge variant="purple" className="text-[10px]">{item.prints.length} ตำแหน่ง</Badge>}
              </label>

              {item.needsPrinting && (
                <div className="rounded-lg border border-purple-200 bg-purple-50/30 dark:border-purple-900 dark:bg-purple-950/20">
                  <div className="flex items-center justify-between border-b border-purple-100 px-4 py-2.5 dark:border-purple-900/50">
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4 text-purple-500" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">ลายที่ต้องการสั่งผลิต</span>
                      {item.prints.length > 0 && <Badge variant="purple" className="text-[10px]">{item.prints.length} ลาย</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      {otherItemsWithPrints.length > 0 && (
                        <div className="relative">
                          <select value="" onChange={(e) => { if (e.target.value) copyPrintsFrom(parseInt(e.target.value)); }} className="h-7 appearance-none rounded-md border-0 bg-transparent pl-6 pr-2 text-xs text-purple-600 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/50">
                            <option value="">คัดลอกลาย...</option>
                            {otherItemsWithPrints.map(({ it, idx }) => <option key={idx} value={idx}>#{idx + 1} {it.description.slice(0, 20)} ({it.prints.length} ลาย)</option>)}
                          </select>
                          <Copy className="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-purple-500" />
                        </div>
                      )}
                      <Button type="button" variant="ghost" size="sm" onClick={() => onAddPrint(itemIdx)} className="h-7 gap-1 px-2 text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400"><Plus className="h-3 w-3" />เพิ่มลาย</Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto p-3">
                    {item.prints.length === 0 ? (
                      <p className="py-4 text-center text-xs italic text-slate-400 dark:text-slate-500">ยังไม่มีลายสกรีน — กด &quot;เพิ่มลาย&quot; เพื่อเริ่ม</p>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            <th className="w-24 pb-2 pr-2">ลาย</th>
                            <th className="min-w-[120px] pb-2 px-1.5">วิธีพิมพ์</th>
                            <th className="min-w-[140px] pb-2 px-1.5">ขนาดพิมพ์</th>
                            <th className="min-w-[110px] pb-2 px-1.5">ตำแหน่ง</th>
                            <th className="min-w-[90px] pb-2 pl-1.5">ค่าสกรีน (ต่อหน่วย)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.prints.map((p, pIdx) => (
                            <PrintTableRow
                              key={pIdx}
                              print={p}
                              printIdx={pIdx}
                              onUpdate={(field, value) => onUpdatePrint(itemIdx, pIdx, field, value)}
                              onRemove={() => onRemovePrint(itemIdx, pIdx)}
                              printCatalog={printCatalog}
                              onApplyCatalog={(catalogId) => applyPrintFromCatalog(pIdx, catalogId)}
                            />
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50/30 dark:border-slate-700 dark:bg-slate-800/20">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-slate-500" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">ส่วนเสริม (Add-ons)</span>
                    {item.addons.length > 0 && <Badge variant="secondary" className="text-[10px]">{item.addons.length}</Badge>}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => onAddAddon(itemIdx)} className="h-7 px-2 text-xs"><Plus className="mr-1 h-3 w-3" />Add-on</Button>
                </div>
                <div className="overflow-x-auto p-3">
                  {item.addons.length === 0 ? (
                    <p className="py-2 text-center text-xs italic text-slate-400 dark:text-slate-500">ไม่มีส่วนเสริม — กด &quot;Add-on&quot; เพื่อเพิ่ม</p>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          <th className="w-8 pb-2" />
                          <th className="min-w-[100px] pb-2 px-1">ประเภท</th>
                          <th className="min-w-[120px] pb-2 px-1">ชื่อ</th>
                          <th className="min-w-[90px] pb-2 px-1">คิดราคา</th>
                          <th className="min-w-[80px] pb-2 pl-1">ราคา *</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.addons.map((a, aIdx) => (
                          <tr key={aIdx} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                            <td className="py-1.5 align-middle"><Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => onRemoveAddon(itemIdx, aIdx)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                            <td className="px-1 py-1.5 align-middle">
                              {addonCatalog && addonCatalog.length > 0 ? (
                                <select value="" onChange={(e) => { if (e.target.value) applyAddonFromCatalog(aIdx, e.target.value); e.target.value = ""; }} className={`${selectClass} h-8 text-xs`}>
                                  <option value="">{a.addonType || "แค็ตตาล็อก..."}</option>
                                  {addonCatalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              ) : (
                                <Input value={a.addonType} onChange={(e) => onUpdateAddon(itemIdx, aIdx, "addonType", e.target.value)} placeholder="LABEL, TAG..." className="h-8 text-xs" />
                              )}
                            </td>
                            <td className="px-1 py-1.5 align-middle"><Input value={a.name} onChange={(e) => onUpdateAddon(itemIdx, aIdx, "name", e.target.value)} placeholder="ชื่อ add-on" className="h-8 text-xs" /></td>
                            <td className="px-1 py-1.5 align-middle"><select value={a.pricingType} onChange={(e) => onUpdateAddon(itemIdx, aIdx, "pricingType", e.target.value as "PER_PIECE" | "PER_ORDER")} className={`${selectClass} h-8 text-xs`}><option value="PER_PIECE">ต่อชิ้น</option><option value="PER_ORDER">ต่อออเดอร์</option></select></td>
                            <td className="pl-1 py-1.5 align-middle"><Input type="number" min={0} step={0.01} value={a.unitPrice || ""} onChange={(e) => onUpdateAddon(itemIdx, aIdx, "unitPrice", parseFloat(e.target.value) || 0)} placeholder="0.00" className="h-8 text-xs" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div><label className={labelClass}>หมายเหตุรายการ</label><Input value={item.notes} onChange={(e) => onUpdateItem(itemIdx, "notes", e.target.value)} placeholder="หมายเหตุเพิ่มเติมสำหรับรายการนี้..." /></div>
            </>
          )}

          {/* PRICE BREAKDOWN */}
          {totalQty > 0 && itemSubtotal > 0 && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/20">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                {breakdown.lines.map((line, i) => (<span key={i} className="inline-flex items-baseline gap-0.5">{i > 0 && <span className="text-slate-400">+</span>}<span>{line.label}</span><span className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(line.unitPrice)}</span>{line.type === "addon_order" && <span className="text-[10px] text-slate-400">(ต่อออเดอร์)</span>}</span>))}
              </div>
              <div className="mt-1.5 flex items-baseline gap-1 text-sm">
                <span className="text-slate-500 dark:text-slate-400">=</span>
                <span className="font-semibold text-blue-700 dark:text-blue-300">{formatCurrency(breakdown.unitPriceTotal)}/ชิ้น</span>
                <span className="text-slate-400">x</span>
                <span className="text-slate-600 dark:text-slate-300">{totalQty} ชิ้น</span>
                <span className="text-slate-400">=</span>
                <span className="font-bold text-blue-700 dark:text-blue-300">{formatCurrency(breakdown.grandTotal)}</span>
              </div>
            </div>
          )}

          {/* Collapse button */}
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onToggleExpand} className="gap-1 text-xs">
              <Check className="h-3.5 w-3.5" />
              เสร็จสิ้น
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// GARMENT SPEC SECTION (for CUSTOM_MADE)
// ============================================================

function GarmentSpecSection({ item, itemIdx, onUpdateItem, onSetItems }: { item: OrderItemForm; itemIdx: number; onUpdateItem: (idx: number, field: string, value: unknown) => void; onSetItems: (updater: (prev: OrderItemForm[]) => OrderItemForm[]) => void }) {
  const [patternSearch, setPatternSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const { data: patterns } = trpc.pattern.list.useQuery({ isActive: true, search: patternSearch || undefined }, { enabled: item.patternMode === "catalog" });
  const allPatterns = trpc.pattern.list.useQuery({ isActive: true }, { enabled: item.patternMode === "catalog" });

  const handleSelectPattern = (p: NonNullable<typeof patterns>[number]) => {
    onSetItems((prev) => { const copy = [...prev]; copy[itemIdx] = { ...copy[itemIdx], patternId: p.id, collarType: p.collarType ?? "", sleeveType: p.sleeveType ?? "", bodyFit: p.bodyFit ?? "", patternFileUrl: p.fileUrl ?? "", patternNote: copy[itemIdx].patternNote }; return copy; });
    setPatternSearch("");
  };

  const handlePatternFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try { const ext = file.name.split(".").pop() || "file"; const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`; const path = `patterns/${uniqueName}`; const url = await uploadFile("designs", path, file); onUpdateItem(itemIdx, "patternFileUrl", url); } catch { /* silently fail */ } finally { setUploading(false); e.target.value = ""; }
  };

  const selectedPattern = (patterns ?? allPatterns.data)?.find((p) => p.id === item.patternId);

  return (
    <div className="border-t border-amber-100 px-4 pb-3 pt-2 dark:border-amber-900/50">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">แพทเทิร์น</span>
        <div className="flex rounded border border-amber-200 dark:border-amber-800">
          <button type="button" onClick={() => onUpdateItem(itemIdx, "patternMode", "catalog")} className={cn("px-2 py-1 text-[10px] font-medium transition-colors", item.patternMode === "catalog" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" : "text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-950/30")}>สำเร็จรูป</button>
          <button type="button" onClick={() => { onUpdateItem(itemIdx, "patternMode", "custom"); onUpdateItem(itemIdx, "patternId", undefined); }} className={cn("px-2 py-1 text-[10px] font-medium transition-colors", item.patternMode === "custom" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" : "text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-950/30")}>ระบุเอง</button>
        </div>
        {item.patternMode === "custom" && (
          <label className="ml-auto flex cursor-pointer items-center gap-1 text-[10px] text-amber-600 hover:text-amber-700 dark:text-amber-400">
            <input type="file" accept=".pdf,.ai,.svg,image/*" onChange={handlePatternFileUpload} className="hidden" disabled={uploading} />
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {uploading ? "อัพโหลด..." : item.patternFileUrl ? "เปลี่ยนไฟล์" : "อัพโหลดไฟล์"}
          </label>
        )}
        {item.patternFileUrl && <a href={item.patternFileUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline">ดูไฟล์</a>}
      </div>

      {item.patternMode === "catalog" && (
        <div className="mb-2">
          <div className="relative mb-1.5"><Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" /><input type="text" value={patternSearch} onChange={(e) => setPatternSearch(e.target.value)} placeholder="ค้นหาแพทเทิร์น..." className="h-7 w-full rounded border border-slate-200 bg-white pl-7 pr-2 text-xs placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" /></div>
          {selectedPattern && (
            <div className="flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 dark:border-amber-800 dark:bg-amber-950/30">
              {selectedPattern.thumbnailUrl ? <img src={selectedPattern.thumbnailUrl} alt={selectedPattern.name} className="h-8 w-8 rounded object-cover" /> : <div className="flex h-8 w-8 items-center justify-center rounded bg-amber-100 dark:bg-amber-900/50"><Scissors className="h-3.5 w-3.5 text-amber-500" /></div>}
              <div className="flex-1 min-w-0"><span className="block truncate text-xs font-semibold text-amber-800 dark:text-amber-200">{selectedPattern.name}</span><span className="block truncate text-[10px] text-amber-600 dark:text-amber-400">{[selectedPattern.collarType && COLLAR_TYPES[selectedPattern.collarType], selectedPattern.sleeveType && SLEEVE_TYPES[selectedPattern.sleeveType], selectedPattern.bodyFit && BODY_FITS[selectedPattern.bodyFit]].filter(Boolean).join(" · ")}</span></div>
              <button type="button" onClick={() => onUpdateItem(itemIdx, "patternId", undefined)} className="text-amber-400 hover:text-amber-600">&times;</button>
            </div>
          )}
          {!selectedPattern && (
            <div className="grid max-h-36 grid-cols-3 gap-1 overflow-y-auto sm:grid-cols-4">
              {(patternSearch ? patterns : allPatterns.data)?.map((p) => (
                <button key={p.id} type="button" onClick={() => handleSelectPattern(p)} className="flex items-center gap-1.5 rounded border border-slate-200 bg-white p-1.5 text-left text-[10px] transition-colors hover:border-amber-400 hover:bg-amber-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-amber-600 dark:hover:bg-amber-950/30">
                  {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt={p.name} className="h-7 w-7 rounded object-cover" /> : <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-100 dark:bg-slate-700"><Scissors className="h-3 w-3 text-slate-400" /></div>}
                  <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">{p.name}</span>
                </button>
              ))}
              {(patternSearch ? patterns : allPatterns.data)?.length === 0 && <p className="col-span-full py-3 text-center text-[10px] italic text-slate-400">ไม่พบแพทเทิร์น</p>}
            </div>
          )}
        </div>
      )}

      <Input value={item.patternNote} onChange={(e) => onUpdateItem(itemIdx, "patternNote", e.target.value)} placeholder="หมายเหตุแพทเทิร์น เช่น ตะเข็บคู่, ตีนผ้า RIB..." className="h-7 text-xs" />
    </div>
  );
}
