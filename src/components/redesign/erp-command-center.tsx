"use client";

import type { ComponentType } from "react";
import type { InternalStatus } from "@prisma/client";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  Hourglass,
  Minus,
  PackageCheck,
  Palette,
  Plus,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DASHED,
  FOCUS_BUTTON,
  FOCUS_INSET,
  INTERACTIVE_HOVER,
  INTERACTIVE_PRESSED,
} from "@/components/ui/tokens";
import {
  buildDashboardAttentionItems,
  type DashboardAttentionItem,
  type DashboardAttentionKind,
} from "@/lib/dashboard";
import { canCreateOrderWithPricing } from "@/lib/order-access";
import { permAllows } from "@/lib/permissions";
import {
  getRedesignFlowState,
  getRedesignStageLabel,
  type RedesignFlowState,
} from "@/lib/redesign-flow";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { cn, formatDateShort, formatTime } from "@/lib/utils";

type StageDefinition = {
  label: string;
  shortLabel: string;
  statuses: readonly InternalStatus[];
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  productionRoute?: "inHouseDtf" | "outsource";
};

const FLOW_STAGES: readonly StageDefinition[] = [
  {
    label: "รับงาน",
    shortLabel: "รับงาน",
    statuses: ["DRAFT", "INQUIRY", "CONFIRMED"],
    icon: ShoppingCart,
  },
  {
    label: "อาร์ตเวิร์ก",
    shortLabel: "อาร์ตเวิร์ก",
    statuses: ["DESIGNING", "DESIGN_APPROVED"],
    icon: Palette,
  },
  {
    label: "ความพร้อม",
    shortLabel: "ความพร้อม",
    statuses: ["PRODUCTION_QUEUE"],
    icon: ClipboardCheck,
  },
  {
    label: "DTF ภายใน",
    shortLabel: "DTF ภายใน",
    statuses: ["PRODUCING"],
    icon: Factory,
    productionRoute: "inHouseDtf",
  },
  {
    label: "งานร้านนอก",
    shortLabel: "ร้านนอก",
    statuses: ["PRODUCING"],
    icon: Truck,
    productionRoute: "outsource",
  },
  {
    label: "QC / แพ็ค",
    shortLabel: "QC / แพ็ค",
    statuses: ["QUALITY_CHECK", "PACKING"],
    icon: PackageCheck,
  },
  {
    label: "ส่ง / ปิด",
    shortLabel: "ส่ง / ปิด",
    statuses: ["READY_TO_SHIP", "SHIPPED", "COMPLETED"],
    icon: CheckCircle2,
  },
] as const;

type RecentOrder =
  RouterOutput["analytics"]["dashboard"]["recentOrders"][number];

const ATTENTION_ICONS: Record<
  DashboardAttentionKind,
  ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  "overdue-order": CalendarClock,
  "due-soon": Hourglass,
  outsource: Truck,
  stuck: AlertTriangle,
  "overdue-invoice": ReceiptText,
  quotation: ClipboardCheck,
};

const DEADLINE_EXEMPT = new Set<InternalStatus>([
  "DRAFT",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
]);

function formatCount(value: number) {
  return value.toLocaleString("th-TH");
}

function deadlineTone(
  deadline: Date | string | null | undefined,
  status: InternalStatus,
): "danger" | "warning" | null {
  if (!deadline || DEADLINE_EXEMPT.has(status)) return null;
  const dueAt = new Date(deadline).getTime();
  const now = Date.now();
  if (dueAt < now) return "danger";
  if (dueAt <= now + 48 * 60 * 60 * 1000) return "warning";
  return null;
}

function CommandCenterSkeleton() {
  return (
    <div
      className="redesign-command-skeleton space-y-5"
      role="status"
      aria-label="กำลังโหลดศูนย์ควบคุม"
    >
      <div className="redesign-skeleton-heading flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56 rounded-lg" />
          <Skeleton className="h-4 w-72 max-w-full rounded-lg" />
        </div>
        <Skeleton className="hidden h-9 w-28 rounded-lg sm:block" />
      </div>

      <div className="redesign-skeleton-desktop hidden gap-5 xl:grid xl:grid-cols-4">
        <Skeleton className="h-96 rounded-xl xl:col-span-3" />
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-32 rounded-xl xl:col-span-4" />
      </div>

      <div className="redesign-skeleton-mobile space-y-4 xl:hidden">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}

function PrimaryError({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      className="redesign-primary-error card-surface rounded-xl px-5 py-12 text-center"
      role="alert"
      aria-live="assertive"
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-strong">
        โหลดศูนย์ควบคุมไม่สำเร็จ
      </h1>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        ข้อมูลสิทธิ์หรือภาพรวมออเดอร์ขาดหาย กรุณาลองเชื่อมต่อใหม่
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          CONTROL_MIN_H,
          FOCUS_BUTTON,
          "mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-secondary transition-colors hover:bg-interactive-hover hover:text-strong active:bg-interactive-pressed",
        )}
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        ลองใหม่
      </button>
    </section>
  );
}

function AttentionLoading() {
  return (
    <div className="redesign-attention-loading space-y-2 p-4" role="status">
      <span className="sr-only">กำลังโหลดรายการที่ต้องเช็ก</span>
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-20 rounded-lg" />
      ))}
    </div>
  );
}

function AttentionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="redesign-attention-error px-5 py-9 text-center"
      role="alert"
    >
      <AlertTriangle
        className="mx-auto h-6 w-6 text-red-700 dark:text-red-400"
        aria-hidden="true"
      />
      <p className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">
        โหลดรายการเสี่ยงไม่สำเร็จ
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          CONTROL_MIN_H,
          FOCUS_BUTTON,
          "mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-secondary transition-colors hover:bg-interactive-hover hover:text-strong active:bg-interactive-pressed",
        )}
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        ลองใหม่
      </button>
    </div>
  );
}

function AttentionEmpty() {
  return (
    <div className="redesign-attention-empty px-5 py-9 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-semibold text-strong">
        ยังไม่มีเรื่องเสี่ยงที่ต้องรีบแก้
      </p>
      <p className="mt-1 text-xs text-muted">
        งานที่ต้องติดตามด่วนจะปรากฏตรงนี้
      </p>
    </div>
  );
}

function PersonalQueue() {
  return (
    <div className="redesign-personal-queue px-4 py-5">
      <div className="rounded-lg bg-surface-muted p-4">
        <p className="text-sm font-semibold text-strong">
          ดูคิวที่ได้รับมอบหมาย
        </p>
        <p className="mt-1 text-xs text-muted">
          รายการเสี่ยงรวมสงวนไว้สำหรับผู้มีสิทธิ์ดูรายงานบริหาร
        </p>
        <Link
          href="/my-tasks"
          className={cn(
            CONTROL_MIN_H,
            FOCUS_BUTTON,
            "mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800",
          )}
        >
          เปิดงานของฉัน
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function AttentionRow({ item }: { item: DashboardAttentionItem }) {
  const Icon = ATTENTION_ICONS[item.kind];
  const danger = item.tone === "danger";

  return (
    <li className="redesign-attention-item">
      <Link
        href={item.href}
        className={cn(
          FOCUS_INSET,
          "group flex min-h-20 items-center gap-3 px-4 py-3 transition-colors hover:bg-interactive-hover active:bg-interactive-pressed",
        )}
      >
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            danger
              ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-strong">
            {item.title}
          </span>
          <span className="mt-0.5 block text-xs text-muted group-hover:text-secondary">
            {item.detail}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "text-lg font-semibold tabular-nums",
              danger
                ? "text-red-700 dark:text-red-300"
                : "text-amber-700 dark:text-amber-300",
            )}
          >
            {formatCount(item.count)}
          </span>
          <ArrowRight
            className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </Link>
    </li>
  );
}

function AttentionPanel({
  allowed,
  loading,
  error,
  items,
  onRetry,
  mobile,
}: {
  allowed: boolean;
  loading: boolean;
  error: boolean;
  items: DashboardAttentionItem[];
  onRetry: () => void;
  mobile?: boolean;
}) {
  return (
    <section
      className={cn(
        "redesign-attention-panel card-surface overflow-hidden rounded-xl",
        mobile && "redesign-attention-panel-mobile",
      )}
      aria-labelledby={
        mobile ? "redesign-priority-mobile" : "redesign-priority-desktop"
      }
    >
      <header className="redesign-attention-header flex min-h-16 items-center justify-between gap-3 border-b border-divider px-4 py-3">
        <div>
          <h2
            id={
              mobile ? "redesign-priority-mobile" : "redesign-priority-desktop"
            }
            className="text-base font-semibold text-strong"
          >
            {allowed ? "ต้องเช็กก่อน" : "ลำดับงานของคุณ"}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {allowed
              ? "เรียงตามผลกระทบที่ควรจัดการ"
              : "เปิดคิวส่วนตัวเพื่อเริ่มงานถัดไป"}
          </p>
        </div>
        {allowed && !loading && !error && (
          <Badge variant={items.length > 0 ? "warning" : "success"} size="sm">
            {items.length > 0
              ? `${formatCount(items.length)} ประเด็น`
              : "เรียบร้อย"}
          </Badge>
        )}
      </header>

      {!allowed ? (
        <PersonalQueue />
      ) : loading ? (
        <AttentionLoading />
      ) : error ? (
        <AttentionError onRetry={onRetry} />
      ) : items.length === 0 ? (
        <AttentionEmpty />
      ) : (
        <>
          <ol className="redesign-attention-list divide-y divide-divider">
            {items.map((item) => (
              <AttentionRow key={item.kind} item={item} />
            ))}
          </ol>
          <div className="redesign-attention-footer border-t border-divider p-3">
            <Link
              href="/orders"
              className={cn(
                CONTROL_MIN_H,
                FOCUS_BUTTON,
                INTERACTIVE_HOVER,
                INTERACTIVE_PRESSED,
                "flex items-center justify-center gap-2 rounded-lg text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 active:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200 dark:active:text-blue-200",
              )}
            >
              ดูออเดอร์ทั้งหมด
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

function FlowNode({
  state,
  stage,
  first,
  last,
}: {
  state: RedesignFlowState;
  stage: StageDefinition;
  first: boolean;
  last: boolean;
}) {
  const stateLabel =
    state === "complete"
      ? "ผ่านแล้ว"
      : state === "current"
        ? "ขั้นปัจจุบัน"
        : state === "upcoming"
          ? "ยังไม่ถึง"
          : state === "not-applicable"
            ? "ไม่ใช้กับงานนี้"
            : "ยังระบุไม่ได้";

  return (
    <div
      className="redesign-flow-node relative h-8"
      aria-label={`${stage.label}: ${stateLabel}`}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1/2 h-px -translate-y-1/2 bg-slate-200 transition-colors dark:bg-slate-700",
          first ? "left-1/2" : "left-0",
          last ? "right-1/2" : "right-0",
          "group-hover/flow:bg-slate-300 group-focus-within/flow:bg-blue-300 dark:group-hover/flow:bg-slate-600 dark:group-focus-within/flow:bg-blue-700",
        )}
      />
      {(state === "complete" || state === "current") && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1/2 h-0.5 -translate-y-1/2 bg-blue-600 dark:bg-blue-400",
            first ? "left-1/2" : "left-0",
            state === "current" || last ? "right-1/2" : "right-0",
          )}
        />
      )}
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-1/2 top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-colors",
          state === "complete" && "bg-blue-600 text-white dark:bg-blue-500",
          state === "current" &&
            "border-2 border-blue-600 bg-white text-blue-700 shadow-sm dark:border-blue-400 dark:bg-slate-900 dark:text-blue-300",
          state === "upcoming" &&
            "border border-slate-400 bg-white text-slate-400 group-hover/flow:border-slate-600 group-focus-within/flow:border-blue-500 dark:border-slate-500 dark:bg-slate-900 dark:text-slate-500 dark:group-focus-within/flow:border-blue-400",
          state === "not-applicable" &&
            cn(
              DASHED,
              "border-slate-300 bg-surface-muted text-muted dark:border-slate-600",
            ),
          state === "unknown" &&
            cn(
              DASHED,
              "border-slate-400 bg-surface text-slate-400 dark:border-slate-600",
            ),
        )}
      >
        {state === "complete" ? (
          <Check className="h-3 w-3" strokeWidth={2.5} />
        ) : state === "current" ? (
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
        ) : state === "not-applicable" ? (
          <Minus className="h-3 w-3" strokeWidth={2} />
        ) : null}
      </span>
    </div>
  );
}

function OrderIdentity({ order }: { order: RecentOrder }) {
  return (
    <div className="redesign-order-identity min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Link
          href={`/orders/${order.id}`}
          aria-label={`เปิดออเดอร์ ${order.orderNumber}`}
          className={cn(
            FOCUS_BUTTON,
            INTERACTIVE_HOVER,
            INTERACTIVE_PRESSED,
            "-mx-1 truncate rounded px-1 text-sm font-semibold tabular-nums text-strong",
          )}
        >
          {order.orderNumber}
        </Link>
        {order.printLabel && (
          <Badge variant="accent" size="sm">
            {order.printLabel}
          </Badge>
        )}
      </div>
      <p className="mt-0.5 truncate text-xs text-muted">
        {order.customerName} · {order.title}
      </p>
      <div className="mt-1">
        <OrderStatusBadge
          customerStatus={order.customerStatus}
          internalStatus={order.internalStatus}
          compact
        />
      </div>
    </div>
  );
}

function Deadline({ order }: { order: RecentOrder }) {
  const tone = deadlineTone(order.deadline, order.internalStatus);

  if (!order.deadline) {
    return <span className="text-xs text-muted">ยังไม่กำหนด</span>;
  }

  return (
    <div className="redesign-deadline text-right">
      <p
        className={cn(
          "text-xs font-semibold tabular-nums text-secondary",
          tone === "danger" && "text-red-700 dark:text-red-300",
          tone === "warning" && "text-amber-700 dark:text-amber-300",
        )}
      >
        {formatDateShort(order.deadline)}
      </p>
      {tone && (
        <p
          className={cn(
            "mt-1 text-2xs font-medium",
            tone === "danger"
              ? "text-red-700 dark:text-red-300"
              : "text-amber-700 dark:text-amber-300",
          )}
        >
          {tone === "danger" ? "เลยกำหนด" : "ภายใน 48 ชม."}
        </p>
      )}
    </div>
  );
}

function Assignee({ order }: { order: RecentOrder }) {
  return (
    <span
      className={cn(
        "block truncate text-xs",
        order.assigneeName ? "font-medium text-secondary" : "text-muted",
      )}
      title={order.assigneeName ?? "ยังไม่มอบหมาย"}
    >
      {order.assigneeName ?? "ยังไม่มอบหมาย"}
    </span>
  );
}

function FlowMatrix({
  orders,
  canCreateOrder,
}: {
  orders: RecentOrder[];
  canCreateOrder: boolean;
}) {
  return (
    <section
      className="redesign-flow-matrix card-surface min-w-0 overflow-hidden rounded-xl xl:col-span-3"
      aria-labelledby="redesign-flow-matrix-title"
    >
      <header className="redesign-flow-header flex min-h-14 items-center justify-between gap-4 border-b border-divider px-4 py-2">
        <div>
          <h2
            id="redesign-flow-matrix-title"
            className="text-lg font-semibold text-strong"
          >
            สายงานออเดอร์ล่าสุด
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            ตำแหน่งปัจจุบันตั้งแต่รับงานถึงปิดงาน
          </p>
        </div>
        <Link
          href="/orders"
          className={cn(
            CONTROL_MIN_H,
            FOCUS_BUTTON,
            INTERACTIVE_HOVER,
            INTERACTIVE_PRESSED,
            "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 active:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200 dark:active:text-blue-200",
          )}
        >
          ดูทั้งหมด
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>

      {orders.length === 0 ? (
        <div className="redesign-flow-empty px-6 py-16 text-center">
          <ShoppingCart
            className="mx-auto h-7 w-7 text-muted"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-semibold text-strong">
            ยังไม่มีออเดอร์ที่เข้าสายงาน
          </p>
          <p className="mt-1 text-xs text-muted">
            ออเดอร์ที่ยืนยันแล้วจะปรากฏตามขั้นตอนจริงตรงนี้
          </p>
          {canCreateOrder && (
            <Link
              href="/orders/new"
              className={cn(
                CONTROL_MIN_H,
                FOCUS_BUTTON,
                "mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800",
              )}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              เปิดงานใหม่
            </Link>
          )}
        </div>
      ) : (
        <div className="redesign-flow-table-wrap min-w-0 overflow-hidden">
          <table className="redesign-flow-table w-full table-fixed border-collapse">
            <caption className="sr-only">
              ตำแหน่งของออเดอร์ล่าสุดในสายงานเจ็ดขั้น
            </caption>
            <colgroup>
              <col className="w-1/4" />
              <col span={FLOW_STAGES.length} />
              <col className="w-20" />
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr className="border-b border-divider bg-surface-muted/70">
                <th
                  scope="col"
                  className="px-4 py-2 text-left text-2xs font-semibold text-muted"
                >
                  ออเดอร์
                </th>
                {FLOW_STAGES.map((stage) => {
                  const Icon = stage.icon;
                  return (
                    <th
                      key={stage.label}
                      scope="col"
                      data-production-lane={stage.productionRoute}
                      className="px-1 py-2 text-center text-2xs font-semibold text-secondary"
                    >
                      <Icon
                        className="mx-auto mb-0.5 h-3.5 w-3.5 text-muted"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                      <span className="block leading-4">
                        {stage.shortLabel}
                      </span>
                    </th>
                  );
                })}
                <th
                  scope="col"
                  className="px-2 py-2 text-right text-2xs font-semibold text-muted"
                >
                  กำหนดส่ง
                </th>
                <th
                  scope="col"
                  className="px-2 py-2 text-left text-2xs font-semibold text-muted"
                >
                  ผู้ดูแล
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {orders.slice(0, 5).map((order) => {
                return (
                  <tr
                    key={order.id}
                    className="redesign-flow-row group/flow focus-within:bg-interactive-hover dark:focus-within:bg-interactive-hover"
                  >
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      <OrderIdentity order={order} />
                    </th>
                    {FLOW_STAGES.map((stage, index) => {
                      const state = getRedesignFlowState(order, index);
                      return (
                        <td
                          key={stage.label}
                          data-production-lane={stage.productionRoute}
                          className="p-0"
                        >
                          <FlowNode
                            state={state}
                            stage={stage}
                            first={index === 0}
                            last={index === FLOW_STAGES.length - 1}
                          />
                        </td>
                      );
                    })}
                    <td className="px-2 py-2">
                      <Deadline order={order} />
                    </td>
                    <td className="px-2 py-2">
                      <Assignee order={order} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <footer className="redesign-flow-legend flex flex-wrap gap-x-4 gap-y-1.5 border-t border-divider px-4 py-2 text-2xs text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
            <Check className="h-2.5 w-2.5" aria-hidden="true" />
          </span>
          ผ่านแล้ว
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-blue-600 bg-white dark:border-blue-400 dark:bg-slate-900">
            <span className="h-1 w-1 rounded-full bg-blue-600 dark:bg-blue-400" />
          </span>
          ขั้นปัจจุบัน
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 rounded-full border border-slate-400 bg-white dark:border-slate-500 dark:bg-slate-900" />
          ยังไม่ถึง
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className={cn(
              DASHED,
              "flex h-4 w-4 items-center justify-center rounded-full border-slate-300 bg-surface-muted text-muted dark:border-slate-600",
            )}
          >
            <Minus className="h-2.5 w-2.5" aria-hidden="true" />
          </span>
          ไม่ใช้กับงานนี้
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className={cn(
              DASHED,
              "h-4 w-4 rounded-full border-slate-400 bg-white dark:border-slate-600 dark:bg-slate-900",
            )}
          />
          พักงาน / ระบุขั้นไม่ได้
        </span>
      </footer>
    </section>
  );
}

type StageCount = StageDefinition & { count: number };

function StageBalance({
  stages,
  compact,
}: {
  stages: StageCount[];
  compact?: boolean;
}) {
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);

  if (compact) {
    return (
      <section
        className="redesign-stage-summary card-surface overflow-hidden rounded-xl"
        aria-labelledby="redesign-stage-summary-title"
      >
        <header className="border-b border-divider px-4 py-3">
          <h2
            id="redesign-stage-summary-title"
            className="text-base font-semibold text-strong"
          >
            สรุปแต่ละช่วงงาน
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            จำนวนตามสถานะปัจจุบันในระบบ
          </p>
        </header>
        <div className="redesign-stage-summary-grid grid grid-cols-2 divide-x divide-y divide-divider sm:grid-cols-4">
          {stages.map((stage) => {
            const Icon = stage.icon;
            return (
              <div key={stage.label} className="min-w-0 p-4">
                <div className="flex items-center gap-2 text-muted">
                  <Icon
                    className="h-4 w-4 shrink-0"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span className="truncate text-xs font-medium">
                    {stage.label}
                  </span>
                </div>
                <p className="mt-2 text-xl font-semibold tabular-nums text-strong">
                  {formatCount(stage.count)}
                </p>
                <p className="text-2xs text-muted">ออเดอร์</p>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section
      className="redesign-stage-balance card-surface rounded-xl px-4 py-3"
      aria-labelledby="redesign-stage-balance-title"
    >
      <div className="grid gap-3 xl:grid-cols-8 xl:items-center">
        <header className="xl:col-span-1">
          <h2
            id="redesign-stage-balance-title"
            className="text-base font-semibold text-strong"
          >
            สมดุลสายงาน
          </h2>
          <p className="mt-0.5 text-xs text-muted">สถานะปัจจุบัน</p>
        </header>
        <div className="redesign-stage-balance-grid grid grid-cols-7 gap-3 xl:col-span-7">
          {stages.map((stage) => {
            const Icon = stage.icon;
            const share = total > 0 ? (stage.count / total) * 100 : 0;
            return (
              <div key={stage.label} className="min-w-0">
                <div className="flex items-center gap-2">
                  <Icon
                    className="h-4 w-4 shrink-0 text-muted"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span className="truncate text-xs font-medium text-secondary">
                    {stage.shortLabel}
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold tabular-nums text-strong">
                    {formatCount(stage.count)}
                  </span>
                  <span className="text-2xs text-muted">งาน</span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                  role="progressbar"
                  aria-label={`${stage.label} ${formatCount(stage.count)} ออเดอร์`}
                  aria-valuemin={0}
                  aria-valuemax={Math.max(total, 1)}
                  aria-valuenow={stage.count}
                >
                  <span
                    className="block h-full rounded-full bg-blue-600 dark:bg-blue-400"
                    style={{ width: `${share}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MobileRecentOrders({
  orders,
  canCreateOrder,
}: {
  orders: RecentOrder[];
  canCreateOrder: boolean;
}) {
  return (
    <section
      className="redesign-mobile-orders"
      aria-labelledby="redesign-mobile-orders-title"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id="redesign-mobile-orders-title"
          className="text-base font-semibold text-strong"
        >
          ออเดอร์ล่าสุด
        </h2>
        <Link
          href="/orders"
          className={cn(
            CONTROL_MIN_H,
            FOCUS_BUTTON,
            INTERACTIVE_HOVER,
            INTERACTIVE_PRESSED,
            "inline-flex items-center gap-1 rounded-lg px-2 text-sm font-semibold text-blue-700 hover:text-blue-800 active:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200 dark:active:text-blue-200",
          )}
        >
          ดูทั้งหมด
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="redesign-mobile-orders-empty card-surface rounded-xl px-5 py-10 text-center">
          <ShoppingCart
            className="mx-auto h-7 w-7 text-muted"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-semibold text-strong">
            ยังไม่มีออเดอร์ที่เข้าสายงาน
          </p>
          {canCreateOrder && (
            <Link
              href="/orders/new"
              className={cn(
                CONTROL_MIN_H,
                FOCUS_BUTTON,
                "mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800",
              )}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              เปิดงานใหม่
            </Link>
          )}
        </div>
      ) : (
        <div className="redesign-mobile-order-list space-y-3">
          {orders.map((order) => {
            const tone = deadlineTone(order.deadline, order.internalStatus);
            const stageLabel = getRedesignStageLabel(order);
            return (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className={cn(
                  FOCUS_BUTTON,
                  "redesign-mobile-order-card card-surface card-surface-hover block rounded-xl p-4",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums text-strong">
                        {order.orderNumber}
                      </span>
                      {order.printLabel && (
                        <Badge variant="accent" size="sm">
                          {order.printLabel}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">
                      {order.customerName} · {order.title}
                    </p>
                  </div>
                  <ArrowRight
                    className="mt-1 h-4 w-4 shrink-0 text-muted"
                    aria-hidden="true"
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-divider pt-3">
                  <div>
                    <OrderStatusBadge
                      customerStatus={order.customerStatus}
                      internalStatus={order.internalStatus}
                      compact
                    />
                    {stageLabel && (
                      <p className="mt-1 text-2xs text-muted">
                        ช่วงงาน: {stageLabel}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xs text-muted">กำหนดส่ง</p>
                    <p
                      className={cn(
                        "mt-0.5 text-xs font-semibold tabular-nums text-secondary",
                        tone === "danger" && "text-red-700 dark:text-red-300",
                        tone === "warning" &&
                          "text-amber-700 dark:text-amber-300",
                      )}
                    >
                      {order.deadline
                        ? formatDateShort(order.deadline)
                        : "ยังไม่กำหนด"}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function ErpCommandCenter() {
  const dashboardQuery = trpc.analytics.dashboard.useQuery();
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const data = dashboardQuery.data;

  const canViewPulse = permAllows(me?.permissions, "view_admin_reports");
  const canCreateOrder = canCreateOrderWithPricing(me?.permissions);
  const canViewBilling = permAllows(me?.permissions, "manage_billing_docs");
  const canViewQuotations = permAllows(me?.permissions, "see_order_money");
  const pulseQuery = trpc.analytics.ownerPulse.useQuery(undefined, {
    enabled: canViewPulse,
    retry: false,
  });

  const loading = dashboardQuery.isLoading || meQuery.isLoading;
  const primaryError =
    dashboardQuery.isError || meQuery.isError || (!loading && (!data || !me));

  if (loading) return <CommandCenterSkeleton />;

  if (primaryError || !data || !me) {
    return (
      <PrimaryError
        onRetry={() => {
          void dashboardQuery.refetch();
          void meQuery.refetch();
        }}
      />
    );
  }

  const attentionItems = pulseQuery.data
    ? buildDashboardAttentionItems(pulseQuery.data, {
        canViewBilling,
        canViewQuotations,
      })
    : [];
  const pulseLoading =
    canViewPulse &&
    !pulseQuery.data &&
    (pulseQuery.isLoading || pulseQuery.isFetching);
  const statusCounts = new Map(
    data.ordersByStatus.map((item) => [item.status, item.count]),
  );
  const stageCounts: StageCount[] = FLOW_STAGES.map((stage) => {
    const routeCount = stage.productionRoute
      ? data.productionRouteCounts[stage.productionRoute]
      : null;
    return {
      ...stage,
      count:
        routeCount ??
        stage.statuses.reduce(
          (sum, status) => sum + (statusCounts.get(status) ?? 0),
          0,
        ),
    };
  });

  return (
    <div className="redesign-command-center space-y-5">
      <header className="redesign-command-header flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold text-strong">
              ศูนย์ควบคุมวันนี้
            </h1>
            {dashboardQuery.dataUpdatedAt > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-green-500"
                  aria-hidden="true"
                />
                อัปเดต {formatTime(dashboardQuery.dataUpdatedAt)}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {formatCount(data.activeOrders)} งานยังไม่ปิด ·
            เช็กข้อยกเว้นและตำแหน่งล่าสุดในสายงาน
          </p>
        </div>
        {canCreateOrder && (
          <Link
            href="/orders/new"
            className={cn(
              CONTROL_MIN_H,
              FOCUS_BUTTON,
              "inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800 md:hidden",
            )}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            เปิดงาน
          </Link>
        )}
      </header>

      <div className="redesign-desktop-command hidden items-start gap-5 xl:grid xl:grid-cols-4">
        <div className="redesign-desktop-flow-stack space-y-4 xl:col-span-3">
          <FlowMatrix
            orders={data.recentOrders}
            canCreateOrder={canCreateOrder}
          />
          <StageBalance stages={stageCounts} />
        </div>
        <AttentionPanel
          allowed={canViewPulse}
          loading={pulseLoading}
          error={pulseQuery.isError}
          items={attentionItems}
          onRetry={() => void pulseQuery.refetch()}
        />
      </div>

      <div className="redesign-mobile-command space-y-5 xl:hidden">
        <AttentionPanel
          allowed={canViewPulse}
          loading={pulseLoading}
          error={pulseQuery.isError}
          items={attentionItems}
          onRetry={() => void pulseQuery.refetch()}
          mobile
        />
        <StageBalance stages={stageCounts} compact />
        <MobileRecentOrders
          orders={data.recentOrders}
          canCreateOrder={canCreateOrder}
        />
      </div>
    </div>
  );
}
