"use client";

/**
 * ชิ้นส่วนที่ทั้ง 3 แบบใช้ร่วมกัน
 *
 * `Field / FieldGrid / SummaryFact / Group / PhoneLink` **คัดลอกมาจาก
 * `order-overview-tab.tsx` ตัวจริงคำต่อคำ** (ของจริงไม่ได้ export ออกมา) — จงใจไม่แต่ง
 * ให้สวยขึ้นในหน้าลอง เพราะถ้าชิ้นพื้นฐานต่างจากของจริง สิ่งที่เบสเทียบจะเป็นชิ้นพวกนี้
 * แทนที่จะเป็นการจัดวางซึ่งเป็นเรื่องที่กำลังเคาะ
 *
 * ส่วนที่เกี่ยวกับลาย/ไฟล์เขียนใหม่ (จำเป็น — ของจริงยังไม่มีในแท็บภาพรวม) แต่ใช้
 * `mockupImages()` `mockupCoverImage()` `MockupGallery` `MockupThumbnail` ตัวจริงข้างใน
 */

import { useState } from "react";
import {
  FileText,
  ImageOff,
  Lock,
  Paperclip,
  User,
  ZoomIn,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DASHED, FOCUS_BUTTON, RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { mockupImages } from "@/lib/mockup";
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_VARIANTS } from "@/lib/status-config";

import { formatFileSize, type DemoAttachment, type DemoMockupVersion } from "./_artwork";

/* ─────────────────────────── ชิ้นข้อมูล (ลอกจากของจริง) ─────────────────────────── */

export function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

export function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>
  );
}

export function Field({
  label,
  children,
  wide,
  emptyText,
  emptyTone,
}: {
  label: React.ReactNode;
  children?: React.ReactNode;
  wide?: boolean;
  emptyText?: string;
  emptyTone?: "warn";
}) {
  const filled =
    children !== null &&
    children !== undefined &&
    children !== false &&
    children !== "";

  if (!filled && !emptyText) return null;

  return (
    <div className={cn("min-w-0 space-y-0.5", wide && "sm:col-span-2")}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={cn(
          "text-sm [overflow-wrap:anywhere]",
          filled
            ? "font-medium text-strong"
            : emptyTone === "warn"
              ? "text-amber-700 dark:text-amber-300"
              : "text-muted",
        )}
      >
        {filled ? children : emptyText}
      </dd>
    </div>
  );
}

export function SummaryFact({
  label,
  children,
  detail,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="min-w-0 text-lg font-semibold text-strong [overflow-wrap:anywhere]">
        <span className="block min-w-0 [overflow-wrap:anywhere]">{children}</span>
        {detail && (
          <span className="mt-1 block min-w-0 text-xs font-normal text-muted [overflow-wrap:anywhere]">
            {detail}
          </span>
        )}
      </dd>
    </div>
  );
}

export function Group({
  label,
  divided,
  className,
  children,
}: {
  label?: React.ReactNode;
  divided?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-3", divided && "border-t border-divider pt-4", className)}>
      {label && <p className="text-xs font-semibold text-muted">{label}</p>}
      {children}
    </div>
  );
}

export function PhoneLink({ phone }: { phone: string }) {
  return (
    <a
      href={`tel:${phone.replace(/[^\d+]/g, "")}`}
      className={cn(
        "inline-flex min-h-11 min-w-11 items-center rounded-lg text-blue-600 hover:underline dark:text-blue-400",
        FOCUS_BUTTON,
      )}
    >
      {phone}
    </a>
  );
}

export function areaLine(parts: (string | null)[]) {
  const line = parts.filter(Boolean).join(" ").trim();
  return line || null;
}

/* ─────────────────────────── ป้ายสถานะแบบ (ของจริง) ─────────────────────────── */

export function MockupStatusBadge({ version }: { version: DemoMockupVersion }) {
  return (
    <Badge
      variant={
        APPROVAL_STATUS_VARIANTS[
          version.approvalStatus as keyof typeof APPROVAL_STATUS_VARIANTS
        ] || "default"
      }
      size="sm"
    >
      {APPROVAL_STATUS_LABELS[
        version.approvalStatus as keyof typeof APPROVAL_STATUS_LABELS
      ] || version.approvalStatus}
    </Badge>
  );
}

/* ─────────────────────────── รูปลาย ─────────────────────────── */

/**
 * แถวรูปลายขนาดเล็ก — "เห็นผ่าน ๆ ว่าลายอะไร ถ้าอยากรู้ค่อยกดดู" (เบสสั่ง 2026-08-31)
 *
 * เดิมเป็นรูปใหญ่เต็มการ์ด/เต็มแถว ซึ่งกินที่จนหน้ายาวกว่าเดิมทุกแบบ — สวนทางกับโจทย์
 * "กระชับแต่ครบ" · ตอนนี้รูปเล็กพอให้จำงานได้ (64/48px) แล้วดันรายละเอียดไปอยู่ใน
 * กล่องขยายที่กดเปิด ซึ่งเป็นที่เดียวที่ต้องเห็นลายเต็ม ๆ จริง
 *
 * ป้ายด้านล่างรูปบอกตำแหน่งพิมพ์ (หน้า/หลัง/แขนซ้าย) — ที่รูปเล็กขนาดนี้ป้ายทับบนรูป
 * แบบเดิมอ่านไม่ออก
 */
export function ArtworkThumbRow({
  version,
  size = "md",
  className,
}: {
  version: DemoMockupVersion;
  /** md = 64px (การ์ด/แถบ) · sm = 48px (แถวข้อเท็จจริงที่ต้องเตี้ยที่สุด) */
  size?: "md" | "sm";
  className?: string;
}) {
  const [zoom, setZoom] = useState<{ src: string; label: string } | null>(null);
  const images = mockupImages(version);
  const box = size === "sm" ? "h-12 w-12" : "h-16 w-16";

  return (
    <>
      <ul className={cn("flex flex-wrap items-start gap-2", className)}>
        {images.map((image, index) => {
          const label = image.positionLabel
            ? `ม็อกอัพ v${version.versionNumber} ด้าน${image.positionLabel}`
            : `ม็อกอัพ v${version.versionNumber} รูปที่ ${index + 1}`;

          return (
            <li key={`${image.fileUrl}-${index}`} className="w-fit">
              {image.previewUrl ? (
                <button
                  type="button"
                  onClick={() => setZoom({ src: image.previewUrl!, label })}
                  aria-label={`ขยาย${label}`}
                  className={cn(
                    "group relative block overflow-hidden border border-border bg-surface-muted",
                    box,
                    RADIUS.inner,
                    FOCUS_BUTTON,
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.previewUrl}
                    alt={label}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <ZoomIn className="h-4 w-4" />
                  </span>
                </button>
              ) : (
                // .ai/.psd ที่ไม่มีรูปตัวอย่าง — ของจริงขึ้นไอคอน ไม่ปล่อยรูปแตก
                <div
                  className={cn(
                    "flex items-center justify-center text-muted",
                    box,
                    DASHED,
                    RADIUS.inner,
                  )}
                >
                  <ImageOff className="h-4 w-4" />
                </div>
              )}
              {image.positionLabel && (
                <p className={cn("mt-0.5 text-center text-2xs text-muted", box, "h-auto")}>
                  {image.positionLabel}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={zoom !== null} onOpenChange={(open) => !open && setZoom(null)}>
        <DialogContent className="max-w-3xl">
          <DialogTitle className="text-sm">{zoom?.label}</DialogTitle>
          {zoom && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={zoom.src}
              alt={zoom.label}
              className={cn("max-h-[70vh] w-full object-contain", RADIUS.inner)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─────────────────────────── ไฟล์แนบ ─────────────────────────── */

/** ไฟล์หนึ่งชิ้นแบบแถวเดียว — ชื่อไฟล์ไทย/ยาวห้าม truncate ทิ้งสระ */
export function FileRow({
  file,
  locked,
}: {
  file: DemoAttachment;
  /** ชั้น 3 ไฟล์พิมพ์ — ของจริงห้ามหลุดถึงลูกค้า ติดกุญแจให้รู้ว่าเป็นของภายใน */
  locked?: boolean;
}) {
  return (
    <li className="flex min-w-0 items-center gap-2 py-1.5">
      {locked ? (
        <Lock className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
      ) : (
        <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
      )}
      <a
        href={file.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "min-w-0 flex-1 text-sm text-blue-600 hover:underline dark:text-blue-400 [overflow-wrap:anywhere]",
          FOCUS_BUTTON,
        )}
      >
        {file.fileName}
      </a>
      {file.uploadedById === null && (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-blue-600/10 px-1.5 py-0.5 text-2xs font-medium text-blue-700 dark:bg-blue-400/15 dark:text-blue-300">
          <User className="h-2.5 w-2.5" aria-hidden="true" />
          ลูกค้าส่ง
        </span>
      )}
      <span className="shrink-0 text-2xs tabular-nums text-muted">
        {formatFileSize(file.fileSize)}
      </span>
    </li>
  );
}

/** สรุปไฟล์เป็นบรรทัดเดียว — ใช้ตอนที่ไม่มีที่พอจะกางรายชื่อไฟล์ */
export function FileCountLine({
  rawCount,
  printCount,
}: {
  rawCount: number;
  printCount: number;
}) {
  // ชั้นที่ยังไม่มีไฟล์เลยไม่ต้องขึ้น "0 ไฟล์" — เลขศูนย์อ่านเป็นข้อมูล ทั้งที่ไม่ใช่
  if (rawCount === 0 && printCount === 0) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
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
  );
}

/** ใบที่ยังไม่มีม็อกอัพ — ต้องบอกว่าขั้นต่อไปคืออะไร ไม่ใช่กล่องว่างเปล่า */
export function NoMockupNote({ rawCount }: { rawCount: number }) {
  return (
    <div className={cn("flex items-start gap-3 p-4", DASHED, RADIUS.inner)}>
      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-strong">ยังไม่มีม็อกอัพของใบนี้</p>
        <p className="text-xs text-muted">
          {rawCount > 0
            ? `มีไฟล์จากลูกค้า ${rawCount} ไฟล์รออยู่ — กราฟิกทำแบบแล้วอัปในแท็บ “ม็อกอัพ & ไฟล์”`
            : "ยังไม่มีไฟล์อะไรเลย — ขอไฟล์ลายจากลูกค้าก่อน"}
        </p>
      </div>
    </div>
  );
}
