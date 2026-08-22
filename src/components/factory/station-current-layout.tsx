"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
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
  const queueDisclosureRef = useRef<HTMLDetailsElement>(null);
  const [queueOpen, setQueueOpen] = useState(false);
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

  useEffect(() => {
    if (queueDisclosureRef.current) queueDisclosureRef.current.open = false;
  }, [selection.orderId, selection.productionId, selection.stepId]);

  function openQueueItem(item: StationQueueItem) {
    if (queueDisclosureRef.current) queueDisclosureRef.current.open = false;
    onOpen(item);
  }

  return (
    <div
      data-station-current-layout
      data-selected-queue-key={selected?.key}
      data-station-queue-open={queueOpen ? "" : undefined}
      className={cn(
        // กันพื้นที่ท้ายหน้าให้ summary ของคิวพ้น CTA แบบ fixed เสมอ
        // โดยเฉพาะตอน browser เลื่อน element ล่างสุดมาไว้ชิดขอบจอ.
        "min-w-0 space-y-4 pb-24",
        // ช่องสแกนอยู่ภายใน disclosure นี้เสมอ: เปิดคิวหรือใช้ keyboard สแกน
        // ต้องพัก CTA ของงานเดิม เพื่อไม่ให้ปิดงานผิดใบระหว่างเปลี่ยนบริบท.
        queueOpen && "[&_[data-station-action-bar]]:hidden",
      )}
    >
      <section
        aria-label={currentRegionLabel}
        data-station-region="current"
        className="min-w-0"
      >
        {children}
      </section>

      <details
        ref={queueDisclosureRef}
        onToggle={(event) => setQueueOpen(event.currentTarget.open)}
        aria-label="คิวสถานี"
        data-station-queue-rail
        className="card-surface group min-w-0 overflow-hidden rounded-lg"
      >
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 outline-none hover:bg-interactive-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <h2 className="font-semibold text-strong">คิวและสแกนงาน</h2>
            <p className="mt-0.5 text-sm text-muted">
              กำลังทำ {currentCount.toLocaleString("th-TH")} · พร้อม{" "}
              {readyCount.toLocaleString("th-TH")} · ติดปัญหา{" "}
              {blockedCount.toLocaleString("th-TH")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-secondary">
            <span className="hidden group-open:hidden sm:inline">เปิดคิว</span>
            <span className="hidden group-open:inline">ปิดคิว</span>
            <ChevronDown
              className="h-5 w-5 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </div>
        </summary>

        <div className="space-y-3 border-t border-divider p-3 sm:p-4">
          <section className="rounded-lg border border-border bg-surface-muted/35">
            <header className="border-b border-divider px-4 py-3">
              <h2 className="text-base font-semibold text-strong">คิวสถานี</h2>
              <p className="mt-0.5 text-xs text-muted">
                งานที่เปิดอยู่ไม่แสดงซ้ำในคิว
              </p>
            </header>
            <div className="space-y-3 px-3 pb-4 pt-2">
              {active.length > 0 ? (
                <StationQueueRailGroup
                  id="station-rail-active-title"
                  region="active"
                  title="กำลังทำอื่น"
                  items={active}
                  emptyLabel=""
                  onOpen={openQueueItem}
                />
              ) : null}
              <StationQueueRailGroup
                id="station-rail-ready-title"
                region="ready"
                title="พร้อมถัดไป"
                items={ready}
                emptyLabel="ยังไม่มีงานพร้อมถัดไป"
                onOpen={openQueueItem}
              />
              <StationQueueRailGroup
                id="station-rail-blocked-title"
                region="blocked"
                title="ติดปัญหา"
                items={blocked}
                emptyLabel="ไม่มีงานติดปัญหา"
                tone="warning"
                onOpen={openQueueItem}
              />
            </div>
          </section>

          {scan}
        </div>
      </details>
    </div>
  );
}
