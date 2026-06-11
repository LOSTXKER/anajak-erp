"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./sidebar";

// เมนูบนมือถือ — hamburger เปิด drawer ทับจอ (audit ข้อ 30: เดิมไม่มี mobile layout เลย
// sidebar 256px กินจอ 375px เหลือเนื้อหา ~120px ช่างสแกน QR จาก Job Ticket ใช้งานไม่ได้จริง)
export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // เปลี่ยนหน้าแล้วปิด drawer เสมอ (กันค้างเปิดหลังนำทางด้วยวิธีอื่น)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // ล็อก scroll ของ body ระหว่าง drawer เปิด
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="เปิดเมนู"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* backdrop */}
          <button
            type="button"
            aria-label="ปิดเมนู"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          {/* panel */}
          <div className="absolute inset-y-0 left-0 flex">
            <Sidebar mobile onNavigate={() => setOpen(false)} />
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-2 mt-3 bg-white/90 text-slate-700 shadow dark:bg-slate-800 dark:text-slate-200"
              onClick={() => setOpen(false)}
              aria-label="ปิดเมนู"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
