"use client";

import { useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Circle, Clock3, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FOCUS_BUTTON, INTERACTIVE_SELECTED, RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { defaultFocus, nowSteps, pendingOf, type LeanStep } from "../work-order-lean/_data";
import { OrderHeader, ReferencePanel, StepBody, StepStatus, type DeskProps } from "./_shared";

/** This is inspection navigation. Only the existing step action can record work. */
export function WizardC({ order, boss, idPrefix }: DeskProps) {
  const steps = order.steps;
  const [selectedId, setSelectedId] = useState(() => steps.length ? defaultFocus(steps).id : null);
  const panelRef = useRef<HTMLElement>(null);
  const selected = steps.find((step) => step.id === selectedId) ?? steps[0];
  const index = selected ? steps.indexOf(selected) : -1;
  const current = nowSteps(steps);
  const otherWork = current.filter((step) => step.id !== selected?.id);
  const pending = selected ? pendingOf(selected, steps) : [];
  const panelId = `${idPrefix}-wizard-panel`;
  const titleId = `${idPrefix}-wizard-title`;

  function selectStep(id: string, scrollToPanel = false) {
    setSelectedId(id);
    if (scrollToPanel) requestAnimationFrame(() => panelRef.current?.scrollIntoView({ block: "start" }));
  }

  return <article className="space-y-5">
    <OrderHeader order={order} />
    {selected ? <>
      <nav aria-label="เลือกขั้นงานที่ต้องการดู">
        <div className="hidden gap-2 @5xl:grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((step) => <button key={step.id} type="button" aria-pressed={selected.id === step.id} aria-controls={panelId}
            onClick={() => selectStep(step.id)}
            className={cn(FOCUS_BUTTON, RADIUS.item, "flex min-h-16 min-w-0 items-start gap-2 border p-3 text-left transition-colors", selected.id === step.id ? cn(INTERACTIVE_SELECTED, "border-border") : "border-transparent text-secondary hover:bg-interactive-hover")}>
            <StepMark step={step} />
            <span className="min-w-0"><span className="block text-sm font-medium">{step.short}</span><span className="mt-1 block text-xs text-secondary">{navigationState(step)}</span></span>
          </button>)}
        </div>
        <div className="flex items-center gap-3 @5xl:hidden">
          <span className="shrink-0 text-sm text-secondary">ดูขั้น</span>
          <Select value={selected.id} onChange={(event) => selectStep(event.target.value)} className="min-h-11 min-w-0 flex-1" aria-label="ขั้นงานที่ต้องการดู">
            {steps.map((step, i) => <option key={step.id} value={step.id}>{i + 1}. {step.short} — {navigationState(step)}</option>)}
          </Select>
        </div>
      </nav>

      {otherWork.length > 0 ? <section className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-divider pb-4" aria-label="งานสายอื่นที่ยังเดินอยู่">
        <h2 className="text-xs font-medium text-secondary">สายอื่นในใบนี้</h2>
        <div className="flex flex-wrap gap-2">{otherWork.map((step) => <Button key={step.id} variant="ghost" className="min-h-11 gap-2" onClick={() => selectStep(step.id)} aria-label={`ดู ${step.short} ${navigationState(step)}`}>
          <StepMark step={step} /><span>{step.short}</span><span className="text-xs text-secondary">{navigationState(step)}</span>
        </Button>)}</div>
      </section> : null}

      <div className="grid items-start gap-6 @5xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section ref={panelRef} id={panelId} aria-labelledby={titleId} className="min-w-0 scroll-mt-5 space-y-5">
          <header className="space-y-3">
            <div className="flex items-center justify-between gap-3"><p className="text-sm text-secondary">กำลังดูขั้น {index + 1} จาก {steps.length}</p><StepStatus step={selected} /></div>
            <h2 id={titleId} aria-live="polite" className="text-xl font-semibold text-strong @lg:text-2xl">{selected.label}</h2>
          </header>
          {selected.state === "active" && pending.length > 0 ? <div className="space-y-1 border-b border-divider pb-4">
            <p className="text-sm font-medium text-strong">ทำส่วนที่พร้อมได้ ยังรอ {pending.map((step) => step.short).join(" + ")}</p>
            <p className="text-sm text-secondary">{order.garment}</p>
          </div> : null}
          <StepBody key={selected.id} step={selected.mode === "paper" && selected.state !== "done" ? { ...selected, startedAt: null, completedAt: null } : selected} order={order} boss={boss} primary />
          <nav className="flex items-center justify-between gap-3 border-t border-divider pt-4" aria-label="เปลี่ยนขั้นที่ดู">
            {index > 0 ? <Button variant="outline" className="min-h-11" onClick={() => selectStep(steps[index - 1]!.id, true)}><ArrowLeft />ดูขั้นก่อน</Button> : <span className="text-sm text-secondary">ขั้นแรกของใบ</span>}
            {index < steps.length - 1 ? <Button variant="outline" className="min-h-11" onClick={() => selectStep(steps[index + 1]!.id, true)}>ดูขั้นถัดไป<ArrowRight /></Button> : <span className="text-sm text-secondary">ขั้นสุดท้ายของใบ</span>}
          </nav>
        </section>
        <ReferencePanel order={order} />
      </div>
    </> : <div className="grid items-start gap-6 @5xl:grid-cols-[minmax(0,1fr)_20rem]"><p className="py-10 text-sm text-secondary">ยังไม่มีขั้นงานในใบผลิตนี้</p><ReferencePanel order={order} /></div>}
  </article>;
}

function navigationState(step: LeanStep) {
  if (step.state === "done") return "ผ่านแล้ว";
  if (step.state === "blocked") return "ติดปัญหา";
  if (step.state === "waiting") return step.outsource && step.outsource.backInDays < 0 ? `เลยนัด ${-step.outsource.backInDays} วัน` : "อยู่ที่ร้าน";
  if (step.state === "active") return "กำลังทำ";
  return "รอขั้นก่อนหน้า";
}

function StepMark({ step }: { step: LeanStep }) {
  const Icon = step.state === "done" ? Check : step.state === "blocked" ? AlertTriangle : step.state === "waiting" ? Truck : step.state === "todo" ? Clock3 : Circle;
  return <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", step.state === "blocked" ? "text-red-700 dark:text-red-300" : step.state === "done" ? "text-green-700 dark:text-green-400" : "text-secondary")} />;
}
