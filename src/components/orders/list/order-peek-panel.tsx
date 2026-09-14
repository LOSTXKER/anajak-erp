"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Factory,
  ImageOff,
  MessageCircle,
  Package,
  Phone,
  Tag,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FOCUS_BUTTON, INTERACTIVE_PRESSED } from "@/components/ui/tokens";
import { HomeChip } from "@/components/dashboard/home/home-card";
import { safeChatUrl } from "@/components/customers/chat-link";
import {
  MockupApprovalChip,
  OrderDueChip,
  OrderPriorityChip,
  OrderProblemCallout,
  OrderStatusPill,
} from "@/components/orders/order-problem";
import { orderListCover, type OrderListRow } from "@/components/orders/list/orders-table";
import { describeOrderAttention } from "@/lib/home-orders";
import { isAttentionStatus } from "@/lib/order-progress";
import { getFlowSteps, INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { cn, formatBaht, formatDateCompact } from "@/lib/utils";

/* ============================================================
   ดูย่อออเดอร์ (ต้นแบบรอบ 2 · เบสเคาะ 2026-09-14 · ไล่ให้ตรงต้นแบบทีละส่วน 2026-09-15)

   กดแถวในตารางแล้วแผงสูงเต็มจอเลื่อนมาจากขวา: ม็อกอัพ + สถานะอนุมัติ · ลูกค้า · เรื่องที่ต้องจัดการ ·
   กำหนดส่ง/จำนวน/ยอด · อยู่ขั้นไหนของเส้นทาง · ใบผลิต/โทร/แชท · ↑↓ ไล่ใบถัดไป · Esc ปิด
   เป็นที่ "ดู" ไม่ใช่ที่ลงมือ: เดินสถานะ/แก้ข้อมูลยังอยู่ในหน้าใบเต็มที่เดียว (ด่านครบกว่า)
   ข้อมูลทั้งหมดมาจากแถวของ order.list ไม่ยิง query เพิ่มต่อใบ
   ============================================================ */

const ROW =
  "grid min-h-11 w-full grid-cols-[2rem_minmax(0,1fr)_1rem] items-center gap-2.5 rounded-lg border border-divider bg-surface py-1 pl-1.5 pr-2 text-left";
const TILE = "flex h-8 w-8 items-center justify-center rounded-lg";

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-border bg-surface px-1 font-mono text-2xs tabular-nums text-secondary">
      {children}
    </kbd>
  );
}

function Fact({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-1 rounded-xl border border-divider bg-surface-muted px-3 py-2.5">
      <dt className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {label}
      </dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-1.5 text-base font-semibold tabular-nums text-strong">
        {children}
      </dd>
    </div>
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
  const [now] = useState(() => new Date());

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
  const { currentStep, stepsDone, stepsTotal, dueInDays } = order.progress;
  const name = order.customer?.name?.trim() || "—";
  const company = order.customer?.company && order.customer.company !== name ? order.customer.company : null;
  const subline = [company, order.description?.trim() || null, order.printLabel].filter(Boolean).join(" · ");
  const phone = order.customer?.phone;
  const chatUrl = safeChatUrl(order.customer?.chatUrl);
  const chatName = order.customer?.chatName?.trim() || (chatUrl ? "เปิดแชท" : null);
  const showDueChip = Boolean(order.deadline) && isAttentionStatus(order.internalStatus) && dueInDays !== null && dueInDays <= 2;

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      aria-label={`ดูย่อออเดอร์ ${order.orderNumber}`}
      className="overlay-surface fixed inset-y-0 right-0 z-40 hidden w-[31.25rem] max-w-full flex-col outline-none lg:flex"
    >
      <header className="flex items-center gap-2 border-b border-divider px-3.5 py-2.5">
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="ปิดดูย่อ">
          <X />
        </Button>
        <span className="min-w-0 truncate font-mono text-sm font-medium tabular-nums text-strong">{order.orderNumber}</span>
        <OrderStatusPill status={order.internalStatus} />
        <span className="ml-auto flex items-center gap-1">
          <Button type="button" variant="outline" size="icon-sm" onClick={onPrev} disabled={!hasPrev} aria-label="ใบก่อนหน้า">
            <ChevronUp />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" onClick={onNext} disabled={!hasNext} aria-label="ใบถัดไป">
            <ChevronDown />
          </Button>
        </span>
      </header>

      <div className="grid min-h-0 flex-1 content-start gap-3.5 overflow-y-auto p-4">
        <div className="relative flex aspect-[2/1] items-center justify-center overflow-hidden rounded-xl border border-divider bg-surface-muted">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={`ม็อกอัพ ${order.orderNumber}`} className="h-full w-full object-contain" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-sm text-muted">
              <ImageOff className="h-6 w-6" aria-hidden="true" />
              {order.orderType === "CUSTOM" ? "ยังไม่มีม็อกอัพ" : "งานสำเร็จรูป ไม่ต้องมีแบบ"}
            </span>
          )}
          {design ? <HomeChip className="absolute left-3 top-3">v{design.versionNumber}</HomeChip> : null}
          {design ? (
            <span className="absolute right-3 top-3">
              <MockupApprovalChip status={design.approvalStatus} sentAt={design.createdAt} now={now} />
            </span>
          ) : null}
        </div>

        <div>
          <h2 className="flex flex-wrap items-center gap-2.5 text-lg font-semibold text-strong">
            <span className="min-w-0 [overflow-wrap:anywhere]">{name}</span>
            <OrderPriorityChip priority={order.priority} />
          </h2>
          {subline ? <p className="mt-0.5 line-clamp-2 text-sm text-secondary">{subline}</p> : null}
        </div>

        {problem ? <OrderProblemCallout problem={problem} progress={order.progress} /> : null}

        <dl className="grid grid-cols-3 gap-2.5">
          <Fact icon={CalendarDays} label="กำหนดส่ง">
            {order.deadline ? formatDateCompact(order.deadline) : "—"}
            {showDueChip && order.deadline ? (
              <OrderDueChip status={order.internalStatus} deadline={order.deadline} dueInDays={dueInDays} />
            ) : null}
          </Fact>
          <Fact icon={Package} label="จำนวน">
            {order.quantity.toLocaleString("th-TH")}
            <span className="text-xs font-normal text-muted">ตัว</span>
          </Fact>
          {canSeeMoney ? (
            <Fact icon={Banknote} label="ยอดรวม">
              <span className="min-w-0 truncate font-mono text-sm">{formatBaht(order.totalAmount ?? 0)}</span>
            </Fact>
          ) : (
            <Fact icon={Tag} label="วิธีพิมพ์">
              {order.printLabel ?? "สำเร็จรูป"}
            </Fact>
          )}
        </dl>

        <div
          className="flex items-center gap-1"
          role="img"
          aria-label={index >= 0 ? `ขั้น ${index + 1} จาก ${flow.length} ${statusLabel}` : statusLabel}
        >
          {flow.map((status, position) => (
            <span
              key={status}
              className={cn(
                "h-1.5 min-w-1 flex-1 rounded-full",
                index < 0 || position > index
                  ? "bg-border"
                  : position < index
                    ? "bg-blue-600 dark:bg-blue-400"
                    : "bg-blue-600/45 dark:bg-blue-400/45",
              )}
            />
          ))}
          <span className="ml-1.5 whitespace-nowrap text-xs text-muted">
            {index >= 0 ? `ขั้น ${index + 1}/${flow.length} · ${statusLabel}` : statusLabel}
          </span>
        </div>

        <div className="grid gap-1">
          {order.production ? (
            <Link href={`/orders/${order.id}?tab=production`} className={cn(ROW, FOCUS_BUTTON, INTERACTIVE_PRESSED)}>
              <span className={cn(TILE, "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300")}>
                <Factory className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-strong">
                  {order.production.workOrderNumber ?? "ใบผลิต"}
                </span>
                <span className="block truncate text-xs text-muted">
                  {stepsTotal === 0
                    ? "ยังไม่มีขั้นผลิต"
                    : `${stepsDone}/${stepsTotal} ขั้นเสร็จ${currentStep ? ` · กำลัง${currentStep.label}` : ""}`}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />
            </Link>
          ) : null}
          {phone ? (
            <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={cn(ROW, FOCUS_BUTTON, INTERACTIVE_PRESSED)}>
              <span className={cn(TILE, "bg-surface-muted text-secondary")}>
                <Phone className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium tabular-nums text-strong">{phone}</span>
                <span className="block truncate text-xs text-muted">โทรหาลูกค้า</span>
              </span>
              <ExternalLink className="h-4 w-4 text-muted" aria-hidden="true" />
            </a>
          ) : null}
          {chatName ? (
            chatUrl ? (
              <a href={chatUrl} target="_blank" rel="noopener noreferrer" className={cn(ROW, FOCUS_BUTTON, INTERACTIVE_PRESSED)}>
                <span className={cn(TILE, "bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-300")}>
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-strong">{chatName}</span>
                  <span className="block truncate text-xs text-muted">ห้องแชทลูกค้า</span>
                </span>
                <ExternalLink className="h-4 w-4 text-muted" aria-hidden="true" />
              </a>
            ) : (
              <div className={ROW}>
                <span className={cn(TILE, "bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-300")}>
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-strong">{chatName}</span>
                  <span className="block truncate text-xs text-muted">ห้องแชทลูกค้า</span>
                </span>
              </div>
            )
          ) : null}
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-divider px-4 py-3">
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
