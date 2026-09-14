"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DueTag } from "@/components/ui/due-tag";
import { FOCUS_BUTTON, INTERACTIVE_PRESSED } from "@/components/ui/tokens";
import { ChatLink } from "@/components/customers/chat-link";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { OrderProblemLabel, OrderStatusDot, StepProgress } from "@/components/orders/order-problem";
import { describeOrderAttention } from "@/lib/home-orders";
import { mockupCoverImage } from "@/lib/mockup";
import { isAttentionStatus } from "@/lib/order-progress";
import { CHANNEL_LABELS, PRIORITY_LABELS } from "@/lib/order-status";
import type { SortDirection, SortKey } from "@/lib/order-list-contract";
import { cn, formatBaht, formatDateShort } from "@/lib/utils";

/* ============================================================
   ตารางออเดอร์ (ต้นแบบรอบ 2 · เบสเคาะ 2026-09-14)

   คอลัมน์ตอบคำถามตามลำดับที่หัวหน้าไล่ดู: ใบไหน/ลูกค้าไหน → อยู่ขั้นไหน → ต้องจัดการอะไร
   → เงิน → ส่งเมื่อไร · "ต้องจัดการ" ใช้กฎเดียวกับหน้าแรก (lib/home-orders) ไม่คิดใหม่ที่นี่
   กดแถว = ดูย่อทางขวา (จอกว้าง), ลูกศรท้ายแถว = เปิดใบเต็ม, จอแคบเป็นการ์ดที่เปิดใบเต็มเลย
   ============================================================ */

export type OrderListRow = RouterOutput["order"]["list"]["orders"][number];

export interface SortColumnProps {
  direction: SortDirection | null;
  defaultDirection: SortDirection;
  onSort: (direction: SortDirection) => void;
}

const PAYMENT_DOT: Record<string, { label: string; dot: string; text: string }> = {
  paid: { label: "ชำระแล้ว", dot: "bg-green-500", text: "text-green-700 dark:text-green-300" },
  unpaid: { label: "ค้างชำระ", dot: "bg-red-500", text: "text-red-700 dark:text-red-300" },
  partial: { label: "บางส่วน", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
};

export function orderListCover(order: OrderListRow): string | null {
  return order.designs[0] ? mockupCoverImage(order.designs[0]) : null;
}

export function PaymentIndicator({ status }: { status: string }) {
  const payment = PAYMENT_DOT[status];
  if (!payment) return <span className="text-xs text-muted">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium", payment.text)}>
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", payment.dot)} />
      {payment.label}
    </span>
  );
}

/** กำหนดส่งของแถว — งานที่ยังเดินใช้ป้ายตามความรีบ · งานที่จบแล้วเหลือแค่วันที่ */
export function OrderDeadlineCell({ order }: { order: OrderListRow }) {
  if (!isAttentionStatus(order.internalStatus)) {
    return order.deadline ? (
      <span className="whitespace-nowrap text-xs tabular-nums text-muted">{formatDateShort(order.deadline)}</span>
    ) : (
      <span className="text-xs text-muted">—</span>
    );
  }
  const due = order.progress.dueInDays;
  return (
    <DueTag
      dueInDays={due}
      dateLabel={order.deadline && due !== null && due > 1 ? formatDateShort(order.deadline) : null}
      size="sm"
    />
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  if (priority !== "URGENT" && priority !== "HIGH") return null;
  return (
    <Badge variant={priority === "URGENT" ? "destructive" : "warning"} size="sm">
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

function stepsText(order: OrderListRow): string {
  const { currentStep, stepsDone, stepsTotal } = order.progress;
  if (currentStep) return `${Math.min(stepsDone + 1, stepsTotal)}/${stepsTotal} ${currentStep.label}`;
  return stepsDone >= stepsTotal ? "ครบทุกขั้น" : `${stepsDone}/${stepsTotal}`;
}

export function OrdersTable({
  orders,
  canSeeMoney,
  peekId,
  onPeek,
  sortColumn,
}: {
  orders: readonly OrderListRow[];
  canSeeMoney: boolean;
  peekId: string | null;
  onPeek: (id: string) => void;
  sortColumn: (key: SortKey) => SortColumnProps;
}) {
  return (
    <>
      <DataTable.Root
        bordered={false}
        cellPadding="compact"
        className="hidden lg:block [&_table]:min-w-[56rem] [&_table]:table-fixed"
      >
        <colgroup>
          <col className="w-[13.5rem]" />
          <col className="w-[10rem]" />
          <col className="w-[10.5rem]" />
          <col />
          <col className={canSeeMoney ? "w-[7.5rem]" : "w-[6rem]"} />
          <col className="w-[8.5rem]" />
          <col className="w-11" />
        </colgroup>
        <DataTable.Head>
          <tr>
            <DataTable.SortableTh className="pl-2" {...sortColumn("orderNumber")}>
              เลขออเดอร์
            </DataTable.SortableTh>
            <DataTable.Th>ลูกค้า</DataTable.Th>
            <DataTable.Th>ขั้นงาน</DataTable.Th>
            <DataTable.Th>ต้องจัดการ</DataTable.Th>
            {canSeeMoney ? (
              <DataTable.SortableTh align="right" {...sortColumn("totalAmount")}>
                ยอดรวม
              </DataTable.SortableTh>
            ) : (
              <DataTable.Th>การชำระ</DataTable.Th>
            )}
            <DataTable.SortableTh {...sortColumn("deadline")}>กำหนดส่ง</DataTable.SortableTh>
            <DataTable.Th>
              <span className="sr-only">เปิดออเดอร์</span>
            </DataTable.Th>
          </tr>
        </DataTable.Head>
        <tbody className="divide-y divide-divider">
          {orders.map((order) => {
            const problem = describeOrderAttention(order.progress);
            const selected = peekId === order.id;
            const bar =
              problem?.group === "late"
                ? "bg-red-600 dark:bg-red-400"
                : problem?.group === "today"
                  ? "bg-amber-500 dark:bg-amber-400"
                  : null;
            return (
              <tr
                key={order.id}
                data-order-row={order.id}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("a,button")) return;
                  if (window.getSelection()?.toString()) return;
                  onPeek(order.id);
                }}
                className={cn("cursor-pointer transition-colors", INTERACTIVE_PRESSED, selected && "bg-interactive-selected")}
              >
                <td className="relative py-2.5 pl-5 pr-3 align-middle">
                  {bar ? <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1", bar)} /> : null}
                  <div className="flex min-w-0 items-center gap-3">
                    <MockupThumbnail cover={orderListCover(order)} alt={`ม็อกอัพ ${order.orderNumber}`} size="sm" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <button
                          type="button"
                          data-peek-trigger={order.id}
                          aria-label={`ดูย่อ ${order.orderNumber}`}
                          aria-expanded={selected}
                          onClick={() => onPeek(order.id)}
                          className={cn(FOCUS_BUTTON, "whitespace-nowrap rounded font-mono text-sm font-medium tabular-nums text-strong")}
                        >
                          {order.orderNumber}
                        </button>
                        {order.printLabel ? (
                          <Badge variant="default" size="sm">
                            {order.printLabel}
                          </Badge>
                        ) : null}
                        <PriorityBadge priority={order.priority} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {CHANNEL_LABELS[order.channel] ?? order.channel} · เปิด {formatDateShort(order.createdAt)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <p className="truncate text-sm font-medium text-strong">{order.customer?.name?.trim() || "—"}</p>
                  {order.customer?.chatName || order.customer?.chatUrl ? (
                    <ChatLink stopPropagation name={order.customer.chatName} url={order.customer.chatUrl} className="mt-0.5" />
                  ) : order.customer?.company ? (
                    <p className="mt-0.5 truncate text-xs text-muted">{order.customer.company}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <OrderStatusDot status={order.internalStatus} className="text-sm text-strong" />
                  {order.progress.stepsTotal > 0 ? (
                    <div className="mt-1 flex min-w-0 items-center gap-2">
                      <StepProgress done={order.progress.stepsDone} total={order.progress.stepsTotal} />
                      <span className="truncate text-xs text-secondary">{stepsText(order)}</span>
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 align-middle">
                  {problem ? <OrderProblemLabel problem={problem} /> : <span className="text-xs text-muted">—</span>}
                </td>
                <td className={cn("px-3 py-2.5 align-middle", canSeeMoney && "text-right")}>
                  {canSeeMoney ? (
                    <span className="flex flex-col items-end gap-0.5">
                      <span className="whitespace-nowrap font-mono text-sm tabular-nums text-strong">
                        {formatBaht(order.totalAmount ?? 0)}
                      </span>
                      {order.paymentLabel !== "none" ? <PaymentIndicator status={order.paymentLabel} /> : null}
                    </span>
                  ) : (
                    <PaymentIndicator status={order.paymentLabel} />
                  )}
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <OrderDeadlineCell order={order} />
                </td>
                <td className="py-2.5 pl-1 pr-3 align-middle">
                  <Link
                    href={`/orders/${order.id}`}
                    aria-label={`เปิดออเดอร์ ${order.orderNumber}`}
                    className={cn(FOCUS_BUTTON, INTERACTIVE_PRESSED, "flex h-8 w-8 items-center justify-center rounded-lg text-muted")}
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable.Root>

      <ul aria-label="รายการออเดอร์" className="space-y-2 px-3 py-3 sm:px-4 lg:hidden">
        {orders.map((order) => {
          const problem = describeOrderAttention(order.progress);
          const name = order.customer?.name?.trim() || "—";
          return (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                aria-label={`เปิดออเดอร์ ${order.orderNumber} ${name}`}
                className={cn(FOCUS_BUTTON, INTERACTIVE_PRESSED, "block space-y-2 rounded-xl border border-divider p-3")}
              >
                <span className="flex items-start gap-3">
                  <MockupThumbnail cover={orderListCover(order)} alt={`ม็อกอัพ ${order.orderNumber}`} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-sm font-medium tabular-nums text-strong">{order.orderNumber}</span>
                      {order.printLabel ? (
                        <Badge variant="default" size="sm">
                          {order.printLabel}
                        </Badge>
                      ) : null}
                      <PriorityBadge priority={order.priority} />
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-medium text-secondary">{name}</span>
                  </span>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <OrderStatusDot status={order.internalStatus} className="text-xs font-medium text-secondary" />
                  <OrderDeadlineCell order={order} />
                  {canSeeMoney ? (
                    <span className="ml-auto whitespace-nowrap font-mono text-sm font-medium tabular-nums text-strong">
                      {formatBaht(order.totalAmount ?? 0)}
                    </span>
                  ) : null}
                </span>
                {problem ? <OrderProblemLabel problem={problem} /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
