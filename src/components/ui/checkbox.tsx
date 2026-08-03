import * as React from "react";
import { cn } from "@/lib/utils";
import { FOCUS_BUTTON } from "./tokens";

/* checkbox ของทั้งระบบ — เดิมไม่มีตัวกลาง ทุกจุดที่ต้องติ๊ก (สิทธิ์ผู้ใช้ ·
   เลือกใบแจ้งหนี้วางบิล · ยืนยันตรวจงาน · ตัวเลือกจัดส่ง · เลือกสินค้า)
   เขียน <input type="checkbox"> ดิบพร้อม class ก๊อปวางกันเอง 6 จุด
   สไตล์/focus ring เพี้ยนกันและไม่คุมโหมดมืด
   ยังเป็น native input (ไม่ใช่ Radix) — ส่งค่ากับ <form> ได้ตรงๆ และ
   จุดใช้งานเดิมเปลี่ยนแค่ import */
const Checkbox = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type" | "size">
>(({ className, ...props }, ref) => (
  <input
    type="checkbox"
    ref={ref}
    className={cn(
      "h-4 w-4 shrink-0 cursor-pointer rounded accent-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:accent-blue-500",
      FOCUS_BUTTON,
      className
    )}
    {...props}
  />
));
Checkbox.displayName = "Checkbox";

export { Checkbox };
