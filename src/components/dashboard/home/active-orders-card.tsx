"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Flame,
  PackageCheck,
  PauseCircle,
  Plus,
  Activity,
  ShoppingCart,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DueTag } from "@/components/ui/due-tag";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityMark } from "@/components/ui/entity-mark";
import { FilterChip } from "@/components/ui/filter-chip";
import { FOCUS_INSET, INTERACTIVE_PRESSED, TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { OrderStatusBadge } from "@/components/order-status-badge";
import {
  describeHomeOrder,
  HOME_ORDER_FILTERS,
  matchesHomeFilter,
  sortHomeOrders,
  type HomeOrderFilter,
  type HomeProblem,
  type HomeProblemKind,
} from "@/lib/home-orders";
import { cn, formatBaht, formatDateShort } from "@/lib/utils";
import type { HomeOrder } from "@/server/services/home-overview";
import { HomeCard, HomeChip } from "./home-card";

const PROBLEM_ICON: Record<HomeProblemKind, LucideIcon> = {
  overdue: Flame,
  "vendor-late": Truck,
  ready: PackageCheck,
  "in-progress": Activity,
  customer: UserRound,
  vendor: Truck,
  stuck: PauseCircle,
};

const PROBLEM_TONE: Record<HomeProblem["tone"], string> = {
  danger: "font-medium text-red-700 dark:text-red-300",
  warning: "font-medium text-amber-700 dark:text-amber-300",
  success: "font-medium text-green-700 dark:text-green-300",
  neutral: "text-secondary",
};

function StepProgress({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`ขั้น ${done} จาก ${total}`}>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            "block h-1.5 w-3 rounded-full",
            index < done ? "bg-blue-600 dark:bg-blue-400" : index === done ? "bg-blue-600/40 dark:bg-blue-400/40" : "bg-border",
          )}
        />
      ))}
    </span>
  );
}

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
            <div className="flex flex-wrap gap-1" role="group" aria-label="กรองออเดอร์">
              {HOME_ORDER_FILTERS.map((option) => {
                const count = orders.filter((order) => matchesHomeFilter(order, option.key)).length;
                return (
                  <FilterChip key={option.key} selected={filter === option.key} onClick={() => setFilter(option.key)}>
                    {option.label}
                    <span className="ml-1 tabular-nums text-muted">{count}</span>
                  </FilterChip>
                );
              })}
            </div>
          )}
          <Button asChild variant="ghost" size="sm">
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] table-fixed text-sm">
              <thead className={cn(TABLE_HEAD_SURFACE, "text-xs")}>
                <tr className="border-t border-divider">
                  <th className="w-[30%] px-4 py-2 text-left font-medium sm:px-5">ออเดอร์</th>
                  <th className="w-[17%] px-3 py-2 text-left font-medium">กำหนดส่ง</th>
                  <th className="px-3 py-2 text-left font-medium">ต้องจัดการ / ขั้นงาน</th>
                  <th className="w-[9%] px-3 py-2 text-right font-medium">จำนวน</th>
                  {canSeeMoney ? <th className="w-[14%] px-3 py-2 text-right font-medium">ยอดรวม</th> : null}
                  <th className="w-9 px-2 py-2">
                    <span className="sr-only">เปิดออเดอร์</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {rows.map((order) => {
                  const problem = describeHomeOrder(order);
                  const ProblemIcon = problem ? PROBLEM_ICON[problem.kind] : null;
                  const href = `/orders/${order.id}`;
                  return (
                    <tr
                      key={order.id}
                      onClick={() => router.push(href)}
                      className={cn(INTERACTIVE_PRESSED, "cursor-pointer transition-colors")}
                    >
                      <td className="relative px-4 py-2.5 sm:px-5">
                        {problem?.group === "late" || problem?.group === "today" ? (
                          <span
                            aria-hidden="true"
                            className={cn(
                              "absolute inset-y-0 left-0 w-1",
                              problem.group === "late" ? "bg-red-600 dark:bg-red-400" : "bg-amber-500 dark:bg-amber-400",
                            )}
                          />
                        ) : null}
                        <span className="flex min-w-0 items-center gap-3">
                          <EntityMark label={order.customerName} tone="brand" />
                          <span className="min-w-0 max-w-56">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <Link
                                href={href}
                                onClick={(event) => event.stopPropagation()}
                                className={cn(FOCUS_INSET, "whitespace-nowrap rounded font-mono text-sm font-medium tabular-nums text-strong")}
                              >
                                {order.orderNumber}
                              </Link>
                              {order.printLabel ? (
                                <Badge variant="default" size="sm">
                                  {order.printLabel}
                                </Badge>
                              ) : null}
                            </span>
                            <span className="block truncate text-xs text-secondary">
                              {order.customerName}
                              {order.title ? <span className="text-muted"> · {order.title}</span> : null}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <DueTag
                          dueInDays={order.dueInDays}
                          dateLabel={order.deadline && order.dueInDays !== null && order.dueInDays > 1 ? formatDateShort(order.deadline) : null}
                          size="sm"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex min-w-0 flex-col gap-1">
                          {problem && ProblemIcon ? (
                            <span className={cn("flex items-start gap-1.5 text-xs", PROBLEM_TONE[problem.tone])}>
                              <ProblemIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                              {problem.label}
                              {problem.who ? <span className="font-normal text-muted">· {problem.who}</span> : null}
                            </span>
                          ) : null}
                          <span className="flex flex-wrap items-center gap-2">
                            <StepProgress done={order.stepsDone} total={order.stepsTotal} />
                            {order.currentStep ? (
                              <span className="text-xs text-secondary">
                                {`${Math.min(order.stepsDone + 1, order.stepsTotal)}/${order.stepsTotal} ${order.currentStep.label}`}
                              </span>
                            ) : (
                              <OrderStatusBadge customerStatus={order.customerStatus} internalStatus={order.internalStatus} compact />
                            )}
                          </span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-secondary">
                        <span className="font-medium text-strong">{order.quantity.toLocaleString("th-TH")}</span> ตัว
                      </td>
                      {canSeeMoney ? (
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-sm tabular-nums text-strong">
                          {order.totalAmount !== null ? formatBaht(order.totalAmount) : "—"}
                        </td>
                      ) : null}
                      <td className="px-2 py-2.5 text-muted">
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t border-divider bg-surface-muted px-4 py-2.5 text-xs tabular-nums text-secondary sm:px-5">
            <span>
              <span className="font-medium text-strong">{rows.length}</span> ออเดอร์
            </span>
            <span>
              <span className="font-medium text-strong">{quantity.toLocaleString("th-TH")}</span> ตัว
            </span>
            {canSeeMoney ? <span className="ml-auto font-mono text-sm font-medium text-strong">{formatBaht(amount)}</span> : null}
          </div>
        </>
      )}
    </HomeCard>
  );
}
