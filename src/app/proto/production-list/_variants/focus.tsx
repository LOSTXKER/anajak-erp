"use client";

/**
 * B · ชัด — "ตอบให้ไวว่าใบไหนต้องแตะก่อน แล้วมันค้างอยู่ช่วงไหน"
 *
 * วิธีคิด: ขนาดเท่าเดิม แต่จัดน้ำหนักใหม่ให้ความเร่งด่วนอ่านได้จากหางตา
 *  · การ์ดที่เลือกอยู่ = ย้อมพื้นทั้งใบ + ขีดสีบนหัว (ของเดิมเปลี่ยนแค่สีเส้นขอบ ซึ่งมองไม่เห็น)
 *  · การ์ดมีบรรทัดขยายว่า "ในกองนี้เลยกำหนดกี่ใบ" — ตัวเลขเดียวไม่พอตัดสินใจ
 *  · แถวมีแถบสีทางซ้าย (แดง = มีขั้นงานพัง · เหลือง = ติดรอของ) ตามสภาพงานจริง
 *  · เปลี่ยน "แท่งเปอร์เซ็นต์" เป็น "รางช่วงงาน" — % ของช่วงงานไม่บอกว่าค้างตรงไหน
 *    ข้อมูลชุดเดิม (job.rail) แต่ตอบคำถามที่หัวหน้าถามจริง
 */

import Link from "next/link";

import { DataTable } from "@/components/ui/data-table";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { FOCUS_BUTTON, RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

import type { ProtoJobRow } from "../_data";
import {
  ChevronCell,
  DeadlineBadge,
  DeadlineText,
  JobIdentity,
  LENSES,
  LENS_PRESENTATION,
  RailDots,
  StatusCell,
  WorklistEmpty,
  WorklistToolbar,
  jobHref,
  jobStatus,
  sortColumnProps,
  type WorklistState,
} from "../_ui";
import { ProtoFreshness } from "../_shell";

/* ------------------------------------------------------- การ์ดกรอง (ย้อมทั้งใบ) */

function FilterCards({ state }: { state: WorklistState }) {
  return (
    <section aria-label="กรองรายการงาน" className="grid grid-cols-2 gap-2 md:grid-cols-5">
      {LENSES.map((item) => {
        const isOn = state.lens === item.key;
        const tone = LENS_PRESENTATION[item.key];
        const Icon = tone.icon;
        const late = state.overdue[item.key];
        const caption =
          state.counts[item.key] === 0
            ? "ไม่มีงานในกองนี้"
            : late > 0
              ? `${late} ใบเลยกำหนด`
              : "ยังไม่มีใบเลยกำหนด";
        const label = `${item.label} · ${state.counts[item.key]} งาน · ${caption} · ${
          isOn ? "เลือกอยู่ · กดซ้ำเพื่อล้างตัวกรอง" : "กดเพื่อกรอง"
        }`;

        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={isOn}
            aria-label={label}
            title={label}
            onClick={() => state.setLens(isOn ? "all" : item.key)}
            className={cn(
              FOCUS_BUTTON,
              "card-surface card-surface-hover relative w-full overflow-hidden rounded-2xl p-4 pt-[15px] text-left",
              item.key === "all" && "col-span-2 md:col-span-1",
              isOn && cn(tone.fill, tone.border),
            )}
          >
            {/* ขีดสีบนหัว = "อันนี้แหละที่เลือกอยู่" มองเห็นจากหางตา ไม่ต้องเทียบเส้นขอบ */}
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-x-0 top-0 h-1",
                isOn ? tone.bar : "bg-transparent",
              )}
            />
            <span className="flex w-full items-start justify-between gap-3">
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-xs font-medium",
                    isOn ? tone.text : "text-muted",
                  )}
                >
                  {item.label}
                </span>
                <span
                  className={cn("mt-1 block text-2xl font-semibold tabular-nums", tone.text)}
                >
                  {state.counts[item.key]}
                </span>
                <span className="mt-0.5 block truncate text-2xs text-muted">{caption}</span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  RADIUS.item,
                  "flex h-9 w-9 shrink-0 items-center justify-center",
                  tone.chip,
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
            </span>
          </button>
        );
      })}
    </section>
  );
}

/* ------------------------------------------------------------------ ตาราง */

/** แถบสีทางซ้ายของแถว — เอาโทนมาจากสถานะเดียวกับที่คอลัมน์สถานะใช้ ไม่ได้คิดสูตรใหม่ */
function rowEdge(tone: ReturnType<typeof jobStatus>["tone"]) {
  return tone === "danger"
    ? "border-l-[3px] border-l-red-500 dark:border-l-red-400"
    : tone === "warning"
      ? "border-l-[3px] border-l-amber-500 dark:border-l-amber-400"
      : "border-l-[3px] border-l-transparent";
}

function DesktopRows({
  jobs,
  state,
}: {
  jobs: readonly ProtoJobRow[];
  state: WorklistState;
}) {
  return (
    <DataTable.Root bordered={false}>
      <DataTable.Head>
        <tr>
          <DataTable.SortableTh
            {...sortColumnProps(state.sort, state.setSort, "orderNumber")}
            className="pl-[21px]"
          >
            ออเดอร์
          </DataTable.SortableTh>
          <DataTable.Th>สถานะ</DataTable.Th>
          <DataTable.SortableTh {...sortColumnProps(state.sort, state.setSort, "progress")}>
            ช่วงงาน
          </DataTable.SortableTh>
          <DataTable.SortableTh
            {...sortColumnProps(state.sort, state.setSort, "totalQuantity")}
            className="hidden xl:table-cell"
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
      <DataTable.Body>
        {jobs.map((job) => {
          const status = jobStatus(job);
          return (
            <DataTable.Row key={job.key} href={jobHref(job)} className="h-[76px]">
              <DataTable.Td className={cn("min-w-44 pl-[21px]", rowEdge(status.tone))}>
                <JobIdentity job={job} />
              </DataTable.Td>
              <DataTable.Td className="min-w-40">
                {/* รางช่วงงานข้าง ๆ บอกตำแหน่งอยู่แล้ว ช่องนี้จึงไม่ต้องซ้ำว่าอยู่สายไหน */}
                <StatusCell job={job} showStation={false} />
              </DataTable.Td>
              <DataTable.Td className="w-40">
                <RailDots job={job} />
              </DataTable.Td>
              <DataTable.Td className="hidden tabular-nums xl:table-cell" align="right">
                {(job.order.totalQuantity ?? 0).toLocaleString("th-TH")}
              </DataTable.Td>
              <DataTable.Td className="min-w-28">
                <span className="block">
                  <DeadlineText job={job} />
                </span>
                <span className="mt-1 block">
                  <DeadlineBadge job={job} />
                </span>
              </DataTable.Td>
              <DataTable.Td className="text-muted">
                <ChevronCell />
              </DataTable.Td>
            </DataTable.Row>
          );
        })}
      </DataTable.Body>
    </DataTable.Root>
  );
}

function MobileRows({ jobs }: { jobs: readonly ProtoJobRow[] }) {
  return (
    <ul aria-label="รายการงานผลิต" className="space-y-2">
      {jobs.map((job) => {
        const status = jobStatus(job);
        return (
          <li key={job.key}>
            <Link
              href={jobHref(job)}
              className={cn(
                FOCUS_BUTTON,
                "card-surface card-surface-hover block min-h-11 rounded-2xl p-4 pl-[13px]",
                rowEdge(status.tone),
              )}
            >
              <span className="flex items-start justify-between gap-3">
                <JobIdentity job={job} size="md" asLink={false} />
                <ChevronCell />
              </span>
              <span className="mt-3 block">
                <StatusCell job={job} showStation={false} />
              </span>
              <span className="mt-3 grid grid-cols-[1fr_auto] items-end gap-4">
                <RailDots job={job} />
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
        );
      })}
    </ul>
  );
}

export function FocusVariant({ state }: { state: WorklistState }) {
  return (
    <div className="space-y-4">
      <FilterCards state={state} />
      <div className="space-y-3 lg:space-y-0 lg:overflow-hidden lg:rounded-lg lg:border lg:border-border lg:bg-surface">
        <WorklistToolbar
          state={state}
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
    </div>
  );
}
