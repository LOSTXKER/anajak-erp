"use client";

/**
 * A · โต๊ะงานหัวหน้า — หน้าเดียว ตัวเลขใหญ่ 4 ช่องคือตัวกรอง แล้วรายการเรียงตาม "ต้องทำอะไรต่อ"
 *
 * วิธีคิด: โมดูลผลิตคือ "โต๊ะ" ที่วางงานทั้งหมดไว้ตรงหน้า — ไม่มีหน้าย่อย ไม่มีทางเข้าที่สอง
 * รอบพิมพ์/คลังฟิล์ม/ร้านนอกไม่ใช่หน้า แต่เป็น "กอง" บนโต๊ะเดียวกัน
 * โหมดหน้างาน = โต๊ะเดียวกันแต่ย่อเหลือสถานีของฉันและปุ่มใหญ่
 */

import { useState } from "react";
import { AlertTriangle, CalendarClock, Factory, PackageCheck, Plus, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";

import {
  STATIONS,
  STATION_LABEL,
  stationCounts,
  summarize,
  type ProductionJob,
  type StationKey,
} from "../_data";
import { JobTable, TouchJobCard } from "../_pieces";

type Lens = "all" | "late" | "blocked" | "outsource" | "ready";

const TILES: {
  key: Lens;
  label: string;
  icon: LucideIcon;
  tone: "danger" | "warning" | "default" | "success";
  hint: string;
}[] = [
  { key: "late", label: "เลยกำหนดส่ง", icon: CalendarClock, tone: "danger", hint: "ลูกค้ารออยู่" },
  { key: "blocked", label: "ติดปัญหา", icon: AlertTriangle, tone: "danger", hint: "รอหัวหน้าตัดสิน" },
  { key: "outsource", label: "ของร้านนอกครบกำหนด", icon: Truck, tone: "warning", hint: "ต้องตาม/รับกลับ" },
  { key: "ready", label: "พร้อมส่ง", icon: PackageCheck, tone: "success", hint: "แพ็กเสร็จแล้ว" },
];

const TILE_TEXT = {
  danger: "text-red-600 dark:text-red-400",
  warning: "text-amber-700 dark:text-amber-400",
  success: "text-green-600 dark:text-green-400",
  default: "text-strong",
} as const;

function lensJobs(jobs: ProductionJob[], lens: Lens) {
  switch (lens) {
    case "late":
      return jobs.filter((job) => (job.dueInDays ?? 99) < 0);
    case "blocked":
      return jobs.filter((job) => job.problem);
    case "outsource":
      return jobs.filter((job) => job.outsource && job.outsource.backInDays <= 0);
    case "ready":
      return jobs.filter((job) => job.stage === "ship");
    default:
      return jobs;
  }
}

/** กองบนโต๊ะ — เรียงตามความรีบ ไม่ใช่ตามสถานะออเดอร์ */
const PILES: { key: string; label: string; pick: (job: ProductionJob) => boolean }[] = [
  { key: "blocked", label: "ติดปัญหา — ต้องตัดสินก่อน", pick: (job) => Boolean(job.problem) },
  {
    key: "outsource-due",
    label: "ของร้านนอกครบกำหนดรับ",
    pick: (job) => Boolean(job.outsource && job.outsource.backInDays <= 0),
  },
  { key: "doing", label: "ลงมือได้ตอนนี้ในโรงงาน", pick: (job) => job.station !== null && job.stage !== "ship" },
  { key: "waiting", label: "รอของกลับจากร้านนอก", pick: (job) => job.station === null },
  { key: "ready", label: "พร้อมส่ง", pick: (job) => job.stage === "ship" },
];

function pileJobs(jobs: ProductionJob[]) {
  const seen = new Set<string>();
  return PILES.map((pile) => {
    const items = jobs
      .filter((job) => !seen.has(job.id) && pile.pick(job))
      .sort((a, b) => (a.dueInDays ?? 99) - (b.dueInDays ?? 99));
    items.forEach((job) => seen.add(job.id));
    return { ...pile, items };
  }).filter((pile) => pile.items.length > 0);
}

export function DeskVariant({
  jobs,
  station,
  awaiting,
}: {
  jobs: ProductionJob[];
  station: boolean;
  awaiting: number;
}) {
  const [lens, setLens] = useState<Lens>("all");
  const summary = summarize(jobs);
  const counts: Record<Lens, number> = {
    all: jobs.length,
    late: summary.late,
    blocked: summary.blocked,
    outsource: summary.outsourceDue,
    ready: summary.ready,
  };

  if (station) return <DeskStation jobs={jobs} />;

  const visible = lensJobs(jobs, lens);
  const piles = pileJobs(visible);

  return (
    <div className="space-y-6">
      <PageHeader
        title="การผลิต"
        icon={Factory}
        tone="production"
        description={`งานในโรงงาน ${jobs.length} ใบ · รอเปิดใบผลิต ${awaiting} ใบ`}
        action={
          <Button>
            <Plus /> เปิดใบผลิต {awaiting > 0 ? `(${awaiting})` : ""}
          </Button>
        }
      />

      {/* ตัวเลขใหญ่ 4 ช่อง = ตัวกรอง — กดแล้วรายการข้างล่างเหลือแค่กองนั้น */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((tile) => {
          const on = lens === tile.key;
          const value = counts[tile.key];
          const Icon = tile.icon;
          return (
            <button
              key={tile.key}
              type="button"
              aria-pressed={on}
              onClick={() => setLens(on ? "all" : tile.key)}
              className={cn(
                "card-surface card-surface-hover rounded-2xl p-4 text-left transition-colors",
                on && "ring-2 ring-inset ring-blue-600 dark:ring-blue-400",
              )}
            >
              <p className="flex items-center gap-2 text-xs font-medium text-muted">
                <Icon className={cn("h-4 w-4", value > 0 ? TILE_TEXT[tile.tone] : "text-muted")} aria-hidden="true" />
                {tile.label}
              </p>
              <p
                className={cn(
                  "mt-1 text-3xl font-semibold tabular-nums",
                  value > 0 ? TILE_TEXT[tile.tone] : "text-muted",
                )}
              >
                {value}
              </p>
              <p className="mt-0.5 text-2xs text-muted">{value > 0 ? tile.hint : "ไม่มี"}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput placeholder="ค้นเลขออเดอร์ / ลูกค้า" surface="raised" containerClassName="w-full sm:w-72" readOnly />
        <div className="flex flex-wrap items-center gap-3 border-b border-divider">
          <FilterChip selected={lens === "all"} onClick={() => setLens("all")}>
            ทั้งหมด <span className="tabular-nums text-muted">{counts.all}</span>
          </FilterChip>
          {stationCounts(jobs).map((item) => (
            <FilterChip key={item.key} selected={false} onClick={() => setLens("all")}>
              {item.label} <span className="tabular-nums text-muted">{item.count}</span>
            </FilterChip>
          ))}
        </div>
      </div>

      <JobTable
        groups={piles.map((pile) => ({ key: pile.key, label: pile.label, items: pile.items }))}
        emptyLabel="ไม่มีงานในกองนี้ — กดตัวเลขข้างบนอีกครั้งเพื่อดูทั้งหมด"
      />
    </div>
  );
}

/** โหมดหน้างานของทาง A — โต๊ะเดียวกัน ย่อเหลือสถานีที่เลือกกับปุ่มใหญ่ */
function DeskStation({ jobs }: { jobs: ProductionJob[] }) {
  const counts = stationCounts(jobs);
  const [key, setKey] = useState<StationKey>(
    () => counts.slice().sort((a, b) => b.late - a.late || b.count - a.count)[0]!.key,
  );
  const mine = jobs
    .filter((job) => job.station === key)
    .sort((a, b) => Number(Boolean(b.problem)) - Number(Boolean(a.problem)) || (a.dueInDays ?? 99) - (b.dueInDays ?? 99));
  const station = STATIONS.find((s) => s.key === key)!;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {counts.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={item.key === key}
            onClick={() => setKey(item.key)}
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-left",
              item.key === key
                ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-600"
                : "card-surface card-surface-hover border-border",
            )}
          >
            <span className="text-2xl font-semibold tabular-nums">{item.count}</span>
            <span className="text-sm font-medium">
              {item.label}
              {item.late > 0 ? (
                <span className={cn("block text-2xs", item.key === key ? "text-white/80" : "text-red-600 dark:text-red-400")}>
                  เลยกำหนด {item.late}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
      <p className="text-sm text-secondary">
        สถานี<span className="font-medium text-strong">{STATION_LABEL[key]}</span> · {mine.length} ใบ · ปุ่มหลัก “{station.action}”
      </p>
      {mine.length === 0 ? (
        <div className="card-surface rounded-2xl">
          <EmptyState icon={PackageCheck} title={`ไม่มีงานที่${STATION_LABEL[key]}`} description="เลือกสถานีอื่นข้างบน" />
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {mine.map((job) => (
            <TouchJobCard key={job.id} job={job} action={station.action} />
          ))}
        </ul>
      )}
    </div>
  );
}
