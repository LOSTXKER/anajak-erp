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
import { ListSkeleton } from "@/components/ui/page-skeleton";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusLabel, toneFromBadgeVariant } from "@/components/ui/status-label";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { manufacturingTaskHref } from "@/lib/manufacturing-task";
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

  const operationHref = (input: {
    stepType: string;
    stepId: string;
    productionId: string;
    order: { orderNumber: string };
    executionEnabled: boolean;
    executionMode: string | null;
    workCenterCode: string | null;
  }) => {
    return manufacturingTaskHref({
      canSupervise: data.canSupervise,
      executionEnabled: input.executionEnabled,
      executionMode: input.executionMode,
      workCenterCode: input.workCenterCode,
      stepType: input.stepType,
      stepId: input.stepId,
      productionId: input.productionId,
      orderNumber: input.order.orderNumber,
    });
  };

  for (const step of data.production) {
    const isBlocked = step.status === "FAILED" || step.status === "ON_HOLD";
    items.push({
      key: `step:${step.stepId}`,
      href: operationHref(step),
      title:
        step.operationName ||
        step.customStepName ||
        STEP_TYPE_LABELS[step.stepType] ||
        step.stepType,
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
      href: data.canSupervise
        ? `/production/${queue.productionId}`
        : `/factory/station?station=dtf-print&productionId=${encodeURIComponent(queue.productionId)}&focusStepId=${encodeURIComponent(queue.stepId)}`,
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
      href: data.canSupervise
        ? `/production/${queue.productionId}`
        : `/factory/station?station=heat-press&productionId=${encodeURIComponent(queue.productionId)}&focusStepId=${encodeURIComponent(queue.stepId)}`,
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
      href: data.canSupervise
        ? queue.productionId
          ? `/production/${queue.productionId}`
          : `/production?q=${encodeURIComponent(queue.orderNumber)}`
        : queue.productionId
          ? `/factory/station?station=final-pack&jobId=${encodeURIComponent(queue.stepId)}`
          : `/factory/station?station=final-pack&orderId=${encodeURIComponent(queue.orderId)}`,
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
      href: "/production?view=outsource",
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

function TaskRow({ item, urgent }: { item: TaskListItem; urgent?: boolean }) {
  const attention = attentionLabel(item.attention);
  // ติดปัญหา/เลยกำหนด = ปลายทางของแถวนี้ (ไม่เดินต่อเองจนกว่าจะมีคนแตะ) → ย้อมข้อความ
  // ส่วน "ใกล้กำหนด" ยังเป็นระหว่างทาง ปล่อยให้จุดสีอำพันเป็นตัวบอกพอ
  const urgentAttention = item.attention === "blocked" || item.attention === "overdue";
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-interactive-hover active:bg-interactive-pressed",
          // rail ซ้ายเฉพาะกลุ่ม "ต้องทำก่อน" — สัญญาณแยกจากแถวคิวทีมโดยไม่เปลี่ยนโครง
          urgent && "border-l-2 border-red-400"
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 truncate text-sm font-medium text-strong">
              {item.title}
            </p>
            {attention && (
              <StatusLabel
                label={attention}
                tone={urgentAttention ? "danger" : "warning"}
                emphasize={urgentAttention}
              />
            )}
          </div>
          {item.description && (
            <p className="truncate text-xs text-secondary">
              {item.description}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary">
            {/* ป้ายสถานะของงานอยู่ในแถว meta (flex-wrap) เพื่อให้เห็นทุกขนาดจอ — ห้ามซ่อนบนมือถือ */}
            {item.badge && (
              <StatusLabel
                label={item.badge}
                tone={toneFromBadgeVariant(item.badgeTone)}
                // แดง = บิลเลยกำหนด ซึ่งเป็นปลายทางที่ต้องสะดุดตาตอนสแกน
                emphasize={item.badgeTone === "destructive"}
              />
            )}
            {item.deadline && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5",
                  (item.attention === "overdue" || item.attention === "blocked") &&
                    "font-medium text-red-600 dark:text-red-400",
                  item.attention === "due-soon" && "text-amber-700 dark:text-amber-400"
                )}
              >
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {formatDate(item.deadline)}
              </span>
            )}
            {item.meta && <span className="tabular-nums">{item.meta}</span>}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
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
        "card-surface overflow-hidden rounded-lg",
        // ต้องมี `border` คู่ด้วย ไม่งั้นสั่งแค่สีขอบ = เส้นไม่ขึ้นเลย (audit สี 2026-08-02)
        group.id === "attention" && "border border-red-200 dark:border-red-900"
      )}
    >
      <div className="flex items-start gap-3 border-b border-divider px-4 py-3">
        <div
          className={cn(
            "mt-0.5 rounded-lg p-2",
            group.id === "attention"
              ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
              : "bg-surface-muted text-secondary"
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-strong">{group.title}</h2>
            <Badge variant={group.id === "attention" ? "destructive" : "default"} size="sm">
              {group.items.length}
            </Badge>
          </div>
          {group.description && (
            <p className="text-xs text-secondary">{group.description}</p>
          )}
        </div>
      </div>
      <ul className="divide-y divide-divider">
        {visible.map((item) => (
          <TaskRow key={item.key} item={item} urgent={group.id === "attention"} />
        ))}
      </ul>
      {group.items.length > 5 && (
        <div className="border-t border-divider p-2">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-center"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
          >
            {expanded ? "ย่อรายการ" : `ดูทั้งหมดอีก ${remaining} งาน`}
            <ChevronDown
              className={cn(" transition-transform", expanded && "rotate-180")}
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

  const groups = data
    ? groupTaskItems(buildTaskItems(data)).filter((group) => group.items.length > 0)
    : [];
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <PageShell
      title="งานของฉัน"
      // ระหว่างโหลด/พังยังไม่รู้จำนวนงาน — ใช้ข้อความกลางเดิม (header อยู่ครบทุก state)
      meta={
        !data
          ? "เรียงสิ่งที่ต้องทำก่อนให้แล้ว"
          : total > 0
            ? `${total} งาน · เรียงงานติดปัญหาและใกล้กำหนดไว้ก่อนแล้ว`
            : "เคลียร์หมดแล้ว — ไม่มีงานค้าง"
      }
      loading={isLoading}
      skeleton={<ListSkeleton rows={5} />}
      error={
        isError || (!isLoading && !data)
          ? { message: "เกิดข้อผิดพลาดในการโหลดข้อมูล", onRetry: () => refetch() }
          : null
      }
    >
      {groups.length === 0 ? (
        <div className="card-surface rounded-lg">
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
    </PageShell>
  );
}
