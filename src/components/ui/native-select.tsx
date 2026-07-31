import * as React from "react";
import { cn } from "@/lib/utils";

/** ทรงของ control — pill ใช้ในแถบเครื่องมือให้เข้าชุดกับปุ่ม (เบสสั่ง 2026-07-31
 *  หลังเห็นจอจริงว่าปุ่มโค้งเต็มแต่ช่องเลือกข้างกันโค้งแค่ 16px) · box คือฟอร์มกรอกข้อมูล */
export type ControlShape = "box" | "pill";
export const controlShapeClass = (shape: ControlShape = "box") =>
  shape === "pill" ? "rounded-full" : "rounded-2xl";

const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select"> & { shape?: ControlShape }
>(({ className, children, shape, ...props }, ref) => {
  // จุดที่ผู้เรียกสั่ง appearance-none มาเอง = เขาวาดไอคอนของเขาเองอยู่แล้ว
  // (เช่นเมนู "คัดลอกลาย..." ในการ์ดรายการ) — อย่าไปวาดลูกศรซ้อนทับ
  const drawsOwnArrow = /appearance-none/.test(className ?? "");
  return (
    <select
      ref={ref}
      className={cn(
        controlShapeClass(shape),
        "flex h-11 min-h-11 w-full border border-slate-200/70 bg-white px-3 py-1 text-base transition-colors focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/15 sm:h-9 sm:min-h-9 sm:text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100",
        // pr-8 ต้องอยู่หลัง px-3 ไม่งั้นถูกทับ — เว้นที่ให้ลูกศรที่เราวาดเอง
        !drawsOwnArrow && "native-select pr-8",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
