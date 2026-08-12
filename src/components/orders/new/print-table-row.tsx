"use client";

import { Button } from "@/components/ui/button";
import { ImageRemoveButton } from "@/components/ui/image-remove-button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import {
  PRINT_POSITIONS,
  PRINT_TYPES,
  PRINT_SIZES,
  type PrintForm,
} from "@/types/order-form";
import { DASHED, FOCUS_BUTTON, RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { usePrintRow } from "./use-print-row";

export function PrintTableRow({
  print, printIdx, onUpdate, onRemove, printCatalog, onApplyCatalog,
}: {
  print: PrintForm;
  printIdx: number;
  onUpdate: (field: string, value: unknown) => void;
  onRemove: () => void;
  printCatalog?: Array<{ id: string; name: string; type: string; defaultPrice: number; pricingType: string }>;
  onApplyCatalog: (catalogId: string) => void;
}) {
  const {
    uploading,
    inputRef,
    handleSizePreset,
    handleImageUpload,
    clearImage,
    isCustomSize,
    showColorCount,
    imageUrl,
    sizePreset,
  } = usePrintRow(print, onUpdate);
  const dash = <span className="text-xs text-muted">—</span>;

  return (
    <tr>
      {/* จัดกลางให้ตรงกับหัวคอลัมน์ "ลาย" (เบสเห็นจอจริง 2026-08-04) */}
      <td className="py-2 pr-1 text-center align-middle">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf,.ai,.psd"
          onChange={handleImageUpload}
          className="hidden"
          aria-label={`อัปโหลดไฟล์ลาย ${printIdx + 1}`}
        />
        {imageUrl ? (
          <div className="relative mx-auto inline-block">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label={`เปลี่ยนไฟล์ลาย ${printIdx + 1}`}
              className={cn(RADIUS.item, FOCUS_BUTTON, "block min-h-11 min-w-11")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={`ลาย ${printIdx + 1}`}
                className={cn(RADIUS.item, "h-11 w-11 border border-slate-200 object-cover dark:border-slate-700")}
              />
            </button>
            <ImageRemoveButton
              label={`ลบไฟล์ลาย ${printIdx + 1}`}
              onClick={clearImage}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label={`เพิ่มไฟล์ลาย ${printIdx + 1}`}
            className={cn(
              DASHED,
              RADIUS.item,
              FOCUS_BUTTON,
              "mx-auto flex h-11 w-11 shrink-0 items-center justify-center text-slate-400 transition-colors hover:border-border-strong hover:text-strong dark:hover:text-strong"
            )}
          >
            {uploading ? <Spinner size="md" /> : <Plus />}
          </button>
        )}
      </td>

      <td className="px-2 py-2 align-middle">
        {printCatalog && printCatalog.length > 0 ? (
          <Select
            size="sm"
            aria-label={`เลือกวิธีพิมพ์หรือต้นแบบ จุดที่ ${printIdx + 1}`}
            value=""
            onChange={(event) => {
              if (event.target.value) onApplyCatalog(event.target.value);
            }}
          >
            <option value="">
              {print.printType
                ? PRINT_TYPES[print.printType] || print.printType
                : "วิธีพิมพ์..."}
            </option>
            {printCatalog.map((catalogItem) => (
              <option key={catalogItem.id} value={catalogItem.id}>
                {catalogItem.name}
              </option>
            ))}
          </Select>
        ) : (
          <Select
            size="sm"
            aria-label={`เลือกวิธีพิมพ์ จุดที่ ${printIdx + 1}`}
            value={print.printType}
            onChange={(event) => onUpdate("printType", event.target.value)}
          >
            {Object.entries(PRINT_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </td>

      <td className="px-2 py-2 align-middle">
        <Select
          size="sm"
          aria-label={`ขนาดลาย จุดที่ ${printIdx + 1}`}
          value={print.printSize || ""}
          onChange={(event) => handleSizePreset(event.target.value)}
        >
          <option value="">ขนาด...</option>
          {Object.entries(PRINT_SIZES).map(([key, value]) => (
            <option key={key} value={key}>
              {key === "CUSTOM" ? value.label : key}
            </option>
          ))}
        </Select>
      </td>

      <td className="px-2 py-2 align-middle">
        {isCustomSize ? (
          <div className="flex items-center gap-0.5">
            <Input
              aria-label={`ความกว้างลาย จุดที่ ${printIdx + 1} (ซม.)`}
              type="number"
              min={0}
              step={0.1}
              value={print.width || ""}
              onChange={(event) =>
                onUpdate("width", parseFloat(event.target.value) || 0)
              }
              placeholder="0"
              size="dense" className="w-full px-1 text-center"
            />
            <span className="text-xs text-slate-400">×</span>
            <Input
              aria-label={`ความสูงลาย จุดที่ ${printIdx + 1} (ซม.)`}
              type="number"
              min={0}
              step={0.1}
              value={print.height || ""}
              onChange={(event) =>
                onUpdate("height", parseFloat(event.target.value) || 0)
              }
              placeholder="0"
              size="dense" className="w-full px-1 text-center"
            />
          </div>
        ) : (
          <div className="flex h-9 items-center justify-center text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {sizePreset ? `${sizePreset.width} × ${sizePreset.height}` : dash}
          </div>
        )}
      </td>

      <td className="px-2 py-2 align-middle">
        <Select
          size="dense"
          aria-label={`ตำแหน่งลาย จุดที่ ${printIdx + 1}`}
          value={print.position}
          onChange={(event) => onUpdate("position", event.target.value)}
        >
          {Object.entries(PRINT_POSITIONS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </td>

      <td className="px-2 py-2 align-middle">
        {showColorCount ? (
          <Input
            aria-label={`จำนวนสีของลาย จุดที่ ${printIdx + 1}`}
            type="number"
            min={1}
            value={print.colorCount}
            onChange={(event) =>
              onUpdate("colorCount", parseInt(event.target.value) || 1)
            }
            size="dense" className="w-full px-1 text-center"
          />
        ) : (
          <div className="flex h-9 items-center justify-center">{dash}</div>
        )}
      </td>

      <td className="px-2 py-2 align-middle">
        <MoneyInput
          aria-label={`ค่าสกรีน จุดที่ ${printIdx + 1}`}
          value={print.unitPrice}
          onValueChange={(v) => onUpdate("unitPrice", v)}
          size="dense" className="w-full px-2"
        />
      </td>

      <td className="py-2 pl-1 align-middle">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`ลบจุดพิมพ์ ${printIdx + 1}`}
          onClick={onRemove}
          className="text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        >
          <Trash2 />
        </Button>
      </td>
    </tr>
  );
}
