"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, MessageCircle } from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";
import { safeChatUrl } from "@/components/customers/chat-link";
import { c, DueTag, StatusDot, Thumb } from "@/components/kit/kit";
import { PayTag, WhyCell } from "@/components/orders/orders-ui";
import { describeOrderAttention } from "@/lib/home-orders";
import { mockupCoverImage } from "@/lib/mockup";
import { isAttentionStatus } from "@/lib/order-progress";
import { PRIORITY_LABELS } from "@/lib/order-status";
import type { SortDirection, SortKey } from "@/lib/order-list-contract";
import { formatBaht, formatDateShort } from "@/lib/utils";
import { formatDueDate } from "@/lib/date-utils";
import { customerContactName, customerDisplayNameOrDash } from "@/lib/customer-name";

/* ============================================================
   ตารางออเดอร์ — ต้นแบบ mockup-orders-list-lite-2026-09-16 (เบสเคาะ "ทำจริงเลย")

   ออเดอร์ · ลูกค้า · จำนวน · ขั้นงาน · คนทำ · ยอด·ชำระ · กำหนดส่ง · ›
   ขั้นงานเหลือชื่อสถานะ · คนทำแยกคอลัมน์ · ตารางไม่มีคอลัมน์ "ต้องจัดการ" แล้ว (เบสสั่ง 2026-09-18)
   เหตุที่ต้องจัดการยังอยู่ในแผงดูย่อ/ใบเต็ม และการ์ดจอ ≤900px (กฎกลาง lib/home-orders ชุดเดียวกับหน้าแรก)
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

/** ชื่อบนแถว: บริษัทก่อน (ต้นแบบ cus) · บรรทัดรอง = ห้องแชท หรือชื่อผู้ติดต่อ
 *  กติกาการเลือกชื่ออยู่ที่ lib/customer-name ชุดเดียวกับฝั่ง server และหน้าอื่น */
export function customerLines(order: OrderListRow) {
  return {
    title: customerDisplayNameOrDash(order.customer),
    person: customerContactName(order.customer),
  };
}

/** คนทำ: ขั้นผลิตที่เปิดอยู่ → ร้านนอก/ช่างที่รับขั้น · ยังไม่เข้าผลิต → ผู้เปิดออเดอร์ · จบแล้ว = ไม่มี */
export function orderWorker(order: OrderListRow): { name: string; role: string } | null {
  if (!isAttentionStatus(order.internalStatus)) return null;
  const { currentStep, vendor } = order.progress;
  if (currentStep) {
    if (currentStep.outsource && vendor) return { name: vendor.name, role: "ร้านนอก" };
    return currentStep.assigneeName ? { name: currentStep.assigneeName, role: `ขั้น${currentStep.label}` } : null;
  }
  const creator = order.createdBy?.name?.trim();
  return creator ? { name: creator, role: "ผู้เปิดออเดอร์" } : null;
}

function initialOf(name: string) {
  return name.replace(/^(ร้าน|คุณ)/, "").replace(/^[เแโใไ]/, "").slice(0, 1);
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
      {chatName || person ? (
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
            person
          )}
        </div>
      ) : null}
      </div>
    </div>
  );
}

function WorkerCell({ order }: { order: OrderListRow }) {
  const worker = orderWorker(order);
  if (!worker) return <span className={c("none")}>—</span>;
  return (
    <span className={c("wh")}>
      <span className={c("av")} aria-hidden="true">
        {initialOf(worker.name)}
      </span>
      <span className={c("nmw")}>
        {worker.name}
        <span className={c("sr")}> ({worker.role})</span>
      </span>
    </span>
  );
}

/** กำหนดส่ง: วันที่จริง + บรรทัดบอกความรีบ (เฉพาะงานที่ยังเดิน) */
function DueCell({ order }: { order: OrderListRow }) {
  const days = order.progress.dueInDays;
  if (!order.deadline || days === null) return <span className={c("rel")}>ยังไม่กำหนด</span>;
  const open = isAttentionStatus(order.internalStatus);
  const [tone, text] =
    days < 0 ? ["bad", `เลย ${-days} วัน`] : days === 0 ? ["warn", "วันนี้"] : days === 1 ? ["warn", "พรุ่งนี้"] : [null, `อีก ${days} วัน`];
  return (
    <>
      {/* กำหนดส่งใช้รูปเดียวกับแผงดูย่อ/หน้าออเดอร์ — ปีโผล่เฉพาะงานข้ามปี คอลัมน์จึงไม่ยาวขึ้น */}
      <span className={c("dd")}>{formatDueDate(order.deadline)}</span>
      {open ? <span className={c("rel", tone)}>{text}</span> : null}
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
      <div className={c("tblw list")}>
        <table className={c("orders fixed olistt")}>
          <colgroup>
            <col className={c("n-no")} />
            <col className={c("n-cu")} />
            <col className={c("n-q")} />
            <col className={c("n-st")} />
            <col className={c("n-who")} />
            {canSeeMoney ? <col className={c("n-amt")} /> : <col className={c("n-pay")} />}
            <col className={c("n-due")} />
            <col className={c("n-arr")} />
          </colgroup>
          <thead>
            <tr>
              <SortTh label="เลขออเดอร์" column={sortColumn("orderNumber")} />
              <th scope="col">ลูกค้า</th>
              <th scope="col" className={c("r")}>
                จำนวน
              </th>
              <th scope="col">ขั้นงาน</th>
              <th scope="col">คนทำ</th>
              {canSeeMoney ? <SortTh label="ยอดรวม" column={sortColumn("totalAmount")} right /> : <th scope="col">การชำระ</th>}
              <SortTh label="กำหนดส่ง" column={sortColumn("deadline")} />
              <th scope="col">
                <span className={c("sr")}>เปิดออเดอร์</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const selected = peekId === order.id;
              const { title } = customerLines(order);
              const urgent = order.priority === "URGENT";
              return (
                <tr
                  key={order.id}
                  data-order-row={order.id}
                  className={c("row", selected && "sel")}
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
                        </div>
                        <span className={c("dt")}>
                          {urgent ? <b className={c("urg")}>{PRIORITY_LABELS.URGENT} · </b> : null}
                          {order.printLabel ? `${order.printLabel} · ` : ""}เปิด {formatDateShort(order.createdAt)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <CustomerCell order={order} />
                  </td>
                  <td className={c("qn")}>
                    <b>{order.quantity.toLocaleString("th-TH")}</b>
                    <small>ตัว</small>
                  </td>
                  <td>
                    <StatusDot status={order.internalStatus} />
                  </td>
                  <td>
                    <WorkerCell order={order} />
                  </td>
                  {canSeeMoney ? (
                    <td className={c("amt r")}>
                      {formatBaht(order.totalAmount ?? 0)}
                      <PayTag label={order.paymentLabel} status={order.internalStatus} />
                    </td>
                  ) : (
                    <td>
                      <PayTag label={order.paymentLabel} status={order.internalStatus} />
                    </td>
                  )}
                  <td className={c("due2")}>
                    <DueCell order={order} />
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
                      </div>
                      <div className={c("cu")}>
                        {title} · {order.quantity.toLocaleString("th-TH")} ตัว
                      </div>
                    </div>
                  </div>
                  <ChevronRight aria-hidden="true" />
                </div>
                <div className={c("l2")}>
                  <StatusDot status={order.internalStatus} />
                  <DueTag status={order.internalStatus} deadline={order.deadline} dueInDays={order.progress.dueInDays} />
                  {canSeeMoney ? <span className={c("amt")}>{formatBaht(order.totalAmount ?? 0)}</span> : null}
                </div>
                {problem ? <WhyCell problem={problem} progress={order.progress} short /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

