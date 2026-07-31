"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** ทรงของ control — pill ใช้ในแถบเครื่องมือให้เข้าชุดกับปุ่ม (เบสสั่ง 2026-07-31
 *  หลังเห็นจอจริงว่าปุ่มโค้งเต็มแต่ช่องเลือกข้างกันโค้งแค่ 16px) · box คือฟอร์มกรอกข้อมูล */
export type ControlShape = "box" | "pill";
export const controlShapeClass = (shape: ControlShape = "box") =>
  shape === "pill" ? "rounded-full" : "rounded-2xl";

/* ============================================================
   ช่องเลือกของเราเอง — เดิมเป็น <select> ของเบราว์เซอร์ พอกดแล้วเมนูที่กางออกมา
   เป็นของระบบปฏิบัติการ: ฟอนต์ไม่ใช่ Prompt · สีที่เลือกเป็นสีระบบ · หน้าตาต่างกัน
   ระหว่าง Mac/Windows/มือถือ · แก้อะไรไม่ได้เลย (เบสสั่ง 2026-07-31 "ใช้ของเราเอง")

   จงใจคง API เดิมทุกอย่าง (value · onChange ที่ส่ง e.target.value · children เป็น
   <option>) เพื่อให้ 42 จุดที่ใช้อยู่เปลี่ยนพร้อมกันโดยไม่ต้องแก้ทีละไฟล์ —
   ปลอดภัยกว่าการไล่เปลี่ยน 30+ ไฟล์มาก

   ตรวจก่อนทำแล้วว่าทุกจุดใช้รูปแบบเดียวกันหมด: ควบคุมค่าเอง · อ่าน e.target.value
   อย่างเดียว · ไม่มี optgroup · ไม่มี defaultValue
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

type NativeSelectProps = Omit<
  React.ComponentProps<"select">,
  "onChange" | "value" | "size"
> & {
  shape?: ControlShape;
  value?: string;
  onChange?: (event: { target: { value: string } }) => void;
};

const NativeSelect = React.forwardRef<HTMLButtonElement, NativeSelectProps>(
  (
    {
      className,
      children,
      shape,
      value,
      onChange,
      disabled,
      required,
      name,
      id,
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
          className={cn(
            controlShapeClass(shape),
            "flex h-11 min-h-11 w-full items-center justify-between gap-2 border border-slate-200/70 bg-white px-3 py-1 text-base transition-colors focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/15 sm:h-9 sm:min-h-9 sm:text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100",
            className,
          )}
          {...(rest as React.ComponentPropsWithoutRef<
            typeof SelectPrimitive.Trigger
          >)}
        >
          <span className="truncate text-left">
            {current?.label ?? <span className="text-slate-400">เลือก…</span>}
          </span>
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            className="overlay-surface z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl p-2 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 motion-reduce:animate-none"
          >
            <SelectPrimitive.Viewport>
              {options.map((o) => (
                <SelectPrimitive.Item
                  key={o.value || EMPTY}
                  value={toInner(o.value)}
                  disabled={o.disabled}
                  className="relative flex min-h-11 cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-slate-100 data-[state=checked]:bg-blue-50 data-[state=checked]:font-medium data-[state=checked]:text-blue-700 sm:min-h-9 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:data-[highlighted]:bg-slate-800 dark:data-[state=checked]:bg-blue-950/50 dark:data-[state=checked]:text-blue-300"
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
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
