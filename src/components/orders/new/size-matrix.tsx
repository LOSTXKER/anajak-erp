"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { VariantForm } from "@/types/order-form";
import { buildSizeVariants, matrixColumns, sumVariantQty } from "@/lib/size-matrix";

// ตารางกรอกหลายไซส์ในสินค้าเดียว (FLOW-REDESIGN ก้อน 4 / P1.12)
// สีเดียวใช้ทุกไซส์ · จำนวนต่อไซส์ · เพิ่มไซส์อื่นได้ · รวมอัตโนมัติ → คืน variants[] (qty>0)
export function SizeMatrix({
  variants,
  onChange,
}: {
  variants: VariantForm[];
  onChange: (variants: VariantForm[]) => void;
}) {
  const [extraSizes, setExtraSizes] = useState<string[]>([]);
  const [newSize, setNewSize] = useState("");
  // สีเป็น state ของตัวเอง — ไม่ดึงจาก variants[0] (ถ้าผูก: พิมพ์สีก่อนกรอกจำนวน → variants ว่าง → สีหาย)
  const [color, setColor] = useState(variants[0]?.color ?? "");

  const columns = matrixColumns(variants, extraSizes);
  const qtyOf = (size: string) =>
    variants.find((v) => v.size.trim().toUpperCase() === size.trim().toUpperCase())?.quantity ?? 0;

  // rebuild variants จากคอลัมน์ปัจจุบัน (เปลี่ยน 1 ช่อง) — คงไซส์อื่นไว้
  const rebuild = (overrideSize: string | null, overrideQty: number, nextColor = color) => {
    const entries = columns.map(
      (s) => [s, s === overrideSize ? overrideQty : qtyOf(s)] as [string, number]
    );
    onChange(buildSizeVariants(entries, nextColor));
  };

  const addSize = () => {
    const t = newSize.trim();
    if (!t || columns.some((c) => c.toUpperCase() === t.toUpperCase())) {
      setNewSize("");
      return;
    }
    setExtraSizes((p) => [...p, t]);
    setNewSize("");
  };

  const total = sumVariantQty(variants.filter((v) => v.size.trim()));

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="mb-2 flex items-center gap-2">
        <label htmlFor="size-matrix-color" className="text-xs font-medium text-slate-600 dark:text-slate-300">สี (ใช้ทุกไซส์)</label>
        <Input
          id="size-matrix-color"
          value={color}
          onChange={(e) => {
            setColor(e.target.value);
            rebuild(null, 0, e.target.value);
          }}
          placeholder="เช่น ดำ"
          className="h-7 w-28 text-xs"
        />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {columns.map((size) => (
          <div key={size} className="w-14">
            <label htmlFor={`size-matrix-${size}`} className="block text-center text-[11px] font-medium text-slate-500">{size}</label>
            <Input
              id={`size-matrix-${size}`}
              type="number"
              min={0}
              value={qtyOf(size) || ""}
              onChange={(e) => rebuild(size, parseInt(e.target.value) || 0)}
              placeholder="0"
              className="h-8 px-1 text-center text-xs"
            />
          </div>
        ))}

        {/* เพิ่มไซส์อื่น (XS/4XL/เด็ก/ตัวเลข) */}
        <div className="flex items-end gap-1">
          <div className="w-16">
            <label htmlFor="size-matrix-new-size" className="block text-center text-[11px] text-slate-400">เพิ่มไซส์</label>
            <Input
              id="size-matrix-new-size"
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSize();
                }
              }}
              placeholder="XS/4XL"
              className="h-8 px-1 text-center text-xs"
            />
          </div>
          <Button type="button" variant="outline" size="icon" onClick={addSize} className="h-8 w-8">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        รวม <span className="font-semibold text-slate-700 dark:text-slate-200">{total}</span> ตัว
      </p>
    </div>
  );
}
