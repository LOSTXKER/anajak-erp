import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS_BUTTON } from "./tokens";
import { CONTROL_H_SM } from "./control-size";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: LucideIcon;
}

interface SegmentedControlProps<T extends string = string>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  size?: "sm" | "md";
  semantics?: "choice" | "tabs";
  idPrefix?: string;
}

/**
 * macOS-style segmented control — มาตรฐานกลางสำหรับ tab / type-toggle / filter pill
 * ที่ก่อนหน้านี้เขียน active-state ด้วย conditional className เองกระจายหลายหน้า
 * (products itemType, customers type, settings tabs, production tabs, billing filter).
 *
 * ── ความสูงรวมของกล่องนอก ต้องเท่า control อื่น (เบสเคาะ 2026-08-01) ────────────
 * ของชิ้นนี้เป็น "กล่องซ้อนปุ่ม" ไม่ใช่ control ชิ้นเดียว → ความสูงที่คนเห็นคือ
 * ปุ่มข้างใน + ระยะขอบกล่อง + เส้นขอบ · เดิมใช้ปุ่มสูงมาตรฐาน (36px บนเดสก์ท็อป)
 * แล้วบวก p-0.5 (2+2) + border (1+1) = 42px ไปยืนข้างช่องค้นหา 36px บนแถบเดียวกัน
 * (เห็นชัดที่ /billing/wht) — สูงเกิน 6px
 *
 * แก้ 2 จุดให้บวกแล้วลงตัว 36px พอดี:
 *   1. ปุ่มข้างในใช้ CONTROL_H_SM = 32px บนเดสก์ท็อป (44px บนมือถือ = เป้านิ้ว)
 *   2. เส้นขอบเปลี่ยนจาก border → ring-1 ring-inset ซึ่งวาดด้วย box-shadow
 *      "ข้างใน" กล่อง จึงไม่กินความสูง และไม่ล้ำออกนอกกรอบให้ดูสูงกว่าเพื่อนข้างๆ
 *
 *   เดสก์ท็อป: 32 + 2 + 2 = 36px  (เท่าช่องกรอก/ช่องเลือก/ปุ่มบนแถบเครื่องมือ)
 *   มือถือ:    44 + 2 + 2 = 48px  (กล่องนอกโตขึ้นได้ ขอแค่ "ปุ่ม" ยังเต็ม 44px)
 *
 * CONTROL_H_SM มีหมายเหตุห้ามใช้บนแถบเครื่องมือ — นั่นหมายถึงของที่วางบนแถบ "ตรงๆ"
 * ที่นี่มันเป็นปุ่มข้างในกล่อง ตัวที่ไปยืนบนแถบจริงคือกล่องนอกซึ่งได้ 36px แล้ว
 */
export function SegmentedControl<T extends string = string>({
  value,
  onChange,
  options,
  size = "md",
  semantics = "choice",
  idPrefix,
  className,
  ...props
}: SegmentedControlProps<T>) {
  return (
    <div
      role={semantics === "tabs" ? "tablist" : "group"}
      className={cn(
        "inline-flex gap-0.5 rounded-lg bg-slate-50 p-0.5 ring-1 ring-inset ring-slate-200 dark:bg-slate-900/80 dark:ring-slate-800/60",
        className,
      )}
      {...props}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            id={idPrefix ? `${idPrefix}-${opt.value}-tab` : undefined}
            role={semantics === "tabs" ? "tab" : undefined}
            aria-controls={semantics === "tabs" && idPrefix ? `${idPrefix}-${opt.value}-panel` : undefined}
            aria-selected={semantics === "tabs" ? active : undefined}
            aria-pressed={semantics === "choice" ? active : undefined}
            tabIndex={semantics === "tabs" ? (active ? 0 : -1) : undefined}
            onClick={() => onChange(opt.value)}
            onKeyDown={(event) => {
              if (semantics !== "tabs") return;
              const currentIndex = options.findIndex((item) => item.value === opt.value);
              let nextIndex: number | null = null;
              if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % options.length;
              if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + options.length) % options.length;
              if (event.key === "Home") nextIndex = 0;
              if (event.key === "End") nextIndex = options.length - 1;
              if (nextIndex === null) return;
              event.preventDefault();
              const next = options[nextIndex];
              onChange(next.value);
              const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                '[role="tab"]',
              );
              buttons?.[nextIndex]?.focus();
            }}
            className={cn(CONTROL_H_SM, "inline-flex touch-manipulation items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors", FOCUS_BUTTON,
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs",
              active
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
            )}
          >
            {Icon && <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
