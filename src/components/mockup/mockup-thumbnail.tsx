import { RADIUS, DASHED } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import {
  mockupCoverImage,
  mockupImageCount,
  type MockupVersionLike,
} from "@/lib/mockup";
import { ImageOff } from "lucide-react";

const SIZE_CLASS = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-20 w-20",
} as const;

/**
 * รูปปกม็อกอัพใบเดียวสำหรับแถวรายการและการ์ด — หัวหน้าจำงานจากภาพได้เร็วกว่าเลขออเดอร์
 *
 * ไม่กดได้โดยตัวเอง: ปกติแถวทั้งแถวเป็นลิงก์อยู่แล้ว ถ้าทำปุ่มซ้อนในลิงก์จะได้
 * nested interactive ที่ keyboard/screen reader อ่านไม่ออก
 */
export function MockupThumbnail({
  version,
  versionNumber,
  size = "md",
  className,
}: {
  version: MockupVersionLike | null | undefined;
  versionNumber?: number;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  const cover = version ? mockupCoverImage(version) : null;
  const count = version ? mockupImageCount(version) : 0;

  if (!cover) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center text-muted",
          SIZE_CLASS[size],
          DASHED,
          RADIUS.inner,
          className,
        )}
        aria-hidden="true"
      >
        <ImageOff className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden border border-border bg-surface-muted",
        SIZE_CLASS[size],
        RADIUS.inner,
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover}
        alt={versionNumber ? `ม็อกอัพ v${versionNumber}` : "ม็อกอัพ"}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
      {count > 1 ? (
        <span className="absolute bottom-0 right-0 bg-black/60 px-1 text-2xs font-medium tabular-nums text-white">
          {count}
        </span>
      ) : null}
    </div>
  );
}
