// import React ตรงๆ เพื่อให้ scripts/verify-ui-tokens.tsx (รันด้วย tsx = classic JSX)
// render component นี้ตรวจคลาสได้ — Next ไม่ต้องการ แต่ไม่มีผลเสีย
import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================
   สัญลักษณ์ "กำลังทำงาน" ของทั้งระบบ (เบสสั่ง 2026-08-01 "ตรวจดีๆ ว่ามีอะไร
   ไม่เป็นมาตรฐาน")

   audit เจอ 11 แบบ ทำหน้าที่เดียวกันหมด:
     · ไอคอนหมุน 7 ขนาด (12/14/16/20/28px) เขียนขนาดเองทุกจุด
     · 2 จุดไม่ใช่ไอคอนเลย — ปั่นวงกลมด้วยขอบ CSS (`border-t-blue-500`) หนา 2px/4px
       คนละหน้าตากับที่เหลือทั้งเว็บ อยู่ในกล่องเดียวกันยังไม่เหมือนกัน
     · ขนาดในปุ่มไม่นับ — <Button> บังคับไอคอนเป็น 15px ให้อยู่แล้ว ปล่อยไว้ได้

   ขนาดยึดตามบันไดไอคอน ไม่ได้ตั้งใหม่: sm=14 (ชิดข้อความเล็ก) · md=16 (ปกติ)
   · lg=20 (ในกล่องเด้ง) · xl=32 (ทั้งส่วนกำลังโหลด)

   การเคลื่อนไหวหยุดเองเมื่อผู้ใช้ตั้งเครื่องว่า "ลดการเคลื่อนไหว" — กฎรวมอยู่ใน
   globals.css (@media prefers-reduced-motion) ไม่ต้องเขียนซ้ำที่นี่
   ============================================================ */

const SIZES = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-8 w-8",
} as const;

export function Spinner({
  size = "md",
  className,
  label,
}: {
  size?: keyof typeof SIZES;
  className?: string;
  /** ข้อความให้โปรแกรมอ่านหน้าจอ — ใส่เมื่อตัวหมุนยืนลำพัง (ไม่มีข้อความ "กำลังโหลด" ข้างๆ)
   *  ถ้าข้างๆ มีข้อความอยู่แล้วอย่าใส่ ไม่งั้นจะถูกอ่านซ้ำสองรอบ */
  label?: string;
}) {
  return (
    <>
      <Loader2
        aria-hidden="true"
        className={cn(SIZES[size], "shrink-0 animate-spin", className)}
      />
      {label && (
        <span role="status" className="sr-only">
          {label}
        </span>
      )}
    </>
  );
}
