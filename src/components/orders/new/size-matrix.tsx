"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Grid3X3, List } from "lucide-react";
import type { VariantForm } from "@/types/order-form";

interface SizeMatrixProps {
  variants: VariantForm[];
  onChange: (variants: VariantForm[]) => void;
  listOnly?: boolean;
}

const COMMON_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"];

export function SizeMatrix({ variants, onChange, listOnly }: SizeMatrixProps) {
  const [mode, setMode] = useState<"matrix" | "list">(() => {
    if (listOnly) return "list";
    const colors = new Set(variants.map((v) => v.color));
    const sizes = new Set(variants.map((v) => v.size));
    return colors.size > 1 && sizes.size > 1 ? "matrix" : "list";
  });

  if (listOnly || mode === "list") {
    return (
      <div className="space-y-2">
        {!listOnly && (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setMode("matrix")}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Grid3X3 className="h-3 w-3" />
              แบบตาราง
            </button>
          </div>
        )}
        <ListView variants={variants} onChange={onChange} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setMode("list")}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <List className="h-3 w-3" />
          แบบรายการ
        </button>
      </div>
      <MatrixView variants={variants} onChange={onChange} />
    </div>
  );
}

function ListView({
  variants,
  onChange,
}: {
  variants: VariantForm[];
  onChange: (v: VariantForm[]) => void;
}) {
  const labelClass = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

  const update = (idx: number, field: keyof VariantForm, value: string | number) => {
    const copy = [...variants];
    copy[idx] = { ...copy[idx], [field]: value };
    onChange(copy);
  };

  const add = () => onChange([...variants, { size: "", color: "", quantity: 1 }]);

  const remove = (idx: number) => onChange(variants.filter((_, i) => i !== idx));

  return (
    <div className="space-y-1.5">
      {variants.map((v, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_1fr_100px_32px] items-end gap-2">
          <div>
            {idx === 0 && <label className={labelClass}>ไซส์ *</label>}
            <Input
              value={v.size}
              onChange={(e) => update(idx, "size", e.target.value)}
              placeholder="S, M, L..."
              required
            />
          </div>
          <div>
            {idx === 0 && <label className={labelClass}>สี</label>}
            <Input
              value={v.color}
              onChange={(e) => update(idx, "color", e.target.value)}
              placeholder="ขาว, ดำ..."
            />
          </div>
          <div>
            {idx === 0 && <label className={labelClass}>จำนวน *</label>}
            <Input
              type="number"
              min={1}
              value={v.quantity}
              onChange={(e) => update(idx, "quantity", parseInt(e.target.value) || 1)}
              required
            />
          </div>
          <div>
            {idx === 0 && <span className="mb-1 block text-xs">&nbsp;</span>}
            {variants.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-red-400 hover:text-red-600"
                onClick={() => remove(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={add}
        className="h-7 px-2 text-xs"
      >
        <Plus className="mr-1 h-3 w-3" />
        เพิ่มแถว
      </Button>
    </div>
  );
}

function MatrixView({
  variants,
  onChange,
}: {
  variants: VariantForm[];
  onChange: (v: VariantForm[]) => void;
}) {
  const { sizes, colors, matrix } = useMemo(() => {
    const sizeSet = new Set<string>();
    const colorSet = new Set<string>();
    const m = new Map<string, number>();
    for (const v of variants) {
      if (v.size) sizeSet.add(v.size);
      colorSet.add(v.color || "");
      m.set(`${v.color || ""}|${v.size}`, v.quantity);
    }
    if (sizeSet.size === 0) sizeSet.add("M");
    if (colorSet.size === 0) colorSet.add("");
    return {
      sizes: Array.from(sizeSet),
      colors: Array.from(colorSet),
      matrix: m,
    };
  }, [variants]);

  const [newSize, setNewSize] = useState("");
  const [newColor, setNewColor] = useState("");

  const rebuild = useCallback(
    (
      nextSizes: string[],
      nextColors: string[],
      nextMatrix: Map<string, number>,
    ) => {
      const result: VariantForm[] = [];
      for (const color of nextColors) {
        for (const size of nextSizes) {
          const qty = nextMatrix.get(`${color}|${size}`) ?? 0;
          if (qty > 0) {
            result.push({ size, color, quantity: qty });
          }
        }
      }
      if (result.length === 0) {
        result.push({ size: nextSizes[0] || "", color: nextColors[0] || "", quantity: 1 });
      }
      onChange(result);
    },
    [onChange],
  );

  const updateCell = (color: string, size: string, qty: number) => {
    const next = new Map(matrix);
    next.set(`${color}|${size}`, qty);
    rebuild(sizes, colors, next);
  };

  const addSize = (s: string) => {
    if (!s.trim() || sizes.includes(s.trim())) return;
    const nextSizes = [...sizes, s.trim()];
    rebuild(nextSizes, colors, matrix);
    setNewSize("");
  };

  const addColor = (c: string) => {
    const trimmed = c.trim();
    if (colors.includes(trimmed)) return;
    const nextColors = [...colors, trimmed];
    rebuild(sizes, nextColors, matrix);
    setNewColor("");
  };

  const removeSize = (s: string) => {
    if (sizes.length <= 1) return;
    const nextSizes = sizes.filter((x) => x !== s);
    const next = new Map(matrix);
    for (const color of colors) next.delete(`${color}|${s}`);
    rebuild(nextSizes, colors, next);
  };

  const removeColor = (c: string) => {
    if (colors.length <= 1) return;
    const nextColors = colors.filter((x) => x !== c);
    const next = new Map(matrix);
    for (const size of sizes) next.delete(`${c}|${size}`);
    rebuild(sizes, nextColors, next);
  };

  const totalQty = Array.from(matrix.values()).reduce((s, q) => s + q, 0);

  const unusedSizes = COMMON_SIZES.filter((s) => !sizes.includes(s));

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">
                สี \ ไซส์
              </th>
              {sizes.map((s) => (
                <th key={s} className="group relative px-2 py-2 text-center font-medium text-slate-700 dark:text-slate-200">
                  {s}
                  {sizes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSize(s)}
                      className="absolute -right-0.5 -top-0.5 hidden rounded-full bg-red-500 p-0.5 text-white group-hover:block"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  )}
                </th>
              ))}
              <th className="px-2 py-2 text-center font-medium text-slate-400">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSize(newSize);
                      }
                    }}
                    placeholder="+ ไซส์"
                    className="h-6 w-14 rounded border border-dashed border-slate-300 bg-transparent px-1 text-center text-xs placeholder:text-slate-400 focus:border-blue-400 focus:outline-none dark:border-slate-600 dark:placeholder:text-slate-500"
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {colors.map((color) => (
              <tr key={color} className="group border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                <td className="relative px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200">
                  {color || <span className="italic text-slate-400">ไม่ระบุสี</span>}
                  {colors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeColor(color)}
                      className="absolute left-0.5 top-1/2 hidden -translate-y-1/2 rounded-full bg-red-500 p-0.5 text-white group-hover:block"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  )}
                </td>
                {sizes.map((size) => (
                  <td key={size} className="px-1 py-1">
                    <input
                      type="number"
                      min={0}
                      value={matrix.get(`${color}|${size}`) ?? 0}
                      onChange={(e) => updateCell(color, size, parseInt(e.target.value) || 0)}
                      className="h-8 w-full rounded border border-slate-200 bg-white px-1 text-center text-xs tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </td>
                ))}
                <td />
              </tr>
            ))}
            <tr>
              <td className="px-3 py-1.5">
                <input
                  type="text"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addColor(newColor);
                    }
                  }}
                  placeholder="+ เพิ่มสี"
                  className="h-6 w-20 rounded border border-dashed border-slate-300 bg-transparent px-2 text-xs placeholder:text-slate-400 focus:border-blue-400 focus:outline-none dark:border-slate-600 dark:placeholder:text-slate-500"
                />
              </td>
              {sizes.map((s) => (
                <td key={s} />
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Quick-add common sizes */}
      {unusedSizes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-slate-400">เพิ่มไว:</span>
          {unusedSizes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addSize(s)}
              className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-blue-500 dark:hover:text-blue-400"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 text-xs">
        <span className="text-slate-500 dark:text-slate-400">รวม:</span>
        <span className="font-bold text-blue-700 dark:text-blue-300">{totalQty} ชิ้น</span>
      </div>
    </div>
  );
}
