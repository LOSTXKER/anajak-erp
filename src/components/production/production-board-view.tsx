"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import {
  DASHED,
  FOCUS_BUTTON,
  INTERACTIVE_HOVER,
  INTERACTIVE_PRESSED,
  INTERACTIVE_SELECTED,
} from "@/components/ui/tokens";
import { cn, formatDateShort } from "@/lib/utils";
import {
  BOARD_SORTS,
  STATION_ALL,
  buildBoardColumns,
  type BoardColumnCard,
  type BoardJob,
  type BoardMyWork,
  type BoardSpot,
  type BoardStation,
  type BoardStepLike,
} from "@/lib/production-board";
import { ChevronRight, Clock, Factory, User, X } from "lucide-react";

/* ============================================================
   บอร์ดโรงงาน (ใบงาน PC1.2 · เบสเคาะ 2026-08-15 "เอาแบบ A บอร์ดโรงงาน")

   คอลัมน์ = สถานีจริง เรียงซ้ายไปขวาตามทางเดินของงาน · การ์ดในคอลัมน์เรียง
   ตามกำหนดส่ง · เปิดจอเดียวเห็นทั้งโรงงานว่าอะไรกองอยู่ตรงไหน

   mockup v2 (เบสอนุมัติ 2026-08-22): บอร์ดเป็นมุมหลักของ /production โดยมี
   มุม "รายการ" (ProductionControlWorklist) สลับผ่านตัวเลือกที่หน้าหลัก —
   ทับมติ 2026-08-15 "บอร์ดล้วน" · การ์ดเพิ่ม thumbnail ลาย + ผู้รับผิดชอบ

   กดหัวคอลัมน์ = โฟกัสสายนั้นสายเดียว (อยู่ใน URL ตั้งค้างที่จอโรงงานได้)
   ซึ่งยังเป็นบอร์ดเหมือนเดิม แค่เหลือคอลัมน์เดียว ไม่ใช่เปลี่ยนรูปแบบ

   จอแคบไม่ยัดบอร์ดแนวนอน — คอลัมน์ซ้อนลงล่างเป็นสถานีละช่วง
   ============================================================ */

export type BoardActions<S extends BoardStepLike> = {
  onStart: (step: S) => void;
  onComplete: (step: S) => void;
  onOpenQty: (step: S) => void;
  onQuickPass: (spot: BoardSpot<S>, orderNumber: string) => void;
  onOutsourceSend: (outsourceId: string) => void;
  onOutsourceQcPass: (outsourceId: string, vendorName: string) => void;
  onOutsourceQcFail: (outsourceId: string) => void;
  onReceiveBack: (orderId: string, outsource: OutsourceLike) => void;
  onCreateProduction: (orderId: string) => void;
  onCountQc: (orderId: string) => void;
  onAdvanceToReady: (orderId: string) => void;
};

export type OutsourceLike = {
  id: string;
  status: string;
  description: string;
  quantity: number;
  expectedBackAt?: Date | string | null;
  vendor: { name: string };
};

export type BoardStepFull = BoardStepLike & {
  outsourceOrders: readonly OutsourceLike[];
  printRunItems: readonly { printRun: { runNumber: string; status: string } }[];
};

export type BoardOrderFull = {
  id: string;
  orderNumber: string;
  title: string;
  deadline: Date | string | null;
  priority?: string | null;
  internalStatus: string;
  blindShip?: boolean;
  customerName?: string | null;
  totalQuantity?: number;
  /** รูปลายหนึ่งรูปสำหรับ thumbnail การ์ด (mockup v2) — มีเฉพาะ kanban ที่ select prints มา */
  items?: readonly {
    prints?: readonly {
      designImageUrl?: string | null;
      artwork?: { imageUrl?: string | null } | null;
    }[];
  }[];
};

export type BoardJobOf<S extends BoardStepFull> = BoardJob<BoardOrderFull, S>;

export type BoardPermissions = {
  /** แตะขั้นตอนได้ (ทีมผลิตขึ้นไป — ตรง server updateStep) */
  canTouchStep: boolean;
  /** เปิดใบผลิต / ข้ามด่าน / ตัดสิน QC ร้านนอก (หัวหน้าขึ้นไป) */
  canSupervise: boolean;
  /** ตรวจนับ QC (ทีมผลิตขึ้นไป — ตรง server qc.create) */
  canCountQc: boolean;
  /** เลื่อน PACKING → READY_TO_SHIP */
  canAdvancePacking: boolean;
  meId: string | undefined;
};

/* ── การ์ดงานบนบอร์ด ──
   เบสสั่ง 2026-08-15: "แสดงแค่ข้อมูลที่จำเป็น ไม่รก ไม่ต้องมี CTA เพราะเราจะกดเข้าไปดูเป็นหลัก"
   การ์ดจึงเป็นลิงก์ทั้งใบไปยังที่ที่ลงมือได้จริง — ปุ่มลงมือทั้งชุดอยู่ในหน้าใบผลิต ── */
function cardHref(job: BoardJobOf<BoardStepFull>, spot: BoardSpot<BoardStepFull>) {
  if (spot.productionId) return `/production/${spot.productionId}`;
  if (spot.stationKey === "post:pack" || spot.stationKey === "post:ship") {
    return `/orders/${job.order.id}?tab=delivery`;
  }
  if (spot.kind === "queue") return `/orders/${job.order.id}`;
  return `/orders/${job.order.id}?tab=production`;
}

/** รูปลายแรกที่ใช้ได้จากออเดอร์ — thumbnail การ์ดบอร์ด (mockup v2 §1)
    designImageUrl ของลายพิมพ์มาก่อน ไม่มีค่อยใช้รูปคลังลายลูกค้า · ไม่มีเลย = ไม่วาด */
function orderThumbImage(order: BoardOrderFull): string | null {
  for (const item of order.items ?? []) {
    for (const print of item.prints ?? []) {
      const found = [print.designImageUrl, print.artwork?.imageUrl].find(Boolean);
      if (found) return found;
    }
  }
  return null;
}

function BoardCard<S extends BoardStepFull>({
  card,
}: {
  card: BoardColumnCard<BoardOrderFull, S>;
}) {
  const { job, spot } = card;
  const step = spot.step;
  const otherLanes = job.spots.length - 1;
  const thumb = orderThumbImage(job.order);
  const assignee = step?.assignedTo ?? null;
  const qty =
    step?.qtyTotal != null && step.qtyTotal > 0
      ? `${step.qtyDone ?? 0}/${step.qtyTotal}`
      : spot.totalSteps > 1
        ? `${spot.doneSteps}/${spot.totalSteps} ขั้น`
        : null;
  const blocked = spot.waitingOn.length > 0;

  return (
    <Link
      href={cardHref(job as BoardJobOf<BoardStepFull>, spot as BoardSpot<BoardStepFull>)}
      className={cn(
        "card-surface card-surface-hover relative block rounded-xl p-3",
        FOCUS_BUTTON,
      )}
    >
      {thumb ? (
        <span
          aria-hidden="true"
          className="absolute right-2.5 top-2.5 block h-9 w-9 overflow-hidden rounded-lg border border-border bg-white"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
          />
        </span>
      ) : null}
      <span className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", thumb && "pr-11")}>
        <span className="text-sm font-semibold tabular-nums text-strong">
          {job.order.orderNumber}
        </span>
        {job.overdue ? (
          <Badge variant="destructive" size="sm">เลยกำหนด</Badge>
        ) : job.order.priority === "URGENT" ? (
          <Badge variant="destructive" size="sm">ด่วน</Badge>
        ) : job.bucket === "today" ? (
          <Badge variant="warning" size="sm">ส่งวันนี้</Badge>
        ) : null}
        {job.order.blindShip &&
          (spot.stationKey.startsWith("post:") || spot.stationKey === "lane:PACK") && (
            <Badge variant="destructive" size="sm">ห้ามใส่ชื่อ Anajak</Badge>
          )}
      </span>

      <span className={cn("mt-1 block truncate text-sm text-secondary", thumb && "pr-11")}>
        {job.order.customerName || job.order.title || "ไม่ระบุลูกค้า"}
      </span>

      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
        {/* ชื่องานซ้ำกับบรรทัดลูกค้าเฉพาะตอน fallback (ไม่มีชื่อลูกค้า) — โชว์ครั้งเดียว */}
        {job.order.title && job.order.customerName && (
          <span className="max-w-[60%] truncate">{job.order.title}</span>
        )}
        {job.order.totalQuantity ? (
          <span className="tabular-nums">{job.order.totalQuantity.toLocaleString("th-TH")} ตัว</span>
        ) : null}
        <span
          className={cn("tabular-nums", job.overdue && "font-medium text-red-700 dark:text-red-300")}
        >
          {job.order.deadline ? formatDateShort(job.order.deadline) : "ไม่กำหนดส่ง"}
        </span>
        {otherLanes > 0 && <span>+{otherLanes} สาย</span>}
      </span>

      {blocked ? (
        <span className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{spot.waitingOn[0]}</span>
        </span>
      ) : step ? (
        <span className="mt-2 flex items-center gap-2 text-xs">
          <span
            aria-hidden="true"
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              step.status === "IN_PROGRESS"
                ? "bg-blue-500"
                : step.status === "FAILED"
                  ? "bg-red-600"
                  : "bg-border",
            )}
          />
          <span className="min-w-0 flex-1 truncate text-secondary">
            {step.customStepName || spot.stationLabel}
          </span>
          {qty && <span className="shrink-0 tabular-nums text-muted">{qty}</span>}
          {assignee ? (
            <span
              title={`ผู้รับผิดชอบ: ${assignee.name}`}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-2xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
            >
              {assignee.name.slice(0, 1)}
            </span>
          ) : null}
        </span>
      ) : null}
    </Link>
  );
}

/* ── คอลัมน์สถานี ── */
function BoardColumnView<S extends BoardStepFull>({
  station,
  cards,
  focused,
  onFocus,
}: {
  station: BoardStation;
  cards: readonly BoardColumnCard<BoardOrderFull, S>[];
  focused: boolean;
  onFocus: (key: string) => void;
}) {
  return (
    <section
      aria-labelledby={`col-${station.key || "queue"}`}
      className={cn(
        "flex min-w-0 flex-col gap-2",
        // จอกว้าง: คอลัมน์กว้างคงที่เลื่อนแนวนอน · จอแคบ: เต็มความกว้างซ้อนลงล่าง
        focused ? "w-full" : "w-full shrink-0 lg:w-[286px]",
      )}
    >
      <button
        type="button"
        aria-pressed={focused}
        onClick={() => onFocus(focused ? STATION_ALL : station.key)}
        className={cn(
          CONTROL_MIN_H,
          FOCUS_BUTTON,
          "flex items-center gap-2 rounded-xl px-3 py-2 text-left",
          focused
            ? INTERACTIVE_SELECTED
            : cn("bg-surface-muted", INTERACTIVE_HOVER, INTERACTIVE_PRESSED),
        )}
        title={
          focused
            ? `กดอีกครั้งเพื่อดูทุกสาย`
            : `ดูเฉพาะสาย${station.label}`
        }
      >
        <span id={`col-${station.key || "queue"}`} className="min-w-0 flex-1 truncate text-sm font-semibold">
          {station.label}
          {station.isOutsource && (
            <span className="ml-1.5 text-xs font-normal text-muted">ร้านนอก</span>
          )}
        </span>
        {station.overdue > 0 && (
          <span className="shrink-0 rounded-full bg-red-700 px-1.5 text-2xs font-semibold tabular-nums text-white">
            เลย {station.overdue}
          </span>
        )}
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {station.count.toLocaleString("th-TH")}
        </span>
      </button>

      <div
        className={cn(
          "flex flex-col gap-2",
          focused && "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3",
        )}
      >
        {cards.map((card) => (
          <BoardCard key={card.key} card={card} />
        ))}
      </div>
    </section>
  );
}

function MyWork({ items }: { items: readonly BoardMyWork[] }) {
  return (
    <section className="space-y-2" aria-labelledby="production-my-work">
      <h2
        id="production-my-work"
        className="flex items-center gap-2 text-sm font-semibold text-strong"
      >
        <User className="h-4 w-4 text-blue-700 dark:text-blue-300" aria-hidden="true" />
        งานของฉัน
        <span className="rounded-full bg-blue-100 px-1.5 text-xs tabular-nums text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
          {items.length}
        </span>
      </h2>
      <ul className="card-surface overflow-hidden rounded-2xl">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={`/production/${item.productionId}`}
              className={cn(
                CONTROL_MIN_H,
                INTERACTIVE_HOVER,
                INTERACTIVE_PRESSED,
                FOCUS_BUTTON,
                "flex items-center gap-3 px-4 py-3",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-strong">
                  {item.stepName}
                </span>
                <span className="mt-0.5 block text-xs tabular-nums text-muted">
                  {item.orderNumber}
                </span>
              </span>
              <Badge variant={item.status === "IN_PROGRESS" ? "accent" : "default"} size="sm">
                {item.status === "IN_PROGRESS" ? "ทำต่อ" : "เริ่มงาน"}
              </Badge>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── หน้าตาหลัก ── */
export function ProductionBoardView<S extends BoardStepFull>({
  board,
  jobs,
  station,
  searchDefault,
  searchInputRef,
  onSelectStation,
  onSearchChange,
  sort,
  onSelectSort,
}: {
  board: {
    stations: readonly BoardStation[];
    myWork: readonly BoardMyWork[];
    totalJobs: number;
    jobs: readonly BoardJobOf<S>[];
  };
  jobs: readonly BoardJobOf<S>[];
  station: string;
  searchDefault: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onSelectStation: (key: string) => void;
  onSearchChange: (value: string) => void;
  sort: string;
  onSelectSort: (value: string) => void;
}) {
  // สายที่ URL ชี้มาแต่ไม่มีอยู่จริง (ลิงก์เก่า/มือแก้) ถือว่าไม่ได้โฟกัส — ไม่ทำจอว่างลอย ๆ
  const focused = board.stations.some((entry) => entry.key === station) ? station : STATION_ALL;
  const visibleStations = focused
    ? board.stations.filter((entry) => entry.key === focused)
    : board.stations;
  const columns = buildBoardColumns(jobs, visibleStations);
  const hasCards = columns.some((column) => column.cards.length > 0);

  return (
    <div className="space-y-4">
      {/* โซนบนเหลือเฉพาะเครื่องมือ — ไม่มีแถบแจ้งเตือนหรือคำอธิบายยาว (เบสสั่ง 2026-08-15)
          งานที่ต้องรีบยังเห็นจากป้าย "เลย N" บนหัวคอลัมน์ และตัวกรอง "ต้องรีบ" */}
      <Toolbar>
        <ToolbarGroup className="w-full @2xl:w-auto">
          <SearchInput
            ref={searchInputRef}
            defaultValue={searchDefault}
            onChange={(event) => onSearchChange(event.target.value)}
            surface="raised"
            placeholder="ค้นเลขออเดอร์ หรือ ชื่อลูกค้า"
            aria-label="ค้นหางานบนบอร์ดผลิต"
            className="w-full @2xl:w-64"
          />
        </ToolbarGroup>
        <ToolbarGroup>
          <Select
            surface="raised"
            aria-label="เรียงงาน"
            value={sort}
            onChange={(event) => onSelectSort(event.target.value)}
          >
            {BOARD_SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </Select>
          {focused && (
            <button
              type="button"
              onClick={() => onSelectStation(STATION_ALL)}
              className={cn(
                CONTROL_MIN_H,
                FOCUS_BUTTON,
                INTERACTIVE_HOVER,
                INTERACTIVE_PRESSED,
                "inline-flex items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-secondary",
              )}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              ดูทุกสาย
            </button>
          )}
        </ToolbarGroup>
      </Toolbar>

      {board.myWork.length > 0 && <MyWork items={board.myWork} />}

      {!hasCards ? (
        <div className={cn(DASHED, "rounded-2xl py-12 text-center")}>
          <Factory className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-strong">
            {searchDefault || focused ? "ไม่มีงานตรงกับที่เลือก" : "ยังไม่มีงานในไลน์ผลิต"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {searchDefault || focused
              ? "ล้างคำค้นหรือกดดูทุกสาย"
              : "งานจะปรากฏที่นี่เมื่อออเดอร์ผ่านด่านพร้อมผลิต"}
          </p>
        </div>
      ) : (
        <div
          // จอกว้าง: บอร์ดเลื่อนแนวนอนในกรอบของตัวเอง หน้าไม่เลื่อนซ้ายขวาตาม
          // จอแคบ: คอลัมน์ซ้อนลงล่าง ไม่ยัดบอร์ดแนวนอนให้นิ้วต้องปัดสองแกน
          className={cn(
            "flex flex-col gap-4",
            !focused && "lg:flex-row lg:gap-3 lg:overflow-x-auto lg:pb-2",
          )}
        >
          {columns.map((column) => (
            <BoardColumnView
              key={column.station.key || "queue"}
              station={column.station}
              cards={column.cards}
              focused={Boolean(focused)}
              onFocus={onSelectStation}
            />
          ))}
        </div>
      )}
    </div>
  );
}
