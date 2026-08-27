"use client";

import { useEffect, type ReactNode, type Ref } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  ClipboardCheck,
  Factory,
  ListFilter,
  PackageCheck,
  SearchX,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
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
  PRODUCTION_WORKLIST_LENSES,
  PRODUCTION_WORKLIST_SORT_COLUMNS,
  PRODUCTION_WORKLIST_SORT_OPTIONS,
  productionWorklistAction,
  productionWorklistProgress,
  productionWorklistCounts,
  productionWorklistHref,
  resolveProductionWorklistSort,
  type ProductionWorklistLens,
  type ProductionWorklistSort,
  type ProductionWorklistSortColumn,
} from "@/lib/production-worklist";

const WORKLIST_LENS_PRESENTATION = {
  all: {
    icon: ListFilter,
    iconColor: "text-module-brand-text",
    count: "text-module-brand-text",
    selectedBorder: "border-blue-600 dark:border-blue-400",
  },
  attention: {
    icon: AlertTriangle,
    iconColor: "text-red-600 dark:text-red-300",
    count: "text-red-600 dark:text-red-300",
    selectedBorder: "border-red-600 dark:border-red-400",
  },
  production: {
    icon: Factory,
    iconColor: "text-module-production-text",
    count: "text-module-production-text",
    selectedBorder: "border-module-production-solid",
  },
  qc: {
    icon: ClipboardCheck,
    iconColor: "text-amber-700 dark:text-amber-300",
    count: "text-amber-700 dark:text-amber-300",
    selectedBorder: "border-amber-600 dark:border-amber-400",
  },
  packing: {
    icon: PackageCheck,
    iconColor: "text-green-700 dark:text-green-300",
    count: "text-green-700 dark:text-green-300",
    selectedBorder: "border-green-600 dark:border-green-400",
  },
} satisfies Record<
  ProductionWorklistLens,
  { icon: LucideIcon; iconColor: string; count: string; selectedBorder: string }
>;

const WORKLIST_FOCUS_STORAGE_KEY = "anajak:production-worklist:last-focus";

function rememberWorklistFocus(orderId: string) {
  try {
    window.sessionStorage.setItem(WORKLIST_FOCUS_STORAGE_KEY, orderId);
  } catch {
    // sessionStorage อาจถูกปิดโดย browser policy — การนำทางยังทำงานตามปกติ
  }
}

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
        <div className="h-full rounded-full bg-blue-600 transition-[width] duration-[var(--duration-base)] ease-out" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function currentWork<S extends BoardStepLike, O extends BoardOrderLike<S>>(
  job: BoardJob<O, S>,
) {
  return unique(job.spots.map((spot) => spot.stationLabel));
}

function WorkBadges<S extends BoardStepLike, O extends BoardOrderLike<S>>({
  job,
}: {
  job: BoardJob<O, S>;
}) {
  const stages = currentWork(job);
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {stages.slice(0, 2).map((stage) => (
        <Badge key={stage} variant="default" size="sm">
          {stage}
        </Badge>
      ))}
      {stages.length > 2 ? <Badge size="sm">+{stages.length - 2}</Badge> : null}
    </div>
  );
}

function WorkAction<S extends BoardStepLike, O extends BoardOrderLike<S>>({
  job,
  exception,
}: {
  job: BoardJob<O, S>;
  exception?: BoardException;
}) {
  const action = productionWorklistAction(job, exception);
  const tone = action.tone === "red"
    ? "text-red-700 dark:text-red-300"
    : action.tone === "amber"
      ? "text-amber-700 dark:text-amber-300"
      : "text-strong";

  return (
    <div className="min-w-0">
      <p className={cn("flex min-w-0 items-center gap-1.5 text-sm font-medium", tone)}>
        {action.attention ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : null}
        <span className="line-clamp-2">{action.reason}</span>
      </p>
      <p className="mt-0.5 truncate text-xs text-muted">
        เจ้าของถัดไป: <span className="text-secondary">{action.owner}</span>
      </p>
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
    <DataTable.Root bordered={false}>
      <DataTable.Head>
        <tr>
          <DataTable.SortableTh {...sortColumn("orderNumber")}>
            ออเดอร์
          </DataTable.SortableTh>
          <DataTable.Th>ต้องทำต่อ</DataTable.Th>
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
          const href = productionWorklistHref(job, canCreateProduction);
          return (
            <DataTable.Row
              key={job.key}
              href={href}
              onClick={() => rememberWorklistFocus(job.order.id)}
              className="h-[82px]"
            >
              <DataTable.Td className="min-w-44">
                <Link
                  data-production-worklist-order={job.order.id}
                  href={href}
                  onClick={() => rememberWorklistFocus(job.order.id)}
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
              <DataTable.Td className="min-w-56">
                <WorkAction job={job} exception={exception} />
                <div className="mt-1.5"><WorkBadges job={job} /></div>
              </DataTable.Td>
              <DataTable.Td className="w-32">
                <WorkProgress rail={job.rail} />
              </DataTable.Td>
              <DataTable.Td className="hidden tabular-nums xl:table-cell" align="right">
                {(job.order.totalQuantity ?? 0).toLocaleString("th-TH")}
              </DataTable.Td>
              <DataTable.Td className="min-w-28">
                <span className={cn("block tabular-nums", job.overdue && "font-medium text-red-700 dark:text-red-300")}>
                  {job.order.deadline ? formatDateShort(job.order.deadline) : "ไม่กำหนด"}
                </span>
                <span className="mt-1 block"><DeadlineBadge job={job} /></span>
              </DataTable.Td>
              <DataTable.Td className="text-muted">
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
    <ul aria-label="รายการงานผลิต" className="space-y-2">
      {jobs.map((job) => {
        const href = productionWorklistHref(job, canCreateProduction);
        const exception = exceptionByOrderId.get(job.order.id);
        return (
          <li key={job.key}>
            <Link
              data-production-worklist-order={job.order.id}
              href={href}
              onClick={() => rememberWorklistFocus(job.order.id)}
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
              <span className="mt-3 block"><WorkAction job={job} exception={exception} /></span>
              <span className="mt-2 block"><WorkBadges job={job} /></span>
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
          </li>
        );
      })}
    </ul>
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
  freshness,
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
  freshness?: ReactNode;
}) {
  const counts = productionWorklistCounts(board);
  const exceptionByOrderId = new Map(board.exceptions.map((item) => [item.orderId, item]));
  const desktopSortValue = sort === "attention" || sort === "urgent"
    ? sort
    : "__column__";

  useEffect(() => {
    let orderId: string | null = null;
    try {
      orderId = window.sessionStorage.getItem(WORKLIST_FOCUS_STORAGE_KEY);
    } catch {
      return;
    }
    if (!orderId) return;

    const target = [...document.querySelectorAll<HTMLElement>(
      "[data-production-worklist-order]",
    )].find(
      (candidate) =>
        candidate.dataset.productionWorklistOrder === orderId &&
        candidate.getClientRects().length > 0,
    );
    if (!target) return;
    const frame = window.requestAnimationFrame(() => {
      target.focus({ preventScroll: true });
      try {
        window.sessionStorage.removeItem(WORKLIST_FOCUS_STORAGE_KEY);
      } catch {
        // ไม่มีผลต่อการคืน focus ที่ทำสำเร็จแล้ว
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [jobs]);

  return (
    <div className="space-y-4" data-production-worklist>
      <section
        aria-label="กรองรายการงาน"
        className="grid grid-cols-2 gap-2 md:grid-cols-5"
      >
        {PRODUCTION_WORKLIST_LENSES.map((item) => {
          const isOn = lens === item.key;
          const presentation = WORKLIST_LENS_PRESENTATION[item.key];
          const Icon = presentation.icon;
          const action = item.key === "all" && isOn
            ? "กำลังแสดงทั้งหมด"
            : isOn
              ? "เลือกอยู่ · กดซ้ำเพื่อล้างตัวกรอง"
              : "กดเพื่อกรอง";
          const actionLabel = `${item.label} · ${counts[item.key]} งาน · ${action}`;

          return (
            <button
              key={item.key}
              type="button"
              aria-label={actionLabel}
              aria-pressed={isOn}
              title={actionLabel}
              onClick={() => onSelectLens(isOn ? "all" : item.key)}
              className={cn(
                FOCUS_BUTTON,
                "card-surface card-surface-hover flex min-h-20 w-full flex-col justify-between rounded-2xl p-4 text-left",
                item.key === "all" && "col-span-2 md:col-span-1",
                isOn && cn("bg-surface", presentation.selectedBorder),
              )}
            >
              <span className="flex w-full items-center justify-between gap-3">
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-xs font-medium",
                      isOn ? presentation.iconColor : "text-muted",
                    )}
                  >
                    {item.label}
                  </span>
                  <span
                    className={cn(
                      "mt-1 block text-2xl font-semibold tabular-nums",
                      presentation.count,
                    )}
                  >
                    {counts[item.key]}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center",
                    presentation.iconColor,
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
              </span>
            </button>
          );
        })}
      </section>

      <div className="space-y-3 lg:space-y-0 lg:overflow-hidden lg:rounded-lg lg:border lg:border-border lg:bg-surface">
        <Toolbar className="lg:border-b lg:border-divider lg:px-4 lg:py-3">
          {freshness ? (
            <div className="order-1 flex justify-end @2xl:order-3 @2xl:ml-auto">
              {freshness}
            </div>
          ) : null}
          <SearchInput
            ref={searchInputRef}
            defaultValue={searchDefault}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="ค้นหาเลขออเดอร์ ลูกค้า หรืองาน"
            surface="raised"
            containerClassName="order-2 w-full @2xl:order-1 @2xl:max-w-md"
          />
          <ToolbarGroup className="order-3 w-full @2xl:order-2 @2xl:w-auto">
            {/* มือถือไม่มีหัวตาราง จึงต้องเข้าถึงทุกวิธีเรียงจาก Select */}
            <Select
              value={sort}
              onChange={(event) =>
                onSelectSort(resolveProductionWorklistSort(event.target.value))
              }
              aria-label="เรียงรายการงาน"
              shape="pill"
              surface="raised"
              className="w-full @2xl:hidden"
            >
              {PRODUCTION_WORKLIST_SORT_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </Select>
            {/* desktop ใช้หัวตารางกับ column sort และเหลือเฉพาะ preset ข้ามคอลัมน์ */}
            <Select
              value={desktopSortValue}
              onChange={(event) =>
                onSelectSort(resolveProductionWorklistSort(event.target.value))
              }
              aria-label="ลำดับพิเศษ"
              shape="pill"
              surface="raised"
              className="hidden @2xl:flex @2xl:w-52"
            >
              <option value="__column__" disabled>เรียงจากหัวตาราง</option>
              <option value="attention">ต้องจัดการก่อน</option>
              <option value="urgent">ด่วนก่อน</option>
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
    </div>
  );
}
