"use client";

/* ============================================================
   ผังเส้นทางการผลิตแบบ "สายพานคู่" (เบสเลือกแบบ R3 จากหน้าลอง
   /proto/work-order-control เมื่อ 2026-09-01)

   ทำไม: ของเดิมเป็นรายการขั้นเรียงลงมา ซึ่งอ่านแล้ว *"ไม่รู้สึกถึงเส้นทางหรือขั้นตอนเลย"*
   (เบสคำต่อคำ) ทั้งที่หัวข้อชื่อ "เส้นทางการผลิต"

   สิ่งที่ผังนี้ตอบซึ่งรายการเดิมตอบไม่ได้:
   ① งานเดินเป็นสองสาย — **สายเรา** (คุมเองได้) กับ **สายร้านนอก** (ต้องโทรตาม)
      สองอย่างนี้เวลาช้าแก้คนละวิธี จึงต้องเห็นแยกกันตั้งแต่แรก
   ② มี **จุดบรรจบ** ที่ต้องรอทั้งสองสาย — ขั้นที่รอขั้นจากอีกสายหนึ่ง
   ③ ขั้นไหนผ่านแล้ว/กำลังทำ/ยังไม่ถึง เห็นจากสีจุดบนราง ไม่ต้องอ่านทีละบรรทัด

   ผังนี้เป็น "ตัวนำทาง" — กดเพื่อเลื่อนไปที่ขั้นนั้นในรายการข้างล่าง ซึ่งยังเป็นที่
   ที่ปุ่มสั่งงานทั้งหมดอยู่ (ไม่ย้าย action มาไว้บนผัง เพื่อไม่ให้มีปุ่มสองที่ทำเรื่องเดียวกัน)
   ============================================================ */

import { Truck } from "lucide-react";

import { StatusLabel } from "@/components/ui/status-label";
import { cn } from "@/lib/utils";
import type { RouterOutput } from "@/lib/trpc";

type WorkOrder = RouterOutput["manufacturing"]["workOrder"];
type Operation = WorkOrder["operations"][number];

/** สีจุดบนราง — ชุดเดียวกับแถบ "เส้นทางงาน" ในหน้ารวม เพื่อให้สองหน้าพูดภาษาเดียวกัน */
function dotClass(state: Operation["state"]) {
  switch (state) {
    case "COMPLETED":
      return "bg-green-600 dark:bg-green-400";
    case "RUNNING":
      return "bg-amber-500 ring-4 ring-amber-500/20";
    case "BLOCKED":
      return "bg-red-600/70 dark:bg-red-400/70";
    case "READY":
      return "bg-blue-600 dark:bg-blue-400";
    case "CANCELLED":
      return "bg-border";
    default:
      return "bg-border";
  }
}

const STATE_WORD: Record<string, string> = {
  PLANNED: "ยังไม่ถึงคิว",
  READY: "พร้อมทำ",
  RUNNING: "กำลังทำ",
  BLOCKED: "ติดปัญหา",
  COMPLETED: "เสร็จแล้ว",
  CANCELLED: "ยกเลิก",
};

function linkClass(done: boolean) {
  return done ? "bg-green-600/50 dark:bg-green-400/40" : "bg-divider";
}

function StationChip({
  operation,
  selected,
  onSelect,
}: {
  operation: Operation;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const blocked = operation.blockers.length > 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(operation.id)}
      aria-pressed={selected}
      aria-label={`${operation.name} · ${STATE_WORD[operation.state] ?? operation.state} · กดเพื่อดูรายละเอียดขั้นนี้`}
      title={`${operation.name} · ${STATE_WORD[operation.state] ?? operation.state}`}
      className={cn(
        "card-surface w-44 shrink-0 rounded-xl p-3 text-left transition-shadow",
        selected && "ring-2 ring-blue-600 dark:ring-blue-400",
        blocked && "ring-1 ring-red-500/40",
        operation.state === "PLANNED" && "opacity-70",
      )}
    >
      <span className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", dotClass(operation.state))}
        />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block text-sm font-medium text-strong">
            {operation.name}
          </span>
          <span className="block truncate text-xs text-muted">
            {STATE_WORD[operation.state] ?? operation.state}
            {operation.assignee ? ` · ${operation.assignee.name}` : ""}
          </span>
        </span>
      </span>
    </button>
  );
}

function Lane({
  title,
  operations,
  selectedId,
  onSelect,
  outsource = false,
}: {
  title: string;
  operations: Operation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  outsource?: boolean;
}) {
  if (operations.length === 0) return null;
  return (
    <div>
      <p
        className={cn(
          "mb-1.5 flex items-center gap-1.5 text-xs font-medium",
          outsource ? "text-secondary" : "text-module-production-text",
        )}
      >
        {outsource ? <Truck className="h-3.5 w-3.5" aria-hidden="true" /> : null}
        {title}
      </p>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max items-center gap-1.5">
          {operations.map((operation, index) => (
            <div key={operation.id} className="flex items-center gap-1.5">
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1 w-4 shrink-0 rounded-full",
                    linkClass(operations[index - 1]!.state === "COMPLETED"),
                  )}
                />
              ) : null}
              <StationChip
                operation={operation}
                selected={selectedId === operation.id}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProductionV2FlowMap({
  workOrder,
  selectedId,
  onSelect,
}: {
  workOrder: WorkOrder;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const inHouse = workOrder.operations.filter(
    (operation) => operation.executionMode !== "OUTSOURCE",
  );
  const outsourced = workOrder.operations.filter(
    (operation) => operation.executionMode === "OUTSOURCE",
  );

  /* จุดบรรจบ = ขั้นในสายเราที่ต้องรอขั้นจากสายร้านนอก — ถ้าไม่มีงานร้านนอกในใบนี้
     ก็ไม่มีจุดบรรจบ ไม่ต้องขึ้นข้อความให้รก */
  const outsourceIds = new Set(outsourced.map((operation) => operation.id));
  const mergePoint = inHouse.find((operation) =>
    workOrder.dependencies.some(
      (dependency) =>
        dependency.successorStepId === operation.id &&
        outsourceIds.has(dependency.predecessorStepId),
    ),
  );

  const done = workOrder.operations.filter(
    (operation) => operation.state === "COMPLETED",
  ).length;

  return (
    <div className="space-y-3" data-production-flow-map="">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusLabel
          label={`ผ่านแล้ว ${done}/${workOrder.operations.length} ขั้น`}
          tone={done === workOrder.operations.length ? "success" : "accent"}
        />
        <p className="text-xs text-muted">กดขั้นในผังเพื่อไปที่รายละเอียดข้างล่าง</p>
      </div>

      <Lane
        title="สายเรา · ทำในโรงงาน"
        operations={inHouse}
        selectedId={selectedId}
        onSelect={onSelect}
      />

      {mergePoint && outsourced.length > 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-surface-muted/60 px-3 py-2">
          <span aria-hidden="true" className="text-base text-muted">
            ⤵
          </span>
          <p className="text-xs text-secondary">
            สองสายมาบรรจบที่{" "}
            <span className="font-medium text-strong">{mergePoint.name}</span> —
            เริ่มขั้นนี้ไม่ได้จนกว่างานจากร้านจะกลับมาและผ่านขั้นก่อนหน้าครบ
          </p>
        </div>
      ) : null}

      <Lane
        title="สายร้านนอก · ส่งออกไปทำข้างนอก"
        operations={outsourced}
        selectedId={selectedId}
        onSelect={onSelect}
        outsource
      />
    </div>
  );
}
