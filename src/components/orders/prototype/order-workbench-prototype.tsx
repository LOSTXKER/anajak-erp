"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import type { InternalStatus } from "@prisma/client";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Circle,
  CircleDashed,
  ClipboardList,
  Factory,
  FileCheck2,
  Minus,
  PackageCheck,
  RotateCcw,
  ShoppingCart,
  Truck,
  WalletCards,
} from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { permAllows } from "@/lib/permissions";
import {
  canIssueChangeOrder,
  canPermsSetStatus,
  CHANNEL_LABELS,
  isOrderLocked,
} from "@/lib/order-status";
import { canEditOrderWithPricing } from "@/lib/order-access";
import { shouldGateOnReadiness } from "@/lib/order-tabs";
import {
  buildOrderWorkbenchViewModel,
  canonicalOrderActionHref,
  getOrderWorkbenchNextStep,
  type OrderWorkbenchStage,
} from "@/lib/order-workbench";
import { PRINT_POSITIONS, PRINT_TYPES } from "@/types/order-form";
import {
  APPROVAL_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
} from "@/lib/status-config";
import { nextStepBlockers } from "@/components/orders/detail";
import { PageHeader } from "@/components/page-header";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { TINT } from "@/components/ui/tokens";

type OrderDetail = RouterOutput["order"]["getById"];
type OrderItem = OrderDetail["items"][number];

const STAGE_STATE_LABELS: Record<OrderWorkbenchStage["state"], string> = {
  complete: "ผ่านแล้ว",
  current: "กำลังทำ",
  upcoming: "ยังไม่ถึง",
  "not-applicable": "ไม่ใช้",
  unknown: "ยังไม่ระบุ",
};

function WorkbenchSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="กำลังโหลดต้นแบบออเดอร์">
      <div className="space-y-3">
        <Skeleton className="h-9 w-72 max-w-full rounded-lg" />
        <Skeleton className="h-4 w-96 max-w-full rounded" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.5fr)]">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <Skeleton className="h-52 rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.6fr)]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <span className="sr-only">กำลังโหลดข้อมูลจริงของออเดอร์</span>
    </div>
  );
}

function StageMark({ stage }: { stage: OrderWorkbenchStage }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        stage.state === "complete" && "bg-blue-600 text-white",
        stage.state === "current" &&
          "border-2 border-blue-600 bg-surface text-blue-700 dark:text-blue-300",
        stage.state === "upcoming" &&
          "border border-border bg-surface text-muted",
        stage.state === "not-applicable" &&
          "border border-dashed border-border bg-surface-muted text-muted",
        stage.state === "unknown" &&
          "border border-dashed border-border bg-surface text-muted",
      )}
    >
      {stage.state === "complete" ? (
        <Check className="h-4 w-4" strokeWidth={2.5} />
      ) : stage.state === "current" ? (
        <Circle className="h-2.5 w-2.5 fill-current" />
      ) : stage.state === "not-applicable" ? (
        <Minus className="h-4 w-4" />
      ) : stage.state === "unknown" ? (
        <CircleDashed className="h-3.5 w-3.5" />
      ) : null}
    </span>
  );
}

function Lifecycle({
  stages,
  currentLabel,
}: {
  stages: OrderWorkbenchStage[];
  currentLabel: string | null;
}) {
  return (
    <Section
      title="เส้นทางออเดอร์ 7 ช่วง"
      meta={currentLabel ? `ช่วงปัจจุบัน: ${currentLabel}` : "สถานะนี้ต้องตรวจสอบเพิ่มเติม"}
      icon={PackageCheck}
    >
      <ol className="hidden grid-cols-7 lg:grid" aria-label="เส้นทางออเดอร์">
        {stages.map((stage, index) => (
          <li
            key={stage.key}
            aria-current={stage.state === "current" ? "step" : undefined}
            className="min-w-0 px-2 first:pl-0 last:pr-0"
          >
            <div className="flex items-center">
              <StageMark stage={stage} />
              {index < stages.length - 1 && (
                <span
                  className={cn(
                    "h-px min-w-0 flex-1 bg-divider",
                    stage.state === "complete" && "bg-blue-600",
                  )}
                  aria-hidden="true"
                />
              )}
            </div>
            <p className="mt-3 text-sm font-semibold text-strong">{stage.label}</p>
            <p className="mt-1 text-xs text-muted">{STAGE_STATE_LABELS[stage.state]}</p>
          </li>
        ))}
      </ol>

      <ol className="divide-y divide-divider lg:hidden" aria-label="เส้นทางออเดอร์บนมือถือ">
        {stages.map((stage, index) => (
          <li
            key={stage.key}
            aria-current={stage.state === "current" ? "step" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 py-3",
              stage.state === "current" && "text-blue-700 dark:text-blue-300",
            )}
          >
            <StageMark stage={stage} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-strong">{stage.label}</p>
              <p className="text-xs text-muted">{STAGE_STATE_LABELS[stage.state]}</p>
            </div>
            <span className="text-xs tabular-nums text-muted">
              {index + 1}/{stages.length}
            </span>
          </li>
        ))}
      </ol>
    </Section>
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
  const sizes = item.products
    .flatMap((product) => product.variants)
    .filter((variant) => variant.quantity > 0)
    .map((variant) => `${variant.size} × ${variant.quantity}`);
  const printDetails = item.prints.map((print) =>
    [
      PRINT_TYPES[print.printType] ?? print.printType,
      PRINT_POSITIONS[print.position] ?? print.position,
    ].join(" · "),
  );

  return (
    <article className="py-4 first:pt-0 last:pb-0">
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
        <p className="mt-1 text-xs text-muted">
          ไซซ์ {sizes.slice(0, 8).join(" · ")}
          {sizes.length > 8 ? ` · อีก ${sizes.length - 8}` : ""}
        </p>
      )}
      {printDetails.length > 0 && (
        <p className="mt-2 text-xs text-secondary">{printDetails.join(" · ")}</p>
      )}
    </article>
  );
}

function SnapshotRow({
  icon: Icon,
  title,
  detail,
  href,
  linkLabel,
}: {
  icon: typeof FileCheck2;
  title: string;
  detail: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <section className="py-4 first:pt-0 last:pb-0" aria-label={title}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-strong">{title}</h3>
          <p className="mt-1 text-sm text-secondary [overflow-wrap:anywhere]">{detail}</p>
          <Button asChild variant="link" size="sm" className="-ml-3 mt-1">
            <Link href={href}>
              {linkLabel}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function OrderWorkbenchPrototype({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<WorkbenchSkeleton />}>
      <OrderWorkbenchPrototypeContent params={params} />
    </Suspense>
  );
}

function OrderWorkbenchPrototypeContent({
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
  const canUseEditForm = canEditOrderWithPricing(me?.permissions);
  const shouldLoadReadiness = Boolean(
    order && ["CONFIRMED", "ON_HOLD"].includes(order.internalStatus),
  );
  const readinessQuery = trpc.production.orderContext.useQuery(
    { orderId: id },
    { enabled: shouldLoadReadiness },
  );

  if (orderQuery.isLoading || meQuery.isLoading) {
    return <WorkbenchSkeleton />;
  }

  if (orderQuery.isError && orderQuery.error.data?.code === "NOT_FOUND") {
    return (
      <RecordNotFound
        what="ออเดอร์ใบนี้"
        backHref="/orders"
        backLabel="กลับไปออเดอร์"
      />
    );
  }

  if (orderQuery.isError) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="ต้นแบบรายละเอียดออเดอร์"
          description="โหลดข้อมูลออเดอร์ไม่สำเร็จ"
          back={{ href: "/orders", label: "กลับไปออเดอร์" }}
          icon={ShoppingCart}
        />
        <Section>
          <QueryError
            message="โหลดออเดอร์ไม่สำเร็จ"
            onRetry={() => void orderQuery.refetch()}
          />
        </Section>
      </div>
    );
  }

  if (!order) {
    return (
      <RecordNotFound
        what="ออเดอร์ใบนี้"
        backHref="/orders"
        backLabel="กลับไปออเดอร์"
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

  const model = buildOrderWorkbenchViewModel(order);
  const nextStep = getOrderWorkbenchNextStep(order, { canSeeMoney });
  const readiness = readinessQuery.data?.readiness ?? null;
  const blockers = nextStepBlockers(nextStep, readiness);
  const action = nextStep?.action ?? null;
  const canEditItems =
    !isOrderLocked(order.internalStatus) || canIssueChangeOrder(order.internalStatus);
  const gatedByReadiness = Boolean(
    nextStep && shouldGateOnReadiness(nextStep.action, readiness),
  );
  const canUseAction = action
    ? action.type === "EDIT_ITEMS"
      ? canUseEditForm && canEditItems
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
  const canonicalOrderHref = `/orders/${encodeURIComponent(id)}`;
  const actionHref = gatedByReadiness
    ? `${canonicalOrderHref}?tab=production`
    : action && canUseAction
      ? canonicalOrderActionHref(id, action) ?? canonicalOrderHref
      : canonicalOrderHref;
  const actionLabel = gatedByReadiness
    ? "เปิดสิ่งที่ยังไม่พร้อม"
    : canUseAction && nextStep?.buttonLabel
      ? action?.type === "STATUS"
        ? `เปิดหน้าปัจจุบันเพื่อ${nextStep.buttonLabel}`
        : nextStep.buttonLabel.replace(/^ไป/, "เปิด")
      : "เปิดหน้าปัจจุบัน";
  const terminalTitle =
    order.internalStatus === "COMPLETED"
      ? "งานนี้ปิดครบแล้ว"
      : order.internalStatus === "CANCELLED"
        ? "ออเดอร์นี้ถูกยกเลิกแล้ว"
        : "เปิดหน้าปัจจุบันเพื่อตรวจงานต่อ";
  const actionTitle = nextStep?.title ?? terminalTitle;
  const actionDescription =
    nextStep?.description ??
    (order.internalStatus === "COMPLETED"
      ? "เอกสาร ประวัติ และข้อมูลส่งมอบยังเปิดดูได้จากหน้าปัจจุบัน"
      : order.cancelledReason || "ตรวจเหตุผลและประวัติได้จากหน้าปัจจุบัน");
  const customerName = order.customer.company || order.customer.name;
  const visibleItems = order.items.slice(0, 3);
  const latestDesign = order.designs[0];
  const warnings = [
    ...blockers.map((message) => ({
      key: `blocker-${message}`,
      title: "งานยังไปต่อไม่ได้",
      message,
      tone: "danger" as const,
    })),
    ...(order.stockReservationError
      ? [
          {
            key: "stock",
            title: "ต้องแก้การจองสต๊อค",
            message: order.stockReservationError,
            tone: "danger" as const,
          },
        ]
      : []),
    ...(order.blindShip
      ? [
          {
            key: "blind-ship",
            title: "ส่งแบบไม่ระบุผู้ส่ง",
            message: order.blindShipSenderName
              ? `ใช้ชื่อผู้ส่งว่า ${order.blindShipSenderName} และห้ามใส่ชื่อหรือเอกสาร Anajak`
              : "ยังไม่ระบุชื่อผู้ส่งบนกล่อง ต้องเติมก่อนแพ็ค และห้ามใส่ชื่อหรือเอกสาร Anajak",
            tone: "warning" as const,
          },
        ]
      : []),
    ...(order.notes?.trim()
      ? [
          {
            key: "notes",
            title: "หมายเหตุที่ทีมต้องเห็น",
            message: order.notes.trim(),
            tone: "warning" as const,
          },
        ]
      : []),
  ];
  const productionHref = model.production.targetId
    ? `/production/${encodeURIComponent(model.production.targetId)}`
    : `${canonicalOrderHref}?tab=production`;
  const deliveryStatusLabel = model.delivery.latestStatus
    ? DELIVERY_STATUS_LABELS[
        model.delivery.latestStatus as keyof typeof DELIVERY_STATUS_LABELS
      ] ?? model.delivery.latestStatus
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={customerName}
        description={order.title || "ยังไม่ได้ตั้งชื่องาน"}
        meta={`${order.orderNumber} · ต้นแบบชั่วคราวจากข้อมูลจริง`}
        titleBadge={
          <OrderStatusBadge
            customerStatus={order.customerStatus}
            internalStatus={order.internalStatus}
            compact
            showInternalStatus={false}
          />
        }
        back={{ href: "/orders", label: "กลับไปออเดอร์" }}
        icon={ShoppingCart}
        action={
          <Button asChild variant="outline">
            <Link href={canonicalOrderHref}>เปิดหน้าปัจจุบัน</Link>
          </Button>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.5fr)]">
        <Section
          title="งานถัดไป"
          meta="ระบบสรุปจากสถานะ สิทธิ์ และข้อมูลที่มีอยู่จริง"
          icon={ArrowRight}
        >
          <h3 className="max-w-[28ch] text-2xl font-semibold text-strong">
            {actionTitle}
          </h3>
          <p className="mt-3 max-w-[70ch] text-sm leading-relaxed text-secondary">
            {actionDescription}
          </p>

          {shouldLoadReadiness && readinessQuery.isLoading && (
            <div className="mt-5 space-y-2" role="status" aria-label="กำลังตรวจความพร้อม">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          )}

          {shouldLoadReadiness && readinessQuery.isError && (
            <div
              className={cn(
                TINT.warning,
                "mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm",
              )}
            >
              <span>ตรวจด่านพร้อมผลิตไม่สำเร็จ</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void readinessQuery.refetch()}
              >
                <RotateCcw />
                ลองใหม่
              </Button>
            </div>
          )}

          {readiness && (
            <ul className="mt-5 grid gap-2 sm:grid-cols-3" aria-label="ด่านพร้อมผลิต">
              {readiness.checks.map((check) => (
                <li key={check.key} className="flex gap-2 border-t border-divider py-3 text-sm">
                  {check.ok ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-700 dark:text-green-400" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
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

          {warnings.length > 0 && (
            <ul className="mt-5 space-y-2" aria-label="คำเตือนของออเดอร์">
              {warnings.map((warning) => (
                <li
                  key={warning.key}
                  className={cn(
                    "flex gap-3 rounded-lg border px-4 py-3",
                    warning.tone === "danger" ? TINT.error : TINT.warning,
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{warning.title}</p>
                    <p className="mt-0.5 text-sm [overflow-wrap:anywhere]">{warning.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Button asChild className="mt-6">
            <Link href={actionHref}>
              {actionLabel}
              <ArrowRight />
            </Link>
          </Button>
        </Section>

        <Section title="ข้อมูลสั่งงาน" meta="ข้อมูลที่ต้องใช้ตัดสินใจตอนนี้" icon={ClipboardList}>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-1 xl:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">กำหนดส่ง</dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-strong">
                {order.deadline ? formatDate(order.deadline) : "ยังไม่กำหนด"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">ปริมาณงาน</dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-strong">
                {model.itemCount > 0
                  ? `${model.totalQuantity.toLocaleString("th-TH")} ชิ้น · ${model.itemCount} รายการ`
                  : "ยังไม่มีรายการ"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">ช่วงปัจจุบัน</dt>
              <dd className="mt-1 text-sm font-semibold text-strong">
                {model.stageLabel || "ต้องตรวจสอบ"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">วิธีผลิต</dt>
              <dd className="mt-1 text-sm font-semibold text-strong">
                {model.printLabels.length > 0 ? model.printLabels.join(" · ") : "ยังไม่ระบุ"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">ช่องทางรับงาน</dt>
              <dd className="mt-1 text-sm font-semibold text-strong">
                {CHANNEL_LABELS[order.channel] ?? order.channel}
              </dd>
            </div>
            {canSeeMoney && (
              <div>
                <dt className="text-xs text-muted">ยอดออเดอร์</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-strong">
                  {model.itemCount > 0 && order.totalAmount != null
                    ? formatCurrency(order.totalAmount)
                    : "ยังไม่ตีราคา"}
                </dd>
              </div>
            )}
          </dl>
        </Section>
      </div>

      <Lifecycle stages={model.stages} currentLabel={model.stageLabel} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.6fr)]">
        <Section
          title="รายการและสเปกงาน"
          meta={
            model.itemCount > 0
              ? `${model.productCount} สินค้า · ${model.totalQuantity.toLocaleString("th-TH")} ชิ้น${
                  model.sourceLabels.length > 0 ? ` · ${model.sourceLabels.join(" · ")}` : ""
                }`
              : "ยังไม่มีข้อมูลสเปกให้ทีมผลิต"
          }
          icon={ShoppingCart}
          action={
            <Button asChild variant="outline" size="sm">
              <Link href={`${canonicalOrderHref}?tab=items`}>เปิดรายการทั้งหมด</Link>
            </Button>
          }
        >
          {visibleItems.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="ยังไม่มีรายการสินค้า"
              description="งานนี้ต้องใส่รายการและราคาก่อนจึงจะยืนยันออเดอร์ได้"
            />
          ) : (
            <div className="divide-y divide-divider">
              {visibleItems.map((item, index) => (
                <ItemBrief key={item.id} item={item} index={index} />
              ))}
            </div>
          )}
          {order.items.length > visibleItems.length && (
            <p className="mt-4 border-t border-divider pt-4 text-sm text-muted">
              ยังมีอีก {order.items.length - visibleItems.length} รายการในหน้าปัจจุบัน
            </p>
          )}
        </Section>

        <Section title="จุดส่งต่องาน" meta="เปิดเฉพาะส่วนที่ต้องลงมือทำต่อ" icon={Factory}>
          <div className="divide-y divide-divider">
            <SnapshotRow
              icon={FileCheck2}
              title="ม็อกอัพ & ไฟล์"
              detail={
                latestDesign
                  ? `เวอร์ชัน ${latestDesign.versionNumber} · ${
                      APPROVAL_STATUS_LABELS[latestDesign.approvalStatus] ??
                      latestDesign.approvalStatus
                    }`
                  : order.items.some((item) => item.prints.length > 0)
                    ? "ยังไม่มีม็อกอัพในออเดอร์"
                    : "ยังไม่มีงานพิมพ์ที่ต้องทำม็อกอัพ"
              }
              href={`${canonicalOrderHref}?tab=files`}
              linkLabel="เปิดม็อกอัพ & ไฟล์"
            />
            <SnapshotRow
              icon={Factory}
              title="งานผลิต"
              detail={
                model.production.productionCount === 0
                  ? "ยังไม่มีใบสั่งผลิต"
                  : model.production.currentStepName
                    ? `${model.production.currentStepName}${
                        model.production.assigneeName
                          ? ` · ผู้รับผิดชอบ ${model.production.assigneeName}`
                          : ""
                      }`
                    : `ทำแล้ว ${model.production.completedSteps}/${model.production.totalSteps} ขั้น`
              }
              href={productionHref}
              linkLabel={model.production.targetId ? "เปิด Control Record" : "เปิดสรุปงานผลิต"}
            />
            <SnapshotRow
              icon={Truck}
              title="จัดส่ง"
              detail={
                model.delivery.count === 0
                  ? order.deadline
                    ? `ยังไม่มีใบส่ง · กำหนด ${formatDate(order.deadline)}`
                    : "ยังไม่มีใบส่งและยังไม่กำหนดวันส่ง"
                  : `${
                      deliveryStatusLabel
                    }${model.delivery.trackingNumber ? ` · ${model.delivery.trackingNumber}` : ""}`
              }
              href={`${canonicalOrderHref}?tab=delivery`}
              linkLabel="เปิดการจัดส่ง"
            />
            {canSeeMoney && (
              <SnapshotRow
                icon={WalletCards}
                title="เงิน & บิล"
                detail={
                  model.itemCount > 0 && order.totalAmount != null
                    ? `ยอดออเดอร์ ${formatCurrency(order.totalAmount)} · ${order.invoices.length} เอกสาร`
                    : "ยังไม่ตีราคาและยังไม่มีภาพรวมยอดเงิน"
                }
                href={`${canonicalOrderHref}?tab=money`}
                linkLabel="เปิดเงิน & บิล"
              />
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
