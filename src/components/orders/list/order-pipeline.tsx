"use client";

import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { InternalStatus } from "@prisma/client";
import { c, STATUS_TONE } from "@/components/kit/kit";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { PIPELINE_EXCEPTIONS, PIPELINE_SHORT_LABELS, pipelineStages } from "@/lib/order-list-view";

/* ============================================================
   ราง pipeline ของหน้ารายการออเดอร์ — ต้นแบบ pipeHTML() ทีละชิ้น (รื้อ 2026-09-15)

   5 ช่วงของเส้นทางงานบนรางเส้นเดียว สถานะเป็นวงมีตัวเลข จุดวิ่งตามราง (ปิดตาม prefers-reduced-motion)
   กดวง = กรองตาราง · กดซ้ำหรือ "ทุกสถานะ" = ล้าง · ไม่มีงาน = จุดเล็ก · ป้ายแดง "เลย N" = งานเลยกำหนด
   พักงาน/ยกเลิกอยู่นอกราง (PIPELINE_EXCEPTIONS) เป็นวงเส้นประ ไม่ใช่ขั้นถัดไป
   ============================================================ */

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function PipelineNode({
  status,
  count,
  late,
  selected,
  exception = false,
  onSelect,
}: {
  status: InternalStatus;
  count: number;
  late: number;
  selected: boolean;
  exception?: boolean;
  onSelect: (status: string) => void;
}) {
  return (
    <button
      type="button"
      data-node={status}
      aria-pressed={selected}
      aria-label={`${INTERNAL_STATUS_LABELS[status]} ${count.toLocaleString("th-TH")} งาน${late > 0 ? ` เลยกำหนด ${late}` : ""}`}
      onClick={() => onSelect(selected ? "" : status)}
      className={c("pnode", STATUS_TONE[status], count === 0 && "zero", exception && "ex")}
    >
      <span className={c("b")}>{count > 0 || selected ? count.toLocaleString("th-TH") : ""}</span>
      <span>{PIPELINE_SHORT_LABELS[status]}</span>
      {late > 0 ? <span className={c("al")}>เลย {late}</span> : null}
    </button>
  );
}

export function OrderPipeline({
  counts,
  overdue,
  selected,
  onSelect,
  isLoading = false,
}: {
  /** จำนวนงานต่อสถานะ — ตัวกรองอื่นมีผล แต่สถานะที่เลือกอยู่ไม่มีผล */
  counts: Record<string, number> | undefined;
  /** งานเลยกำหนดต่อสถานะ (วันปฏิทินไทย) */
  overdue: Record<string, number> | undefined;
  selected: string;
  onSelect: (status: string) => void;
  isLoading?: boolean;
}) {
  const stages = pipelineStages(counts, selected);
  const flow = stages.flatMap((stage) => stage.statuses);
  const flowKey = flow.join(",");
  const total = Object.values(counts ?? {}).reduce((sum, count) => sum + count, 0);
  const selectedStage = stages.find((stage) => (stage.statuses as string[]).includes(selected))?.label;
  const gridRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => true,
  );

  // รางวางจากตำแหน่งวงจริง (placePipe ของต้นแบบ) — ช่องยืดตามจอ เส้นจึงต้องวัดหลังจัดวางทุกครั้ง
  useLayoutEffect(() => {
    const grid = gridRef.current;
    const line = lineRef.current;
    if (!grid || !line) return;
    const statuses = flowKey.split(",");
    const place = () => {
      const a = grid.querySelector(`[data-node="${statuses[0]}"] > span`);
      const b = grid.querySelector(`[data-node="${statuses[statuses.length - 1]}"] > span`);
      if (!a || !b) return;
      const box = grid.getBoundingClientRect();
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x1 = ra.left + ra.width / 2 - box.left;
      const x2 = rb.left + rb.width / 2 - box.left;
      line.style.left = `${x1}px`;
      line.style.width = `${Math.max(0, x2 - x1)}px`;
      line.style.top = `${ra.top + ra.height / 2 - box.top - 1}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(grid);
    void document.fonts.ready.then(place);
    return () => observer.disconnect();
  }, [flowKey, isLoading, counts]);

  if (isLoading && !counts) {
    return (
      <div className={c("pipe")}>
        <span className={c("sk")} style={{ height: 64 }} />
      </div>
    );
  }

  // ขนาดช่องตามต้นแบบ: ทั้งหมด 76 · ช่องว่าง 18 · สถานะ ≥66 · เส้นประ 26 · นอกเส้นทาง 66–76
  const columns = [
    "76px",
    "18px",
    `repeat(${flow.length}, minmax(66px, 1fr))`,
    "26px",
    `repeat(${PIPELINE_EXCEPTIONS.length}, minmax(66px, 76px))`,
  ].join(" ");

  return (
    <div className={c("pipe")}>
      <div
        ref={gridRef}
        role="group"
        aria-label="กรองตามสถานะในเส้นทางงาน"
        className={c("grid")}
        style={{ gridTemplateColumns: columns }}
      >
        <div className={c("grp")} style={{ gridColumn: 1 }}>
          ทั้งหมด
        </div>
        <div style={{ gridColumn: 2 }} />
        {stages.map((stage) => (
          <div
            key={stage.label}
            className={c("grp", stage.label === selectedStage && "on")}
            style={{ gridColumn: `span ${stage.statuses.length}` }}
          >
            {stage.label}
            <b>{stage.statuses.reduce((sum, status) => sum + (counts?.[status] ?? 0), 0).toLocaleString("th-TH")}</b>
          </div>
        ))}
        <div />
        <div className={c("grp")} style={{ gridColumn: `span ${PIPELINE_EXCEPTIONS.length}` }}>
          นอกเส้นทาง
        </div>

        <button
          type="button"
          aria-pressed={selected === ""}
          aria-label={`ทุกสถานะ ${total.toLocaleString("th-TH")} งาน`}
          onClick={() => onSelect("")}
          className={c("pnode all")}
        >
          <span className={c("b")}>{total.toLocaleString("th-TH")}</span>
          <span>ทุกสถานะ</span>
        </button>
        <div className={c("psep")} />
        {flow.map((status) => (
          <PipelineNode
            key={status}
            status={status}
            count={counts?.[status] ?? 0}
            late={overdue?.[status] ?? 0}
            selected={selected === status}
            onSelect={onSelect}
          />
        ))}
        <div className={c("psep")}>
          <i />
        </div>
        {PIPELINE_EXCEPTIONS.map((status) => (
          <PipelineNode
            key={status}
            status={status}
            count={counts?.[status] ?? 0}
            late={overdue?.[status] ?? 0}
            selected={selected === status}
            exception
            onSelect={onSelect}
          />
        ))}
        <div ref={lineRef} className={c("line")} aria-hidden="true">
          {reducedMotion ? null : (
            <>
              <i />
              <i />
              <i />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
