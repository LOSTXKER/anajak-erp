"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Factory,
  Flame,
  Hourglass,
  ListTodo,
  PackageCheck,
  PenLine,
  Printer,
  ReceiptText,
  RefreshCw,
  Shirt,
  Truck,
  Wallet,
} from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { PageShell } from "@/components/page-shell";
import { c, CardHead, Empty, timeText, type Tone } from "@/components/kit/kit";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { manufacturingTaskHref } from "@/lib/manufacturing-task";
import { BLIND_SHIP_LABEL } from "@/lib/order-status";
import { APPROVAL_STATUS_LABELS, STEP_STATUS_LABELS } from "@/lib/status-config";
import {
  groupTaskItems,
  taskAttention,
  taskTone,
  type TaskGroup,
  type TaskListItem,
  type TaskTone,
} from "@/lib/task-groups";
import { formatBaht, formatDate } from "@/lib/utils";
import { customerDisplayName } from "@/lib/customer-name";

/* ============================================================
   งานของฉัน — ต้นแบบ pgTasks(): หัวหน้า + ปุ่มโหลดใหม่ → การ์ดกองละใบ → แถวงาน
   แถวเรียงซ้าย→ขวา: ไอคอนประจำเรื่อง · หัวเรื่อง+บรรทัดรอง · เลขออเดอร์ · ปุ่มที่บอกว่าจะไปทำอะไร
   กองไหนมีงานขึ้นตามสิทธิ์จริงของคน (router task.myToday) — ไม่ใช่รายการตายตัวแบบต้นแบบ
   ============================================================ */

type TaskData = RouterOutput["task"]["myToday"];

const GROUP_ICONS: Record<TaskGroup["id"], LucideIcon> = {
  attention: Flame,
  mine: ListTodo,
  team: Hourglass,
};

/** จำนวนแถวที่เปิดมาเห็นก่อน — ของจริงกองละหลายสิบแถวได้ จึงยังมีปุ่มขยาย */
const VISIBLE_ROWS = 5;

const ATTENTION_LABEL: Record<TaskListItem["attention"], string | null> = {
  blocked: "ติดปัญหา",
  overdue: "เลยกำหนด",
  "due-soon": "ใกล้กำหนด",
  normal: null,
};

/** โทนกองบนกล่องไอคอนของหัวการ์ด — เทา = ไม่ใส่สี (ต้นแบบ ic ว่าง) */
const headTone = (tone: TaskTone): Tone => (tone === "gray" ? "" : tone);

function buildTaskItems(data: TaskData): TaskListItem[] {
  const items: TaskListItem[] = [];
  const ownership = (assignedToId: string | null) =>
    assignedToId === data.viewerId ? "mine" as const : "team" as const;
  const orderLink = (orderId: string) => `/orders/${orderId}`;

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
    // คำสถานะขั้นอ่านจากชุดกลางชุดเดียวกับใบผลิตและจอทีวี — "ติดปัญหา" (งานสะดุด)
    // กับ "พักไว้" (หัวหน้าตั้งใจหยุด) เป็นคนละเรื่อง ยุบเป็นคำเดียวแล้วช่างแยกไม่ออก
    // ว่าต้องลงมือแก้หรือรอคำสั่ง (เดิมจุดนี้เขียน "มีปัญหา" ทับทั้งสองค่า)
    const state = STEP_STATUS_LABELS[step.status as keyof typeof STEP_STATUS_LABELS] ?? step.status;
    items.push({
      key: `step:${step.stepId}`,
      href: operationHref(step),
      icon: Factory,
      title:
        step.operationName ||
        step.customStepName ||
        STEP_TYPE_LABELS[step.stepType] ||
        step.stepType,
      description: customerDisplayName(step.order.customer),
      orderNumber: step.order.orderNumber,
      orderHref: orderLink(step.order.id),
      deadline: step.order.deadline,
      attention: taskAttention(step.order.deadline, isBlocked),
      ownership: ownership(step.assignedToId),
      meta: `${state} · ${step.assignedToName ?? "ยังไม่มีคนรับ"}`,
      actionLabel: isBlocked ? "ดูปัญหา" : "เปิดขั้นงาน",
    });
  }

  for (const queue of data.printQueue) {
    items.push({
      key: `step:${queue.stepId}`,
      href: `/production/${queue.productionId}`,
      icon: Printer,
      title: "คิวพิมพ์ฟิล์ม DTF",
      description: queue.customerName,
      orderNumber: queue.orderNumber,
      orderHref: orderLink(queue.orderId),
      deadline: queue.dueDate,
      attention: taskAttention(queue.dueDate),
      ownership: "team",
      meta: queue.qtyTotal > 0 ? `เหลือ ${queue.remaining.toLocaleString("th-TH")} ชิ้น` : undefined,
      actionLabel: "ไปคิวพิมพ์",
    });
  }

  for (const queue of data.pressQueue) {
    items.push({
      key: `step:${queue.stepId}`,
      href: `/production/${queue.productionId}`,
      icon: Flame,
      title: "คิวรีดร้อน",
      description: queue.customerName,
      // คิวรีดไม่มีรหัสออเดอร์ติดมาด้วย จึงโชว์เลขเป็นข้อความ ไม่ทำเป็นลิงก์ที่เดาปลายทาง
      orderNumber: queue.orderNumber,
      deadline: queue.deadline,
      attention: taskAttention(queue.deadline),
      ownership: "team",
      meta:
        queue.qtyTotal != null
          ? `รีดแล้ว ${queue.qtyDone.toLocaleString("th-TH")}/${queue.qtyTotal.toLocaleString("th-TH")}`
          : undefined,
      actionLabel: "ไปคิวรีด",
    });
  }

  for (const queue of data.packQueue) {
    items.push({
      key: `step:${queue.stepId}`,
      href: queue.productionId
        ? `/production/${queue.productionId}`
        : `/production?q=${encodeURIComponent(queue.orderNumber)}`,
      icon: PackageCheck,
      title: "คิวแพ็คและส่งของ",
      description: queue.customerName,
      orderNumber: queue.orderNumber,
      orderHref: orderLink(queue.orderId),
      deadline: queue.deadline,
      attention: taskAttention(queue.deadline),
      ownership: "team",
      // กติกา blind ship ห้ามหายไปกับการจัดหน้า — ขึ้นเป็นป้ายคู่กับข้อความเต็ม
      warning: queue.blindShip ? BLIND_SHIP_LABEL : undefined,
      meta: queue.blindShip ? "ห้ามใส่เอกสาร Anajak" : undefined,
      actionLabel: "ไปคิวแพ็ค",
    });
  }

  for (const order of data.awaitingProduction) {
    items.push({
      key: `order:${order.id}`,
      href: `/production?create=${order.id}`,
      icon: Factory,
      title: "รอเปิดใบผลิต",
      description: customerDisplayName(order.customer),
      orderNumber: order.orderNumber,
      orderHref: orderLink(order.id),
      deadline: order.deadline,
      attention: taskAttention(order.deadline),
      ownership: "team",
      actionLabel: "เปิดใบผลิต",
    });
  }

  for (const design of data.design) {
    const latestApproval = design.latestApproval
      ? APPROVAL_STATUS_LABELS[design.latestApproval as keyof typeof APPROVAL_STATUS_LABELS]
      : null;
    const version = design.latestVersion == null ? "ยังไม่มีแบบ" : `แบบ v${design.latestVersion}`;
    items.push({
      key: `order:${design.order.id}`,
      href: `/orders/${design.order.id}?tab=files`,
      icon: PenLine,
      title: "งานออกแบบ",
      description: customerDisplayName(design.order.customer),
      orderNumber: design.order.orderNumber,
      orderHref: orderLink(design.order.id),
      deadline: design.order.deadline,
      attention: taskAttention(design.order.deadline),
      ownership: "team",
      meta: latestApproval ? `${version} · ${latestApproval}` : version,
      actionLabel: "ดูไฟล์งาน",
    });
  }

  const admin = data.adminToday;
  for (const outsource of admin.outsourceDue.items) {
    items.push({
      key: `outsource:${outsource.id}`,
      href: `/orders/${outsource.orderId}?tab=production`,
      icon: Truck,
      title: `รับงานกลับจาก ${outsource.vendorName}`,
      orderNumber: outsource.orderNumber,
      orderHref: orderLink(outsource.orderId),
      deadline: outsource.expectedBackAt,
      deadlineLabel: "นัดรับ",
      attention: "overdue",
      ownership: "team",
      actionLabel: "ตรวจรับของ",
    });
  }
  for (const order of admin.awaitingInspection.items) {
    items.push({
      key: `order:${order.orderId}`,
      href: `/orders/${order.orderId}?tab=production`,
      icon: Shirt,
      title: "ตรวจรับเสื้อลูกค้า",
      description: order.customerName,
      orderNumber: order.orderNumber,
      orderHref: orderLink(order.orderId),
      attention: "normal",
      ownership: "team",
      actionLabel: "ตรวจรับเสื้อ",
    });
  }
  for (const order of admin.designsAwaiting.items) {
    items.push({
      key: `order:${order.orderId}`,
      href: `/orders/${order.orderId}?tab=files`,
      icon: ClipboardList,
      title: "รอลูกค้าอนุมัติแบบ",
      description: order.customerName,
      orderNumber: order.orderNumber,
      orderHref: orderLink(order.orderId),
      attention: "normal",
      ownership: "team",
      actionLabel: "ตามลูกค้า",
    });
  }
  for (const order of admin.dueSoon.items) {
    items.push({
      key: `order:${order.orderId}`,
      href: `/orders/${order.orderId}`,
      icon: CalendarClock,
      title: "ใกล้กำหนดส่ง",
      description: order.customerName,
      orderNumber: order.orderNumber,
      orderHref: orderLink(order.orderId),
      deadline: order.deadline,
      attention: "due-soon",
      ownership: "team",
      actionLabel: "เปิดออเดอร์",
    });
  }

  for (const followUp of data.followUp) {
    items.push({
      key: `order:${followUp.order.id}`,
      href: `/orders/${followUp.order.id}`,
      icon: ClipboardList,
      title: followUp.itemCount === 0 ? "ออเดอร์ยังไม่มีรายการ" : "ติดตามลูกค้า",
      description: customerDisplayName(followUp.order.customer),
      orderNumber: followUp.order.orderNumber,
      orderHref: orderLink(followUp.order.id),
      deadline: followUp.order.deadline,
      attention: taskAttention(followUp.order.deadline),
      ownership: "team",
      meta: formatBaht(followUp.totalAmount),
      actionLabel: "ตามลูกค้า",
    });
  }

  for (const invoice of data.billing.overdueInvoices) {
    items.push({
      key: `invoice:${invoice.id}`,
      href: `/orders/${invoice.orderId}?tab=money`,
      icon: ReceiptText,
      title: `บิลเลยกำหนด ${invoice.invoiceNumber}`,
      description: invoice.customerName,
      orderNumber: invoice.orderNumber,
      orderHref: orderLink(invoice.orderId),
      deadline: invoice.dueDate,
      deadlineLabel: "ครบกำหนดชำระ",
      attention: "overdue",
      ownership: "team",
      meta: formatBaht(invoice.totalAmount),
      actionLabel: "ดูบิล",
    });
  }

  for (const order of data.billing.shippedOrders) {
    items.push({
      key: `order:${order.id}`,
      href: `/orders/${order.id}?tab=money`,
      icon: Wallet,
      title: "รอวางบิล/ปิดงาน",
      description: customerDisplayName(order.customer),
      orderNumber: order.orderNumber,
      orderHref: orderLink(order.id),
      deadline: order.deadline,
      attention: taskAttention(order.deadline),
      ownership: "team",
      actionLabel: "ออกบิล",
    });
  }

  return items;
}

/** แถวงาน (.tasks li ของต้นแบบ บนแถวกลาง .mrow ที่ชุด kit มีอยู่แล้ว) */
function TaskRow({ item, primary }: { item: TaskListItem; primary: boolean }) {
  const tone = taskTone(item.attention);
  const Icon = item.icon ?? ClipboardList;
  const attention = ATTENTION_LABEL[item.attention];
  const sub = [
    item.description,
    item.deadline ? `${item.deadlineLabel ?? "กำหนดส่ง"} ${formatDate(item.deadline)}` : null,
    item.meta,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={c("mrow", tone !== "gray" && tone)}>
      <span className={c("tl")} aria-hidden="true">
        <Icon />
      </span>
      <span className={c("tx")}>
        <b>{item.title}</b>
        {sub ? <small>{sub}</small> : null}
      </span>
      <span className={c("acts")}>
        {/* ความเร่งเป็นป้าย ไม่ใช่ข้อความจางท้ายบรรทัด — สแกนทั้งกองแล้วเห็นทันทีว่าอันไหนต้องแตะก่อน */}
        {attention ? <span className={c("chip", tone)}>{attention}</span> : null}
        {item.warning ? <span className={c("chip warn")}>{item.warning}</span> : null}
        {item.orderNumber ? (
          item.orderHref ? (
            <Link href={item.orderHref} className={c("mono")}>
              {item.orderNumber}
            </Link>
          ) : (
            <span className={c("mono")}>{item.orderNumber}</span>
          )
        ) : null}
        <Link href={item.href} className={c("btn sm", primary && "primary")}>
          {item.actionLabel ?? "เปิดดู"}
        </Link>
      </span>
    </li>
  );
}

function TaskGroupCard({ group }: { group: TaskGroup }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? group.items : group.items.slice(0, VISIBLE_ROWS);
  const remaining = group.items.length - visible.length;
  const headingId = `tasks-head-${group.id}`;

  return (
    <section className={c("card")} aria-labelledby={headingId}>
      <CardHead
        icon={GROUP_ICONS[group.id]}
        tone={headTone(group.tone)}
        id={headingId}
        title={group.title}
        // เกณฑ์ของกองเขียนไว้ข้างชื่อกอง (ช่องเดียวกับ legend ของการ์ดผังโรงงาน)
        // ต้นแบบมีแค่ชื่อกอง แต่คนอ่านต้องรู้ว่าอะไรตกมาอยู่กองนี้ จึงคงคำช่วยไว้ตรงจุดใช้
        after={group.description ? <span className={c("legend")}>{group.description}</span> : undefined}
        right={<span className={c("chip", group.tone)}>{group.items.length} เรื่อง</span>}
      />
      <ul id={`tasks-${group.id}`} aria-labelledby={headingId}>
        {visible.map((item) => (
          <TaskRow key={item.key} item={item} primary={group.tone === "bad"} />
        ))}
      </ul>
      {group.items.length > VISIBLE_ROWS ? (
        <div className={c("cb")} style={{ paddingTop: 12 }}>
          <button
            type="button"
            className={c("btn")}
            style={{ width: "100%" }}
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-controls={`tasks-${group.id}`}
          >
            {expanded ? "ย่อรายการ" : `ดูทั้งหมดอีก ${remaining} เรื่อง`}
            <ChevronDown style={{ transform: expanded ? "rotate(180deg)" : undefined }} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

function TasksSkeleton() {
  return (
    <div className={c("stack")} role="status" aria-label="กำลังโหลดงานของฉัน">
      {[0, 1, 2].map((index) => (
        <span key={index} className={c("sk")} style={{ height: 190 }} />
      ))}
    </div>
  );
}

export default function MyTasksPage() {
  const { data, isLoading, isError, refetch, dataUpdatedAt } = trpc.task.myToday.useQuery();

  const groups = data
    ? groupTaskItems(buildTaskItems(data)).filter((group) => group.items.length > 0)
    : [];
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const updatedAt = dataUpdatedAt ? ` · อัปเดตล่าสุด ${timeText(new Date(dataUpdatedAt))}` : "";

  return (
    <PageShell
      title="งานของฉัน"
      // ระหว่างโหลด/พังยังไม่รู้จำนวนงาน — ใช้ข้อความกลางเดิม (หัวหน้าอยู่ครบทุก state)
      description={
        !data
          ? "งานที่รอคุณจากทุกส่วนที่คุณมีสิทธิ์"
          : total > 0
            ? `${total} เรื่องที่รอคุณ${updatedAt}`
            : `ไม่มีเรื่องที่รอคุณ${updatedAt}`
      }
      action={
        <button type="button" className={c("btn")} onClick={() => void refetch()}>
          <RefreshCw aria-hidden="true" />
          โหลดใหม่
        </button>
      }
      loading={isLoading}
      skeleton={<TasksSkeleton />}
      error={
        isError || (!isLoading && !data)
          ? { message: "เกิดข้อผิดพลาดในการโหลดข้อมูล", onRetry: () => refetch() }
          : null
      }
    >
      {groups.length === 0 ? (
        <section className={c("card")}>
          <Empty
            icon={CheckCircle2}
            title="ไม่มีงานค้างบนโต๊ะคุณ"
            hint="งานใหม่ที่ตรงกับสิทธิ์ของคุณจะมาอยู่ที่นี่"
            flat
          />
        </section>
      ) : (
        <div className={c("stack")}>
          {groups.map((group) => (
            <TaskGroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
