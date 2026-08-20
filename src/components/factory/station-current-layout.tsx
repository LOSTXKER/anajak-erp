"use client";

import type { ReactNode } from "react";
import { TINT } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import {
  StationQueueRailGroup,
  groupStationQueueItems,
  type StationQueueItem,
  type StationQueueSelection,
} from "@/components/factory/station-queue-view";

export function StationCurrentLayout({
  children,
  items,
  selection,
  scan,
  onOpen,
}: {
  children: ReactNode;
  items: readonly StationQueueItem[];
  selection: StationQueueSelection;
  scan: ReactNode;
  onOpen: (item: StationQueueItem) => void;
}) {
  const { selected, active, ready, blocked } = groupStationQueueItems(
    items,
    selection,
  );
  // การเปิดดูต้องไม่เปลี่ยน bucket จริง: ready ยังพร้อม, blocked ยังติดปัญหา และ
  // active เท่านั้นที่นับว่ากำลังทำ. selected ถูกตัดจาก rail จึงต้องนับคืนในสรุป.
  const currentCount = active.length + (selected?.status === "active" ? 1 : 0);
  const readyCount = ready.length + (selected?.status === "ready" ? 1 : 0);
  const blockedCount = blocked.length + (selected?.status === "blocked" ? 1 : 0);
  const currentRegionLabel = selected?.status === "blocked"
    ? "บริบทงานติดปัญหาที่เปิดดู"
    : selected?.status === "ready"
      ? "บริบทงานพร้อมที่เปิดดู"
      : selected?.status === "active"
        ? "งานปัจจุบัน"
        : "บริบทงานที่เปิดดู";

  return (
    <div
      data-station-current-layout
      data-selected-queue-key={selected?.key}
      className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <section
        aria-label={currentRegionLabel}
        data-station-region="current"
        className="min-w-0"
      >
        {children}
      </section>

      <aside
        aria-label="คิวสถานี"
        data-station-queue-rail
        className="min-w-0 space-y-3 lg:sticky lg:top-20"
      >
        <dl
          aria-label="สรุปคิวสถานี"
          className="grid grid-cols-3 gap-2 text-center"
        >
          <div
            className={cn(
              TINT.info,
              "flex min-h-16 flex-col items-center justify-center rounded-xl border px-2 py-2",
            )}
          >
            <dt className="text-2xs font-medium text-blue-300">กำลังทำ</dt>
            <dd className="text-xl font-semibold tabular-nums text-strong">
              {currentCount.toLocaleString("th-TH")}
            </dd>
          </div>
          <div className="flex min-h-16 flex-col items-center justify-center rounded-xl border border-border bg-surface px-2 py-2">
            <dt className="text-2xs font-medium text-muted">พร้อมถัดไป</dt>
            <dd className="text-xl font-semibold tabular-nums text-strong">
              {readyCount.toLocaleString("th-TH")}
            </dd>
          </div>
          <div
            className={cn(
              TINT.warning,
              "flex min-h-16 flex-col items-center justify-center rounded-xl border px-2 py-2",
            )}
          >
            <dt className="text-2xs font-medium text-amber-300">ติดปัญหา</dt>
            <dd className="text-xl font-semibold tabular-nums text-amber-200">
              {blockedCount.toLocaleString("th-TH")}
            </dd>
          </div>
        </dl>

        <section className="rounded-2xl border border-border bg-surface shadow-sm">
          <header className="border-b border-divider px-4 py-3">
            <h2 className="text-base font-semibold text-strong">คิวสถานี</h2>
            <p className="mt-0.5 text-xs text-muted">
              งานที่เปิดอยู่ไม่แสดงซ้ำในคิว
            </p>
          </header>
          <div className="space-y-3 px-3 pb-4 pt-2 lg:max-h-[50rem] lg:overflow-y-auto">
            {active.length > 0 ? (
              <StationQueueRailGroup
                id="station-rail-active-title"
                region="active"
                title="กำลังทำอื่น"
                items={active}
                emptyLabel=""
                onOpen={onOpen}
              />
            ) : null}
            <StationQueueRailGroup
              id="station-rail-ready-title"
              region="ready"
              title="พร้อมถัดไป"
              items={ready}
              emptyLabel="ยังไม่มีงานพร้อมถัดไป"
              onOpen={onOpen}
            />
            <StationQueueRailGroup
              id="station-rail-blocked-title"
              region="blocked"
              title="ติดปัญหา"
              items={blocked}
              emptyLabel="ไม่มีงานติดปัญหา"
              tone="warning"
              onOpen={onOpen}
            />
          </div>
        </section>

        {scan}
      </aside>
    </div>
  );
}
