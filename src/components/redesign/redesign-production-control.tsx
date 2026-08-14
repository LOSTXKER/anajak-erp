"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  Flame,
  Printer,
  RefreshCw,
  RotateCcw,
  Truck,
  User,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DASHED,
  FOCUS_BUTTON,
  INTERACTIVE_HOVER,
  INTERACTIVE_PRESSED,
  INTERACTIVE_SELECTED,
  TINT,
} from "@/components/ui/tokens";
import { useListPageState } from "@/hooks/use-list-page-state";
import { permAllows } from "@/lib/permissions";
import {
  buildRedesignProductionModel,
  type RedesignProductionCard,
  type RedesignProductionException,
  type RedesignProductionLaneSummary,
  type RedesignProductionMyWork,
  type RedesignProductionQueueItem,
} from "@/lib/redesign-production";
import { trpc } from "@/lib/trpc";
import { cn, formatDateShort, formatTime } from "@/lib/utils";

const CARD_PREVIEW_LIMIT = 30;

function ProductionSkeleton() {
  return (
    <div
      className="redesign-production-loading space-y-5"
      role="status"
      aria-label="กำลังโหลดศูนย์ควบคุมการผลิต"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-4 w-80 max-w-full rounded-lg" />
        </div>
        <Skeleton className="hidden h-10 w-36 rounded-lg sm:block" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-xl xl:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

function ProductionError({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      className="redesign-sheet px-5 py-12 text-center"
      role="alert"
      aria-live="assertive"
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-xl font-semibold text-strong">
        โหลดศูนย์ควบคุมการผลิตไม่สำเร็จ
      </h1>
      <p className="mx-auto mt-1 max-w-lg text-sm text-muted">
        โหลดข้อมูลสิทธิ์หรือคิวผลิตไม่ครบ กรุณาลองเชื่อมต่อใหม่
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          CONTROL_MIN_H,
          FOCUS_BUTTON,
          INTERACTIVE_HOVER,
          INTERACTIVE_PRESSED,
          "mt-5 inline-flex items-center gap-2 rounded-lg border border-divider bg-surface px-4 text-sm font-semibold text-secondary",
        )}
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        ลองใหม่
      </button>
    </section>
  );
}

function Deadline({ deadline, overdue }: { deadline: Date | string | null; overdue: boolean }) {
  if (!deadline) return <span className="text-xs text-muted">ยังไม่กำหนดส่ง</span>;
  return (
    <span
      className={cn(
        "text-xs tabular-nums text-muted",
        overdue && "font-semibold text-red-700 dark:text-red-300",
      )}
    >
      {overdue ? "เลยกำหนด " : "กำหนด "}
      {formatDateShort(deadline)}
    </span>
  );
}

function ExceptionDocket({
  items,
}: {
  items: RedesignProductionException[];
}) {
  return (
    <section
      className="redesign-production-exceptions redesign-sheet overflow-hidden xl:col-span-2"
      aria-labelledby="redesign-production-exceptions-title"
    >
      <header className="flex min-h-16 items-center justify-between gap-3 border-b border-divider px-4 py-3 sm:px-5">
        <div>
          <h2
            id="redesign-production-exceptions-title"
            className="flex items-center gap-2 text-lg font-semibold text-strong"
          >
            <Flame className="h-4 w-4 text-red-700 dark:text-red-300" aria-hidden="true" />
            ต้องแก้ก่อน
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            งานล้มเหลว เลยกำหนด หรือติดด่านพร้อมผลิต
          </p>
        </div>
        <Badge variant={items.length > 0 ? "destructive" : "success"} size="sm">
          {items.length > 0 ? `${items.length.toLocaleString("th-TH")} งาน` : "เคลียร์"}
        </Badge>
      </header>

      {items.length === 0 ? (
        <div className="px-5 py-9 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-green-700 dark:text-green-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-strong">
            ไม่มีงานติดด่านหรือเลยกำหนด
          </p>
          <p className="mt-1 text-xs text-muted">เริ่มจากงานที่ทำต่อได้ด้านล่าง</p>
        </div>
      ) : (
        <ol className="divide-y divide-divider">
          {items.slice(0, 6).map((item) => (
            <li key={item.orderId} className="px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={item.workbenchHref}
                      className={cn(
                        FOCUS_BUTTON,
                        "rounded px-1 text-sm font-semibold tabular-nums text-blue-700 dark:text-blue-300",
                      )}
                    >
                      {item.orderNumber}
                    </Link>
                    {item.reasons.map((reason) => (
                      <Badge
                        key={`${reason.kind}:${reason.label}`}
                        variant={reason.tone === "danger" ? "destructive" : "warning"}
                        size="sm"
                      >
                        {reason.label}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-1 truncate text-sm text-secondary">
                    {[item.customerName, item.title].filter(Boolean).join(" · ")}
                  </p>
                  {item.waitingOn.length > 0 ? (
                    <p className="mt-1 text-xs text-muted">
                      {item.waitingOn.join(" · ")}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={item.actionHref}
                  className={cn(
                    CONTROL_MIN_H,
                    FOCUS_BUTTON,
                    INTERACTIVE_HOVER,
                    INTERACTIVE_PRESSED,
                    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-divider bg-surface px-3 text-sm font-semibold text-secondary",
                  )}
                >
                  เปิดจุดที่ต้องแก้
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </li>
          ))}
        </ol>
      )}

      {items.length > 6 ? (
        <p className="border-t border-divider px-5 py-3 text-xs text-muted">
          ยังมีอีก {(items.length - 6).toLocaleString("th-TH")} งาน เรียงตามความรุนแรงและกำหนดส่ง
        </p>
      ) : null}
    </section>
  );
}

function QueueRow({
  item,
  blocked,
  canCreate,
}: {
  item: RedesignProductionQueueItem;
  blocked: boolean;
  canCreate: boolean;
}) {
  const href = !blocked && canCreate ? item.createHref : item.workbenchHref;
  const label = blocked
    ? "เปิดตรวจด่าน"
    : canCreate
      ? "เปิดใบผลิต"
      : "เปิดภาพรวมงาน";
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
            blocked ? "bg-amber-600" : "bg-green-600",
          )}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <Link
            href={item.workbenchHref}
            className={cn(
              FOCUS_BUTTON,
              "rounded text-sm font-semibold tabular-nums text-strong",
            )}
          >
            {item.orderNumber}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted">
            {[item.customerName, item.title].filter(Boolean).join(" · ")}
          </p>
          {blocked && item.blockers.length > 0 ? (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {item.blockers.join(" · ")}
            </p>
          ) : null}
        </div>
        <Link
          href={href}
          className={cn(
            CONTROL_MIN_H,
            FOCUS_BUTTON,
            INTERACTIVE_HOVER,
            INTERACTIVE_PRESSED,
            "inline-flex shrink-0 items-center rounded-lg px-2 text-xs font-semibold text-blue-700 dark:text-blue-300",
          )}
        >
          {label}
        </Link>
      </div>
    </li>
  );
}

function ReleaseGate({
  blocked,
  ready,
  canCreate,
}: {
  blocked: RedesignProductionQueueItem[];
  ready: RedesignProductionQueueItem[];
  canCreate: boolean;
}) {
  return (
    <section
      className="redesign-production-release redesign-sheet overflow-hidden"
      aria-labelledby="redesign-production-release-title"
    >
      <header className="border-b border-divider px-4 py-3">
        <h2
          id="redesign-production-release-title"
          className="flex items-center gap-2 text-lg font-semibold text-strong"
        >
          <ClipboardCheck className="h-4 w-4 text-blue-700 dark:text-blue-300" aria-hidden="true" />
          ด่านก่อนลงไลน์
        </h2>
        <p className="mt-0.5 text-xs text-muted">แยกงานที่ต้องตามออกจากงานที่ปล่อยได้</p>
      </header>
      <div className="divide-y divide-divider px-4">
        {blocked.length > 0 ? (
          <section className="py-4" aria-labelledby="redesign-production-blocked-title">
            <h3
              id="redesign-production-blocked-title"
              className="text-sm font-semibold text-amber-700 dark:text-amber-300"
            >
              ติดด่าน · {blocked.length.toLocaleString("th-TH")}
            </h3>
            <ul className="mt-3 divide-y divide-divider">
              {blocked.slice(0, 3).map((item) => (
                <QueueRow key={item.orderId} item={item} blocked canCreate={canCreate} />
              ))}
            </ul>
          </section>
        ) : null}
        <section className="py-4" aria-labelledby="redesign-production-ready-title">
          <h3 id="redesign-production-ready-title" className="text-sm font-semibold text-green-700 dark:text-green-300">
            พร้อมเปิดใบผลิต · {ready.length.toLocaleString("th-TH")}
          </h3>
          {ready.length === 0 ? (
            <p className="mt-3 text-xs text-muted">ยังไม่มีงานรอเปิดใบผลิต</p>
          ) : (
            <ul className="mt-3 divide-y divide-divider">
              {ready.slice(0, 4).map((item) => (
                <QueueRow key={item.orderId} item={item} blocked={false} canCreate={canCreate} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}

function MyWork({ items }: { items: RedesignProductionMyWork[] }) {
  if (items.length === 0) return null;
  return (
    <section className="redesign-production-my-work redesign-sheet overflow-hidden" aria-labelledby="redesign-production-my-work-title">
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-divider px-4 py-3">
        <h2 id="redesign-production-my-work-title" className="flex items-center gap-2 text-lg font-semibold text-strong">
          <User className="h-4 w-4 text-blue-700 dark:text-blue-300" aria-hidden="true" />
          งานของฉัน
        </h2>
        <Badge variant="accent" size="sm">{items.length.toLocaleString("th-TH")} ขั้น</Badge>
      </header>
      <ul className="divide-y divide-divider">
        {items.slice(0, 6).map((item) => (
          <li key={item.key}>
            <Link
              href={item.actionHref}
              className={cn(
                CONTROL_MIN_H,
                FOCUS_BUTTON,
                INTERACTIVE_HOVER,
                INTERACTIVE_PRESSED,
                "flex items-center gap-3 px-4 py-3",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-strong">{item.stepName}</span>
                <span className="mt-0.5 block text-xs tabular-nums text-muted">{item.orderNumber}</span>
              </span>
              <Badge variant={item.status === "IN_PROGRESS" ? "accent" : "default"} size="sm">
                {item.status === "IN_PROGRESS" ? "ทำต่อ" : "เริ่มงาน"}
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LaneFilters({
  lanes,
  selected,
  totalCards,
  onSelect,
}: {
  lanes: RedesignProductionLaneSummary[];
  selected: string;
  totalCards: number;
  onSelect: (key: string) => void;
}) {
  return (
    <section className="redesign-production-lanes" aria-labelledby="redesign-production-lanes-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="redesign-production-lanes-title" className="text-lg font-semibold text-strong">
            สายการผลิตสด
          </h2>
          <p className="mt-0.5 text-xs text-muted">เลือกสายเพื่อดูงานจริงที่อยู่ในจุดนั้น</p>
        </div>
        {selected ? (
          <button
            type="button"
            onClick={() => onSelect("")}
            className={cn(
              CONTROL_MIN_H,
              FOCUS_BUTTON,
              INTERACTIVE_HOVER,
              INTERACTIVE_PRESSED,
              "inline-flex items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-blue-700 dark:text-blue-300",
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            ล้างตัวกรองสาย
          </button>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
        <button
          type="button"
          aria-pressed={!selected}
          onClick={() => onSelect("")}
          className={cn(
            CONTROL_MIN_H,
            FOCUS_BUTTON,
            "redesign-production-lane flex min-h-20 flex-col items-start justify-between rounded-xl px-3 py-3 text-left",
            !selected
              ? INTERACTIVE_SELECTED
              : cn("redesign-sheet", INTERACTIVE_HOVER, INTERACTIVE_PRESSED),
          )}
        >
          <span className="text-xs font-semibold">ทั้งหมด</span>
          <span className="text-xl font-semibold tabular-nums">{totalCards.toLocaleString("th-TH")}</span>
        </button>
        {lanes.map((lane) => {
          const active = selected === lane.key;
          return (
            <button
              key={lane.key}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(active ? "" : lane.key)}
              className={cn(
                CONTROL_MIN_H,
                FOCUS_BUTTON,
                "redesign-production-lane flex min-h-20 flex-col items-start justify-between rounded-xl px-3 py-3 text-left",
                active
                  ? INTERACTIVE_SELECTED
                  : cn("redesign-sheet", INTERACTIVE_HOVER, INTERACTIVE_PRESSED),
              )}
            >
              <span className="flex w-full items-center justify-between gap-2 text-xs font-semibold">
                <span className="truncate">{lane.label}</span>
                {lane.isOutsource ? <Truck className="h-3.5 w-3.5 shrink-0" aria-label="ร้านนอก" /> : null}
              </span>
              <span className="flex w-full items-end justify-between gap-2">
                <span className="text-xl font-semibold tabular-nums">{lane.count.toLocaleString("th-TH")}</span>
                {lane.overdue > 0 ? (
                  <span className="text-2xs font-semibold text-red-700 dark:text-red-300">
                    เลย {lane.overdue}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function WorkCard({ card, focused }: { card: RedesignProductionCard; focused: boolean }) {
  return (
    <article
      className={cn(
        "redesign-production-card redesign-sheet px-4 py-4",
        focused && "redesign-production-card-focused",
      )}
      data-focused-order={focused ? "true" : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={card.workbenchHref}
              className={cn(
                FOCUS_BUTTON,
                "rounded text-sm font-semibold tabular-nums text-blue-700 dark:text-blue-300",
              )}
            >
              {card.orderNumber}
            </Link>
            <Badge variant={card.sectionKind === "post" ? "default" : "accent"} size="sm">
              {card.sectionLabel}
            </Badge>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-strong">
            {card.customerName || card.title || "ไม่ระบุชื่องาน"}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">{card.title}</p>
        </div>
        <Deadline deadline={card.deadline} overdue={card.overdue} />
      </div>

      <div className="mt-4 border-t border-divider pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-strong">{card.stepName}</p>
            <p className="mt-1 text-xs text-muted">
              {card.totalSteps > 0
                ? `เสร็จ ${card.completedSteps}/${card.totalSteps} ขั้นในสายนี้`
                : card.totalQuantity > 0
                  ? `${card.totalQuantity.toLocaleString("th-TH")} ชิ้น`
                  : "เปิดงานหลักเพื่อดูรายละเอียด"}
            </p>
            {card.assignedTo ? <p className="mt-1 text-xs text-secondary">ผู้ดูแล {card.assignedTo}</p> : null}
          </div>
          {card.blindShip && card.sectionKind === "post" ? (
            <Badge variant="destructive" size="sm">Blind ship</Badge>
          ) : null}
        </div>
        <Link
          href={card.actionHref}
          className={cn(
            CONTROL_MIN_H,
            FOCUS_BUTTON,
            "mt-4 flex w-full items-center justify-between rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800",
          )}
        >
          เปิดงานหลัก
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export function RedesignProductionControl() {
  return (
    <Suspense fallback={<ProductionSkeleton />}>
      <RedesignProductionControlContent />
    </Suspense>
  );
}

function RedesignProductionControlContent() {
  const { searchParams, replaceListState } = useListPageState();
  const requestedLane = searchParams.get("lane") ?? "";
  const focusedOrderId = searchParams.get("order") ?? "";
  const meQuery = trpc.user.me.useQuery();
  const productionQuery = trpc.production.kanban.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData: (previous) => previous,
  });

  const me = meQuery.data;
  const canSupervise = permAllows(me?.permissions, "supervise_operations");
  const showBlocked = Boolean(me) &&
    (me?.role !== "PRODUCTION_STAFF" || canSupervise);
  const model = useMemo(
    () =>
      buildRedesignProductionModel(productionQuery.data ?? [], {
        viewerId: me?.id,
        showBlocked,
        now:
          productionQuery.dataUpdatedAt > 0
            ? new Date(productionQuery.dataUpdatedAt)
            : new Date(0),
      }),
    [me?.id, productionQuery.data, productionQuery.dataUpdatedAt, showBlocked],
  );

  const validLane = model.lanes.some((lane) => lane.key === requestedLane)
    ? requestedLane
    : "";
  const cards = (validLane
    ? model.cards.filter((card) => card.sectionKey === validLane)
    : model.cards
  ).toSorted((a, b) => {
    if (focusedOrderId) {
      const aFocused = a.orderId === focusedOrderId ? 0 : 1;
      const bFocused = b.orderId === focusedOrderId ? 0 : 1;
      if (aFocused !== bFocused) return aFocused - bFocused;
    }
    return 0;
  });
  const focusedKnown = Boolean(
    focusedOrderId &&
      (model.cards.some((card) => card.orderId === focusedOrderId) ||
        model.exceptions.some((item) => item.orderId === focusedOrderId) ||
        model.readyQueue.some((item) => item.orderId === focusedOrderId) ||
        model.blockedQueue.some((item) => item.orderId === focusedOrderId)),
  );
  const prioritizeMyWork = me?.role === "PRODUCTION_STAFF" && !canSupervise;

  if (
    (meQuery.isLoading || productionQuery.isLoading) &&
    (!me || !productionQuery.data)
  ) {
    return <ProductionSkeleton />;
  }

  if (
    (meQuery.isError || productionQuery.isError) &&
    (!me || !productionQuery.data)
  ) {
    return (
      <ProductionError
        onRetry={() => {
          void meQuery.refetch();
          void productionQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="redesign-production-control space-y-5">
      <header className="redesign-production-masthead flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-strong sm:text-3xl">
              ศูนย์ควบคุมการผลิต
            </h1>
            {productionQuery.dataUpdatedAt > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-green-600" aria-hidden="true" />
                อัปเดต {formatTime(productionQuery.dataUpdatedAt)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            แก้งานติดด่านก่อน แล้วปล่อยเฉพาะงานที่พร้อมลงไลน์
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="self-start sm:self-auto">
          <Link href="/production/print-runs">
            <Printer className="h-4 w-4" aria-hidden="true" />
            รอบพิมพ์ฟิล์ม
          </Link>
        </Button>
      </header>

      {productionQuery.isFetching && productionQuery.data ? (
        <p className="sr-only" role="status" aria-live="polite">กำลังอัปเดตคิวผลิต</p>
      ) : null}

      {productionQuery.isError && productionQuery.data ? (
        <div
          className={cn(
            TINT.error,
            "flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
          )}
          aria-live="polite"
        >
          <span>อัปเดตล่าสุดไม่สำเร็จ ข้อมูลเดิมยังแสดงอยู่</span>
          <Button variant="outline" size="sm" onClick={() => void productionQuery.refetch()} className="gap-2 self-start sm:self-auto">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            ลองใหม่
          </Button>
        </div>
      ) : null}

      {model.capReached ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          แสดงสูงสุด 200 ออเดอร์แรก เรียงตามกำหนดส่ง
        </p>
      ) : null}

      {focusedOrderId ? (
        <div className={cn("redesign-production-focus flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between", focusedKnown ? "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100" : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100")}>
          <p className="text-sm font-medium">
            {focusedKnown ? "กำลังเน้นออเดอร์ที่ส่งต่อมาจาก Workbench" : "ออเดอร์นี้ไม่ได้อยู่ในคิวผลิตปัจจุบัน"}
          </p>
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/redesign/orders/${encodeURIComponent(focusedOrderId)}`} className={cn(CONTROL_MIN_H, FOCUS_BUTTON, INTERACTIVE_HOVER, "inline-flex items-center rounded-lg px-2 text-xs font-semibold")}>เปิด Workbench</Link>
            <button type="button" onClick={() => replaceListState({ order: null })} className={cn(CONTROL_MIN_H, FOCUS_BUTTON, INTERACTIVE_HOVER, "inline-flex items-center gap-1 rounded-lg px-2 text-xs font-semibold")}>
              <X className="h-4 w-4" aria-hidden="true" /> ล้างการเน้น
            </button>
          </span>
        </div>
      ) : null}

      {prioritizeMyWork ? <MyWork items={model.myWork} /> : null}

      <div className="redesign-production-priority-grid grid gap-4 xl:grid-cols-3">
        <ExceptionDocket items={model.exceptions} />
        <ReleaseGate blocked={model.blockedQueue} ready={model.readyQueue} canCreate={canSupervise} />
      </div>

      {!prioritizeMyWork ? <MyWork items={model.myWork} /> : null}

      <LaneFilters
        lanes={model.lanes}
        selected={validLane}
        totalCards={model.cards.length}
        onSelect={(lane) => replaceListState({ lane: lane || null })}
      />

      <section className="redesign-production-work" aria-labelledby="redesign-production-work-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="redesign-production-work-title" className="text-lg font-semibold text-strong">
              {validLane
                ? model.lanes.find((lane) => lane.key === validLane)?.label
                : "งานที่ทำต่อได้ตอนนี้"}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {cards.length.toLocaleString("th-TH")} จุดงาน · เปิดงานหลักเพื่อบันทึกผลจริง
            </p>
          </div>
          {cards.length > CARD_PREVIEW_LIMIT ? (
            <p className="text-xs text-muted">แสดง {CARD_PREVIEW_LIMIT} จุดแรกตามกำหนดส่ง</p>
          ) : null}
        </div>

        {cards.length === 0 ? (
          <div className={cn(DASHED, "mt-3 rounded-xl py-10 text-center")}>
            <Factory className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-strong">
              {validLane ? "สายนี้เคลียร์แล้ว" : "ยังไม่มีงานในไลน์ผลิต"}
            </p>
            <p className="mt-1 text-xs text-muted">งานจะปรากฏเมื่อผ่านด่านก่อนลงไลน์</p>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {cards.slice(0, CARD_PREVIEW_LIMIT).map((card) => (
              <WorkCard key={card.key} card={card} focused={card.orderId === focusedOrderId} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
