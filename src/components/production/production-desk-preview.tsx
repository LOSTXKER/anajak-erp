"use client";

import { useEffect, useRef, useState, type ComponentProps, type RefObject } from "react";
import { ArrowLeft, Factory } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DueTag } from "@/components/ui/due-tag";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FOCUS_INSET, RADIUS } from "@/components/ui/tokens";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { orderMockupCover } from "@/lib/mockup";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import type { BoardOrderLike } from "@/lib/production-board";
import type { DeskRow, DeskStepLike } from "@/lib/production-desk";
import type { DeskSort, DeskSortKey } from "@/lib/production-desk-sort";
import { cn, formatDateShort } from "@/lib/utils";
import {
  CurrentCell,
  DeskTable,
  DeskTiles,
  DeskToolbar,
  OutsourceCell,
  ResponsibleCell,
  RouteRail,
  type ProductionDeskVariant,
} from "./production-desk-view";

type Props<S extends DeskStepLike, O extends BoardOrderLike<S>> = {
  variant?: ProductionDeskVariant;
  rows: readonly DeskRow<S, O>[];
  total: number;
  tiles: ComponentProps<typeof DeskTiles>;
  toolbar: ComponentProps<typeof DeskToolbar>;
  sort: DeskSort;
  onSort: (key: DeskSortKey, direction: "asc" | "desc") => void;
  onClearFilters: () => void;
  filtered: boolean;
  unknownOrders: readonly { id: string; number: string; customer: string }[];
};

/** Read-only comparison surface. The live page keeps its existing controller. */
export function ProductionDeskPreview<S extends DeskStepLike, O extends BoardOrderLike<S>>({
  variant = "current", rows, total, tiles, toolbar, sort, onSort, onClearFilters, filtered, unknownOrders,
}: Props<S, O>) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const selectedRow = rows.find((row) => row.job.key === selectedKey);
  const detailRow = selectedRow ?? rows[0];

  useEffect(() => {
    if (variant === "b" && selectedKey) detailHeading.current?.focus();
  }, [selectedKey, variant]);

  function openRow(row: DeskRow<S, O>) {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedKey(row.job.key);
  }
  function closeRow() {
    setSelectedKey(null);
    requestAnimationFrame(() => returnFocus.current?.focus());
  }
  const title = (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-divider pb-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold text-strong">การผลิต</h1>
        <span className="text-sm text-secondary">{total} ใบงาน</span>
      </div>
      <span className="text-sm text-secondary">ข้อมูลจำลอง · เปิดดูอย่างเดียว</span>
    </header>
  );
  const table = (
    <DeskTable
      variant={variant}
      rows={rows}
      sort={sort}
      onSort={onSort}
      hrefFor={(row) => `#${encodeURIComponent(row.job.key)}`}
      onSelectRow={openRow}
      selectedRowKey={variant === "b" ? detailRow?.job.key : undefined}
      emptyLabel="ไม่พบงานที่ตรงกับตัวกรอง ลองค้นหาใหม่หรือล้างตัวกรอง"
    />
  );

  return (
    <PageShell
      title="การผลิต"
      icon={Factory}
      tone="production"
      description={`งานในโรงงาน ${total} ใบ · ข้อมูลจำลอง เปิดดูอย่างเดียว`}
      header={variant === "current" ? undefined : title}
      className="min-w-0"
    >
      <div className={cn("min-w-0", variant === "current" ? "space-y-5" : "space-y-3 pt-4")}>
        <DeskTiles {...tiles} variant={variant} onSelectLens={(lens) => { setSelectedKey(null); tiles.onSelectLens(lens); }} />
        <DeskToolbar
          {...toolbar}
          variant={variant}
          onSearchChange={(search) => { setSelectedKey(null); toolbar.onSearchChange(search); }}
          onSelectStation={(station) => { setSelectedKey(null); toolbar.onSelectStation(station); }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-secondary" aria-live="polite" aria-atomic="true">{rows.length}{filtered ? ` จาก ${total}` : ""} ใบงาน</p>
          <div className="flex flex-wrap items-center gap-2">
            {filtered && <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedKey(null); onClearFilters(); }}>ล้างตัวกรอง</Button>}
            <Select
              aria-label="เรียงรายการผลิต"
              className={cn("w-40", variant === "current" && "sm:hidden")}
              value={`${sort.key}:${sort.direction}`}
              onChange={(event) => {
                const [key, direction] = event.target.value.split(":");
                onSort(key as DeskSortKey, direction as "asc" | "desc");
              }}
            >
              <option value="deadline:asc">ส่งใกล้ก่อน</option><option value="deadline:desc">ส่งไกลก่อน</option>
              <option value="order:asc">เลขใบ น้อย–มาก</option><option value="order:desc">เลขใบ มาก–น้อย</option>
              <option value="quantity:asc">จำนวน น้อย–มาก</option><option value="quantity:desc">จำนวน มาก–น้อย</option>
            </Select>
          </div>
        </div>
        {variant === "b" ? (
          <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className={cn("min-w-0", selectedRow && "hidden lg:block")}>{table}</div>
            {detailRow && (
              <aside aria-label="รายละเอียดใบงานที่เปิดดู" className={cn("min-w-0 border border-border bg-surface p-4 lg:sticky lg:top-4", RADIUS.surface, !selectedRow && "hidden lg:block")}>
                <Button type="button" variant="outline" size="sm" className="mb-4 lg:hidden" onClick={closeRow}><ArrowLeft /> กลับรายการ</Button>
                <DeskRowDetails row={detailRow} headingRef={detailHeading} />
              </aside>
            )}
          </div>
        ) : table}
        {unknownOrders.map((order) => (
          <details key={order.id} className={cn("border border-border bg-surface p-4", RADIUS.surface)}>
            <summary className={cn("cursor-pointer text-sm font-semibold text-strong", FOCUS_INSET)}>เปิดดู {order.number} · ข้อมูลยังไม่ยืนยัน</summary>
            <p className="mt-3 text-sm text-secondary">{order.customer} — ยังไม่มีหลักฐานยืนยันจำนวนที่รับ งานที่ทำแล้ว และสถานที่ของเสื้อ</p>
          </details>
        ))}
      </div>
      {variant !== "b" && selectedRow && (
        <Dialog open onOpenChange={(open) => { if (!open) closeRow(); }}>
          <DialogContent>
            <DialogTitle>รายละเอียดใบงาน · อ่านอย่างเดียว</DialogTitle>
            <DeskRowDetails row={selectedRow} />
          </DialogContent>
        </Dialog>
      )}
    </PageShell>
  );
}

export function DeskRowDetails<S extends DeskStepLike, O extends BoardOrderLike<S>>({ row, headingRef }: {
  row: DeskRow<S, O>;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}) {
  const order = row.job.order;
  const status = INTERNAL_STATUS_LABELS[order.internalStatus as keyof typeof INTERNAL_STATUS_LABELS];
  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <MockupThumbnail cover={orderMockupCover(order)} alt={`ม็อกอัพ ${order.orderNumber}`} size="md" />
          <div className="min-w-0">
            <h2 ref={headingRef} tabIndex={-1} className={cn("break-words text-lg font-semibold text-strong", FOCUS_INSET)}>{order.orderNumber}</h2>
            <p className="text-sm text-secondary">{status ?? "รออัปเดตสถานะ"}</p>
          </div>
        </div>
        <p className="break-words text-sm text-strong">{order.customerName ?? "ไม่ระบุลูกค้า"}</p>
        {(order.priority === "URGENT" || order.priority === "HIGH" || order.blindShip) && <div className="flex flex-wrap gap-2">
          {order.priority === "URGENT" && <Badge variant="destructive">ด่วน</Badge>}
          {order.priority === "HIGH" && <Badge variant="warning">สำคัญ</Badge>}
          {order.blindShip && <Badge variant="warning">Blind ship</Badge>}
        </div>}
      </header>
      <dl className="grid grid-cols-2 gap-4 border-y border-divider py-4 text-sm">
        <div><dt className="text-secondary">จำนวน</dt><dd className="mt-1 font-semibold tabular-nums text-strong">{(order.totalQuantity ?? 0).toLocaleString("th-TH")} ตัว</dd></div>
        <div><dt className="text-secondary">กำหนดส่ง</dt><dd className="mt-1"><DueTag dueInDays={row.dueInDays} dateLabel={order.deadline ? formatDateShort(order.deadline) : null} size="sm" /></dd></div>
        <div className="col-span-2"><dt className="text-secondary">ผู้รับผิดชอบ</dt><dd className="mt-1"><ResponsibleCell names={row.responsible} /></dd></div>
      </dl>
      <section className="space-y-3 text-sm"><h3 className="font-semibold text-strong">งานตอนนี้</h3><CurrentCell row={row} /><RouteRail rail={row.job.rail} /></section>
      <section className="space-y-3 border-t border-divider pt-4 text-sm"><h3 className="font-semibold text-strong">ร้านนอก</h3>{row.outsource ? <OutsourceCell row={row} expanded /> : <p className="text-secondary">ไม่มีงานอยู่ร้านนอก</p>}</section>
    </div>
  );
}
