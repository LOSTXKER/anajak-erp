"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, MessageCircle } from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";
import { FOCUS_BUTTON, FOCUS_INSET, INTERACTIVE_PRESSED, TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { safeChatUrl } from "@/components/customers/chat-link";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import {
  OrderAttentionLine,
  OrderDueChip,
  OrderPrintChip,
  OrderPriorityChip,
  OrderStatusDot,
  StepProgress,
} from "@/components/orders/order-problem";
import { describeOrderAttention } from "@/lib/home-orders";
import { mockupCoverImage } from "@/lib/mockup";
import { CHANNEL_LABELS } from "@/lib/order-status";
import type { SortDirection, SortKey } from "@/lib/order-list-contract";
import { cn, formatBaht, formatDateCompact } from "@/lib/utils";

/* ============================================================
   ตารางออเดอร์ (ต้นแบบรอบ 2 · เบสเคาะ 2026-09-14 · ไล่ให้ตรงต้นแบบทีละส่วน 2026-09-15)

   คอลัมน์ตอบคำถามตามลำดับที่หัวหน้าไล่ดู: ใบไหน/ลูกค้าไหน → อยู่ขั้นไหน → ต้องจัดการอะไร
   → เงิน → การชำระ → ส่งเมื่อไร · "ต้องจัดการ" ใช้กฎเดียวกับหน้าแรก (lib/home-orders)
   หัวตารางเป็นแถบพื้นจมเต็มการ์ด · แถวเลยกำหนด/ส่งวันนี้/พักงาน/กำลังดูย่อ มีขีดสีซ้าย
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
  if (!payment) return <span className="text-sm text-muted">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs", payment.text)}>
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", payment.dot)} />
      {payment.label}
    </span>
  );
}

/** ชื่อเดิมที่หัวใบออเดอร์ใช้อยู่ — ตัวจริงคือชิปความเร่งด่วนกลาง */
export const PriorityBadge = OrderPriorityChip;

function stepsText(order: OrderListRow): string {
  const { currentStep, stepsDone, stepsTotal } = order.progress;
  if (currentStep) return `${Math.min(stepsDone + 1, stepsTotal)}/${stepsTotal} ${currentStep.label}`;
  return stepsDone >= stepsTotal ? "ครบทุกขั้น" : `${stepsDone}/${stepsTotal}`;
}

/* หัวตาราง = แถบพื้นจมมีเส้นบน-ล่าง (ต้นแบบ .orders th) · เซลล์มีเส้นล่างบาง */
const TH = "whitespace-nowrap border-y border-divider bg-surface-muted px-3.5 py-2 text-left text-xs font-medium text-muted";
const TD = "border-b border-divider px-3.5 py-2.5 align-middle";

function SortTh({
  direction,
  defaultDirection,
  onSort,
  align = "left",
  className,
  children,
}: SortColumnProps & { align?: "left" | "right"; className?: string; children: ReactNode }) {
  const active = direction !== null;
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : undefined}
      className={cn(TH, align === "right" && "text-right", className)}
    >
      <button
        type="button"
        onClick={() => onSort(active ? (direction === "asc" ? "desc" : "asc") : defaultDirection)}
        className={cn(
          FOCUS_INSET,
          "-mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5",
          active && "text-blue-700 dark:text-blue-300",
        )}
      >
        {children}
        <Icon
          className={cn("h-3 w-3 shrink-0", active ? "text-blue-600 dark:text-blue-400" : "opacity-50")}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

function CustomerCell({ order }: { order: OrderListRow }) {
  const name = order.customer?.name?.trim() || "—";
  const chatUrl = safeChatUrl(order.customer?.chatUrl);
  const chatName = order.customer?.chatName?.trim() || (chatUrl ? "เปิดแชท" : null);
  return (
    <>
      <span className="block truncate text-sm font-medium text-strong">{name}</span>
      {chatUrl ? (
        <a
          href={chatUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            FOCUS_BUTTON,
            "mt-0.5 inline-flex max-w-full items-center gap-1 border-b border-blue-200 text-xs text-blue-700 dark:border-blue-800 dark:text-blue-300",
          )}
        >
          <MessageCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{chatName}</span>
        </a>
      ) : chatName ? (
        <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-secondary">
          <MessageCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{chatName}</span>
        </span>
      ) : order.customer?.company ? (
        <span className="mt-0.5 block truncate text-xs text-secondary">{order.customer.company}</span>
      ) : null}
    </>
  );
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
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[65rem] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[15.5rem]" />
            <col className="w-[10.75rem]" />
            <col className="w-[10rem]" />
            <col className="w-[12.25rem]" />
            {canSeeMoney ? <col className="w-[6.5rem]" /> : null}
            <col className="w-[5.25rem]" />
            <col className="w-[7.375rem]" />
            <col className="w-10" />
          </colgroup>
          <thead className={cn(TABLE_HEAD_SURFACE, "bg-surface-muted")}>
            <tr>
              <SortTh className="pl-[1.125rem]" {...sortColumn("orderNumber")}>
                เลขออเดอร์
              </SortTh>
              <th scope="col" className={TH}>
                ลูกค้า
              </th>
              <th scope="col" className={TH}>
                ขั้นงาน
              </th>
              <th scope="col" className={TH}>
                ต้องจัดการ
              </th>
              {canSeeMoney ? (
                <SortTh align="right" {...sortColumn("totalAmount")}>
                  ยอดรวม
                </SortTh>
              ) : null}
              <th scope="col" className={TH}>
                การชำระ
              </th>
              <SortTh {...sortColumn("deadline")}>
                กำหนดส่ง
              </SortTh>
              <th scope="col" className={TH}>
                <span className="sr-only">เปิดออเดอร์</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const problem = describeOrderAttention(order.progress);
              const selected = peekId === order.id;
              const bar = selected
                ? "bg-blue-600 dark:bg-blue-400"
                : problem?.group === "late"
                  ? "bg-red-600 dark:bg-red-400"
                  : problem?.group === "today"
                    ? "bg-amber-500 dark:bg-amber-400"
                    : order.internalStatus === "ON_HOLD"
                      ? "bg-slate-300 dark:bg-slate-600"
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
                  className={cn(
                    "cursor-pointer [&:last-child>td]:border-b-0",
                    INTERACTIVE_PRESSED,
                    selected && "bg-blue-50 dark:bg-blue-950/40",
                  )}
                >
                  <td className={cn(TD, "relative pl-[1.125rem]")}>
                    {bar ? <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-[3px]", bar)} /> : null}
                    <div className="flex min-w-0 items-center gap-3">
                      <MockupThumbnail cover={orderListCover(order)} alt={`ม็อกอัพ ${order.orderNumber}`} size="sm" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
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
                          {order.printLabel ? <OrderPrintChip label={order.printLabel} className="px-2" /> : null}
                          <OrderPriorityChip priority={order.priority} className="px-2" />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {CHANNEL_LABELS[order.channel] ?? order.channel} · เปิด {formatDateCompact(order.createdAt)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className={TD}>
                    <CustomerCell order={order} />
                  </td>
                  <td className={TD}>
                    <OrderStatusDot status={order.internalStatus} className="text-sm text-strong" />
                    {order.progress.stepsTotal > 0 ? (
                      <div className="mt-1 flex min-w-0 items-center gap-1.5">
                        <StepProgress done={order.progress.stepsDone} total={order.progress.stepsTotal} />
                        <span className="truncate text-xs text-secondary">{stepsText(order)}</span>
                      </div>
                    ) : null}
                  </td>
                  <td className={TD}>
                    {problem ? (
                      <OrderAttentionLine problem={problem} progress={order.progress} />
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )}
                  </td>
                  {canSeeMoney ? (
                    <td className={cn(TD, "whitespace-nowrap text-right font-mono text-sm tabular-nums text-strong")}>
                      {formatBaht(order.totalAmount ?? 0)}
                    </td>
                  ) : null}
                  <td className={TD}>
                    <PaymentIndicator status={order.paymentLabel} />
                  </td>
                  <td className={TD}>
                    <OrderDueChip
                      status={order.internalStatus}
                      deadline={order.deadline}
                      dueInDays={order.progress.dueInDays}
                    />
                  </td>
                  <td className={cn(TD, "pl-1 pr-3")}>
                    <Link
                      href={`/orders/${order.id}`}
                      aria-label={`เปิดออเดอร์ ${order.orderNumber}`}
                      className={cn(FOCUS_BUTTON, INTERACTIVE_PRESSED, "flex h-7 w-7 items-center justify-center rounded-lg text-muted")}
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul aria-label="รายการออเดอร์" className="grid gap-2.5 px-3.5 pb-3.5 lg:hidden">
        {orders.map((order) => {
          const problem = describeOrderAttention(order.progress);
          const name = order.customer?.name?.trim() || "—";
          return (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                aria-label={`เปิดออเดอร์ ${order.orderNumber} ${name}`}
                className={cn(FOCUS_BUTTON, INTERACTIVE_PRESSED, "grid gap-2 rounded-xl border border-border p-3")}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-3">
                    <MockupThumbnail cover={orderListCover(order)} alt={`ม็อกอัพ ${order.orderNumber}`} size="sm" />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-sm font-medium tabular-nums text-strong">{order.orderNumber}</span>
                        {order.printLabel ? <OrderPrintChip label={order.printLabel} className="px-2" /> : null}
                        <OrderPriorityChip priority={order.priority} className="px-2" />
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-secondary">{name}</span>
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-secondary">
                  <OrderStatusDot status={order.internalStatus} />
                  <OrderDueChip
                    status={order.internalStatus}
                    deadline={order.deadline}
                    dueInDays={order.progress.dueInDays}
                  />
                  {canSeeMoney ? (
                    <span className="ml-auto whitespace-nowrap font-mono text-sm font-medium tabular-nums text-strong">
                      {formatBaht(order.totalAmount ?? 0)}
                    </span>
                  ) : null}
                </span>
                {problem ? <OrderAttentionLine problem={problem} progress={order.progress} showWho={false} /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
