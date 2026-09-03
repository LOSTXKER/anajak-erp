"use client";

/**
 * ชิ้นส่วนที่กำลังเทียบในหน้าลอง "จัดโมดูลผลิตของหัวหน้าใหม่" — ตารางขั้นงานที่กางแถวแล้ว "ลงมือ + แก้ให้" ได้ในแถวนั้นเลย
 * ของที่ไม่ได้เทียบ (ชิป ตัวเลข ป้าย ตาราง โซนลงมือ ปุ่ม) = component ตัวจริง
 * ข้อมูล: ใบตัวอย่างเดิม ORD-2608-0061 (7 ขั้น ครบทุกสถานะ) + สถานีของขั้นจากหน้าลอง desk-station
 */

import { Fragment } from "react";
import { AlertTriangle, CalendarCheck, CheckCircle2, ChevronDown, Wrench } from "lucide-react";
import { STATION_ICON } from "@/components/station/station-pieces";
import { ActionZone } from "@/components/ui/action-zone";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { SUNK_PANEL } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { stationOf, whereabouts } from "../desk-station/_data";
import { type WorkStep } from "../work-order/_data";
import { OutsourceFacts, ProblemCard, StepQty, StepStateChip } from "../work-order/_pieces";

/* ───────────────────────── โซนลงมือ + แก้ให้ (ในแถว) ───────────────────────── */

/** ข้อกำหนดติ๊กครบ → ปุ่มหลักปุ่มเดียว · แจ้งปัญหา · หัวหน้ามี "แก้ให้" — ชุดเดียวกับใบผลิตจริงหลังโครงใหม่ */
export function StepActZone({ step, boss, compact = false }: { step: WorkStep; boss: boolean; compact?: boolean }) {
  const doneCount = step.checklist.filter((c) => c.done).length;
  const allDone = doneCount === step.checklist.length;
  const locked = step.state === "done";
  const stuck = step.state === "blocked";
  const note = locked
    ? `ปิดขั้นแล้ว ${step.completedAt} · โดย ${step.owner}`
    : step.state === "waiting"
      ? `รอของกลับจากร้าน ${step.outsource?.backLabel} — ตรวจรับได้เมื่อของมาถึง`
      : stuck
        ? boss
          ? "ติดปัญหาอยู่ — กด “แก้ให้” เพื่อปลดให้ช่างทำต่อ"
          : "แก้ปัญหาก่อน จึงลงมือขั้นนี้ต่อได้"
        : !allDone
          ? "ติ๊กข้อกำหนดให้ครบก่อนปิดขั้น"
          : undefined;
  return (
    <div className="space-y-3">
      <div>
        <p className="flex items-center justify-between text-xs font-medium text-muted">
          <span>ข้อกำหนดมาตรฐานของขั้นนี้</span>
          <span className="tabular-nums">
            {doneCount}/{step.checklist.length}
          </span>
        </p>
        <ul className="mt-1.5 space-y-1">
          {step.checklist.map((c) => (
            <li key={c.label} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", c.done ? "text-green-600 dark:text-green-400" : "text-muted")} aria-hidden="true" />
              <span className={c.done ? "text-secondary" : "text-strong"}>{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* ในแผงข้างแคบ — คำอธิบายอยู่บน ปุ่มเรียงล่าง (ท่าเดียวกับจอทัช) */}
      <ActionZone note={note} touch={compact}>
        {locked ? (
          <Button variant="outline" disabled>
            ผ่านแล้ว
          </Button>
        ) : (
          <Button disabled={stuck || step.state === "waiting"}>{step.action}</Button>
        )}
        {!locked ? (
          <Button variant="outline">
            <AlertTriangle /> แจ้งปัญหา
          </Button>
        ) : null}
        {boss && !locked ? (
          <Button variant="outline">
            <Wrench /> แก้ให้
          </Button>
        ) : null}
      </ActionZone>
    </div>
  );
}

/** เนื้อในของแถวที่กาง — ซ้าย ข้อเท็จจริง/ปัญหา/ร้านนอก · ขวา โซนลงมือ */
export function StepRowDetail({ step, boss, compact = false }: { step: WorkStep; boss: boolean; compact?: boolean }) {
  const w = whereabouts(step);
  return (
    <div className={cn("grid gap-5", !compact && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]")}>
      <div className="space-y-4">
        {step.problem ? <ProblemCard step={step} /> : null}
        <FactList columns={3}>
          <div>
            <Metric label="ทำแล้ว" value={step.qtyDone.toLocaleString("th-TH")} unit={`/ ${step.qtyTotal.toLocaleString("th-TH")} ตัว`} size="md" tone={step.qtyDone >= step.qtyTotal ? "success" : "default"} />
          </div>
          <Fact icon={CalendarCheck} label="ควรเสร็จ" value={step.planEnd} size="sm" />
          <Fact label={step.completedAt ? "เสร็จจริง" : "เริ่มเมื่อ"} value={step.completedAt ?? step.startedAt ?? "ยังไม่เริ่ม"} tone={step.startedAt ? "default" : "muted"} size="sm" />
        </FactList>
        {step.outsource ? <OutsourceFacts step={step} /> : null}
        {!step.problem && !step.outsource ? <p className="text-sm text-secondary">{w.headline}</p> : null}
        {step.note ? <p className="text-sm text-secondary">{step.note}</p> : null}
      </div>
      <StepActZone step={step} boss={boss} compact={compact} />
    </div>
  );
}

/* ───────────────────────── ตารางขั้นงาน กางใต้แถว ───────────────────────── */

export function StepsTable({
  steps,
  selected,
  onSelect,
  boss,
  compact = false,
}: {
  steps: WorkStep[];
  selected: string | null;
  onSelect: (id: string) => void;
  boss: boolean;
  /** ในแผงข้าง — ตัดคอลัมน์ ควรเสร็จ/ตอนนี้อยู่ไหน */
  compact?: boolean;
}) {
  const cols = compact ? 4 : 7;
  return (
    <DataTable.Root className={cn("min-w-0 max-w-full", compact ? "[&_td]:px-2 [&_th:not([aria-sort])]:px-2" : "[&_td]:px-3 [&_th:not([aria-sort])]:px-3")}>
      <DataTable.Head>
        <tr>
          <DataTable.Th>ขั้น</DataTable.Th>
          <DataTable.Th>สถานี</DataTable.Th>
          {!compact ? <DataTable.Th>คนทำ</DataTable.Th> : null}
          <DataTable.Th align="right">ยอด</DataTable.Th>
          {!compact ? <DataTable.Th>ควรเสร็จ</DataTable.Th> : null}
          {!compact ? <DataTable.Th>ตอนนี้อยู่ไหน</DataTable.Th> : null}
          <DataTable.Th align="right">
            <span className="sr-only">กางรายละเอียด</span>
          </DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body>
        {steps.map((step) => {
          const open = step.id === selected;
          const st = stationOf(step);
          const w = whereabouts(step);
          return (
            <Fragment key={step.id}>
              <DataTable.Row
                onClick={() => onSelect(step.id)}
                aria-expanded={open}
                className={cn("cursor-pointer", open && "bg-interactive-selected", step.state === "blocked" && !open && "bg-red-50/40 dark:bg-red-950/15")}
              >
                <DataTable.Td>
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-medium tabular-nums text-muted">{step.order}</span>
                    <div className="min-w-0">
                      <p className={cn("truncate", open ? "font-semibold text-strong" : "font-medium text-strong")}>{step.label}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <StepStateChip step={step} />
                        {compact ? <span className="text-xs text-secondary">{step.owner ?? "ยังไม่มีคนรับ"}</span> : null}
                      </div>
                    </div>
                  </div>
                </DataTable.Td>
                <DataTable.Td className="whitespace-nowrap">
                  <InfoChip size="sm" icon={STATION_ICON[st.key] ?? Wrench}>
                    {st.label}
                  </InfoChip>
                </DataTable.Td>
                {!compact ? (
                  <DataTable.Td className="whitespace-nowrap">{step.owner ? <span className="text-strong">{step.owner}</span> : <span className="text-muted">ยังไม่มีคนรับ</span>}</DataTable.Td>
                ) : null}
                <DataTable.Td align="right" className="whitespace-nowrap">
                  <StepQty step={step} />
                </DataTable.Td>
                {!compact ? (
                  <DataTable.Td className="whitespace-nowrap">
                    <InfoChip size="sm" tone={step.state === "blocked" ? "warning" : "neutral"}>
                      {step.planEnd}
                    </InfoChip>
                  </DataTable.Td>
                ) : null}
                {!compact ? (
                  <DataTable.Td className="max-w-72">
                    <p className={cn("truncate text-sm", w.tone === "error" ? "font-medium text-red-700 dark:text-red-300" : "text-secondary")}>{w.headline}</p>
                  </DataTable.Td>
                ) : null}
                <DataTable.Td align="right">
                  <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", open ? "rotate-180 text-strong" : "text-muted")} aria-hidden="true" />
                </DataTable.Td>
              </DataTable.Row>
              {open ? (
                <tr className={SUNK_PANEL}>
                  <td colSpan={cols} className={compact ? "px-3 py-4" : "px-4 py-5 sm:px-6"}>
                    <StepRowDetail step={step} boss={boss} compact={compact} />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </DataTable.Body>
    </DataTable.Root>
  );
}
