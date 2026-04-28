"use client";

import { Button } from "@/components/ui/button";
import { Plus, Package, Scissors, Shirt } from "lucide-react";
import { useState } from "react";

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

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
      >
        <Plus className="h-3.5 w-3.5" />เพิ่มสินค้า
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-md dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => { onAddFromStock(); setOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Package className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
              เลือกจากสต็อก
            </button>
            <button
              type="button"
              onClick={() => { onAddCustomMade(); setOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Scissors className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
              สั่งตัดเย็บใหม่
            </button>
            <button
              type="button"
              onClick={() => { onAddCustomerProvided(); setOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Shirt className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
              ลูกค้าส่งของมา
            </button>
          </div>
        </>
      )}
    </div>
  );
}
