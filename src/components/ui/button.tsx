import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { CONTROL_H, CONTROL_H_SM, CONTROL_MIN_H } from "./control-size";
import { DISABLED_BUTTON, FOCUS_BUTTON } from "./tokens";

const buttonVariants = cva(
  cn(
    CONTROL_MIN_H,
    FOCUS_BUTTON,
    // ปุ่มแบบ kit (2026-09-17): มุม 12px ตัวหนังสือน้ำหนัก 500 · ไม่มีเอฟเฟกต์ตอนชี้ ตอบสนองตอนกดเท่านั้น
    "rounded-lg",
    "inline-flex min-w-11 touch-manipulation items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-[background-color,color,transform] active:scale-[0.98] sm:min-w-0 [@media(pointer:coarse)]:min-w-11 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-[15px] [&_svg]:shrink-0",
    DISABLED_BUTTON,
  ),
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 text-white shadow-none active:bg-blue-700 dark:bg-blue-600 dark:active:bg-blue-700",
        destructive:
          "bg-red-700 text-white shadow-none active:bg-red-800 dark:bg-red-700 dark:active:bg-red-800",
        outline:
          "border border-border bg-surface text-strong shadow-none active:bg-interactive-pressed",
        // ปุ่มรองมาตรฐานมีหน้าตาเดียว = outline — คงชื่อ secondary/subtle ไว้ไม่ให้หน้าเดิมพัง
        // แต่ยุบสไตล์ให้ชี้ตัวเดียวกัน (UX4.1: ปุ่มรอง 3 หน้าตาไม่มีเหตุผลเชิงความหมาย)
        secondary:
          "border border-border bg-surface text-strong shadow-none active:bg-interactive-pressed",
        subtle:
          "border border-border bg-surface text-strong shadow-none active:bg-interactive-pressed",
        ghost:
          "text-secondary active:bg-interactive-pressed active:text-strong",
        link:
          "text-blue-600 underline underline-offset-4 dark:text-blue-400",
      },
      size: {
        // ระยะขอบซ้าย-ขวา (เบสเคาะแบบ ก 2026-08-01 "รู้สึกมันติดขอบเกินไป และเป็นทุกปุ่มทั้งเว็บ")
        // ปุ่มเราเป็นทรงแคปซูล มุมโค้งกินพื้นที่ด้านข้างไปส่วนหนึ่ง ตัวหนังสือจึงดูชิดขอบ
        // กว่าปุ่มทรงเหลี่ยมที่ระยะเท่ากัน — ต้องเผื่อมากกว่าที่คิดจากตัวเลขเปล่าๆ
        default: cn(CONTROL_H, "px-4"),
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
