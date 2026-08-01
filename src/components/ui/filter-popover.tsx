"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Filter, X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { OVERLAY_PANEL } from "./tokens";

/* ============================================================
   ตัวกรองแบบลอยใต้ปุ่ม (เบสเคาะ 2026-07-31 — เลือกแบบ ข)

   ของเดิม: กดปุ่มตัวกรองแล้วกล่องแทรกลงมากลางหน้า ดันตารางหนีลงไป ~400px
   แถวที่กำลังมองอยู่หายจากจอ พอปิดก็เด้งกลับ — ตำแหน่งกระโดดสองรอบ
   ("ไม่ชอบการที่มันดันออกมาด้านล่าง และมันจะมีแบบนี้หลายส่วนทั้งเว็บ")

   ตัวนี้ลอยทับเนื้อหา ตารางไม่ขยับสักพิกเซล · ปิดด้วย Esc หรือกดนอกกล่อง
   จอแคบกางเกือบเต็มความกว้างและเลื่อนในกล่องได้ ไม่ล้นจอ

   ทำเป็นของกลางเพื่อให้หน้าอื่นที่มีอาการเดียวกันย้ายมาใช้ตัวเดียวกันได้
   ============================================================ */

export function FilterPopover({
  activeCount,
  onClear,
  resultLabel,
  children,
  align = "start",
}: {
  /** จำนวนตัวกรองที่เปิดอยู่ — โชว์เป็นตัวเลขบนปุ่มให้รู้ว่ากรองค้างไว้ */
  activeCount: number;
  onClear: () => void;
  /** ข้อความสรุปผลลัพธ์บนปุ่มปิด เช่น "ดูผลลัพธ์ 24 รายการ" */
  resultLabel: string;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = React.useState(false);
  const hasFilters = activeCount > 0;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        {/* ไม่ใช้ size="sm" — ขนาดนั้น (32px) ตั้งใจไว้ใช้ในแถวตาราง
            บนแถบเครื่องมือต้องสูง 36px เท่าช่องค้นหาที่ยืนข้างกัน */}
        <Button
          variant="outline"
          className={cn(
            "font-medium",
            hasFilters &&
              "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
          )}
        >
          <Filter />
          ตัวกรอง
          {hasFilters && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-2xs font-medium text-white">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            OVERLAY_PANEL,
            "z-50 w-[min(28rem,calc(100vw-1.5rem))] p-4",
            "max-h-[min(32rem,calc(100dvh-8rem))] overflow-y-auto overscroll-contain",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "motion-reduce:animate-none",
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-base font-semibold">ตัวกรอง</p>
            <PopoverPrimitive.Close
              aria-label="ปิดตัวกรอง"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </PopoverPrimitive.Close>
          </div>

          <div className="space-y-3">{children}</div>

          <div className="mt-4 flex gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onClear}
              disabled={!hasFilters}
            >
              ล้างทั้งหมด
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              {resultLabel}
            </Button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
