"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { InternalStatus } from "@prisma/client";
import { Skeleton } from "@/components/ui/skeleton";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import {
  PIPELINE_EXCEPTIONS,
  PIPELINE_SHORT_LABELS,
  orderStatusTone,
  pipelineStages,
  type OrderStatusTone,
} from "@/lib/order-list-view";
import { cn } from "@/lib/utils";

/* ============================================================
   ราง pipeline ของหน้ารายการออเดอร์ (ต้นแบบรอบ 2 · เบสเคาะ 2026-09-14)

   ภาษาเดียวกับผังโรงงานหน้าแรก: เส้นทางงาน 5 ช่วงเรียงบนรางเส้นเดียว สถานะเป็นวงมีตัวเลข
   จุดวิ่งตามราง (ปิดตาม reduced-motion), กดวง = กรองตาราง, กดซ้ำหรือกด "ทุกสถานะ" = ล้าง
   สถานะที่ไม่มีงานหดเป็นจุดเล็กไม่แย่งสายตา · ป้ายแดง "เลย N" = งานเลยกำหนดในสถานะนั้น
   พักงาน/ยกเลิกอยู่นอกราง (ไม่ใช่ขั้นถัดไปของสายงาน) จึงวาดเป็นวงเส้นประแยกกลุ่ม
   ============================================================ */

const NODE_BORDER: Record<OrderStatusTone, string> = {
  neutral: "border-slate-300 dark:border-slate-600",
  brand: "border-blue-500 dark:border-blue-400",
  warning: "border-amber-500 dark:border-amber-400",
  success: "border-green-600 dark:border-green-400",
  danger: "border-red-500 dark:border-red-400",
};

const SELECTED_NODE =
  "border-blue-600 bg-blue-600 text-white ring-4 ring-blue-100 dark:border-blue-500 dark:bg-blue-500 dark:ring-blue-950";

interface OrderPipelineProps {
  /** จำนวนงานต่อสถานะ — ตัวกรองอื่นมีผล แต่สถานะที่เลือกอยู่ไม่มีผล */
  counts: Record<string, number> | undefined;
  /** งานเลยกำหนดต่อสถานะ (ตามวันปฏิทินไทย) */
  overdue: Record<string, number> | undefined;
  selected: string;
  onSelect: (status: string) => void;
  isLoading?: boolean;
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
  const compact = count === 0 && !selected;
  const label = INTERNAL_STATUS_LABELS[status];
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${label} ${count.toLocaleString("th-TH")} งาน${late > 0 ? ` เลยกำหนด ${late}` : ""}`}
      onClick={() => onSelect(selected ? "" : status)}
      className={cn(FOCUS_BUTTON, "group relative z-[1] flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 pb-1")}
    >
      <span className="flex h-10 items-center justify-center">
        <span
          data-pipeline-dot={status}
          className={cn(
            "flex items-center justify-center rounded-full border-2 tabular-nums transition-transform duration-150 group-active:scale-95",
            compact
              ? "h-4 w-4 border-border bg-surface-muted"
              : cn("h-10 w-10 bg-surface text-sm font-semibold text-strong", NODE_BORDER[orderStatusTone(status)]),
            exception && !compact && "border-dashed",
            selected && SELECTED_NODE,
          )}
        >
          {compact ? null : count.toLocaleString("th-TH")}
        </span>
      </span>
      <span
        className={cn(
          "whitespace-nowrap text-xs",
          selected ? "font-medium text-blue-700 dark:text-blue-300" : "text-muted",
        )}
      >
        {PIPELINE_SHORT_LABELS[status]}
      </span>
      {late > 0 ? (
        <span className="absolute -top-1.5 left-1/2 ml-2 whitespace-nowrap rounded-full bg-red-600 px-1.5 text-2xs font-medium tabular-nums text-white">
          เลย {late}
        </span>
      ) : null}
    </button>
  );
}

export function OrderPipeline({ counts, overdue, selected, onSelect, isLoading = false }: OrderPipelineProps) {
  const stages = pipelineStages(counts, selected);
  const flow = stages.flatMap((stage) => stage.statuses);
  const flowKey = flow.join(",");
  const total = Object.values(counts ?? {}).reduce((sum, count) => sum + count, 0);
  const selectedStage = stages.find((stage) => (stage.statuses as string[]).includes(selected))?.label;

  const gridRef = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState<{ x1: number; x2: number; y: number } | null>(null);
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // รางวัดจากตำแหน่งวงจริงหลังจัดวาง — ความกว้างช่องยืดตามจอ เส้นจึงต้องตามวงไม่ใช่ตัวเลขตายตัว
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const statuses = flowKey.split(",");
    const measure = () => {
      const first = grid.querySelector<HTMLElement>(`[data-pipeline-dot="${statuses[0]}"]`);
      const last = grid.querySelector<HTMLElement>(`[data-pipeline-dot="${statuses[statuses.length - 1]}"]`);
      if (!first || !last) {
        setLine(null);
        return;
      }
      const box = grid.getBoundingClientRect();
      const a = first.getBoundingClientRect();
      const b = last.getBoundingClientRect();
      setLine({
        x1: a.left + a.width / 2 - box.left,
        x2: b.left + b.width / 2 - box.left,
        y: a.top + a.height / 2 - box.top,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    void document.fonts.ready.then(measure);
    return () => observer.disconnect();
  }, [flowKey, isLoading]);

  if (isLoading && !counts) {
    return (
      <div className="px-4 pb-4 sm:px-5">
        <Skeleton className="h-20 rounded-xl" />
      </div>
    );
  }

  // ขนาดช่องตามต้นแบบ (.pipe .grid): ทั้งหมด 76px · ช่องว่าง 18px · สถานะ ≥66px · เส้นประ 26px · นอกเส้นทาง 66–76px
  const columns = [
    "4.75rem",
    "1.125rem",
    ...flow.map(() => "minmax(4.125rem,1fr)"),
    "1.625rem",
    ...PIPELINE_EXCEPTIONS.map(() => "minmax(4.125rem,4.75rem)"),
  ].join(" ");

  return (
    <div className="overflow-x-auto px-4 pb-3.5 pt-2 sm:px-[1.125rem]">
      <div
        ref={gridRef}
        role="group"
        aria-label="กรองตามสถานะในเส้นทางงาน"
        className="relative grid min-w-[61.25rem] items-start gap-y-2.5"
        style={{ gridTemplateColumns: columns }}
      >
        <p className="mx-2.5 whitespace-nowrap border-b-2 border-border pb-1.5 text-center text-xs font-medium text-muted">ทั้งหมด</p>
        <span aria-hidden="true" />
        {stages.map((stage) => {
          const sum = stage.statuses.reduce((acc, status) => acc + (counts?.[status] ?? 0), 0);
          const on = stage.label === selectedStage;
          return (
            <p
              key={stage.label}
              style={{ gridColumn: `span ${stage.statuses.length} / span ${stage.statuses.length}` }}
              className={cn(
                "mx-2.5 whitespace-nowrap border-b-2 pb-1.5 text-center text-xs font-medium",
                on ? "border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-300" : "border-border text-muted",
              )}
            >
              {stage.label}
              <span className={cn("ml-1.5 font-semibold tabular-nums", on ? "text-blue-700 dark:text-blue-300" : "text-secondary")}>
                {sum.toLocaleString("th-TH")}
              </span>
            </p>
          );
        })}
        <span aria-hidden="true" />
        <p
          style={{ gridColumn: `span ${PIPELINE_EXCEPTIONS.length} / span ${PIPELINE_EXCEPTIONS.length}` }}
          className="mx-2.5 whitespace-nowrap border-b-2 border-border pb-1.5 text-center text-xs font-medium text-muted"
        >
          นอกเส้นทาง
        </p>

        <button
          type="button"
          aria-pressed={selected === ""}
          aria-label={`ทุกสถานะ ${total.toLocaleString("th-TH")} งาน`}
          onClick={() => onSelect("")}
          className={cn(FOCUS_BUTTON, "group relative z-[1] flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 pb-1")}
        >
          <span className="flex h-10 items-center justify-center">
            <span
              className={cn(
                "flex h-10 min-w-10 items-center justify-center rounded-xl border-2 px-1.5 text-sm font-semibold tabular-nums transition-transform duration-150 group-active:scale-95",
                selected === "" ? SELECTED_NODE : "border-border bg-surface-muted text-strong",
              )}
            >
              {total.toLocaleString("th-TH")}
            </span>
          </span>
          <span
            className={cn(
              "whitespace-nowrap text-xs",
              selected === "" ? "font-medium text-blue-700 dark:text-blue-300" : "text-muted",
            )}
          >
            ทุกสถานะ
          </span>
        </button>
        <span aria-hidden="true" />
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
        <span aria-hidden="true" className="flex h-10 items-center justify-center">
          <span className="h-6 border-l-2 border-dashed border-slate-300 dark:border-slate-600" />
        </span>
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

        {line ? (
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            <line
              x1={line.x1}
              y1={line.y}
              x2={line.x2}
              y2={line.y}
              className="stroke-slate-300 dark:stroke-slate-600"
              strokeWidth={2}
              strokeLinecap="round"
            />
            {!reducedMotion
              ? [0, 1, 2].map((index) => (
                  <circle key={index} r={3.5} className="fill-blue-600 dark:fill-blue-400">
                    <animateMotion
                      dur="7s"
                      repeatCount="indefinite"
                      begin={`${-index * 2.3}s`}
                      path={`M ${line.x1} ${line.y} L ${line.x2} ${line.y}`}
                    />
                  </circle>
                ))
              : null}
          </svg>
        ) : null}
      </div>
    </div>
  );
}
