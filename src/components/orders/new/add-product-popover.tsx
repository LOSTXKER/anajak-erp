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
        className="h-7 gap-1 border-blue-300 px-2.5 text-xs text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950"
      >
        <Plus className="h-3.5 w-3.5" />เพิ่มสินค้า
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => { onAddFromStock(); setOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Package className="h-4 w-4 text-blue-500" />
              เลือกจากสต็อก
            </button>
            <button
              type="button"
              onClick={() => { onAddCustomMade(); setOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Scissors className="h-4 w-4 text-amber-500" />
              สั่งตัดเย็บใหม่
            </button>
            <button
              type="button"
              onClick={() => { onAddCustomerProvided(); setOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Shirt className="h-4 w-4 text-orange-500" />
              ลูกค้าส่งของมา
            </button>
          </div>
        </>
      )}
    </div>
  );
}
