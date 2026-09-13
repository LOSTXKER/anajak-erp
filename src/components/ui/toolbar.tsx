import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ============================================================
   แถบเครื่องมือของหน้ารายการ — โครงเดียวของทั้งระบบ (เบสเคาะ 2026-08-01)

   ก่อนหน้านี้แต่ละหน้าประกอบเอง เลยได้ 6 แบบที่ต่างกันหมด:
     gap-2 / gap-3 / gap-4 · sm: / md: / @2xl: · items-center / start / end
   คนอ่านหน้าเว็บไล่ดูหลายหน้าติดกันจะรู้สึกว่า "มันไม่เหมือนกัน" โดยชี้ไม่ถูกว่าอะไร

   จุดตัดวัดจาก "ความกว้างพื้นที่เนื้อหา" (@container) ไม่ใช่ความกว้างหน้าต่าง —
   เพราะสิ่งที่ตัดสินว่าของจะเรียงแถวเดียวได้ไหมคือที่ว่างจริงหลังหักแถบเมนู
   และคนซูมหน้าเว็บได้ (เบสเจอมาแล้ว: จอกว้าง 1512 แต่พื้นที่จริงเหลือ 750)

   ของที่ยัดเข้ามาต้องเป็น control มาตรฐาน (สูง 36px บนเดสก์ท็อป — ดู control-size.ts)
   control ทุกชิ้นต้องสูงเท่าช่องค้นหาที่อยู่ข้างกัน
   ============================================================ */

export function Toolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="@container">
      <div
        className={cn(
          "flex flex-col gap-2 @2xl:flex-row @2xl:flex-wrap @2xl:items-center",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** กลุ่มของที่ต้องอยู่ติดกันเสมอ (เช่น ช่วงวันที่ + ตัวกรอง) — ไม่แตกแถวกลางกลุ่ม */
export function ToolbarGroup({
  children,
  className,
  align,
}: {
  children: ReactNode;
  className?: string;
  /** ดันไปชิดขวาเมื่อมีที่เหลือ — ใช้กับกลุ่มรอง เช่น ปุ่มมุมขวา */
  align?: "end";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        align === "end" && "@2xl:ml-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}
