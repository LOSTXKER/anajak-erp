import * as React from "react";
import { cn } from "@/lib/utils";
import { CONTROL_H, CONTROL_H_SM } from "./control-size";
import {
  FIELD_SURFACE,
  FOCUS_FIELD,
  controlShapeClass,
  type ControlShape,
} from "./tokens";

/** ขนาดของช่องกรอก — sm ใช้เฉพาะในแถวตารางที่ต้องอัดหลายช่องต่อแถว
 *  (เดิม 20 กว่าจุดสั่ง className="h-8 text-xs" เอง ซึ่งได้ 32px ทั้งบนมือถือ
 *  ต่ำกว่าเป้านิ้วขั้นต่ำ 44px — sm ให้ 44px บนมือถือ 32px บนเดสก์ท็อป)
 *  dense = สูงมาตรฐานแต่อักษร xs บนเดสก์ท็อป — สำหรับ editable grid ที่ control
 *  หลายตัวยืนแถวเดียวกัน (เดิม 15 จุดสั่ง className="sm:h-9 sm:text-xs" เอง
 *  ซึ่ง sm:h-9 ซ้ำกับค่า default อยู่แล้ว เหลือผลจริงแค่ขนาดอักษร) */
type InputSize = "default" | "sm" | "dense";

const Input = React.forwardRef<
  HTMLInputElement,
  // ตัด size ของ HTML ทิ้ง (ที่แปลว่า "กว้างกี่ตัวอักษร") — ในระบบเรา size = ขนาด control
  Omit<React.ComponentProps<"input">, "size"> & {
    shape?: ControlShape;
    size?: InputSize;
  }
>(
  ({ className, type, shape, size = "default", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          controlShapeClass(shape),
          FIELD_SURFACE,
          FOCUS_FIELD,
          "flex w-full px-3 py-1 text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium sm:text-sm disabled:cursor-not-allowed disabled:opacity-50",
          // หลังก้อนพื้นฐานเสมอ — twMerge ตัดสินจาก "ตัวหลังชนะ" ถ้าวางก่อน text-base/sm:text-sm
          // ที่อยู่ข้างบนจะทับ text-xs กลับ (เขียนสลับแล้วขนาดไม่เปลี่ยน หาสาเหตุยาก)
          size === "sm"
            ? cn(CONTROL_H_SM, "text-xs sm:text-xs")
            : size === "dense"
              ? cn(CONTROL_H, "sm:text-xs")
              : CONTROL_H,
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
