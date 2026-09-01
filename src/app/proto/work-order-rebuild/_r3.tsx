"use client";

/* ============================================================
   D · ต่อยอดจาก R3 — ผังสายพานคู่เป็นตัวหลัก แผงลงมือขัดแล้ว

   เบสตอบ (2026-09-02): "ฉันว่า ต่อยอดจาก R3 ดีกว่า" (R3 = สายพานคู่ใน /proto/work-order-control
   ที่เบสเคาะไว้ 2026-09-01 แล้วลงของจริงไปแล้ว)

   สิ่งที่ "ต่อยอด" จากของจริงตอนนี้:
   ① การ์ดในผังกลับไปเป็นแบบ R3 ต้นฉบับ — มีแถบความคืบหน้า ปัญหา และคำใบ้ว่าทำอะไรต่อ
      (ของจริงตอนนี้ย่อเหลือชื่อ+สถานะ) และ**ผังคือรายการเดียวของขั้น** — ตัดรายการขั้นที่ซ้ำใต้ผังทิ้ง
   ② แผงขวาเป็นแผงลงมือแบบ B+ (หัวขั้น · โซนลงมือ · แท็บ จำนวน/ปัญหา/ประวัติ ของขั้นนั้น)
      และเกาะจอตอนเลื่อน
   ③ ตัวเลข 4 ช่อง (กำหนดส่ง · ปัญหาค้าง · ผ่านแล้ว · จำนวน) อยู่แถวเดียวใต้หัว แทนการ์ด 5 ช่องเดิม
   ④ ข้อมูลอ้างอิงกับประวัติทั้งใบเป็นสองกล่องเล็กใต้ผัง — ไม่มีกองท้ายหน้า

   สีตามกติกาเว็บ: จุดสถานะชุดเดียวกับผังของจริง · น้ำเงินเฉพาะการ์ดที่เลือกและคำใบ้ลงมือ ·
   แดงเฉพาะปัญหาจริง
   ============================================================ */

import { useState } from "react";
import { History, Lock, Route, Truck } from "lucide-react";

import { Section } from "@/components/ui/section";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

import {
  STATE_META,
  doneCount,
  linesOf,
  type DensityOperation,
  type DensityWorkOrder,
} from "../work-order-density/_data";
import {
  BlockingBar,
  EventList,
  Freshness,
  ReferenceRows,
  StateDot,
  firstActionable,
  primaryOf,
} from "./_shared";
import { ActionZone, FactCells, FocusHeader, GroupLabel, StepTabs } from "./_station-polished";

/* ───────────────────────────── การ์ดสถานีแบบ R3 ต้นฉบับ (ย้ายมาใช้ข้อมูลชุดนี้) */

function StationCard({
  workOrder,
  step,
  selected,
  onSelect,
}: {
  workOrder: DensityWorkOrder;
  step: DensityOperation;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const lines = linesOf(workOrder, step.id);
  const planned = lines.reduce((sum, line) => sum + line.planned, 0);
  const good = lines.reduce((sum, line) => sum + line.good, 0);
  const percent = planned > 0 ? Math.round((good / planned) * 100) : null;
  const action = primaryOf(workOrder, step);

  return (
    <button
      type="button"
      onClick={() => onSelect(step.id)}
      aria-pressed={selected}
      aria-label={`${step.name} · ${STATE_META[step.state].label} · กดเพื่อเปิดในแผงลงมือ`}
      className={cn(
        "card-surface card-surface-hover w-56 shrink-0 rounded-xl p-3 text-left transition-shadow",
        FOCUS_BUTTON,
        selected && "ring-2 ring-blue-600 dark:ring-blue-400",
        !selected && step.blockers.length > 0 && "ring-1 ring-red-500/40",
        step.state === "PLANNED" && !selected && "opacity-70",
      )}
    >
      <span className="flex items-start gap-2">
        <StateDot state={step.state} className="mt-1" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-strong">{step.name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span>{STATE_META[step.state].label}</span>
            {step.outsourced ? (
              <span className="inline-flex items-center gap-1 text-secondary">
                <Truck className="h-3 w-3" aria-hidden="true" />
                ร้านนอก
              </span>
            ) : null}
            {step.assignee ? <span>· {step.assignee}</span> : null}
          </span>
        </span>
      </span>

      {percent !== null ? (
        <span className="mt-2 block">
          <span className="flex items-center justify-between text-xs tabular-nums text-muted">
            <span>
              {good}/{planned}
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

      {step.blockers.map((blocker) => (
        <span key={blocker} className="mt-2 block text-xs font-medium text-red-700 dark:text-red-300">
          {blocker}
        </span>
      ))}

      {action ? (
        <span className="mt-2 block text-xs font-medium text-blue-700 dark:text-blue-300">
          {action.label} →
        </span>
      ) : null}
    </button>
  );
}

/* ───────────────────────────── ผังสายพานคู่ (R3) */

function TwoLaneFlow({
  workOrder,
  selectedId,
  onSelect,
}: {
  workOrder: DensityWorkOrder;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const inHouse = workOrder.operations.filter((step) => !step.outsourced);
  const outsourced = workOrder.operations.filter((step) => step.outsourced);
  const outsourcedNames = new Set(outsourced.map((step) => step.name));
  const merge = inHouse.find((step) => step.waitsFor.some((name) => outsourcedNames.has(name)));

  const lane = (title: string, subtitle: string, steps: DensityOperation[], outsource: boolean) => (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <p className={cn("flex items-center gap-1.5 text-xs font-medium", outsource ? "text-secondary" : "text-module-production-text")}>
          {outsource ? <Truck className="h-3.5 w-3.5" aria-hidden="true" /> : null}
          {title}
        </p>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max items-center gap-1.5">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-1.5">
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1 w-4 shrink-0 rounded-full",
                    steps[index - 1]!.state === "COMPLETED" ? "bg-green-600/60 dark:bg-green-400/50" : "bg-divider",
                  )}
                />
              ) : null}
              <StationCard workOrder={workOrder} step={step} selected={selectedId === step.id} onSelect={onSelect} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {lane("สายเรา", "ทำในโรงงาน", inHouse, false)}
      {merge && outsourced.length > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2">
          <span aria-hidden="true" className="text-base text-muted">
            ⤵
          </span>
          <p className="text-xs text-secondary">
            สองสายมาบรรจบที่ <span className="font-medium text-strong">{merge.name}</span> —
            เริ่มขั้นนี้ไม่ได้จนกว่างานจากร้านจะกลับมาและผ่านขั้นก่อนหน้าครบ
          </p>
        </div>
      ) : null}
      {outsourced.length > 0 ? lane("สายร้านนอก", "ส่งออกไปทำข้างนอก", outsourced, true) : null}
      <p className="text-xs text-muted">
        กดการ์ดเพื่อเปิดขั้นนั้นในแผงลงมือทางขวา · จุดสี: เขียว = ผ่านแล้ว · ส้ม = กำลังทำ · น้ำเงิน = พร้อมทำ ·
        แดง = ติดปัญหา · เทา = ยังไม่ถึงคิว
      </p>
    </div>
  );
}

/* ───────────────────────────────────────────────────── ทั้งหน้า */

export function R3Variant({ workOrder }: { workOrder: DensityWorkOrder }) {
  const [id, setId] = useState<string | null>(firstActionable(workOrder)?.id ?? null);
  const step = workOrder.operations.find((item) => item.id === id) ?? null;
  const done = doneCount(workOrder);

  return (
    <div className="space-y-4">
      <BlockingBar workOrder={workOrder} />

      <Section>
        <FactCells workOrder={workOrder} columns={4} />
      </Section>

      {/* min-w-0 ที่คอลัมน์ซ้ายจำเป็น — ไม่งั้นการ์ดในผัง (min-w-max) ดันคอลัมน์กว้างจนหน้าล้นแนวนอนบนจอแคบ
          (grid item ที่ไม่ใช่ scroll container มี min-width:auto = ความกว้างเนื้อหา · เจอตอนเปิดดูเอง 2026-09-02) */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          <Section
            title="เส้นทางการผลิต"
            icon={Route}
            tone="production"
            meta={`สองสายเดินขนาน แล้วมาบรรจบ · ผ่านแล้ว ${done}/${workOrder.operations.length} ขั้น`}
            action={<Freshness />}
          >
            <TwoLaneFlow workOrder={workOrder} selectedId={id} onSelect={setId} />
          </Section>

          <div className="grid items-start gap-4 md:grid-cols-2">
            <Section title="ข้อมูลอ้างอิงที่ล็อกไว้" icon={Lock} tone="system" compact>
              <ReferenceRows workOrder={workOrder} dense />
            </Section>
            <Section title="ประวัติทั้งใบ" icon={History} tone="system" compact>
              <EventList events={workOrder.events} limit={5} dense />
            </Section>
          </div>
        </div>

        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          {step ? (
            <Section>
              <div className="space-y-5">
                <FocusHeader step={step} />
                <ActionZone workOrder={workOrder} step={step} />
                <StepTabs workOrder={workOrder} step={step} />
              </div>
            </Section>
          ) : (
            <Section title="ลงมือทำ" icon={Route} tone="production">
              <p className="text-sm text-secondary">กดการ์ดในผังเพื่อเปิดงานนั้นที่นี่</p>
            </Section>
          )}
        </div>
      </div>
      {/* GroupLabel ถูก export ไว้ให้แบบอื่นใช้ — แบบนี้ยังไม่ใช้ */}
      {false ? <GroupLabel icon={History}>–</GroupLabel> : null}
    </div>
  );
}
