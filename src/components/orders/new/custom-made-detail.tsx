"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Plus, Scissors, Loader2 } from "lucide-react";
import type { OrderItemProductForm } from "@/types/order-form";
import {
  PRODUCT_TYPES,
  FABRIC_TYPES,
  COLLAR_TYPES,
  SLEEVE_TYPES,
  BODY_FITS,
} from "@/types/order-form";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { uploadFile } from "@/lib/supabase";
import { Field } from "./print-table-row";

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

export function CustomMadeDetail({
  product, updateProduct,
}: {
  product: OrderItemProductForm;
  updateProduct: (field: string, value: unknown) => void;
}) {
  const { data, isLoading: patternsLoading } = trpc.pattern.list.useQuery({ isActive: true });
  const patterns = data?.patterns;
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
            <NativeSelect
              value={product.patternId || ""}
              onChange={(e) => handlePatternSelect(e.target.value)}
              className="h-8 text-xs"
              disabled={patternsLoading}
            >
              <option value="">{patternsLoading ? "กำลังโหลด..." : "-- เลือกแพทเทิร์น --"}</option>
              {patterns?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.description ? ` — ${p.description}` : ""}
                </option>
              ))}
            </NativeSelect>
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
          <NativeSelect value={product.productType} onChange={(e) => updateProduct("productType", e.target.value)} className="h-8 text-xs">
            {Object.entries(PRODUCT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
        </Field>
        <Field label="ชนิดผ้า">
          <NativeSelect value={product.fabricType} onChange={(e) => updateProduct("fabricType", e.target.value)} className="h-8 text-xs">
            <option value="">-- เลือก --</option>
            {Object.entries(FABRIC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
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
          <NativeSelect value={product.collarType} onChange={(e) => updateProduct("collarType", e.target.value)} className="h-8 text-xs">
            <option value="">-- เลือก --</option>
            {Object.entries(COLLAR_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
        </Field>
        <Field label="แขน">
          <NativeSelect value={product.sleeveType} onChange={(e) => updateProduct("sleeveType", e.target.value)} className="h-8 text-xs">
            <option value="">-- เลือก --</option>
            {Object.entries(SLEEVE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
        </Field>
        <Field label="ทรงตัว">
          <NativeSelect value={product.bodyFit} onChange={(e) => updateProduct("bodyFit", e.target.value)} className="h-8 text-xs">
            <option value="">-- เลือก --</option>
            {Object.entries(BODY_FITS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
        </Field>
        <Field label="หมายเหตุแพทเทิร์น">
          <Input value={product.patternNote} onChange={(e) => updateProduct("patternNote", e.target.value)} placeholder="หมายเหตุ..." className="h-8 text-xs" />
        </Field>
      </div>
    </div>
  );
}
