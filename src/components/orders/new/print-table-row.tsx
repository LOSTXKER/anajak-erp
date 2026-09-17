"use client";

import { ImageRemoveButton } from "@/components/ui/image-remove-button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { c } from "@/components/kit/kit";
import { Plus, Trash2 } from "lucide-react";
import {
  PRINT_POSITIONS,
  PRINT_TYPES,
  PRINT_SIZES,
  type PrintForm,
} from "@/types/order-form";
import { Spinner } from "@/components/ui/spinner";
import { usePrintRow } from "./use-print-row";

// แถวลาย 1 จุด — 8 คอลัมน์ตามต้นแบบ: ไฟล์ · วิธีพิมพ์ · ขนาด · กว้าง×สูง · ตำแหน่ง · จำนวนสี · ค่าสกรีน/ตัว · ลบ
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
  const dash = <span className={c("dsh")}>—</span>;

  return (
    <tr>
      <td className={c("ctr")}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf,.ai,.psd"
          onChange={handleImageUpload}
          className="hidden"
          aria-label={`อัปโหลดไฟล์ลาย ${printIdx + 1}`}
        />
        {imageUrl ? (
          <div className="relative mx-auto w-fit">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label={`เปลี่ยนไฟล์ลาย ${printIdx + 1}`}
              className={c("pth")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt={`ลาย ${printIdx + 1}`} />
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
            className={c("pth none")}
          >
            {uploading ? <Spinner size="md" /> : <Plus aria-hidden="true" />}
          </button>
        )}
      </td>

      <td>
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

      <td>
        <Select
          size="sm"
          aria-label={`ขนาดลาย จุดที่ ${printIdx + 1}`}
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
      </td>

      {/* ขนาดมาตรฐานล็อกกว้าง×สูงตามกระดาษ — พิมพ์ตัวเลขเองได้เฉพาะ "กำหนดเอง"/ยังไม่เลือก */}
      <td>
        {isCustomSize ? (
          <span className={c("wh")}>
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
              size="dense"
              className="tabular-nums"
            />
            <i aria-hidden="true">×</i>
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
              size="dense"
              className="tabular-nums"
            />
          </span>
        ) : (
          <span className={c("wh ro")}>
            {sizePreset ? (
              <>
                {sizePreset.width}
                <i>×</i>
                {sizePreset.height}
              </>
            ) : dash}
          </span>
        )}
      </td>

      <td>
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

      {/* จำนวนสีมีผลเฉพาะ Silk Screen/Heat Transfer (usePrintRow) — วิธีอื่นขึ้นขีด */}
      <td className={c("ctr")}>
        {showColorCount ? (
          <Input
            aria-label={`จำนวนสีของลาย จุดที่ ${printIdx + 1}`}
            type="number"
            min={1}
            value={print.colorCount}
            onChange={(event) =>
              onUpdate("colorCount", parseInt(event.target.value) || 1)
            }
            size="dense"
            className="px-1 text-center tabular-nums"
          />
        ) : dash}
      </td>

      <td className={c("num")}>
        <MoneyInput
          currency
          aria-label={`ค่าสกรีนต่อตัว จุดที่ ${printIdx + 1}`}
          value={print.unitPrice}
          onValueChange={(v) => onUpdate("unitPrice", v)}
          size="dense"
        />
      </td>

      <td className={c("act")}>
        <button
          type="button"
          className={c("ibtn")}
          aria-label={`ลบลาย ${printIdx + 1}`}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}
