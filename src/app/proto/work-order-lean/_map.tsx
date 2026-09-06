"use client";

/**
 * แผนที่เส้นทางงาน (จำลอง) — ผังจริงอยู่ lib/work-order-route · หน้าลองนี้วาดเองเพราะ "ขนาดของแผนที่" คือสิ่งที่กำลังเทียบ
 *   คอลัมน์คี่ = ขั้น · คอลัมน์คู่ = เส้น · แถว = สายที่เดินขนานกัน
 *   ขั้นบรรจบกลางทาง (รีดร้อน) กินเฉพาะแถวของสายที่รอ · หางงาน (QC/แพ็ก) กินทุกแถว — เหมือนของจริง
 *   honest=false = โชว์อย่างที่ของจริงโชว์วันนี้ (ของอยู่ที่ร้าน = "กำลังทำ" เลขน้ำเงิน) · honest=true = รถบรรทุกสีส้ม "อยู่ที่ร้าน"
 *   dense = แถบย่อสำหรับ C (ชื่อสั้น ไม่มีคำบรรยายใต้ขั้น)
 */

import { AlertTriangle, Check, Clock, Truck } from "lucide-react";
import { FOCUS_BUTTON, RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { LANE_LABEL, LANE_ORDER, OUTSOURCE_LANES, directWaits, pendingOf, shortWaitList, type Lane, type LeanStep } from "./_data";

type Pos = { col: number; rowStart: number; rowEnd: number };
type Cell = Pos & { step: LeanStep };
type Link = { key: string; colStart: number; colEnd: number; rowStart: number; rowEnd: number };

export function routeLayout(steps: LeanStep[]): { cells: Cell[]; links: Link[]; rows: number; columns: number } {
  const lanes = LANE_ORDER.filter((l) => steps.some((s) => s.lane === l));
  const rows = Math.max(1, lanes.length);
  const rowOf = new Map<Lane, number>(lanes.map((l, i) => [l, i + 1]));
  const pos = new Map<string, Pos>();
  const cells: Cell[] = [];
  const links: Link[] = [];
  const nextCol = new Map<Lane, number>();
  let col = 1;
  for (const s of steps) {
    if (s.lane === "main") continue;
    const r = rowOf.get(s.lane) ?? 1;
    const c = nextCol.get(s.lane) ?? 1;
    const p = { col: c, rowStart: r, rowEnd: r + 1 };
    pos.set(s.id, p);
    cells.push({ step: s, ...p });
    nextCol.set(s.lane, c + 2);
    col = Math.max(col, c + 2);
  }
  for (const s of steps) {
    if (s.lane !== "main") continue;
    const sources = directWaits(s, steps)
      .map((w) => pos.get(w.id))
      .filter((p): p is Pos => !!p);
    const tail = s.kind === "qc" || s.kind === "pack" || sources.length === 0;
    const p = {
      col,
      rowStart: tail ? 1 : Math.min(...sources.map((x) => x.rowStart)),
      rowEnd: tail ? rows + 1 : Math.max(...sources.map((x) => x.rowEnd)),
    };
    pos.set(s.id, p);
    cells.push({ step: s, ...p });
    for (const src of sources) links.push({ key: `${src.col}-${src.rowStart}-${s.id}`, colStart: src.col + 1, colEnd: col, rowStart: src.rowStart, rowEnd: src.rowEnd });
    col += 2;
  }
  return { cells, links, rows, columns: Math.max(1, col - 2) };
}

export type NodeView = "done" | "active" | "blocked" | "waiting" | "todo";

/** ของจริงวันนี้เรียกขั้นที่ของอยู่ที่ร้านว่า "กำลังทำ" (สถานะขั้น IN_PROGRESS) — ทาง A/B/C เรียก "อยู่ที่ร้าน" */
export function viewFor(step: LeanStep, honest: boolean): NodeView {
  if (!honest && step.state === "waiting") return "active";
  return step.state;
}

export function NodeMark({ view, order, outsource, size = "md" }: { view: NodeView; order: number; outsource: boolean; size?: "sm" | "md" }) {
  const base = cn("flex shrink-0 items-center justify-center rounded-full font-medium tabular-nums", size === "sm" ? "h-5 w-5 text-2xs" : "h-6 w-6 text-xs");
  const icon = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  if (view === "done") {
    return (
      <span className={cn(base, "bg-green-600 text-white dark:bg-green-500")}>
        <Check className={icon} strokeWidth={2.5} aria-hidden="true" />
      </span>
    );
  }
  if (view === "blocked") {
    return (
      <span className={cn(base, "bg-red-600 text-white")}>
        <AlertTriangle className={icon} aria-hidden="true" />
      </span>
    );
  }
  if (view === "waiting") {
    const Icon = outsource ? Truck : Clock;
    return (
      <span className={cn(base, "bg-amber-500 text-white")}>
        <Icon className={icon} aria-hidden="true" />
      </span>
    );
  }
  if (view === "active") return <span className={cn(base, "bg-blue-600 text-white")}>{order}</span>;
  return <span className={cn(base, "bg-surface-muted text-muted")}>{order}</span>;
}

export function captionOf(step: LeanStep, steps: LeanStep[], fullNames: boolean): string {
  const pending = step.state === "todo" ? pendingOf(step, steps) : [];
  if (pending.length > 0) return `รอ ${shortWaitList(pending.map((p) => (fullNames ? p.label : p.short)))}`;
  if (step.lane === "main") return LANE_LABEL.main;
  if (OUTSOURCE_LANES.has(step.lane)) return `ร้านนอก · ${LANE_LABEL[step.lane]}`;
  return LANE_LABEL[step.lane];
}

export function RouteMap({
  steps,
  focusId,
  onFocus,
  honest,
  dense = false,
  fullNames = false,
  ariaLabel = "เส้นทางงาน — สายที่เดินขนานกันอยู่คนละแถว",
}: {
  steps: LeanStep[];
  focusId: string | null;
  onFocus: (id: string | null) => void;
  honest: boolean;
  dense?: boolean;
  fullNames?: boolean;
  ariaLabel?: string;
}) {
  const { cells, links, rows, columns } = routeLayout(steps);
  const orderOf = new Map(steps.map((s, i) => [s.id, i + 1]));
  const nodeW = dense ? "minmax(108px,auto)" : "minmax(150px,auto)";
  const linkW = dense ? "20px" : "32px";
  const template = Array.from({ length: columns }, (_, i) => (i % 2 === 0 ? nodeW : linkW)).join(" ");

  return (
    <div className="overflow-x-auto pb-1">
      <div
        role="list"
        aria-label={ariaLabel}
        className={cn("grid items-stretch", dense ? "gap-y-1" : "gap-y-2")}
        style={{ gridTemplateColumns: template, gridTemplateRows: `repeat(${rows}, minmax(${dense ? 36 : 56}px, auto))`, minWidth: `${columns * (dense ? 64 : 92)}px` }}
      >
        {links.map((l) => (
          <div key={l.key} aria-hidden="true" className="flex items-center" style={{ gridColumn: `${l.colStart} / ${l.colEnd}`, gridRow: `${l.rowStart} / ${l.rowEnd}` }}>
            <span className="h-0.5 w-full bg-border" />
          </div>
        ))}
        {cells.map(({ step, col, rowStart, rowEnd }) => {
          const on = step.id === focusId;
          const view = viewFor(step, honest);
          const isNow = view !== "done" && view !== "todo";
          const caption = captionOf(step, steps, fullNames);
          return (
            <div key={step.id} role="listitem" className="flex items-center" style={{ gridColumn: col, gridRow: `${rowStart} / ${rowEnd}` }}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onFocus(on ? null : step.id)}
                className={cn(
                  RADIUS.item,
                  FOCUS_BUTTON,
                  "flex w-full items-center gap-2 border text-left transition-colors",
                  dense ? "min-h-9 px-2 py-1 text-xs" : "min-h-11 px-3 py-2 text-sm",
                  on ? "border-blue-600 bg-interactive-selected dark:border-blue-400" : isNow ? "border-border bg-surface hover:bg-interactive-hover" : "border-border bg-surface-muted/60 text-secondary hover:bg-interactive-hover",
                )}
              >
                <NodeMark view={view} order={orderOf.get(step.id) ?? 0} outsource={step.kind === "outsource"} size={dense ? "sm" : "md"} />
                <span className="min-w-0">
                  <span className={cn("block truncate", isNow || on ? "font-semibold text-strong" : "font-medium")}>{fullNames ? step.label : step.short}</span>
                  {dense ? null : (
                    <span className="block truncate text-xs text-muted" title={caption}>
                      {caption}
                    </span>
                  )}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
