"use client";

import { Button } from "@/components/ui/button";
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
      <Button type="button" variant="outline" size={triggerSize} onClick={() => setOpen(!open)}>
        <Plus className="h-4 w-4" />เพิ่มสินค้า
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-md dark:border-slate-800 dark:bg-slate-900">
            {PRODUCT_TYPE_OPTIONS.map(({ key, icon: Icon, label, desc }) => (
              <button
                key={key}
                type="button"
                onClick={() => { handlers[key](); setOpen(false); }}
                className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" strokeWidth={1.75} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
                  <span className="block text-[11px] text-slate-400 dark:text-slate-500">{desc}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
