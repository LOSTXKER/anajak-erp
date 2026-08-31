"use client";

/**
 * C · แถบเดียว — "ยกพื้นที่ทั้งหมดให้ตัวงาน แล้วให้รายการบอกเวลาแทนการ์ด"
 *
 * วิธีคิด: การ์ด 5 ใบกินความสูงประมาณ 180px ก่อนจะเห็นงานใบแรก · ย้ายตัวกรองไปเป็น
 * แถบเดียวในแถบเครื่องมือ (ใช้ FilterChip ตัวจริงของระบบ) แล้วเอาที่ที่ได้คืนมา
 * ไปให้ตาราง — พร้อมแบ่งหัวข้อตามกำหนดส่ง เพราะคำถามจริงของหน้านี้คือ "อะไรจะไม่ทัน"
 */

import type { ReactNode } from "react";
import Link from "next/link";

import { DataTable } from "@/components/ui/data-table";
import { FilterChip } from "@/components/ui/filter-chip";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import type { BoardBucketKey } from "@/lib/production-board";

import type { ProtoJobRow } from "../_data";
import {
  ChevronCell,
  DeadlineText,
  JobIdentity,
  LENSES,
  LENS_PRESENTATION,
  ProgressBar,
  StatusCell,
  WorklistEmpty,
  WorklistToolbar,
  jobHref,
  sortColumnProps,
  type WorklistState,
} from "../_ui";
import { ProtoFreshness } from "../_shell";

/* ------------------------------------------------------- แถบตัวกรอง (แถวเดียว) */

function FilterBar({ state }: { state: WorklistState }) {
  return (
    <div
      role="group"
      aria-label="กรองรายการงาน"
      className="-mx-1 flex items-center gap-4 overflow-x-auto border-b border-divider px-1"
    >
      {LENSES.map((item) => {
        const isOn = state.lens === item.key;
        const tone = LENS_PRESENTATION[item.key];
        const Icon = tone.icon;
        return (
          <FilterChip
            key={item.key}
            selected={isOn}
            onClick={() => state.setLens(isOn ? "all" : item.key)}
            icon={<Icon className={cn("h-4 w-4", tone.text)} strokeWidth={1.8} />}
          >
            <span className="whitespace-nowrap">{item.label}</span>
            <span
              className={cn(
                "ml-1 rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular-nums",
                tone.chip,
              )}
            >
              {state.counts[item.key]}
            </span>
          </FilterChip>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------- จัดกลุ่มตามกำหนดส่ง */

const BUCKET_ORDER: BoardBucketKey[] = [
  "late",
  "today",
  "tomorrow",
  "week",
  "later",
  "none",
];

const BUCKET_LABEL: Record<BoardBucketKey, string> = {
  late: "เลยกำหนดแล้ว",
  today: "ส่งวันนี้",
  tomorrow: "ส่งพรุ่งนี้",
  week: "ภายในสัปดาห์นี้",
  later: "หลังจากนั้น",
  none: "ยังไม่กำหนดส่ง",
};

const BUCKET_TONE: Record<BoardBucketKey, string> = {
  late: "text-red-700 dark:text-red-300",
  today: "text-amber-700 dark:text-amber-300",
  tomorrow: "text-amber-700 dark:text-amber-300",
  week: "text-secondary",
  later: "text-secondary",
  none: "text-muted",
};

function groupByBucket(jobs: readonly ProtoJobRow[]) {
  return BUCKET_ORDER.map(
    (bucket) => [bucket, jobs.filter((job) => job.bucket === bucket)] as const,
  ).filter(([, list]) => list.length > 0);
}

/* ------------------------------------------------------------------ ตาราง */

function DesktopRows({
  jobs,
  state,
}: {
  jobs: readonly ProtoJobRow[];
  state: WorklistState;
}) {
  const groups = groupByBucket(jobs);

  return (
    <DataTable.Root bordered={false}>
      <DataTable.Head>
        <tr>
          <DataTable.SortableTh {...sortColumnProps(state.sort, state.setSort, "orderNumber")}>
            ออเดอร์
          </DataTable.SortableTh>
          <DataTable.Th>สถานะ</DataTable.Th>
          <DataTable.SortableTh {...sortColumnProps(state.sort, state.setSort, "progress")}>
            ความคืบหน้า
          </DataTable.SortableTh>
          <DataTable.SortableTh
            {...sortColumnProps(state.sort, state.setSort, "totalQuantity")}
            className="hidden lg:table-cell"
            align="right"
          >
            จำนวน
          </DataTable.SortableTh>
          <DataTable.SortableTh {...sortColumnProps(state.sort, state.setSort, "deadline")}>
            กำหนดส่ง
          </DataTable.SortableTh>
          <DataTable.Th className="w-12">
            <span className="sr-only">เปิด</span>
          </DataTable.Th>
        </tr>
      </DataTable.Head>
      {groups.map(([bucket, list]) => (
        <DataTable.Body key={bucket}>
          <tr className="border-t border-divider bg-surface-muted/70">
            <th
              scope="colgroup"
              colSpan={6}
              className="px-6 py-1.5 text-left text-xs font-semibold"
            >
              <span className={BUCKET_TONE[bucket]}>{BUCKET_LABEL[bucket]}</span>
              <span className="ml-2 font-normal tabular-nums text-muted">
                {list.length} ใบ
              </span>
            </th>
          </tr>
          {list.map((job) => {
            return (
              <DataTable.Row key={job.key} href={jobHref(job)} className="h-[70px]">
                <DataTable.Td className="min-w-44">
                  <JobIdentity job={job} />
                </DataTable.Td>
                <DataTable.Td className="min-w-44">
                  <StatusCell job={job} />
                </DataTable.Td>
                <DataTable.Td className="w-32">
                  <ProgressBar rail={job.rail} />
                </DataTable.Td>
                <DataTable.Td className="hidden tabular-nums lg:table-cell" align="right">
                  {(job.order.totalQuantity ?? 0).toLocaleString("th-TH")}
                </DataTable.Td>
                <DataTable.Td className="min-w-24">
                  {/* หัวข้อกลุ่มบอกความเร่งแล้ว ในแถวจึงเหลือแค่วันที่ ไม่ต้องมีป้ายซ้ำ */}
                  <DeadlineText job={job} />
                </DataTable.Td>
                <DataTable.Td className="text-muted">
                  <ChevronCell />
                </DataTable.Td>
              </DataTable.Row>
            );
          })}
        </DataTable.Body>
      ))}
    </DataTable.Root>
  );
}

function MobileRows({ jobs }: { jobs: readonly ProtoJobRow[] }) {
  const groups = groupByBucket(jobs);

  return (
    <div className="space-y-4">
      {groups.map(([bucket, list]) => (
        <section key={bucket}>
          <p className="mb-1.5 flex items-center gap-2 px-1 text-xs font-semibold">
            <span className={BUCKET_TONE[bucket]}>{BUCKET_LABEL[bucket]}</span>
            <span className="font-normal tabular-nums text-muted">{list.length} ใบ</span>
          </p>
          <ul aria-label={BUCKET_LABEL[bucket]} className="space-y-2">
            {list.map((job) => (
                <li key={job.key}>
                  <Link
                    href={jobHref(job)}
                    className={cn(
                      FOCUS_BUTTON,
                      "card-surface card-surface-hover block min-h-11 rounded-2xl p-4",
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <JobIdentity job={job} size="md" asLink={false} />
                      <ChevronCell />
                    </span>
                    <span className="mt-3 block">
                      <StatusCell job={job} />
                    </span>
                    <span className="mt-3 grid grid-cols-[1fr_auto] items-end gap-4">
                      <ProgressBar rail={job.rail} />
                      <span className="text-right text-xs text-muted">
                        <span className="block">
                          <DeadlineText job={job} />
                        </span>
                        <span className="block tabular-nums">
                          {(job.order.totalQuantity ?? 0).toLocaleString("th-TH")} ตัว
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function BarVariant({
  state,
  filter,
}: {
  state: WorklistState;
  /** สลับเฉพาะ "แถบตัวกรอง" ได้ โดยตารางยังเป็นชุดเดียวกับที่ลงของจริงไปแล้ว —
   *  หน้าลอง /proto/production-filter ใช้ช่องนี้เทียบแถบกรองสี่แบบบนตารางเดียวกัน
   *  ไม่ส่งมา = แถบชิป 5 มุมเหมือนตอนที่เบสเคาะแบบ C (ภาพเดิมของหน้าลองนี้ไม่เปลี่ยน) */
  filter?: ReactNode;
}) {
  return (
    <div className="space-y-3 lg:space-y-0 lg:overflow-hidden lg:rounded-lg lg:border lg:border-border lg:bg-surface">
      <WorklistToolbar
        state={state}
        leading={filter === undefined ? <FilterBar state={state} /> : filter}
        freshness={<ProtoFreshness />}
        className="lg:border-b lg:border-divider lg:px-4 lg:py-3"
      />
      <ResponsiveList
        items={state.jobs}
        label="งานผลิต"
        emptyState={<WorklistEmpty lens={state.lens} />}
        renderDesktop={(items) => <DesktopRows jobs={items} state={state} />}
        renderMobile={(items) => <MobileRows jobs={items} />}
      />
    </div>
  );
}
