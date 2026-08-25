"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { VariantForm } from "@/types/order-form";
import { buildSizeVariants, matrixColumns, sumVariantQty } from "@/lib/size-matrix";

// ตารางกรอกหลายไซส์ในสินค้าเดียว (FLOW-REDESIGN ก้อน 4 / P1.12)
// สีเดียวใช้ทุกไซส์ · จำนวนต่อไซส์ · เพิ่มไซส์อื่นได้ · รวมอัตโนมัติ → คืน variants[] (qty>0)
export function SizeMatrix({
  idPrefix,
  variants,
  onChange,
  embedded = false,
  title,
}: {
  idPrefix: string;
  variants: VariantForm[];
  onChange: (variants: VariantForm[]) => void;
  embedded?: boolean;
  title?: string;
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
    <div className={cn(!embedded && [RADIUS.inner, SUNK_PANEL, "p-3"])}>
      {title && (
        <h4 className="mb-3 text-sm font-semibold text-strong">{title}</h4>
      )}
      <div className="mb-2 flex items-center gap-2">
        <label htmlFor={`${idPrefix}-color`} className="text-xs font-medium text-secondary">สี (ใช้ทุกไซส์)</label>
        <Input
          id={`${idPrefix}-color`}
          value={color}
          onChange={(e) => {
            setColor(e.target.value);
            rebuild(null, 0, e.target.value);
          }}
          placeholder="เช่น ดำ"
          size="sm"
          // h-7 เดิมเป็นค่าหลอก (min-h-11 ชนะอยู่แล้ว ไม่เคยสูง 28px จริง) และ text-xs
          // เปล่าทำให้ iOS ซูมจอเมื่อแตะ — ใช้ size="sm" ที่คุมทั้งสองอย่างให้แล้ว
          className="w-28"
        />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {columns.map((size, index) => {
          const sizeId = `${idPrefix}-size-${index}`;
          return (
            <div key={size} className="w-14">
              <label htmlFor={sizeId} className="block text-center text-xs font-medium text-muted">{size}</label>
              <Input size="sm"
                id={sizeId}
                type="number"
                min={0}
                value={qtyOf(size) || ""}
                onChange={(e) => rebuild(size, parseInt(e.target.value) || 0)}
                placeholder="0"
                className="px-1 text-center"
              />
            </div>
          );
        })}

        {/* เพิ่มไซส์อื่น (XS/4XL/เด็ก/ตัวเลข) */}
        <div className="flex items-end gap-1.5">
          <div className="w-16">
            <label htmlFor={`${idPrefix}-new-size`} className="block text-center text-xs text-muted">เพิ่มไซส์</label>
            <Input size="sm"
              id={`${idPrefix}-new-size`}
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSize();
                }
              }}
              placeholder="XS/4XL"
              className="px-1 text-center"
            />
          </div>
          <Button type="button" variant="outline" size="icon-sm" onClick={addSize} aria-label="เพิ่มไซส์">
            <Plus />
          </Button>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted">
        รวม <span className="font-semibold text-slate-700 dark:text-slate-200">{total}</span> ตัว
      </p>
    </div>
  );
}
