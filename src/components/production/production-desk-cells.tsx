"use client";

import { Truck, UserRound } from "lucide-react";
import { InfoChip } from "@/components/ui/info-chip";
import { FOCUS_INSET } from "@/components/ui/tokens";
import type { BoardOrderLike, BoardRailPoint } from "@/lib/production-board";
import type { DeskRow, DeskStepLike } from "@/lib/production-desk";
import { productionWorklistProgress } from "@/lib/production-worklist";
import { cn } from "@/lib/utils";

const RAIL_CLASS: Record<BoardRailPoint["state"], string> = {
  done: "bg-green-500/80 dark:bg-green-400/70",
  now: "bg-amber-500",
  stuck: "bg-amber-500",
  failed: "bg-red-500",
  wait: "bg-slate-300 dark:bg-slate-600",
  na: "bg-slate-200 dark:bg-slate-700",
};

const RAIL_WORD: Record<BoardRailPoint["state"], string> = {
  done: "ผ่านแล้ว",
  now: "กำลังทำ",
  stuck: "ติดรอของ",
  failed: "ติดปัญหา",
  wait: "ยังไม่ถึง",
  na: "ไม่มีในใบนี้",
};

export function RouteRail({ rail }: { rail: readonly BoardRailPoint[] }) {
  const { completed, total } = productionWorklistProgress(rail);
  const points = rail.filter((point) => point.state !== "na");
  return (
    <div className="min-w-20">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
        aria-label={`ผ่านแล้ว ${completed} จาก ${total} ช่วง`}
        aria-valuetext={points.some((point) => point.statusLabel) ? points.map((point) => `${point.label} · ${point.statusLabel ?? RAIL_WORD[point.state]}`).join(", ") : undefined}
        className="flex h-1.5 gap-0.5"
      >
        {points.map((point) => (
          <span
            key={point.key}
            title={`${point.label} · ${point.statusLabel ?? RAIL_WORD[point.state]}`}
            className={cn("flex-1 rounded-sm", RAIL_CLASS[point.state])}
          />
        ))}
      </div>
      <p className="mt-1 text-xs tabular-nums text-muted">
        {completed}/{total} ช่วง
      </p>
    </div>
  );
}

export function CurrentCell<S extends DeskStepLike, O extends BoardOrderLike<S>>({ row, mode = "full" }: { row: DeskRow<S, O>; mode?: "full" | "disclosure" | "summary" }) {
  const [primary, ...parallel] = row.current;
  const waiting = parallel.filter((current) => current.state === "waiting");
  if (!primary) return <span className="text-muted">รออัปเดตขั้นตอน</span>;
  const secondary = parallel.length > 0 ? (
    <ul className="space-y-1 text-xs text-secondary" aria-label="สายงานอื่นในใบนี้">
      {parallel.filter((current) => current.state !== "waiting").map((current, index) => (
        <li key={`${current.label}-${index}`}>{current.label}</li>
      ))}
      {waiting.length > 0 ? <li>รอขั้นก่อนหน้า: {waiting.map((current) => current.label).join(", ")}</li> : null}
    </ul>
  ) : null;
  const { completed, total } = productionWorklistProgress(row.job.rail);
  return (
    <div className="space-y-1.5">
      <p className={cn("font-medium", primary.state === "failed" ? "text-red-700 dark:text-red-400" : "text-strong")}>
        {primary.label}
      </p>
      {primary.reason ? <p className="text-xs text-secondary">{primary.reason}</p> : null}
      {mode === "full" ? secondary : parallel.filter((current) => current.state === "failed" || current.state === "held").map((current, index) => (
        <p key={`${current.label}-${index}`} className="text-xs text-red-700 dark:text-red-400">{current.label}{current.reason ? ` — ${current.reason}` : ""}</p>
      ))}
      {mode === "disclosure" && <details className="text-xs text-secondary">
        <summary className={cn("cursor-pointer py-1 underline-offset-4 hover:underline", FOCUS_INSET)}>เส้นทางงาน {completed}/{total} ช่วง</summary>
        <div className="space-y-3 py-2">
          {secondary}
          <RouteRail rail={row.job.rail} />
          <ol className="space-y-1" aria-label="สถานะทุกช่วงงาน">
            {row.job.rail.filter((point) => point.state !== "na").map((point) => <li key={point.key}>{point.label} · {point.statusLabel ?? RAIL_WORD[point.state]}</li>)}
          </ol>
        </div>
      </details>}
    </div>
  );
}

export function OutsourceCell<S extends DeskStepLike, O extends BoardOrderLike<S>>({ row, expanded = false }: { row: DeskRow<S, O>; expanded?: boolean }) {
  const o = row.outsource;
  if (!o) return <span className="text-muted">—</span>;
  const back =
    o.backInDays === null
      ? { text: o.statusLabel, tone: "info" as const, strong: false }
      : o.backInDays < 0
        ? { text: `เลยนัดรับ ${Math.abs(o.backInDays)} วัน`, tone: "error" as const, strong: true }
        : o.backInDays === 0
          ? { text: "นัดรับวันนี้", tone: "warning" as const, strong: true }
          : { text: `กลับอีก ${o.backInDays} วัน`, tone: "info" as const, strong: false };
  return (
    <div className="min-w-0 space-y-1">
      <p className={cn(!expanded && "truncate", "font-medium text-strong")}>{o.vendor}</p>
      {o.work ? <p className={cn(!expanded && "truncate", "text-xs text-secondary")}>{o.work}</p> : null}
      <InfoChip size="sm" tone={back.tone} strong={back.strong} icon={Truck}>
        {back.text}
      </InfoChip>
    </div>
  );
}

export function ResponsibleCell({ names }: { names: readonly string[] }) {
  return names.length > 0 ? (
    <span className="inline-flex items-start gap-1.5 text-secondary">
      <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      <span>{names.join(", ")}</span>
    </span>
  ) : <span className="text-muted">ยังไม่มีคนรับ</span>;
}
