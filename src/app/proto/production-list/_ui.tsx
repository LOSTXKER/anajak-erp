"use client";

/**
 * ชิ้นส่วนที่แบบ A/B/C ใช้ร่วมกัน
 *
 * กติกา "เอาของมาให้ครบ": ของที่ **ไม่ได้**กำลังเทียบ (ช่องค้นหา · ช่องเรียง · แถบเครื่องมือ ·
 * ป้าย · รูปย่อม็อกอัพ · สถานะว่าง · ตัวบอกความสดข้อมูล) import ตัวจริงจาก `src/components`
 * ทั้งหมด ไม่วาดใหม่ · เขียนเองเฉพาะ "การ์ดกรอง" กับ "แถวในตาราง" ซึ่งคือสิ่งที่กำลังเลือก
 *
 * เหตุผล/เจ้าของงาน/ความคืบหน้า/ป้ายกำหนดส่ง อ่านจากสูตรจริงใน `production-worklist.ts`
 * ทุกตัว — ไม่มีข้อความไหนในหน้าลองที่แต่งขึ้นเอง
 */

import { useMemo, useState } from "react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { FOCUS_BUTTON, RADIUS } from "@/components/ui/tokens";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { orderMockupCover } from "@/lib/mockup";
import { cn, formatDateShort } from "@/lib/utils";
import { filterBoardJobs, type BoardException, type BoardRailPoint } from "@/lib/production-board";
import {
  PRODUCTION_WORKLIST_LENSES,
  PRODUCTION_WORKLIST_SORT_COLUMNS,
  PRODUCTION_WORKLIST_SORT_OPTIONS,
  filterProductionWorklist,
  productionWorklistAction,
  productionWorklistCounts,
  productionWorklistHref,
  productionWorklistProgress,
  resolveProductionWorklistSort,
  sortProductionWorklist,
  type ProductionWorklistLens,
  type ProductionWorklistSort,
  type ProductionWorklistSortColumn,
} from "@/lib/production-worklist";

import type { ProtoBoard, ProtoJobRow } from "./_data";

/* ------------------------------------------------------------------ สีหมวด
   ยกมาจาก production-control-worklist.tsx ตัวจริงทุกเฉด — ทุกแบบใช้สีชุดเดียวกัน
   สิ่งที่ต่างกันคือ "เอาสีไปวางตรงไหน" ไม่ใช่ "สีอะไร" */

export const LENS_PRESENTATION = {
  all: {
    icon: ListFilter,
    text: "text-module-brand-text",
    chip: "bg-module-brand-surface text-module-brand-text",
    border: "border-blue-600 dark:border-blue-400",
    fill: "bg-module-brand-surface/60 dark:bg-module-brand-surface/40",
    bar: "bg-module-brand-solid",
  },
  attention: {
    icon: AlertTriangle,
    text: "text-red-600 dark:text-red-300",
    chip: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    border: "border-red-600 dark:border-red-400",
    fill: "bg-red-50/70 dark:bg-red-950/30",
    bar: "bg-red-600 dark:bg-red-400",
  },
  production: {
    icon: Factory,
    text: "text-module-production-text",
    chip: "bg-module-production-surface text-module-production-text",
    border: "border-module-production-solid",
    fill: "bg-module-production-surface/60 dark:bg-module-production-surface/40",
    bar: "bg-module-production-solid",
  },
  qc: {
    icon: ClipboardCheck,
    text: "text-amber-700 dark:text-amber-300",
    chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    border: "border-amber-600 dark:border-amber-400",
    fill: "bg-amber-50/70 dark:bg-amber-950/30",
    bar: "bg-amber-600 dark:bg-amber-400",
  },
  packing: {
    icon: PackageCheck,
    text: "text-green-700 dark:text-green-300",
    chip: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
    border: "border-green-600 dark:border-green-400",
    fill: "bg-green-50/70 dark:bg-green-950/30",
    bar: "bg-green-600 dark:bg-green-400",
  },
} satisfies Record<
  ProductionWorklistLens,
  {
    icon: LucideIcon;
    text: string;
    chip: string;
    border: string;
    fill: string;
    bar: string;
  }
>;

export const LENSES = PRODUCTION_WORKLIST_LENSES;

/* -------------------------------------------------------------- สถานะของหน้า
   กรอง/ค้นหา/เรียง เดินผ่านฟังก์ชันจริงทั้งหมด (ไม่ได้เขียนตรรกะใหม่ในหน้าลอง) */

export function useWorklist(board: ProtoBoard) {
  const [lens, setLens] = useState<ProductionWorklistLens>("all");
  const [sort, setSort] = useState<ProductionWorklistSort>("attention");
  const [search, setSearch] = useState("");

  const jobs = useMemo(() => {
    const searched = filterBoardJobs(board.jobs, board.stations, "", search);
    const lensed = filterProductionWorklist(board, searched, lens);
    return sortProductionWorklist(board, lensed, sort);
  }, [board, search, lens, sort]);

  const counts = useMemo(() => productionWorklistCounts(board), [board]);
  const exceptionByOrderId = useMemo(
    () => new Map(board.exceptions.map((item) => [item.orderId, item])),
    [board],
  );
  /** เลยกำหนดกี่ใบในแต่ละมุม — ใช้เป็นบรรทัดขยายใต้ตัวเลขในแบบ B */
  const overdue = useMemo(() => {
    const of = (key: ProductionWorklistLens) =>
      filterProductionWorklist(board, board.jobs, key).filter((job) => job.overdue).length;
    return {
      all: of("all"),
      attention: of("attention"),
      production: of("production"),
      qc: of("qc"),
      packing: of("packing"),
    } satisfies Record<ProductionWorklistLens, number>;
  }, [board]);

  return {
    lens,
    setLens,
    sort,
    setSort,
    search,
    setSearch,
    jobs,
    counts,
    overdue,
    exceptionByOrderId,
  };
}

export type WorklistState = ReturnType<typeof useWorklist>;

/* ----------------------------------------------------------- แถบเครื่องมือ
   ของจริงล้วน (Toolbar + SearchInput + Select) — แบบ C แทรกแถบตัวกรองเข้ามาตรงนี้ */

export function WorklistToolbar({
  state,
  leading,
  freshness,
  className,
}: {
  state: WorklistState;
  leading?: React.ReactNode;
  freshness?: React.ReactNode;
  className?: string;
}) {
  const desktopSortValue =
    state.sort === "attention" || state.sort === "urgent" ? state.sort : "__column__";

  return (
    <Toolbar className={className}>
      {freshness ? (
        <div className="order-1 flex justify-end @2xl:order-3 @2xl:ml-auto">{freshness}</div>
      ) : null}
      {leading ? <div className="order-2 w-full @2xl:order-1">{leading}</div> : null}
      <SearchInput
        value={state.search}
        onChange={(event) => state.setSearch(event.target.value)}
        placeholder="ค้นหาเลขออเดอร์ หรือลูกค้า"
        surface="raised"
        containerClassName={cn(
          "w-full @2xl:max-w-md",
          leading ? "order-3 @2xl:order-2" : "order-2 @2xl:order-1",
        )}
      />
      <ToolbarGroup
        className={cn("w-full @2xl:w-auto", leading ? "order-4 @2xl:order-3" : "order-3 @2xl:order-2")}
      >
        {/* มือถือไม่มีหัวตาราง จึงต้องเข้าถึงทุกวิธีเรียงจาก Select */}
        <Select
          value={state.sort}
          onChange={(event) => state.setSort(resolveProductionWorklistSort(event.target.value))}
          aria-label="เรียงรายการงาน"
          shape="pill"
          surface="raised"
          className="w-full @2xl:hidden"
        >
          {PRODUCTION_WORKLIST_SORT_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
        <Select
          value={desktopSortValue}
          onChange={(event) => state.setSort(resolveProductionWorklistSort(event.target.value))}
          aria-label="ลำดับพิเศษ"
          shape="pill"
          surface="raised"
          className="hidden @2xl:flex @2xl:w-52"
        >
          <option value="__column__" disabled>
            เรียงจากหัวตาราง
          </option>
          <option value="attention">ต้องจัดการก่อน</option>
          <option value="urgent">ด่วนก่อน</option>
        </Select>
      </ToolbarGroup>
    </Toolbar>
  );
}

export function sortColumnProps(
  sort: ProductionWorklistSort,
  onSelectSort: (sort: ProductionWorklistSort) => void,
  column: ProductionWorklistSortColumn,
) {
  const config = PRODUCTION_WORKLIST_SORT_COLUMNS[column];
  return {
    direction:
      sort === config.asc ? ("asc" as const) : sort === config.desc ? ("desc" as const) : null,
    defaultDirection: config.defaultDirection,
    onSort: (direction: "asc" | "desc") => onSelectSort(config[direction]),
  };
}

export function WorklistEmpty({ lens }: { lens: ProductionWorklistLens }) {
  return (
    <EmptyState
      icon={lens === "all" ? Factory : SearchX}
      title={lens === "all" ? "ยังไม่มีงานในสายการผลิต" : "ไม่มีงานในมุมนี้"}
      description={
        lens === "all"
          ? "ออเดอร์พร้อมผลิตจะปรากฏที่นี่"
          : "ลองเลือกมุมอื่นหรือค้นหาด้วยเลขออเดอร์"
      }
    />
  );
}

/* ------------------------------------------------------------ ชิ้นส่วนในแถว */

export function jobHref(job: ProtoJobRow) {
  return productionWorklistHref(job, false);
}

export function DeadlineBadge({ job }: { job: ProtoJobRow }) {
  if (job.overdue) return <Badge variant="destructive">เลยกำหนด</Badge>;
  if (job.bucket === "today") return <Badge variant="warning">ส่งวันนี้</Badge>;
  if (job.bucket === "tomorrow" || job.dueSoon) return <Badge variant="warning">ใกล้กำหนด</Badge>;
  return null;
}

export function DeadlineText({ job, className }: { job: ProtoJobRow; className?: string }) {
  return (
    <span
      className={cn(
        "tabular-nums",
        job.overdue && "font-medium text-red-700 dark:text-red-300",
        !job.order.deadline && "text-muted",
        className,
      )}
    >
      {job.order.deadline ? formatDateShort(job.order.deadline) : "ไม่กำหนด"}
    </span>
  );
}

export function stationLabels(job: ProtoJobRow) {
  return [...new Set(job.spots.map((spot) => spot.stationLabel).filter(Boolean))];
}

export function StationBadges({ job, max = 2 }: { job: ProtoJobRow; max?: number }) {
  const stages = stationLabels(job);
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {stages.slice(0, max).map((stage) => (
        <Badge key={stage} variant="default" size="sm">
          {stage}
        </Badge>
      ))}
      {stages.length > max ? <Badge size="sm">+{stages.length - max}</Badge> : null}
    </div>
  );
}

export function actionOf(job: ProtoJobRow, exception?: BoardException) {
  return productionWorklistAction(job, exception);
}

export function actionToneClass(tone: "red" | "amber" | "neutral") {
  return tone === "red"
    ? "text-red-700 dark:text-red-300"
    : tone === "amber"
      ? "text-amber-700 dark:text-amber-300"
      : "text-strong";
}

/** แถบความคืบหน้าแบบเดิม (ตัวเลข + เปอร์เซ็นต์ + แท่ง) */
export function ProgressBar({ rail }: { rail: readonly BoardRailPoint[] }) {
  const { completed, total, percent } = productionWorklistProgress(rail);
  return (
    <div className="min-w-24">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="tabular-nums">
          {completed}/{total} ช่วง
        </span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`ผ่านแล้ว ${completed} จาก ${total} ช่วง`}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className="h-full rounded-full bg-blue-600 transition-[width] duration-[var(--duration-base)] ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** แถบความคืบหน้าแบบผอม — บรรทัดเดียว ใช้ในแบบ A */
export function ProgressSlim({ rail }: { rail: readonly BoardRailPoint[] }) {
  const { completed, total, percent } = productionWorklistProgress(rail);
  return (
    <span className="flex items-center gap-2">
      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`ผ่านแล้ว ${completed} จาก ${total} ช่วง`}
        className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-surface-muted"
      >
        <span
          className="block h-full rounded-full bg-blue-600"
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="shrink-0 text-xs tabular-nums text-muted">
        {completed}/{total}
      </span>
    </span>
  );
}

/* รางช่วงงาน — ข้อมูลชุดเดียวกับแท่ง % (job.rail) แต่บอกว่า "อยู่ช่วงไหน" แทน "กี่เปอร์เซ็นต์"
   สีเดินตามสถานะจริงของแต่ละช่วง: จบ · กำลังทำ · ติด · พัง · ยังไม่ถึง · ไม่เกี่ยวกับงานนี้ */
const RAIL_DOT: Record<BoardRailPoint["state"], string> = {
  done: "bg-module-production-solid",
  now: "bg-blue-600 ring-2 ring-blue-600/25 dark:bg-blue-400 dark:ring-blue-400/25",
  stuck: "bg-amber-500",
  failed: "bg-red-600 dark:bg-red-400",
  wait: "bg-border-strong",
  na: "bg-surface-muted",
};

const RAIL_STATE_WORD: Record<BoardRailPoint["state"], string> = {
  done: "ผ่านแล้ว",
  now: "กำลังทำ",
  stuck: "ติดรอของ",
  failed: "มีปัญหา",
  wait: "ยังไม่ถึง",
  na: "งานนี้ไม่มีช่วงนี้",
};

export function RailDots({ job }: { job: ProtoJobRow }) {
  const rail = job.rail;
  const active =
    rail.find((point) => point.state === "failed") ??
    rail.find((point) => point.state === "stuck") ??
    rail.find((point) => point.state === "now") ??
    rail.find((point) => point.state === "wait");
  const { completed, total } = productionWorklistProgress(rail);
  // ใบที่ยังไม่ได้เปิดใบผลิตยังไม่มี "ช่วงที่กำลังทำ" จริง — บอกตรง ๆ ดีกว่าชี้ไปช่วงที่ยังไม่ถึง
  const waitingToOpen = job.spots.some((spot) => spot.kind === "queue");

  return (
    <div className="min-w-28">
      <div className="flex items-center gap-1">
        {rail.map((point) => (
          <span
            key={point.key}
            title={`${point.label} · ${RAIL_STATE_WORD[point.state]}`}
            className={cn("h-2 w-2 shrink-0 rounded-full", RAIL_DOT[point.state])}
          />
        ))}
        <span className="ml-1 shrink-0 text-2xs tabular-nums text-muted">
          {completed}/{total}
        </span>
      </div>
      <p className="mt-1 truncate text-xs text-secondary">
        {waitingToOpen
          ? "ยังไม่เปิดใบผลิต"
          : active
            ? `อยู่ที่ ${active.label}`
            : "ครบทุกช่วงแล้ว"}
      </p>
    </div>
  );
}

/** ชื่อ/เลขออเดอร์ + รูปม็อกอัพ — เหมือนของจริง เปลี่ยนได้แค่ขนาดรูป
 *  `asLink=false` ใช้เมื่ออยู่ในการ์ดที่ทั้งใบเป็นลิงก์อยู่แล้ว — ลิงก์ซ้อนลิงก์
 *  ทำให้เบราว์เซอร์ตัด DOM ออกเป็นคนละก้อน (การ์ดบนมือถือแตกเป็นสองชิ้น) */
function JobIdentityBody({ job, size }: { job: ProtoJobRow; size: "sm" | "md" }) {
  return (
    <>
      <MockupThumbnail
        cover={orderMockupCover(job.order)}
        alt={`ม็อกอัพของ ${job.order.orderNumber}`}
        size={size}
      />
      <span className="flex min-w-0 flex-col justify-center">
        <span className="flex flex-wrap items-center gap-1.5 font-semibold tabular-nums text-strong">
          {job.order.orderNumber}
          {job.order.priority === "URGENT" ? (
            <Badge variant="destructive" size="sm">
              ด่วน
            </Badge>
          ) : null}
        </span>
        <span className="truncate text-xs text-muted">
          {job.order.customerName || "ไม่ระบุลูกค้า"}
        </span>
      </span>
    </>
  );
}

export function JobIdentity({
  job,
  size = "sm",
  asLink = true,
  className,
}: {
  job: ProtoJobRow;
  size?: "sm" | "md";
  asLink?: boolean;
  className?: string;
}) {
  if (!asLink) {
    return (
      <span className={cn("flex min-w-0 items-center gap-3", className)}>
        <JobIdentityBody job={job} size={size} />
      </span>
    );
  }
  return (
    <Link
      href={jobHref(job)}
      className={cn(
        FOCUS_BUTTON,
        "inline-flex min-h-11 min-w-0 items-center gap-3 rounded-lg",
        className,
      )}
    >
      <JobIdentityBody job={job} size={size} />
    </Link>
  );
}

export function ChevronCell() {
  return <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />;
}

export { RADIUS };
