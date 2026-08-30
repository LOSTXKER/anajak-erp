"use client";

/**
 * A · กองตามเวลา — หน้าเดียวรวมออเดอร์กับการผลิต แล้วจัดกองตาม "เหลือกี่วัน"
 *
 * วิธีคิด: โรงงานพลาดเรื่องเดียวที่แพงจริงคือ "ส่งไม่ทัน" — เวลาจึงเป็นตัวจัดลำดับ
 * ไม่ใช่สถานะ · ทุกแถวบอกงานถัดไป + คนรับผิดชอบ และมีปุ่มลงมือในแถวเลย
 */

import { ArrowRight, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { StatusLabel } from "@/components/ui/status-label";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { cn } from "@/lib/utils";
import {
  PROTO_TODAY_LABEL,
  STAGE_LABEL,
  TIME_GROUPS,
  byUrgency,
  formatQty,
  timeGroupOf,
  type ProtoJob,
  type StageKey,
} from "../../_kit/demo-jobs";
import { DueText, JobNote, NextAction, Progress } from "../../_kit/pieces";

/** ชื่อปุ่มลงมือแบบสั้น — ของจริงจะมาจาก lib/order-next-step.ts ที่มีอยู่แล้ว */
const CTA_BY_STAGE: Record<StageKey, string> = {
  intake: "เปิดใบงาน",
  design: "เปิดม็อกอัพ",
  prep: "เปิดใบผลิต",
  dtf: "บันทึกงานพิมพ์",
  outsource: "ตามร้านนอก",
  qc: "บันทึกผล QC",
  ship: "ทำใบส่งของ",
};

function ctaLabel(job: ProtoJob) {
  return job.problem ? "จัดการปัญหา" : CTA_BY_STAGE[job.stage];
}

function SummaryStrip({ jobs }: { jobs: ProtoJob[] }) {
  const late = jobs.filter((job) => (job.dueInDays ?? 99) < 0).length;
  const today = jobs.filter((job) => job.dueInDays === 0).length;
  const problems = jobs.filter((job) => job.problem).length;
  const noDue = jobs.filter((job) => job.dueInDays === null).length;

  const stats = [
    { label: "เลยกำหนด", value: late, tone: "text-red-700 dark:text-red-300" },
    { label: "ส่งวันนี้", value: today, tone: "text-amber-700 dark:text-amber-300" },
    { label: "ติดปัญหาค้าง", value: problems, tone: "text-red-700 dark:text-red-300" },
    { label: "ยังไม่กำหนดส่ง", value: noDue, tone: "text-secondary" },
    { label: "งานเดินอยู่ทั้งหมด", value: jobs.length, tone: "text-strong" },
  ];

  return (
    <div className="card-surface flex flex-wrap items-end gap-x-8 gap-y-3 rounded-2xl px-5 py-4">
      {stats.map((stat) => (
        <div key={stat.label}>
          <p className={cn("text-2xl font-semibold tabular-nums", stat.tone)}>{stat.value}</p>
          <p className="text-xs text-muted">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

function DesktopRow({ job }: { job: ProtoJob }) {
  return (
    <li
      className={cn(
        "card-surface card-surface-hover relative flex items-center gap-4 rounded-xl p-3 pl-4",
        job.problem && "ring-1 ring-inset ring-red-600/30 dark:ring-red-400/30",
      )}
    >
      {job.problem ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-3 left-0 w-1 rounded-full bg-red-600 dark:bg-red-400"
        />
      ) : null}

      <MockupThumbnail cover={job.mockup} alt={`ม็อกอัพของ ${job.orderNumber}`} size="lg" />

      <div className="min-w-56 flex-[2]">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="whitespace-nowrap font-semibold tabular-nums text-strong">
            {job.orderNumber}
          </span>
          {job.urgent ? (
            <Badge variant="destructive" size="sm">
              ด่วน
            </Badge>
          ) : null}
          <Badge size="sm">{STAGE_LABEL[job.stage]}</Badge>
        </p>
        <p className="mt-0.5 truncate text-sm text-secondary">
          {job.contact} · {job.company}
        </p>
        <p className="truncate text-xs text-muted">
          {job.title} · {formatQty(job.qty)} ตัว
        </p>
        {job.note ? <JobNote note={job.note} /> : null}
      </div>

      <div className="min-w-48 flex-[3]">
        <NextAction job={job} />
        {job.problem ? (
          <p className="mt-1 text-xs text-red-700 dark:text-red-300">{job.problem}</p>
        ) : null}
      </div>

      <div className="w-28 shrink-0">
        <Progress done={job.progress.done} total={job.progress.total} />
      </div>

      <div className="w-32 shrink-0 text-right text-xs">
        <DueText job={job} className="block" />
        <span className="mt-0.5 block text-muted">{job.statusLabel}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" variant={job.problem ? "default" : "outline"}>
          {ctaLabel(job)}
          <ArrowRight />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label={`เปิดออเดอร์ ${job.orderNumber}`}>
          <ChevronRight />
        </Button>
      </div>
    </li>
  );
}

function MobileRow({ job }: { job: ProtoJob }) {
  return (
    <li
      className={cn(
        "card-surface relative rounded-2xl p-4",
        job.problem && "ring-1 ring-inset ring-red-600/30 dark:ring-red-400/30",
      )}
    >
      <div className="flex items-start gap-3">
        <MockupThumbnail cover={job.mockup} alt={`ม็อกอัพของ ${job.orderNumber}`} size="md" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold tabular-nums text-strong">{job.orderNumber}</span>
            {job.urgent ? (
              <Badge variant="destructive" size="sm">
                ด่วน
              </Badge>
            ) : null}
          </p>
          <p className="truncate text-sm text-secondary">{job.contact}</p>
          <p className="truncate text-xs text-muted">
            {job.title} · {formatQty(job.qty)} ตัว
          </p>
        </div>
      </div>

      <div className="mt-3">
        <NextAction job={job} />
        {job.problem ? (
          <p className="mt-1 text-xs text-red-700 dark:text-red-300">{job.problem}</p>
        ) : null}
      </div>
      {job.note ? <JobNote note={job.note} /> : null}

      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <StatusLabel label={STAGE_LABEL[job.stage]} tone="accent" />
        <DueText job={job} />
      </div>

      <Button size="sm" className="mt-3 w-full" variant={job.problem ? "default" : "outline"}>
        {ctaLabel(job)}
        <ArrowRight />
      </Button>
    </li>
  );
}

export function TodayVariant({
  jobs,
  device,
}: {
  jobs: ProtoJob[];
  device: "desktop" | "mobile";
}) {
  const grouped = TIME_GROUPS.map((group) => ({
    ...group,
    items: jobs.filter((job) => timeGroupOf(job) === group.key).sort(byUrgency),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-strong">งานที่ต้องเดิน</h3>
          <p className="text-xs text-muted">วันนี้ {PROTO_TODAY_LABEL}</p>
        </div>
        <SearchInput
          surface="raised"
          placeholder="ค้นหาเลขออเดอร์ / ลูกค้า"
          containerClassName={device === "desktop" ? "w-72" : "w-full"}
          readOnly
        />
      </div>

      <SummaryStrip jobs={jobs} />

      {grouped.map((group) => (
        <section key={group.key}>
          <div className="mb-2 flex items-baseline gap-2 border-b border-divider pb-1.5">
            <h4
              className={cn(
                "text-sm font-semibold",
                group.key === "late"
                  ? "text-red-700 dark:text-red-300"
                  : group.key === "today"
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-strong",
              )}
            >
              {group.label}
            </h4>
            <span className="text-sm tabular-nums text-muted">{group.items.length}</span>
            {group.hint ? <span className="text-xs text-muted">· {group.hint}</span> : null}
          </div>
          <ul className="space-y-2">
            {group.items.map((job) =>
              device === "desktop" ? (
                <DesktopRow key={job.id} job={job} />
              ) : (
                <MobileRow key={job.id} job={job} />
              ),
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
