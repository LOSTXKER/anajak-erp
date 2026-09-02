"use client";

/**
 * ชิ้นส่วนของจอสถานี `/station` (แบบ A "หยิบงานเอง" — เบสเคาะ 2026-09-03) · props ล้วน ไม่มี query
 * โครงจอเต็ม (ไม่มีเมนูข้าง) · ป้ายสถานี · การ์ดคิว (ทั้งใบกดได้) · กลุ่มคิว 3 กลุ่ม
 * เป้ากด ≥ 56px · โฟกัสด้วยขนาด/น้ำหนัก/พื้นจม ไม่ใช่สี (docs/DESIGN.md §ลำดับความสำคัญทางสายตา)
 */

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowLeft, ChevronRight, ClipboardCheck, Clock, Package, Printer, Shirt, Truck, UserRound, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DueTag } from "@/components/ui/due-tag";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { RADIUS, SUNK_PANEL, TINT } from "@/components/ui/tokens";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { STATION_OUTSOURCE, STATION_STATE_META, type StationCard, type StationCount, type StationDef, type StationQueue, type StationStepLike } from "@/lib/station-desk";
import { cn } from "@/lib/utils";

export const STATION_ICON: Record<string, LucideIcon> = {
  "lane:PREP": Shirt,
  "lane:DTF": Printer,
  [STATION_OUTSOURCE]: Truck,
  "post:qc": ClipboardCheck,
  "post:pack": Package,
};

/** ไอคอนสถานี — วาดเป็น component เพื่อไม่สร้าง component ระหว่าง render (react-hooks/static-components) */
export function StationIcon({ stationKey, className }: { stationKey: string; className?: string }) {
  const Icon = STATION_ICON[stationKey] ?? Wrench;
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
}

/* ───────────────────────── โครงจอ ───────────────────────── */

export function StationShell({
  title,
  eyebrow,
  onBack,
  backLabel = "กลับ",
  right,
  who,
  clock,
  children,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
  who: ReactNode;
  clock?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col px-4 py-4 sm:px-6">
      <header className="flex items-center gap-3 border-b border-border pb-3">
        {onBack ? (
          <Button variant="outline" size="lg" className="h-12 shrink-0 px-4" onClick={onBack}>
            <ArrowLeft /> {backLabel}
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="text-xs font-medium text-muted">{eyebrow}</p> : null}
          <h1 className="truncate text-xl font-semibold text-strong sm:text-2xl">{title}</h1>
        </div>
        {right}
        {clock ? (
          <p className="hidden items-center gap-1.5 text-sm text-secondary lg:flex">
            <Clock className="h-4 w-4 text-muted" aria-hidden="true" />
            <span className="tabular-nums">{clock}</span>
          </p>
        ) : null}
        {who}
      </header>
      <div className="flex-1 pt-5">{children}</div>
    </div>
  );
}

export function WhoChip({ name, boss = false, onChange }: { name: string; boss?: boolean; onChange?: () => void }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-full py-1 pl-1 pr-3", SUNK_PANEL)}>
      <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white dark:bg-blue-500">
        {name.trim().charAt(0) || "?"}
      </span>
      <span className="text-sm font-medium text-strong">{name}</span>
      {boss ? (
        <Badge variant="accent" size="sm">
          หัวหน้า
        </Badge>
      ) : onChange ? (
        <button type="button" onClick={onChange} className="text-xs text-secondary underline-offset-2 hover:underline">
          เปลี่ยนคน
        </button>
      ) : null}
    </div>
  );
}

/* ───────────────────────── ป้ายสถานี ───────────────────────── */

export function StationTile({ count, doingBy, onPick, boss = false }: { count: StationCount; doingBy: string[]; onPick: () => void; boss?: boolean }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "card-surface flex min-h-[9.5rem] flex-col gap-3 p-4 text-left transition-colors hover:bg-interactive-hover",
        RADIUS.surface,
        count.blocked > 0 && "ring-1 ring-inset ring-red-600/40 dark:ring-red-400/40",
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center", SUNK_PANEL, RADIUS.inner)}>
          <StationIcon stationKey={count.key} className="h-6 w-6 text-strong" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-strong">{count.label}</p>
          {count.hint ? <p className="text-sm text-secondary">{count.hint}</p> : null}
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
      </div>
      <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
          <Metric value={count.doing} label="กำลังทำ" size="md" tone={count.doing > 0 ? "default" : "muted"} />
          <Metric value={count.ready} label="พร้อมทำ" size="md" tone={count.ready > 0 ? "default" : "muted"} />
          <Metric value={count.blocked} label="ติด / รอ" size="md" tone={count.blocked > 0 ? "danger" : "muted"} />
        </div>
        {boss && doingBy.length > 0 ? (
          <InfoChipRow>
            {doingBy.map((name) => (
              <InfoChip key={name} size="sm" icon={UserRound}>
                {name}
              </InfoChip>
            ))}
          </InfoChipRow>
        ) : count.total === 0 ? (
          <span className="text-sm text-muted">ว่าง</span>
        ) : null}
      </div>
    </button>
  );
}

/* ───────────────────────── การ์ดคิว ───────────────────────── */

export type CardOrder = { id: string; orderNumber: string; customerName?: string | null; totalQuantity?: number; priority?: string | null; deadline: Date | string | null; blindShip?: boolean; mockupCover?: string | null };

export function StateChip<O extends CardOrder, S extends StationStepLike>({ card, size = "md" }: { card: StationCard<O, S>; size?: "sm" | "md" | "lg" }) {
  const meta = STATION_STATE_META[card.state];
  return (
    <InfoChip size={size} tone={meta.tone} strong={meta.strong} icon={card.spot.stationKey.startsWith("lane:") && card.reason?.startsWith("อยู่ที่ร้าน") ? Truck : Wrench}>
      {meta.label}
    </InfoChip>
  );
}

/**
 * การ์ดในคิว — ทั้งใบกดได้ (ช่างไม่ต้องเล็งปุ่มเล็ก) · ของหัวหน้ามีปุ่ม "แก้ให้" ซ้อนขวา
 * รูปย่อจริง · เลขใบหนัก · จำนวนเป็นตัวเลขใหญ่ · กำหนดส่งเป็นป้าย · สถานะเป็นชิป
 */
export function QueueCard<O extends CardOrder, S extends StationStepLike>({
  card,
  dueInDays,
  dateLabel,
  onOpen,
  showOwner = false,
  extra,
}: {
  card: StationCard<O, S>;
  dueInDays: number | null;
  dateLabel: string | null;
  onOpen: () => void;
  showOwner?: boolean;
  extra?: ReactNode;
}) {
  const order = card.job.order;
  const urgent = order.priority === "URGENT";
  const problem = card.state === "blocked";
  return (
    <li className={cn("card-surface relative", RADIUS.surface, problem && "ring-1 ring-inset ring-red-600/40 dark:ring-red-400/40")}>
      <button type="button" onClick={onOpen} aria-label={`เปิดงาน ${order.orderNumber}`} className={cn("absolute inset-0 z-0 transition-colors hover:bg-interactive-hover", RADIUS.surface)} />
      <div className="pointer-events-none relative z-10 flex gap-4 p-4">
        <MockupThumbnail cover={order.mockupCover ?? null} alt={`ม็อกอัพ ${order.orderNumber}`} size="lg" className="shrink-0" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold tabular-nums text-strong">{order.orderNumber}</span>
              {urgent ? <Badge variant="destructive">ด่วน</Badge> : null}
              {order.blindShip ? <Badge variant="warning">ไม่ระบุผู้ส่ง</Badge> : null}
            </p>
            <p className="truncate text-sm text-secondary">{order.customerName ?? "ไม่ระบุลูกค้า"}</p>
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <Metric value={(order.totalQuantity ?? 0).toLocaleString("th-TH")} unit="ตัว" size="md" />
            <DueTag dueInDays={dueInDays} dateLabel={dateLabel} size="md" />
          </div>
          <InfoChipRow>
            <InfoChip size="md" strong={card.state === "doing"} icon={Wrench}>
              {card.stepLabel}
            </InfoChip>
            <StateChip card={card} />
            {card.step && card.step.qtyTotal ? (
              <InfoChip size="md">
                ทำแล้ว <span className="font-semibold tabular-nums">{(card.step.qtyDone ?? 0).toLocaleString("th-TH")}/{card.step.qtyTotal.toLocaleString("th-TH")}</span>
              </InfoChip>
            ) : null}
            {showOwner ? (
              <InfoChip size="sm" icon={UserRound} className={card.owner ? undefined : "opacity-70"}>
                {card.owner?.name ?? "ยังไม่มีคนรับ"}
              </InfoChip>
            ) : null}
          </InfoChipRow>
          {card.reason ? (
            <p className={cn("flex items-start gap-1.5 border px-2.5 py-1.5 text-sm", problem ? TINT.error : TINT.warning, RADIUS.inner)}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{card.reason}</span>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end justify-between gap-2">
          <ChevronRight className="h-6 w-6 text-muted" aria-hidden="true" />
          {extra ? <div className="pointer-events-auto">{extra}</div> : null}
        </div>
      </div>
    </li>
  );
}

/** สามกลุ่มของคิว — กำลังทำ → พร้อมทำ → ติด/รอ · กลุ่มว่างบอกว่าว่างเพราะอะไร */
export function QueueGroups<O extends CardOrder, S extends StationStepLike>({
  queue,
  station,
  dueOf,
  onOpen,
  showOwner = false,
  extra,
  emptyAction,
}: {
  queue: StationQueue<O, S>;
  station: StationDef;
  dueOf: (card: StationCard<O, S>) => { dueInDays: number | null; dateLabel: string | null };
  onOpen: (card: StationCard<O, S>) => void;
  showOwner?: boolean;
  extra?: (card: StationCard<O, S>) => ReactNode;
  emptyAction?: ReactNode;
}) {
  const empty = queue.doing.length + queue.ready.length + queue.blocked.length === 0;
  if (empty) {
    return (
      <EmptyState
        icon={STATION_ICON[station.key] ?? Wrench}
        title={`ยังไม่มีงานที่${station.label}`}
        description="งานจะขึ้นที่นี่เองเมื่อขั้นก่อนหน้าปิด — ถ้าคิดว่าควรมีงาน บอกหัวหน้า"
        action={emptyAction}
      />
    );
  }
  const group = (title: string, cards: StationCard<O, S>[], danger = false) =>
    cards.length === 0 ? null : (
      <section key={title} aria-label={title} className="space-y-3">
        <p className="flex items-baseline gap-2">
          <span className={cn("text-base font-semibold", danger ? "text-red-700 dark:text-red-300" : "text-strong")}>{title}</span>
          <span className="text-sm tabular-nums text-muted">{cards.length}</span>
        </p>
        <ul className="grid gap-3 lg:grid-cols-2">
          {cards.map((card) => (
            <QueueCard key={card.key} card={card} {...dueOf(card)} onOpen={() => onOpen(card)} showOwner={showOwner} extra={extra?.(card)} />
          ))}
        </ul>
      </section>
    );
  return (
    <div className="space-y-7">
      {group("กำลังทำ", queue.doing)}
      {group("พร้อมทำ — เรียงตามกำหนดส่ง", queue.ready)}
      {group("ติดปัญหา / รอของ", queue.blocked, true)}
    </div>
  );
}
