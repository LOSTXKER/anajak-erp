"use client";

/**
 * ชิ้นส่วนที่ทุกทางในหน้าลองใช้ร่วมกัน — เขียนขึ้นเฉพาะส่วนที่ "กำลังเทียบ"
 * ของที่ไม่ได้เปลี่ยน (ปุ่ม · ป้าย · ตาราง · ช่องค้นหา · รูปย่อม็อกอัพ) import ตัวจริงจาก
 * src/components/ui ทั้งหมด ไม่วาดใหม่
 */

import { AlertTriangle, ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RADIUS, DASHED } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { dueText, formatQty, type ProtoJob } from "./demo-jobs";

/** ป้ายกำหนดส่ง — สูตรเดียวกับหน้าผลิตจริง (เลยกำหนด / ส่งวันนี้ / ใกล้กำหนด) */
export function DueBadge({ job }: { job: ProtoJob }) {
  if (job.dueInDays === null) return null;
  if (job.dueInDays < 0) return <Badge variant="destructive" size="sm">เลยกำหนด</Badge>;
  if (job.dueInDays === 0) return <Badge variant="warning" size="sm">ส่งวันนี้</Badge>;
  if (job.dueInDays === 1) return <Badge variant="warning" size="sm">ใกล้กำหนด</Badge>;
  return null;
}

export function DueText({ job, className }: { job: ProtoJob; className?: string }) {
  return (
    <span
      className={cn(
        "tabular-nums",
        job.dueInDays !== null && job.dueInDays < 0 && "font-medium text-red-700 dark:text-red-300",
        job.dueInDays === null && "text-muted",
        className,
      )}
    >
      {dueText(job)}
    </span>
  );
}

/**
 * รูปม็อกอัพขนาดใหญ่กว่าที่ระบบมีตอนนี้ (MockupThumbnail สูงสุด 80px)
 * — ขนาดคือสิ่งที่กำลังเทียบในทาง B จึงเขียนเอง แต่ใช้กรอบ/มุม/สถานะว่างชุดเดียวกัน
 */
export function BigMockup({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-surface-muted text-muted",
          DASHED,
          RADIUS.inner,
          className,
        )}
      >
        <span className="flex flex-col items-center gap-1 text-2xs">
          <ImageOff className="h-4 w-4" aria-hidden="true" />
          ยังไม่มีม็อกอัพ
        </span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "overflow-hidden border border-border bg-surface-muted",
        RADIUS.inner,
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- หน้าลองใช้ไฟล์ตัวอย่างใน /public ตรง ๆ */}
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}

/** บรรทัด "ต้องทำต่อ" — หัวใจของทุกทางที่เสนอ (ปัจจุบันมีเฉพาะหน้าผลิต) */
export function NextAction({
  job,
  size = "md",
}: {
  job: ProtoJob;
  size?: "sm" | "md";
}) {
  const tone =
    job.next.tone === "red"
      ? "text-red-700 dark:text-red-300"
      : job.next.tone === "amber"
        ? "text-amber-700 dark:text-amber-300"
        : "text-strong";
  return (
    <div className="min-w-0">
      <p
        className={cn(
          "flex min-w-0 items-start gap-1.5 font-medium",
          size === "sm" ? "text-xs" : "text-sm",
          tone,
        )}
      >
        {job.next.tone === "red" ? (
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : null}
        <span className="line-clamp-2">{job.next.label}</span>
      </p>
      <p className={cn("mt-0.5 truncate text-muted", size === "sm" ? "text-2xs" : "text-xs")}>
        ผู้รับผิดชอบ: <span className="text-secondary">{job.next.owner}</span>
      </p>
    </div>
  );
}

/** แถบความคืบหน้า — คัดลอกสูตรจาก production-control-worklist ตัวจริง */
export function Progress({ done, total }: { done: number; total: number }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="min-w-24">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="tabular-nums">
          {done}/{total} ช่วง
        </span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`ผ่านแล้ว ${done} จาก ${total} ช่วง`}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className="h-full rounded-full bg-blue-600 transition-[width] duration-[var(--duration-base)] ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function JobIdentity({
  job,
  showTitle = true,
}: {
  job: ProtoJob;
  showTitle?: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-col justify-center">
      <span className="flex items-center gap-1.5 font-semibold tabular-nums text-strong">
        {job.orderNumber}
        {job.urgent ? (
          <Badge variant="destructive" size="sm">
            ด่วน
          </Badge>
        ) : null}
      </span>
      <span className="truncate text-xs text-secondary">
        {job.contact} · {job.company}
      </span>
      {showTitle ? (
        <span className="truncate text-xs text-muted">
          {job.title} · {formatQty(job.qty)} ตัว
        </span>
      ) : null}
    </span>
  );
}

/** แถบเหตุการณ์ที่ต้องเห็นแม้ไม่ได้เปิดเข้าไป (blind ship / ห้ามพับ) */
export function JobNote({ note }: { note: string }) {
  return (
    <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-2xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      {note}
    </p>
  );
}
