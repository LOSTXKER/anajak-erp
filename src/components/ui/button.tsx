import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { CONTROL_H, CONTROL_H_SM, CONTROL_MIN_H } from "./control-size";
import { DISABLED_CONTROL_SURFACE, FOCUS_BUTTON } from "./tokens";

const buttonVariants = cva(
  cn(
    CONTROL_MIN_H,
    FOCUS_BUTTON,
    "inline-flex min-w-11 touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors duration-150 sm:min-w-0 [@media(pointer:coarse)]:min-w-11 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-[15px] [&_svg]:shrink-0",
    DISABLED_CONTROL_SURFACE,
  ),
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 text-white shadow-none hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 dark:active:bg-blue-800",
        destructive:
          "bg-red-700 text-white shadow-none hover:bg-red-800 active:bg-red-900 dark:bg-red-700 dark:hover:bg-red-800 dark:active:bg-red-900",
        outline:
          "border border-border bg-surface text-secondary shadow-none hover:bg-interactive-hover hover:text-strong active:bg-interactive-pressed active:text-strong",
        // ปุ่มรองมาตรฐานมีหน้าตาเดียว = outline — คงชื่อ secondary/subtle ไว้ไม่ให้หน้าเดิมพัง
        // แต่ยุบสไตล์ให้ชี้ตัวเดียวกัน (UX4.1: ปุ่มรอง 3 หน้าตาไม่มีเหตุผลเชิงความหมาย)
        secondary:
          "border border-border bg-surface text-secondary shadow-none hover:bg-interactive-hover hover:text-strong active:bg-interactive-pressed active:text-strong",
        subtle:
          "border border-border bg-surface text-secondary shadow-none hover:bg-interactive-hover hover:text-strong active:bg-interactive-pressed active:text-strong",
        ghost:
          "text-secondary hover:bg-interactive-hover hover:text-strong active:bg-interactive-pressed active:text-strong",
        link:
          "text-blue-600 underline-offset-4 hover:underline dark:text-blue-400",
      },
      size: {
        // ระยะขอบซ้าย-ขวา (เบสเคาะแบบ ก 2026-08-01 "รู้สึกมันติดขอบเกินไป และเป็นทุกปุ่มทั้งเว็บ")
        // ปุ่มเราเป็นทรงแคปซูล มุมโค้งกินพื้นที่ด้านข้างไปส่วนหนึ่ง ตัวหนังสือจึงดูชิดขอบ
        // กว่าปุ่มทรงเหลี่ยมที่ระยะเท่ากัน — ต้องเผื่อมากกว่าที่คิดจากตัวเลขเปล่าๆ
        default: cn(CONTROL_H, "px-5"),
        // sm คงความสูงมาตรฐาน แต่ลด padding ให้กะทัดรัด — มือถือยังคงเป้านิ้ว 44px
        sm: cn(CONTROL_H_SM, "px-4 text-sm sm:px-3.5"),
        lg: "h-11 px-7 text-sm",
        icon: cn(CONTROL_H, "w-11 sm:w-9"),
        "icon-sm": cn(CONTROL_H_SM, "w-11 sm:w-8"),
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
