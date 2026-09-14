"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronUp, Factory, ImageOff, Phone, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FOCUS_BUTTON, INTERACTIVE_PRESSED, OVERLAY_PANEL, TINT } from "@/components/ui/tokens";
import { ChatLink } from "@/components/customers/chat-link";
import { OrderProblemLabel, OrderStatusDot, StepProgress } from "@/components/orders/order-problem";
import {
  OrderDeadlineCell,
  PriorityBadge,
  orderListCover,
  type OrderListRow,
} from "@/components/orders/list/orders-table";
import { describeOrderAttention } from "@/lib/home-orders";
import { getFlowSteps, INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { cn, formatBaht } from "@/lib/utils";

/* ============================================================
   ดูย่อออเดอร์ (ต้นแบบรอบ 2 · เบสเคาะ 2026-09-14)

   กดแถวในตารางแล้วเห็นใบนั้นทันทีโดยไม่ออกจากรายการ — ม็อกอัพ · เรื่องที่ต้องจัดการ ·
   กำหนดส่ง/จำนวน/ยอด, อยู่ขั้นไหน, ทางติดต่อ, ↑↓ ไล่ใบถัดไป, Esc ปิด
   เป็นที่ "ดู" ไม่ใช่ที่ลงมือ: เดินสถานะ/แก้ข้อมูลยังอยู่ในหน้าใบเต็มที่เดียว (ด่านครบกว่า)
   ข้อมูลทั้งหมดมาจากแถวของ order.list ไม่ยิง query เพิ่มต่อใบ
   ============================================================ */

const PROBLEM_TINT = {
  danger: TINT.error,
  warning: TINT.warning,
  success: TINT.success,
  neutral: TINT.neutral,
} as const;

const ROW = "flex min-h-11 w-full items-center gap-3 rounded-xl border border-divider px-2.5 py-2 text-left";
const TILE = "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg";

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-border bg-surface px-1 font-mono text-2xs tabular-nums text-secondary">
      {children}
    </kbd>
  );
}

export function OrderPeekPanel({
  order,
  canSeeMoney,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
}: {
  order: OrderListRow;
  canSeeMoney: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);

  // เปลี่ยนใบ = โฟกัสมาที่แผง ให้คีย์บอร์ด/เครื่องอ่านหน้าจออยู่กับใบที่เพิ่งเปิด
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, [order.id]);

  const cover = orderListCover(order);
  const design = order.designs[0];
  const problem = describeOrderAttention(order.progress);
  const flow = getFlowSteps(order.orderType);
  const index = flow.indexOf(order.internalStatus);
  const statusLabel = INTERNAL_STATUS_LABELS[order.internalStatus];
  const { currentStep, stepsDone, stepsTotal } = order.progress;
  const name = order.customer?.name?.trim() || "—";
  const phone = order.customer?.phone;

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      aria-label={`ดูย่อออเดอร์ ${order.orderNumber}`}
      className={cn(
        OVERLAY_PANEL,
        "fixed bottom-3 right-3 top-[4.25rem] z-40 hidden w-[26rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden outline-none lg:flex",
      )}
    >
      <header className="flex items-center gap-2 border-b border-divider px-3 py-2">
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="ปิดดูย่อ">
          <X />
        </Button>
        <span className="min-w-0 truncate font-mono text-sm font-medium tabular-nums text-strong">{order.orderNumber}</span>
        <OrderStatusDot status={order.internalStatus} className="text-xs font-medium text-secondary" />
        <span className="ml-auto flex items-center gap-1">
          <Button type="button" variant="outline" size="icon-sm" onClick={onPrev} disabled={!hasPrev} aria-label="ใบก่อนหน้า">
            <ChevronUp />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" onClick={onNext} disabled={!hasNext} aria-label="ใบถัดไป">
            <ChevronDown />
          </Button>
        </span>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-xl bg-surface-muted">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={`ม็อกอัพ ${order.orderNumber}`} className="h-full w-full object-contain" />
          ) : (
            <span className="flex flex-col items-center gap-1.5 text-sm text-muted">
              <ImageOff className="h-5 w-5" aria-hidden="true" />
              {order.orderType === "CUSTOM" ? "ยังไม่มีม็อกอัพ" : "งานสำเร็จรูป"}
            </span>
          )}
          {design ? (
            <Badge variant="default" size="sm" className="absolute left-3 top-3">
              v{design.versionNumber}
            </Badge>
          ) : null}
        </div>

        <div className="space-y-1">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-strong">
            <span className="min-w-0 [overflow-wrap:anywhere]">{name}</span>
            <PriorityBadge priority={order.priority} />
          </h2>
          {order.customer?.company && order.customer.company !== name ? (
            <p className="text-sm text-secondary [overflow-wrap:anywhere]">{order.customer.company}</p>
          ) : null}
          {order.description ? <p className="line-clamp-2 text-sm text-muted">{order.description}</p> : null}
        </div>

        {problem ? (
          <div className={cn(PROBLEM_TINT[problem.tone], "rounded-xl border px-3 py-2.5")}>
            <OrderProblemLabel problem={problem} className="text-sm" />
          </div>
        ) : null}

        <dl className="grid grid-cols-3 gap-2">
          <div className="min-w-0 rounded-xl bg-surface-muted px-3 py-2">
            <dt className="text-xs text-muted">กำหนดส่ง</dt>
            <dd className="mt-1 min-w-0">
              <OrderDeadlineCell order={order} />
            </dd>
          </div>
          <div className="min-w-0 rounded-xl bg-surface-muted px-3 py-2">
            <dt className="text-xs text-muted">จำนวน</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-strong">
              {order.quantity.toLocaleString("th-TH")} <span className="text-xs font-normal text-muted">ตัว</span>
            </dd>
          </div>
          {canSeeMoney ? (
            <div className="min-w-0 rounded-xl bg-surface-muted px-3 py-2">
              <dt className="text-xs text-muted">ยอดรวม</dt>
              <dd className="mt-1 truncate font-mono text-sm font-semibold tabular-nums text-strong">
                {formatBaht(order.totalAmount ?? 0)}
              </dd>
            </div>
          ) : (
            <div className="min-w-0 rounded-xl bg-surface-muted px-3 py-2">
              <dt className="text-xs text-muted">ชนิดงาน</dt>
              <dd className="mt-0.5 text-sm font-semibold text-strong">{order.printLabel ?? "—"}</dd>
            </div>
          )}
        </dl>

        <div className="space-y-1.5">
          <div
            className="flex gap-1"
            role="img"
            aria-label={index >= 0 ? `ขั้น ${index + 1} จาก ${flow.length} ${statusLabel}` : statusLabel}
          >
            {flow.map((status, position) => (
              <span
                key={status}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  index < 0 || position > index
                    ? "bg-border"
                    : position < index
                      ? "bg-blue-600 dark:bg-blue-400"
                      : "bg-blue-600/45 dark:bg-blue-400/45",
                )}
              />
            ))}
          </div>
          <p className="text-xs text-secondary">{index >= 0 ? `ขั้น ${index + 1}/${flow.length} ${statusLabel}` : statusLabel}</p>
        </div>

        <div className="space-y-1.5">
          {order.production ? (
            <Link
              href={`/orders/${order.id}?tab=production`}
              className={cn(ROW, FOCUS_BUTTON, INTERACTIVE_PRESSED)}
            >
              <span className={cn(TILE, "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300")}>
                <Factory className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-strong">
                  {order.production.workOrderNumber ?? "ใบผลิต"}
                </span>
                <span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-secondary">
                  <StepProgress done={stepsDone} total={stepsTotal} />
                  <span className="truncate">
                    {stepsTotal === 0
                      ? "ยังไม่มีขั้นผลิต"
                      : currentStep
                        ? `เสร็จ ${stepsDone}/${stepsTotal} กำลัง${currentStep.label}`
                        : `เสร็จ ${stepsDone}/${stepsTotal}`}
                  </span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            </Link>
          ) : null}
          {phone ? (
            <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={cn(ROW, FOCUS_BUTTON, INTERACTIVE_PRESSED)}>
              <span className={cn(TILE, "bg-surface-muted text-secondary")}>
                <Phone className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-strong">{phone}</span>
            </a>
          ) : null}
          {order.customer?.chatName || order.customer?.chatUrl ? (
            <div className={ROW}>
              <ChatLink name={order.customer.chatName} url={order.customer.chatUrl} wrap className="min-h-8 text-sm" />
            </div>
          ) : null}
        </div>
      </div>

      <footer className="flex items-center gap-3 border-t border-divider px-4 py-3">
        <p className="flex flex-wrap items-center gap-1 text-xs text-muted">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span>ใบถัดไป</span>
          <span aria-hidden="true">·</span>
          <Kbd>Esc</Kbd>
          <span>ปิด</span>
        </p>
        <Button asChild size="sm" className="ml-auto">
          <Link href={`/orders/${order.id}`}>
            เปิดออเดอร์
            <ArrowRight />
          </Link>
        </Button>
      </footer>
    </aside>
  );
}
