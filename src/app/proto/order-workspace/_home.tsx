"use client";

import { Fragment, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FOCUS_BUTTON, FOCUS_FIELD, FOCUS_INSET } from "@/components/ui/tokens";
import { cn, formatBaht } from "@/lib/utils";
import {
  PREVIEW_ORDER,
  PREVIEW_ORDER_NUMBER,
  PREVIEW_PRICING,
} from "../ui-reset/_order-data";
import styles from "./_home.module.css";

const TODAY = "2026-09-25";

type WorkOrder = {
  id: string;
  number: string;
  customer: string;
  title: string;
  quantity: number;
  amount: number;
  due: string;
  status: string;
  tone: "accent" | "success" | "teal" | "warning";
  issue?: string;
  detail: string;
};

// ชุดข้อมูลสำหรับหน้าลองนี้เท่านั้น ทุกยอดและกำหนดส่งด้านบนคำนวณจากรายการชุดเดียวกัน
const ORDERS: WorkOrder[] = [
  {
    id: "preview-run-club",
    number: "ORD-2609-0123",
    customer: "Bangkok Run Club",
    title: "เสื้อทีมวิ่ง",
    quantity: 80,
    amount: 14840,
    due: "2026-09-24",
    status: "ผลิต",
    tone: "teal",
    issue: "ขาดเสื้อไซซ์ L · 7 ตัว",
    detail: "เสื้อกีฬา สีขาว · DTF หน้า–หลัง · แยกกล่องตามไซซ์",
  },
  {
    id: PREVIEW_ORDER.id,
    number: PREVIEW_ORDER_NUMBER,
    customer: "Studio Coffee",
    title: "เสื้อทีมเปิดร้าน",
    quantity: PREVIEW_ORDER.estimatedQuantity ?? 30,
    amount: PREVIEW_PRICING.grandTotal,
    due: "2026-09-25",
    status: "ออกแบบ",
    tone: "accent",
    issue: "รอยืนยันม็อกอัพ",
    detail: PREVIEW_ORDER.description ?? "เสื้อ Cotton สีกรม · DTF อกซ้าย",
  },
  {
    id: "preview-golden-leaf",
    number: "ORD-2609-0125",
    customer: "Golden Leaf",
    title: "เสื้อพนักงาน",
    quantity: 60,
    amount: 11449,
    due: "2026-09-25",
    status: "พร้อมส่ง",
    tone: "success",
    detail: "เสื้อ Cotton สีครีม · สกรีน 1 สี · ลูกค้ารับที่โรงงาน",
  },
  {
    id: "preview-nova",
    number: "ORD-2609-0130",
    customer: "NOVA Studio",
    title: "เสื้อทีมงานอีเวนต์",
    quantity: 24,
    amount: 5300,
    due: "2026-09-25",
    status: "ผลิต",
    tone: "teal",
    detail: "เสื้อ Cotton สีดำ · DTF หน้า–หลัง · แยกถุงรายตัว",
  },
  {
    id: "preview-northstar",
    number: "ORD-2609-0131",
    customer: "Northstar Retail",
    title: "เสื้อกิจกรรมประจำปี",
    quantity: 120,
    amount: 24800,
    due: "2026-09-26",
    status: "ผลิต",
    tone: "teal",
    detail: "เสื้อ Cotton สีกรม · สกรีน 2 สี · จัดส่งสาขาพระราม 9",
  },
  {
    id: "preview-bake-room",
    number: "ORD-2609-0134",
    customer: "The Bake Room",
    title: "เสื้อร้านเบเกอรี่",
    quantity: 40,
    amount: 8480,
    due: "2026-09-27",
    status: "เตรียมงาน",
    tone: "warning",
    detail: "เสื้อ Cotton สีขาว · DTF อกซ้าย · พับและแยกถุงตามไซซ์",
  },
];

const FILTERS = [
  { id: "all", label: "ทั้งหมด" },
  { id: "today", label: "ส่งวันนี้" },
  { id: "attention", label: "ต้องเช็ก" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

function matchesFilter(order: WorkOrder, filter: Filter) {
  return filter === "all" || (filter === "today" ? order.due === TODAY : Boolean(order.issue));
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${date}T00:00:00+07:00`));
}

const SCHEDULE = [...new Set(ORDERS.map((order) => order.due))]
  .filter((date) => date >= TODAY)
  .sort()
  .map((date) => {
    const orders = ORDERS.filter((order) => order.due === date);
    return {
      date,
      count: orders.length,
      quantity: orders.reduce((total, order) => total + order.quantity, 0),
    };
  });
const MAX_SCHEDULE_QUANTITY = Math.max(...SCHEDULE.map((day) => day.quantity));

export function WorkspaceHome({ onOpenOrder }: { onOpenOrder: () => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const normalizedSearch = search.trim().toLocaleLowerCase("th");
  const visibleOrders = ORDERS.filter(
    (order) => matchesFilter(order, filter)
      && `${order.number} ${order.customer} ${order.title}`.toLocaleLowerCase("th").includes(normalizedSearch),
  );
  const quantities = visibleOrders.reduce((total, order) => total + order.quantity, 0);
  const todayOrders = ORDERS.filter((order) => order.due === TODAY);
  const attentionOrders = ORDERS.filter((order) => order.issue);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1>ภาพรวมวันนี้</h1>
        <time dateTime={TODAY} className={styles.today}>
          <CalendarDays aria-hidden="true" />
          ศุกร์ 25 ก.ย. 2569
        </time>
      </header>

      <dl className={styles.metrics}>
        <div>
          <dt>ออเดอร์ที่เปิดอยู่</dt>
          <dd className={styles.brandNumber}>{ORDERS.length}<span>ออเดอร์</span></dd>
        </div>
        <div>
          <dt>กำหนดส่งวันนี้</dt>
          <dd>{todayOrders.length}<span>ออเดอร์</span></dd>
        </div>
        <div>
          <dt>ต้องเช็ก</dt>
          <dd className={styles.attentionNumber}>{attentionOrders.length}<span>รายการ</span></dd>
        </div>
      </dl>

      <div className={styles.workspace}>
        <section className={styles.queue} aria-labelledby="workspace-queue-title">
          <header className={styles.sectionHeading}>
            <h2 id="workspace-queue-title">คิวออเดอร์</h2>
            <span className={styles.queueCount} aria-live="polite">{visibleOrders.length} ออเดอร์</span>
          </header>

          <div className={styles.queueControls}>
            <div className={styles.filters} role="group" aria-label="กรองคิวออเดอร์">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn(styles.filter, FOCUS_INSET)}
                  aria-pressed={filter === item.id}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                  <span>{ORDERS.filter((order) => matchesFilter(order, item.id)).length}</span>
                </button>
              ))}
            </div>
            <label className={styles.search}>
              <Search aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหาออเดอร์"
                aria-label="ค้นหาเลขออเดอร์หรือลูกค้า"
                className={FOCUS_FIELD}
              />
            </label>
          </div>

          <div className={styles.workTable}>
            <table aria-label="คิวออเดอร์">
              <thead>
                <tr>
                  <th scope="col">ออเดอร์ / ลูกค้า</th>
                  <th scope="col">กำหนดส่ง</th>
                  <th scope="col">สถานะ</th>
                  <th scope="col">ชิ้น</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => {
                  const expanded = expandedOrderId === order.id;
                  const overdue = order.due < TODAY;
                  return (
                    <Fragment key={order.id}>
                      <tr className={cn(styles.orderRow, expanded && styles.expandedRow)}>
                        <th scope="row">
                          <button
                            type="button"
                            className={cn(styles.orderButton, FOCUS_BUTTON)}
                            aria-expanded={expanded}
                            aria-controls={expanded ? `workspace-order-${order.id}` : undefined}
                            aria-label={`${expanded ? "ย่อ" : "ดู"}รายละเอียด ${order.number} ${order.customer}`}
                            onClick={() => setExpandedOrderId(expanded ? null : order.id)}
                          >
                            <span className={styles.orderIdentity}>
                              <span className={styles.orderNumber}>{order.number}</span>
                              <strong>{order.customer}</strong>
                              {order.issue && (
                                <span className={cn(styles.issue, overdue && styles.overdueIssue)}>
                                  <CircleAlert aria-hidden="true" />
                                  {order.issue}
                                </span>
                              )}
                            </span>
                            <ChevronDown className={cn(styles.expandIcon, expanded && styles.rotated)} aria-hidden="true" />
                          </button>
                        </th>
                        <td className={cn(styles.dueCell, overdue && styles.overdue)}>
                          <time dateTime={order.due}>{dateLabel(order.due)}</time>
                          {(overdue || order.due === TODAY) && <span>{overdue ? "เลยกำหนด" : "วันนี้"}</span>}
                        </td>
                        <td className={styles.statusCell}>
                          <Badge variant={order.tone}>{order.status}</Badge>
                        </td>
                        <td className={styles.quantityCell}>{order.quantity}<span className={styles.mobileUnit}> ชิ้น</span></td>
                      </tr>
                      {expanded && (
                        <tr className={styles.detailRow} id={`workspace-order-${order.id}`}>
                          <td colSpan={4} aria-label={`รายละเอียด ${order.number}`}>
                            <div className={styles.orderDetail}>
                              <div>
                                <h3>{order.title}</h3>
                                <p>{order.detail}</p>
                              </div>
                              <div className={styles.detailActions}>
                                <span className={styles.detailAmount}>{formatBaht(order.amount)}</span>
                                {order.id === PREVIEW_ORDER.id && (
                                  <Button size="sm" onClick={onOpenOrder}>
                                    เปิดออเดอร์ <ArrowRight aria-hidden="true" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {visibleOrders.length === 0 && (
              <div className={styles.empty}>
                <Search aria-hidden="true" />
                <p>ไม่พบออเดอร์</p>
                <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilter("all"); }}>
                  <X aria-hidden="true" /> ล้างตัวกรอง
                </Button>
              </div>
            )}
          </div>

          {visibleOrders.length > 0 && (
            <footer className={styles.queueFooter}>
              <span>รวม {quantities.toLocaleString("th-TH")} ชิ้น</span>
              {normalizedSearch && (
                <button type="button" onClick={() => setSearch("")} className={cn(styles.clearSearch, FOCUS_BUTTON)}>
                  <X aria-hidden="true" /> ล้างคำค้น
                </button>
              )}
            </footer>
          )}
        </section>

        <aside className={styles.sideRail}>
          <section className={styles.nextOrder} aria-labelledby="workspace-next-order-title">
            <div className={styles.nextOrderLabel}>
              <span className={styles.pendingDot} aria-hidden="true" />
              <h2 id="workspace-next-order-title">รอยืนยันม็อกอัพ</h2>
            </div>
            <div className={styles.artworkRow}>
              <div className={styles.artwork}>
                <Image src="/proto/ui-reset/studio-coffee-shirt.svg" alt="ม็อกอัพเสื้อสีกรม โลโก้ Studio Coffee สีครีม" width={168} height={168} />
              </div>
              <div className={styles.featuredIdentity}>
                <span>{PREVIEW_ORDER_NUMBER}</span>
                <h3>Studio Coffee</h3>
                <p>{PREVIEW_ORDER.estimatedQuantity} ชิ้น <span aria-hidden="true">·</span> ส่งวันนี้</p>
              </div>
            </div>
            <Button className={styles.openOrder} onClick={onOpenOrder}>
              เปิดออเดอร์ <ArrowRight aria-hidden="true" />
            </Button>
          </section>

          <section className={styles.schedule} aria-labelledby="workspace-schedule-title">
            <header className={styles.scheduleHeading}>
              <h2 id="workspace-schedule-title">กำหนดส่ง</h2>
              <span>ก.ย. 2569</span>
            </header>
            <ol>
              {SCHEDULE.map((day) => (
                <li key={day.date}>
                  <time dateTime={day.date} className={cn(styles.day, day.date === TODAY && styles.currentDay)}>
                    <strong>{Number(day.date.slice(-2))}</strong>
                    <span>{day.date === TODAY ? "วันนี้" : new Intl.DateTimeFormat("th-TH", { weekday: "short", timeZone: "Asia/Bangkok" }).format(new Date(`${day.date}T00:00:00+07:00`))}</span>
                  </time>
                  <div className={styles.dayWork}>
                    <div><strong>{day.count} ออเดอร์</strong><span>{day.quantity} ชิ้น</span></div>
                    <span className={styles.capacityTrack} aria-hidden="true">
                      <span style={{ width: `${day.quantity / MAX_SCHEDULE_QUANTITY * 100}%` }} />
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
