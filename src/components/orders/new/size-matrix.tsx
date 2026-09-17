"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { c } from "@/components/kit/kit";
import { cn } from "@/lib/utils";
import { RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
import { Plus } from "lucide-react";
import { HelpTip } from "@/components/ui/help-tip";
import type { VariantForm } from "@/types/order-form";
import { buildSizeVariants, matrixColumns, sumVariantQty } from "@/lib/size-matrix";

// ตารางกรอกหลายไซส์ในสินค้าเดียว (FLOW-REDESIGN ก้อน 4 / P1.12) — หน้าตา .szm ของต้นแบบฟอร์มออเดอร์
// สีเดียวใช้ทุกไซส์ · จำนวนต่อไซส์ · เพิ่มไซส์อื่นได้ · รวมอัตโนมัติ → คืน variants[] (qty>0)
// ช่องไซส์มาตรฐาน 6 ช่องขึ้นเสมอ (ต้นแบบโชว์เฉพาะไซส์ที่มีจำนวนเพราะเป็นข้อมูลตัวอย่าง)
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
    if (!t || columns.some((col) => col.toUpperCase() === t.toUpperCase())) {
      setNewSize("");
      return;
    }
    setExtraSizes((p) => [...p, t]);
    setNewSize("");
  };

  const total = sumVariantQty(variants.filter((v) => v.size.trim()));

  return (
    <div className={cn(!embedded && [RADIUS.inner, SUNK_PANEL, "p-3"])}>
      {title && <h4>{title}</h4>}
      <div className={c("szm")}>
        <div className={c("szcolor")}>
          <label htmlFor={`${idPrefix}-color`}>สี</label>
          <HelpTip label="สี" className="-ml-1">สีเดียวใช้กับทุกไซส์ในแถวนี้ — คนละสีให้เพิ่มสินค้าอีกรายการ</HelpTip>
          <Input
            id={`${idPrefix}-color`}
            value={color}
            onChange={(e) => {
              setColor(e.target.value);
              rebuild(null, 0, e.target.value);
            }}
            placeholder="เช่น ดำ"
            size="sm"
          />
        </div>

        <div className={c("szrow")}>
          {columns.map((size, index) => (
            <label key={size} htmlFor={`${idPrefix}-size-${index}`} className={c("szf")}>
              <span>{size}</span>
              <Input
                id={`${idPrefix}-size-${index}`}
                size="sm"
                type="number"
                min={0}
                inputMode="numeric"
                value={qtyOf(size) || ""}
                onChange={(e) => rebuild(size, parseInt(e.target.value) || 0)}
                placeholder="0"
                aria-label={`จำนวนไซส์ ${size}`}
              />
            </label>
          ))}

          {/* เพิ่มไซส์อื่น (XS/4XL/เด็ก/ตัวเลข) */}
          <label htmlFor={`${idPrefix}-new-size`} className={c("szf add")}>
            <span>เพิ่มไซส์</span>
            <Input
              id={`${idPrefix}-new-size`}
              size="sm"
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSize();
                }
              }}
              placeholder="XS/4XL"
            />
          </label>
          <button type="button" className={c("ibtn out")} onClick={addSize} aria-label="เพิ่มไซส์">
            <Plus aria-hidden="true" />
          </button>
        </div>

        <p className={c("sztot")}>
          รวม <b>{total.toLocaleString("th-TH")}</b> ตัว
        </p>
      </div>
    </div>
  );
}
