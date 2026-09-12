"use client";

import { type ReactNode, type RefObject } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CalendarClock,
  PackageCheck,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { DueTag } from "@/components/ui/due-tag";
import { FilterChip } from "@/components/ui/filter-chip";
import { SearchInput } from "@/components/ui/search-input";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { orderMockupCover } from "@/lib/mockup";
import type { BoardOrderLike } from "@/lib/production-board";
import {
  type DeskLens,
  type DeskRow,
  type DeskStepLike,
  type DeskSummary,
} from "@/lib/production-desk";
import { type WorklistStationChip } from "@/lib/production-worklist";
import { ACTIVE_UNDERLINE, FOCUS_BUTTON, RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
import { cn, formatDateShort } from "@/lib/utils";
import type { DeskSort, DeskSortKey } from "@/lib/production-desk-sort";

import { CurrentCell, OutsourceCell, ResponsibleCell, RouteRail } from "./production-desk-cells";
export { CurrentCell, OutsourceCell, ResponsibleCell, RouteRail } from "./production-desk-cells";

export type ProductionDeskVariant = "current" | "a" | "b";

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
  variant = "current",
}: {
  summary: DeskSummary;
  lens: DeskLens;
  onSelectLens: (lens: DeskLens) => void;
  variant?: ProductionDeskVariant;
}) {
  return (
    <div className="flex min-w-0 gap-1 overflow-x-auto border-b border-divider" data-production-desk-tiles="" data-variant={variant} aria-label="กรองงานที่ต้องติดตาม">
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
              "inline-flex min-h-11 shrink-0 items-center gap-2.5 border-b-2 px-3 py-2 text-left transition-colors hover:bg-interactive-hover",
              FOCUS_BUTTON,
              on ? ACTIVE_UNDERLINE : "border-transparent",
            )}
          >
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-secondary">
              <Icon className={cn("h-4 w-4 shrink-0", value > 0 ? TILE_TEXT[tile.tone] : "text-muted")} aria-hidden="true" />
              {tile.label}
            </span>
            <span className={cn("text-sm font-semibold tabular-nums", value > 0 ? TILE_TEXT[tile.tone] : "text-muted")}>
              {value}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Virtual filter for all outsource stations. */
export const STATION_OUTSOURCE_ALL = "outsource";

function ChipCount({ count, overdue }: { count: number; overdue: number }) {
  return (
    <>
      <span className="tabular-nums text-muted">{count}</span>
      {overdue > 0 ? <span className="tabular-nums text-red-600 dark:text-red-400">· {overdue}</span> : null}
    </>
  );
}

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
  variant = "current",
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
  freshness?: ReactNode;
  variant?: ProductionDeskVariant;
}) {
  const inHouse = stations.filter((chip) => !chip.isOutsource);
  const outsource = stations.filter((chip) => chip.isOutsource);
  const outsourceCount = outsourceTotal;
  const outsourceActive = station === STATION_OUTSOURCE_ALL || outsource.some((chip) => chip.key === station);

  return (
    <div className="min-w-0 space-y-3" data-variant={variant}>
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          ref={searchInputRef}
          surface="field"
          placeholder="ค้นเลขออเดอร์หรือลูกค้า"
          defaultValue={searchDefault}
          onChange={(event) => onSearchChange(event.target.value)}
          containerClassName="w-full min-w-0 sm:max-w-md"
          aria-label="ค้นหางานผลิต"
        />
        {freshness ? <div className="ml-auto">{freshness}</div> : null}
      </div>
      <div className="flex min-w-0 gap-x-4 overflow-x-auto [&>button]:shrink-0">
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
        <div
          className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1", SUNK_PANEL, RADIUS.inner, variant !== "current" && "lg:col-span-2")}
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

export function DeskTable<S extends DeskStepLike, O extends BoardOrderLike<S>>({
  rows,
  sort,
  onSort,
  hrefFor,
  emptyLabel,
  variant = "current",
  onSelectRow,
  selectedRowKey,
}: {
  rows: readonly DeskRow<S, O>[];
  sort: DeskSort;
  onSort: (key: DeskSortKey, direction: "asc" | "desc") => void;
  hrefFor: (row: DeskRow<S, O>) => string;
  emptyLabel: string;
  variant?: ProductionDeskVariant;
  /** Read-only disclosure; absent on the live desk, which keeps its links. */
  onSelectRow?: (row: DeskRow<S, O>) => void;
  selectedRowKey?: string;
}) {
  const directionFor = (key: DeskSortKey) => sort.key === key ? sort.direction : null;
  const sideDetails = variant === "b";
  return (
    <DataTable.Root cellPadding="compact" className="min-w-0 max-w-full" data-production-desk-table="">
      <caption className="sr-only">{onSelectRow ? "รายการผลิต เรียงตามหัวคอลัมน์ และเปิดดูรายละเอียดจากเลขออเดอร์" : "รายการผลิต เรียงตามหัวคอลัมน์ และเปิดใบผลิตจากเลขออเดอร์"}</caption>
      <DataTable.Head>
        <tr>
          <DataTable.SortableTh direction={directionFor("order")} onSort={(dir) => onSort("order", dir)}>ใบงาน</DataTable.SortableTh>
          <DataTable.SortableTh className={sideDetails ? "hidden" : "hidden sm:table-cell"} align="right" direction={directionFor("quantity")} onSort={(dir) => onSort("quantity", dir)}>จำนวน</DataTable.SortableTh>
          <DataTable.SortableTh className={sideDetails ? "hidden" : "hidden sm:table-cell"} direction={directionFor("deadline")} onSort={(dir) => onSort("deadline", dir)}>กำหนดส่ง</DataTable.SortableTh>
          <DataTable.Th className="hidden sm:table-cell">ตอนนี้</DataTable.Th>
          <DataTable.Th className={sideDetails ? "hidden" : "hidden sm:table-cell"}>ร้านนอก</DataTable.Th>
          <DataTable.Th className={sideDetails ? "hidden" : "hidden sm:table-cell"}>ผู้รับผิดชอบ</DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body className={variant === "a" ? "[&_td]:py-2" : undefined}>
        {rows.length === 0 ? (
          <tr>
            <DataTable.Td colSpan={6} align="center" className="py-12 text-muted">{emptyLabel}</DataTable.Td>
          </tr>
        ) : null}
        {rows.map((row) => {
          const order = row.job.order;
          const urgent = order.priority === "URGENT" || order.priority === "HIGH";
          return (
            <DataTable.Row
              key={row.job.key}
              href={onSelectRow ? undefined : hrefFor(row)}
              aria-label={`${onSelectRow ? "เปิดดู" : "เปิดใบผลิต"} ${order.orderNumber}`}
              aria-selected={selectedRowKey ? selectedRowKey === row.job.key : undefined}
              onClick={onSelectRow ? (event) => {
                if ((event.target as HTMLElement).closest("a,button,summary,details") || window.getSelection()?.toString()) return;
                onSelectRow(row);
              } : undefined}
              className={cn("group/row", onSelectRow && "cursor-pointer", selectedRowKey === row.job.key && "bg-surface-muted")}
            >
              <DataTable.Td className="min-w-0 sm:min-w-56 sm:max-w-80">
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block">
                    <MockupThumbnail cover={orderMockupCover(order)} alt={`ม็อกอัพ ${order.orderNumber}`} size="sm" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {onSelectRow ? (
                        <Button type="button" variant="link" size="sm" className="justify-start px-0 tabular-nums text-strong" aria-label={`เปิดดู ${order.orderNumber}`} onClick={() => onSelectRow(row)}>
                          {order.orderNumber}
                        </Button>
                      ) : (
                        <Link href={hrefFor(row)} className="rounded-sm font-semibold tabular-nums text-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                          {order.orderNumber}
                        </Link>
                      )}
                      {urgent ? <Badge variant={order.priority === "URGENT" ? "destructive" : "warning"} size="sm">{order.priority === "URGENT" ? "ด่วน" : "สำคัญ"}</Badge> : null}
                      {order.blindShip ? <Badge variant="warning" size="sm">Blind ship</Badge> : null}
                    </div>
                    <p className="line-clamp-2 text-secondary" title={order.customerName ?? undefined}>{order.customerName ?? "ไม่ระบุลูกค้า"}</p>
                  </div>
                </div>
                <div className={cn("mt-3 space-y-2", !sideDetails && "sm:hidden")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <DueTag dueInDays={row.dueInDays} dateLabel={order.deadline ? formatDateShort(order.deadline) : null} size="sm" />
                    <span className="text-secondary tabular-nums">{(order.totalQuantity ?? 0).toLocaleString("th-TH")} ตัว</span>
                  </div>
                  {sideDetails ? <div className="sm:hidden"><CurrentCell row={row} mode="summary" /></div> : <CurrentCell row={row} mode={variant === "a" ? "disclosure" : "full"} />}
                  {!sideDetails ? (
                    <div className="space-y-2 border-t border-divider pt-2 text-sm">
                      <ResponsibleCell names={row.responsible} />
                      {row.outsource ? <OutsourceCell row={row} expanded /> : null}
                    </div>
                  ) : null}
                </div>
              </DataTable.Td>
              <DataTable.Td align="right" className={sideDetails ? "hidden" : "hidden whitespace-nowrap sm:table-cell"}>
                <span className="font-semibold tabular-nums text-strong">{(order.totalQuantity ?? 0).toLocaleString("th-TH")}</span>
                <span className="ml-1 text-muted">ตัว</span>
              </DataTable.Td>
              <DataTable.Td className={sideDetails ? "hidden" : "hidden whitespace-nowrap sm:table-cell"}>
                <DueTag dueInDays={row.dueInDays} dateLabel={order.deadline ? formatDateShort(order.deadline) : null} size="sm" />
              </DataTable.Td>
              <DataTable.Td className="hidden min-w-48 max-w-72 sm:table-cell">
                <div className="space-y-2">
                  <CurrentCell row={row} mode={variant === "current" ? "full" : variant === "a" ? "disclosure" : "summary"} />
                  {variant === "current" && <RouteRail rail={row.job.rail} />}
                </div>
              </DataTable.Td>
              <DataTable.Td className={sideDetails ? "hidden" : "hidden min-w-40 max-w-56 sm:table-cell"}><OutsourceCell row={row} /></DataTable.Td>
              <DataTable.Td className={sideDetails ? "hidden" : "hidden min-w-36 max-w-48 sm:table-cell"}>
                <ResponsibleCell names={row.responsible} />
              </DataTable.Td>
            </DataTable.Row>
          );
        })}
      </DataTable.Body>
    </DataTable.Root>
  );
}
