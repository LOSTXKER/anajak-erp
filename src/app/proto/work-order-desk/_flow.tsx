"use client";

import { CheckCircle2, Circle, Truck } from "lucide-react";
import { nowSteps, type LeanStep } from "../work-order-lean/_data";
import { OrderHeader, ReferencePanel, StepBody, StepStatus, type DeskProps } from "./_shared";

/** The route is the work itself: one home for each step, with no separate map. */
export function FlowA({ order, boss, idPrefix }: DeskProps) {
  const active = nowSteps(order.steps);
  const primary = active[0]?.id;
  const groups: { title: string; steps: LeanStep[]; current: boolean }[] = [
    { title: active.length > 1 ? `กำลังเดินงาน ${active.length} สาย` : "งานที่ต้องดูตอนนี้", steps: active, current: true },
    { title: "ขั้นถัดไป", steps: order.steps.filter((s) => s.state === "todo"), current: false },
    { title: "ผ่านแล้ว", steps: order.steps.filter((s) => s.state === "done"), current: false },
  ];
  return <article className="space-y-6">
    <OrderHeader order={order} />
    <div className="grid items-start gap-7 @5xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-8">
        {groups.filter((group) => group.steps.length > 0).map((group) => <section key={group.title} aria-label={group.title}>
          <h2 className="mb-4 text-sm font-medium text-secondary">{group.title}</h2>
          <div className="divide-y divide-divider">{group.steps.map((step) => <article key={step.id} id={`${idPrefix}-${step.id}`} className="py-5 first:pt-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="flex items-center gap-3 font-semibold text-strong">
                {step.state === "done" ? <CheckCircle2 className="size-4 text-green-700 dark:text-green-400" aria-hidden="true" /> : step.outsource ? <Truck className="size-5 text-secondary" aria-hidden="true" /> : <Circle className="size-4 text-secondary" aria-hidden="true" />}
                {step.label}
              </h3>
              {step.state !== "done" ? <StepStatus step={step} /> : null}
            </div>
            <div className="mt-4"><StepBody step={step} order={order} boss={boss} primary={step.id === primary} /></div>
          </article>)}</div>
        </section>)}
        {order.steps.length === 0 ? <p className="py-10 text-sm text-secondary">ยังไม่มีขั้นงานในใบผลิตนี้</p> : null}
      </div>
      <ReferencePanel order={order} />
    </div>
  </article>;
}
