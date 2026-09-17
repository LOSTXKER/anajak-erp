"use client";

import { c } from "@/components/kit/kit";
import { OVERLAY_PANEL } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { Plus, PackageCheck, Scissors, Shirt } from "lucide-react";
import { useState } from "react";

// 3 ชนิดงาน (itemSource) — ใช้ทั้งใน popover และการ์ดเลือกชนิดตอน empty state
export const PRODUCT_TYPE_OPTIONS = [
  { key: "stock", icon: PackageCheck, label: "เลือกจากสต็อก" },
  { key: "custom", icon: Scissors, label: "สั่งตัดเย็บใหม่" },
  { key: "provided", icon: Shirt, label: "ลูกค้าส่งของมา" },
] as const;

export function AddProductPopover({
  onAddFromStock,
  onAddCustomMade,
  onAddCustomerProvided,
}: {
  onAddFromStock: () => void;
  onAddCustomMade: () => void;
  onAddCustomerProvided: () => void;
}) {
  const [open, setOpen] = useState(false);
  const handlers = {
    stock: onAddFromStock,
    custom: onAddCustomMade,
    provided: onAddCustomerProvided,
  } as const;

  return (
    <div className="relative">
      {/* ปุ่ม ghost เล็กบนหัวย่อย "สินค้าในชุดงาน" (ต้นแบบ) · กดแล้วเลือก 3 แหล่งก่อน ไม่เปิดคลังสต็อกทันที */}
      <button type="button" className={c("btn ghost sm")} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        <Plus aria-hidden="true" />เพิ่มสินค้า
      </button>
      {open && (
        <>
          <button type="button" tabIndex={-1} aria-label="ปิดเมนูเพิ่มสินค้า" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div role="menu" className={cn(OVERLAY_PANEL, "absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden p-1")}>
            {PRODUCT_TYPE_OPTIONS.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                onClick={() => { handlers[key](); setOpen(false); }}
                className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors active:bg-interactive-pressed dark:active:bg-interactive-pressed"
              >
                <Icon className="h-4 w-4 flex-shrink-0 text-muted" strokeWidth={1.75} />
                <span className="min-w-0 text-sm font-medium text-secondary">{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
