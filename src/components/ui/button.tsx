import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:min-h-9 sm:min-w-0 dark:focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-[15px] [&_svg]:shrink-0",
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
        default: "h-11 px-4 sm:h-9",
        // sm ต้องเล็กจริงบน desktop ให้ต่างจาก default (UX4.1) — มือถือคงเป้านิ้ว 44px
        // sm:min-h-8 จำเป็น: base มี sm:min-h-9 จะดันความสูงกลับเป็น 36px ถ้าไม่ทับ
        sm: "h-11 px-3 text-[13px] sm:h-8 sm:min-h-8 sm:px-2.5",
        lg: "h-11 px-6 text-sm",
        icon: "h-11 w-11 sm:h-9 sm:w-9",
        "icon-sm": "h-11 w-11 sm:h-8 sm:min-h-8 sm:w-8",
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
