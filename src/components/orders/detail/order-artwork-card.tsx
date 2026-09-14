"use client";

import { useState } from "react";
import { ArrowRight, FileText, ImageOff, Shirt, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { FOCUS_BUTTON, INTERACTIVE_PRESSED } from "@/components/ui/tokens";
import { HomeChip, HomeIconTile } from "@/components/dashboard/home/home-card";
import { MockupThumbRow } from "@/components/mockup/mockup-thumb-row";
import { MockupApprovalChip } from "@/components/orders/order-problem";
import { trpc } from "@/lib/trpc";
import { layerForCategory } from "@/lib/file-layers";
import { mockupCoverImage, mockupImageCount, type MockupVersionLike } from "@/lib/mockup";
import { cn, formatDateCompact } from "@/lib/utils";

/** เท่าที่การ์ดนี้ใช้จริงจาก DesignVersion — รูปทั้งชุดอ่านผ่านสูตรกลางใน lib/mockup */
export type ArtworkVersion = MockupVersionLike & {
  versionNumber: number;
  approvalStatus: string;
  approvedAt: Date | string | null;
  createdAt: Date | string;
};

/**
 * การ์ด "ม็อกอัพ & ไฟล์" คอลัมน์ขวาของแท็บภาพรวม
 * (เบสเคาะ 2026-09-13 "ข้อมูลออเดอร์อยู่ซ้าย ขวาเป็นไฟล์ม็อกอัพ" · หน้าตาตามต้นแบบรอบ 2 ทีละส่วน · 2026-09-15)
 *
 * รูปปกใหญ่ให้รู้ทันทีว่างานนี้พิมพ์ลายอะไร + สถานะอนุมัติที่หัวการ์ด + จำนวนไฟล์แต่ละชั้น + รายละเอียดงาน
 * เป็น **ที่ดู ไม่ใช่ที่จัดการ** — อัป/อนุมัติ/ลิงก์ลูกค้า/ลบไฟล์ อยู่แท็บ "ม็อกอัพ & ไฟล์" ที่เดียว
 * (กติกาเดิมตั้งแต่ 2026-08-22) · ปุ่มในการ์ดนี้แค่พาไปแท็บนั้น · รูปมาจากสูตรกลาง mockupCoverImage/MockupThumbRow เสมอ
 *
 * query ทั้งสองตัวใช้ key เดียวกับแท็บม็อกอัพ/ไฟล์ — react-query cache ให้ ไม่ได้ยิงซ้ำ
 */
export function OrderArtworkCard({
  orderId,
  description,
  orderType,
  onOpenFiles,
}: {
  orderId: string;
  description: string | null;
  orderType?: string;
  onOpenFiles?: () => void;
}) {
  const designs = trpc.design.listByOrder.useQuery({ orderId });
  const attachments = trpc.attachment.listByEntity.useQuery({
    entityType: "ORDER",
    entityId: orderId,
  });
  const [now] = useState(() => new Date());

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
      orderType={orderType}
      onOpenFiles={onOpenFiles}
      now={now}
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
  orderType,
  onOpenFiles,
  isLoading = false,
  now,
}: {
  latest: ArtworkVersion | null;
  versionCount: number;
  rawCount: number;
  printCount: number;
  description: string | null;
  orderType?: string;
  onOpenFiles?: () => void;
  isLoading?: boolean;
  /** เวลาที่ใช้นับ "รอลูกค้าตรวจกี่วัน" — ไม่ส่งมา = บอกแค่ว่ารอตรวจ */
  now?: Date;
}) {
  const cover = latest ? mockupCoverImage(latest) : null;
  const imageCount = latest ? mockupImageCount(latest) : 0;
  const hasDescription = Boolean(description?.trim());
  const isCustom = orderType === undefined || orderType === "CUSTOM";
  const counts = [
    { key: "mockup", label: "ม็อกอัพ", value: versionCount, unit: "เวอร์ชัน" },
    { key: "raw", label: "ไฟล์ลูกค้า", value: rawCount, unit: null },
    { key: "print", label: "ไฟล์พิมพ์", value: printCount, unit: null },
  ];

  return (
    <Section
      data-order-overview-card="artwork"
      title={
        <span className="flex items-center gap-2.5">
          <HomeIconTile icon={Shirt} tone="finance" />
          ม็อกอัพ &amp; ไฟล์
        </span>
      }
      action={
        isLoading ? undefined : latest ? (
          <MockupApprovalChip status={latest.approvalStatus} sentAt={latest.createdAt} now={now} />
        ) : (
          <HomeChip>ยังไม่มีม็อกอัพ</HomeChip>
        )
      }
    >
      <div className="space-y-3">
        {isLoading ? (
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
        ) : (
          <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-divider bg-surface-muted">
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
                <p className="text-sm text-muted">{latest ? "เวอร์ชันนี้ไม่มีรูปตัวอย่าง" : "ยังไม่มีม็อกอัพ"}</p>
                {!latest && rawCount > 0 ? (
                  <p className="text-xs text-muted">มีไฟล์จากลูกค้า {rawCount} ไฟล์รออยู่</p>
                ) : null}
                {!latest && isCustom && onOpenFiles ? (
                  <Button type="button" variant="outline" size="sm" onClick={onOpenFiles}>
                    <Upload />
                    อัปม็อกอัพ
                  </Button>
                ) : null}
              </div>
            )}
            {latest ? <HomeChip className="absolute left-3 top-3">v{latest.versionNumber}</HomeChip> : null}
          </div>
        )}

        {latest && imageCount > 1 ? (
          <MockupThumbRow version={latest} versionNumber={latest.versionNumber} size="sm" />
        ) : null}

        {latest && !isLoading ? (
          <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs text-muted">
            <p>
              ส่งให้ลูกค้าดู {formatDateCompact(latest.createdAt)}
              {latest.approvedAt ? ` · อนุมัติ ${formatDateCompact(latest.approvedAt)}` : ""}
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
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-base font-semibold tabular-nums text-strong">
                    {count.value.toLocaleString("th-TH")}
                    {count.unit ? <span className="text-xs font-normal text-muted">{count.unit}</span> : null}
                    {count.key === "print" && orderType === "CUSTOM" ? (
                      <HomeChip tone={count.value > 0 ? "success" : "warning"} className="px-1.5 py-0 text-2xs tabular-nums">
                        {count.value > 0 ? "พร้อมผลิต" : "ยังไม่มี"}
                      </HomeChip>
                    ) : null}
                  </span>
                </>
              );
              return onOpenFiles ? (
                <button
                  key={count.key}
                  type="button"
                  onClick={onOpenFiles}
                  className={cn(FOCUS_BUTTON, INTERACTIVE_PRESSED, "rounded-lg border border-divider bg-surface px-2.5 py-2 text-left")}
                >
                  {body}
                </button>
              ) : (
                <div key={count.key} className="rounded-lg border border-divider bg-surface px-2.5 py-2">
                  {body}
                </div>
              );
            })}
          </div>
        ) : null}

        {hasDescription ? (
          <div className="space-y-2 border-t border-divider pt-3.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-strong">
              <HomeIconTile icon={FileText} tone="finance" size="sm" />
              รายละเอียดงาน
            </h3>
            <p className="text-sm leading-relaxed text-secondary [overflow-wrap:anywhere]">{description}</p>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
