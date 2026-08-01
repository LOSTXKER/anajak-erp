"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTROL_H, CONTROL_H_SM, CONTROL_MIN_H } from "./control-size";
import {
  FIELD_SURFACE,
  FOCUS_FIELD,
  MENU_ITEM,
  OVERLAY_PANEL,
  RADIUS,
  controlShapeClass,
  type ControlShape,
} from "./tokens";

/* ============================================================
   ช่องเลือกของทั้งระบบ — มีตัวเดียว (เบสสั่ง 2026-08-01 "ตรวจดีๆ ว่ามีอะไร
   ไม่เป็นมาตรฐานบ้าง")

   เดิมมีสองตัวทำงานเดียวกันทั้งคู่ห่อ Radix Select เหมือนกัน แต่หน้าตาคนละแบบ:
     · ตัวนี้ (เดิมชื่อ native-select) 20 ไฟล์ — เมนูมุม 12px ไม่มีขอบ
     · อีกตัว (เดิมชื่อ select แบบประกอบเอง) 12 ไฟล์ — เมนูมุม 8px มีขอบ+พื้นซ้ำ
       เครื่องหมายถูกอยู่คนละฝั่ง วงแหวนโฟกัสคนละสูตร พื้นโหมดมืดคนละเฉด
   หน้า /customers เรียกทั้งสองตัว → ช่องเลือกสองช่องบนหน้าเดียวกันเปิดแล้วไม่เหมือนกัน

   ต้นเหตุคือไม่มีคำตอบว่า "จะใช้ตัวไหน" — คนเขียนหน้าใหม่จึงหยิบตัวที่เห็นก่อน
   แก้โดยยุบเหลือไฟล์เดียวชื่อเดียว ไม่ใช่ไล่จูนสองตัวให้เหมือนกัน (เดี๋ยวก็เพี้ยนอีก)

   เดิมทีเป็น <select> ของเบราว์เซอร์ พอกดแล้วเมนูที่กางออกมาเป็นของระบบปฏิบัติการ:
   ฟอนต์ไม่ใช่ Prompt · สีที่เลือกเป็นสีระบบ · หน้าตาต่างกันระหว่าง Mac/Windows/มือถือ
   แก้อะไรไม่ได้เลย (เบสสั่ง 2026-07-31 "ใช้ของเราเอง") — จึงคง API แบบ <option> ไว้
   เพื่อให้จุดที่ใช้อยู่เปลี่ยนพร้อมกันโดยไม่ต้องรื้อทีละไฟล์

   ⚠️ ข้อต่างที่ต้องรู้: prop `required` ที่นี่ "ไม่บล็อก" การกดส่งฟอร์มเหมือน
   <select required> ของเบราว์เซอร์ — Radix ซ่อน <select> ไว้ข้างหลังเพื่อส่งค่า
   แต่เรามีตัวเลือกค่าว่างเป็น "__empty__" (Radix ไม่ยอมรับ "") ทำให้เบราว์เซอร์
   มองว่า "มีค่าแล้ว" เสมอ valueMissing จึงไม่มีวันเกิด
   → ฟอร์มที่เคยพึ่ง required ต้องตรวจเองก่อน submit + รัดที่ zod ฝั่ง server ด้วย
   (เจอตอน audit ก่อน merge: /quotations/new กดสร้างโดยไม่เลือกลูกค้าได้)
   ============================================================ */

/** Radix ไม่ยอมให้ value เป็นสตริงว่าง แต่ตัวเลือกแบบ "ทุกสถานะ" ในระบบนี้ใช้ ""
 *  จึงสลับเป็นค่าแทนภายใน แล้วแปลงกลับตอนส่งออก — ข้างนอกไม่รู้เรื่องนี้ */
const EMPTY = "__empty__";
const toInner = (v: string) => (v === "" ? EMPTY : v);
const toOuter = (v: string) => (v === EMPTY ? "" : v);

type OptionItem = { value: string; label: React.ReactNode; disabled?: boolean };

/** ดึง <option> ออกจาก children (รองรับ .map, fragment, เงื่อนไข && / ternary) */
function collectOptions(children: React.ReactNode, out: OptionItem[] = []) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      collectOptions(
        (child.props as { children?: React.ReactNode }).children,
        out,
      );
      return;
    }
    if (child.type === "option") {
      const p = child.props as {
        value?: string | number;
        children?: React.ReactNode;
        disabled?: boolean;
      };
      out.push({
        value: String(p.value ?? ""),
        label: p.children,
        disabled: p.disabled,
      });
    }
  });
  return out;
}

/** ขนาดของช่องเลือก — sm ใช้เฉพาะในแถวตารางที่ต้องอัดหลายช่องต่อแถว
 *  ให้ 44px บนมือถือ (เป้านิ้วขั้นต่ำ) · 32px บนเดสก์ท็อป — ดู control-size.ts */
type SelectSize = "default" | "sm";

export type SelectProps = Omit<
  React.ComponentProps<"select">,
  "onChange" | "value" | "size"
> & {
  shape?: ControlShape;
  size?: SelectSize;
  /** บอกโปรแกรมอ่านหน้าจอว่าจำเป็น — ไม่บล็อกการส่งฟอร์ม ต้องตรวจเองก่อน submit */
  required?: boolean;
  value?: string;
  onChange?: (event: { target: { value: string } }) => void;
  /** ข้อความตอนยังไม่ได้เลือก — ไม่ใส่ก็ขึ้น "เลือก…" */
  placeholder?: string;
};

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      className,
      children,
      shape,
      size = "default",
      value,
      onChange,
      disabled,
      required,
      name,
      id,
      placeholder,
      "aria-label": ariaLabel,
      ...rest
    },
    ref,
  ) => {
    const options = React.useMemo(() => collectOptions(children), [children]);
    const current = options.find((o) => o.value === (value ?? ""));

    return (
      <SelectPrimitive.Root
        value={toInner(value ?? "")}
        onValueChange={(v) => onChange?.({ target: { value: toOuter(v) } })}
        disabled={disabled}
        required={required}
        name={name}
      >
        <SelectPrimitive.Trigger
          ref={ref}
          id={id}
          aria-label={ariaLabel}
          // role="combobox" รองรับ aria-required (ต่าง <button> ธรรมดา) — บอกโปรแกรมอ่านหน้าจอได้
          // แต่ "ไม่บล็อก" การส่งฟอร์มเหมือน <select required> เดิม ดูคำอธิบายที่ prop required
          aria-required={required || undefined}
          className={cn(
            controlShapeClass(shape),
            FIELD_SURFACE,
            FOCUS_FIELD,
            "flex w-full items-center justify-between gap-2 px-3 py-1 text-base transition-colors sm:text-sm disabled:cursor-not-allowed disabled:opacity-50",
            // หลังก้อนพื้นฐานเสมอ — twMerge ตัดสินจาก "ตัวหลังชนะ" (ดูคำอธิบายเดียวกันใน input.tsx)
            size === "sm" ? cn(CONTROL_H_SM, "text-xs sm:text-xs") : CONTROL_H,
            className,
          )}
          {...(rest as React.ComponentPropsWithoutRef<
            typeof SelectPrimitive.Trigger
          >)}
        >
          <span className="truncate text-left">
            {current?.label ?? (
              <span className="text-slate-400 dark:text-slate-500">
                {placeholder ?? "เลือก…"}
              </span>
            )}
          </span>
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            className={cn(
              OVERLAY_PANEL,
              "z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden p-2 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 motion-reduce:animate-none",
            )}
          >
            <SelectPrimitive.Viewport>
              {options.map((o) => (
                <SelectPrimitive.Item
                  key={o.value || EMPTY}
                  value={toInner(o.value)}
                  disabled={o.disabled}
                  className={cn(CONTROL_MIN_H, MENU_ITEM, RADIUS.item)}
                >
                  <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-4 w-4 shrink-0" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    );
  },
);
Select.displayName = "Select";

export { Select };
