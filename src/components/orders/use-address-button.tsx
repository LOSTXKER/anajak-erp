"use client";

import { ClipboardCopy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ปุ่มก๊อปที่อยู่ข้ามฟอร์ม — ชุดเดียวทั้งระบบ (เบสสั่ง 2026-08-12)
   ใช้ที่: ฟอร์มจัดส่งหน้าเปิดงาน · dialog แก้ข้อมูลออเดอร์ · dialog สร้างใบส่งของ
   ขอบประ = "ที่ว่างรอของ" ตามกติกาใน ui/tokens.ts (DASHED) — บอกว่ากดแล้วมีของมาเติมให้
   ต้องกดได้แม้ช่องข้างล่างยัง disabled อยู่ (กดแล้วเปิดสวิตช์ให้เอง) จึงวางไว้นอก fieldset */
export function UseAddressButton({
  onClick,
  children,
  className,
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn(
        "w-full gap-1.5 border-dashed text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200",
        className,
      )}
    >
      <ClipboardCopy />
      {children}
    </Button>
  );
}
