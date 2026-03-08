"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ShoppingBag,
  Palette,
  Check,
  ChevronRight,
} from "lucide-react";

interface OrderTypeSelectorProps {
  onSelect: (type: "READY_MADE" | "CUSTOM") => void;
}

export function OrderTypeSelector({ onSelect }: OrderTypeSelectorProps) {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            สร้างออเดอร์ใหม่
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            เลือกประเภทออเดอร์
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelect("READY_MADE")}
          className="group relative flex flex-col items-start rounded-2xl border-2 border-slate-200 bg-white p-6 text-left transition-all hover:border-blue-400 hover:shadow-lg hover:shadow-blue-100/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500 dark:hover:shadow-blue-950/50"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 dark:group-hover:bg-emerald-900">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <h2 className="mb-1 text-xl font-bold text-slate-900 dark:text-white">
            สำเร็จรูป
          </h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            สินค้าพร้อมส่ง — ลูกค้าเลือกจากแค็ตตาล็อก ไม่ต้องออกแบบ
          </p>
          <ul className="mb-5 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 flex-shrink-0 text-emerald-500" />
              ข้ามขั้นตอนออกแบบ
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 flex-shrink-0 text-emerald-500" />
              เริ่มผลิตได้เลย
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 flex-shrink-0 text-emerald-500" />
              เหมาะสำหรับ Marketplace
            </li>
          </ul>
          <div className="mt-auto w-full">
            <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                ขั้นตอน
              </p>
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <span>ยืนยัน</span>
                <ChevronRight className="h-3 w-3" />
                <span>ผลิต</span>
                <ChevronRight className="h-3 w-3" />
                <span>QC</span>
                <ChevronRight className="h-3 w-3" />
                <span>แพ็ค</span>
                <ChevronRight className="h-3 w-3" />
                <span>ส่ง</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 transition-colors group-hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 dark:group-hover:bg-emerald-900">
              <ShoppingBag className="h-4 w-4" />
              เลือกสำเร็จรูป
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelect("CUSTOM")}
          className="group relative flex flex-col items-start rounded-2xl border-2 border-slate-200 bg-white p-6 text-left transition-all hover:border-purple-400 hover:shadow-lg hover:shadow-purple-100/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-purple-500 dark:hover:shadow-purple-950/50"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-purple-50 text-purple-600 transition-colors group-hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-400 dark:group-hover:bg-purple-900">
            <Palette className="h-7 w-7" />
          </div>
          <h2 className="mb-1 text-xl font-bold text-slate-900 dark:text-white">
            สั่งทำ Custom
          </h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            ออกแบบตามความต้องการลูกค้า — สกรีน ปัก พิมพ์ลายเฉพาะ
          </p>
          <ul className="mb-5 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 flex-shrink-0 text-purple-500" />
              ออกแบบ + อนุมัติแบบ
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 flex-shrink-0 text-purple-500" />
              กำหนดตำแหน่งสกรีน / ปัก
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 flex-shrink-0 text-purple-500" />
              ส่วนเสริม / ค่าธรรมเนียม
            </li>
          </ul>
          <div className="mt-auto w-full">
            <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                ขั้นตอน
              </p>
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <span>สอบถาม</span>
                <ChevronRight className="h-3 w-3" />
                <span>เสนอราคา</span>
                <ChevronRight className="h-3 w-3" />
                <span>ออกแบบ</span>
                <ChevronRight className="h-3 w-3" />
                <span>ผลิต</span>
                <ChevronRight className="h-3 w-3" />
                <span>ส่ง</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 rounded-xl border border-purple-200 bg-purple-50 py-2.5 text-sm font-semibold text-purple-700 transition-colors group-hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-400 dark:group-hover:bg-purple-900">
              <Palette className="h-4 w-4" />
              เลือกสั่งทำ Custom
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
