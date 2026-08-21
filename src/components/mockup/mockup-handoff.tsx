"use client";

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_VARIANTS } from "@/lib/status-config";
import { cn } from "@/lib/utils";
import { mockupImageCount } from "@/lib/mockup";
import { MockupThumbnail } from "./mockup-thumbnail";
import { ArrowRight } from "lucide-react";

/**
 * แถบสรุปม็อกอัพในแท็บงานผลิตของหน้าออเดอร์ — บอกสถานะแล้วพาไปที่เดียวที่จัดการได้จริง
 *
 * ตั้งใจไม่มี action ของตัวเอง: ม็อกอัพมีบ้านเดียวคือแท็บ "ม็อกอัพ & ไฟล์" ถ้าตรงนี้
 * อัป/อนุมัติได้ด้วยก็กลับไปเป็นสองบ้านเหมือนเดิม
 *
 * ใช้ query key เดียวกับ MockupPanel — react-query cache ให้ ไม่ได้ยิงเพิ่ม
 */
export function OrderMockupHandoff({
  orderId,
  onOpenMockup,
}: {
  orderId: string;
  onOpenMockup: () => void;
}) {
  const designs = trpc.design.listByOrder.useQuery({ orderId });

  if (designs.isLoading) {
    return <Skeleton className="h-20 rounded-2xl" />;
  }
  // โหลดพังตรงนี้ไม่ใช่เรื่องคอขาดบาดตาย — แท็บม็อกอัพมี error+retry เต็มรูปแบบอยู่แล้ว
  // แถบสรุปจึงเงียบไปแทนที่จะเอา error มาขวางงานตรวจรับ/QC ที่อยู่ใต้ลงไป
  if (designs.isError) return null;

  const latest = designs.data?.[0];
  const imageCount = latest ? mockupImageCount(latest) : 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 p-3",
        SUNK_PANEL,
        RADIUS.surface,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <MockupThumbnail
          version={latest}
          versionNumber={latest?.versionNumber}
          size="md"
        />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-strong">ม็อกอัพ</p>
          {latest ? (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <Badge
                variant={
                  APPROVAL_STATUS_VARIANTS[
                    latest.approvalStatus as keyof typeof APPROVAL_STATUS_VARIANTS
                  ] || "default"
                }
              >
                {APPROVAL_STATUS_LABELS[
                  latest.approvalStatus as keyof typeof APPROVAL_STATUS_LABELS
                ] || latest.approvalStatus}
              </Badge>
              <span>
                เวอร์ชัน {latest.versionNumber} · {imageCount} รูป
              </span>
            </p>
          ) : (
            <p className="text-xs text-muted">ยังไม่มีม็อกอัพของออเดอร์นี้</p>
          )}
        </div>
      </div>

      <Button variant="outline" size="sm" className="gap-1.5" onClick={onOpenMockup}>
        เปิดแท็บม็อกอัพ
        <ArrowRight />
      </Button>
    </div>
  );
}
