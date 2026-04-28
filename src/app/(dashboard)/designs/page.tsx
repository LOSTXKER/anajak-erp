"use client";

import { Palette } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function DesignsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="งานออกแบบ"
        description="จัดการไฟล์ออกแบบ, version control, อนุมัติแบบ"
      />

      <div className="rounded-2xl border border-slate-200/70 bg-white dark:border-slate-800/60 dark:bg-slate-900/80">
        <EmptyState
          icon={Palette}
          title="งานออกแบบ"
          description="อัปโหลดและจัดการแบบได้จากหน้ารายละเอียดออเดอร์ — รองรับไฟล์ AI/PSD/PNG, version control, ส่ง link ให้ลูกค้าอนุมัติ และตั้งจำนวนแก้ฟรี"
        />
      </div>
    </div>
  );
}
