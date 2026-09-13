"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { RADIUS, DASHED, FOCUS_BUTTON } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { mockupImages, type MockupVersionLike } from "@/lib/mockup";
import { ImageOff, ZoomIn } from "lucide-react";

// ตัวดูม็อกอัพชุดเดียวของทั้งระบบ — อ่านอย่างเดียว ไม่มี action ไม่มีเงิน
// ใช้ได้ทั้งหน้าออเดอร์ /production/[id] และ station จึงห้ามผูกกับ query หรือสิทธิ์ใดๆ
// (ฝั่งที่มี action ให้ครอบด้วย MockupPanel แทน)

export function MockupGallery({
  version,
  versionNumber,
  columns = "auto",
  className,
}: {
  version: MockupVersionLike;
  versionNumber: number;
  /** compact = แถวเดียวรูปเล็ก สำหรับวางในการ์ดแคบ */
  columns?: "auto" | "compact";
  className?: string;
}) {
  const [zoom, setZoom] = useState<{ src: string; label: string } | null>(null);
  const images = mockupImages(version);

  return (
    <>
      <ul
        className={cn(
          "grid gap-3",
          columns === "compact"
            ? "grid-cols-3 sm:grid-cols-4"
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
          className,
        )}
      >
        {images.map((image, index) => {
          const label = image.positionLabel
            ? `ม็อกอัพ v${versionNumber} ด้าน${image.positionLabel}`
            : `ม็อกอัพ v${versionNumber} รูปที่ ${index + 1}`;

          return (
            <li key={`${image.fileUrl}-${index}`}>
              {image.previewUrl ? (
                <button
                  type="button"
                  onClick={() =>
                    setZoom({ src: image.previewUrl!, label })
                  }
                  // เป้านิ้วเต็มการ์ด — หน้างานใช้มือถือ กดขยายดูรายละเอียดลายบ่อย
                  className={cn(
                    "group relative block w-full overflow-hidden border border-border bg-surface-muted",
                    RADIUS.inner,
                    FOCUS_BUTTON,
                  )}
                  aria-label={`ขยาย${label}`}
                >
                  <span className="block aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.previewUrl}
                      alt={label}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain"
                    />
                  </span>
                  <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <ZoomIn className="h-3.5 w-3.5" />
                  </span>
                  {image.positionLabel ? (
                    <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-xs font-medium text-white">
                      {image.positionLabel}
                    </span>
                  ) : null}
                </button>
              ) : (
                // .ai/.psd ที่ไม่มีรูปตัวอย่าง — บอกตรงๆ ว่าดูไม่ได้ ดีกว่าปล่อยรูปแตก
                <div
                  className={cn(
                    "flex aspect-square w-full flex-col items-center justify-center gap-1 text-center text-muted",
                    DASHED,
                    RADIUS.inner,
                  )}
                >
                  <ImageOff className="h-5 w-5" />
                  <span className="px-2 text-xs">
                    {image.positionLabel ?? "ไฟล์นี้ดูตัวอย่างไม่ได้"}
                  </span>
                </div>
              )}
              {image.caption ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted">{image.caption}</p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Dialog open={zoom !== null} onOpenChange={(open) => !open && setZoom(null)}>
        <DialogContent className="max-w-3xl">
          <DialogTitle className="text-sm">{zoom?.label}</DialogTitle>
          {zoom ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={zoom.src}
              alt={zoom.label}
              className={cn("max-h-[70vh] w-full object-contain", RADIUS.inner)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
