"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import type { InternalStatus } from "@prisma/client";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  ClipboardList,
  Factory,
  FileCheck2,
  Minus,
  Printer,
  RotateCcw,
  Truck,
  WalletCards,
  X,
} from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { permAllows } from "@/lib/permissions";
import { canPermsSetStatus, CHANNEL_LABELS } from "@/lib/order-status";
import {
  shouldGateOnReadiness,
} from "@/lib/order-tabs";
import {
  buildRedesignOrderDetailViewModel,
  canonicalOrderActionHref,
  getRedesignOrderNextStep,
  type RedesignOrderStage,
} from "@/lib/redesign-order-detail";
import { PRINT_POSITIONS, PRINT_TYPES } from "@/types/order-form";
import { PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import {
  APPROVAL_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
} from "@/lib/status-config";
import { nextStepBlockers } from "@/components/orders/detail";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { RecordNotFound } from "@/components/ui/record-not-found";
import {
  FOCUS_BUTTON,
  FOCUS_INSET,
  DASHED,
  INTERACTIVE_HOVER,
  INTERACTIVE_PRESSED,
  TINT,
} from "@/components/ui/tokens";
import { CONTROL_MIN_H } from "@/components/ui/control-size";

type OrderDetail = RouterOutput["order"]["getById"];
type OrderItem = OrderDetail["items"][number];

const STAGE_STATE_LABELS: Record<RedesignOrderStage["state"], string> = {
  complete: "ผ่านแล้ว",
  current: "กำลังอยู่ช่วงนี้",
  upcoming: "ยังไม่ถึง",
  "not-applicable": "ไม่ใช้กับงานนี้",
  unknown: "ต้องตรวจสอบ",
};

function RedesignOrderDetailSkeleton() {
  return (
    <div className="redesign-order-detail space-y-6" role="status" aria-label="กำลังโหลดออเดอร์">
      <div className="space-y-3">
        <Skeleton className="h-11 w-40 rounded-lg" />
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-4 w-80 max-w-full rounded" />
      </div>
      <div className="redesign-order-decision-grid grid gap-4">
        <Skeleton className="redesign-order-action-skeleton rounded-xl" />
        <Skeleton className="redesign-order-facts-skeleton rounded-xl" />
      </div>
      <Skeleton className="redesign-order-lifecycle-skeleton rounded-xl" />
      <div className="redesign-order-body-grid grid gap-4">
        <Skeleton className="redesign-order-brief-skeleton rounded-xl" />
        <Skeleton className="redesign-order-snapshot-skeleton rounded-xl" />
      </div>
      <span className="sr-only">กำลังโหลดรายละเอียดออเดอร์</span>
    </div>
  );
}

function StageMark({ stage }: { stage: RedesignOrderStage }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "redesign-order-stage-mark flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        stage.state === "complete" && "bg-blue-600 text-white dark:bg-blue-500",
        stage.state === "current" &&
          "border-2 border-blue-600 bg-white text-blue-700 dark:border-blue-400 dark:bg-slate-900 dark:text-blue-300",
        stage.state === "upcoming" &&
          "border border-slate-400 bg-surface text-slate-400 dark:border-slate-500 dark:text-slate-500",
        stage.state === "not-applicable" &&
          cn(DASHED, "bg-surface-muted text-muted"),
        stage.state === "unknown" &&
          cn(DASHED, "border-slate-400 bg-surface text-slate-400 dark:border-slate-600"),
      )}
    >
      {stage.state === "complete" ? (
        <Check className="h-4 w-4" strokeWidth={2.5} />
      ) : stage.state === "current" ? (
        <Circle className="h-2.5 w-2.5 fill-current" />
      ) : stage.state === "not-applicable" ? (
        <Minus className="h-4 w-4" />
      ) : stage.state === "unknown" ? (
        <X className="h-3.5 w-3.5" />
      ) : null}
    </span>
  );
}

function Lifecycle({ stages }: { stages: RedesignOrderStage[] }) {
  return (
    <section className="redesign-sheet px-4 py-5 sm:px-6" aria-labelledby="order-lifecycle-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="order-lifecycle-title" className="text-lg font-semibold text-strong">
            สถานะงานทั้งเส้น
          </h2>
          <p className="mt-1 text-sm text-muted">
            อ่านจากสถานะและวิธีผลิตจริงของออเดอร์นี้
          </p>
        </div>
      </div>
      <ol className="redesign-order-lifecycle mt-5 grid gap-2">
        {stages.map((stage, index) => (
          <li
            key={stage.key}
            aria-current={stage.state === "current" ? "step" : undefined}
            className={cn(
              "redesign-order-stage flex min-w-0 items-center gap-3 rounded-lg px-3 py-3 sm:block sm:px-2 sm:text-center",
              stage.state === "current" && "bg-blue-50 dark:bg-blue-950/30",
            )}
          >
            <div className="flex shrink-0 items-center gap-2 sm:justify-center">
              <span className="text-2xs font-semibold tabular-nums text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <StageMark stage={stage} />
            </div>
            <div className="min-w-0 sm:mt-2">
              <p className="text-sm font-semibold text-strong">{stage.label}</p>
              <p className="mt-0.5 text-2xs text-muted">
                {STAGE_STATE_LABELS[stage.state]}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function WarningStrip({ order, blockers }: { order: OrderDetail; blockers: string[] }) {
  const warnings = [
    ...blockers.map((message) => ({
      key: `blocker-${message}`,
      title: "งานยังไปต่อไม่ได้",
      message,
      tone: "danger" as const,
    })),
    ...(order.stockReservationError
      ? [{
          key: "stock",
          title: "ต้องแก้การจองสต๊อค",
          message: order.stockReservationError,
          tone: "danger" as const,
        }]
      : []),
    ...(order.blindShip
      ? [{
          key: "blind-ship",
          title: "ส่งแบบไม่ระบุผู้ส่ง",
          message: order.blindShipSenderName
            ? `ใช้ชื่อผู้ส่งบนกล่องว่า ${order.blindShipSenderName} และห้ามใส่ชื่อหรือเอกสาร Anajak`
            : "ยังไม่ระบุชื่อผู้ส่งบนกล่อง ต้องเติมก่อนแพ็ค และห้ามใส่ชื่อหรือเอกสาร Anajak",
          tone: "warning" as const,
        }]
      : []),
    ...(order.notes?.trim()
      ? [{
          key: "notes",
          title: "หมายเหตุที่ทีมต้องเห็น",
          message: order.notes.trim(),
          tone: "warning" as const,
        }]
      : []),
  ];

  if (warnings.length === 0) return null;

  return (
    <section aria-label="คำเตือนของออเดอร์" className="redesign-order-warnings space-y-2">
      {warnings.map((warning) => (
        <div
          key={warning.key}
          className={cn(
            "redesign-order-warning flex gap-3 rounded-xl border px-4 py-3",
            warning.tone === "danger"
              ? TINT.error
              : TINT.warning,
          )}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{warning.title}</p>
            <p className="mt-0.5 text-sm [overflow-wrap:anywhere]">{warning.message}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function itemQuantity(item: OrderItem) {
  const fromVariants = item.products.reduce(
    (itemSum, product) =>
      itemSum + product.variants.reduce((sum, variant) => sum + variant.quantity, 0),
    0,
  );
  return fromVariants || item.totalQuantity || 0;
}

function ItemBrief({ item, index }: { item: OrderItem; index: number }) {
  const quantity = itemQuantity(item);
  const productNames = item.products
    .map((product) => product.description)
    .filter(Boolean);
  const printDetails = item.prints.map((print) =>
    [
      PRINT_TYPES[print.printType] ?? print.printType,
      PRINT_POSITIONS[print.position] ?? print.position,
    ].join(" · "),
  );
  const sizes = item.products
    .flatMap((product) => product.variants)
    .filter((variant) => variant.quantity > 0)
    .map((variant) => `${variant.size} × ${variant.quantity}`);

  return (
    <article className="redesign-order-item-brief py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold text-strong">
          {item.description || `รายการงาน ${index + 1}`}
        </h3>
        <span className="text-sm font-semibold tabular-nums text-secondary">
          {quantity.toLocaleString("th-TH")} ชิ้น
        </span>
      </div>
      {productNames.length > 0 && (
        <p className="mt-2 text-sm text-secondary">{productNames.join(" · ")}</p>
      )}
      {sizes.length > 0 && (
        <p className="mt-1 text-xs text-muted">ไซซ์ {sizes.slice(0, 8).join(" · ")}{sizes.length > 8 ? ` · อีก ${sizes.length - 8}` : ""}</p>
      )}
      {printDetails.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {printDetails.map((detail, detailIndex) => (
            <Badge key={`${detail}-${detailIndex}`} variant="accent" size="sm">
              {detail}
            </Badge>
          ))}
        </div>
      )}
    </article>
  );
}

function SnapshotLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        CONTROL_MIN_H,
        FOCUS_INSET,
        INTERACTIVE_HOVER,
        INTERACTIVE_PRESSED,
        "-mx-2 mt-3 flex items-center justify-between rounded-lg px-2 text-sm font-semibold text-blue-700 dark:text-blue-300",
      )}
    >
      <span>{children}</span>
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

export function RedesignOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<RedesignOrderDetailSkeleton />}>
      <RedesignOrderDetailContent params={params} />
    </Suspense>
  );
}

function RedesignOrderDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const orderQuery = trpc.order.getById.useQuery({ id });
  const meQuery = trpc.user.me.useQuery();
  const order = orderQuery.data;
  const me = meQuery.data;
  const canSeeMoney = permAllows(me?.permissions, "see_order_money");
  const canCreateSalesDocs = permAllows(me?.permissions, "create_sales_docs");
  const shouldLoadReadiness = Boolean(
    order && ["CONFIRMED", "ON_HOLD"].includes(order.internalStatus),
  );
  const readinessQuery = trpc.production.orderContext.useQuery(
    { orderId: id },
    { enabled: shouldLoadReadiness },
  );
  const billingQuery = trpc.billing.listByOrder.useQuery(
    { orderId: id },
    { enabled: Boolean(me) && canSeeMoney },
  );

  if (orderQuery.isLoading || meQuery.isLoading) {
    return <RedesignOrderDetailSkeleton />;
  }

  if (orderQuery.isError && orderQuery.error.data?.code === "NOT_FOUND") {
    return (
      <RecordNotFound
        what="ออเดอร์ใบนี้"
        backHref="/redesign/orders"
        backLabel="กลับทะเบียนออเดอร์"
      />
    );
  }

  if (orderQuery.isError) {
    return (
      <div className="redesign-order-state space-y-5">
        <Link
          href="/redesign/orders"
          className={cn(
            CONTROL_MIN_H,
            FOCUS_BUTTON,
            "inline-flex items-center gap-2 rounded-lg px-2 text-sm font-semibold text-blue-700 dark:text-blue-300",
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          กลับทะเบียนออเดอร์
        </Link>
        <QueryError
          message="โหลดออเดอร์ไม่สำเร็จ"
          onRetry={() => void orderQuery.refetch()}
        />
      </div>
    );
  }

  if (!order) {
    return (
      <RecordNotFound
        what="ออเดอร์ใบนี้"
        backHref="/redesign/orders"
        backLabel="กลับทะเบียนออเดอร์"
      />
    );
  }

  if (meQuery.isError || !me) {
    return (
      <QueryError
        message="โหลดสิทธิ์ผู้ใช้ไม่สำเร็จ จึงยังเปิดข้อมูลของออเดอร์ไม่ได้"
        onRetry={() => void meQuery.refetch()}
      />
    );
  }

  const model = buildRedesignOrderDetailViewModel(order, {
    canSeeMoney,
    billingInvoices: billingQuery.data,
  });
  const nextStep = getRedesignOrderNextStep(order, { canSeeMoney });
  const readiness = readinessQuery.data?.readiness ?? null;
  const blockers = nextStepBlockers(nextStep, readiness);
  const action = nextStep?.action ?? null;
  const gatedByReadiness = Boolean(
    nextStep && shouldGateOnReadiness(nextStep.action, readiness),
  );
  const canUseAction = action
    ? action.type === "EDIT_ITEMS"
      ? canCreateSalesDocs
      : action.type === "STATUS"
        ? canPermsSetStatus(
            me.permissions,
            order.internalStatus,
            action.to as InternalStatus,
          )
        : action.type === "ANCHOR" && action.target === "billing"
          ? canSeeMoney
          : Boolean(nextStep?.buttonLabel)
    : false;
  const actionHref =
    action && canUseAction && !gatedByReadiness
      ? canonicalOrderActionHref(id, action) ?? `/orders/${id}`
      : `/orders/${id}`;
  const terminalTitle =
    order.internalStatus === "COMPLETED"
      ? "งานนี้ปิดครบแล้ว"
      : order.internalStatus === "CANCELLED"
        ? "ออเดอร์นี้ถูกยกเลิกแล้ว"
        : "เปิดรายละเอียดเพื่อตรวจงานต่อ";
  const actionTitle = nextStep?.title ?? terminalTitle;
  const actionDescription = nextStep?.description ??
    (order.internalStatus === "COMPLETED"
      ? "ดูเอกสาร ประวัติ และข้อมูลส่งมอบได้จากรายละเอียดเต็ม"
      : order.internalStatus === "CANCELLED"
        ? order.cancelledReason || "ตรวจเหตุผลและประวัติการยกเลิกได้จากรายละเอียดเต็ม"
        : "ระบบยังไม่มีขั้นถัดไปที่แนะนำสำหรับสถานะนี้");
  const actionLabel = gatedByReadiness
    ? "เปิดดูสิ่งที่ยังไม่พร้อม"
    : canUseAction && nextStep?.buttonLabel
      ? action?.type === "STATUS"
        ? `เปิดรายละเอียดเพื่อ${nextStep.buttonLabel}`
        : action?.type === "ANCHOR"
          ? nextStep.buttonLabel.replace(/^ไป/, "เปิด")
          : action?.type === "EDIT_ITEMS"
            ? "เปิดรายการสินค้า"
            : nextStep.buttonLabel
      : null;
  const customerName = order.customer.company || order.customer.name;
  const visibleItems = order.items.slice(0, 3);
  const latestDesign = order.designs[0];

  return (
    <div className="redesign-order-detail space-y-6">
      <header className="redesign-order-masthead flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/redesign/orders"
            className={cn(
              CONTROL_MIN_H,
              FOCUS_BUTTON,
              "-ml-2 inline-flex items-center gap-2 rounded-lg px-2 text-sm font-semibold text-blue-700 dark:text-blue-300",
            )}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            กลับทะเบียนออเดอร์
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-strong sm:text-3xl">
              {order.orderNumber}
            </h1>
            <OrderStatusBadge
              customerStatus={order.customerStatus}
              internalStatus={order.internalStatus}
              compact
            />
          </div>
          <p className="mt-1 text-base text-secondary">
            {order.title || "ยังไม่ได้ตั้งชื่องาน"} · {customerName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/print/job-ticket/${id}`}
            target="_blank"
            rel="noreferrer"
            className={cn(
              CONTROL_MIN_H,
              FOCUS_BUTTON,
              "inline-flex items-center gap-2 rounded-lg border border-divider bg-surface px-3 text-sm font-semibold text-secondary hover:bg-interactive-hover active:bg-interactive-pressed",
            )}
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            ใบสั่งงาน
          </Link>
          <Link
            href={`/orders/${id}`}
            className={cn(
              CONTROL_MIN_H,
              FOCUS_BUTTON,
              "inline-flex items-center gap-2 rounded-lg border border-divider bg-surface px-3 text-sm font-semibold text-secondary hover:bg-interactive-hover active:bg-interactive-pressed",
            )}
          >
            เปิดรายละเอียดเต็ม
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <div className="redesign-order-decision-grid grid gap-4">
        <section className="redesign-order-action redesign-sheet px-5 py-6 sm:px-7" aria-labelledby="next-work-title">
          <h2 id="next-work-title" className="max-w-3xl text-2xl font-semibold tracking-tight text-strong sm:text-3xl">
            {actionTitle}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-secondary sm:text-base">
            {actionDescription}
          </p>

          {shouldLoadReadiness && readinessQuery.isLoading && (
            <div className="mt-5 space-y-2" aria-label="กำลังตรวจความพร้อม">
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          )}

          {shouldLoadReadiness && readinessQuery.isError && (
            <div className={cn(TINT.warning, "mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm")}>
              <span>ตรวจด่านพร้อมผลิตไม่สำเร็จ</span>
              <button
                type="button"
                onClick={() => void readinessQuery.refetch()}
                className={cn(
                  CONTROL_MIN_H,
                  FOCUS_BUTTON,
                  "inline-flex items-center gap-2 rounded-lg px-2 font-semibold",
                )}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                ลองใหม่
              </button>
            </div>
          )}

          {readiness && (
            <ul className="redesign-readiness mt-5 grid gap-2 sm:grid-cols-3" aria-label="ด่านพร้อมผลิต">
              {readiness.checks.map((check) => (
                <li
                  key={check.key}
                  className="flex gap-2 rounded-lg bg-surface-muted px-3 py-2.5 text-sm"
                >
                  {check.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                  )}
                  <span>
                    <span className="font-semibold text-strong">{check.label}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {canSeeMoney
                        ? check.detail
                        : check.ok
                          ? "ผ่านแล้ว"
                          : check.waitingOn || "ยังไม่พร้อม"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {actionLabel && (
            <Link
              href={actionHref}
              className={cn(
                CONTROL_MIN_H,
                FOCUS_BUTTON,
                "mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800",
              )}
            >
              {actionLabel}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </section>

        <WarningStrip order={order} blockers={blockers} />

        <aside className="redesign-order-dispatch redesign-sheet px-5 py-5" aria-label="ข้อมูลสั่งงานย่อ">
          <dl className="redesign-order-dispatch-list">
            <div className="redesign-order-dispatch-item">
              <dt className="text-xs font-medium text-muted">ลูกค้า</dt>
              <dd className="mt-1 text-sm font-semibold text-strong">{customerName}</dd>
            </div>
            {order.deadline && (
              <div className="redesign-order-dispatch-item">
                <dt className="text-xs font-medium text-muted">กำหนดส่ง</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-strong">
                  {formatDate(order.deadline)}
                </dd>
              </div>
            )}
            <div className="redesign-order-dispatch-item">
              <dt className="text-xs font-medium text-muted">ปริมาณงาน</dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-strong">
                {model.totalQuantity.toLocaleString("th-TH")} ชิ้น · {model.itemCount} รายการ
              </dd>
            </div>
            <div className="redesign-order-dispatch-item">
              <dt className="text-xs font-medium text-muted">ช่วงปัจจุบัน</dt>
              <dd className="mt-1 text-sm font-semibold text-strong">
                {model.stageLabel || "ต้องตรวจสอบสถานะ"}
              </dd>
            </div>
            {model.printLabels.length > 0 && (
              <div className="redesign-order-dispatch-item">
                <dt className="text-xs font-medium text-muted">วิธีผลิต</dt>
                <dd className="mt-1 text-sm font-semibold text-strong">
                  {model.printLabels.join(" · ")}
                </dd>
              </div>
            )}
            <div className="redesign-order-dispatch-item">
              <dt className="text-xs font-medium text-muted">ช่องทางรับงาน</dt>
              <dd className="mt-1 text-sm font-semibold text-strong">
                {CHANNEL_LABELS[order.channel] ?? order.channel}
              </dd>
            </div>
          </dl>
        </aside>
      </div>

      <Lifecycle stages={model.stages} />

      <div className="redesign-order-body-grid grid gap-4">
        <section className="redesign-sheet px-5 py-6 sm:px-6" aria-labelledby="work-brief-title">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-divider pb-4">
            <div>
              <h2 id="work-brief-title" className="text-lg font-semibold text-strong">
                สเปกงานที่ทีมต้องจำ
              </h2>
              <p className="mt-1 text-sm text-muted">
                {model.productCount} สินค้า · {model.totalQuantity.toLocaleString("th-TH")} ชิ้น
                {model.sourceLabels.length > 0 ? ` · ${model.sourceLabels.join(" · ")}` : ""}
              </p>
            </div>
            <Link
              href={`/orders/${id}?tab=items`}
              className={cn(
                CONTROL_MIN_H,
                FOCUS_BUTTON,
                "inline-flex items-center gap-2 rounded-lg px-2 text-sm font-semibold text-blue-700 dark:text-blue-300",
              )}
            >
              ดูรายการทั้งหมด
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {visibleItems.length === 0 ? (
            <div className="py-10 text-center">
              <ClipboardList className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-strong">ยังไม่มีรายการสินค้า</p>
              <p className="mt-1 text-sm text-muted">เปิดรายละเอียดเต็มเพื่อเพิ่มรายการก่อนเดินงานต่อ</p>
            </div>
          ) : (
            <div className="redesign-order-item-list divide-y divide-divider">
              {visibleItems.map((item, index) => (
                <ItemBrief key={item.id} item={item} index={index} />
              ))}
            </div>
          )}

          {order.items.length > visibleItems.length && (
            <p className="mt-4 border-t border-divider pt-4 text-sm text-muted">
              ยังมีอีก {order.items.length - visibleItems.length} รายการในรายละเอียดเต็ม
            </p>
          )}
        </section>

        <aside className="redesign-sheet px-5 py-5" aria-labelledby="operation-snapshot-title">
          <h2 id="operation-snapshot-title" className="text-lg font-semibold text-strong">
            จุดส่งต่องาน
          </h2>
          <div className="mt-4 divide-y divide-divider">
            <section className="pb-4" aria-labelledby="design-snapshot-title">
              <h3 id="design-snapshot-title" className="flex items-center gap-2 text-sm font-semibold text-strong">
                <FileCheck2 className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                งานออกแบบ
              </h3>
              <p className="mt-2 text-sm text-secondary">
                {latestDesign
                  ? `เวอร์ชัน ${latestDesign.versionNumber} · ${APPROVAL_STATUS_LABELS[latestDesign.approvalStatus] ?? latestDesign.approvalStatus}`
                  : order.items.some((item) => item.prints.length > 0)
                    ? "ยังไม่มีไฟล์แบบในออเดอร์"
                    : "งานนี้ไม่มีลายพิมพ์"}
              </p>
              <SnapshotLink href={`/orders/${id}?tab=production`}>เปิดงานออกแบบและการผลิต</SnapshotLink>
            </section>

            <section className="py-4" aria-labelledby="production-snapshot-title">
              <h3 id="production-snapshot-title" className="flex items-center gap-2 text-sm font-semibold text-strong">
                <Factory className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                การผลิต
              </h3>
              {model.production.totalSteps > 0 ? (
                <div className="mt-2 space-y-1 text-sm text-secondary">
                  <p>
                    เสร็จ {model.production.completedSteps}/{model.production.totalSteps} ขั้น · {model.production.percent}%
                  </p>
                  {model.production.currentStepName && <p>กำลังทำ: {model.production.currentStepName}</p>}
                  {model.production.assigneeName && <p>ผู้ดูแล: {model.production.assigneeName}</p>}
                </div>
              ) : (
                <p className="mt-2 text-sm text-secondary">ยังไม่มีใบผลิต</p>
              )}
              <SnapshotLink href={`/redesign/production?order=${encodeURIComponent(id)}`}>
                ดูในศูนย์ควบคุมการผลิต
              </SnapshotLink>
            </section>

            <section className="py-4" aria-labelledby="delivery-snapshot-title">
              <h3 id="delivery-snapshot-title" className="flex items-center gap-2 text-sm font-semibold text-strong">
                <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                จัดส่ง
              </h3>
              {model.delivery.count > 0 ? (
                <div className="mt-2 space-y-1 text-sm text-secondary">
                  <p>
                    {model.delivery.count} ใบส่ง · {model.delivery.latestStatus
                      ? DELIVERY_STATUS_LABELS[
                          model.delivery.latestStatus as keyof typeof DELIVERY_STATUS_LABELS
                        ] ?? model.delivery.latestStatus
                      : "รอดำเนินการ"}
                  </p>
                  {model.delivery.carrier && <p>ขนส่ง: {model.delivery.carrier}</p>}
                  {model.delivery.trackingNumber && <p className="[overflow-wrap:anywhere]">พัสดุ: {model.delivery.trackingNumber}</p>}
                </div>
              ) : (
                <p className="mt-2 text-sm text-secondary">ยังไม่มีใบส่งของ</p>
              )}
              <SnapshotLink href={`/orders/${id}?tab=delivery`}>เปิดส่วนจัดส่ง</SnapshotLink>
            </section>

            {canSeeMoney && (
              <section className="pt-4" aria-labelledby="billing-snapshot-title">
                <h3 id="billing-snapshot-title" className="flex items-center gap-2 text-sm font-semibold text-strong">
                  <WalletCards className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  เงินและบิล
                </h3>
                {billingQuery.isLoading ? (
                  <Skeleton className="mt-3 h-12 w-full rounded-lg" />
                ) : billingQuery.isError ? (
                  <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                    <p>โหลดสรุปบิลไม่สำเร็จ</p>
                    <button
                      type="button"
                      onClick={() => void billingQuery.refetch()}
                      className={cn(
                        CONTROL_MIN_H,
                        FOCUS_BUTTON,
                        "mt-2 inline-flex items-center gap-2 rounded-lg px-2 font-semibold",
                      )}
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      ลองใหม่
                    </button>
                  </div>
                ) : model.billing && model.billing.invoiceCount > 0 ? (
                  <div className="mt-2 space-y-1 text-sm text-secondary">
                    <p>ยอดออเดอร์ {formatCurrency(order.totalAmount ?? 0)}</p>
                    <p>{model.billing.invoiceCount} เอกสาร · ค้าง {model.billing.openInvoiceCount} ใบ</p>
                    <p className="font-semibold text-strong">ยอดค้าง {formatCurrency(model.billing.outstanding)}</p>
                  </div>
                ) : (
                  <div className="mt-2 space-y-1 text-sm text-secondary">
                    <p>ยอดออเดอร์ {formatCurrency(order.totalAmount ?? 0)}</p>
                    <p>ยังไม่มีบิลหรือรายการรับเงิน</p>
                  </div>
                )}
                <SnapshotLink href={`/orders/${id}?tab=money`}>เปิดเงินและบิล</SnapshotLink>
              </section>
            )}
          </div>
        </aside>
      </div>

      <section className="redesign-order-record redesign-sheet px-5 py-5" aria-labelledby="record-context-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="record-context-title" className="text-lg font-semibold text-strong">
              ข้อมูลอ้างอิงของออเดอร์
            </h2>
            <p className="mt-1 text-sm text-muted">แสดงเฉพาะข้อมูลที่มีจริง ไม่เติมแถวเปล่า</p>
          </div>
          <SnapshotLink href={`/orders/${id}?tab=overview`}>เปิดภาพรวมเต็ม</SnapshotLink>
        </div>
        <dl className="redesign-order-record-grid mt-5 grid gap-x-6 gap-y-4 border-t border-divider pt-5 sm:grid-cols-2 lg:grid-cols-4">
          {order.poNumber && (
            <div>
              <dt className="text-xs font-medium text-muted">เลข PO ลูกค้า</dt>
              <dd className="mt-1 text-sm font-semibold text-strong">{order.poNumber}</dd>
            </div>
          )}
          {order.paymentTerms && (
            <div>
              <dt className="text-xs font-medium text-muted">เงื่อนไขชำระ</dt>
              <dd className="mt-1 text-sm font-semibold text-strong">
                {PAYMENT_TERMS_LABELS[order.paymentTerms] ?? order.paymentTerms}
              </dd>
            </div>
          )}
          {order.shippingRecipientName && (
            <div>
              <dt className="text-xs font-medium text-muted">ผู้รับสินค้า</dt>
              <dd className="mt-1 text-sm font-semibold text-strong">{order.shippingRecipientName}</dd>
            </div>
          )}
          {(order.shippingProvince || order.shippingAddress) && (
            <div>
              <dt className="text-xs font-medium text-muted">ปลายทาง</dt>
              <dd className="mt-1 text-sm font-semibold text-strong">
                {order.shippingProvince || order.shippingAddress}
              </dd>
            </div>
          )}
          {order.createdBy?.name && (
            <div>
              <dt className="text-xs font-medium text-muted">ผู้เปิดงาน</dt>
              <dd className="mt-1 text-sm font-semibold text-strong">{order.createdBy.name}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-medium text-muted">เปิดเมื่อ</dt>
            <dd className="mt-1 text-sm font-semibold text-strong">{formatDate(order.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <div className="redesign-order-mobile-clearance" aria-hidden="true" />
    </div>
  );
}
