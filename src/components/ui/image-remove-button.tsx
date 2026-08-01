// import React ตรงๆ เพื่อให้ scripts/verify-ui-tokens.tsx (รันด้วย tsx = classic JSX)
// render component นี้ตรวจคลาสได้ — Next ไม่ต้องการ แต่ไม่มีผลเสีย
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/* ============================================================
   ปุ่มลบรูปที่มุมรูปย่อ — ของกลาง (เบสสั่ง 2026-08-01 "ตรวจดีๆ ว่ามีอะไรไม่เป็นมาตรฐาน")

   audit เจอ 3 จุดทำเรื่องเดียวกันแต่คนละหน้าตา:
     · ตรวจรับของ / ของเสีย — พื้นที่กดโปร่ง 44px ครอบวงกลมแดง 24px ข้างใน
     · สลิปโอนเงิน — วงกลมแดงทึบ 44px เต็มๆ ทับมุมรูป
   → ยึดแบบแรก เพราะพื้นที่กดกว้างพอสำหรับนิ้ว (44px) แต่สิ่งที่ตาเห็นเล็ก
     ไม่บังรูปย่อที่มันเกาะอยู่ · แบบวงกลมทึบ 44px กินมุมรูปไปเกือบครึ่ง

   วางไว้ในกล่องที่ตั้ง `relative` — ปุ่มจะไปเกาะมุมขวาบนเอง
   ============================================================ */
export function ImageRemoveButton({
  onClick,
  label,
  className,
}: {
  onClick: () => void;
  /** บอกว่ากำลังลบรูปอะไร — โปรแกรมอ่านหน้าจอต้องแยกออกเมื่อมีหลายรูปเรียงกัน */
  label: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      // icon-sm = พื้นที่กดโปร่ง 44px บนมือถือ (เป้านิ้ว) · 32px บนเดสก์ท็อป
      // เอาความสูงจาก Button ไม่เขียนเอง — ด่าน lint จับตอนเขียนสูตรเองมาแล้ว
      size="icon-sm"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "absolute -right-2 -top-2 items-start justify-end p-1 text-white hover:bg-transparent",
        className,
      )}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-700 shadow-sm">
        {/* ไอคอนใน Button ถูกบังคับ 15px — วงกลม 24px ต้องได้ไอคอนเล็กกว่านั้น */}
        <X className="!size-[14px]" />
      </span>
    </Button>
  );
}
