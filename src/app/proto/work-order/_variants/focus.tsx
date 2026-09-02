"use client";

/**
 * B · ตอนนี้ทำอะไร — ใบผลิตเปิดมาแล้ว "ขั้นที่ต้องทำตอนนี้" เป็นผืนใหญ่บนสุด (ข้อกำหนด + ปุ่มเดียว)
 * ซ้าย = ลงมือ · ขวา = ภาพรวมย่อ (ขั้นทั้งหมดเป็นรายการสั้น กดสลับขั้นได้ · ทำอะไร · ข้อมูลใบ)
 * วิธีคิด: ช่างมาถึงใบนี้เพื่อ "ทำขั้นถัดไป" ไม่ใช่มาอ่าน — ภาพรวมอยู่ข้าง ๆ ไม่บังงาน
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { STEPS, STEP_TONE, currentStep, type WorkStep } from "../_data";
import {
  OutsourceFacts,
  OwnerText,
  ProblemCard,
  StepQty,
  StepStateChip,
  StepWorkZone,
  WhatToMake,
  WorkOrderFacts,
  WorkOrderHeader,
} from "../_pieces";
import { Section } from "@/components/ui/section";
import { Metric } from "@/components/ui/metric";

function StepList({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <ol className="divide-y divide-divider">
      {STEPS.map((step) => {
        const on = step.id === selected;
        return (
          <li key={step.id}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(step.id)}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-interactive-hover",
                on && "bg-interactive-selected",
              )}
            >
              <span aria-hidden className={cn("h-2.5 w-2.5 shrink-0 rounded-full", STEP_TONE[step.state].bar)} />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm", on ? "font-semibold text-strong" : "text-secondary")}>
                  {step.order}. {step.label}
                </span>
                <span className="block text-xs text-muted">
                  {STEP_TONE[step.state].label}
                  {step.owner ? ` · ${step.owner}` : ""}
                </span>
              </span>
              <StepQty step={step} />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function CurrentPanel({ step, touch }: { step: WorkStep; touch: boolean }) {
  return (
    <Section
      title={`ขั้น ${step.order} · ${step.label}`}
      meta={<StepStateChip step={step} size="md" />}
      action={<OwnerText step={step} />}
      icon={undefined}
      tone="production"
    >
      <div className="space-y-5">
        {step.problem ? <ProblemCard step={step} /> : null}
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <Metric label="ทำแล้ว" value={step.qtyDone.toLocaleString("th-TH")} unit={`/ ${step.qtyTotal.toLocaleString("th-TH")} ตัว`} size="lg" tone={step.qtyDone >= step.qtyTotal ? "success" : "default"} />
          <Metric label="ควรเสร็จ" value={step.planEnd} size="md" />
          {step.startedAt ? <Metric label="เริ่มเมื่อ" value={step.startedAt} size="md" tone="muted" /> : null}
        </div>
        {step.outsource ? <OutsourceFacts step={step} /> : null}
        {step.note ? <p className="text-sm text-secondary">{step.note}</p> : null}
        <StepWorkZone step={step} touch={touch} />
      </div>
    </Section>
  );
}

export function FocusVariant({ touch }: { touch: boolean }) {
  const [selected, setSelected] = useState<string>(() => currentStep(STEPS).id);
  const step = STEPS.find((s) => s.id === selected) ?? STEPS[0]!;
  return (
    <div className="space-y-6">
      <WorkOrderHeader steps={STEPS} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(20rem,1fr)]">
        <div className="space-y-5">
          <CurrentPanel step={step} touch={touch} />
          <WhatToMake compact />
        </div>
        <div className="space-y-5">
          <Section title="ขั้นงานทั้งหมด" meta={`${STEPS.filter((s) => s.state === "done").length}/${STEPS.length} ผ่านแล้ว`} flush>
            <StepList selected={selected} onSelect={setSelected} />
          </Section>
          <WorkOrderFacts />
        </div>
      </div>
    </div>
  );
}
