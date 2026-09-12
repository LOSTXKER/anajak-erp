"use client";

import { ArrowRight, Lock, Paperclip, Shirt } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section, SectionTitle } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { MockupGallery } from "@/components/mockup/mockup-gallery";
import { trpc } from "@/lib/trpc";
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_VARIANTS } from "@/lib/status-config";
import { layerForCategory } from "@/lib/file-layers";
import { formatDate } from "@/lib/utils";
import type { MockupVersionLike } from "@/lib/mockup";
import type { OrderOverviewVariant } from "./order-overview-tab";
import styles from "./order-overview-cards.module.css";

/** เท่าที่การ์ดนี้ใช้จริงจาก DesignVersion — รูปทั้งชุดอ่านผ่านสูตรกลางใน lib/mockup */
export type ArtworkVersion = MockupVersionLike & {
  versionNumber: number;
  approvalStatus: string;
  approvedAt: Date | string | null;
  createdAt: Date | string;
};

/** สรุปแบบล่าสุดบนภาพรวม และใช้ query key ร่วมกับแท็บม็อกอัพและไฟล์ */
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
      loadError={designs.isError || attachments.isError ? "โหลดม็อกอัพหรือไฟล์ไม่สำเร็จ" : undefined}
      onRetry={() => { void designs.refetch(); void attachments.refetch(); }}
    />
  );
}

/** ตัวที่วาดจริง — ไม่ยิง query เอง จึงเอาไปวางในหน้าลอง/จอทดสอบด้วยข้อมูลนิ่งได้
 *  (pattern เดียวกับ OrderFilesPanel → OrderFilesCard) */
export function OrderArtworkCardView({
  variant = "current",
  latest,
  versionCount,
  rawCount,
  printCount,
  description,
  onOpenFiles,
  isLoading = false,
  loadError,
  onRetry,
}: {
  variant?: OrderOverviewVariant;
  latest: ArtworkVersion | null;
  versionCount: number;
  rawCount: number;
  printCount: number;
  description: string | null;
  onOpenFiles?: () => void;
  isLoading?: boolean;
  loadError?: string;
  onRetry?: () => void;
}) {
  const revisionRounds = versionCount - 1;
  const hasDescription = Boolean(description?.trim());
  const descriptionBlock = hasDescription ? (
    <div className={variant === "current" ? "space-y-2 border-t border-divider pt-4" : "space-y-2 pt-3"}>
      <p className="text-xs font-semibold text-muted">รายละเอียดงาน</p>
      <p className="max-w-[75ch] text-sm leading-6 text-secondary [overflow-wrap:anywhere]">{description}</p>
    </div>
  ) : null;

  return (
    <Section
      data-order-overview-card="artwork"
      className={variant === "current" ? styles.card : undefined}
      surface={variant === "current" ? "card" : "plain"}
      title={
        variant === "current" ? (
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-module-production-surface text-module-production-text" aria-hidden="true">
              <Shirt className="h-5 w-5" />
            </span>
            งานนี้พิมพ์อะไร
          </span>
        ) : (
          <SectionTitle icon={Shirt} tone="production">
            งานนี้พิมพ์อะไร
          </SectionTitle>
        )
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
        {loadError && <QueryError message={loadError} onRetry={onRetry} />}
        {isLoading ? (
          <Skeleton className={variant === "current" ? "h-48 rounded-xl" : "h-20 rounded-lg"} />
        ) : latest ? (
          <div className={variant === "current" ? "space-y-4" : "flex flex-col items-start gap-5 sm:flex-row"}>
            {variant === "current" ? (
              <div className={styles.artworkStage}>
                <MockupGallery version={latest} versionNumber={latest.versionNumber} className="mx-auto max-w-[26rem] grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 [&_button]:bg-surface [&_button]:shadow-sm" />
              </div>
            ) : (
              <div className="w-full max-w-[220px] shrink-0">
                <MockupGallery version={latest} versionNumber={latest.versionNumber} className="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1" />
              </div>
            )}
            <div className={variant === "current" ? "flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2" : "min-w-0 flex-1 space-y-2"}>
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
              <p className="text-xs leading-relaxed text-muted">
                {latest.approvedAt
                  ? `ลูกค้าอนุมัติ ${formatDate(latest.approvedAt)}`
                  : `ส่งให้ลูกค้า ${formatDate(latest.createdAt)}`}
                {revisionRounds > 0 && ` · แก้มาแล้ว ${revisionRounds} รอบ`}
              </p>
              {variant !== "current" && descriptionBlock}
            </div>
          </div>
        ) : loadError ? null : (
          // ยังไม่มีแบบ = บอกว่าขั้นต่อไปคืออะไร ไม่ใช่กล่องว่างเปล่า
          <div className={variant === "current" ? "space-y-1.5 rounded-xl border border-dashed border-border bg-surface-muted p-5" : "space-y-0.5"}>
            <p className="text-sm font-medium text-strong">ยังไม่มีม็อกอัพของใบนี้</p>
            <p className="text-xs text-muted">
              {rawCount > 0
                ? `มีไฟล์จากลูกค้า ${rawCount} ไฟล์รออยู่ — ทำแบบแล้วอัปในแท็บ “ม็อกอัพ & ไฟล์”`
                : "ยังไม่มีไฟล์อะไรเลย — ขอไฟล์ลายจากลูกค้าก่อน"}
            </p>
          </div>
        )}

        {(variant === "current" || !latest) && descriptionBlock}

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
