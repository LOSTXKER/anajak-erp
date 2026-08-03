import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

/* ช่องกรอกตัวเลข/เงิน — เดิม input type=number 68 จุดใน 30 ไฟล์ เขียน logic เอง
   (value={x || ""} + parseFloat(...) || 0) fallback ไม่ตรงกันแล้วแต่คนเขียน
   และ text-right/tabular-nums ใส่เป็นจุดๆ — ที่นี่คุมพฤติกรรมเดียว:
   ช่องว่างตอนค่าเป็น 0 (ให้ placeholder โชว์) · parse ไม่ได้ → fallback */

type NumberInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
> & {
  value: number;
  onValueChange: (value: number) => void;
  /** ค่าเมื่อลบจนว่าง/พิมพ์ไม่เป็นเลข (default 0 · ช่องจำนวนมัก 1) */
  fallback?: number;
  /** จำนวนเต็มเท่านั้น (parseInt + คีย์บอร์ดเลขบนมือถือ) */
  integer?: boolean;
};

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onValueChange, fallback = 0, integer = false, className, ...props }, ref) => (
    <Input
      ref={ref}
      type="number"
      inputMode={integer ? "numeric" : "decimal"}
      value={value || ""}
      onChange={(e) => {
        const parsed = integer
          ? parseInt(e.target.value, 10)
          : parseFloat(e.target.value);
        onValueChange(Number.isFinite(parsed) ? parsed : fallback);
      }}
      className={cn("tabular-nums", className)}
      {...props}
    />
  )
);
NumberInput.displayName = "NumberInput";

/** ช่องเงินบาท — ทศนิยม 2 ตำแหน่ง ชิดขวา ไม่ติดลบ (กติกาเงิน = Decimal ฝั่ง server
 *  ชั้น UI คุมรูปแบบรับเข้าให้เหมือนกันทุกฟอร์ม) */
const MoneyInput = React.forwardRef<
  HTMLInputElement,
  Omit<NumberInputProps, "integer">
>(({ className, ...props }, ref) => (
  <NumberInput
    ref={ref}
    min={0}
    step={0.01}
    placeholder="0.00"
    className={cn("text-right", className)}
    {...props}
  />
));
MoneyInput.displayName = "MoneyInput";

export { NumberInput, MoneyInput };
