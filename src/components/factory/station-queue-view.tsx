"use client";

import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FOCUS_BUTTON, TINT, INTERACTIVE_HOVER } from "@/components/ui/tokens";
import { cn, formatDateShort } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock3,
} from "lucide-react";

export type StationQueueItem = {
  key: string;
  orderId: string;
  productionId: string | null;
  stepId: string | null;
  orderNumber: string;
  customerName: string | null;
  deadline: Date | string | null;
  priority: string | null;
  stepLabel: string;
  status: "active" | "ready" | "blocked";
  qtyDone: number | null;
  qtyTotal: number | null;
  overdue: boolean;
  /** เหตุผลจาก board readiness/gate เท่านั้น — ห้ามแต่งข้อความแทนข้อมูลจริง */
  waitingOn: readonly string[];
  /** หมายเหตุของ ProductionStep จริง; ไม่มีข้อมูลให้เป็น null และไม่เดา fallback */
  note: string | null;
};

export type StationQueueSelection = {
  productionId?: string | null;
  orderId?: string | null;
  stepId?: string | null;
};

export type StationQueueGroups = {
  selected: StationQueueItem | null;
  active: StationQueueItem[];
  ready: StationQueueItem[];
  blocked: StationQueueItem[];
};

export function tagStationQueueBuckets<T>(queue: {
  active: readonly T[];
  ready: readonly T[];
  blocked: readonly T[];
}): Array<{ entry: T; status: StationQueueItem["status"] }> {
  return [
    ...queue.active.map((entry) => ({ entry, status: "active" as const })),
    ...queue.ready.map((entry) => ({ entry, status: "ready" as const })),
    ...queue.blocked.map((entry) => ({ entry, status: "blocked" as const })),
  ];
}

function matchesSelection(
  item: StationQueueItem,
  selection?: StationQueueSelection,
): boolean {
  if (selection?.productionId) {
    return (
      item.productionId === selection.productionId &&
      (!selection.stepId || item.stepId === selection.stepId)
    );
  }
  return Boolean(selection?.orderId && item.orderId === selection.orderId);
}

/**
 * แยกกลุ่มโดยคงลำดับที่ service จัดมา และตัดบริบทที่เปิดอยู่ไม่ให้ซ้ำใน rail.
 * Pure เพื่อให้ layout กับ contract test ใช้ source เดียวกัน.
 */
export function groupStationQueueItems(
  items: readonly StationQueueItem[],
  selection?: StationQueueSelection,
): StationQueueGroups {
  let selected: StationQueueItem | null = null;
  const active: StationQueueItem[] = [];
  const ready: StationQueueItem[] = [];
  const blocked: StationQueueItem[] = [];

  for (const item of items) {
    if (matchesSelection(item, selection)) {
      selected ??= item;
      continue;
    }
    if (item.status === "active") active.push(item);
    else if (item.status === "ready") ready.push(item);
    else blocked.push(item);
  }

  return { selected, active, ready, blocked };
}

function itemDetails(item: StationQueueItem): string[] {
  return [
    ...new Set(
      [...item.waitingOn, item.note]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

function QueueCard({
  item,
  onOpen,
  compact = false,
}: {
  item: StationQueueItem;
  onOpen: (item: StationQueueItem) => void;
  compact?: boolean;
}) {
  const qty =
    item.qtyTotal != null && item.qtyTotal > 0
      ? `${item.qtyDone ?? 0}/${item.qtyTotal}`
      : null;
  const details = item.status === "blocked" ? itemDetails(item) : [];

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        FOCUS_BUTTON,
        "group flex min-h-20 w-full touch-manipulation items-center gap-3 rounded-lg border text-left transition-colors",
        compact ? "p-3" : "p-4",
        item.status === "active"
          ? cn(TINT.info, INTERACTIVE_HOVER)
          : item.status === "blocked"
            ? cn(TINT.warning, "hover:border-amber-700 hover:bg-amber-950/55")
            : "border-border bg-surface hover:border-border-strong hover:bg-interactive-hover",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-semibold tabular-nums text-strong",
              compact ? "text-sm" : "text-base",
            )}
          >
            {item.orderNumber}
          </span>
          {item.overdue ? (
            <Badge variant="destructive" size="sm">
              เลยกำหนด
            </Badge>
          ) : item.priority === "URGENT" ? (
            <Badge variant="destructive" size="sm">
              ด่วน
            </Badge>
          ) : null}
          {item.status === "active" ? (
            <Badge variant="accent" size="sm">
              กำลังทำ
            </Badge>
          ) : item.status === "blocked" ? (
            <Badge variant="warning" size="sm">
              ติดปัญหา
            </Badge>
          ) : null}
        </span>
        <span className="mt-1 block truncate text-sm font-medium text-secondary">
          {item.customerName || "ไม่ระบุลูกค้า"}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>{item.stepLabel}</span>
          <span
            className={cn(
              "tabular-nums",
              item.overdue && "font-medium text-red-300",
            )}
          >
            {item.deadline
              ? `ส่ง ${formatDateShort(item.deadline)}`
              : "ไม่กำหนดส่ง"}
          </span>
          {qty && <span className="tabular-nums sm:hidden">{qty} ตัว</span>}
        </span>
        {details.length > 0 ? (
          <span className="mt-2 block space-y-1 text-xs text-amber-200">
            {details.slice(0, compact ? 2 : 3).map((detail) => (
              <span key={detail} className="block line-clamp-2 whitespace-pre-line">
                {detail}
              </span>
            ))}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {qty && !compact ? (
          <span className="hidden text-right sm:block">
            <span className="block text-sm font-semibold tabular-nums text-strong">
              {qty}
            </span>
            <span className="block text-xs text-muted">ตัว</span>
          </span>
        ) : null}
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-muted group-hover:text-strong">
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}

function QueueGroup({
  id,
  region,
  title,
  hint,
  emptyTitle,
  emptyDescription,
  emptyIcon: EmptyIcon,
  items,
  onOpen,
}: {
  id: string;
  region: "active" | "ready" | "blocked";
  title: string;
  hint: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: typeof CheckCircle2;
  items: readonly StationQueueItem[];
  onOpen: (item: StationQueueItem) => void;
}) {
  return (
    <section
      aria-labelledby={id}
      data-station-region={region}
      className="card-surface rounded-2xl p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3 border-b border-divider pb-4">
        <div>
          <h2 id={id} className="text-lg font-semibold text-strong">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-muted">{hint}</p>
        </div>
        <Badge variant="default" size="sm" className="tabular-nums">
          {items.length.toLocaleString("th-TH")}
        </Badge>
      </div>
      {items.length === 0 ? (
        <div className="mt-4 rounded-lg bg-surface-muted">
          <EmptyState
            density="compact"
            icon={EmptyIcon}
            title={emptyTitle}
            description={emptyDescription}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <QueueCard key={item.key} item={item} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

export function StationQueueRailGroup({
  id,
  region,
  title,
  items,
  emptyLabel,
  onOpen,
  tone = "neutral",
}: {
  id: string;
  region: "active" | "ready" | "blocked";
  title: string;
  items: readonly StationQueueItem[];
  emptyLabel: string;
  onOpen: (item: StationQueueItem) => void;
  tone?: "neutral" | "warning";
}) {
  return (
    <section aria-labelledby={id} data-station-region={region}>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h3
          id={id}
          className={cn(
            "text-sm font-semibold",
            tone === "warning" ? "text-amber-200" : "text-strong",
          )}
        >
          {title}
        </h3>
        <span className="text-xs font-medium tabular-nums text-muted">
          {items.length.toLocaleString("th-TH")}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong px-3 py-4 text-center text-xs text-muted">
          {emptyLabel}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <QueueCard key={item.key} item={item} compact onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

export function StationQueueView({
  stationLabel,
  stationDescription,
  icon: Icon,
  items,
  onOpen,
}: {
  stationLabel: string;
  stationDescription: string;
  icon: ComponentType<{ className?: string }>;
  items: readonly StationQueueItem[];
  onOpen: (item: StationQueueItem) => void;
}) {
  const { active, ready, blocked } = groupStationQueueItems(items);

  return (
    <div className="space-y-5" data-station-queue-view>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-module-production-surface text-module-production-text">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold text-strong">
              {stationLabel}
            </h1>
            <p className="mt-0.5 text-sm text-muted">{stationDescription}</p>
          </div>
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-2 text-center text-sm">
          <div className={cn(TINT.info, "rounded-lg border px-3 py-2")}>
            <dt className="text-xs text-blue-300">กำลังทำ</dt>
            <dd className="font-semibold tabular-nums text-strong">
              {active.length.toLocaleString("th-TH")}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <dt className="text-xs text-muted">พร้อม</dt>
            <dd className="font-semibold tabular-nums text-strong">
              {ready.length.toLocaleString("th-TH")}
            </dd>
          </div>
          <div className={cn(TINT.warning, "rounded-lg border px-3 py-2")}>
            <dt className="text-xs text-amber-300">ติดปัญหา</dt>
            <dd className="font-semibold tabular-nums text-amber-200">
              {blocked.length.toLocaleString("th-TH")}
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(18rem,4fr)_minmax(0,6fr)]">
        <QueueGroup
          id="station-active-title"
          region="active"
          title="กำลังทำ"
          hint="เปิดงานที่เริ่มไว้แล้วเพื่อทำต่อ"
          emptyTitle="ยังไม่มีงานที่เริ่มแล้ว"
          emptyDescription="เลือกงานแรกจากคิวพร้อมทำ แล้วเริ่มที่ใบงานนั้น"
          emptyIcon={CircleDot}
          items={active}
          onOpen={onOpen}
        />
        <QueueGroup
          id="station-ready-title"
          region="ready"
          title="คิวพร้อมทำ"
          hint="งานพร้อมจริง เรียงงานด่วนและกำหนดส่งก่อน"
          emptyTitle="ไม่มีงานพร้อมที่สถานีนี้"
          emptyDescription="ตรวจกลุ่มติดปัญหาด้านล่าง หรือรอคิวอัปเดต"
          emptyIcon={items.length === 0 ? CheckCircle2 : Clock3}
          items={ready}
          onOpen={onOpen}
        />
      </div>

      <QueueGroup
        id="station-blocked-title"
        region="blocked"
        title="งานติดปัญหา"
        hint="แยกจากคิวพร้อมทำ และแสดงเฉพาะเหตุผลหรือหมายเหตุที่มีอยู่จริง"
        emptyTitle="ไม่มีงานติดปัญหา"
        emptyDescription="งานที่พร้อมทำยังอยู่ในคิวด้านบน"
        emptyIcon={AlertTriangle}
        items={blocked}
        onOpen={onOpen}
      />
    </div>
  );
}
