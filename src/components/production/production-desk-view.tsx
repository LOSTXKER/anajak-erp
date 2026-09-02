"use client";

/**
 * โต๊ะงานหัวหน้า — ตัววาด (รับ props ล้วน ไม่ยิงข้อมูล) ของ `/production` แบบ A
 * เบสเคาะ 2026-09-02 จากหน้าลอง /proto/production-module:
 *   · ตัวเลขใหญ่ 4 ช่องคือตัวกรอง (เลยกำหนด · ติดปัญหา · ของร้านนอกครบกำหนด · พร้อมส่ง)
 *   · รายการเป็นตาราง 8 คอลัมน์ กองตามความรีบเป็นหัวกลุ่มในตารางเดียว
 *   · ไม่มีปุ่มในแถว — กดทั้งแถวเปิดใบผลิต (ลูกศรท้ายแถว)
 * กฎ 3 ชั้น docs/DESIGN.md §ลำดับความสำคัญทางสายตา: ตัวเลข/ป้ายกำหนดส่ง/ชิปขั้น = ชั้น 1
 */

import { Fragment, type ReactNode, type RefObject } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
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
  DESK_PILES,
  type DeskLens,
  type DeskRow,
  type DeskStepLike,
  type DeskSummary,
} from "@/lib/production-desk";
import { productionWorklistProgress, type WorklistStationChip } from "@/lib/production-worklist";
import { cn } from "@/lib/utils";

/* ───────────────────────── ตัวเลข 4 ช่อง = ตัวกรอง ───────────────────────── */

const TILES: {
  key: Exclude<DeskLens, "all">;
  label: string;
  icon: LucideIcon;
  tone: "danger" | "warning" | "success";
  hint: string;
}[] = [
  { key: "late", label: "เลยกำหนดส่ง", icon: CalendarClock, tone: "danger", hint: "ลูกค้ารออยู่" },
  { key: "blocked", label: "ติดปัญหา", icon: AlertTriangle, tone: "danger", hint: "รอหัวหน้าตัดสิน" },
  { key: "outsource", label: "ของร้านนอกครบกำหนด", icon: Truck, tone: "warning", hint: "ต้องตาม / รับกลับ" },
  { key: "ready", label: "พร้อมส่ง", icon: PackageCheck, tone: "success", hint: "แพ็กเสร็จแล้ว" },
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
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-production-desk-tiles="">
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
              "card-surface card-surface-hover rounded-2xl p-4 text-left transition-colors",
              on && "ring-2 ring-inset ring-blue-600 dark:ring-blue-400",
            )}
          >
            <p className="flex items-center gap-2 text-xs font-medium text-muted">
              <Icon className={cn("h-4 w-4", value > 0 ? TILE_TEXT[tile.tone] : "text-muted")} aria-hidden="true" />
              {tile.label}
            </p>
            <p className={cn("mt-1 text-3xl font-semibold tabular-nums", value > 0 ? TILE_TEXT[tile.tone] : "text-muted")}>
              {value}
            </p>
            <p className="mt-0.5 text-xs text-muted">{value > 0 ? tile.hint : "ไม่มี"}</p>
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────────── แถบค้นหา + ชิปขั้นงาน ───────────────────────── */

export function DeskToolbar({
  searchDefault,
  searchInputRef,
  onSearchChange,
  station,
  stations,
  onSelectStation,
  total,
  freshness,
}: {
  searchDefault: string;
  searchInputRef: RefObject<HTMLInputElement | null> | null;
  onSearchChange: (value: string) => void;
  station: string;
  stations: readonly WorklistStationChip[];
  onSelectStation: (station: string) => void;
  total: number;
  freshness?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchInput
        ref={searchInputRef}
        surface="raised"
        placeholder="ค้นเลขออเดอร์ / ลูกค้า"
        defaultValue={searchDefault}
        onChange={(event) => onSearchChange(event.target.value)}
        containerClassName="w-full sm:w-72"
        aria-label="ค้นหางานผลิต"
      />
      <div className="-mb-px flex min-w-0 flex-1 flex-wrap items-center gap-x-3 border-b border-divider">
        <FilterChip selected={station === ""} onClick={() => onSelectStation("")}>
          ทุกขั้น <span className="tabular-nums text-muted">{total}</span>
        </FilterChip>
        {stations.map((chip) => (
          <FilterChip
            key={chip.key}
            selected={station === chip.key}
            onClick={() => onSelectStation(chip.key)}
            icon={chip.isOutsource ? <Truck className="h-4 w-4" /> : undefined}
            aria-label={`${chip.label} ${chip.count} งาน${chip.overdue ? ` เลยกำหนด ${chip.overdue}` : ""} · กดเพื่อกรอง`}
          >
            {chip.label} <span className="tabular-nums text-muted">{chip.count}</span>
            {chip.overdue > 0 ? (
              <span className="tabular-nums text-red-600 dark:text-red-400">· {chip.overdue}</span>
            ) : null}
          </FilterChip>
        ))}
      </div>
      {freshness ? <div className="ml-auto">{freshness}</div> : null}
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
  groups,
  hrefFor,
  emptyLabel,
}: {
  groups: readonly { key: string; label: string; rows: DeskRow<S, O>[] }[];
  hrefFor: (row: DeskRow<S, O>) => string;
  emptyLabel: string;
}) {
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
  const showGroupHeads = groups.length > 1 || (groups[0] && groups[0].key !== DESK_PILES[3]!.key);
  return (
    <DataTable.Root
      // ระยะเซลล์ 12px และไม่ล็อกความกว้างขั้นต่ำ — 8 คอลัมน์ต้องพอดีจอ 1440 โดยไม่เลื่อนแนวนอน
      // (วัดจริง 2026-09-02: min-w ต่อคอลัมน์ทำให้ตารางกว้าง 1408 บนการ์ด 1364)
      className="min-w-0 max-w-full [&_td]:px-3 [&_th:not([aria-sort])]:px-3"
      data-production-desk-table=""
    >
      <DataTable.Head>
        <tr>
          <DataTable.Th>ใบงาน</DataTable.Th>
          <DataTable.Th align="right">จำนวน</DataTable.Th>
          <DataTable.Th>กำหนดส่ง</DataTable.Th>
          <DataTable.Th>เส้นทางงาน</DataTable.Th>
          <DataTable.Th>ตอนนี้อยู่ที่</DataTable.Th>
          <DataTable.Th>ร้านนอก</DataTable.Th>
          <DataTable.Th>ผู้รับผิดชอบ</DataTable.Th>
          <DataTable.Th align="right">
            <span className="sr-only">เปิดใบผลิต</span>
          </DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body>
        {total === 0 ? (
          <tr>
            <DataTable.Td colSpan={8} align="center" className="py-10 text-muted">
              {emptyLabel}
            </DataTable.Td>
          </tr>
        ) : null}
        {groups.map((group) => (
          <Fragment key={group.key}>
            {showGroupHeads ? (
              <tr className="bg-surface-muted">
                <th colSpan={8} scope="rowgroup" className="px-4 py-2 text-left text-xs font-semibold text-strong">
                  {group.label}
                  <span className="ml-2 font-normal tabular-nums text-muted">{group.rows.length} ใบ</span>
                </th>
              </tr>
            ) : null}
            {group.rows.map((row) => {
              const order = row.job.order;
              const urgent = order.priority === "URGENT" || order.priority === "HIGH";
              return (
                <DataTable.Row
                  key={row.job.key}
                  href={hrefFor(row)}
                  aria-label={`เปิดใบผลิต ${order.orderNumber}`}
                  className={cn("group/row", row.blocked && "bg-red-50/40 dark:bg-red-950/15")}
                >
                  <DataTable.Td>
                    <div className="flex items-center gap-3">
                      <MockupThumbnail cover={orderMockupCover(order)} alt={`ม็อกอัพ ${order.orderNumber}`} size="md" />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold tabular-nums text-strong">{order.orderNumber}</span>
                          {urgent ? (
                            <Badge variant={order.priority === "URGENT" ? "destructive" : "warning"} size="sm">
                              {order.priority === "URGENT" ? "ด่วน" : "สำคัญ"}
                            </Badge>
                          ) : null}
                          {order.blindShip ? (
                            <Badge variant="warning" size="sm">
                              Blind ship
                            </Badge>
                          ) : null}
                        </p>
                        <p className="truncate text-secondary">{order.customerName ?? "ไม่ระบุลูกค้า"}</p>
                      </div>
                    </div>
                  </DataTable.Td>
                  <DataTable.Td align="right" className="whitespace-nowrap">
                    <span className="text-base font-semibold tabular-nums text-strong">
                      {(order.totalQuantity ?? 0).toLocaleString("th-TH")}
                    </span>
                    <span className="ml-1 text-xs text-muted">ตัว</span>
                  </DataTable.Td>
                  <DataTable.Td className="whitespace-nowrap">
                    <DueTag dueInDays={row.dueInDays} dateLabel={deadlineLabel(order.deadline)} size="sm" />
                  </DataTable.Td>
                  <DataTable.Td className="w-28">
                    <RouteRail rail={row.job.rail} />
                  </DataTable.Td>
                  <DataTable.Td className="max-w-56">
                    <CurrentCell row={row} />
                  </DataTable.Td>
                  <DataTable.Td className="max-w-48">
                    <OutsourceCell row={row} />
                  </DataTable.Td>
                  <DataTable.Td className="max-w-40">
                    {row.responsible.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-secondary">
                        <UserRound className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                        {row.responsible.join(", ")}
                      </span>
                    ) : (
                      <span className="text-muted">ยังไม่มีคนรับ</span>
                    )}
                  </DataTable.Td>
                  <DataTable.Td align="right" className="w-12 pl-0">
                    <ChevronRight
                      className="ml-auto h-4 w-4 text-muted transition-colors group-hover/row:text-strong"
                      aria-hidden="true"
                    />
                  </DataTable.Td>
                </DataTable.Row>
              );
            })}
          </Fragment>
        ))}
      </DataTable.Body>
    </DataTable.Root>
  );
}

function deadlineLabel(deadline: Date | string | null): string | null {
  if (!deadline) return null;
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}
