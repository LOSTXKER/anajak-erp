"use client";

import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { cn, formatDateShort } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Clock3 } from "lucide-react";

export type StationQueueItem = {
  key: string;
  orderId: string;
  productionId: string | null;
  orderNumber: string;
  title: string;
  customerName: string | null;
  deadline: Date | string | null;
  priority: string | null;
  stepLabel: string;
  status: "active" | "ready";
  qtyDone: number | null;
  qtyTotal: number | null;
  overdue: boolean;
};

function QueueCard({
  item,
  onOpen,
}: {
  item: StationQueueItem;
  onOpen: (item: StationQueueItem) => void;
}) {
  const qty =
    item.qtyTotal != null && item.qtyTotal > 0
      ? `${item.qtyDone ?? 0}/${item.qtyTotal}`
      : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        FOCUS_BUTTON,
        "card-surface card-surface-hover flex min-h-24 w-full touch-manipulation items-center gap-4 rounded-2xl p-4 text-left",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-10 w-1 shrink-0 rounded-full",
          item.status === "active" ? "bg-blue-500" : "bg-border-strong",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold tabular-nums text-strong">
            {item.orderNumber}
          </span>
          {item.overdue ? (
            <Badge variant="destructive" size="sm">เลยกำหนด</Badge>
          ) : item.priority === "URGENT" ? (
            <Badge variant="destructive" size="sm">ด่วน</Badge>
          ) : null}
          {item.status === "active" && (
            <Badge variant="accent" size="sm">กำลังทำ</Badge>
          )}
        </span>
        <span className="mt-1 block truncate text-sm text-secondary">
          {[item.customerName, item.title].filter(Boolean).join(" · ") || "ไม่ระบุชื่องาน"}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>{item.stepLabel}</span>
          <span className={cn("tabular-nums", item.overdue && "font-medium text-red-300")}>
            {item.deadline ? `ส่ง ${formatDateShort(item.deadline)}` : "ไม่กำหนดส่ง"}
          </span>
          {qty && <span className="tabular-nums">{qty} ตัว</span>}
        </span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
    </button>
  );
}

function QueueGroup({
  title,
  hint,
  items,
  onOpen,
}: {
  title: string;
  hint: string;
  items: readonly StationQueueItem[];
  onOpen: (item: StationQueueItem) => void;
}) {
  return (
    <section aria-labelledby={`station-group-${title}`} className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id={`station-group-${title}`} className="text-base font-semibold text-strong">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-muted">{hint}</p>
        </div>
        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-sm font-medium tabular-nums text-secondary">
          {items.length}
        </span>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <QueueCard key={item.key} item={item} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

export function StationQueueView({
  stationLabel,
  stationDescription,
  icon: Icon,
  items,
  onOpen,
}: {
  stationLabel: string;
  stationDescription: string;
  icon: ComponentType<{ className?: string }>;
  items: readonly StationQueueItem[];
  onOpen: (item: StationQueueItem) => void;
}) {
  const active = items.filter((item) => item.status === "active");
  const ready = items.filter((item) => item.status === "ready");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-blue-400" aria-hidden="true" />
            <h1 className="text-2xl font-semibold text-strong">{stationLabel}</h1>
          </div>
          <p className="mt-1 text-sm text-muted">{stationDescription}</p>
        </div>
        <p className="text-sm tabular-nums text-muted">
          งานที่ลงมือได้ {items.length.toLocaleString("th-TH")} รายการ
        </p>
      </div>

      {items.length === 0 ? (
        <div className="card-surface rounded-2xl">
          <EmptyState
            icon={CheckCircle2}
            title="ไม่มีงานพร้อมทำที่สถานีนี้"
            description="สแกนเลขออเดอร์เพื่อตรวจงานเฉพาะใบ หรือเลือกสถานีอื่นได้ทันที"
          />
        </div>
      ) : (
        <div className="grid items-start gap-8 xl:grid-cols-[minmax(20rem,4fr)_minmax(0,6fr)]">
          <QueueGroup
            title="กำลังทำ"
            hint="งานที่มีคนเริ่มแล้ว อยู่บนสุดเสมอ"
            items={active}
            onOpen={onOpen}
          />
          <QueueGroup
            title="คิวพร้อมทำ"
            hint="เรียงตามกำหนดส่ง งานที่ติดด่านไม่ปนในคิวนี้"
            items={ready}
            onOpen={onOpen}
          />
        </div>
      )}

      {items.length > 0 && active.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Clock3 className="h-4 w-4" aria-hidden="true" />
          ยังไม่มีงานที่กำลังทำ — เปิดใบแรกจากคิวพร้อมทำได้เลย
        </p>
      )}
    </div>
  );
}
