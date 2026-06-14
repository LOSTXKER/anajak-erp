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

      <div className="card-surface rounded-2xl">
        <EmptyState
          icon={Palette}
          title="งานออกแบบ"
          description="อัปโหลดและจัดการแบบได้จากหน้ารายละเอียดออเดอร์ — รองรับไฟล์ AI/PSD/PNG, version control, ส่ง link ให้ลูกค้าอนุมัติ และตั้งจำนวนแก้ฟรี"
        />
      </div>
    </div>
  );
}
