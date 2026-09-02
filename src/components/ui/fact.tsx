import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================
   Fact / FactList — "ข้อเท็จจริงมีโครง" (เพิ่ม 2026-09-02 หลังเบสตำหนิรอบที่ 3
   ว่า "อะไร ๆ ก็ใส่เป็น text ธรรมดา อัดหลายอย่างติดกันไม่มีการจัด")

   ก่อนหน้านี้ข้อมูล 3 อย่างมักถูกต่อกันด้วยจุดในบรรทัดเดียว:
     "ร้านปักพี่หน่อย (บางบอน) · ปักโลโก้แขน 240 ตัว · กลับ 1 ก.ย."
   ซึ่งตาอ่านแล้วแยกไม่ออกว่าอะไรคือป้าย อะไรคือค่า อะไรสำคัญกว่า

   Fact = ไอคอน + ป้ายเล็ก + ค่าหนัก (+ บรรทัดรอง) — หนึ่งข้อเท็จจริงต่อหนึ่งช่อง
   FactList = วาง Fact หลายช่องเป็นตาราง ให้ตาไล่เป็นคอลัมน์ ไม่ใช่ไล่ตามบรรทัด

   กติกา (docs/DESIGN.md §ลำดับความสำคัญ): ข้อมูลตั้งแต่ 3 อย่างขึ้นไปห้ามต่อด้วย " · "
   ให้ใช้ FactList แทน · ค่าที่ต้องตัดสินใจจากมันใช้ tone (danger/warning/success)
   ซึ่งย้อมทั้งไอคอนและค่า — สีมีความหมายสถานะจริงเท่านั้น
   ============================================================ */

export type FactTone = "default" | "danger" | "warning" | "success" | "muted";

const VALUE_TONE: Record<FactTone, string> = {
  default: "text-strong",
  danger: "text-red-700 dark:text-red-300",
  warning: "text-amber-700 dark:text-amber-300",
  success: "text-green-700 dark:text-green-300",
  muted: "text-muted",
};

const ICON_TONE: Record<FactTone, string> = {
  default: "text-muted",
  danger: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  success: "text-green-600 dark:text-green-400",
  muted: "text-muted",
};

interface FactProps {
  /** ป้ายสั้น 1–3 คำ บอกว่าค่านี้คืออะไร (เช่น "ร้านนอก" "กำหนดส่ง") */
  label: ReactNode;
  /** ค่าหลัก — ตัวหนักกว่าป้ายเสมอ */
  value: ReactNode;
  /** บรรทัดรองใต้ค่า (รายละเอียดที่ไม่ต้องอ่านก็ตัดสินใจได้) */
  sub?: ReactNode;
  icon?: LucideIcon;
  tone?: FactTone;
  /** ค่าใหญ่ขึ้นหนึ่งขั้นสำหรับจอทัช/การ์ดใหญ่ */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const VALUE_SIZE = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
} as const;

export function Fact({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
  size = "md",
  className,
}: FactProps) {
  return (
    <div className={cn("flex min-w-0 items-start gap-2", className)}>
      {Icon ? (
        <Icon
          className={cn("mt-0.5 h-4 w-4 shrink-0", ICON_TONE[tone])}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      ) : null}
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className={cn("font-medium", VALUE_SIZE[size], VALUE_TONE[tone])}>{value}</p>
        {sub ? <p className="text-xs text-secondary">{sub}</p> : null}
      </div>
    </div>
  );
}

interface FactListProps {
  children: ReactNode;
  /** จำนวนคอลัมน์บนจอกว้าง — จอแคบยุบเป็นคอลัมน์เดียวเสมอ */
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

const COLUMNS = {
  1: "grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

export function FactList({ children, columns = 2, className }: FactListProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-x-4 gap-y-3", COLUMNS[columns], className)}>
      {children}
    </div>
  );
}
