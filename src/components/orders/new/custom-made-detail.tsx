"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import { safeFileExt } from "@/lib/file-urls";
import { Field } from "@/components/ui/field";
import { DASHED_INTERACTIVE, RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { cn } from "@/lib/utils";

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
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) return;
    setUploading(true);
    setError(null);
    try {
      let thumbnailUrl: string | undefined;
      if (file) {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeFileExt(file.name)}`;
        thumbnailUrl = await uploadFile("designs", `patterns/${uniqueName}`, file);
      }
      await createMutation.mutateAsync({ name: name.trim(), thumbnailUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกแพทเทิร์นไม่สำเร็จ");
    }
    setUploading(false);
  };

  return (
    <div className={cn("mt-2 p-3", RADIUS.item)}>
      <span className="mb-2 block text-xs font-medium text-secondary">สร้างแพทเทิร์นใหม่</span>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Input size="sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อแพทเทิร์น เช่น คอกลมแขนสั้น"
          />
          {/* เป้านิ้ว ≥44px บนจอเล็ก — เดิม py-1 ได้ราว 26px กดพลาดตลอดบนมือถือ */}
          <label className={cn(DASHED_INTERACTIVE, RADIUS.item, CONTROL_MIN_H, "flex w-fit cursor-pointer items-center gap-1.5 px-3 py-1 text-xs text-muted transition-colors hover:text-strong")}>
            <Plus className="h-3 w-3" />
            {file ? file.name : "แนบรูป/ไฟล์ (ไม่บังคับ)"}
            <input type="file" accept="image/*,.pdf,.ai,.psd" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
          </label>
        </div>
        <div className="flex gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={uploading}>ยกเลิก</Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={!name.trim() || uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : null}
            บันทึก
          </Button>
        </div>
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

export function CustomMadeDetail({
  product, updateProduct,
}: {
  product: OrderItemProductForm;
  updateProduct: (field: string, value: unknown) => void;
}) {
  const patternsQuery = trpc.pattern.list.useQuery({ isActive: true });
  const { isLoading: patternsLoading, isError: patternsError } = patternsQuery;
  const patterns = patternsQuery.data?.patterns;
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
    /* กล่องย่อยในการ์ด (พื้นจม) ไม่ใช่ <Alert variant="warning"> —
       ① สีเหลืองในระบบแปลว่า "ต้องระวัง" แต่นี่คือช่องกรอกสเปคปกติ 9 ช่อง
       ② <Alert> ตั้ง role="alert" = พื้นที่ประกาศสด ที่ ui/tokens.ts เขียนกติกาไว้ว่า
          "ของที่กดได้/โฟกัสได้ไม่ควรอยู่ในนั้น" — ทั้งกล่องนี้เป็นช่องกรอกล้วน
       (เบสเคาะจาก mockup 2026-08-03) */
    <div className={cn(SUNK_PANEL, "p-3", RADIUS.inner)}>
      {/* Pattern section */}
      <div className="mb-3">
        <div className="mb-2 flex items-center gap-2">
          <Scissors className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
          <span className="text-xs font-semibold text-secondary">สเปคตัดเย็บ</span>
          {!showQuickAdd && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowQuickAdd(true)}
              className="ml-auto gap-1.5 text-xs text-muted"
            >
              <Plus className="h-3 w-3" />สร้างแพทเทิร์นใหม่
            </Button>
          )}
        </div>

        {showQuickAdd ? (
          <QuickAddPattern
            onCreated={handleQuickAddCreated}
            onCancel={() => setShowQuickAdd(false)}
          />
        ) : (
          <div>
            <Select size="sm"
              value={product.patternId || ""}
              onChange={(e) => handlePatternSelect(e.target.value)}
              disabled={patternsLoading || patternsError}
            >
              <option value="">{patternsLoading ? "กำลังโหลด..." : "เลือกแพทเทิร์น"}</option>
              {patterns?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.description ? ` — ${p.description}` : ""}
                </option>
              ))}
            </Select>
            {/* query พัง ≠ ไม่มีแพทเทิร์น — เดิม select ว่างเฉยๆ ผู้ใช้เข้าใจว่ายังไม่เคยสร้าง */}
            {patternsError && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                โหลดแพทเทิร์นไม่สำเร็จ{" "}
                <button type="button" className="underline" onClick={() => void patternsQuery.refetch()}>
                  ลองใหม่
                </button>
              </p>
            )}
            {selectedPattern && (
              <div className={cn("mt-2 flex items-start gap-3 bg-surface p-2", RADIUS.item)}>
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
                    <span className="block text-muted">{selectedPattern.description}</span>
                  )}
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
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
          <Select size="sm" value={product.productType} onChange={(e) => updateProduct("productType", e.target.value)}>
            {Object.entries(PRODUCT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="ชนิดผ้า">
          <Select size="sm" value={product.fabricType} onChange={(e) => updateProduct("fabricType", e.target.value)}>
            <option value="">เลือก</option>
            {Object.entries(FABRIC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="ส่วนผสมผ้า">
          <Input size="sm" value={product.material} onChange={(e) => updateProduct("material", e.target.value)} placeholder="เช่น Cotton 60% Poly 40%" />
        </Field>
        <Field label="น้ำหนักผ้า">
          <Input size="sm" value={product.fabricWeight} onChange={(e) => updateProduct("fabricWeight", e.target.value)} placeholder="160gsm" />
        </Field>
        <Field label="สีผ้า">
          <Input size="sm" value={product.fabricColor} onChange={(e) => updateProduct("fabricColor", e.target.value)} placeholder="ขาว, ดำ" />
        </Field>
        <Field label="ทรงคอ">
          <Select size="sm" value={product.collarType} onChange={(e) => updateProduct("collarType", e.target.value)}>
            <option value="">เลือก</option>
            {Object.entries(COLLAR_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="แขน">
          <Select size="sm" value={product.sleeveType} onChange={(e) => updateProduct("sleeveType", e.target.value)}>
            <option value="">เลือก</option>
            {Object.entries(SLEEVE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="ทรงตัว">
          <Select size="sm" value={product.bodyFit} onChange={(e) => updateProduct("bodyFit", e.target.value)}>
            <option value="">เลือก</option>
            {Object.entries(BODY_FITS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="หมายเหตุแพทเทิร์น">
          <Input size="sm" value={product.patternNote} onChange={(e) => updateProduct("patternNote", e.target.value)} placeholder="หมายเหตุ..." />
        </Field>
      </div>
    </div>
  );
}
