"use client";

import { Button } from "@/components/ui/button";
import { CONTROL_H } from "@/components/ui/control-size";
import { Field } from "@/components/ui/field";
import { ImageRemoveButton } from "@/components/ui/image-remove-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { DASHED, FOCUS_BUTTON, RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import {
  PRINT_POSITIONS,
  PRINT_TYPES,
  PRINT_SIZES,
  type PrintForm,
} from "@/types/order-form";
import { usePrintRow } from "./use-print-row";

// จอแคบใช้การ์ดแทนการบีบตาราง 8 คอลัมน์จนต้องเลื่อนซ้ายขวา
export function PrintCardMobile({
  print,
  printIdx,
  onUpdate,
  onRemove,
  printCatalog,
  onApplyCatalog,
}: {
  print: PrintForm;
  printIdx: number;
  onUpdate: (field: string, value: unknown) => void;
  onRemove: () => void;
  printCatalog?: Array<{
    id: string;
    name: string;
    type: string;
    defaultPrice: number;
    pricingType: string;
  }>;
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

  return (
    <div className={cn(RADIUS.inner, "space-y-3 border border-slate-200 p-3 dark:border-slate-700/60")}>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf,.ai,.psd"
          onChange={handleImageUpload}
          className="hidden"
          aria-label={`อัปโหลดไฟล์ลาย ${printIdx + 1}`}
        />
        {imageUrl ? (
          <div className="relative shrink-0">
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
              "flex h-11 w-11 shrink-0 items-center justify-center text-slate-400 transition-colors hover:border-blue-400 hover:text-blue-500"
            )}
          >
            {uploading ? <Spinner size="md" /> : <Plus />}
          </button>
        )}

        <div className="min-w-0 flex-1">
          {printCatalog && printCatalog.length > 0 ? (
            <Select
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
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`ลบจุดพิมพ์ ${printIdx + 1}`}
          onClick={onRemove}
          className="shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
        >
          <Trash2 />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="ขนาด">
          <Select
            value={print.printSize || ""}
            onChange={(event) => handleSizePreset(event.target.value)}
          >
            <option value="">ขนาด...</option>
            {Object.entries(PRINT_SIZES).map(([key, value]) => (
              <option key={key} value={key}>
                {value.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ตำแหน่ง">
          <Select
            value={print.position}
            onChange={(event) => onUpdate("position", event.target.value)}
          >
            {Object.entries(PRINT_POSITIONS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        {isCustomSize ? (
          <Field label="กว้าง × สูง (ซม.)" className="col-span-2">
            <div className="flex items-center gap-1.5">
              <Input
                aria-label={`ความกว้างลาย จุดที่ ${printIdx + 1} (ซม.)`}
                type="number"
                min={0}
                step={0.1}
                value={print.width || ""}
                onChange={(event) =>
                  onUpdate("width", parseFloat(event.target.value) || 0)
                }
                placeholder="กว้าง"
                className="w-full text-center"
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
                placeholder="สูง"
                className="w-full text-center"
              />
            </div>
          </Field>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              กว้าง × สูง (ซม.)
            </p>
            <p className={cn(CONTROL_H, "flex items-center text-sm tabular-nums text-slate-500 dark:text-slate-400")}>
              {sizePreset ? `${sizePreset.width} × ${sizePreset.height}` : "—"}
            </p>
          </div>
        )}

        {showColorCount && (
          <Field label="จำนวนสี">
            <Input
              type="number"
              min={1}
              value={print.colorCount}
              onChange={(event) =>
                onUpdate("colorCount", parseInt(event.target.value) || 1)
              }
              className="text-center"
            />
          </Field>
        )}
        <Field label="ค่าสกรีน">
          <Input
            type="number"
            min={0}
            step={0.01}
            value={print.unitPrice || ""}
            onChange={(event) =>
              onUpdate("unitPrice", parseFloat(event.target.value) || 0)
            }
            placeholder="0.00"
            className="text-right"
          />
        </Field>
      </div>
    </div>
  );
}
