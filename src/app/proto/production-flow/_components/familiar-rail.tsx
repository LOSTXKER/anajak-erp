"use client";

import { useEffect, useMemo, useRef } from "react";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { FOCUS_INSET, RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import type { OperationView } from "../_domain/types";

interface FamiliarRailProps {
  operations: OperationView[];
  selectedId: string;
  onSelect: (id: string) => void;
}

interface Phase {
  depth: number;
  operations: OperationView[];
}

/** Depth follows dependencies, not sequence: preparing garments and printing film share phase 1. */
function dependencyPhases(operations: OperationView[]): Phase[] {
  const byId = new Map(operations.map((operation) => [operation.id, operation]));
  const depths = new Map<string, number>();
  const visiting = new Set<string>();

  function depthOf(id: string): number {
    const saved = depths.get(id);
    if (saved !== undefined) return saved;
    const operation = byId.get(id);
    // Invalid/missing legacy edges must not make a selection-only rail crash.
    if (!operation || visiting.has(id)) return 0;
    visiting.add(id);
    const predecessors = operation.predecessorIds.filter((predecessor) => byId.has(predecessor));
    const depth = predecessors.length ? Math.max(...predecessors.map(depthOf)) + 1 : 0;
    visiting.delete(id);
    depths.set(id, depth);
    return depth;
  }

  const phases = new Map<number, OperationView[]>();
  for (const operation of [...operations].sort((a, b) => a.sequence - b.sequence)) {
    const depth = depthOf(operation.id);
    phases.set(depth, [...(phases.get(depth) ?? []), operation]);
  }
  return [...phases].sort(([a], [b]) => a - b).map(([depth, members]) => ({ depth, operations: members }));
}

function phaseState(operations: OperationView[]): OperationView["state"] {
  if (operations.some((operation) => operation.state === "problem")) return "problem";
  if (operations.every((operation) => operation.state === "done")) return "done";
  if (operations.some((operation) => operation.state === "inspection")) return "inspection";
  if (operations.some((operation) => operation.state === "vendor")) return "vendor";
  if (operations.some((operation) => operation.state === "ready" || operation.state === "working")) return "ready";
  return "waiting";
}

const NODE_TONE: Record<OperationView["state"], string> = {
  done: "bg-blue-600 text-white",
  ready: "bg-blue-600 text-white dark:bg-blue-500",
  working: "bg-blue-600 text-white dark:bg-blue-500",
  vendor: "bg-amber-600 text-white dark:bg-amber-500 dark:text-amber-950",
  inspection: "bg-amber-600 text-white dark:bg-amber-500 dark:text-amber-950",
  problem: "bg-red-600 text-white",
  waiting: "border-2 border-border bg-bg text-muted",
};

const LABEL_TONE: Record<OperationView["state"], string> = {
  done: "text-secondary",
  ready: "text-blue-700 dark:text-blue-300",
  working: "text-blue-700 dark:text-blue-300",
  vendor: "text-amber-800 dark:text-amber-300",
  inspection: "text-amber-800 dark:text-amber-300",
  problem: "text-red-700 dark:text-red-300",
  waiting: "text-muted",
};

export function FamiliarRail({ operations, selectedId, onSelect }: FamiliarRailProps) {
  const viewportRef = useRef<HTMLElement>(null);
  const phases = useMemo(() => dependencyPhases(operations), [operations]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    function ensureSelectedVisible() {
      if (!viewport || viewport.scrollWidth <= viewport.clientWidth + 1) return;
      const selected = viewport.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      if (!selected) return;
      const frame = viewport.getBoundingClientRect();
      const item = selected.getBoundingClientRect();
      if (item.left >= frame.left && item.right <= frame.right) return;
      // Move only this horizontal viewport; scrollIntoView would also move the page vertically.
      viewport.scrollTo({
        left: viewport.scrollLeft + item.left - frame.left - (viewport.clientWidth - item.width) / 2,
        behavior: "auto",
      });
    }
    ensureSelectedVisible();
    const observer = new ResizeObserver(ensureSelectedVisible);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [selectedId, phases]);

  if (!phases.length) return null;

  return (
    <nav ref={viewportRef} aria-label="เลือกดูขั้นการผลิต เลื่อนซ้ายขวาเพื่อดูทุกขั้น" className="max-w-full overflow-x-auto py-2">
      <ol className="flex w-full min-w-max items-start">
        {phases.map((phase, index) => {
          const selectedPhase = phase.operations.some((operation) => operation.id === selectedId);
          const state = phaseState(phase.operations);
          return (
            <li key={phase.depth} className="relative flex min-w-28 flex-1 flex-col items-center gap-1" data-phase={phase.depth + 1}>
              {phases.length > 1 ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-3 h-px bg-border"
                  style={{ left: index === 0 ? "50%" : 0, right: index === phases.length - 1 ? "50%" : 0 }}
                />
              ) : null}
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-[1] flex size-6 shrink-0 items-center justify-center rounded-full text-2xs font-semibold tabular-nums leading-none",
                  NODE_TONE[state],
                  selectedPhase && "ring-[3px] ring-blue-100 dark:ring-blue-500/25",
                )}
              >
                {index + 1}
              </span>
              <div className="flex items-start justify-center gap-0.5 px-1">
                {phase.operations.map((operation) => {
                  const selected = operation.id === selectedId;
                  const duplicateName = phase.operations.filter((item) => item.name === operation.name).length > 1;
                  const context = duplicateName ? operation.lines[0]?.product : undefined;
                  return (
                    <button
                      key={operation.id}
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${operation.name}${context ? ` ${context}` : ""} — ${operation.statusLabel}`}
                      onClick={() => onSelect(operation.id)}
                      data-operation-state={operation.state}
                      className={cn(
                        "flex min-w-24 max-w-40 flex-col items-center justify-start px-2 py-1 text-center text-xs leading-relaxed transition-colors hover:bg-interactive-hover [overflow-wrap:anywhere]",
                        CONTROL_MIN_H,
                        FOCUS_INSET,
                        RADIUS.field,
                        LABEL_TONE[operation.state],
                        selected && "font-semibold underline decoration-blue-600 decoration-2 underline-offset-4 dark:decoration-blue-400",
                      )}
                    >
                      <span>{operation.name}</span>
                      {context ? <span className="text-2xs font-normal text-muted">{context}</span> : null}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
