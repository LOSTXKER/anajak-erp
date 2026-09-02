"use client";

/**
 * ชิ้นส่วนที่ทั้งสามทางใช้ร่วมกัน — เขียนเองเฉพาะ "แถบเส้นทางงาน" กับ "การ์ดใบงานบนจอทัช"
 * เพราะเป็นของที่กำลังเทียบ · ปุ่ม ป้าย รูปย่อ หัวหน้า ใช้ component ตัวจริงจาก src/components
 */

import { AlertTriangle, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { cn } from "@/lib/utils";
import { BigMockup, DueBadge, DueText } from "../_kit/pieces";
import { formatQty } from "../_kit/demo-jobs";
import { STEP_TONE, type ProductionJob, type RouteStep } from "./_data";

/** แถบเส้นทางงานแบ่งช่วง — สูตรสีเดียวกับคอลัมน์ "เส้นทางงาน" แบบ C ที่ลงของจริงไปแล้ว */
export function RouteBar({
  route,
  size = "sm",
  className,
}: {
  route: RouteStep[];
  size?: "sm" | "lg";
  className?: string;
}) {
  const done = route.filter((step) => step.state === "done").length;
  return (
    <div className={cn("min-w-0", className)}>
      <div className={cn("flex gap-0.5", size === "lg" ? "h-2.5" : "h-1.5")}>
        {route.map((step, index) => (
          <span
            key={`${step.key}-${index}`}
            title={`${step.label} · ${STEP_TONE[step.state].label}`}
            className={cn(
              "flex-1 rounded-sm",
              STEP_TONE[step.state].bar,
              step.key === "outsource" && "bg-[repeating-linear-gradient(45deg,transparent_0_3px,rgba(255,255,255,0.45)_3px_5px)]",
            )}
          />
        ))}
      </div>
      <p className={cn("mt-1 tabular-nums text-muted", size === "lg" ? "text-xs" : "text-2xs")}>
        {done}/{route.length} ช่วง
      </p>
    </div>
  );
}

/** บรรทัด "ตอนนี้อยู่ที่" — ขั้นปัจจุบัน + ร้านนอก (ถ้ามี) อ่านจบในบรรทัดเดียว */
export function WhereNow({ job, className }: { job: ProductionJob; className?: string }) {
  const step = job.current;
  const tone = STEP_TONE[step.state];
  return (
    <div className={cn("min-w-0 text-xs", className)}>
      <p className="flex min-w-0 items-center gap-1.5">
        <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", tone.bar)} />
        <span className="truncate font-medium text-strong">
          {step.key === "outsource" ? "อยู่ร้านนอก" : step.label}
        </span>
        <span className="shrink-0 text-muted">· {tone.label}</span>
      </p>
      {job.outsource ? (
        <p
          className={cn(
            "mt-0.5 flex min-w-0 items-center gap-1 truncate",
            job.outsource.backInDays < 0 ? "font-medium text-red-700 dark:text-red-300" : "text-secondary",
          )}
        >
          <Truck className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {job.outsource.vendor} · {job.outsource.work} ·{" "}
            {job.outsource.backInDays < 0
              ? `เลยนัดรับ ${Math.abs(job.outsource.backInDays)} วัน (${job.outsource.backLabel})`
              : job.outsource.backInDays === 0
                ? "นัดรับวันนี้"
                : `กลับ ${job.outsource.backLabel}`}
          </span>
        </p>
      ) : null}
      {job.problem ? (
        <p className="mt-0.5 flex min-w-0 items-start gap-1 text-red-700 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="line-clamp-2">{job.problem}</span>
        </p>
      ) : null}
    </div>
  );
}

/** แถวใบงานบนคอม — รูปย่อตัวจริงของระบบ + เลขใบ + ลูกค้า + จำนวน */
export function JobCell({ job }: { job: ProductionJob }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <MockupThumbnail cover={job.mockup} alt={`ม็อกอัพ ${job.orderNumber}`} size="md" />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold tabular-nums text-strong">{job.orderNumber}</span>
          {job.urgent ? (
            <Badge variant="destructive" size="sm">
              ด่วน
            </Badge>
          ) : null}
          <DueBadge job={job} />
        </p>
        <p className="truncate text-xs text-secondary">{job.company}</p>
        <p className="truncate text-2xs text-muted">
          {job.title} · {formatQty(job.qty)} ตัว
        </p>
      </div>
    </div>
  );
}

/**
 * การ์ดใบงานบนจอทัชหน้างาน — ทุกทางใช้การ์ดเดียวกันเมื่อเปิด "โหมดหน้างาน"
 * เป้ากด 56px · หนึ่งใบ = หนึ่งปุ่ม · ไม่มีเงินโดยโครงสร้าง
 */
export function TouchJobCard({
  job,
  action,
  compact = false,
}: {
  job: ProductionJob;
  action: string;
  compact?: boolean;
}) {
  const blocked = job.current.state === "blocked" || job.current.state === "waiting";
  return (
    <li
      className={cn(
        "card-surface rounded-2xl p-4",
        job.problem && "ring-1 ring-inset ring-red-600/40 dark:ring-red-400/40",
      )}
    >
      <div className={cn("flex gap-4", compact ? "items-center" : "items-start")}>
        <BigMockup
          src={job.mockup}
          alt={`ม็อกอัพ ${job.orderNumber}`}
          className={compact ? "h-16 w-16 shrink-0" : "h-24 w-24 shrink-0"}
        />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold tabular-nums text-strong">{job.orderNumber}</span>
            {job.urgent ? <Badge variant="destructive">ด่วน</Badge> : null}
            <DueBadge job={job} />
          </p>
          <p className="truncate text-sm text-secondary">{job.company}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-strong">
            {formatQty(job.qty)} <span className="text-sm font-normal text-muted">ตัว</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            ส่ง: <DueText job={job} />
          </p>
          <WhereNow job={job} className="mt-2" />
          {job.note ? (
            <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {job.note}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {blocked ? (
          <Button variant="outline" className="h-14 flex-1 text-base" disabled>
            {job.current.state === "waiting" ? "รอของกลับจากร้านนอก" : "ติดปัญหา — รอหัวหน้าแก้"}
          </Button>
        ) : (
          <Button className="h-14 flex-1 text-base">{action}</Button>
        )}
        <Button variant="outline" className="h-14 px-5 text-base">
          แจ้งปัญหา
        </Button>
      </div>
    </li>
  );
}

/** ปุ่มเดียวต่อแถว (บนคอม) — ตามกติกา "หนึ่งหน้า primary action เดียว" */
export function RowAction({ job, action }: { job: ProductionJob; action: string }) {
  // ใบที่อยู่ร้านนอก: ปุ่มคือเรื่องร้าน (รับของกลับ/ตามร้าน) แม้จะเลยนัดรับก็ไม่ใช่ "จัดการปัญหา"
  if (job.current.key === "outsource" || job.current.state === "waiting") {
    const due = job.outsource && job.outsource.backInDays <= 0;
    return (
      <Button variant={due ? "default" : "outline"} size="sm" className="w-full sm:w-auto">
        <Truck /> {due ? "รับของกลับ" : "ตามร้าน"}
      </Button>
    );
  }
  if (job.current.state === "blocked") {
    return (
      <Button variant="destructive" size="sm" className="w-full sm:w-auto">
        จัดการปัญหา
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" className="w-full sm:w-auto">
      {action}
    </Button>
  );
}
