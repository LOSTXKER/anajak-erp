import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================
   Metric — ตัวเลขที่ต้องเห็นใน 2 วินาทีแรก (เพิ่ม 2026-09-02)

   ต่างจาก StatCard ตรงที่ Metric ไม่ใช่การ์ด — วางได้ในแถว ในการ์ดใบงาน หรือหัวจอทัช
   (`boxed` ใส่พื้นอ่อนรอบตัวเลขได้ แต่ยังไม่ใช่การ์ด: ไม่มีหัว ไม่มีขอบ ไม่มีปุ่ม)
   ตัวเลขใหญ่ · หน่วยเล็กตามหลัง · ป้ายเทาใต้/บน · โฟกัสมาจาก **ขนาดและน้ำหนัก** ไม่ใช่สี
   (สีย้อมได้เฉพาะ tone ที่มีความหมายสถานะจริง: danger/warning/success)

   ใช้แทน: "<p class='text-xs text-muted'>480 ตัว</p>" ที่กลืนไปกับข้อความรอบข้าง
   ============================================================ */

export type MetricTone = "default" | "danger" | "warning" | "success" | "muted";

/* ตัวเลขคือ "ค่า" จึงเดินบันไดสีของค่าชุดเดียวกับ Fact และ StatusLabel (700 บนพื้นสว่าง
   / 300 บนพื้นมืด) — เดิม Metric ใช้บันไดของไอคอน (600/400) อยู่ตัวเดียวทั้งเว็บ
   บนพื้นมืด 400 ทึบกว่า 300 ซึ่งกินแรงอ่านของจอโรงงานที่ดูจากระยะ 2-3 เมตร */
const VALUE_TONE: Record<MetricTone, string> = {
  default: "text-strong",
  danger: "text-red-700 dark:text-red-300",
  warning: "text-amber-700 dark:text-amber-300",
  success: "text-green-700 dark:text-green-300",
  muted: "text-muted",
};

const ICON_TONE: Record<MetricTone, string> = {
  default: "text-muted",
  danger: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  success: "text-green-600 dark:text-green-400",
  muted: "text-muted",
};

const SIZE = {
  /** ตัวเลขในแถวรายการ */
  sm: { value: "text-lg", unit: "text-xs", label: "text-xs" },
  /** ตัวเลขในการ์ด */
  md: { value: "text-2xl", unit: "text-sm", label: "text-xs" },
  /** ตัวเลขสรุปหัวหน้า/จอทัช (28px ตาม type role "ตัวเลขสรุป") */
  lg: { value: "text-3xl", unit: "text-sm", label: "text-xs" },
} as const;

interface MetricProps {
  value: ReactNode;
  /** หน่วยตามหลังตัวเลข เช่น "ตัว" "ใบ" "บาท" */
  unit?: ReactNode;
  /** ป้ายบอกว่าตัวเลขนี้คืออะไร */
  label?: ReactNode;
  /** ป้ายอยู่บนตัวเลข (ค่าเริ่มต้น) หรือใต้ตัวเลข */
  labelPosition?: "top" | "bottom";
  icon?: LucideIcon;
  tone?: MetricTone;
  size?: keyof typeof SIZE;
  /** วางในกล่องพื้นอ่อน — ตัวเลขที่ต้องแยกตัวออกจากพื้นการ์ด เช่นช่องสรุปบนจอโรงงาน */
  boxed?: boolean;
  /** กึ่งกลาง = ช่องสรุปที่เรียงเป็นตาราง · ชิดซ้าย (ค่าเริ่มต้น) = ตัวเลขที่อยู่ในกระแสข้อความ */
  align?: "start" | "center";
  className?: string;
}

export function Metric({
  value,
  unit,
  label,
  labelPosition = "top",
  icon: Icon,
  tone = "default",
  size = "md",
  boxed = false,
  align = "start",
  className,
}: MetricProps) {
  const sizes = SIZE[size];
  const labelNode = label ? (
    <p
      className={cn(
        "flex items-center gap-1.5 font-medium text-muted",
        align === "center" && "justify-center",
        sizes.label,
      )}
    >
      {Icon ? <Icon className={cn("h-4 w-4 shrink-0", ICON_TONE[tone])} strokeWidth={1.75} aria-hidden="true" /> : null}
      {label}
    </p>
  ) : null;
  return (
    <div
      className={cn(
        "min-w-0",
        boxed && "rounded-lg bg-surface-muted p-3",
        align === "center" && "text-center",
        className,
      )}
    >
      {labelPosition === "top" ? labelNode : null}
      <p className={cn("font-semibold tabular-nums", sizes.value, VALUE_TONE[tone])}>
        {value}
        {unit ? <span className={cn("ml-1 font-normal text-muted", sizes.unit)}>{unit}</span> : null}
      </p>
      {labelPosition === "bottom" ? labelNode : null}
    </div>
  );
}
