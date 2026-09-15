"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, MessageCircle } from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";
import { safeChatUrl } from "@/components/customers/chat-link";
import { c, DueTag, PriorityChip, StatusDot, Thumb } from "@/components/kit/kit";
import { PayTag, TechChip, WhyCell } from "@/components/orders/orders-ui";
import { describeOrderAttention } from "@/lib/home-orders";
import { mockupCoverImage } from "@/lib/mockup";
import { CHANNEL_LABELS } from "@/lib/order-status";
import type { SortDirection, SortKey } from "@/lib/order-list-contract";
import { formatBaht, formatDateCompact } from "@/lib/utils";

/* ============================================================
   ตารางออเดอร์ — ต้นแบบ listPage() rowHTML ทีละคอลัมน์ (รื้อ 2026-09-15)

   เลขออเดอร์ · ลูกค้า · ขั้นงาน · ต้องจัดการ · ยอดรวม · การชำระ · กำหนดส่ง · ›
   "ต้องจัดการ" ใช้กฎกลาง lib/home-orders ชุดเดียวกับหน้าแรก · ขีดซ้าย: เลยกำหนด แดง / ส่งวันนี้ ส้ม / พักงาน เทา / ดูย่ออยู่ ฟ้า
   กดแถว = ดูย่อ (เลขออเดอร์เป็นปุ่มให้คีย์บอร์ดเข้าได้) · › = เปิดใบเต็ม · จอ ≤900px เป็นการ์ด (.ocards)
   ============================================================ */

export type OrderListRow = RouterOutput["order"]["list"]["orders"][number];

export interface SortColumnProps {
  direction: SortDirection | null;
  defaultDirection: SortDirection;
  onSort: (direction: SortDirection) => void;
}

export function orderListCover(order: OrderListRow): string | null {
  return order.designs[0] ? mockupCoverImage(order.designs[0]) : null;
}

/** ชื่อบนแถว: บริษัทก่อน (ต้นแบบ cus) · บรรทัดรอง = ห้องแชท หรือชื่อผู้ติดต่อ */
export function customerLines(order: OrderListRow) {
  const name = order.customer?.name?.trim() || "";
  const company = order.customer?.company?.trim() || "";
  return {
    title: company || name || "—",
    person: company && name && company !== name ? name : null,
  };
}

function stepsText(order: OrderListRow): string {
  const { currentStep, stepsDone, stepsTotal } = order.progress;
  if (currentStep) return `${Math.min(stepsDone + 1, stepsTotal)}/${stepsTotal} ${currentStep.label}`;
  return stepsDone >= stepsTotal ? "ครบทุกขั้น" : `${stepsDone}/${stepsTotal}`;
}

function SortTh({
  label,
  column,
  right = false,
}: {
  label: string;
  column: SortColumnProps;
  right?: boolean;
}) {
  const { direction, defaultDirection, onSort } = column;
  const Icon = direction === null ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      className={right ? c("r") : undefined}
      aria-sort={direction === null ? undefined : direction === "asc" ? "ascending" : "descending"}
    >
      <button
        type="button"
        className={c("sort")}
        aria-label={`เรียงตาม${label}`}
        onClick={() => onSort(direction === null ? defaultDirection : direction === "asc" ? "desc" : "asc")}
      >
        {label}
        <Icon aria-hidden="true" />
      </button>
    </th>
  );
}

function CustomerCell({ order }: { order: OrderListRow }) {
  const { title, person } = customerLines(order);
  const chatUrl = safeChatUrl(order.customer?.chatUrl);
  const chatName = order.customer?.chatName?.trim() || (chatUrl ? "เปิดแชท" : null);
  return (
    <div className={c("who")}>
      <div className={c("t")}>
        <span className={c("nm")}>{title}</span>
        <div className={c("cu")}>
          {chatName ? (
            chatUrl ? (
              <a href={chatUrl} target="_blank" rel="noopener noreferrer" className={c("chat")}>
                <MessageCircle aria-hidden="true" />
                <span>{chatName}</span>
              </a>
            ) : (
              <span className={c("chat")}>
                <MessageCircle aria-hidden="true" />
                <span>{chatName}</span>
              </span>
            )
          ) : (
            person ?? "—"
          )}
        </div>
      </div>
    </div>
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
      <div className={c("tblw list")}>
        <table className={c("orders fixed")}>
          <colgroup>
            <col className={c("c-no")} />
            <col className={c("c-cu")} />
            <col className={c("c-st")} />
            <col className={c("c-why")} />
            {canSeeMoney ? <col className={c("c-amt")} /> : null}
            <col className={c("c-pay")} />
            <col className={c("c-due")} />
            <col className={c("c-arr")} />
          </colgroup>
          <thead>
            <tr>
              <SortTh label="เลขออเดอร์" column={sortColumn("orderNumber")} />
              <th scope="col">ลูกค้า</th>
              <th scope="col">ขั้นงาน</th>
              <th scope="col">ต้องจัดการ</th>
              {canSeeMoney ? <SortTh label="ยอดรวม" column={sortColumn("totalAmount")} right /> : null}
              <th scope="col">การชำระ</th>
              <SortTh label="กำหนดส่ง" column={sortColumn("deadline")} />
              <th scope="col">
                <span className={c("sr")}>เปิดออเดอร์</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const problem = describeOrderAttention(order.progress);
              const selected = peekId === order.id;
              const { title } = customerLines(order);
              const { stepsTotal, stepsDone } = order.progress;
              const mark =
                problem?.group === "late"
                  ? "hot"
                  : problem?.group === "today"
                    ? "warm"
                    : order.internalStatus === "ON_HOLD"
                      ? "hold"
                      : null;
              return (
                <tr
                  key={order.id}
                  data-order-row={order.id}
                  className={c("row", selected && "sel", mark)}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("a,button")) return;
                    if (window.getSelection()?.toString()) return;
                    onPeek(order.id);
                  }}
                >
                  <td>
                    <div className={c("who")}>
                      <Thumb cover={orderListCover(order)} alt={`ม็อกอัพ ${order.orderNumber}`} />
                      <div className={c("t")}>
                        <div className={c("id")}>
                          <button
                            type="button"
                            className={c("idbtn")}
                            data-peek-trigger={order.id}
                            aria-label={`ดูย่อ ${order.orderNumber} ${title}`}
                            aria-expanded={selected}
                            onClick={() => onPeek(order.id)}
                          >
                            <span className={c("mono")}>{order.orderNumber}</span>
                          </button>
                          {order.printLabel ? <TechChip label={order.printLabel} /> : null}
                          <PriorityChip priority={order.priority} />
                        </div>
                        <div className={c("cu")}>
                          <span className={c("chn")}>
                            {CHANNEL_LABELS[order.channel] ?? order.channel} · เปิด {formatDateCompact(order.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <CustomerCell order={order} />
                  </td>
                  <td className={c("stp")}>
                    <StatusDot status={order.internalStatus} />
                    {order.production && stepsTotal > 0 ? (
                      <div className={c("stpline")}>
                        <span className={c("prog")} role="img" aria-label={`ขั้นใบผลิต ${stepsDone} จาก ${stepsTotal}`}>
                          {Array.from({ length: stepsTotal }, (_, index) => (
                            <i key={index} className={c(index < stepsDone ? "d" : index === stepsDone ? "c" : null)} />
                          ))}
                        </span>
                        <small>{stepsText(order)}</small>
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <WhyCell problem={problem} progress={order.progress} />
                  </td>
                  {canSeeMoney ? <td className={c("amt r")}>{formatBaht(order.totalAmount ?? 0)}</td> : null}
                  <td>
                    <PayTag label={order.paymentLabel} status={order.internalStatus} />
                  </td>
                  <td>
                    <DueTag status={order.internalStatus} deadline={order.deadline} dueInDays={order.progress.dueInDays} />
                  </td>
                  <td className={c("arr")}>
                    <Link href={`/orders/${order.id}`} className={c("ibtn")} aria-label={`เปิดออเดอร์ ${order.orderNumber}`}>
                      <ChevronRight aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className={c("ocards")} aria-label="รายการออเดอร์">
        {orders.map((order) => {
          const problem = describeOrderAttention(order.progress);
          const { title } = customerLines(order);
          return (
            <li key={order.id}>
              <Link href={`/orders/${order.id}`} className={c("ocard")} aria-label={`เปิดออเดอร์ ${order.orderNumber} ${title}`}>
                <div className={c("l1")}>
                  <div className={c("who")}>
                    <Thumb cover={orderListCover(order)} alt={`ม็อกอัพ ${order.orderNumber}`} />
                    <div className={c("t")}>
                      <div className={c("id")}>
                        <span className={c("mono")}>{order.orderNumber}</span>
                        {order.printLabel ? <TechChip label={order.printLabel} /> : null}
                      </div>
                      <div className={c("cu")}>{title}</div>
                    </div>
                  </div>
                  <ChevronRight aria-hidden="true" />
                </div>
                <div className={c("l2")}>
                  <StatusDot status={order.internalStatus} />
                  <DueTag status={order.internalStatus} deadline={order.deadline} dueInDays={order.progress.dueInDays} />
                  {canSeeMoney ? <span className={c("amt")}>{formatBaht(order.totalAmount ?? 0)}</span> : null}
                </div>
                {problem ? <WhyCell problem={problem} progress={order.progress} showWho={false} /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
