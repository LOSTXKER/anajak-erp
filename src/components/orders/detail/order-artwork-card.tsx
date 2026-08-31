"use client";

import { ArrowRight, Lock, Paperclip, Shirt } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section, SectionTitle } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { MockupThumbRow } from "@/components/mockup/mockup-thumb-row";
import { trpc } from "@/lib/trpc";
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_VARIANTS } from "@/lib/status-config";
import { layerForCategory } from "@/lib/file-layers";
import { formatDate } from "@/lib/utils";
import type { MockupVersionLike } from "@/lib/mockup";

/** เท่าที่การ์ดนี้ใช้จริงจาก DesignVersion — รูปทั้งชุดอ่านผ่านสูตรกลางใน lib/mockup */
export type ArtworkVersion = MockupVersionLike & {
  versionNumber: number;
  approvalStatus: string;
  approvedAt: Date | string | null;
  createdAt: Date | string;
};

/**
 * การ์ด "งานนี้พิมพ์อะไร" — บนสุดของแท็บภาพรวม (เบสเคาะแบบ B จาก /proto/order-overview
 * 2026-08-31: "ชอบแบบ B" · รูปเล็ก "ให้เห็นเล็ก ๆ ผ่านก็ได้ ถ้าอยากรู้ค่อยกดไปดู")
 *
 * ปัญหาเดิม: เปิดใบงานมาแล้วไม่รู้ว่างานนี้พิมพ์ลายอะไร ต้องกดข้ามไปแท็บ "ม็อกอัพ & ไฟล์"
 * ทุกครั้ง ทั้งที่เป็นคำถามแรกที่คนเปิดใบงานถาม
 *
 * ที่นี่เป็น **ที่ดู ไม่ใช่ที่จัดการ** — ไม่มีอัป/อนุมัติ/ลิงก์ลูกค้า/ลบไฟล์ ม็อกอัพยังมีบ้านเดียว
 * คือแท็บ "ม็อกอัพ & ไฟล์" (กติกาเดิมตั้งแต่ 2026-08-22) · ปุ่มมุมขวาพาไปที่นั่น
 *
 * รายละเอียดงาน (`order.description`) ย้ายมาอยู่ในการ์ดนี้ด้วย — มันคือคำอธิบายของ
 * "งานนี้พิมพ์อะไร" เหมือนกัน เดิมลอยเป็นการ์ดตัวหนังสือล้วนที่ไม่มีภาพประกอบ
 *
 * query ทั้งสองตัวใช้ key เดียวกับแท็บม็อกอัพ/ไฟล์ — react-query cache ให้ ไม่ได้ยิงซ้ำ
 */
export function OrderArtworkCard({
  orderId,
  description,
  onOpenFiles,
}: {
  orderId: string;
  description: string | null;
  onOpenFiles?: () => void;
}) {
  const designs = trpc.design.listByOrder.useQuery({ orderId });
  const attachments = trpc.attachment.listByEntity.useQuery({
    entityType: "ORDER",
    entityId: orderId,
  });

  const files = attachments.data ?? [];
  const rawCount = files.filter(
    (file: { category?: string | null }) => layerForCategory(file.category) !== "PRINT",
  ).length;

  return (
    <OrderArtworkCardView
      latest={designs.data?.[0] ?? null}
      versionCount={designs.data?.length ?? 0}
      rawCount={rawCount}
      printCount={files.length - rawCount}
      description={description}
      onOpenFiles={onOpenFiles}
      // โหลดยังไม่เสร็จ = ยังไม่รู้ว่ามีม็อกอัพไหม · โครงร่างเตี้ย ๆ ดีกว่ากระพริบ
      // "ยังไม่มีม็อกอัพ" แล้วค่อยเด้งเป็นรูป (คนอ่านทันแล้วเข้าใจผิดว่าใบนี้ยังไม่มีแบบ)
      isLoading={designs.isLoading || attachments.isLoading}
    />
  );
}

/** ตัวที่วาดจริง — ไม่ยิง query เอง จึงเอาไปวางในหน้าลอง/จอทดสอบด้วยข้อมูลนิ่งได้
 *  (pattern เดียวกับ OrderFilesPanel → OrderFilesCard) */
export function OrderArtworkCardView({
  latest,
  versionCount,
  rawCount,
  printCount,
  description,
  onOpenFiles,
  isLoading = false,
}: {
  latest: ArtworkVersion | null;
  versionCount: number;
  rawCount: number;
  printCount: number;
  description: string | null;
  onOpenFiles?: () => void;
  isLoading?: boolean;
}) {
  const revisionRounds = versionCount - 1;
  const hasDescription = Boolean(description?.trim());

  return (
    <Section
      data-order-overview-card="artwork"
      compact
      title={
        <SectionTitle icon={Shirt} tone="production">
          งานนี้พิมพ์อะไร
        </SectionTitle>
      }
      action={
        onOpenFiles ? (
          <Button type="button" variant="ghost" size="sm" onClick={onOpenFiles}>
            ม็อกอัพ &amp; ไฟล์
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-20 rounded-lg" />
        ) : latest ? (
          <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
            <MockupThumbRow version={latest} versionNumber={latest.versionNumber} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <Badge
                  variant={
                    APPROVAL_STATUS_VARIANTS[
                      latest.approvalStatus as keyof typeof APPROVAL_STATUS_VARIANTS
                    ] || "default"
                  }
                  size="sm"
                >
                  {APPROVAL_STATUS_LABELS[
                    latest.approvalStatus as keyof typeof APPROVAL_STATUS_LABELS
                  ] || latest.approvalStatus}
                </Badge>
                <span className="font-medium text-strong">
                  ม็อกอัพ v{latest.versionNumber}
                </span>
              </p>
              <p className="text-xs text-muted">
                {latest.approvedAt
                  ? `ลูกค้าอนุมัติ ${formatDate(latest.approvedAt)}`
                  : `ส่งให้ลูกค้า ${formatDate(latest.createdAt)}`}
                {revisionRounds > 0 && ` · แก้มาแล้ว ${revisionRounds} รอบ`}
              </p>
            </div>
          </div>
        ) : (
          // ยังไม่มีแบบ = บอกว่าขั้นต่อไปคืออะไร ไม่ใช่กล่องว่างเปล่า
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-strong">ยังไม่มีม็อกอัพของใบนี้</p>
            <p className="text-xs text-muted">
              {rawCount > 0
                ? `มีไฟล์จากลูกค้า ${rawCount} ไฟล์รออยู่ — ทำแบบแล้วอัปในแท็บ “ม็อกอัพ & ไฟล์”`
                : "ยังไม่มีไฟล์อะไรเลย — ขอไฟล์ลายจากลูกค้าก่อน"}
            </p>
          </div>
        )}

        {hasDescription && (
          <div className="space-y-3 border-t border-divider pt-4">
            <p className="text-xs font-semibold text-muted">รายละเอียดงาน</p>
            <p className="max-w-[75ch] text-sm leading-6 text-secondary [overflow-wrap:anywhere]">
              {description}
            </p>
          </div>
        )}

        {/* สรุปว่ามีไฟล์อยู่กี่ชิ้น — ชื่อไฟล์อยู่แท็บม็อกอัพ & ไฟล์ (กางที่นี่ด้วยจะยาวอีกครึ่งจอ)
            ชั้นที่ยังไม่มีไฟล์ไม่ต้องขึ้น "0 ไฟล์" — เลขศูนย์อ่านเป็นข้อมูลทั้งที่ไม่ใช่ */}
        {!isLoading && rawCount + printCount > 0 && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-divider pt-4 text-xs text-muted">
            {rawCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="h-3 w-3" aria-hidden="true" />
                ไฟล์จากลูกค้า {rawCount} ไฟล์
              </span>
            )}
            {printCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3 w-3" aria-hidden="true" />
                ไฟล์พิมพ์ {printCount} ไฟล์
              </span>
            )}
          </p>
        )}
      </div>
    </Section>
  );
}
