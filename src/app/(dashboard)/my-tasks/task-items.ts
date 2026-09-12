import type { RouterOutput } from "@/lib/trpc";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { manufacturingTaskHref } from "@/lib/manufacturing-task";
import { APPROVAL_STATUS_LABELS } from "@/lib/status-config";
import { taskAttention, type TaskListItem } from "@/lib/task-groups";
import { formatCurrency } from "@/lib/utils";

type TaskData = RouterOutput["task"]["myToday"];

export function buildTaskItems(data: TaskData): TaskListItem[] {
  // ออเดอร์เดียวมีหลายงานได้; รวมซ้ำเฉพาะงานเดียวกันที่มาจากหลายแหล่ง
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
      href: `/production/${queue.productionId}`,
      title: queue.orderNumber,
      description: queue.customerName,
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
      title: queue.orderNumber,
      description: queue.customerName,
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
      href: queue.productionId
        ? `/production/${queue.productionId}`
        : `/production?q=${encodeURIComponent(queue.orderNumber)}`,
      title: queue.orderNumber,
      description: queue.customerName,
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
      key: `production:open:${order.id}`,
      href: `/production?create=${order.id}`,
      title: order.orderNumber,
      description: order.customer.name,
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
      key: `design:${design.order.id}`,
      href: `/orders/${design.order.id}?tab=files`,
      title: design.order.orderNumber,
      description: design.order.customer.name,
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
      href: `/orders/${outsource.orderId}?tab=production`,
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
      key: `receipt:garment:${order.orderId}`,
      href: `/orders/${order.orderId}?tab=production`,
      title: order.orderNumber,
      description: order.customerName,
      attention: "normal",
      ownership: "team",
      badge: "รอตรวจรับเสื้อ",
      badgeTone: "warning",
    });
  }
  for (const order of admin.designsAwaiting.items) {
    items.push({
      key: `design:${order.orderId}`,
      href: `/orders/${order.orderId}?tab=files`,
      title: order.orderNumber,
      description: order.customerName,
      attention: "normal",
      ownership: "team",
      badge: "รอลูกค้าอนุมัติแบบ",
      badgeTone: "warning",
    });
  }
  for (const order of admin.dueSoon.items) {
    items.push({
      key: `followup:deadline:${order.orderId}`,
      href: `/orders/${order.orderId}`,
      title: order.orderNumber,
      description: order.customerName,
      deadline: order.deadline,
      attention: "due-soon",
      ownership: "team",
      badge: "ใกล้กำหนดส่ง",
      badgeTone: "warning",
    });
  }

  for (const followUp of data.followUp) {
    items.push({
      key: `followup:customer:${followUp.order.id}`,
      href: `/orders/${followUp.order.id}`,
      title: followUp.order.orderNumber,
      description: followUp.order.customer.name,
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
      key: `billing:order:${order.id}`,
      href: `/orders/${order.id}?tab=money`,
      title: order.orderNumber,
      description: order.customer.name,
      deadline: order.deadline,
      attention: taskAttention(order.deadline),
      ownership: "team",
      badge: "รอวางบิล/ปิดงาน",
    });
  }

  return items;
}
