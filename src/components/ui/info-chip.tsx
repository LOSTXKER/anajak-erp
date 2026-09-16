import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { c } from "@/components/kit/kit";

/* ============================================================
   InfoChip — ข้อมูลสั้นหนึ่งชิ้นที่ต้องสะดุดตา (เพิ่ม 2026-09-02)

   ต่างจาก Badge ตรงที่ใส่ไอคอนได้ และมีไว้สำหรับ "ข้อเท็จจริงที่ตัดสินใจจากมัน" เช่น
     [🚚 ร้านปักพี่หน่อย]  [📅 กลับ 1 ก.ย.]  [⚠ ขาดไซซ์ L 60 ตัว]
   แทนการเขียนสามอย่างนี้ต่อกันด้วยจุดในบรรทัดเดียว

   tone มีความหมายสถานะจริงเท่านั้น:
     neutral = ข้อเท็จจริงเฉย ๆ · info = กำลังดำเนิน · warning = ต้องตาม · error = เลย/พัง · success = ผ่าน

   หน้าตาใช้ `.chip` ของชุดกลาง (kit.module.css) ชุดเดียวกับหน้าออเดอร์/ใบผลิต (รวมสไตล์ 2026-09-17)
   ============================================================ */

export type InfoChipTone = "neutral" | "info" | "warning" | "error" | "success";

const CHIP_TONE: Record<InfoChipTone, string> = {
  neutral: "gray",
  info: "blue",
  warning: "warn",
  error: "bad",
  success: "good",
};

interface InfoChipProps {
  children: ReactNode;
  icon?: LucideIcon;
  tone?: InfoChipTone;
  size?: "sm" | "md" | "lg";
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
      className={[c("chip", CHIP_TONE[tone], size === "lg" && "lg"), strong ? "font-semibold" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {Icon ? <Icon aria-hidden="true" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function InfoChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-1.5", className)}>{children}</div>;
}
