"use client";

import { useState } from "react";
import { ImageOff, ZoomIn } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DASHED, FOCUS_BUTTON, RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { mockupImages, type MockupVersionLike } from "@/lib/mockup";

/**
 * รูปย่อของม็อกอัพทั้งชุดเรียงแถว — "เห็นเล็ก ๆ ผ่านตาว่าลายอะไร ถ้าอยากรู้ค่อยกดดู"
 * (เบสเคาะ 2026-08-31 จากหน้าลอง /proto/order-overview)
 *
 * ต่างจาก `MockupGallery` ตรงที่อันนั้นเป็น "ที่ดูลาย" เต็มตัวสำหรับแท็บม็อกอัพ/จอผลิต
 * (รูปใหญ่เต็มความกว้าง) ส่วนอันนี้คือ "ป้ายบอกว่างานนี้หน้าตาแบบไหน" ที่ไปแปะในหน้าอื่นได้
 * โดยไม่กินที่ — ทั้งคู่ใช้สูตรเลือกรูปชุดเดียวกัน (`mockupImages`) จึงไม่มีทางโชว์คนละรูป
 *
 * ป้ายตำแหน่งอยู่ "ใต้" รูป ไม่ใช่ทับบนรูปแบบ gallery — ที่ขนาด 48–64px ป้ายทับรูปอ่านไม่ออก
 */
export function MockupThumbRow({
  version,
  versionNumber,
  size = "md",
  className,
}: {
  version: MockupVersionLike;
  versionNumber: number;
  /** md = 64px (การ์ดในหน้า) · sm = 48px (แถวที่ต้องเตี้ยที่สุด) */
  size?: "md" | "sm";
  className?: string;
}) {
  const [zoom, setZoom] = useState<{ src: string; label: string } | null>(null);
  const images = mockupImages(version);
  const box = size === "sm" ? "h-12 w-12" : "h-16 w-16";

  if (images.length === 0) return null;

  return (
    <>
      <ul className={cn("flex flex-wrap items-start gap-2", className)}>
        {images.map((image, index) => {
          const label = image.positionLabel
            ? `ม็อกอัพ v${versionNumber} ด้าน${image.positionLabel}`
            : `ม็อกอัพ v${versionNumber} รูปที่ ${index + 1}`;

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
                // .ai/.psd ที่ไม่มีรูปตัวอย่าง — บอกตรง ๆ ว่าดูไม่ได้ ดีกว่าปล่อยรูปแตก
                <div
                  className={cn(
                    "flex items-center justify-center text-muted",
                    box,
                    DASHED,
                    RADIUS.inner,
                  )}
                  title="ไฟล์นี้ดูตัวอย่างไม่ได้"
                >
                  <ImageOff className="h-4 w-4" aria-hidden="true" />
                </div>
              )}
              {image.positionLabel && (
                /* 12px ตาม role กลาง — 11px (text-2xs) สงวนไว้ให้ป้ายสถานะ/ตัวนับเท่านั้น */
                <p className={cn("mt-0.5 text-center text-xs text-muted", box, "h-auto")}>
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
