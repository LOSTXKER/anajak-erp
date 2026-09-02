"use client";

/**
 * C · ตารางเวลา — ทุกใบวางบนแกนวัน เห็นทีเดียวว่าแต่ละใบอยู่ขั้นไหน วันไหนต้องถึงขั้นไหน
 * และของที่ส่งร้านนอกจะกลับวันไหน (ช่วงลายเฉียง + รถ)
 *
 * วิธีคิด: คำถามของหัวหน้าคือ "ทันไหม" ไม่ใช่ "อยู่สถานะอะไร" — แกนเวลาตอบตรงกว่าสถานะ
 * ข้อแลกใหญ่: ของจริงยังไม่มี "วันแผนต่อขั้น" (ต้องเพิ่ม) · หน้าลองคำนวณถอยหลังจากกำหนดส่ง
 */

import { useState } from "react";
import { Factory, PackageCheck, Plus, Truck } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { cn } from "@/lib/utils";

import { PROTO_TODAY_LABEL } from "../../_kit/demo-jobs";
import {
  STATIONS,
  STEP_TONE,
  stationCounts,
  type ProductionJob,
  type RouteStep,
  type StationKey,
} from "../_data";
import { JobCell, TouchJobCard, WhereNow } from "../_pieces";

/** แกนวัน: 2 วันที่ผ่านมา → อีก 7 วัน (สัปดาห์ทำงาน) */
const DAY_OFFSETS = [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7] as const;
const DAY_LABELS = ["28 ส.ค.", "29", "วันนี้", "31", "1 ก.ย.", "2", "3", "4", "5", "6"];

function clamp(value: number) {
  return Math.min(DAY_OFFSETS[DAY_OFFSETS.length - 1]!, Math.max(DAY_OFFSETS[0]!, value));
}

function Segment({ step }: { step: RouteStep }) {
  const start = clamp(step.plan.start);
  const end = clamp(step.plan.end);
  const col = start - DAY_OFFSETS[0]! + 1;
  const span = Math.max(1, end - start + 1);
  const tone = STEP_TONE[step.state];
  const lateReturn = step.outsource && step.outsource.backInDays < 0 && step.state !== "done";
  return (
    <div
      title={`${step.label} · ${tone.label}`}
      style={{ gridColumn: `${col} / span ${span}` }}
      className={cn(
        "flex h-6 min-w-0 items-center gap-1 overflow-hidden rounded-md px-1.5 text-2xs font-medium",
        tone.bar,
        step.state === "todo" || step.state === "waiting" ? "text-secondary" : "text-white",
        step.key === "outsource" &&
          "border border-dashed border-current bg-[repeating-linear-gradient(45deg,transparent_0_4px,rgba(255,255,255,0.35)_4px_7px)]",
        lateReturn && "ring-2 ring-red-500",
      )}
    >
      {step.key === "outsource" ? <Truck className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
      <span className="truncate">
        {step.key === "outsource" && step.outsource
          ? `${step.outsource.vendor.split(" ")[0]} · กลับ ${step.outsource.backLabel}`
          : step.label}
      </span>
    </div>
  );
}

function ScheduleRow({ job }: { job: ProductionJob }) {
  return (
    <li className="grid gap-2 px-4 py-3 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-center">
      <div className="min-w-0">
        <JobCell job={job} />
        <WhereNow job={job} className="mt-1.5 lg:hidden" />
      </div>
      <div className="min-w-0 overflow-x-auto">
        <div
          className="relative grid min-w-[560px] gap-y-1"
          style={{ gridTemplateColumns: `repeat(${DAY_OFFSETS.length}, minmax(0, 1fr))` }}
        >
          {/* เส้น "วันนี้" */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-px bg-blue-600/60 dark:bg-blue-400/60"
            style={{ left: `calc(${(2 + 0.5) * (100 / DAY_OFFSETS.length)}% )` }}
          />
          {/* เส้นกำหนดส่ง */}
          {job.dueInDays !== null && job.dueInDays <= 7 ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-red-500/70"
              style={{ left: `calc(${(job.dueInDays - DAY_OFFSETS[0]! + 1) * (100 / DAY_OFFSETS.length)}% - 1px)` }}
            />
          ) : null}
          {/* แต่ละขั้นเป็นแถวของตัวเอง เพื่อให้ร้านนอกที่เดินขนานกับ DTF ซ้อนกันได้ */}
          {job.route.map((step, index) => (
            <div
              key={`${step.key}-${index}`}
              className="col-span-full grid"
              style={{ gridTemplateColumns: `repeat(${DAY_OFFSETS.length}, minmax(0, 1fr))` }}
            >
              <Segment step={step} />
            </div>
          ))}
        </div>
      </div>
    </li>
  );
}

export function ScheduleVariant({
  jobs,
  station,
  awaiting,
}: {
  jobs: ProductionJob[];
  station: boolean;
  awaiting: number;
}) {
  const [stepFilter, setStepFilter] = useState<StationKey | "outsource" | null>(null);
  const counts = stationCounts(jobs);
  const sorted = jobs
    .slice()
    .sort((a, b) => Number(Boolean(b.problem)) - Number(Boolean(a.problem)) || (a.dueInDays ?? 99) - (b.dueInDays ?? 99));
  const visible =
    stepFilter === null
      ? sorted
      : stepFilter === "outsource"
        ? sorted.filter((job) => job.outsource)
        : sorted.filter((job) => job.station === stepFilter);

  if (station) {
    const key = stepFilter && stepFilter !== "outsource" ? stepFilter : counts.slice().sort((a, b) => b.late - a.late || b.count - a.count)[0]!.key;
    const stationDef = STATIONS.find((s) => s.key === key)!;
    const mine = sorted.filter((job) => job.station === key);
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {counts.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={item.key === key}
              onClick={() => setStepFilter(item.key)}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-2xl border px-4",
                item.key === key
                  ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-600"
                  : "card-surface card-surface-hover border-border",
              )}
            >
              <span className="text-2xl font-semibold tabular-nums">{item.count}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </div>
        <p className="text-sm text-secondary">
          วันนี้ {PROTO_TODAY_LABEL} · สถานี<span className="font-medium text-strong">{stationDef.label}</span> เรียงตามวันที่ต้องเสร็จขั้นนี้
        </p>
        {mine.length === 0 ? (
          <div className="card-surface rounded-2xl">
            <EmptyState icon={PackageCheck} title={`ไม่มีงานที่${stationDef.label}`} />
          </div>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {mine.map((job) => (
              <TouchJobCard key={job.id} job={job} action={stationDef.action} compact />
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="การผลิต"
        icon={Factory}
        tone="production"
        description={`ตารางงานสัปดาห์นี้ · ${jobs.length} ใบ · รอเปิดใบผลิต ${awaiting} ใบ`}
        action={
          <Button>
            <Plus /> เปิดใบผลิต {awaiting > 0 ? `(${awaiting})` : ""}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 border-b border-divider">
        <FilterChip selected={stepFilter === null} onClick={() => setStepFilter(null)}>
          ทุกขั้น <span className="tabular-nums text-muted">{jobs.length}</span>
        </FilterChip>
        {counts.map((item) => (
          <FilterChip key={item.key} selected={stepFilter === item.key} onClick={() => setStepFilter(item.key)}>
            {item.label} <span className="tabular-nums text-muted">{item.count}</span>
            {item.late > 0 ? <span className="tabular-nums text-red-600 dark:text-red-400">· {item.late}</span> : null}
          </FilterChip>
        ))}
        <FilterChip
          selected={stepFilter === "outsource"}
          onClick={() => setStepFilter("outsource")}
          icon={<Truck className="h-4 w-4" />}
        >
          ร้านนอก <span className="tabular-nums text-muted">{jobs.filter((j) => j.outsource).length}</span>
        </FilterChip>
      </div>

      <section className="card-surface overflow-hidden rounded-2xl">
        {/* หัวแกนวัน */}
        <div className="hidden border-b border-divider bg-surface-muted px-4 py-2 lg:grid lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <p className="text-xs font-medium text-muted">ใบงาน · เรียงติดปัญหาก่อน แล้วตามกำหนดส่ง</p>
          <div
            className="grid min-w-[560px] text-center text-2xs text-muted"
            style={{ gridTemplateColumns: `repeat(${DAY_OFFSETS.length}, minmax(0, 1fr))` }}
          >
            {DAY_LABELS.map((label, index) => (
              <span
                key={label}
                className={cn(
                  "tabular-nums",
                  DAY_OFFSETS[index] === 0 && "font-semibold text-blue-700 dark:text-blue-300",
                  DAY_OFFSETS[index]! < 0 && "text-muted/70",
                )}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        {visible.length === 0 ? (
          <EmptyState icon={PackageCheck} title="ไม่มีงานในขั้นนี้" density="compact" />
        ) : (
          <ul className="divide-y divide-divider">
            {visible.map((job) => (
              <ScheduleRow key={job.id} job={job} />
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-muted">
        {(Object.keys(STEP_TONE) as (keyof typeof STEP_TONE)[]).map((state) => (
          <span key={state} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn("h-2.5 w-4 rounded-sm", STEP_TONE[state].bar)} />
            {STEP_TONE[state].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-4 rounded-sm border border-dashed border-current bg-[repeating-linear-gradient(45deg,transparent_0_3px,rgba(120,120,120,0.5)_3px_5px)]" />
          ร้านนอก (กรอบแดง = เลยนัดรับ)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-0.5 bg-red-500/70" /> กำหนดส่ง
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-px bg-blue-600/60" /> วันนี้
        </span>
      </div>
    </div>
  );
}
