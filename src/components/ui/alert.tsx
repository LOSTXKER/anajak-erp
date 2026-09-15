import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { InfoChip, InfoChipRow } from "./info-chip";
import type { TINT } from "./tokens";
import { cn } from "@/lib/utils";

/**
 * กล่องแจ้งเตือนกลางของทั้งเว็บ — แบบ B "แถบสีข้าง พื้นเรียบ" (เบสเคาะ 2026-09-03 จากหน้าลอง /proto/alert)
 *
 * เดิม: กล่องพื้นสีตามความหมาย ข้างในเป็นตัวหนังสือล้วน ไอคอนมีเฉพาะที่คนเขียนโค้ดนึกได้ (12 จาก 72 จุด)
 * เบสทัก "ดูโง่ไป และเป็นทั้งเว็บ ปัญหาเดิม" (ตัวหนังสือ 3 บรรทัด ไม่มีลำดับ)
 *
 * ใหม่: การ์ดขาวเหมือนการ์ดอื่นในหน้า สีบอกความหมายเหลือแค่แถบข้างซ้าย + ไอคอน (เลือกให้อัตโนมัติตามชนิด)
 *   ชั้น 1 หัวเรื่องหนา · ชั้น 2 เนื้อความ · ชั้น 3 `meta` เป็นชิป (ขั้น · คน · เวลา) — ไม่ใช่บรรทัดจุด · `action` ปุ่มชิดขวา
 * API เดิมยังใช้ได้ทั้งหมด (variant · icon · title · children · className · ref) — ทุกจุดเปลี่ยนหน้าตาตามโดยไม่ต้องแก้
 * ใช้คู่กับ <QueryError> ที่หนักกว่าสำหรับ error เต็มหน้า
 */

export type AlertVariant = keyof typeof TINT;

const DEFAULT_ICON: Record<AlertVariant, LucideIcon> = {
  error: CircleAlert,
  warning: TriangleAlert,
  success: CircleCheck,
  info: Info,
  neutral: Info,
};


const INK: Record<AlertVariant, string> = {
  error: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  success: "text-green-600 dark:text-green-400",
  info: "text-blue-600 dark:text-blue-400",
  neutral: "text-muted",
};

/* พื้นกล่องแบบ callout ของชุด kit (2026-09-17 เบสสั่งให้ทุกหน้าเข้ากัน): พื้นสีอ่อนตามความหมาย ขอบจาง
   ตรงกล่องแจ้งเตือนบนหน้าออเดอร์/ใบผลิต · กลางๆ = การ์ดขาวขอบเทา */
const SURFACE: Record<AlertVariant, string> = {
  error: "border-red-600/25 bg-red-50 dark:border-red-400/30 dark:bg-red-950/40",
  warning: "border-amber-600/30 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-950/40",
  success: "border-green-600/25 bg-green-50 dark:border-green-400/30 dark:bg-green-950/40",
  info: "border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/40",
  neutral: "border-border bg-surface",
};

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: AlertVariant | null;
  /** ไม่ส่ง = ไอคอนตามชนิด (ผิดพลาด/เตือน/สำเร็จ/ข้อมูล) */
  icon?: LucideIcon;
  title?: React.ReactNode;
  /** ข้อเท็จจริงประกอบ (ขั้น · คน · เวลา) — เป็นชิปชั้น 3 แทนบรรทัดตัวหนังสือจาง */
  meta?: readonly { label: string; value: React.ReactNode }[];
  /** ปุ่มของกล่อง (ลองใหม่ · ส่งเข้า QC · แก้ให้) — ชิดขวา แยกจากข้อความ */
  action?: React.ReactNode;
}

/* forwardRef เพราะฟอร์มบางหน้าต้อง "เด้งโฟกัสมาที่กล่องสรุปข้อผิดพลาด" หลังกดส่ง
   (เช่น /orders/new) — ถ้าส่ง ref ไม่ได้ ต้องกลับไปเขียนกล่องเองเหมือนเดิม */
export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, icon, title, meta, action, children, ...props }, ref) => {
    const tone: AlertVariant = variant ?? "info";
    const Icon = icon ?? DEFAULT_ICON[tone];
    return (
      <div
        ref={ref}
        role="alert"
        className={cn("flex gap-2.5 rounded-[14px] border px-3.5 py-2.5 text-sm leading-relaxed text-strong", SURFACE[tone], className)}
        {...props}
      >
        <Icon className={cn("mt-0.5 h-4.5 w-4.5 shrink-0", INK[tone])} strokeWidth={2} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1">
              {title ? <p className="font-semibold text-strong">{title}</p> : null}
              {children ? <div className={cn(title && "mt-0.5")}>{children}</div> : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
          {meta && meta.length > 0 ? (
            <InfoChipRow className="mt-2">
              {meta.map((m) => (
                <InfoChip key={m.label} size="sm">
                  <span className="text-muted">{m.label}</span> <span className="font-semibold">{m.value}</span>
                </InfoChip>
              ))}
            </InfoChipRow>
          ) : null}
        </div>
      </div>
    );
  },
);
Alert.displayName = "Alert";
