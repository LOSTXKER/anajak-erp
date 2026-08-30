"use client";

/**
 * C · รายการ + แผงข้าง — ซ้ายไล่งาน ขวาลงมือ ไม่ต้องเปิด-ถอยหน้า
 *
 * วิธีคิด: เคลียร์งานรวดเดียวให้เร็วที่สุด — หนึ่งคลิกต่อหนึ่งใบ
 * ออเดอร์กับการผลิตเป็นหน้าเดียวกัน ต่างกันแค่ "มุมที่มอง" ซึ่งอยู่ในชิปด้านบน
 */

import { useState } from "react";
import { AlertTriangle, ArrowRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { FilterChip } from "@/components/ui/filter-chip";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { FOCUS_BUTTON, TINT } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import {
  PROTO_TODAY_LABEL,
  STAGES,
  STAGE_LABEL,
  byUrgency,
  formatAmount,
  formatQty,
  type ProtoJob,
} from "../../_kit/demo-jobs";
import { BigMockup, DueBadge, DueText, JobNote, NextAction, Progress } from "../../_kit/pieces";

/** มุมมองที่กรองจริง — ชิปที่กดแล้วไม่เกิดอะไรคือชิปโกหก จึงต่อตัวกรองให้ครบ */
const LENSES: { label: string; match: (job: ProtoJob) => boolean }[] = [
  {
    label: "ต้องจัดการก่อน",
    match: (job) => Boolean(job.problem) || job.urgent || (job.dueInDays ?? 99) <= 0,
  },
  {
    label: "งานผลิต",
    match: (job) => ["prep", "dtf", "outsource", "qc"].includes(job.stage),
  },
  { label: "รอลูกค้า", match: (job) => job.next.owner.includes("ลูกค้า") },
  {
    label: "รอเก็บเงิน",
    match: (job) => Boolean(job.payment?.includes("รอมัดจำ") || job.payment?.includes("ค้างชำระ")),
  },
  { label: "ทั้งหมด", match: () => true },
];

function ListRow({
  job,
  selected,
  onSelect,
}: {
  job: ProtoJob;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left transition-colors",
          FOCUS_BUTTON,
          selected
            ? "bg-interactive-selected text-interactive-selected-text"
            : "hover:bg-interactive-hover",
        )}
      >
        <MockupThumbnail cover={job.mockup} alt={`ม็อกอัพของ ${job.orderNumber}`} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-semibold tabular-nums text-strong">
              {job.orderNumber}
            </span>
            {job.problem ? (
              <AlertTriangle
                className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400"
                aria-label="ติดปัญหา"
              />
            ) : null}
          </span>
          <span className="block truncate text-xs text-secondary">{job.contact}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-2xs">
            <DueBadge job={job} />
            <span className="truncate text-muted">{STAGE_LABEL[job.stage]}</span>
          </span>
        </span>
      </button>
    </li>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-2xs text-muted">{label}</p>
      <p className="mt-0.5 text-sm text-strong">{value}</p>
    </div>
  );
}

function StageRail({ job }: { job: ProtoJob }) {
  const currentIndex = STAGES.findIndex((stage) => stage.key === job.stage);
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {STAGES.map((stage, index) => {
        const done = index < currentIndex;
        const now = index === currentIndex;
        return (
          <li key={stage.key} className="flex items-center gap-1">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-2xs",
                now && "bg-blue-600 font-medium text-white",
                done && "text-secondary",
                !now && !done && "text-muted",
              )}
            >
              {stage.label}
            </span>
            {index < STAGES.length - 1 ? (
              <span aria-hidden="true" className="h-px w-2 bg-divider" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function DetailPane({ job }: { job: ProtoJob }) {
  return (
    <div className="card-surface rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="text-lg font-semibold tabular-nums text-strong">
              {job.orderNumber}
            </span>
            {job.urgent ? (
              <Badge variant="destructive" size="sm">
                ด่วน
              </Badge>
            ) : null}
            <Badge size="sm">{job.statusLabel}</Badge>
          </p>
          <p className="mt-0.5 text-sm text-secondary">
            {job.contact} · {job.company}
          </p>
          <p className="text-sm text-muted">{job.title}</p>
        </div>
        <Button variant="outline" size="sm">
          เปิดใบงานเต็ม
          <ExternalLink />
        </Button>
      </div>

      {job.problem ? (
        <div
          className={cn(
            TINT.error,
            "mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
          )}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{job.problem}</span>
        </div>
      ) : null}
      {job.note ? <JobNote note={job.note} /> : null}

      <div className="mt-4 flex flex-wrap gap-4">
        <BigMockup
          src={job.mockup}
          alt={`ม็อกอัพของ ${job.orderNumber}`}
          className="h-36 w-44 shrink-0"
        />
        <div className="min-w-56 flex-1 rounded-xl bg-surface-muted p-4">
          <p className="text-2xs font-medium uppercase tracking-wide text-muted">งานถัดไป</p>
          <div className="mt-1.5">
            <NextAction job={job} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm">
              ลงมือทำ
              <ArrowRight />
            </Button>
            <Button size="sm" variant="outline">
              มอบหมายต่อ
            </Button>
            <Button size="sm" variant="ghost">
              พักงานไว้ก่อน
            </Button>
          </div>
          <div className="mt-4">
            <Progress done={job.progress.done} total={job.progress.total} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-divider pt-4 sm:grid-cols-3">
        <Fact label="จำนวน" value={`${formatQty(job.qty)} ตัว`} />
        <Fact label="กำหนดส่ง" value={<DueText job={job} />} />
        <Fact label="ยอดรวม" value={formatAmount(job.amount)} />
        <Fact label="การชำระ" value={job.payment ?? "—"} />
        <Fact label="ช่องทางที่รับงาน" value={job.channel} />
        <Fact label="ประเภทงาน" value={job.orderType} />
      </div>

      <div className="mt-4 border-t border-divider pt-4">
        <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-muted">
          เดินถึงช่วงไหนแล้ว
        </p>
        <StageRail job={job} />
      </div>
    </div>
  );
}

export function PaneVariant({
  jobs,
  device,
}: {
  jobs: ProtoJob[];
  device: "desktop" | "mobile";
}) {
  const [lensIndex, setLensIndex] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const sorted = jobs.filter(LENSES[lensIndex].match).sort(byUrgency);
  // ยังไม่เคยเลือกเอง หรือใบที่เลือกหลุดจากตัวกรอง → กลับไปใบบนสุดของมุมนี้
  const selected = sorted.find((job) => job.id === selectedId) ?? sorted[0];

  const list = (
    <div className="card-surface flex flex-col rounded-2xl p-2">
      <div className="px-1 pb-2">
        <SearchInput surface="raised" placeholder="ค้นหา" containerClassName="w-full" readOnly />
      </div>
      {sorted.length === 0 ? (
        <p className="px-2 py-6 text-center text-xs text-muted">ไม่มีงานในมุมนี้</p>
      ) : null}
      <ul className="space-y-0.5 overflow-y-auto">
        {sorted.map((job) => (
          <ListRow
            key={job.id}
            job={job}
            selected={device === "desktop" && job.id === selected?.id}
            onSelect={() => setSelectedId(job.id)}
          />
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-strong">โต๊ะทำงาน</h3>
          <p className="text-xs text-muted">
            วันนี้ {PROTO_TODAY_LABEL} · {jobs.length} ใบเดินอยู่
          </p>
        </div>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {LENSES.map((lens, index) => (
          <FilterChip
            key={lens.label}
            selected={index === lensIndex}
            onClick={() => setLensIndex(index)}
            className="shrink-0"
          >
            {lens.label}
            <span className="tabular-nums text-muted">{jobs.filter(lens.match).length}</span>
          </FilterChip>
        ))}
      </div>

      {device === "desktop" ? (
        <div className="grid grid-cols-[minmax(0,280px)_minmax(0,1fr)] items-start gap-4">
          {list}
          {selected ? <DetailPane job={selected} /> : null}
        </div>
      ) : (
        <>
          {list}
          <p className="text-2xs text-muted">
            บนมือถือวางแผงข้างคู่กันไม่ได้ — แตะแล้วต้องเปิดเป็นหน้าเต็มเหมือนเดิม
            (ความเร็ว &ldquo;คลิกเดียวต่อใบ&rdquo; ได้เฉพาะบนคอม)
          </p>
        </>
      )}
    </div>
  );
}
