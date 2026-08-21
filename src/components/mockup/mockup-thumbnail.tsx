import { RADIUS, DASHED } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";

const SIZE_CLASS = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-20 w-20",
} as const;

/**
 * รูปปกม็อกอัพใบเดียวสำหรับแถวรายการและการ์ด — หัวหน้าจำงานจากภาพได้เร็วกว่าเลขออเดอร์
 *
 * รับ URL ที่หาไว้แล้ว ไม่ใช่ record: คนเรียกมีข้อมูลคนละรูปแบบ (เวอร์ชันม็อกอัพบ้าง
 * ทั้งออเดอร์บ้าง) — สูตรเลือกรูปอยู่ที่ mockupCoverImage/orderMockupCover ใน lib/mockup.ts
 *
 * ไม่กดได้โดยตัวเอง: ปกติแถวทั้งแถวเป็นลิงก์อยู่แล้ว ถ้าทำปุ่มซ้อนในลิงก์จะได้
 * nested interactive ที่ keyboard/screen reader อ่านไม่ออก
 */
export function MockupThumbnail({
  cover,
  alt = "ม็อกอัพ",
  count,
  size = "md",
  className,
}: {
  cover: string | null;
  alt?: string;
  /** จำนวนรูปในชุด — โชว์มุมล่างขวาเมื่อมีมากกว่า 1 ให้รู้ว่ายังมีด้านอื่นให้ดู */
  count?: number;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
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
        alt={alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
      {count && count > 1 ? (
        <span className="absolute bottom-0 right-0 bg-black/60 px-1 text-2xs font-medium tabular-nums text-white">
          {count}
        </span>
      ) : null}
    </div>
  );
}
