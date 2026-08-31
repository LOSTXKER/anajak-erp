"use client";

/**
 * A · แน่น — "เห็นงานเยอะที่สุดต่อหนึ่งจอ"
 *
 * วิธีคิด: หน้านี้คือรายการงาน ไม่ใช่แดชบอร์ด · การ์ดตัวเลขจึงบีบเป็นแถวเตี้ยแถวเดียว
 * และแถวตารางลดจาก 82px เหลือ ~60px โดยยังมีข้อมูลครบทุกช่องเท่าเดิม
 * (ย้ายของที่เคยอยู่คนละบรรทัดมาต่อกันในบรรทัดเดียว ไม่ได้ตัดทิ้ง)
 */

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { FOCUS_BUTTON, RADIUS } from "@/components/ui/tokens";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { orderMockupCover } from "@/lib/mockup";
import { cn } from "@/lib/utils";

import type { ProtoJobRow } from "../_data";
import {
  ChevronCell,
  DeadlineBadge,
  DeadlineText,
  LENSES,
  LENS_PRESENTATION,
  ProgressSlim,
  StatusCell,
  WorklistEmpty,
  WorklistToolbar,
  jobHref,
  sortColumnProps,
  type WorklistState,
} from "../_ui";
import { ProtoFreshness } from "../_shell";

/* ------------------------------------------------------------ การ์ดกรอง (เตี้ย) */

function FilterCards({ state }: { state: WorklistState }) {
  return (
    <section
      aria-label="กรองรายการงาน"
      className="grid grid-cols-2 gap-2 md:grid-cols-5"
    >
      {LENSES.map((item) => {
        const isOn = state.lens === item.key;
        const tone = LENS_PRESENTATION[item.key];
        const Icon = tone.icon;
        const label = `${item.label} · ${state.counts[item.key]} งาน · ${
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
              "card-surface card-surface-hover flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left",
              item.key === "all" && "col-span-2 md:col-span-1",
              isOn && cn("bg-surface", tone.border),
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                RADIUS.inner,
                "flex h-8 w-8 shrink-0 items-center justify-center",
                tone.chip,
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-xs font-medium",
                isOn ? tone.text : "text-muted",
              )}
            >
              {item.label}
            </span>
            <span className={cn("shrink-0 text-lg font-semibold tabular-nums", tone.text)}>
              {state.counts[item.key]}
            </span>
          </button>
        );
      })}
    </section>
  );
}

/* ------------------------------------------------------------------ ตาราง */

const CELL = "px-4 py-2";
const HEAD_CELL = "px-4 py-2";

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
            className={HEAD_CELL}
          >
            ออเดอร์
          </DataTable.SortableTh>
          <DataTable.Th className={HEAD_CELL}>สถานะ</DataTable.Th>
          <DataTable.SortableTh
            {...sortColumnProps(state.sort, state.setSort, "progress")}
            className={HEAD_CELL}
          >
            ความคืบหน้า
          </DataTable.SortableTh>
          <DataTable.SortableTh
            {...sortColumnProps(state.sort, state.setSort, "totalQuantity")}
            className={cn(HEAD_CELL, "hidden xl:table-cell")}
            align="right"
          >
            จำนวน
          </DataTable.SortableTh>
          <DataTable.SortableTh
            {...sortColumnProps(state.sort, state.setSort, "deadline")}
            className={HEAD_CELL}
          >
            กำหนดส่ง
          </DataTable.SortableTh>
          <DataTable.Th className={cn(HEAD_CELL, "w-10")}>
            <span className="sr-only">เปิด</span>
          </DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body>
        {jobs.map((job) => {
          return (
            <DataTable.Row key={job.key} href={jobHref(job)} className="h-[60px]">
              <DataTable.Td className={cn(CELL, "min-w-44")}>
                <Link
                  href={jobHref(job)}
                  className={cn(FOCUS_BUTTON, "inline-flex min-w-0 items-center gap-3 rounded-lg")}
                >
                  <MockupThumbnail
                    cover={orderMockupCover(job.order)}
                    alt={`ม็อกอัพของ ${job.order.orderNumber}`}
                    size="sm"
                    className="h-8 w-8"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1.5 font-semibold tabular-nums leading-tight text-strong">
                      {job.order.orderNumber}
                      {job.order.priority === "URGENT" ? (
                        <Badge variant="destructive" size="sm">
                          ด่วน
                        </Badge>
                      ) : null}
                    </span>
                    <span className="max-w-44 truncate text-xs leading-tight text-muted">
                      {job.order.customerName || "ไม่ระบุลูกค้า"}
                    </span>
                  </span>
                </Link>
              </DataTable.Td>
              <DataTable.Td className={cn(CELL, "min-w-44")}>
                <StatusCell job={job} />
              </DataTable.Td>
              <DataTable.Td className={cn(CELL, "w-32")}>
                <ProgressSlim rail={job.rail} />
              </DataTable.Td>
              <DataTable.Td
                className={cn(CELL, "hidden tabular-nums xl:table-cell")}
                align="right"
              >
                {(job.order.totalQuantity ?? 0).toLocaleString("th-TH")}
              </DataTable.Td>
              <DataTable.Td className={cn(CELL, "min-w-32")}>
                <span className="flex flex-wrap items-center gap-1.5">
                  <DeadlineText job={job} />
                  <DeadlineBadge job={job} />
                </span>
              </DataTable.Td>
              <DataTable.Td className={cn(CELL, "text-muted")}>
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
      {jobs.map((job) => (
          <li key={job.key}>
            <Link
              href={jobHref(job)}
              className={cn(
                FOCUS_BUTTON,
                "card-surface card-surface-hover block min-h-11 rounded-2xl p-3",
              )}
            >
              <span className="flex items-start gap-3">
                <MockupThumbnail
                  cover={orderMockupCover(job.order)}
                  alt={`ม็อกอัพของ ${job.order.orderNumber}`}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5 font-semibold tabular-nums leading-tight text-strong">
                    {job.order.orderNumber}
                    {job.order.priority === "URGENT" ? (
                      <Badge variant="destructive" size="sm">
                        ด่วน
                      </Badge>
                    ) : null}
                    <DeadlineBadge job={job} />
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {job.order.customerName || "ไม่ระบุลูกค้า"}
                  </span>
                  <span className="mt-1.5 block">
                    <StatusCell job={job} />
                  </span>
                  <span className="mt-2 flex items-center justify-between gap-3">
                    <ProgressSlim rail={job.rail} />
                    <span className="shrink-0 text-right text-xs text-muted">
                      <DeadlineText job={job} /> ·{" "}
                      <span className="tabular-nums">
                        {(job.order.totalQuantity ?? 0).toLocaleString("th-TH")} ตัว
                      </span>
                    </span>
                  </span>
                </span>
              </span>
            </Link>
          </li>
      ))}
    </ul>
  );
}

export function DenseVariant({ state }: { state: WorklistState }) {
  return (
    <div className="space-y-3">
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
