import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { RADIUS, TINT } from "./tokens";

/* ============================================================
   InfoChip — ข้อมูลสั้นหนึ่งชิ้นที่ต้องสะดุดตา (เพิ่ม 2026-09-02)

   ต่างจาก Badge (ป้ายสถานะ ring บาง ไม่มีพื้น) ตรงที่ InfoChip มีพื้นจม ใส่ไอคอนได้
   และมีไว้สำหรับ "ข้อเท็จจริงที่ตัดสินใจจากมัน" เช่น
     [🚚 ร้านปักพี่หน่อย]  [📅 กลับ 1 ก.ย.]  [⚠ ขาดไซซ์ L 60 ตัว]
   แทนการเขียนสามอย่างนี้ต่อกันด้วยจุดในบรรทัดเดียว

   tone มีความหมายสถานะจริงเท่านั้น (สีจาก TINT ชุดกลาง ไม่เขียนสีเอง):
     neutral = ข้อเท็จจริงเฉย ๆ · info = กำลังดำเนิน · warning = ต้องตาม · error = เลย/พัง · success = ผ่าน
   ============================================================ */

export type InfoChipTone = "neutral" | "info" | "warning" | "error" | "success";

const TONE: Record<InfoChipTone, string> = {
  neutral: "border-transparent bg-surface-muted text-secondary",
  info: TINT.info,
  warning: TINT.warning,
  error: TINT.error,
  success: TINT.success,
};

const SIZE = {
  sm: "min-h-6 px-2 text-xs",
  md: "min-h-7 px-2 text-xs",
  /** จอทัช/การ์ดใหญ่ */
  lg: "min-h-9 px-3 text-sm",
} as const;

interface InfoChipProps {
  children: ReactNode;
  icon?: LucideIcon;
  tone?: InfoChipTone;
  size?: keyof typeof SIZE;
  /** ตัวหนา — ใช้กับชิปที่เป็นจุดโฟกัสของแถว (ควรมีชิ้นเดียวต่อแถว) */
  strong?: boolean;
  className?: string;
  title?: string;
}

export function InfoChip({
  children,
  icon: Icon,
  tone = "neutral",
  size = "md",
  strong = false,
  className,
  title,
}: InfoChipProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap border py-0.5",
        RADIUS.inner,
        SIZE[size],
        TONE[tone],
        strong ? "font-semibold" : "font-medium",
        className,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** กลุ่มชิปหลายชิ้นในแถวเดียว — ระยะเดียวกันทุกที่ */
export function InfoChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-1.5", className)}>{children}</div>;
}
