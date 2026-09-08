"use client";

/**
 * โต๊ะงานหัวหน้า — ตัววาด (รับ props ล้วน ไม่ยิงข้อมูล) ของ `/production` แบบ A
 * เบสเคาะ 2026-09-02 จากหน้าลอง /proto/production-module:
 *   · ตัวเลขใหญ่ 4 ช่องคือตัวกรอง (เลยกำหนด · ติดปัญหา · ของร้านนอกครบกำหนด · พร้อมส่ง)
 *   · รายการเป็นตารางต่อเนื่อง กดหัวคอลัมน์เพื่อเรียง ไม่มีหัวแบ่งสถานะ (A10 · 09-09)
 *   · ไม่มีปุ่มในแถว — กดทั้งแถวเปิดใบผลิต (ลูกศรท้ายแถว)
 * กฎ 3 ชั้น docs/DESIGN.md §ลำดับความสำคัญทางสายตา: ตัวเลข/ป้ายกำหนดส่ง/ชิปขั้น = ชั้น 1
 */

import { type ReactNode, type RefObject } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CalendarClock,
  PackageCheck,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DueTag } from "@/components/ui/due-tag";
import { FilterChip } from "@/components/ui/filter-chip";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { SearchInput } from "@/components/ui/search-input";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { orderMockupCover } from "@/lib/mockup";
import type { BoardOrderLike, BoardRailPoint } from "@/lib/production-board";
import {
  type DeskLens,
  type DeskRow,
  type DeskStepLike,
  type DeskSummary,
} from "@/lib/production-desk";
import { productionWorklistProgress, type WorklistStationChip } from "@/lib/production-worklist";
import { RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
import { cn, formatDateShort } from "@/lib/utils";
import type { DeskSort, DeskSortKey } from "@/lib/production-desk-sort";

/* ───────────────────────── ตัวเลข 4 ช่อง = ตัวกรอง ───────────────────────── */

const TILES: {
  key: Exclude<DeskLens, "all">;
  label: string;
  icon: LucideIcon;
  tone: "danger" | "warning" | "success";
}[] = [
  { key: "late", label: "เลยกำหนดส่ง", icon: CalendarClock, tone: "danger" },
  { key: "blocked", label: "ติดปัญหา", icon: AlertTriangle, tone: "danger" },
  { key: "outsource", label: "ของร้านนอกครบกำหนด", icon: Truck, tone: "warning" },
  { key: "ready", label: "พร้อมส่ง", icon: PackageCheck, tone: "success" },
];

const TILE_TEXT = {
  danger: "text-red-600 dark:text-red-400",
  warning: "text-amber-700 dark:text-amber-400",
  success: "text-green-600 dark:text-green-400",
} as const;

export function DeskTiles({
  summary,
  lens,
  onSelectLens,
}: {
  summary: DeskSummary;
  lens: DeskLens;
  onSelectLens: (lens: DeskLens) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-4" data-production-desk-tiles="">
      {TILES.map((tile) => {
        const on = lens === tile.key;
        const value = summary[tile.key];
        const Icon = tile.icon;
        return (
          <button
            key={tile.key}
            type="button"
            aria-pressed={on}
            onClick={() => onSelectLens(on ? "all" : tile.key)}
            className={cn(
              "card-surface card-surface-hover rounded-2xl flex min-h-20 min-w-44 shrink-0 items-center justify-between gap-3 px-4 py-3 text-left transition-colors lg:min-w-0",
              on && "ring-2 ring-inset ring-blue-600 dark:ring-blue-400",
            )}
          >
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-secondary">
              <Icon className={cn("h-4 w-4 shrink-0", value > 0 ? TILE_TEXT[tile.tone] : "text-muted")} aria-hidden="true" />
              {tile.label}
            </span>
            <p className={cn("text-2xl font-semibold tabular-nums", value > 0 ? TILE_TEXT[tile.tone] : "text-muted")}>
              {value}
            </p>
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────────── แถบค้นหา + ชิปขั้นงาน ───────────────────────── */

/** ค่าตัวกรอง "ร้านนอกทุกประเภท" — ชิปเดียวแทน 6 ประเภทร้าน (เบสทัก 2026-09-02 "ส่วน filter ดูอัดไป") */
export const STATION_OUTSOURCE_ALL = "outsource";

function ChipCount({ count, overdue }: { count: number; overdue: number }) {
  return (
    <>
      <span className="tabular-nums text-muted">{count}</span>
      {overdue > 0 ? <span className="tabular-nums text-red-600 dark:text-red-400">· {overdue}</span> : null}
    </>
  );
}

/**
 * แถบกรอง 2 แถว (เบสเคาะ 2026-09-02 หลังลอง 3 รอบ): แถวบน = ช่องค้นหาสั้น 240px + สถานะอัปเดตชิดขวา
 * แถวล่าง = ชิปขั้นงาน · ร้านนอก 6 ประเภทยุบเป็นชิป "ร้านนอก" ชิปเดียว กดแล้วประเภทร้านโผล่เป็น
 * ชิปย่อยแถวเล็กข้างล่าง (เบสไม่เอา dropdown 2026-09-02)
 * ⚠️ ความกว้างช่องค้นหาล็อกเป็น w-60 ตรง ๆ ไม่ใช้ sm:w-* — รอบก่อนจอเบสยังเห็นเต็มแถว
 */
export function DeskToolbar({
  searchDefault,
  searchInputRef,
  onSearchChange,
  station,
  stations,
  outsourceTotal,
  outsourceOverdue,
  onSelectStation,
  total,
  freshness,
}: {
  searchDefault: string;
  searchInputRef: RefObject<HTMLInputElement | null> | null;
  onSearchChange: (value: string) => void;
  station: string;
  stations: readonly WorklistStationChip[];
  outsourceTotal: number;
  outsourceOverdue: number;
  onSelectStation: (station: string) => void;
  total: number;
  /** สถานะอัปเดตอัตโนมัติ — อยู่ขวาสุดของแถวค้นหา */
  freshness?: ReactNode;
}) {
  const inHouse = stations.filter((chip) => !chip.isOutsource);
  const outsource = stations.filter((chip) => chip.isOutsource);
  const outsourceCount = outsourceTotal;
  const outsourceActive = station === STATION_OUTSOURCE_ALL || outsource.some((chip) => chip.key === station);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          ref={searchInputRef}
          surface="raised"
          placeholder="ค้นเลขออเดอร์หรือลูกค้า"
          defaultValue={searchDefault}
          onChange={(event) => onSearchChange(event.target.value)}
          containerClassName="w-full sm:w-72 max-w-full shrink-0"
          aria-label="ค้นหางานผลิต"
        />
        {freshness ? <div className="ml-auto">{freshness}</div> : null}
      </div>
      <div className="flex gap-x-5 overflow-x-auto border-b border-divider pb-px [&>button]:shrink-0">
        <FilterChip selected={station === ""} onClick={() => onSelectStation("")}>
          ทุกขั้น <ChipCount count={total} overdue={0} />
        </FilterChip>
        {inHouse.map((chip) => (
          <FilterChip
            key={chip.key}
            selected={station === chip.key}
            onClick={() => onSelectStation(chip.key)}
            aria-label={`${chip.label} ${chip.count} งาน${chip.overdue ? ` เลยกำหนด ${chip.overdue}` : ""} · กดเพื่อกรอง`}
          >
            {chip.label} <ChipCount count={chip.count} overdue={chip.overdue} />
          </FilterChip>
        ))}
        {outsource.length > 0 ? (
          <FilterChip
            selected={outsourceActive}
            onClick={() => onSelectStation(STATION_OUTSOURCE_ALL)}
            icon={<Truck className="h-4 w-4" />}
            aria-label={`ร้านนอกทุกประเภท ${outsourceCount} งาน${outsourceOverdue ? ` เลยกำหนด ${outsourceOverdue}` : ""} · กดเพื่อกรอง`}
          >
            ร้านนอก <ChipCount count={outsourceCount} overdue={outsourceOverdue} />
          </FilterChip>
        ) : null}
      </div>
      {outsourceActive ? (
        // ประเภทร้าน = แถบพื้นจมใต้แถวหลัก มีป้ายนำ — โผล่เฉพาะตอนกด "ร้านนอก" (เบสทัก 09-02 ว่าแถวย่อยลอย ๆ "ต้องจัดดี ๆ")
        <div
          className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1", SUNK_PANEL, RADIUS.inner)}
          data-production-desk-outsource-types=""
        >
          <span className="inline-flex items-center gap-1.5 pr-1 text-xs font-medium text-muted">
            <Truck className="h-4 w-4" aria-hidden="true" /> ประเภทร้าน
          </span>
          <FilterChip selected={station === STATION_OUTSOURCE_ALL} onClick={() => onSelectStation(STATION_OUTSOURCE_ALL)}>
            ทุกประเภท <ChipCount count={outsourceCount} overdue={outsourceOverdue} />
          </FilterChip>
          {outsource.map((chip) => (
            <FilterChip
              key={chip.key}
              selected={station === chip.key}
              onClick={() => onSelectStation(chip.key)}
              aria-label={`${chip.label} ${chip.count} งาน${chip.overdue ? ` เลยกำหนด ${chip.overdue}` : ""} · กดเพื่อกรอง`}
            >
              {chip.label} <ChipCount count={chip.count} overdue={chip.overdue} />
            </FilterChip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────── ตาราง 8 คอลัมน์ ───────────────────────── */

const RAIL_CLASS: Record<BoardRailPoint["state"], string> = {
  done: "bg-green-500/80 dark:bg-green-400/70",
  now: "bg-amber-500",
  stuck: "bg-amber-500",
  failed: "bg-red-500",
  wait: "bg-slate-300 dark:bg-slate-600",
  na: "bg-slate-200 dark:bg-slate-700",
};

const RAIL_WORD: Record<BoardRailPoint["state"], string> = {
  done: "ผ่านแล้ว",
  now: "กำลังทำ",
  stuck: "ติดรอของ",
  failed: "ติดปัญหา",
  wait: "ยังไม่ถึง",
  na: "ไม่มีในใบนี้",
};

/** เส้นทางงานแบ่งช่วง — สูตรสีเดิมของคอลัมน์ "เส้นทางงาน" แบบ C (เบสเคาะ 2026-09-02) */
function RouteRail({ rail }: { rail: readonly BoardRailPoint[] }) {
  const { completed, total } = productionWorklistProgress(rail);
  const points = rail.filter((point) => point.state !== "na");
  return (
    <div className="min-w-20">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
        aria-label={`ผ่านแล้ว ${completed} จาก ${total} ช่วง`}
        className="flex h-1.5 gap-0.5"
      >
        {points.map((point) => (
          <span
            key={point.key}
            title={`${point.label} · ${RAIL_WORD[point.state]}`}
            className={cn("flex-1 rounded-sm", RAIL_CLASS[point.state])}
          />
        ))}
      </div>
      <p className="mt-1 text-xs tabular-nums text-muted">
        {completed}/{total} ช่วง
      </p>
    </div>
  );
}

function CurrentCell<S extends DeskStepLike, O extends BoardOrderLike<S>>({ row }: { row: DeskRow<S, O> }) {
  const reason = row.current.find((c) => c.reason)?.reason ?? null;
  return (
    <InfoChipRow>
      {row.current.map((current, index) => (
        <InfoChip
          key={`${current.label}-${index}`}
          size="sm"
          tone={
            current.state === "failed"
              ? "error"
              : current.state === "waiting"
                ? "warning"
                : current.state === "active" || current.state === "post"
                  ? "info"
                  : "neutral"
          }
          strong={current.state === "failed" || current.state === "active"}
          icon={current.state === "queue" ? undefined : Wrench}
        >
          {current.label}
        </InfoChip>
      ))}
      {reason ? (
        <InfoChip size="sm" tone={row.blocked ? "error" : "warning"} icon={AlertTriangle} title={reason} className="max-w-44">
          {reason}
        </InfoChip>
      ) : null}
    </InfoChipRow>
  );
}

function OutsourceCell<S extends DeskStepLike, O extends BoardOrderLike<S>>({ row }: { row: DeskRow<S, O> }) {
  const o = row.outsource;
  if (!o) return <span className="text-muted">—</span>;
  const back =
    o.backInDays === null
      ? { text: o.statusLabel, tone: "info" as const, strong: false }
      : o.backInDays < 0
        ? { text: `เลยนัดรับ ${Math.abs(o.backInDays)} วัน`, tone: "error" as const, strong: true }
        : o.backInDays === 0
          ? { text: "นัดรับวันนี้", tone: "warning" as const, strong: true }
          : { text: `กลับอีก ${o.backInDays} วัน`, tone: "info" as const, strong: false };
  return (
    <div className="min-w-0 space-y-1">
      <p className="truncate font-medium text-strong">{o.vendor}</p>
      {o.work ? <p className="truncate text-xs text-secondary">{o.work}</p> : null}
      <InfoChip size="sm" tone={back.tone} strong={back.strong} icon={Truck}>
        {back.text}
      </InfoChip>
    </div>
  );
}

export function DeskTable<S extends DeskStepLike, O extends BoardOrderLike<S>>({
  rows,
  sort,
  onSort,
  hrefFor,
  emptyLabel,
}: {
  rows: readonly DeskRow<S, O>[];
  sort: DeskSort;
  onSort: (key: DeskSortKey, direction: "asc" | "desc") => void;
  hrefFor: (row: DeskRow<S, O>) => string;
  emptyLabel: string;
}) {
  const directionFor = (key: DeskSortKey) => sort.key === key ? sort.direction : null;
  return (
    <DataTable.Root cellPadding="compact" className="min-w-0 max-w-full" data-production-desk-table="">
      <caption className="sr-only">รายการผลิต เรียงตามหัวคอลัมน์ และเปิดใบผลิตจากเลขออเดอร์</caption>
      <DataTable.Head>
        <tr>
          <DataTable.SortableTh direction={directionFor("order")} onSort={(dir) => onSort("order", dir)}>ใบงาน</DataTable.SortableTh>
          <DataTable.SortableTh align="right" direction={directionFor("quantity")} onSort={(dir) => onSort("quantity", dir)}>จำนวน</DataTable.SortableTh>
          <DataTable.SortableTh direction={directionFor("deadline")} onSort={(dir) => onSort("deadline", dir)}>กำหนดส่ง</DataTable.SortableTh>
          <DataTable.Th>ขั้นตอนผลิต</DataTable.Th>
          <DataTable.Th>ร้านนอก</DataTable.Th>
          <DataTable.Th>ผู้รับผิดชอบ</DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body>
        {rows.length === 0 ? (
          <tr>
            <DataTable.Td colSpan={6} align="center" className="py-12 text-muted">{emptyLabel}</DataTable.Td>
          </tr>
        ) : null}
        {rows.map((row) => {
          const order = row.job.order;
          const urgent = order.priority === "URGENT" || order.priority === "HIGH";
          return (
            <DataTable.Row key={row.job.key} href={hrefFor(row)} aria-label={`เปิดใบผลิต ${order.orderNumber}`} className="group/row">
              <DataTable.Td className="min-w-56 max-w-80">
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block">
                    <MockupThumbnail cover={orderMockupCover(order)} alt={`ม็อกอัพ ${order.orderNumber}`} size="sm" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link href={hrefFor(row)} className="rounded-sm font-semibold tabular-nums text-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                        {order.orderNumber}
                      </Link>
                      {urgent ? <Badge variant={order.priority === "URGENT" ? "destructive" : "warning"} size="sm">{order.priority === "URGENT" ? "ด่วน" : "สำคัญ"}</Badge> : null}
                      {order.blindShip ? <Badge variant="warning" size="sm">Blind ship</Badge> : null}
                    </div>
                    <p className="line-clamp-2 text-secondary" title={order.customerName ?? undefined}>{order.customerName ?? "ไม่ระบุลูกค้า"}</p>
                  </div>
                </div>
              </DataTable.Td>
              <DataTable.Td align="right" className="whitespace-nowrap">
                <span className="font-semibold tabular-nums text-strong">{(order.totalQuantity ?? 0).toLocaleString("th-TH")}</span>
                <span className="ml-1 text-muted">ตัว</span>
              </DataTable.Td>
              <DataTable.Td className="whitespace-nowrap">
                <DueTag dueInDays={row.dueInDays} dateLabel={order.deadline ? formatDateShort(order.deadline) : null} size="sm" />
              </DataTable.Td>
              <DataTable.Td className="min-w-48 max-w-64">
                <div className="space-y-2">
                  <CurrentCell row={row} />
                  <RouteRail rail={row.job.rail} />
                </div>
              </DataTable.Td>
              <DataTable.Td className="min-w-40 max-w-56"><OutsourceCell row={row} /></DataTable.Td>
              <DataTable.Td className="min-w-36 max-w-48">
                {row.responsible.length > 0 ? (
                  <span className="inline-flex items-start gap-1.5 text-secondary">
                    <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    <span>{row.responsible.join(", ")}</span>
                  </span>
                ) : <span className="text-muted">ยังไม่มีคนรับ</span>}
              </DataTable.Td>
            </DataTable.Row>
          );
        })}
      </DataTable.Body>
    </DataTable.Root>
  );
}
