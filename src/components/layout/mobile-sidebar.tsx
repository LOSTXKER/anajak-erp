"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./sidebar";

// เมนูบนมือถือ — hamburger เปิด drawer ทับจอ (audit ข้อ 30: เดิมไม่มี mobile layout เลย
// sidebar 256px กินจอ 375px เหลือเนื้อหา ~120px ช่างสแกน QR จาก Job Ticket ใช้งานไม่ได้จริง)
export function MobileSidebar() {
  const pathname = usePathname();
  const [openedAtPath, setOpenedAtPath] = useState<string | null>(null);
  const open = openedAtPath === pathname;
  const setOpen = (nextOpen: boolean) => setOpenedAtPath(nextOpen ? pathname : null);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          aria-label="เปิดเมนู"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none md:hidden" />
        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[88vw] overflow-hidden border-r border-black/10 bg-[#f5f5f7] shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left motion-reduce:animate-none md:hidden dark:border-white/10 dark:bg-slate-950">
          <DialogPrimitive.Title className="sr-only">เมนูหลัก</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            เลือกหน้าในระบบ Anajak ERP
          </DialogPrimitive.Description>

          <div className="h-full">
            <Sidebar mobile onNavigate={() => setOpen(false)} />
          </div>

          <DialogPrimitive.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1.5 top-1.5 bg-white/80 text-slate-700 shadow-sm hover:bg-white dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="ปิดเมนู"
            >
              <X className="h-5 w-5" />
            </Button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
