"use client";

import { Button } from "@/components/ui/button";
import { OVERLAY_PANEL } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { Plus, Package, Scissors, Shirt } from "lucide-react";
import { useState } from "react";

// 3 ชนิดงาน (itemSource) — ใช้ทั้งใน popover และการ์ดเลือกชนิดตอน empty state
export const PRODUCT_TYPE_OPTIONS = [
  { key: "stock", icon: Package, label: "เลือกจากสต็อก", desc: "เสื้อในคลัง — ตัดสต๊อกให้อัตโนมัติ" },
  { key: "custom", icon: Scissors, label: "สั่งตัดเย็บใหม่", desc: "ระบุผ้า/แพทเทิร์น ส่งโรงเย็บ" },
  { key: "provided", icon: Shirt, label: "ลูกค้าส่งของมา", desc: "ลูกค้าเอาเสื้อมาเอง พิมพ์อย่างเดียว" },
] as const;

export function AddProductPopover({
  onAddFromStock,
  onAddCustomMade,
  onAddCustomerProvided,
  triggerSize = "sm",
}: {
  onAddFromStock: () => void;
  onAddCustomMade: () => void;
  onAddCustomerProvided: () => void;
  triggerSize?: "sm" | "default" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const handlers = {
    stock: onAddFromStock,
    custom: onAddCustomMade,
    provided: onAddCustomerProvided,
  } as const;

  return (
    <div className="relative">
      <Button type="button" variant="ghost" size={triggerSize} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        <Plus />เพิ่มสินค้า
      </Button>
      {open && (
        <>
          <button type="button" tabIndex={-1} aria-label="ปิดเมนูเพิ่มสินค้า" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div role="menu" className={cn(OVERLAY_PANEL, "absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden p-1")}>
            {PRODUCT_TYPE_OPTIONS.map(({ key, icon: Icon, label, desc }) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                onClick={() => { handlers[key](); setOpen(false); }}
                className="group flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-interactive-hover active:bg-interactive-pressed dark:hover:bg-interactive-hover dark:active:bg-interactive-pressed"
              >
                <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" strokeWidth={1.75} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-secondary">{label}</span>
                  <span className="block text-xs text-muted group-hover:text-secondary group-active:text-secondary dark:group-hover:text-secondary dark:group-active:text-secondary">{desc}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
