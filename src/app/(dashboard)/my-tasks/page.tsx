"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { APPROVAL_STATUS_LABELS } from "@/lib/status-config";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import {
  Factory,
  Palette,
  ShoppingCart,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

function isOverdue(d: Date | string | null) {
  return !!d && new Date(d) < new Date();
}

function DeadlineChip({ deadline }: { deadline: Date | string | null }) {
  if (!deadline) return null;
  const overdue = isOverdue(deadline);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        overdue
          ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      )}
    >
      {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {overdue ? "เลยกำหนด " : "กำหนด "}
      {formatDate(deadline)}
    </span>
  );
}

function TaskSection({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number | string }>;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-slate-800/60 dark:bg-slate-900/80">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {count}
        </span>
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">{children}</ul>
    </section>
  );
}

// แถวงานแบบกดได้ทั้งแถว (เป้านิ้ว ≥44px — mobile-first ตาม DESIGN.md)
function TaskRow({
  href,
  primary,
  secondary,
  meta,
  right,
}: {
  href: string;
  primary: string;
  secondary?: string | null;
  meta?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-[56px] items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/50 dark:active:bg-slate-800"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{primary}</p>
          {secondary && (
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{secondary}</p>
          )}
          {meta && <div className="mt-1 flex flex-wrap items-center gap-1.5">{meta}</div>}
        </div>
        {right && <div className="shrink-0 text-right">{right}</div>}
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
      </Link>
    </li>
  );
}

export default function MyTasksPage() {
  const { data, isLoading } = trpc.task.myToday.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader title="งานของฉันวันนี้" description="สิ่งที่ค้างอยู่บนโต๊ะของคุณ" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const production = data?.production ?? [];
  const design = data?.design ?? [];
  const followUp = data?.followUp ?? [];
  const overdueInvoices = data?.billing.overdueInvoices ?? [];
  const shippedOrders = data?.billing.shippedOrders ?? [];

  const total =
    production.length +
    design.length +
    followUp.length +
    overdueInvoices.length +
    shippedOrders.length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="งานของฉันวันนี้"
        description={
          total > 0 ? `มี ${total} งานที่ต้องจัดการ` : "เคลียร์หมดแล้ว — ไม่มีงานค้าง"
        }
      />

      {total === 0 && (
        <div className="rounded-2xl border border-slate-200/70 bg-white dark:border-slate-800/60 dark:bg-slate-900/80">
          <EmptyState
            icon={CheckCircle2}
            title="ไม่มีงานค้างบนโต๊ะคุณ"
            description="งานใหม่ที่เกี่ยวกับบทบาทของคุณจะมาโผล่ที่นี่"
          />
        </div>
      )}

      {production.length > 0 && (
        <TaskSection icon={Factory} title="งานผลิตของฉัน" count={production.length}>
          {production.map((p) => (
            <TaskRow
              key={p.stepId}
              href={`/orders/${p.order.id}`}
              primary={p.customStepName || STEP_TYPE_LABELS[p.stepType] || p.stepType}
              secondary={`${p.order.orderNumber} · ${p.order.customer.name}`}
              meta={
                <>
                  <DeadlineChip deadline={p.order.deadline} />
                  {!p.assignedToId && (
                    <Badge variant="warning" size="sm">
                      ยังไม่มีคนรับ
                    </Badge>
                  )}
                </>
              }
              right={
                <Badge variant={p.status === "IN_PROGRESS" ? "accent" : "default"} size="sm">
                  {p.status === "IN_PROGRESS" ? "กำลังทำ" : "รอ"}
                </Badge>
              }
            />
          ))}
        </TaskSection>
      )}

      {design.length > 0 && (
        <TaskSection icon={Palette} title="งานออกแบบ" count={design.length}>
          {design.map((d) => (
            <TaskRow
              key={d.order.id}
              href={`/orders/${d.order.id}`}
              primary={d.order.title}
              secondary={`${d.order.orderNumber} · ${d.order.customer.name}`}
              meta={<DeadlineChip deadline={d.order.deadline} />}
              right={
                d.latestVersion == null ? (
                  <Badge variant="warning" size="sm">
                    ยังไม่มีแบบ
                  </Badge>
                ) : (
                  <Badge
                    variant={d.latestApproval === "PENDING" ? "accent" : "default"}
                    size="sm"
                  >
                    v{d.latestVersion}{" "}
                    {APPROVAL_STATUS_LABELS[
                      d.latestApproval as keyof typeof APPROVAL_STATUS_LABELS
                    ] ?? d.latestApproval}
                  </Badge>
                )
              }
            />
          ))}
        </TaskSection>
      )}

      {followUp.length > 0 && (
        <TaskSection icon={ShoppingCart} title="ติดตามลูกค้า → ยืนยันออเดอร์" count={followUp.length}>
          {followUp.map((f) => (
            <TaskRow
              key={f.order.id}
              href={`/orders/${f.order.id}`}
              primary={f.order.title}
              secondary={`${f.order.orderNumber} · ${f.order.customer.name}`}
              meta={
                f.itemCount === 0 ? (
                  <Badge variant="warning" size="sm">
                    ยังไม่มีรายการ
                  </Badge>
                ) : (
                  <DeadlineChip deadline={f.order.deadline} />
                )
              }
              right={
                <span className="text-sm font-medium tabular-nums text-slate-900 dark:text-white">
                  {formatCurrency(f.totalAmount)}
                </span>
              }
            />
          ))}
        </TaskSection>
      )}

      {overdueInvoices.length > 0 && (
        <TaskSection icon={FileText} title="บิลเลยกำหนดชำระ" count={overdueInvoices.length}>
          {overdueInvoices.map((inv) => (
            <TaskRow
              key={inv.id}
              href={`/orders/${inv.orderId}`}
              primary={`${inv.invoiceNumber} · ${inv.customerName}`}
              secondary={inv.orderNumber}
              meta={<DeadlineChip deadline={inv.dueDate} />}
              right={
                <span className="text-sm font-medium tabular-nums text-red-600 dark:text-red-400">
                  {formatCurrency(inv.totalAmount)}
                </span>
              }
            />
          ))}
        </TaskSection>
      )}

      {shippedOrders.length > 0 && (
        <TaskSection icon={CheckCircle2} title="ส่งแล้ว — วางบิลให้ครบ/ปิดงาน" count={shippedOrders.length}>
          {shippedOrders.map((o) => (
            <TaskRow
              key={o.id}
              href={`/orders/${o.id}`}
              primary={o.title}
              secondary={`${o.orderNumber} · ${o.customer.name}`}
              meta={<DeadlineChip deadline={o.deadline} />}
              right={<Badge size="sm">{INTERNAL_STATUS_LABELS[o.internalStatus]}</Badge>}
            />
          ))}
        </TaskSection>
      )}
    </div>
  );
}
