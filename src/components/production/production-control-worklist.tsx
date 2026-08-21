"use client";

import type { Ref } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  ClipboardCheck,
  Factory,
  LayoutList,
  PackageCheck,
  SearchX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { FOCUS_BUTTON, RADIUS } from "@/components/ui/tokens";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { orderMockupCover } from "@/lib/mockup";
import { cn, formatDateShort } from "@/lib/utils";
import {
  type BoardException,
  type BoardJob,
  type BoardOrderLike,
  type BoardRailPoint,
  type BoardStepLike,
  type ProductionBoard,
} from "@/lib/production-board";
import {
  PRODUCTION_WORKLIST_SORT_COLUMNS,
  PRODUCTION_WORKLIST_LENSES,
  PRODUCTION_WORKLIST_SORT_OPTIONS,
  productionWorklistProgress,
  productionWorklistCounts,
  productionWorklistDaySummary,
  productionWorklistHref,
  resolveProductionWorklistSort,
  type ProductionWorklistDaySummary,
  type ProductionWorklistLens,
  type ProductionWorklistSort,
  type ProductionWorklistSortColumn,
} from "@/lib/production-worklist";

const WORKLIST_LENS_ICONS = {
  all: LayoutList,
  attention: AlertTriangle,
  production: Factory,
  qc: ClipboardCheck,
  packing: PackageCheck,
} as const;

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}

function DeadlineBadge<S extends BoardStepLike, O extends BoardOrderLike<S>>({
  job,
}: {
  job: BoardJob<O, S>;
}) {
  if (job.overdue) return <Badge variant="destructive">เลยกำหนด</Badge>;
  if (job.bucket === "today") return <Badge variant="warning">ส่งวันนี้</Badge>;
  if (job.bucket === "tomorrow" || job.dueSoon) {
    return <Badge variant="warning">ใกล้กำหนด</Badge>;
  }
  return null;
}

function WorkProgress({
  rail,
}: {
  rail: readonly BoardRailPoint[];
}) {
  const { completed, total, percent } = productionWorklistProgress(rail);

  return (
    <div className="min-w-24">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>{completed}/{total} ช่วง</span>
        <span>{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`ผ่านแล้ว ${completed} จาก ${total} ช่วง`}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function currentWork<S extends BoardStepLike, O extends BoardOrderLike<S>>(
  job: BoardJob<O, S>,
) {
  return unique(job.spots.map((spot) => spot.stationLabel));
}

function waitingOn<S extends BoardStepLike, O extends BoardOrderLike<S>>(
  job: BoardJob<O, S>,
) {
  return unique(job.spots.flatMap((spot) => spot.waitingOn));
}

function WorkBadges<S extends BoardStepLike, O extends BoardOrderLike<S>>({
  job,
  exception,
}: {
  job: BoardJob<O, S>;
  exception?: BoardException;
}) {
  const stages = currentWork(job);
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {exception?.reasons.slice(0, 1).map((reason) => (
        <Badge
          key={reason.label}
          variant={reason.tone === "red" ? "destructive" : "warning"}
          size="sm"
        >
          {reason.label}
        </Badge>
      ))}
      {stages.slice(0, 2).map((stage) => (
        <Badge key={stage} variant="default" size="sm">
          {stage}
        </Badge>
      ))}
      {stages.length > 2 ? <Badge size="sm">+{stages.length - 2}</Badge> : null}
    </div>
  );
}

function DesktopRows<S extends BoardStepLike, O extends BoardOrderLike<S>>({
  jobs,
  exceptionByOrderId,
  canCreateProduction,
  sort,
  onSelectSort,
}: {
  jobs: readonly BoardJob<O, S>[];
  exceptionByOrderId: Map<string, BoardException>;
  canCreateProduction: boolean;
  sort: ProductionWorklistSort;
  onSelectSort: (sort: ProductionWorklistSort) => void;
}) {
  const sortColumn = (column: ProductionWorklistSortColumn) => {
    const config = PRODUCTION_WORKLIST_SORT_COLUMNS[column];
    return {
      direction:
        sort === config.asc ? "asc" as const
          : sort === config.desc ? "desc" as const
            : null,
      defaultDirection: config.defaultDirection,
      onSort: (direction: "asc" | "desc") => onSelectSort(config[direction]),
    };
  };

  return (
    <DataTable.Root>
      <DataTable.Head>
        <tr>
          <DataTable.SortableTh {...sortColumn("orderNumber")}>
            ออเดอร์
          </DataTable.SortableTh>
          <DataTable.Th>งานปัจจุบัน</DataTable.Th>
          <DataTable.SortableTh {...sortColumn("progress")}>
            ความคืบหน้า
          </DataTable.SortableTh>
          <DataTable.SortableTh
            {...sortColumn("totalQuantity")}
            className="hidden xl:table-cell"
            align="right"
          >
            จำนวน
          </DataTable.SortableTh>
          <DataTable.SortableTh {...sortColumn("deadline")}>
            กำหนดส่ง
          </DataTable.SortableTh>
          <DataTable.Th className="w-12"><span className="sr-only">เปิด</span></DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body>
        {jobs.map((job) => {
          const exception = exceptionByOrderId.get(job.order.id);
          const waits = waitingOn(job);
          const href = productionWorklistHref(job, canCreateProduction);
          return (
            <DataTable.Row key={job.key} href={href} className="h-[76px]">
              <DataTable.Td className="min-w-44 py-2">
                <Link
                  href={href}
                  className={cn(
                    FOCUS_BUTTON,
                    "inline-flex min-h-11 min-w-0 items-center gap-3 rounded-lg",
                  )}
                >
                  {/* รูปม็อกอัพนำหน้า — หัวหน้าไล่คิวจำงานจากภาพได้เร็วกว่าอ่านเลขออเดอร์ */}
                  <MockupThumbnail
                    cover={orderMockupCover(job.order)}
                    alt={`ม็อกอัพของ ${job.order.orderNumber}`}
                    size="sm"
                  />
                  <span className="flex min-w-0 flex-col justify-center">
                    <span className="flex items-center gap-1.5 font-semibold tabular-nums text-strong">
                      {job.order.orderNumber}
                      {job.order.priority === "URGENT" ? (
                        <Badge variant="destructive" size="sm">ด่วน</Badge>
                      ) : null}
                    </span>
                    <span className="max-w-48 truncate text-xs text-muted">
                      {job.order.customerName || job.order.title || "ไม่ระบุลูกค้า"}
                    </span>
                  </span>
                </Link>
              </DataTable.Td>
              <DataTable.Td className="min-w-48 py-2">
                <WorkBadges job={job} exception={exception} />
                <p className={cn("mt-1 truncate text-xs", waits.length ? "text-amber-700 dark:text-amber-300" : "text-muted")}>
                  {waits[0] || (job.order.title && job.order.customerName ? job.order.title : "พร้อมทำต่อ")}
                </p>
              </DataTable.Td>
              <DataTable.Td className="w-32 py-2">
                <WorkProgress rail={job.rail} />
              </DataTable.Td>
              <DataTable.Td className="hidden py-2 tabular-nums xl:table-cell" align="right">
                {(job.order.totalQuantity ?? 0).toLocaleString("th-TH")}
              </DataTable.Td>
              <DataTable.Td className="min-w-28 py-2">
                <span className={cn("block tabular-nums", job.overdue && "font-medium text-red-700 dark:text-red-300")}>
                  {job.order.deadline ? formatDateShort(job.order.deadline) : "ไม่กำหนด"}
                </span>
                <span className="mt-1 block"><DeadlineBadge job={job} /></span>
              </DataTable.Td>
              <DataTable.Td className="py-2 text-muted">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </DataTable.Td>
            </DataTable.Row>
          );
        })}
      </DataTable.Body>
    </DataTable.Root>
  );
}

function MobileRows<S extends BoardStepLike, O extends BoardOrderLike<S>>({
  jobs,
  exceptionByOrderId,
  canCreateProduction,
}: {
  jobs: readonly BoardJob<O, S>[];
  exceptionByOrderId: Map<string, BoardException>;
  canCreateProduction: boolean;
}) {
  return (
    <div className="space-y-2">
      {jobs.map((job) => {
        const href = productionWorklistHref(job, canCreateProduction);
        const waits = waitingOn(job);
        return (
          <Link
            key={job.key}
            href={href}
            className={cn(
              FOCUS_BUTTON,
              "card-surface card-surface-hover block min-h-11 rounded-2xl p-4",
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 items-start gap-3">
                <MockupThumbnail
                  cover={orderMockupCover(job.order)}
                  alt={`ม็อกอัพของ ${job.order.orderNumber}`}
                  size="md"
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5 font-semibold tabular-nums text-strong">
                    {job.order.orderNumber}
                    <DeadlineBadge job={job} />
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-secondary">
                    {job.order.customerName || job.order.title || "ไม่ระบุลูกค้า"}
                  </span>
                </span>
              </span>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            </span>
            <span className="mt-3 block"><WorkBadges job={job} exception={exceptionByOrderId.get(job.order.id)} /></span>
            {waits.length ? (
              <span className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{waits[0]}</span>
              </span>
            ) : null}
            <span className="mt-3 grid grid-cols-[1fr_auto] items-end gap-4">
              <WorkProgress rail={job.rail} />
              <span className="text-right text-xs text-muted">
                <span className="block tabular-nums">
                  {job.order.deadline ? formatDateShort(job.order.deadline) : "ไม่กำหนดส่ง"}
                </span>
                <span className="block tabular-nums">
                  {(job.order.totalQuantity ?? 0).toLocaleString("th-TH")} ตัว
                </span>
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * สรุปวันนี้ 3 ตัวเลข — เลยกำหนด / ครบวันนี้ / กำลังลงมือ
 *
 * เลือกสามตัวนี้เพราะเป็นคำถามที่หัวหน้าถามก่อนเปิดคิวเสมอ · จงใจไม่ใส่ยอดเงินหรือ
 * ยอดสะสมรายเดือน — หน้านี้ตัดสินลำดับงานวันนี้ ไม่ใช่รายงานผู้บริหาร
 */
function DaySummaryBar({ summary }: { summary: ProductionWorklistDaySummary }) {
  const cells = [
    { key: "late", label: "เลยกำหนด", value: summary.late, tone: "text-red-700 dark:text-red-300" },
    { key: "today", label: "ครบกำหนดวันนี้", value: summary.today, tone: "text-amber-700 dark:text-amber-300" },
    { key: "inProgress", label: "กำลังลงมือ", value: summary.inProgress, tone: "text-strong" },
  ] as const;

  return (
    <dl className="grid grid-cols-3 gap-2" aria-label="สรุปงานวันนี้">
      {cells.map((cell) => (
        <div
          key={cell.key}
          className={cn("card-surface px-3 py-2.5", RADIUS.surface)}
        >
          <dt className="text-2xs text-muted sm:text-xs">{cell.label}</dt>
          <dd className={cn("text-xl font-semibold tabular-nums", cell.tone)}>
            {cell.value.toLocaleString("th-TH")}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ProductionControlWorklist<
  S extends BoardStepLike,
  O extends BoardOrderLike<S>,
>({
  board,
  jobs,
  lens,
  sort,
  searchDefault,
  searchInputRef,
  onSelectLens,
  onSelectSort,
  onSearchChange,
  canCreateProduction,
}: {
  board: ProductionBoard<O, S>;
  jobs: readonly BoardJob<O, S>[];
  lens: ProductionWorklistLens;
  sort: ProductionWorklistSort;
  searchDefault: string;
  searchInputRef: Ref<HTMLInputElement>;
  onSelectLens: (lens: ProductionWorklistLens) => void;
  onSelectSort: (sort: ProductionWorklistSort) => void;
  onSearchChange: (value: string) => void;
  canCreateProduction: boolean;
}) {
  const counts = productionWorklistCounts(board);
  // สรุปนับจากทั้งบอร์ด ไม่ใช่ jobs ที่กรองแล้ว — "วันนี้มีอะไรต้องห่วง" ต้องไม่เปลี่ยน
  // ตามชิปที่เพิ่งกด ไม่งั้นตัวเลขที่ใช้ตัดสินใจขยับใต้มือทุกครั้งที่เปลี่ยนมุมมอง
  const daySummary = productionWorklistDaySummary(board.jobs);
  const exceptionByOrderId = new Map(board.exceptions.map((item) => [item.orderId, item]));

  return (
    <div className="space-y-4" data-production-worklist>
      <DaySummaryBar summary={daySummary} />

      <section aria-label="มุมรายการงาน" className="flex flex-wrap items-center gap-2">
        {PRODUCTION_WORKLIST_LENSES.map((item) => {
          const LensIcon = WORKLIST_LENS_ICONS[item.key];
          return (
            <FilterChip
              key={item.key}
              selected={lens === item.key}
              onClick={() => onSelectLens(item.key)}
              surface="raised"
              icon={
                <LensIcon
                  aria-hidden="true"
                  className="h-4 w-4"
                  strokeWidth={1.75}
                />
              }
            >
              {item.label}
              <span className="tabular-nums opacity-70">{counts[item.key]}</span>
            </FilterChip>
          );
        })}
      </section>

      <Toolbar>
        <SearchInput
          ref={searchInputRef}
          defaultValue={searchDefault}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="ค้นหาเลขออเดอร์ ลูกค้า หรืองาน"
          surface="raised"
          containerClassName="w-full @2xl:max-w-md"
        />
        <ToolbarGroup align="end" className="w-full @2xl:w-auto">
          {/* default/priority เป็น preset ที่ไม่ผูกหัวคอลัมน์ จึงคง Select ไว้บน desktop ด้วย */}
          <Select
            value={sort}
            onChange={(event) =>
              onSelectSort(resolveProductionWorklistSort(event.target.value))
            }
            aria-label="เรียงรายการงาน"
            shape="pill"
            surface="raised"
            className="w-full @2xl:w-52"
          >
            {PRODUCTION_WORKLIST_SORT_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </Select>
        </ToolbarGroup>
      </Toolbar>

      <ResponsiveList
        items={jobs}
        label="งานผลิต"
        emptyState={
          <EmptyState
            icon={lens === "all" ? Factory : SearchX}
            title={lens === "all" ? "ยังไม่มีงานในสายการผลิต" : "ไม่มีงานในมุมนี้"}
            description={lens === "all" ? "ออเดอร์พร้อมผลิตจะปรากฏที่นี่" : "ลองเลือกมุมอื่นหรือค้นหาด้วยเลขออเดอร์"}
          />
        }
        renderDesktop={(items) => (
          <DesktopRows
            jobs={items}
            exceptionByOrderId={exceptionByOrderId}
            canCreateProduction={canCreateProduction}
            sort={sort}
            onSelectSort={onSelectSort}
          />
        )}
        renderMobile={(items) => (
          <MobileRows
            jobs={items}
            exceptionByOrderId={exceptionByOrderId}
            canCreateProduction={canCreateProduction}
          />
        )}
      />
    </div>
  );
}
