"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  UserRound,
  UsersRound,
} from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { APPROVAL_STATUS_LABELS } from "@/lib/status-config";
import {
  groupTaskItems,
  taskAttention,
  type TaskGroup,
  type TaskListItem,
} from "@/lib/task-groups";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type TaskData = RouterOutput["task"]["myToday"];

const GROUP_ICONS: Record<TaskGroup["id"], ComponentType<{ className?: string }>> = {
  attention: AlertTriangle,
  mine: UserRound,
  team: UsersRound,
};

function attentionLabel(attention: TaskListItem["attention"]) {
  if (attention === "blocked") return "ติดปัญหา";
  if (attention === "overdue") return "เลยกำหนด";
  if (attention === "due-soon") return "ใกล้กำหนด";
  return null;
}

function buildTaskItems(data: TaskData): TaskListItem[] {
  const items: TaskListItem[] = [];
  const ownership = (assignedToId: string | null) =>
    assignedToId === data.viewerId ? "mine" as const : "team" as const;

  for (const step of data.production) {
    const isBlocked = step.status === "FAILED" || step.status === "ON_HOLD";
    items.push({
      key: `step:${step.stepId}`,
      href: `/production/${step.productionId}`,
      title: step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType,
      description: `${step.order.orderNumber} · ${step.order.customer.name}`,
      deadline: step.order.deadline,
      attention: taskAttention(step.order.deadline, isBlocked),
      ownership: ownership(step.assignedToId),
      badge: isBlocked ? "มีปัญหา" : step.status === "IN_PROGRESS" ? "กำลังทำ" : "รอทำ",
      badgeTone: isBlocked ? "destructive" : step.status === "IN_PROGRESS" ? "accent" : "default",
      meta: step.assignedToName ?? "ยังไม่มีคนรับ",
    });
  }

  for (const queue of data.printQueue) {
    items.push({
      key: `step:${queue.stepId}`,
      href: "/production/print-runs",
      title: queue.orderName || queue.orderNumber,
      description: `${queue.orderNumber} · ${queue.customerName}`,
      deadline: queue.dueDate,
      attention: taskAttention(queue.dueDate),
      ownership: "team",
      badge: "คิวพิมพ์",
      badgeTone: "accent",
      meta: queue.qtyTotal > 0 ? `เหลือ ${queue.remaining.toLocaleString()} ชิ้น` : undefined,
    });
  }

  for (const queue of data.pressQueue) {
    items.push({
      key: `step:${queue.stepId}`,
      href: `/production/${queue.productionId}`,
      title: queue.title,
      description: queue.orderNumber,
      deadline: queue.deadline,
      attention: taskAttention(queue.deadline),
      ownership: "team",
      badge: "คิวรีด",
      meta:
        queue.qtyTotal != null
          ? `รีดแล้ว ${queue.qtyDone.toLocaleString()}/${queue.qtyTotal.toLocaleString()}`
          : undefined,
    });
  }

  for (const queue of data.packQueue) {
    items.push({
      key: `step:${queue.stepId}`,
      href: `/production/${queue.productionId}`,
      title: queue.title,
      description: `${queue.orderNumber} · ${queue.customerName}`,
      deadline: queue.deadline,
      attention: taskAttention(queue.deadline),
      ownership: "team",
      badge: "คิวแพ็ค",
      badgeTone: queue.blindShip ? "warning" : "default",
      meta: queue.blindShip ? "Blind ship — ห้ามใส่เอกสาร Anajak" : undefined,
    });
  }

  for (const order of data.awaitingProduction) {
    items.push({
      key: `order:${order.id}`,
      href: `/production?create=${order.id}`,
      title: order.title,
      description: `${order.orderNumber} · ${order.customer.name}`,
      deadline: order.deadline,
      attention: taskAttention(order.deadline),
      ownership: "team",
      badge: "รอเปิดใบผลิต",
      badgeTone: "warning",
    });
  }

  for (const design of data.design) {
    const latestApproval = design.latestApproval
      ? APPROVAL_STATUS_LABELS[design.latestApproval as keyof typeof APPROVAL_STATUS_LABELS]
      : null;
    items.push({
      key: `order:${design.order.id}`,
      href: `/orders/${design.order.id}`,
      title: design.order.title,
      description: `${design.order.orderNumber} · ${design.order.customer.name}`,
      deadline: design.order.deadline,
      attention: taskAttention(design.order.deadline),
      ownership: "team",
      badge: design.latestVersion == null ? "ยังไม่มีแบบ" : `แบบ v${design.latestVersion}`,
      badgeTone: design.latestVersion == null ? "warning" : "default",
      meta: latestApproval ?? undefined,
    });
  }

  const admin = data.adminToday;
  for (const outsource of admin.outsourceDue.items) {
    items.push({
      key: `outsource:${outsource.id}`,
      href: "/outsource",
      title: `รับงานกลับจาก ${outsource.vendorName}`,
      description: outsource.orderNumber,
      deadline: outsource.expectedBackAt,
      attention: "overdue",
      ownership: "team",
      badge: "ร้านนอก",
      badgeTone: "warning",
    });
  }
  for (const order of admin.awaitingInspection.items) {
    items.push({
      key: `order:${order.orderId}`,
      href: `/orders/${order.orderId}`,
      title: order.title,
      description: order.orderNumber,
      attention: "normal",
      ownership: "team",
      badge: "รอตรวจรับเสื้อ",
      badgeTone: "warning",
    });
  }
  for (const order of admin.designsAwaiting.items) {
    items.push({
      key: `order:${order.orderId}`,
      href: `/orders/${order.orderId}`,
      title: order.title,
      description: order.orderNumber,
      attention: "normal",
      ownership: "team",
      badge: "รอลูกค้าอนุมัติแบบ",
      badgeTone: "warning",
    });
  }
  for (const order of admin.dueSoon.items) {
    items.push({
      key: `order:${order.orderId}`,
      href: `/orders/${order.orderId}`,
      title: order.title,
      description: order.orderNumber,
      deadline: order.deadline,
      attention: "due-soon",
      ownership: "team",
      badge: "ใกล้กำหนดส่ง",
      badgeTone: "warning",
    });
  }

  for (const followUp of data.followUp) {
    items.push({
      key: `order:${followUp.order.id}`,
      href: `/orders/${followUp.order.id}`,
      title: followUp.order.title,
      description: `${followUp.order.orderNumber} · ${followUp.order.customer.name}`,
      deadline: followUp.order.deadline,
      attention: taskAttention(followUp.order.deadline),
      ownership: "team",
      badge: followUp.itemCount === 0 ? "ยังไม่มีรายการ" : "ติดตามลูกค้า",
      badgeTone: followUp.itemCount === 0 ? "warning" : "default",
      meta: formatCurrency(followUp.totalAmount),
    });
  }

  for (const invoice of data.billing.overdueInvoices) {
    items.push({
      key: `invoice:${invoice.id}`,
      href: `/orders/${invoice.orderId}?tab=money`,
      title: `${invoice.invoiceNumber} · ${invoice.customerName}`,
      description: invoice.orderNumber,
      deadline: invoice.dueDate,
      attention: "overdue",
      ownership: "team",
      badge: "บิลเลยกำหนด",
      badgeTone: "destructive",
      meta: formatCurrency(invoice.totalAmount),
    });
  }

  for (const order of data.billing.shippedOrders) {
    items.push({
      key: `order:${order.id}`,
      href: `/orders/${order.id}?tab=money`,
      title: order.title,
      description: `${order.orderNumber} · ${order.customer.name}`,
      deadline: order.deadline,
      attention: taskAttention(order.deadline),
      ownership: "team",
      badge: "รอวางบิล/ปิดงาน",
    });
  }

  return items;
}

function TaskRow({ item }: { item: TaskListItem }) {
  const attention = attentionLabel(item.attention);
  return (
    <li>
      <Link
        href={item.href}
        className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/50 dark:active:bg-slate-800"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="min-w-0 truncate text-sm font-medium text-slate-900 dark:text-white">
              {item.title}
            </p>
            {attention && (
              <Badge
                variant={item.attention === "blocked" || item.attention === "overdue" ? "destructive" : "warning"}
                size="sm"
              >
                {attention}
              </Badge>
            )}
          </div>
          {item.description && (
            <p className="truncate text-xs text-slate-600 dark:text-slate-300">
              {item.description}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
            {item.deadline && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {formatDate(item.deadline)}
              </span>
            )}
            {item.meta && <span className="tabular-nums">{item.meta}</span>}
          </div>
        </div>
        {item.badge && (
          <Badge variant={item.badgeTone ?? "default"} size="sm" className="hidden shrink-0 sm:inline-flex">
            {item.badge}
          </Badge>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      </Link>
    </li>
  );
}

function TaskGroupCard({ group }: { group: TaskGroup }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = GROUP_ICONS[group.id];
  const visible = expanded ? group.items : group.items.slice(0, 5);
  const remaining = group.items.length - visible.length;

  return (
    <section
      className={cn(
        "card-surface overflow-hidden rounded-2xl",
        group.id === "attention" && "border-red-200 dark:border-red-900"
      )}
    >
      <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div
          className={cn(
            "mt-0.5 rounded-lg p-2",
            group.id === "attention"
              ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
              : "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{group.title}</h2>
            <Badge variant={group.id === "attention" ? "destructive" : "default"} size="sm">
              {group.items.length}
            </Badge>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">{group.description}</p>
        </div>
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {visible.map((item) => <TaskRow key={item.key} item={item} />)}
      </ul>
      {group.items.length > 5 && (
        <div className="border-t border-slate-100 p-2 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-center"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
          >
            {expanded ? "ย่อรายการ" : `ดูทั้งหมดอีก ${remaining} งาน`}
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
              aria-hidden="true"
            />
          </Button>
        </div>
      )}
    </section>
  );
}

export default function MyTasksPage() {
  const { data, isLoading, isError, refetch } = trpc.task.myToday.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader title="งานของฉัน" description="เรียงสิ่งที่ต้องทำก่อนให้แล้ว" />
        {[0, 1, 2].map((index) => <Skeleton key={index} className="h-44 rounded-2xl" />)}
      </div>
    );
  }

  if (isError || !data) return <QueryError onRetry={() => refetch()} />;

  const groups = groupTaskItems(buildTaskItems(data)).filter((group) => group.items.length > 0);
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="งานของฉัน"
        description={
          total > 0
            ? `${total} งาน · เรียงงานติดปัญหาและใกล้กำหนดไว้ก่อนแล้ว`
            : "เคลียร์หมดแล้ว — ไม่มีงานค้าง"
        }
      />

      {groups.length === 0 ? (
        <div className="card-surface rounded-2xl">
          <EmptyState
            icon={CheckCircle2}
            title="ไม่มีงานค้างบนโต๊ะคุณ"
            description="งานใหม่ที่ตรงกับสิทธิ์ของคุณจะมาอยู่ที่นี่"
          />
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => <TaskGroupCard key={group.id} group={group} />)}
        </div>
      )}
    </div>
  );
}
