"use client";

/**
 * ชิ้นส่วนที่กำลังเทียบ = กล่องแจ้งเตือน (Alert) แบบใหม่ 2 ทาง — API เดียวกับ Alert เดิม + ช่อง `meta` (ใคร/เมื่อไร/ที่ไหน) + `action` (ปุ่ม)
 * เบสทัก 2026-09-03: "UI แจ้งเตือนดูโง่ไป และเป็นทั้งเว็บเลย ปัญหาเดิม" (ตัวหนังสือ 3 บรรทัดในกล่องสี ไม่มีลำดับ)
 * ของที่ไม่ได้เทียบ (ปุ่ม ชิป ไอคอน สี TINT) = ของจริง
 */

import type { LucideIcon } from "lucide-react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { TINT } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

export type AlertTone = keyof typeof TINT;

export type NoticeProps = {
  variant: AlertTone;
  icon?: LucideIcon;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** ข้อเท็จจริงประกอบ (ขั้น · คน · เวลา) — ชั้น 3 เป็นชิป ไม่ใช่บรรทัดตัวหนังสือ */
  meta?: readonly { label: string; value: string }[];
  action?: React.ReactNode;
  className?: string;
};

const DEFAULT_ICON: Record<AlertTone, LucideIcon> = {
  error: CircleAlert,
  warning: TriangleAlert,
  success: CircleCheck,
  info: Info,
  neutral: Info,
};

/* ───────────────────────── A · ตราไอคอน + ชั้นข้อความ ───────────────────────── */

const MARK: Record<AlertTone, string> = {
  error: "bg-red-600 text-white",
  warning: "bg-amber-500 text-white",
  success: "bg-green-600 text-white",
  info: "bg-blue-600 text-white",
  neutral: "bg-surface text-strong ring-1 ring-border",
};

/** ทุกกล่องมีตราไอคอนเสมอ (ไม่ต้องส่งเอง) · หัวเรื่องหนา · เนื้อความ · ชิปประกอบ · ปุ่มชิดขวา */
export function NoticeA({ variant, icon, title, children, meta, action, className }: NoticeProps) {
  const Icon = icon ?? DEFAULT_ICON[variant];
  return (
    <div role="alert" className={cn("flex gap-3 rounded-lg border p-4", TINT[variant], className)}>
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", MARK[variant])} aria-hidden="true">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 pt-1">
            {title ? <p className="font-semibold leading-snug">{title}</p> : null}
            {children ? <div className={cn("text-sm leading-relaxed", title && "mt-0.5")}>{children}</div> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {meta && meta.length > 0 ? (
          <InfoChipRow className="mt-2">
            {meta.map((m) => (
              <InfoChip key={m.label} size="sm">
                <span className="opacity-70">{m.label}</span> <span className="font-semibold">{m.value}</span>
              </InfoChip>
            ))}
          </InfoChipRow>
        ) : null}
      </div>
    </div>
  );
}

/* ───────────────────────── B · แถบสีข้าง พื้นเรียบ ───────────────────────── */

const BAR: Record<AlertTone, string> = {
  error: "bg-red-500",
  warning: "bg-amber-500",
  success: "bg-green-500",
  info: "bg-blue-600",
  neutral: "bg-border",
};
const INK: Record<AlertTone, string> = {
  error: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  success: "text-green-600 dark:text-green-400",
  info: "text-blue-600 dark:text-blue-400",
  neutral: "text-muted",
};

/** พื้นการ์ดปกติ สีบอกความหมายเหลือแค่แถบข้างกับไอคอน — หน้าไม่แดง/เหลืองทั้งก้อน */
export function NoticeB({ variant, icon, title, children, meta, action, className }: NoticeProps) {
  const Icon = icon ?? DEFAULT_ICON[variant];
  return (
    <div role="alert" className={cn("relative flex gap-3 overflow-hidden rounded-lg border border-border bg-surface py-4 pl-5 pr-4", className)}>
      <span className={cn("absolute inset-y-0 left-0 w-1", BAR[variant])} aria-hidden="true" />
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", INK[variant])} strokeWidth={2} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            {title ? <p className="font-semibold leading-snug text-strong">{title}</p> : null}
            {children ? <div className={cn("text-sm leading-relaxed text-secondary", title && "mt-0.5")}>{children}</div> : null}
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
}
