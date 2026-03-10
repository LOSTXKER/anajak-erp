"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { calculateTotalQuantity } from "@/lib/pricing";
import {
  Plus,
  Trash2,
  Package,
  Palette,
  Copy,
  AlertCircle,
  ImageIcon,
  Pencil,
  Check,
  ChevronUp,
  ChevronDown,
  PackagePlus,
  Scissors,
  Shirt,
} from "lucide-react";
import type { OrderItemForm, OrderItemProductForm } from "@/types/order-form";
import {
  PRODUCT_TYPES,
  PRINT_POSITIONS,
  PRINT_TYPES,
  PRINT_SIZES,
  ITEM_SOURCES,
  FABRIC_TYPES,
  COLLAR_TYPES,
  SLEEVE_TYPES,
  BODY_FITS,
  EMPTY_PRODUCT,
} from "@/types/order-form";
import { useState, useRef, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { uploadFile } from "@/lib/supabase";
import { Loader2, X } from "lucide-react";

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

function getItemLabel(item: OrderItemForm): string {
  if (item.description) return item.description;
  const first = item.products[0];
  if (first?.productName) return first.productName;
  if (first?.description) return first.description;
  return "รายการใหม่";
}

function getItemTotalQty(item: OrderItemForm): number {
  return item.products.reduce((s, p) => s + calculateTotalQuantity(p.variants), 0);
}

function getItemSubtotal(item: OrderItemForm): number {
  const totalQty = getItemTotalQty(item);
  const productsCost = item.products.reduce((s, p) => {
    const pQty = calculateTotalQuantity(p.variants);
    const net = Math.max(0, p.baseUnitPrice - (p.discount || 0));
    return s + pQty * net;
  }, 0);
  const printsCost = totalQty * item.prints.reduce((s, p) => s + p.unitPrice, 0);
  const addonsCost = item.addons.reduce((s, a) => {
    if (a.pricingType === "PER_PIECE") return s + totalQty * a.unitPrice;
    return s + a.unitPrice;
  }, 0);
  return productsCost + printsCost + addonsCost;
}

// ============================================================
// COLLAPSED ROW
// ============================================================

function OrderItemRow({
  item, itemIdx, canRemove, isExpanded, onToggleExpand, onRemoveItem,
}: {
  item: OrderItemForm;
  itemIdx: number;
  canRemove: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRemoveItem: (idx: number) => void;
}) {
  const totalQty = getItemTotalQty(item);
  const subtotal = getItemSubtotal(item);
  const productCount = item.products.length;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 transition-colors",
        isExpanded
          ? "border-b border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/40",
      )}
    >
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {itemIdx + 1}
      </span>

      <button
        type="button"
        onClick={onToggleExpand}
        className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-700 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400"
      >
        {getItemLabel(item)}
        {productCount > 0 && (
          <span className="ml-1.5 text-xs font-normal text-slate-400">
            · {productCount} สินค้า
          </span>
        )}
      </button>

      <span className="w-12 flex-shrink-0 text-center text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
        {totalQty > 0 ? totalQty : "—"}
      </span>

      <span className="hidden w-16 flex-shrink-0 text-center text-xs text-slate-500 dark:text-slate-400 md:block">
        {item.prints.length > 0 ? `${item.prints.length} ลาย` : "—"}
      </span>

      <span className="w-20 flex-shrink-0 text-right text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400">
        {subtotal > 0 ? formatCurrency(subtotal) : "—"}
      </span>

      <div className="flex flex-shrink-0 items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={onToggleExpand} className={cn("h-7 w-7 p-0", isExpanded ? "text-blue-600" : "text-slate-400 hover:text-blue-600")}>
          {isExpanded ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
        </Button>
        {canRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onRemoveItem(itemIdx); }} className="h-7 w-7 p-0 text-slate-400 hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// FIELD WRAPPER
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
// PRINT TABLE ROW (compacted: 4 columns)
// ============================================================

function PrintTableRow({
  print, printIdx, onUpdate, onRemove, printCatalog, onApplyCatalog,
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
    <>
      <tr className="group border-b border-slate-100 last:border-0 dark:border-slate-800">
        {/* Image */}
        <td className="py-2 pr-1 align-middle">
          <input ref={inputRef} type="file" accept="image/*,.pdf,.ai,.psd" onChange={handleImageUpload} className="hidden" />
          {imageUrl ? (
            <div className="group/img relative inline-block">
              <img src={imageUrl} alt={`ลาย ${printIdx + 1}`} className="h-8 w-8 cursor-pointer rounded border border-slate-200 object-cover dark:border-slate-700" onClick={() => inputRef.current?.click()} />
              <button type="button" onClick={() => { onUpdate("designImageUrl", undefined); onUpdate("designImagePreview", undefined); }} className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white opacity-0 shadow-sm transition-opacity group-hover/img:opacity-100"><X className="h-2.5 w-2.5" /></button>
            </div>
          ) : (
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-purple-400 hover:text-purple-500 dark:border-slate-600">
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            </button>
          )}
        </td>
        {/* Print type (+ catalog) */}
        <td className="px-1 py-2 align-middle">
          {printCatalog && printCatalog.length > 0 ? (
            <select value="" onChange={(e) => { if (e.target.value) onApplyCatalog(e.target.value); }} className={`${selectClass} h-8 text-xs`}>
              <option value="">{print.printType ? PRINT_TYPES[print.printType] || print.printType : "วิธีพิมพ์..."}</option>
              {printCatalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <select value={print.printType} onChange={(e) => onUpdate("printType", e.target.value)} className={`${selectClass} h-8 text-xs`}>
              {Object.entries(PRINT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
        </td>
        {/* Size */}
        <td className="px-1 py-2 align-middle">
          <select value={print.printSize || ""} onChange={(e) => handleSizePreset(e.target.value)} className={`${selectClass} h-8 text-xs`}>
            <option value="">ขนาด...</option>
            {Object.entries(PRINT_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </td>
        {/* Position */}
        <td className="px-1 py-2 align-middle">
          <select value={print.position} onChange={(e) => onUpdate("position", e.target.value)} className={`${selectClass} h-8 text-xs`}>
            {Object.entries(PRINT_POSITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </td>
        {/* Color count */}
        <td className="px-1 py-2 align-middle">
          {showColorCount ? (
            <Input type="number" min={1} value={print.colorCount} onChange={(e) => onUpdate("colorCount", parseInt(e.target.value) || 1)} className="h-8 w-14 px-1.5 text-center text-xs" />
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </td>
        {/* Price */}
        <td className="px-1 py-2 align-middle">
          <Input type="number" min={0} step={0.01} value={print.unitPrice || ""} onChange={(e) => onUpdate("unitPrice", parseFloat(e.target.value) || 0)} placeholder="0.00" className="h-8 w-full text-xs" />
        </td>
        {/* Delete */}
        <td className="py-2 pl-1 align-middle">
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="h-7 w-7 text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
        </td>
      </tr>
      {isCustomSize && (
        <tr className="border-b border-slate-100 last:border-0 dark:border-slate-800">
          <td />
          <td />
          <td colSpan={5} className="px-1 pb-2 pt-0">
            <div className="flex items-center gap-1">
              <Input type="number" min={0} step={0.1} value={print.width || ""} onChange={(e) => onUpdate("width", parseFloat(e.target.value) || 0)} placeholder="กว้าง" className="h-6 w-16 px-1 text-center text-[11px]" />
              <span className="text-[10px] text-slate-400">x</span>
              <Input type="number" min={0} step={0.1} value={print.height || ""} onChange={(e) => onUpdate("height", parseFloat(e.target.value) || 0)} placeholder="สูง" className="h-6 w-16 px-1 text-center text-[11px]" />
              <span className="text-[10px] text-slate-400">ซม.</span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ============================================================
// ADD PRODUCT POPOVER
// ============================================================

function AddProductPopover({
  onAddFromStock,
  onAddCustomMade,
  onAddCustomerProvided,
}: {
  onAddFromStock: () => void;
  onAddCustomMade: () => void;
  onAddCustomerProvided: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="h-7 gap-1 border-blue-300 px-2.5 text-xs text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950"
      >
        <Plus className="h-3.5 w-3.5" />เพิ่มสินค้า
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => { onAddFromStock(); setOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Package className="h-4 w-4 text-blue-500" />
              เลือกจากสต็อก
            </button>
            <button
              type="button"
              onClick={() => { onAddCustomMade(); setOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Scissors className="h-4 w-4 text-amber-500" />
              สั่งตัดเย็บใหม่
            </button>
            <button
              type="button"
              onClick={() => { onAddCustomerProvided(); setOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Shirt className="h-4 w-4 text-orange-500" />
              ลูกค้าส่งของมา
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// CUSTOM_MADE DETAIL (pattern + fabric + garment spec)
// ============================================================

function QuickAddPattern({
  onCreated,
  onCancel,
}: {
  onCreated: (patternId: string) => void;
  onCancel: () => void;
}) {
  const utils = trpc.useUtils();
  const createMutation = trpc.pattern.create.useMutation({
    onSuccess: (created) => {
      utils.pattern.list.invalidate();
      onCreated(created.id);
    },
  });
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setUploading(true);
    try {
      let thumbnailUrl: string | undefined;
      if (file) {
        const ext = file.name.split(".").pop() || "file";
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        thumbnailUrl = await uploadFile("designs", `patterns/${uniqueName}`, file);
      }
      await createMutation.mutateAsync({ name: name.trim(), thumbnailUrl });
    } catch { /* ignore */ }
    setUploading(false);
  };

  return (
    <div className="mt-2 rounded border border-amber-300 bg-white p-2.5 dark:border-amber-700 dark:bg-amber-950/30">
      <span className="mb-2 block text-[11px] font-medium text-amber-700 dark:text-amber-300">สร้างแพทเทิร์นใหม่</span>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อแพทเทิร์น เช่น คอกลมแขนสั้น"
            className="h-8 text-xs"
          />
          <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded border border-dashed border-slate-300 px-2 py-1 text-[11px] text-slate-500 transition-colors hover:border-amber-400 hover:text-amber-600 dark:border-slate-600">
            <Plus className="h-3 w-3" />
            {file ? file.name : "แนบรูป/ไฟล์ (ไม่บังคับ)"}
            <input type="file" accept="image/*,.pdf,.ai,.psd" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
          </label>
        </div>
        <div className="flex gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-7 px-2 text-xs" disabled={uploading}>ยกเลิก</Button>
          <Button type="button" size="sm" onClick={handleSave} className="h-7 px-3 text-xs" disabled={!name.trim() || uploading}>
            {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            บันทึก
          </Button>
        </div>
      </div>
    </div>
  );
}

function CustomMadeDetail({
  product, updateProduct,
}: {
  product: OrderItemProductForm;
  updateProduct: (field: string, value: unknown) => void;
}) {
  const { data: patterns, isLoading: patternsLoading } = trpc.pattern.list.useQuery({ isActive: true });
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const selectedPattern = product.patternId
    ? patterns?.find((p) => p.id === product.patternId)
    : null;

  const handlePatternSelect = (patternId: string) => {
    if (!patternId) {
      updateProduct("patternId", undefined);
      return;
    }
    const pat = patterns?.find((p) => p.id === patternId);
    if (!pat) return;
    updateProduct("patternId", patternId);
    if (pat.collarType) updateProduct("collarType", pat.collarType);
    if (pat.sleeveType) updateProduct("sleeveType", pat.sleeveType);
    if (pat.bodyFit) updateProduct("bodyFit", pat.bodyFit);
  };

  const handleQuickAddCreated = (patternId: string) => {
    setShowQuickAdd(false);
    handlePatternSelect(patternId);
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-800/50 dark:bg-amber-950/20">
      {/* Pattern section */}
      <div className="mb-3">
        <div className="mb-2 flex items-center gap-2">
          <Scissors className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">แพทเทิร์น</span>
          {!showQuickAdd && (
            <button
              type="button"
              onClick={() => setShowQuickAdd(true)}
              className="ml-auto flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
            >
              <Plus className="h-3 w-3" />สร้างใหม่
            </button>
          )}
        </div>

        {showQuickAdd ? (
          <QuickAddPattern
            onCreated={handleQuickAddCreated}
            onCancel={() => setShowQuickAdd(false)}
          />
        ) : (
          <div>
            <select
              value={product.patternId || ""}
              onChange={(e) => handlePatternSelect(e.target.value)}
              className={`${selectClass} h-8 text-xs`}
              disabled={patternsLoading}
            >
              <option value="">{patternsLoading ? "กำลังโหลด..." : "-- เลือกแพทเทิร์น --"}</option>
              {patterns?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.description ? ` — ${p.description}` : ""}
                </option>
              ))}
            </select>
            {selectedPattern && (
              <div className="mt-2 flex items-start gap-3 rounded border border-amber-200 bg-white p-2 dark:border-amber-800 dark:bg-amber-950/30">
                {selectedPattern.thumbnailUrl && (
                  <img
                    src={selectedPattern.thumbnailUrl}
                    alt={selectedPattern.name}
                    className="h-16 w-16 flex-shrink-0 rounded border border-slate-200 object-cover dark:border-slate-700"
                  />
                )}
                <div className="min-w-0 text-xs">
                  <span className="block font-medium text-slate-700 dark:text-slate-200">{selectedPattern.name}</span>
                  {selectedPattern.description && (
                    <span className="block text-slate-500">{selectedPattern.description}</span>
                  )}
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                    {selectedPattern.collarType && <span>คอ: <span className="text-slate-600 dark:text-slate-300">{COLLAR_TYPES[selectedPattern.collarType] || selectedPattern.collarType}</span></span>}
                    {selectedPattern.sleeveType && <span>แขน: <span className="text-slate-600 dark:text-slate-300">{SLEEVE_TYPES[selectedPattern.sleeveType] || selectedPattern.sleeveType}</span></span>}
                    {selectedPattern.bodyFit && <span>ทรง: <span className="text-slate-600 dark:text-slate-300">{BODY_FITS[selectedPattern.bodyFit] || selectedPattern.bodyFit}</span></span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fabric + Garment spec */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
        <Field label="ประเภทสินค้า">
          <select value={product.productType} onChange={(e) => updateProduct("productType", e.target.value)} className={`${selectClass} h-8 text-xs`}>
            {Object.entries(PRODUCT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="ชนิดผ้า">
          <select value={product.fabricType} onChange={(e) => updateProduct("fabricType", e.target.value)} className={`${selectClass} h-8 text-xs`}>
            <option value="">-- เลือก --</option>
            {Object.entries(FABRIC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="ส่วนผสมผ้า">
          <Input value={product.material} onChange={(e) => updateProduct("material", e.target.value)} placeholder="เช่น Cotton 60% Poly 40%" className="h-8 text-xs" />
        </Field>
        <Field label="น้ำหนักผ้า">
          <Input value={product.fabricWeight} onChange={(e) => updateProduct("fabricWeight", e.target.value)} placeholder="160gsm" className="h-8 text-xs" />
        </Field>
        <Field label="สีผ้า">
          <Input value={product.fabricColor} onChange={(e) => updateProduct("fabricColor", e.target.value)} placeholder="ขาว, ดำ" className="h-8 text-xs" />
        </Field>
        <Field label="ทรงคอ">
          <select value={product.collarType} onChange={(e) => updateProduct("collarType", e.target.value)} className={`${selectClass} h-8 text-xs`}>
            <option value="">-- เลือก --</option>
            {Object.entries(COLLAR_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="แขน">
          <select value={product.sleeveType} onChange={(e) => updateProduct("sleeveType", e.target.value)} className={`${selectClass} h-8 text-xs`}>
            <option value="">-- เลือก --</option>
            {Object.entries(SLEEVE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="ทรงตัว">
          <select value={product.bodyFit} onChange={(e) => updateProduct("bodyFit", e.target.value)} className={`${selectClass} h-8 text-xs`}>
            <option value="">-- เลือก --</option>
            {Object.entries(BODY_FITS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="หมายเหตุแพทเทิร์น">
          <Input value={product.patternNote} onChange={(e) => updateProduct("patternNote", e.target.value)} placeholder="หมายเหตุ..." className="h-8 text-xs" />
        </Field>
      </div>
    </div>
  );
}

// ============================================================
// PRODUCT TABLE ROW (flat: 1 row = 1 SKU)
// ============================================================

function ProductTableRow({
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
            <select
              value={product.packagingOptionId}
              onChange={(e) => updateProduct("packagingOptionId", e.target.value)}
              className={`${selectClass} h-8 text-xs`}
            >
              <option value="">—</option>
              {packagingOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
            </select>
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

// ============================================================
// MAIN ORDER ITEM CARD
// ============================================================

export function OrderItemCard({
  item, itemIdx, canRemove, isExpanded, onToggleExpand,
  allItems, printCatalog, addonCatalog,
  onUpdateItem, onRemoveItem,
  onAddPrint, onRemovePrint, onUpdatePrint,
  onAddAddon, onRemoveAddon, onUpdateAddon,
  onOpenPicker, onSetItems,
}: OrderItemCardProps) {
  const otherItemsWithPrints = (allItems ?? []).map((it, idx) => ({ it, idx })).filter(({ idx }) => idx !== itemIdx).filter(({ it }) => it.prints.length > 0);

  const copyPrintsFrom = (sourceIdx: number) => {
    const source = allItems?.[sourceIdx];
    if (!source) return;
    onSetItems((prev) => {
      const copy = [...prev];
      copy[itemIdx] = { ...copy[itemIdx], prints: source.prints.map((p) => ({ ...p })) };
      return copy;
    });
  };

  const applyPrintFromCatalog = (pIdx: number, catalogId: string) => {
    const catalogItem = printCatalog?.find((c) => c.id === catalogId);
    if (!catalogItem) return;
    onSetItems((prev) => {
      const copy = [...prev];
      const prints = [...copy[itemIdx].prints];
      prints[pIdx] = { ...prints[pIdx], printType: catalogItem.type, unitPrice: catalogItem.defaultPrice };
      copy[itemIdx] = { ...copy[itemIdx], prints };
      return copy;
    });
  };

  const applyAddonFromCatalog = (aIdx: number, catalogId: string) => {
    const catalogItem = addonCatalog?.find((c) => c.id === catalogId);
    if (!catalogItem) return;
    onSetItems((prev) => {
      const copy = [...prev];
      const addons = [...copy[itemIdx].addons];
      addons[aIdx] = { ...addons[aIdx], addonType: catalogItem.type, name: catalogItem.name, pricingType: catalogItem.pricingType as "PER_PIECE" | "PER_ORDER", unitPrice: catalogItem.defaultPrice };
      copy[itemIdx] = { ...copy[itemIdx], addons };
      return copy;
    });
  };

  const addProductWithSource = (source: string) => {
    onSetItems((prev) => {
      const copy = [...prev];
      const newProd = structuredClone(EMPTY_PRODUCT);
      newProd.itemSource = source;
      if (source === "CUSTOMER_PROVIDED") newProd.baseUnitPrice = 0;
      copy[itemIdx] = { ...copy[itemIdx], products: [...copy[itemIdx].products, newProd] };
      return copy;
    });
  };

  const totalQty = getItemTotalQty(item);
  const subtotal = getItemSubtotal(item);

  return (
    <div className={cn("rounded-xl border bg-white shadow-sm dark:bg-slate-900", isExpanded ? "border-blue-300 dark:border-blue-800" : "border-slate-200 dark:border-slate-700")}>
      <OrderItemRow
        item={item} itemIdx={itemIdx} canRemove={canRemove}
        isExpanded={isExpanded} onToggleExpand={onToggleExpand}
        onRemoveItem={onRemoveItem}
      />

      {isExpanded && (
        <div className="space-y-4 p-4">
          {/* Job description */}
          <Field label="คำอธิบายงาน">
            <Input value={item.description} onChange={(e) => onUpdateItem(itemIdx, "description", e.target.value)} placeholder="เช่น งานสกรีนทีม ABC, งานพิมพ์เสื้อกิจกรรม..." />
          </Field>

          {/* ── PRINTS ── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">ลายที่ต้องการสั่งผลิต</span>
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
                <Button type="button" variant="outline" size="sm" onClick={() => onAddPrint(itemIdx)} className="h-7 gap-1 border-purple-300 px-2.5 text-xs text-purple-600 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-950">
                  <Plus className="h-3.5 w-3.5" />เพิ่มลาย
                </Button>
              </div>
            </div>
            {item.prints.length === 0 ? (
              <p className="py-3 text-center text-xs italic text-slate-400 dark:text-slate-500">ยังไม่มีลายสกรีน — กด &quot;เพิ่มลาย&quot; เพื่อเริ่ม</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      <th className="pb-2 pr-1">รูปแบบ</th>
                      <th className="pb-2 px-1">วิธีพิมพ์</th>
                      <th className="pb-2 px-1">ขนาด</th>
                      <th className="pb-2 px-1">ตำแหน่ง</th>
                      <th className="w-14 pb-2 px-1">สี</th>
                      <th className="min-w-[80px] pb-2 px-1">ค่าสกรีน</th>
                      <th className="w-14 pb-2" />
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
              </div>
            )}
          </div>

          {/* ── PRODUCTS (flat table) ── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackagePlus className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">สินค้าที่ต้องการสั่งผลิต</span>
              </div>
              <AddProductPopover
                onAddFromStock={onOpenPicker}
                onAddCustomMade={() => addProductWithSource("CUSTOM_MADE")}
                onAddCustomerProvided={() => addProductWithSource("CUSTOMER_PROVIDED")}
              />
            </div>
            {item.products.length === 0 ? (
              <p className="py-3 text-center text-xs italic text-slate-400 dark:text-slate-500">ยังไม่มีสินค้า — กด &quot;เพิ่มสินค้า&quot; เพื่อเริ่ม</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" style={{ tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: 80 }} />
                    <col />
                    <col style={{ width: 100 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 130 }} />
                    <col style={{ width: 56 }} />
                  </colgroup>
                  <thead>
                    <tr className="text-left text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      <th className="pb-2 pl-1">แหล่ง</th>
                      <th className="pb-2 pr-2">สินค้า</th>
                      <th className="pb-2 px-1.5">ราคา (ต่อหน่วย)</th>
                      <th className="pb-2 px-1.5">จำนวน</th>
                      <th className="pb-2 px-1.5">ส่วนลด</th>
                      <th className="pb-2 px-1.5">แพ็คเกจ</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {item.products.map((prod, pIdx) => (
                      <ProductTableRow
                        key={pIdx}
                        product={prod}
                        prodIdx={pIdx}
                        itemIdx={itemIdx}
                        totalProducts={item.products.length}
                        onSetItems={onSetItems}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── ADD-ONS ── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">ส่วนเสริม (Add-ons)</span>
                {item.addons.length > 0 && <Badge variant="secondary" className="text-[10px]">{item.addons.length}</Badge>}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => onAddAddon(itemIdx)} className="h-7 gap-1 border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"><Plus className="h-3.5 w-3.5" />เพิ่มส่วนเสริม</Button>
            </div>
            {item.addons.length === 0 ? (
              <p className="py-2 text-center text-xs italic text-slate-400 dark:text-slate-500">ไม่มีส่วนเสริม — กด &quot;Add-on&quot; เพื่อเพิ่ม</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      <th className="w-8 pb-2" />
                      <th className="min-w-[100px] pb-2 px-1">ประเภท</th>
                      <th className="min-w-[120px] pb-2 px-1">ชื่อ</th>
                      <th className="min-w-[90px] pb-2 px-1">คิดราคา</th>
                      <th className="min-w-[80px] pb-2 pl-1">ราคา</th>
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
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>หมายเหตุรายการ</label>
            <Input value={item.notes} onChange={(e) => onUpdateItem(itemIdx, "notes", e.target.value)} placeholder="หมายเหตุเพิ่มเติมสำหรับรายการนี้..." />
          </div>

          {/* Price summary — detailed breakdown */}
          {totalQty > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/40">
              <div className="px-4 py-2.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">สรุปราคารายการ</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-t border-slate-200 text-[11px] text-slate-400 dark:border-slate-700">
                    <th className="px-4 py-1.5 text-left font-medium">รายการ</th>
                    <th className="px-2 py-1.5 text-right font-medium">ราคา/ตัว</th>
                    <th className="px-2 py-1.5 text-right font-medium">จำนวน</th>
                    <th className="px-4 py-1.5 text-right font-medium">รวม</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600 dark:text-slate-300">
                  {/* Per-product cost */}
                  {item.products.map((p, i) => {
                    const pQty = calculateTotalQuantity(p.variants);
                    const net = Math.max(0, p.baseUnitPrice - (p.discount || 0));
                    const pTotal = pQty * net;
                    if (pQty === 0) return null;
                    const label = p.productName || p.description || `สินค้า ${i + 1}`;
                    const variant = [p.variants[0]?.color, p.variants[0]?.size].filter(Boolean).join(" ");
                    return (
                      <tr key={`p-${i}`} className="border-t border-slate-100 dark:border-slate-700/50">
                        <td className="px-4 py-1.5">
                          <span className="text-slate-700 dark:text-slate-200">{label}</span>
                          {variant && <span className="ml-1 text-slate-400">({variant})</span>}
                          {(p.discount || 0) > 0 && <span className="ml-1 text-red-500">-{formatCurrency(p.discount || 0)}</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(net)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{pQty}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums font-medium">{formatCurrency(pTotal)}</td>
                      </tr>
                    );
                  })}
                  {/* Per-print cost */}
                  {item.prints.map((pr, i) => {
                    const prTotal = totalQty * pr.unitPrice;
                    if (pr.unitPrice === 0) return null;
                    const prLabel = PRINT_TYPES[pr.printType] || pr.printType;
                    const prPos = PRINT_POSITIONS[pr.position] || pr.position;
                    return (
                      <tr key={`pr-${i}`} className="border-t border-slate-100 dark:border-slate-700/50">
                        <td className="px-4 py-1.5">
                          <span className="text-purple-600 dark:text-purple-400">🎨 {prLabel}</span>
                          <span className="ml-1 text-slate-400">({prPos})</span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(pr.unitPrice)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{totalQty}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums font-medium">{formatCurrency(prTotal)}</td>
                      </tr>
                    );
                  })}
                  {/* Per-addon cost */}
                  {item.addons.map((a, i) => {
                    const aTotal = a.pricingType === "PER_PIECE" ? totalQty * a.unitPrice : a.unitPrice;
                    if (a.unitPrice === 0) return null;
                    return (
                      <tr key={`a-${i}`} className="border-t border-slate-100 dark:border-slate-700/50">
                        <td className="px-4 py-1.5">
                          <span className="text-slate-500">{a.name || `ส่วนเสริม ${i + 1}`}</span>
                          <span className="ml-1 text-[10px] text-slate-400">({a.pricingType === "PER_PIECE" ? "ต่อตัว" : "เหมา"})</span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(a.unitPrice)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{a.pricingType === "PER_PIECE" ? totalQty : "1"}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums font-medium">{formatCurrency(aTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Grand total */}
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-600">
                    <td colSpan={2} className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      รวมทั้งหมด
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                      {totalQty} ตัว
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-bold tabular-nums text-blue-700 dark:text-blue-300">
                      {formatCurrency(subtotal)}
                    </td>
                  </tr>
                  {totalQty > 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 pb-2.5 text-[11px] text-slate-400">
                        เฉลี่ยต่อตัว
                      </td>
                      <td className="px-4 pb-2.5 text-right text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                        {formatCurrency(Math.round((subtotal / totalQty) * 100) / 100)}/ตัว
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}

          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onToggleExpand} className="gap-1 text-xs">
              <Check className="h-3.5 w-3.5" />เสร็จสิ้น
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
