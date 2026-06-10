"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// กล่องส่วนเสริมแบบพับได้ — ใช้กับฟอร์มแบบ "เปิดงานเร็ว เติมตามจังหวะ":
// หัวข้อ + ป้ายสรุปสถานะ (เช่น "ยังไม่ใส่ — เติมทีหลังได้" / "3 รายการ · ฿1,500")
// พับอยู่ = ไม่รบกวนสายตา · ข้อมูลข้างในคง state ไว้เสมอ (ซ่อนด้วย CSS ไม่ unmount)

interface CollapsibleSectionProps {
  title: React.ReactNode;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  children,
  className,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200/60 bg-white dark:border-slate-800/60 dark:bg-slate-900/80",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
      >
        <span className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">
          {title}
        </span>
        <span className="flex min-w-0 items-center gap-2.5">
          {summary && (
            <span className="truncate text-[12.5px] text-slate-500 dark:text-slate-400">
              {summary}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-400 transition-transform",
              open && "rotate-180"
            )}
          />
        </span>
      </button>
      {/* ซ่อนด้วย CSS — state ในฟอร์มลูกไม่หายตอนพับ */}
      <div className={cn("px-6 pb-6", !open && "hidden")}>{children}</div>
    </section>
  );
}
