"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, ChevronRight, Plus, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DueTag } from "@/components/ui/due-tag";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityMark } from "@/components/ui/entity-mark";
import { FOCUS_INSET, INTERACTIVE_PRESSED, TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { OrderStatusBadge } from "@/components/order-status-badge";
import {
  describeHomeOrder,
  HOME_ORDER_FILTERS,
  matchesHomeFilter,
  sortHomeOrders,
  type HomeOrderFilter,
} from "@/lib/home-orders";
import { ORDER_PROBLEM_ICON, ORDER_PROBLEM_TEXT, StepProgress } from "@/components/orders/order-problem";
import { cn, formatBaht, formatDateShort } from "@/lib/utils";
import type { HomeOrder } from "@/server/services/home-overview";
import { HomeCard, HomeChip } from "./home-card";
import styles from "./home.module.css";

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
      sorted.filter((order) =>
        dayFilter !== null ? order.dueInDays === dayFilter : matchesHomeFilter(order, filter),
      ),
    [sorted, filter, dayFilter],
  );
  const quantity = rows.reduce((sum, order) => sum + order.quantity, 0);
  const amount = rows.reduce((sum, order) => sum + (order.totalAmount ?? 0), 0);

  return (
    <HomeCard
      id="home-orders"
      title="ออเดอร์ที่กำลังเดิน"
      icon={ShoppingCart}
      action={
        <>
          {dayFilter !== null ? (
            <button
              type="button"
              onClick={onClearDay}
              aria-label="ยกเลิกกรองตามวันส่ง"
              className={cn(FOCUS_INSET, "rounded-full")}
            >
              <HomeChip tone="brand">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                ส่ง {dayLabel}
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </HomeChip>
            </button>
          ) : (
            <div className={styles.filters} role="group" aria-label="กรองออเดอร์">
              {HOME_ORDER_FILTERS.map((option) => {
                const count = orders.filter((order) => matchesHomeFilter(order, option.key)).length;
                return (
                  <button type="button" className={cn(FOCUS_INSET, INTERACTIVE_PRESSED, styles.filter)} key={option.key} aria-pressed={filter === option.key} onClick={() => setFilter(option.key)}>
                    {option.label}
                    <span>{count}</span>
                  </button>
                );
              })}
            </div>
          )}
          <Button asChild variant="ghost" size="sm" className={styles.ghost}>
            <Link href="/orders">
              ดูทั้งหมด
              <ArrowRight />
            </Link>
          </Button>
        </>
      }
    >
      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="ยังไม่มีออเดอร์ที่กำลังเดิน"
          action={
            canCreateOrder ? (
              <Button asChild>
                <Link href="/orders/new">
                  <Plus />
                  เปิดงานใหม่
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border-t border-divider px-5 py-8 text-sm text-muted">
          ไม่มีออเดอร์ตามตัวกรองนี้
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilter("all");
              onClearDay();
            }}
          >
            ล้างตัวกรอง
          </Button>
        </div>
      ) : (
        <>
          <div className="relative overflow-x-auto">
            <table className={styles.orders}>
              <thead className={TABLE_HEAD_SURFACE}>
                <tr className="border-t border-divider">
                  <th>ออเดอร์</th>
                  <th>กำหนดส่ง</th>
                  <th>ต้องจัดการ</th>
                  <th>ขั้นงาน</th>
                  <th className={styles.right}>จำนวน</th>
                  {canSeeMoney ? <th className={styles.right}>ยอดรวม</th> : null}
                  <th className={styles.arrow}>
                    <span className="sr-only">เปิดออเดอร์</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => {
                  const problem = describeHomeOrder(order);
                  const ProblemIcon = problem ? ORDER_PROBLEM_ICON[problem.kind] : null;
                  const href = `/orders/${order.id}`;
                  return (
                    <tr
                      key={order.id}
                      onClick={() => router.push(href)}
                      className={cn(INTERACTIVE_PRESSED, "cursor-pointer transition-colors")}
                    >
                      <td className="relative">
                        {problem?.group === "late" || problem?.group === "today" ? (
                          <span
                            aria-hidden="true"
                            className={cn(
                              "absolute inset-y-0 left-0 w-[3px]",
                              problem.group === "late" ? "bg-red-600 dark:bg-red-400" : "bg-amber-500 dark:bg-amber-400",
                            )}
                          />
                        ) : null}
                        <span className={styles.orderIdentity}>
                          <EntityMark label={order.customerName} tone="brand" />
                          <span className={styles.orderName}>
                            <span className={styles.orderNumber}>
                              <Link
                                href={href}
                                onClick={(event) => event.stopPropagation()}
                                className={cn(FOCUS_INSET, "whitespace-nowrap rounded font-mono text-sm font-medium tabular-nums text-strong")}
                              >
                                {order.orderNumber}
                              </Link>
                              {order.printLabel ? (
                                <HomeChip tone={order.printLabel === "DTF" ? "brand" : "neutral"}>
                                  {order.printLabel}
                                </HomeChip>
                              ) : null}
                            </span>
                            <span className={styles.orderCustomer}>
                              {order.customerName}
                              {order.title ? <span className="text-muted"> · {order.title}</span> : null}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>
                        <DueTag
                          dueInDays={order.dueInDays}
                          dateLabel={order.deadline && order.dueInDays !== null && order.dueInDays > 1 ? formatDateShort(order.deadline) : null}
                          size="sm"
                        />
                      </td>
                      <td>
                        <span className={styles.problem}>
                          {problem && ProblemIcon ? (
                            <>
                              <span className={cn(styles.problemLine, ORDER_PROBLEM_TEXT[problem.tone])}>
                                <ProblemIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                                {problem.label}
                              </span>
                              {problem.who ? <span className={styles.problemWho}>{problem.who}</span> : null}
                            </>
                          ) : <span className="text-xs text-muted">—</span>}
                        </span>
                      </td>
                      <td>
                        <span className={styles.step}>
                          <StepProgress done={order.stepsDone} total={order.stepsTotal} className={styles.stepProgress} />
                          {order.currentStep ? (
                            <span>{`${Math.min(order.stepsDone + 1, order.stepsTotal)}/${order.stepsTotal} ${order.currentStep.label}`}</span>
                          ) : (
                            <OrderStatusBadge customerStatus={order.customerStatus} internalStatus={order.internalStatus} compact />
                          )}
                        </span>
                      </td>
                      <td className={cn(styles.right, "text-secondary")}>
                        <span className="font-medium text-strong">{order.quantity.toLocaleString("th-TH")}</span> ตัว
                      </td>
                      {canSeeMoney ? (
                        <td className={cn(styles.right, styles.orderAmount)}>
                          {order.totalAmount !== null ? formatBaht(order.totalAmount) : "—"}
                        </td>
                      ) : null}
                      <td className={styles.arrow}>
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.tableFooter}>
            <span>
              <span className="font-medium text-strong">{rows.length}</span> ออเดอร์
            </span>
            <span>
              <span className="font-medium text-strong">{quantity.toLocaleString("th-TH")}</span> ตัว
            </span>
            {canSeeMoney ? <span className={styles.total}>{formatBaht(amount)}</span> : null}
          </div>
        </>
      )}
    </HomeCard>
  );
}
