"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Palette } from "lucide-react";

export default function DesignsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">งานออกแบบ</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          จัดการไฟล์ออกแบบ, version control, อนุมัติแบบ
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Palette className="h-16 w-16 text-slate-200 dark:text-slate-700" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
            งานออกแบบ
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            อัปโหลดและจัดการแบบได้จากหน้ารายละเอียดออเดอร์
          </p>
          <div className="mt-6 space-y-2 text-sm text-slate-500 dark:text-slate-400">
            <p>-- อัปโหลดไฟล์ AI, PSD, PNG ทุก version</p>
            <p>-- ส่ง link ให้ลูกค้าอนุมัติแบบ (ไม่ต้อง login)</p>
            <p>-- Version control + revision tracking</p>
            <p>-- ตั้งจำนวนแก้ฟรี เกินแล้วคิดเงิน</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
