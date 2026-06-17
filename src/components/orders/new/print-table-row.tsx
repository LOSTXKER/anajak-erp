"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Plus, Trash2, AlertCircle, Loader2, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRINT_POSITIONS,
  PRINT_TYPES,
  PRINT_SIZES,
} from "@/types/order-form";
import { useState, useRef, type ReactNode } from "react";
import { uploadFile } from "@/lib/supabase";
import { safeFileExt } from "@/lib/file-urls";
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
  const [showMore, setShowMore] = useState(false);
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
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeFileExt(file.name)}`;
      const url = await uploadFile("designs", `orders/prints/${uniqueName}`, file);
      onUpdate("designImageUrl", url);
      // identity ของลายในคลัง = รูป — เปลี่ยนรูปแล้วลิงก์คลังเดิมต้องหลุด
      // (server กรองซ้ำอีกชั้น แต่ล้างที่ต้นทางให้ state ตรงความจริง)
      onUpdate("artworkId", undefined);
    } catch {
      onUpdate("designImagePreview", undefined);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // สรุปของรอง (โชว์เป็น badge บนปุ่ม "เพิ่มเติม" เพื่อรู้ค่าโดยไม่ต้องกาง)
  const positionLabel = PRINT_POSITIONS[print.position] || print.position;
  const sizeLabel = print.printSize ? (PRINT_SIZES[print.printSize]?.label ?? print.printSize) : null;

  return (
    <>
      {/* แถวหลัก: รูป · วิธีพิมพ์ · ค่าสกรีน · ลบ */}
      <tr className="group border-b border-slate-100 last:border-0 dark:border-slate-800">
        {/* Image */}
        <td className="py-2.5 pr-2 align-middle">
          <input ref={inputRef} type="file" accept="image/*,.pdf,.ai,.psd" onChange={handleImageUpload} className="hidden" />
          {imageUrl ? (
            <div className="group/img relative inline-block">
              <img src={imageUrl} alt={`ลาย ${printIdx + 1}`} className="h-10 w-10 cursor-pointer rounded-lg border border-slate-200 object-cover dark:border-slate-700" onClick={() => inputRef.current?.click()} />
              <Button type="button" variant="destructive" size="icon" onClick={() => { onUpdate("designImageUrl", undefined); onUpdate("designImagePreview", undefined); onUpdate("artworkId", undefined); }} className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full p-0.5 opacity-0 shadow-sm transition-opacity group-hover/img:opacity-100"><X className="h-3 w-3" /></Button>
            </div>
          ) : (
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-blue-400 hover:text-blue-500 dark:border-slate-600">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </button>
          )}
        </td>
        {/* Print type (+ catalog) */}
        <td className="px-1 py-2.5 align-middle">
          {printCatalog && printCatalog.length > 0 ? (
            <NativeSelect value="" onChange={(e) => { if (e.target.value) onApplyCatalog(e.target.value); }}>
              <option value="">{print.printType ? PRINT_TYPES[print.printType] || print.printType : "วิธีพิมพ์..."}</option>
              {printCatalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
          ) : (
            <NativeSelect value={print.printType} onChange={(e) => onUpdate("printType", e.target.value)}>
              {Object.entries(PRINT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          )}
        </td>
        {/* Price (ค่าสกรีน) */}
        <td className="px-1 py-2.5 align-middle">
          <Input type="number" min={0} step={0.01} value={print.unitPrice || ""} onChange={(e) => onUpdate("unitPrice", parseFloat(e.target.value) || 0)} placeholder="0.00" className="w-full text-right" />
        </td>
        {/* Delete */}
        <td className="py-2.5 pl-1 align-middle">
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><Trash2 className="h-4 w-4" /></Button>
        </td>
      </tr>

      {/* แถว toggle "เพิ่มเติม" — ของรอง (ขนาด/ตำแหน่ง/สี/custom) ซ่อนไว้ + badge สรุปค่าที่ตั้งไว้ */}
      <tr className="border-b border-slate-100 last:border-0 dark:border-slate-800">
        <td />
        <td colSpan={3} className="pb-2 pl-1">
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showMore && "rotate-180")} />
            {showMore ? (
              "ซ่อนรายละเอียดลาย"
            ) : (
              <span className="flex flex-wrap items-center gap-1">
                <span>ตำแหน่ง/ขนาด</span>
                <Badge variant="outline" size="sm">{positionLabel}</Badge>
                {sizeLabel && <Badge variant="outline" size="sm">{sizeLabel}</Badge>}
                {showColorCount && <Badge variant="outline" size="sm">{print.colorCount} สี</Badge>}
              </span>
            )}
          </button>
          {showMore && (
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="ขนาด">
                <NativeSelect value={print.printSize || ""} onChange={(e) => handleSizePreset(e.target.value)}>
                  <option value="">ขนาด...</option>
                  {Object.entries(PRINT_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="ตำแหน่ง">
                <NativeSelect value={print.position} onChange={(e) => onUpdate("position", e.target.value)}>
                  {Object.entries(PRINT_POSITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
              </Field>
              {showColorCount && (
                <Field label="จำนวนสี">
                  <Input type="number" min={1} value={print.colorCount} onChange={(e) => onUpdate("colorCount", parseInt(e.target.value) || 1)} className="text-center" />
                </Field>
              )}
              {isCustomSize && (
                <Field label="ขนาดเอง (ซม.)">
                  <div className="flex items-center gap-1.5">
                    <Input type="number" min={0} step={0.1} value={print.width || ""} onChange={(e) => onUpdate("width", parseFloat(e.target.value) || 0)} placeholder="กว้าง" className="w-full text-center" />
                    <span className="text-xs text-slate-400">x</span>
                    <Input type="number" min={0} step={0.1} value={print.height || ""} onChange={(e) => onUpdate("height", parseFloat(e.target.value) || 0)} placeholder="สูง" className="w-full text-center" />
                  </div>
                </Field>
              )}
            </div>
          )}
        </td>
      </tr>
    </>
  );
}
