import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { RADIUS, SUNK_PANEL } from "./tokens";

/* ============================================================
   ActionZone — โซนลงมือมีพื้นของตัวเอง (เพิ่ม 2026-09-02)

   ปุ่มหลักที่ลอยปนอยู่ท้ายข้อความเทา = ตาหาไม่เจอว่า "กดตรงไหน"
   ActionZone ให้พื้นจม (SUNK_PANEL) แยกโซน "ลงมือ" ออกจากโซน "อ่าน" —
   ซ้ายเป็นข้อความบอกเงื่อนไข (ถ้ามี) ขวาเป็นปุ่ม · บนจอแคบเรียงลงล่าง ปุ่มเต็มแถว

   กติกา: หนึ่งโซนมี primary action เดียว (ปุ่มน้ำเงินตัวเดียว) ปุ่มอื่นเป็น outline/ghost
   ============================================================ */

interface ActionZoneProps {
  children: ReactNode;
  /** ข้อความบอกเงื่อนไข/สถานะของการลงมือ เช่น "รอของกลับจากร้านนอกก่อน" */
  note?: ReactNode;
  /** โซนบนจอทัช — สูงขึ้นและปุ่มเต็มความกว้าง */
  touch?: boolean;
  className?: string;
}

export function ActionZone({ children, note, touch = false, className }: ActionZoneProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        // จอทัช: ข้อความบอกเงื่อนไขอยู่บนปุ่มเสมอ (เคยวางข้างกันแล้วโดนปุ่มเต็มแถวบีบจนเหลือคำละบรรทัด)
        !touch && "sm:flex-row sm:items-center sm:justify-between",
        SUNK_PANEL,
        RADIUS.surface,
        touch ? "p-4" : "p-3",
        className,
      )}
    >
      {note ? (
        <p className={cn("min-w-0 text-secondary", touch ? "text-sm" : "text-xs sm:flex-1")}>{note}</p>
      ) : null}
      <div
        className={cn(
          "flex flex-wrap gap-2",
          touch ? "w-full [&>*]:flex-1" : "sm:justify-end",
          !note && !touch && "sm:ml-auto",
        )}
      >
        {children}
      </div>
    </div>
  );
}
