import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { CONTROL_H, CONTROL_H_SM, CONTROL_MIN_H } from "./control-size";
import { FOCUS_BUTTON } from "./tokens";

const buttonVariants = cva(
  cn(
    CONTROL_MIN_H,
    FOCUS_BUTTON,
    "inline-flex min-w-11 touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all sm:min-w-0 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-[15px] [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500",
        destructive:
          "bg-red-700 text-white shadow-sm hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500",
        outline:
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
        // ปุ่มรองมาตรฐานมีหน้าตาเดียว = outline — คงชื่อ secondary/subtle ไว้ไม่ให้หน้าเดิมพัง
        // แต่ยุบสไตล์ให้ชี้ตัวเดียวกัน (UX4.1: ปุ่มรอง 3 หน้าตาไม่มีเหตุผลเชิงความหมาย)
        secondary:
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
        subtle:
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
        ghost:
          "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
        link:
          "text-blue-600 underline-offset-4 hover:underline dark:text-blue-400",
      },
      size: {
        // ระยะขอบซ้าย-ขวา (เบสเคาะแบบ ก 2026-08-01 "รู้สึกมันติดขอบเกินไป และเป็นทุกปุ่มทั้งเว็บ")
        // ปุ่มเราเป็นทรงแคปซูล มุมโค้งกินพื้นที่ด้านข้างไปส่วนหนึ่ง ตัวหนังสือจึงดูชิดขอบ
        // กว่าปุ่มทรงเหลี่ยมที่ระยะเท่ากัน — ต้องเผื่อมากกว่าที่คิดจากตัวเลขเปล่าๆ
        default: cn(CONTROL_H, "px-5"),
        // sm ต้องเล็กจริงบน desktop ให้ต่างจาก default (UX4.1) — มือถือคงเป้านิ้ว 44px
        // ห้ามใช้บนแถบเครื่องมือ: เตี้ยกว่าช่องค้นหาที่ยืนข้างกัน 4px (ดู control-size.ts)
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
