"use client";

import { ArrowRight, ImageOff, Shirt } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { FOCUS_BUTTON, INTERACTIVE_PRESSED } from "@/components/ui/tokens";
import { HomeIconTile } from "@/components/dashboard/home/home-card";
import { MockupThumbRow } from "@/components/mockup/mockup-thumb-row";
import { trpc } from "@/lib/trpc";
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_VARIANTS } from "@/lib/status-config";
import { layerForCategory } from "@/lib/file-layers";
import { mockupCoverImage, mockupImageCount, type MockupVersionLike } from "@/lib/mockup";
import { cn, formatDate } from "@/lib/utils";

/** เท่าที่การ์ดนี้ใช้จริงจาก DesignVersion — รูปทั้งชุดอ่านผ่านสูตรกลางใน lib/mockup */
export type ArtworkVersion = MockupVersionLike & {
  versionNumber: number;
  approvalStatus: string;
  approvedAt: Date | string | null;
  createdAt: Date | string;
};

/**
 * การ์ด "ม็อกอัพ & ไฟล์" คอลัมน์ขวาของแท็บภาพรวม
 * (เบสเคาะ 2026-09-13 "ข้อมูลออเดอร์อยู่ซ้าย ขวาเป็นไฟล์ม็อกอัพ" · หน้าตาตามต้นแบบรอบ 2 · 2026-09-14)
 *
 * รูปปกใหญ่ให้รู้ทันทีว่างานนี้พิมพ์ลายอะไร + สถานะอนุมัติ + จำนวนไฟล์แต่ละชั้น + รายละเอียดงาน
 * เป็น **ที่ดู ไม่ใช่ที่จัดการ** — อัป/อนุมัติ/ลิงก์ลูกค้า/ลบไฟล์ อยู่แท็บ "ม็อกอัพ & ไฟล์" ที่เดียว
 * (กติกาเดิมตั้งแต่ 2026-08-22) · รูปมาจากสูตรกลาง mockupCoverImage/MockupThumbRow เสมอ
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
      // โหลดยังไม่เสร็จ = ยังไม่รู้ว่ามีม็อกอัพไหม · โครงร่างดีกว่ากระพริบ "ยังไม่มีม็อกอัพ" แล้วเด้งเป็นรูป
      isLoading={designs.isLoading || attachments.isLoading}
    />
  );
}

/** ตัวที่วาดจริง — ไม่ยิง query เอง จึงเอาไปวางในหน้าลอง/จอทดสอบด้วยข้อมูลนิ่งได้ */
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
  const revisionRounds = Math.max(0, versionCount - 1);
  const cover = latest ? mockupCoverImage(latest) : null;
  const imageCount = latest ? mockupImageCount(latest) : 0;
  const hasDescription = Boolean(description?.trim());
  const counts = [
    { key: "mockup", label: "ม็อกอัพ", value: versionCount, unit: "เวอร์ชัน" },
    { key: "raw", label: "ไฟล์ลูกค้า", value: rawCount, unit: "ไฟล์" },
    { key: "print", label: "ไฟล์พิมพ์", value: printCount, unit: "ไฟล์" },
  ];

  return (
    <Section
      data-order-overview-card="artwork"
      title={
        <span className="flex items-center gap-2.5">
          <HomeIconTile icon={Shirt} tone="warning" />
          ม็อกอัพ &amp; ไฟล์
        </span>
      }
      action={
        latest && !isLoading ? (
          <Badge
            variant={
              APPROVAL_STATUS_VARIANTS[latest.approvalStatus as keyof typeof APPROVAL_STATUS_VARIANTS] || "default"
            }
            size="sm"
          >
            {APPROVAL_STATUS_LABELS[latest.approvalStatus as keyof typeof APPROVAL_STATUS_LABELS] ||
              latest.approvalStatus}
          </Badge>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {isLoading ? (
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
        ) : (
          <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-surface-muted">
            {latest && cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt={`ม็อกอัพ v${latest.versionNumber}`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex max-w-xs flex-col items-center gap-2 px-6 text-center">
                <ImageOff className="h-6 w-6 text-muted" aria-hidden="true" />
                <p className="text-sm font-medium text-strong">
                  {latest ? "เวอร์ชันนี้ไม่มีรูปตัวอย่าง" : "ยังไม่มีม็อกอัพของใบนี้"}
                </p>
                {!latest ? (
                  <p className="text-xs text-muted">
                    {rawCount > 0 ? `มีไฟล์จากลูกค้า ${rawCount} ไฟล์รออยู่` : "ยังไม่มีไฟล์ลายจากลูกค้า"}
                  </p>
                ) : null}
              </div>
            )}
            {latest ? (
              <Badge variant="default" size="sm" className="absolute left-3 top-3">
                v{latest.versionNumber}
              </Badge>
            ) : null}
          </div>
        )}

        {latest && imageCount > 1 ? (
          <MockupThumbRow version={latest} versionNumber={latest.versionNumber} size="sm" />
        ) : null}

        {latest && !isLoading ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              <span className="font-medium text-secondary">ม็อกอัพ v{latest.versionNumber}</span>{" "}
              {latest.approvedAt
                ? `ลูกค้าอนุมัติ ${formatDate(latest.approvedAt)}`
                : `ส่งให้ลูกค้า ${formatDate(latest.createdAt)}`}
              {revisionRounds > 0 ? ` · แก้มาแล้ว ${revisionRounds} รอบ` : ""}
            </p>
            {onOpenFiles ? (
              <Button type="button" variant="ghost" size="sm" onClick={onOpenFiles}>
                เปิดม็อกอัพ
                <ArrowRight />
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* จำนวนไฟล์แต่ละชั้น — กดแล้วไปแท็บที่จัดการได้จริง · ชื่อไฟล์อยู่แท็บนั้น */}
        {!isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {counts.map((count) => {
              const body = (
                <>
                  <span className="block text-xs text-muted">{count.label}</span>
                  <span
                    className={cn(
                      "mt-0.5 block text-base font-semibold tabular-nums",
                      count.value > 0 ? "text-strong" : "text-muted",
                    )}
                  >
                    {count.value.toLocaleString("th-TH")}
                    <span className="ml-1 text-xs font-normal text-muted">{count.unit}</span>
                  </span>
                </>
              );
              return onOpenFiles ? (
                <button
                  key={count.key}
                  type="button"
                  onClick={onOpenFiles}
                  className={cn(FOCUS_BUTTON, INTERACTIVE_PRESSED, "rounded-xl border border-divider px-3 py-2 text-left")}
                >
                  {body}
                </button>
              ) : (
                <div key={count.key} className="rounded-xl border border-divider px-3 py-2">
                  {body}
                </div>
              );
            })}
          </div>
        ) : null}

        {hasDescription ? (
          <div className="space-y-1.5 border-t border-divider pt-4">
            <p className="text-xs font-semibold text-muted">รายละเอียดงาน</p>
            <p className="text-sm leading-6 text-secondary [overflow-wrap:anywhere]">{description}</p>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
