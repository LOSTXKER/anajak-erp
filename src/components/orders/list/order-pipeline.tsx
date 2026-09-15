"use client";

import type { ReactNode } from "react";
import type { InternalStatus } from "@prisma/client";
import { c, STATUS_TONE } from "@/components/kit/kit";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { PIPELINE_EXCEPTIONS, PIPELINE_SHORT_LABELS, pipelineStages } from "@/lib/order-list-view";

/* ============================================================
   เส้นสถานะของหน้ารายการออเดอร์ — ต้นแบบ mockup-orders-list-lite-2026-09-16 รอบ 3 (เบสเคาะ "ทำจริงเลย")

   ไม่มีกรอบ (เบส "ขอแบบไม่ต้องมีกรอบ"): รางเส้นเดียวต่อกันทุกช่วง · ชื่อช่วงงาน+ยอดลอยเหนือวง
   วง = สถานะ พื้นสีอ่อนตามโทน · ไม่มีงาน = จุดเล็กบนราง · เลขแดงมุมวง = งานเลยกำหนด
   กดวง = กรองตาราง · กดซ้ำหรือ "ทั้งหมด" = ล้าง · พักงาน/ยกเลิกแยกท้ายหลังเส้นคั่น (วงเส้นประ)
   วางด้วย grid ล้วน ไม่ต้องวัดตำแหน่ง · ไม่มีภาพเคลื่อนไหว (จึงไม่ต้องเช็ก prefers-reduced-motion)
   ============================================================ */

function FlowNode({
  status,
  count,
  late,
  selected,
  exception = false,
  noLeft = false,
  noRight = false,
  column,
  onSelect,
}: {
  status: InternalStatus;
  count: number;
  late: number;
  selected: boolean;
  exception?: boolean;
  noLeft?: boolean;
  noRight?: boolean;
  column: number;
  onSelect: (status: string) => void;
}) {
  return (
    <button
      type="button"
      style={{ gridColumn: column, gridRow: 2 }}
      aria-pressed={selected}
      aria-label={`${INTERNAL_STATUS_LABELS[status]} ${count.toLocaleString("th-TH")} งาน${late > 0 ? ` เลยกำหนด ${late}` : ""}`}
      onClick={() => onSelect(selected ? "" : status)}
      className={c("fnode", STATUS_TONE[status], count === 0 && "zero", exception && "ex", noLeft && "nl", noRight && "nr")}
    >
      <span className={c("b")}>
        {count > 0 ? count.toLocaleString("th-TH") : ""}
        {late > 0 ? (
          <span className={c("lt")} aria-hidden="true">
            {late.toLocaleString("th-TH")}
          </span>
        ) : null}
      </span>
      <span className={c("lb")}>{PIPELINE_SHORT_LABELS[status]}</span>
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
  if (isLoading && !counts) {
    return (
      <div className={c("sflow")}>
        <span className={c("sk")} style={{ height: 76 }} />
      </div>
    );
  }

  const stages = pipelineStages(counts, selected).filter((stage) => stage.statuses.length > 0);
  const flow = stages.flatMap((stage) => stage.statuses);
  const total = Object.values(counts ?? {}).reduce((sum, count) => sum + count, 0);
  const sum = (statuses: readonly InternalStatus[]) =>
    statuses.reduce((acc, status) => acc + (counts?.[status] ?? 0), 0).toLocaleString("th-TH");

  // คอลัมน์: ทั้งหมด · ช่องว่าง · [วงของช่วง … ช่องต่อราง] … · เส้นคั่น · นอกเส้นทาง
  const columns: string[] = ["64px", "14px"];
  const labels: ReactNode[] = [];
  const cells: ReactNode[] = [];
  stages.forEach((stage, index) => {
    const start = columns.length + 1;
    for (const status of stage.statuses) {
      columns.push("minmax(58px, 1fr)");
      cells.push(
        <FlowNode
          key={status}
          status={status}
          count={counts?.[status] ?? 0}
          late={overdue?.[status] ?? 0}
          selected={selected === status}
          noLeft={status === flow[0]}
          noRight={status === flow[flow.length - 1]}
          column={columns.length}
          onSelect={onSelect}
        />,
      );
    }
    labels.push(
      <div
        key={stage.label}
        className={c("sl", (stage.statuses as string[]).includes(selected) && "on")}
        style={{ gridColumn: `${start} / span ${stage.statuses.length}`, gridRow: 1 }}
      >
        {stage.label}
        <b>{sum(stage.statuses)}</b>
      </div>,
    );
    if (index < stages.length - 1) {
      columns.push("22px");
      cells.push(<span key={`gap-${stage.label}`} className={c("rail")} style={{ gridColumn: columns.length, gridRow: 2 }} aria-hidden="true" />);
    }
  });
  columns.push("28px");
  cells.push(<span key="divider" className={c("vd")} style={{ gridColumn: columns.length, gridRow: "1 / span 2" }} aria-hidden="true" />);
  const exceptionStart = columns.length + 1;
  for (const status of PIPELINE_EXCEPTIONS) {
    columns.push("64px");
    cells.push(
      <FlowNode
        key={status}
        status={status}
        count={counts?.[status] ?? 0}
        late={overdue?.[status] ?? 0}
        selected={selected === status}
        exception
        noLeft
        noRight
        column={columns.length}
        onSelect={onSelect}
      />,
    );
  }
  labels.push(
    <div
      key="exceptions"
      className={c("sl", (PIPELINE_EXCEPTIONS as string[]).includes(selected) && "on")}
      style={{ gridColumn: `${exceptionStart} / span ${PIPELINE_EXCEPTIONS.length}`, gridRow: 1 }}
    >
      นอกเส้นทาง
      <b>{sum(PIPELINE_EXCEPTIONS)}</b>
    </div>,
  );

  return (
    <div className={c("sflow")}>
      <div role="group" aria-label="กรองตามสถานะในเส้นทางงาน" className={c("fgrid")} style={{ gridTemplateColumns: columns.join(" ") }}>
        {labels}
        <button
          type="button"
          style={{ gridColumn: 1, gridRow: 2 }}
          aria-pressed={selected === ""}
          aria-label={`ทุกสถานะ ${total.toLocaleString("th-TH")} งาน`}
          onClick={() => onSelect("")}
          className={c("fnode all nl nr")}
        >
          <span className={c("b")}>{total.toLocaleString("th-TH")}</span>
          <span className={c("lb")}>ทั้งหมด</span>
        </button>
        {cells}
      </div>
    </div>
  );
}
