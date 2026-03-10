"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Plus, Trash2, AlertCircle, Loader2, X } from "lucide-react";
import {
  PRINT_POSITIONS,
  PRINT_TYPES,
  PRINT_SIZES,
} from "@/types/order-form";
import { useState, useRef, type ReactNode } from "react";
import { uploadFile } from "@/lib/supabase";
import { labelClass } from "./order-item-card";

export function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label} {required && <span className="text-red-400">*</span>}</label>
      {children}
      {error && <p className="mt-0.5 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle className="h-3 w-3 flex-shrink-0" />{error}</p>}
    </div>
  );
}

export function PrintTableRow({
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
            <NativeSelect value="" onChange={(e) => { if (e.target.value) onApplyCatalog(e.target.value); }} className="h-8 text-xs">
              <option value="">{print.printType ? PRINT_TYPES[print.printType] || print.printType : "วิธีพิมพ์..."}</option>
              {printCatalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
          ) : (
            <NativeSelect value={print.printType} onChange={(e) => onUpdate("printType", e.target.value)} className="h-8 text-xs">
              {Object.entries(PRINT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          )}
        </td>
        {/* Size */}
        <td className="px-1 py-2 align-middle">
          <NativeSelect value={print.printSize || ""} onChange={(e) => handleSizePreset(e.target.value)} className="h-8 text-xs">
            <option value="">ขนาด...</option>
            {Object.entries(PRINT_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </NativeSelect>
        </td>
        {/* Position */}
        <td className="px-1 py-2 align-middle">
          <NativeSelect value={print.position} onChange={(e) => onUpdate("position", e.target.value)} className="h-8 text-xs">
            {Object.entries(PRINT_POSITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
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
