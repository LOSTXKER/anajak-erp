"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Filter, X } from "lucide-react";
import { Button } from "./button";
import { ControlIconButton } from "./control-icon-button";
import { cn } from "@/lib/utils";
import { ACTIVE_FILTER, OVERLAY_PANEL } from "./tokens";

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
  triggerClassName,
}: {
  /** จำนวนตัวกรองที่เปิดอยู่ — โชว์เป็นตัวเลขบนปุ่มให้รู้ว่ากรองค้างไว้ */
  activeCount: number;
  onClear: () => void;
  /** ข้อความสรุปผลลัพธ์บนปุ่มปิด เช่น "ดูผลลัพธ์ 24 รายการ" */
  resultLabel: string;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  /** ผิวเฉพาะบริบทของปุ่มเปิด เช่น control ที่ยกขึ้นจากผืนหน้า */
  triggerClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const hasFilters = activeCount > 0;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        {/* ใช้ความสูงมาตรฐานเดียวกับช่องค้นหา/ช่วงวันที่ที่ยืนข้างกัน */}
        <Button
          variant="outline"
          className={cn(
            "font-medium",
            triggerClassName,
            hasFilters &&
              ACTIVE_FILTER,
          )}
        >
          <Filter />
          ตัวกรอง
          {hasFilters && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-blue-600 px-1.5 text-2xs font-semibold tabular-nums text-white dark:bg-blue-500">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={contentRef}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          tabIndex={-1}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contentRef.current?.focus({ preventScroll: true });
          }}
          className={cn(
            OVERLAY_PANEL,
            "z-50 w-[min(25rem,calc(100vw-1.5rem))] overflow-hidden p-0 outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "motion-reduce:animate-none",
          )}
        >
          <div className="flex items-center justify-between border-b border-divider px-4 py-2">
            <h2 className="text-sm font-semibold text-strong">ตัวกรอง</h2>
            <PopoverPrimitive.Close asChild>
              <ControlIconButton aria-label="ปิดตัวกรอง" className="rounded-lg">
                <X className="h-4 w-4" />
              </ControlIconButton>
            </PopoverPrimitive.Close>
          </div>

          <div className="max-h-[min(28rem,calc(100dvh-13rem))] overflow-y-auto overscroll-contain px-4 py-3">
            <div className="space-y-4">{children}</div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-divider px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={!hasFilters}
            >
              ล้างทั้งหมด
            </Button>
            <Button
              size="sm"
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

export function FilterPopoverField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-secondary" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}
