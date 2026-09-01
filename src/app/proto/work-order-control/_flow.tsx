"use client";

/* ============================================================
   "เส้นทางการผลิต" ที่รู้สึกเป็นเส้นทางจริง ๆ (เบสสั่ง 2026-09-01)

   คำต่อคำ: *"อยากได้เป็น flow หน่อย เพราะมันคือเส้นทางการผลิต แต่ไม่รู้สึกถึงเส้นทาง
   หรือขั้นตอนเลย ทำ UI ให้มันสร้างสรรค์ได้มั้ย เหมือนทางรถไฟอะไรงี้"*

   รูปร่างของเส้นทางไม่ได้วาดมั่ว — คำนวณจากเงื่อนไข "ต้องเสร็จก่อน" ของสูตรจริง
   ระดับของขั้น = ยาวสุดจากจุดเริ่มต้น → ขั้นที่ระดับเดียวกันคือขั้นที่เดินขนานกันได้
   สูตรมาตรฐานจึงออกมาเป็น 6 ช่วง: เริ่มพร้อมกัน 4 ขั้น → ร้านนอก → ตรวจของกลับ →
   รีดร้อน (จุดบรรจบ) → ตรวจท้าย → แพ็ก
   ============================================================ */

import { Truck } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  PROTO_WORK_ORDER,
  STATE_LABELS,
  primaryAction,
  quantityTotals,
  type ProtoOperation,
} from "./_data";

/** ระดับของแต่ละขั้น — ขั้นที่ระดับเดียวกัน = เดินขนานกันได้ */
export function operationLevels() {
  const byCode = new Map(PROTO_WORK_ORDER.operations.map((item) => [item.code, item]));
  const level = new Map<string, number>();

  function resolve(code: string): number {
    const cached = level.get(code);
    if (cached !== undefined) return cached;
    const operation = byCode.get(code);
    if (!operation || operation.waitsFor.length === 0) {
      level.set(code, 0);
      return 0;
    }
    const value = Math.max(...operation.waitsFor.map(resolve)) + 1;
    level.set(code, value);
    return value;
  }

  for (const operation of PROTO_WORK_ORDER.operations) resolve(operation.code);

  const groups: ProtoOperation[][] = [];
  for (const operation of PROTO_WORK_ORDER.operations) {
    const index = level.get(operation.code) ?? 0;
    groups[index] = [...(groups[index] ?? []), operation];
  }
  return groups.filter(Boolean);
}

/** สีของจุดสถานี — เหมือนไฟบนราง: ผ่านแล้ว · ขบวนอยู่ตรงนี้ · พร้อมเข้า · ยังไม่ถึง */
function dotClass(operation: ProtoOperation) {
  switch (operation.state) {
    case "COMPLETED":
      return "bg-green-600 dark:bg-green-400";
    case "RUNNING":
      return "bg-amber-500 ring-4 ring-amber-500/25";
    case "PAUSED":
      return "bg-amber-500/60";
    case "READY":
      return "bg-blue-600 dark:bg-blue-400";
    default:
      return "bg-border";
  }
}

function railClass(done: boolean) {
  return done ? "bg-green-600/60 dark:bg-green-400/50" : "bg-divider";
}

/* ------------------------------------------------- R1 · รางแนวตั้ง */

export function VerticalRail({
  onSelect,
  selectedId,
}: {
  onSelect?: (operation: ProtoOperation) => void;
  selectedId?: string | null;
}) {
  const groups = operationLevels();

  return (
    <ol className="space-y-0">
      {groups.map((group, groupIndex) => {
        const isLast = groupIndex === groups.length - 1;
        const groupDone = group.every((operation) => operation.state === "COMPLETED");
        const parallel = group.length > 1;

        return (
          <li key={groupIndex} className="relative">
            <div className="flex gap-3">
              {/* รางหลัก — เส้นตั้งที่ทุกช่วงร้อยอยู่ */}
              <div className="relative flex w-6 shrink-0 flex-col items-center">
                <span
                  aria-hidden="true"
                  className={cn("h-3 w-1 rounded-full", railClass(groupIndex === 0 || groupDone))}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-3.5 w-3.5 rounded-full transition-transform",
                    groupDone ? "bg-green-600 dark:bg-green-400" : "bg-surface ring-2 ring-divider",
                  )}
                />
                {!isLast ? (
                  <span
                    aria-hidden="true"
                    className={cn("w-1 flex-1 rounded-full", railClass(groupDone))}
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1 pb-4">
                {parallel ? (
                  <p className="mb-1.5 text-2xs font-medium uppercase tracking-wide text-muted">
                    เดินพร้อมกันได้ {group.length} ขั้น
                  </p>
                ) : null}
                <div className={cn("grid gap-2", parallel && "sm:grid-cols-2")}>
                  {group.map((operation) => (
                    <StationCard
                      key={operation.id}
                      operation={operation}
                      selected={selectedId === operation.id}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** การ์ดสถานีหนึ่งจุด — ใช้ทั้งรางตั้งและผังนอน */
function StationCard({
  operation,
  selected,
  onSelect,
  compact = false,
}: {
  operation: ProtoOperation;
  selected?: boolean;
  onSelect?: (operation: ProtoOperation) => void;
  compact?: boolean;
}) {
  const totals = quantityTotals(operation);
  const action = primaryAction(operation);
  const percent =
    totals.planned > 0 ? Math.round((totals.good / totals.planned) * 100) : null;

  return (
    <button
      type="button"
      onClick={onSelect ? () => onSelect(operation) : undefined}
      disabled={!onSelect}
      className={cn(
        "card-surface rounded-xl p-3 text-left transition-shadow",
        onSelect && "card-surface-hover",
        selected && "ring-2 ring-blue-600 dark:ring-blue-400",
        compact ? "w-56 shrink-0" : "w-full",
        operation.state === "PLANNED" && "opacity-70",
      )}
    >
      <span className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", dotClass(operation))}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium leading-snug text-strong">
            {operation.name}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-2xs text-muted">
            <span>{STATE_LABELS[operation.state]}</span>
            {operation.outsourced ? (
              <span className="inline-flex items-center gap-0.5 text-secondary">
                <Truck className="h-3 w-3" aria-hidden="true" />
                ร้านนอก
              </span>
            ) : null}
            {operation.assignee ? <span>· {operation.assignee}</span> : null}
          </span>
        </span>
      </span>

      {percent !== null ? (
        <span className="mt-2 block">
          <span className="flex items-center justify-between text-2xs tabular-nums text-muted">
            <span>
              {totals.good}/{totals.planned}
            </span>
            <span>{percent}%</span>
          </span>
          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-muted">
            <span
              className="block h-full rounded-full bg-blue-600 dark:bg-blue-400"
              style={{ width: `${percent}%` }}
            />
          </span>
        </span>
      ) : null}

      {operation.problem ? (
        <span className="mt-2 block text-2xs text-red-700 dark:text-red-300">
          {operation.problem}
        </span>
      ) : null}

      {action ? (
        <span className="mt-2 block text-2xs font-medium text-blue-700 dark:text-blue-300">
          {action} →
        </span>
      ) : null}
    </button>
  );
}

/* ---------------------------------------------- R2 · ผังแนวนอน */

export function HorizontalFlow({
  onSelect,
  selectedId,
}: {
  onSelect?: (operation: ProtoOperation) => void;
  selectedId?: string | null;
}) {
  const groups = operationLevels();

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-2">
      <div className="flex min-w-max items-start gap-2">
        {groups.map((group, groupIndex) => {
          const groupDone = group.every((operation) => operation.state === "COMPLETED");
          return (
            <div key={groupIndex} className="flex items-start gap-2">
              <div className="flex flex-col gap-2">
                {/* หัวช่วง — บอกว่าช่วงนี้เดินพร้อมกันกี่ขั้น */}
                <p className="text-2xs font-medium uppercase tracking-wide text-muted">
                  ช่วงที่ {groupIndex + 1}
                  {group.length > 1 ? ` · พร้อมกัน ${group.length}` : ""}
                </p>
                {group.map((operation) => (
                  <StationCard
                    key={operation.id}
                    operation={operation}
                    selected={selectedId === operation.id}
                    onSelect={onSelect}
                    compact
                  />
                ))}
              </div>
              {groupIndex < groups.length - 1 ? (
                /* ข้อต่อระหว่างช่วง — วางให้ตรงกลางการ์ดใบแรก ไม่ใช่กลางคอลัมน์
                   (คอลัมน์ที่มีหลายการ์ดจะสูงไม่เท่ากัน ลูกศรกลางคอลัมน์เลยลอยไม่ตรงกับอะไร) */
                <div className="flex w-7 shrink-0 flex-col items-center pt-14">
                  <span className="relative flex w-full items-center">
                    <span
                      aria-hidden="true"
                      className={cn("h-1 w-full rounded-full", railClass(groupDone))}
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute -right-1 text-xs leading-none",
                        groupDone ? "text-green-600 dark:text-green-400" : "text-divider",
                      )}
                    >
                      ▶
                    </span>
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------- R3 · สายพานคู่ (เรา / ร้านนอก) */

export function TwoLaneFlow({
  onSelect,
  selectedId,
}: {
  onSelect?: (operation: ProtoOperation) => void;
  selectedId?: string | null;
}) {
  const inHouse = PROTO_WORK_ORDER.operations.filter((operation) => !operation.outsourced);
  const outsourced = PROTO_WORK_ORDER.operations.filter((operation) => operation.outsourced);
  const merge = PROTO_WORK_ORDER.operations.find(
    (operation) => operation.code === "HEAT_PRESS",
  );

  const lane = (
    title: string,
    subtitle: string,
    operations: ProtoOperation[],
    tone: "in" | "out",
  ) => (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <p
          className={cn(
            "text-2xs font-medium uppercase tracking-wide",
            tone === "in" ? "text-module-production-text" : "text-secondary",
          )}
        >
          {title}
        </p>
        <p className="text-2xs text-muted">{subtitle}</p>
      </div>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max items-center gap-1.5">
          {operations.map((operation, index) => (
            <div key={operation.id} className="flex items-center gap-1.5">
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1 w-4 rounded-full",
                    railClass(operations[index - 1]!.state === "COMPLETED"),
                  )}
                />
              ) : null}
              <StationCard
                operation={operation}
                selected={selectedId === operation.id}
                onSelect={onSelect}
                compact
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {lane("สายเรา", "ทำในโรงงาน", inHouse, "in")}
      {/* จุดบรรจบ — บอกตรง ๆ ว่าสองสายมาเจอกันตรงไหน */}
      {merge ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2">
          <span aria-hidden="true" className="text-base text-muted">⤵</span>
          <p className="text-xs text-secondary">
            สองสายมาบรรจบที่ <span className="font-medium text-strong">{merge.name}</span> —
            เริ่มรีดไม่ได้จนกว่าของจากร้านจะกลับมาและผ่านตรวจ
          </p>
        </div>
      ) : null}
      {lane("สายร้านนอก", "ส่งออกไปทำข้างนอก", outsourced, "out")}
    </div>
  );
}

/** ปุ่มเล็กใต้ผัง — ใช้ในหน้าลองเพื่อบอกว่าคลิกการ์ดเพื่อเลือกขั้น */
export function FlowHint() {
  return (
    <p className="mt-2 text-2xs text-muted">
      กดการ์ดเพื่อเปิดขั้นนั้นในแผงลงมือทางขวา · จุดสี: เขียว = ผ่านแล้ว · ส้ม = กำลังทำ ·
      น้ำเงิน = พร้อมทำ · เทา = ยังไม่ถึงคิว
    </p>
  );
}
