"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, ChevronRight, Plus, Search, ShoppingCart, X } from "lucide-react";
import { c, CardHead, DueTag, Empty, StatusDot, StepBar, Thumb } from "@/components/kit/kit";
import { Seg } from "@/components/kit/seg";
import { PROBLEM_ICON, PROBLEM_TONE, TechChip } from "@/components/orders/orders-ui";
import {
  describeHomeOrder,
  HOME_ORDER_FILTERS,
  matchesHomeFilter,
  sortHomeOrders,
  type HomeOrderFilter,
} from "@/lib/home-orders";
import { formatBaht } from "@/lib/utils";
import type { HomeOrder } from "@/server/services/home-overview";

/* ============================================================
   ออเดอร์ที่กำลังเดิน — ต้นแบบ ordersHTML() รอบ 4
   เรื่องด่วนขึ้นบน · ตัวกรองแบบเลื่อน · คอลัมน์ ออเดอร์ / กำหนดส่ง / ต้องจัดการ / ขั้นงาน / จำนวน / ยอดรวม
   กฎ "ต้องจัดการ" มาจาก lib/home-orders ชุดเดียวกับหน้ารายการออเดอร์
   ============================================================ */

/** จำนวนแถวที่หน้าแรกแสดง (ต้นแบบ active.slice(0, 6)) — ที่เหลืออยู่ในหน้ารายการออเดอร์ */
const HOME_TABLE_ROWS = 6;

export function ActiveOrdersCard({
  orders,
  canSeeMoney,
  canCreateOrder,
  dayFilter,
  dayLabel,
  onClearDay,
}: {
  orders: HomeOrder[];
  canSeeMoney: boolean;
  canCreateOrder: boolean;
  /** กรองตามวันจากการ์ดกำหนดส่ง (offset วัน) — null = ไม่กรอง */
  dayFilter: number | null;
  dayLabel: string | null;
  onClearDay: () => void;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<HomeOrderFilter>("all");
  const sorted = useMemo(() => sortHomeOrders(orders), [orders]);
  const rows = useMemo(
    () =>
      sorted.filter((order) => (dayFilter !== null ? order.dueInDays === dayFilter : matchesHomeFilter(order, filter))),
    [sorted, filter, dayFilter],
  );
  const quantity = rows.reduce((sum, order) => sum + order.quantity, 0);
  const amount = rows.reduce((sum, order) => sum + (order.totalAmount ?? 0), 0);
  // ต้นแบบโชว์ 6 แถวบนหน้าแรก แล้วส่งต่อหน้ารายการออเดอร์ด้วยปุ่ม "ดูทั้งหมด"
  const visible = rows.slice(0, HOME_TABLE_ROWS);

  const selectFilter = (key: HomeOrderFilter) => {
    setFilter(key);
    if (dayFilter !== null) onClearDay();
  };

  return (
    <section className={c("card")} aria-labelledby="home-orders">
      <CardHead
        icon={ShoppingCart}
        tone="blue"
        id="home-orders"
        title="ออเดอร์ที่กำลังเดิน"
        right={
          <>
            {dayFilter !== null ? (
              <button type="button" className={c("chip blue chipbtn")} onClick={onClearDay} aria-label="ยกเลิกกรองตามวันส่ง">
                <CalendarDays aria-hidden="true" />
                ส่ง {dayLabel}
                <X aria-hidden="true" />
              </button>
            ) : null}
            <Seg
              label="กรองออเดอร์"
              options={HOME_ORDER_FILTERS.map((option) => ({
                key: option.key,
                label: option.label,
                count: orders.filter((order) => matchesHomeFilter(order, option.key)).length,
              }))}
              value={dayFilter !== null ? null : filter}
              onChange={selectFilter}
            />
            <Link href="/orders" className={c("btn ghost sm")}>
              ดูทั้งหมด
              <ArrowRight aria-hidden="true" />
            </Link>
          </>
        }
      />

      {orders.length === 0 ? (
        <Empty
          icon={ShoppingCart}
          title="ยังไม่มีออเดอร์ที่กำลังเดิน"
          action={
            canCreateOrder ? (
              <Link href="/orders/new" className={c("btn primary sm")}>
                <Plus aria-hidden="true" />
                เปิดงานใหม่
              </Link>
            ) : undefined
          }
        />
      ) : rows.length === 0 ? (
        /* ใบเดียวกันเคยมีกล่องว่างสองหน้าตา (Empty ข้างบน · .noresult ตรงนี้) — ใช้ชิ้นเดียวกันแล้ว */
        <Empty
          icon={Search}
          title="ไม่มีออเดอร์ตามตัวกรองนี้"
          action={
            <button
              type="button"
              className={c("btn sm")}
              onClick={() => {
                setFilter("all");
                onClearDay();
              }}
            >
              ล้างตัวกรอง
            </button>
          }
        />
      ) : (
        <>
          <div className={c("tblw")}>
            <table className={c("orders")} style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>ออเดอร์</th>
                  <th>กำหนดส่ง</th>
                  <th>ต้องจัดการ</th>
                  <th>ขั้นงาน</th>
                  <th className={c("r")}>จำนวน</th>
                  {canSeeMoney ? <th className={c("r")}>ยอดรวม</th> : null}
                  <th>
                    <span className={c("sr")}>เปิดออเดอร์</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((order) => {
                  const problem = describeHomeOrder(order);
                  const ProblemIcon = problem ? PROBLEM_ICON[problem.kind] : null;
                  const href = `/orders/${order.id}`;
                  const stepNow = Math.min(order.stepsDone + 1, order.stepsTotal);
                  return (
                    <tr
                      key={order.id}
                      className={c("row", problem?.group === "late" && "hot", problem?.group === "today" && "warm")}
                      onClick={() => router.push(href)}
                    >
                      <td>
                        <div className={c("who")}>
                          <Thumb cover={order.cover} alt={`ม็อกอัพ ${order.orderNumber}`} />
                          <div className={c("t")}>
                            <div className={c("id")}>
                              <Link
                                href={href}
                                className={c("mono idbtn")}
                                onClick={(event) => event.stopPropagation()}
                              >
                                {order.orderNumber}
                              </Link>
                              {order.printLabel ? <TechChip label={order.printLabel} /> : null}
                            </div>
                            <div className={c("cu")}>
                              {order.customerName}
                              {order.title ? <span className={c("ttl")}> · {order.title}</span> : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <DueTag
                          status={order.internalStatus}
                          deadline={order.deadline}
                          dueInDays={order.dueInDays}
                          small={false}
                        />
                      </td>
                      <td>
                        <div className={c("why-cell")}>
                          {problem && ProblemIcon ? (
                            <>
                              <span className={c("why", PROBLEM_TONE[problem.tone])}>
                                <ProblemIcon aria-hidden="true" />
                                {problem.label}
                              </span>
                              {problem.who ? <span className={c("wholine")}>{problem.who}</span> : null}
                            </>
                          ) : (
                            <span className={c("none")}>—</span>
                          )}
                        </div>
                      </td>
                      <td className={c("stp")}>
                        {order.currentStep && order.stepsTotal > 0 ? (
                          <>
                            <StepBar
                              done={order.stepsDone}
                              total={order.stepsTotal}
                              label={`ขั้น ${order.stepsDone} จาก ${order.stepsTotal}`}
                            />
                            <small>
                              {stepNow}/{order.stepsTotal} {order.currentStep.label}
                            </small>
                          </>
                        ) : (
                          <StatusDot status={order.internalStatus} />
                        )}
                      </td>
                      <td className={c("r q")}>
                        <b>{order.quantity.toLocaleString("th-TH")}</b> ตัว
                      </td>
                      {canSeeMoney ? (
                        <td className={c("r amt")}>{order.totalAmount !== null ? formatBaht(order.totalAmount) : "—"}</td>
                      ) : null}
                      <td className={c("arr")}>
                        <ChevronRight aria-hidden="true" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={c("tfoot")}>
            {/* ยอดรวมคิดจากทุกแถวที่ตัวกรองนี้เลือกไว้ ไม่ใช่เฉพาะ 6 แถวที่เห็น — บอกให้ชัดว่ากำลังดูกี่แถว */}
            <span>
              {rows.length > visible.length ? (
                <>
                  แสดง <b>{visible.length}</b> จาก <b>{rows.length}</b> ออเดอร์
                </>
              ) : (
                <>
                  <b>{rows.length}</b> ออเดอร์
                </>
              )}
            </span>
            <span>
              <b>{quantity.toLocaleString("th-TH")}</b> ตัว
            </span>
            {canSeeMoney ? <span className={c("amt")}>{formatBaht(amount)}</span> : null}
          </div>
        </>
      )}
    </section>
  );
}
