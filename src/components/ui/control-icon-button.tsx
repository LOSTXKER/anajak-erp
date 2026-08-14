"use client";

import * as React from "react";
import { CONTROL_H } from "@/components/ui/control-size";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

/**
 * ปุ่มไอคอนประกอบ control — เป้านิ้ว 44px บนมือถือและ 36px บนจอกว้าง
 * ใช้กับ action อย่างล้างค่า/ปิด overlay ซึ่งต้องเป็นปุ่มจริงและเป็น sibling
 * ของ trigger ห้ามซ้อน interactive element ไว้ใน button อีกชั้น
 */
export const ControlIconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      CONTROL_H,
      FOCUS_BUTTON,
      "inline-flex w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-interactive-hover hover:text-secondary disabled:pointer-events-none disabled:opacity-50 sm:w-9 dark:hover:bg-interactive-hover dark:hover:text-secondary",
      className,
    )}
    {...props}
  />
));
ControlIconButton.displayName = "ControlIconButton";
