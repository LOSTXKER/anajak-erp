"use client";

/**
 * C · ไทม์ไลน์ — ใบผลิตคือเรื่องเล่าตามเวลา: ผ่านมาแล้ว → ตอนนี้ (ขยาย) → ถัดไป
 * แต่ละขั้นเป็นการ์ดบนเส้นเวลา มีวันที่แผน/จริงคู่กัน · ประวัติการลงมือทุกครั้งอยู่ท้ายหน้า
 * วิธีคิด: "มาตรฐาน" = ทุกการลงมือถูกบันทึกเป็นเหตุการณ์ ย้อนดูได้ว่าใครทำอะไรเมื่อไร
 */

import { useState } from "react";
import { CheckCircle2, Circle, History } from "lucide-react";
import { Section } from "@/components/ui/section";
import { InfoChip } from "@/components/ui/info-chip";
import { cn } from "@/lib/utils";
import { EVENTS, STEPS, STEP_TONE, currentStep, type WorkStep } from "../_data";
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

function TimelineStep({ step, open, onToggle, touch }: { step: WorkStep; open: boolean; onToggle: () => void; touch: boolean }) {
  const tone = STEP_TONE[step.state];
  return (
    <li className="relative pl-10">
      {/* จุดบนเส้นเวลา */}
      <span
        aria-hidden
        className={cn(
          "absolute left-2.5 top-4 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-bg",
          step.state === "done" ? "bg-green-600 text-white" : cn(tone.bar, step.state === "todo" ? "text-muted" : "text-white"),
        )}
      >
        {step.state === "done" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-2 w-2 fill-current" />}
      </span>
      <div className={cn("card-surface rounded-2xl", open ? "p-5" : "p-4", step.problem && "ring-1 ring-inset ring-red-600/40 dark:ring-red-400/40")}>
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-left">
          <span className="min-w-0 flex-1">
            <span className={cn("block", open ? "text-base font-semibold text-strong" : "text-sm font-medium text-strong")}>
              {step.order}. {step.label}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              <InfoChip size="sm">แผน {step.planEnd}</InfoChip>
              {step.completedAt ? (
                <InfoChip size="sm" tone="success">เสร็จจริง {step.completedAt}</InfoChip>
              ) : step.startedAt ? (
                <InfoChip size="sm" tone="info">เริ่ม {step.startedAt}</InfoChip>
              ) : null}
            </span>
          </span>
          <StepStateChip step={step} size={open ? "md" : "sm"} />
          <StepQty step={step} size={open ? "md" : "sm"} />
          <OwnerText step={step} />
        </button>
        {open ? (
          <div className="mt-4 space-y-4 border-t border-divider pt-4">
            {step.problem ? <ProblemCard step={step} /> : null}
            {step.outsource ? <OutsourceFacts step={step} /> : null}
            {step.note ? <p className="text-sm text-secondary">{step.note}</p> : null}
            <StepWorkZone step={step} touch={touch} />
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function TimelineVariant({ touch }: { touch: boolean }) {
  const [openId, setOpenId] = useState<string>(() => currentStep(STEPS).id);
  return (
    <div className="space-y-6">
      <WorkOrderHeader steps={STEPS} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]">
        <div>
          <ol className="relative space-y-3 before:absolute before:bottom-4 before:left-5 before:top-4 before:w-px before:bg-border">
            {STEPS.map((step) => (
              <TimelineStep key={step.id} step={step} open={openId === step.id} onToggle={() => setOpenId(openId === step.id ? "" : step.id)} touch={touch} />
            ))}
          </ol>
        </div>
        <div className="space-y-5">
          <WhatToMake compact />
          <WorkOrderFacts />
          <Section title="ประวัติการลงมือ" icon={History} tone="system" meta={`${EVENTS.length} รายการ`}>
            <ol className="space-y-3">
              {EVENTS.map((event) => (
                <li key={event.at + event.what} className="flex gap-3 text-sm">
                  <span className="w-24 shrink-0 text-xs tabular-nums text-muted">{event.at}</span>
                  <span className="min-w-0">
                    <span className="block text-strong">{event.what}</span>
                    <InfoChip size="sm" tone={event.tone === "danger" ? "error" : event.tone === "success" ? "success" : "neutral"} className="mt-1">
                      {event.who}
                    </InfoChip>
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}
