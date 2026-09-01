"use client";

/* ============================================================
   เอาผังโรงงานมาเป็น "ตัวกรอง" ของหน้ารวมการผลิต (เบสเสนอเอง 2026-09-01)

   คำต่อคำ: *"ถ้าเอา A แต่ไปแทนส่วน filter เดิมเลยละ เอา A เป็น filter แทน
   ได้เห็นภาพรวม โครงสร้างโรงงานด้วย เพราะโจทย์แค่อยากให้เห็นโครงสร้างการผลิตของเราเฉยๆ"*

   → ได้สองอย่างในที่เดียว: กรองงาน + เห็นโครงสร้างโรงงาน โดยไม่เพิ่มพื้นที่ใหม่
   (ของเดิมคือแถบ 4 มุม "ทุกงาน · ศูนย์งาน · ปัญหา · งานร้านนอก" ซึ่งไม่บอกโครงสร้างอะไรเลย)

   ⚠️ สิ่งที่ต้องไม่หายไปจากของเดิม: มุมข้ามสาย (ทุกงาน · ปัญหา) ยังต้องกดได้
   เพราะเป็นคำถามคนละชนิดกับ "งานอยู่จุดไหน"
   ============================================================ */

import { useState } from "react";

import { DataTable } from "@/components/ui/data-table";
import { SegmentedControl } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import { AlertTriangle, Factory, ListFilter, Truck } from "lucide-react";

import { PROTO_BOARD, type ProtoJobRow } from "../production-list/_data";
import {
  ChevronCell,
  DeadlineText,
  JobIdentity,
  StatusCell,
  jobHref,
} from "../production-list/_ui";
import { NodeCard, stationIcon, stations } from "../factory-canvas/_variants";
import { SegmentedBar } from "../production-row/_variants";

/* --------------------------------------------------- ตารางงาน (แบบ C) */

function JobTable({ jobs }: { jobs: readonly ProtoJobRow[] }) {
  if (jobs.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted">
        ไม่มีงานในจุดที่เลือก — กดจุดเดิมซ้ำเพื่อดูทั้งหมด
      </p>
    );
  }
  return (
    <DataTable.Root bordered={false}>
      <DataTable.Head>
        <tr>
          <DataTable.Th>ออเดอร์</DataTable.Th>
          <DataTable.Th>สถานะ</DataTable.Th>
          <DataTable.Th>เส้นทางงาน</DataTable.Th>
          <DataTable.Th align="right" className="hidden lg:table-cell">จำนวน</DataTable.Th>
          <DataTable.Th>กำหนดส่ง</DataTable.Th>
          <DataTable.Th className="w-12"><span className="sr-only">เปิด</span></DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body>
        {jobs.map((job) => (
          <DataTable.Row key={job.key} href={jobHref(job)} className="h-[70px]">
            <DataTable.Td className="min-w-44"><JobIdentity job={job} /></DataTable.Td>
            <DataTable.Td className="min-w-40"><StatusCell job={job} /></DataTable.Td>
            <DataTable.Td className="w-40"><SegmentedBar job={job} /></DataTable.Td>
            <DataTable.Td align="right" className="hidden tabular-nums lg:table-cell">
              {(job.order.totalQuantity ?? 0).toLocaleString("th-TH")}
            </DataTable.Td>
            <DataTable.Td className="min-w-24"><DeadlineText job={job} /></DataTable.Td>
            <DataTable.Td className="text-muted"><ChevronCell /></DataTable.Td>
          </DataTable.Row>
        ))}
      </DataTable.Body>
    </DataTable.Root>
  );
}

function filterJobs(station: string | null) {
  if (!station) return PROTO_BOARD.jobs;
  if (station === "__attention__") {
    return PROTO_BOARD.jobs.filter(
      (job) =>
        job.overdue ||
        job.spots.some((spot) => spot.waitingOn.length > 0 || spot.step?.status === "FAILED"),
    );
  }
  return PROTO_BOARD.jobs.filter((job) => job.stationKeys.includes(station));
}

/* --------------------------------------------- ของจริงตอนนี้ (แถบ 4 มุม) */

const VIEWS = [
  { value: "all", label: "ทุกงาน" },
  { value: "centers", label: "ศูนย์งาน" },
  { value: "exceptions", label: "ปัญหา" },
  { value: "outsource", label: "งานร้านนอก" },
] as const;

export function CurrentFilter() {
  const [view, setView] = useState<(typeof VIEWS)[number]["value"]>("all");
  return (
    <div className="space-y-4">
      <SegmentedControl
        options={VIEWS.map((item) => ({ ...item }))}
        value={view}
        onChange={setView}
        aria-label="เลือกมุมมอง"
      />
      <div className="card-surface overflow-hidden rounded-2xl">
        <JobTable jobs={PROTO_BOARD.jobs} />
      </div>
    </div>
  );
}

/* ------------------------------------------- A1 · ผังเต็มเป็นตัวกรอง */

function CrossChip({
  label,
  count,
  active,
  onClick,
  danger = false,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "card-surface flex min-w-28 items-center gap-2 rounded-2xl p-3 text-left transition-shadow",
        active && "ring-2 ring-blue-600 dark:ring-blue-400",
      )}
    >
      {danger ? (
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-300" strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <ListFilter className="h-4 w-4 shrink-0 text-module-brand-text" strokeWidth={1.8} aria-hidden="true" />
      )}
      <span className="min-w-0">
        <span className="block text-xl font-semibold tabular-nums text-strong">{count}</span>
        <span className="block text-2xs text-secondary">{label}</span>
      </span>
    </button>
  );
}

function CanvasFilter({
  station,
  onSelect,
  compact = false,
}: {
  station: string | null;
  onSelect: (key: string | null) => void;
  compact?: boolean;
}) {
  const all = stations();
  const inHouse = all.filter((node) => !node.isOutsource);
  const outsource = all.filter((node) => node.isOutsource);
  const attention = filterJobs("__attention__").length;

  const nodeButton = (key: string, children: React.ReactNode) => (
    <button
      key={key}
      type="button"
      onClick={() => onSelect(station === key ? null : key)}
      aria-pressed={station === key}
      className={cn(
        "rounded-2xl text-left transition-shadow",
        station === key && "ring-2 ring-blue-600 dark:ring-blue-400",
      )}
    >
      {children}
    </button>
  );

  if (compact) {
    /* ผังย่อ — ไอคอน ชื่อ เลข อยู่บรรทัดเดียว ประหยัดความสูงก่อนถึงตาราง */
    const chip = (node: (typeof all)[number]) => (
      <button
        key={node.key}
        type="button"
        onClick={() => onSelect(station === node.key ? null : node.key)}
        aria-pressed={station === node.key}
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs transition-colors",
          station === node.key
            ? "border-blue-600 text-strong dark:border-blue-400"
            : "border-border text-secondary hover:text-strong",
          node.count === 0 && station !== node.key && "opacity-50",
        )}
      >
        {stationIcon(
          node.key,
          node.isOutsource,
          cn("h-3.5 w-3.5", node.isOutsource ? "text-secondary" : "text-module-production-text"),
        )}
        <span className="whitespace-nowrap">{node.label}</span>
        <span className="font-semibold tabular-nums">{node.count}</span>
        {node.overdue > 0 ? (
          <span className="font-semibold tabular-nums text-red-700 dark:text-red-300">
            เลย {node.overdue}
          </span>
        ) : null}
      </button>
    );

    return (
      <div className="space-y-2">
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
          <CrossChip
            label="ทุกงาน"
            count={PROTO_BOARD.jobs.length}
            active={station === null}
            onClick={() => onSelect(null)}
          />
          <CrossChip
            label="ต้องจัดการ"
            count={attention}
            active={station === "__attention__"}
            onClick={() => onSelect(station === "__attention__" ? null : "__attention__")}
            danger
          />
        </div>
        <div className="rounded-2xl border border-border p-2">
          <p className="mb-1.5 px-1 text-2xs font-medium uppercase tracking-wide text-module-production-text">
            ในโรงงาน
          </p>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">{inHouse.map(chip)}</div>
          <p className="mb-1.5 mt-2 flex items-center gap-1 px-1 text-2xs font-medium uppercase tracking-wide text-secondary">
            <Truck className="h-3 w-3" aria-hidden="true" />
            นอกโรงงาน
          </p>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">{outsource.map(chip)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <CrossChip
          label="ทุกงาน"
          count={PROTO_BOARD.jobs.length}
          active={station === null}
          onClick={() => onSelect(null)}
        />
        <CrossChip
          label="ต้องจัดการ"
          count={attention}
          active={station === "__attention__"}
          onClick={() => onSelect(station === "__attention__" ? null : "__attention__")}
          danger
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface-muted/40 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-module-production-text">
          <Factory className="h-3.5 w-3.5" aria-hidden="true" />
          ในโรงงาน
        </p>
        <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1">
          {inHouse.map((node, index) => (
            <div key={node.key} className="flex items-center">
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1 w-5 shrink-0 rounded-full",
                    node.count > 0 ? "bg-module-production-solid/50" : "bg-divider",
                  )}
                />
              ) : null}
              {nodeButton(node.key, <NodeCard node={node} />)}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-border p-3">
        <p className="mb-2 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-secondary">
          <Truck className="h-3.5 w-3.5" aria-hidden="true" />
          นอกโรงงาน
        </p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {outsource.map((node) => nodeButton(node.key, <NodeCard node={node} />))}
        </div>
      </div>
    </div>
  );
}

export function CanvasFullVariant() {
  const [station, setStation] = useState<string | null>(null);
  const jobs = filterJobs(station);
  return (
    <div className="space-y-4">
      <CanvasFilter station={station} onSelect={setStation} />
      <div className="card-surface overflow-hidden rounded-2xl">
        <JobTable jobs={jobs} />
      </div>
    </div>
  );
}

export function CanvasCompactVariant() {
  const [station, setStation] = useState<string | null>(null);
  const jobs = filterJobs(station);
  return (
    <div className="space-y-4">
      <CanvasFilter station={station} onSelect={setStation} compact />
      <div className="card-surface overflow-hidden rounded-2xl">
        <JobTable jobs={jobs} />
      </div>
    </div>
  );
}

export const FILTER_MODES = ["current", "canvas", "compact"] as const;
export type CanvasFilterVariant = (typeof FILTER_MODES)[number];
export const FILTER_COMPONENTS = {
  current: CurrentFilter,
  canvas: CanvasFullVariant,
  compact: CanvasCompactVariant,
} as const;
