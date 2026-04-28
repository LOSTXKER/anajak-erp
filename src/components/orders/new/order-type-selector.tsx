"use client";

import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import {
  ShoppingBag,
  Palette,
  Check,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderTypeSelectorProps {
  onSelect: (type: "READY_MADE" | "CUSTOM") => void;
}

interface OptionConfig {
  value: "READY_MADE" | "CUSTOM";
  icon: typeof ShoppingBag;
  title: string;
  description: string;
  features: string[];
  steps: string[];
  ctaLabel: string;
}

const OPTIONS: OptionConfig[] = [
  {
    value: "READY_MADE",
    icon: ShoppingBag,
    title: "สำเร็จรูป",
    description: "สินค้าพร้อมส่ง — ลูกค้าเลือกจากแค็ตตาล็อก ไม่ต้องออกแบบ",
    features: [
      "ข้ามขั้นตอนออกแบบ",
      "เริ่มผลิตได้เลย",
      "เหมาะสำหรับ Marketplace",
    ],
    steps: ["ยืนยัน", "ผลิต", "QC", "แพ็ค", "ส่ง"],
    ctaLabel: "เลือกสำเร็จรูป",
  },
  {
    value: "CUSTOM",
    icon: Palette,
    title: "สั่งทำ Custom",
    description: "ออกแบบตามความต้องการลูกค้า — สกรีน ปัก พิมพ์ลายเฉพาะ",
    features: [
      "ออกแบบ + อนุมัติแบบ",
      "กำหนดตำแหน่งสกรีน / ปัก",
      "ส่วนเสริม / ค่าธรรมเนียม",
    ],
    steps: ["สอบถาม", "เสนอราคา", "ออกแบบ", "ผลิต", "ส่ง"],
    ctaLabel: "เลือกสั่งทำ Custom",
  },
];

export function OrderTypeSelector({ onSelect }: OrderTypeSelectorProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[
          { label: "ออเดอร์", href: "/orders" },
          { label: "สร้างใหม่" },
        ]}
        title="สร้างออเดอร์ใหม่"
        description="เลือกประเภทออเดอร์ที่ต้องการสร้าง"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={cn(
              "group flex flex-col items-start rounded-2xl border border-slate-200/70 bg-white p-5 text-left transition-all",
              "hover:border-blue-500 hover:shadow-sm",
              "dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500"
            )}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 transition-colors group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:border-blue-900 dark:group-hover:bg-blue-950/40 dark:group-hover:text-blue-300">
              <opt.icon className="h-5 w-5" strokeWidth={1.75} />
            </div>

            <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
              {opt.title}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {opt.description}
            </p>

            <ul className="mt-4 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
              {opt.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-5 w-full space-y-3">
              <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/50">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  ขั้นตอน
                </p>
                <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {opt.steps.map((step, i) => (
                    <span key={step} className="flex items-center gap-1">
                      {i > 0 && (
                        <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />
                      )}
                      <span>{step}</span>
                    </span>
                  ))}
                </div>
              </div>
              <span
                aria-hidden
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-full justify-center group-hover:border-blue-500 group-hover:bg-blue-50 group-hover:text-blue-700 dark:group-hover:border-blue-500 dark:group-hover:bg-blue-950/40 dark:group-hover:text-blue-300"
                )}
              >
                {opt.ctaLabel}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
