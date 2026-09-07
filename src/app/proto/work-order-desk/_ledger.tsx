"use client";

import { RADIUS, TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { nowSteps } from "../work-order-lean/_data";
import { OrderHeader, ReferencePanel, StepBody, StepStatus, type DeskProps } from "./_shared";

/** ทุกขั้นอยู่ในรายการเดียว: กว้างเป็นคอลัมน์ แคบเรียงรายละเอียดต่อใต้ชื่อขั้น */
export function LedgerB({ order, boss, idPrefix }: DeskProps) {
  const primaryStepId = nowSteps(order.steps)[0]?.id;
  const headingId = `${idPrefix}-ledger-heading`;

  return (
    <div className="@container space-y-5">
      <OrderHeader order={order} />

      <div className="grid items-start gap-5 @5xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby={headingId} className={cn("@container/ledger min-w-0 card-surface", RADIUS.surface)}>
          <h2 id={headingId} className="border-b border-divider px-4 py-4 text-lg font-semibold text-strong @lg/ledger:px-5">
            ขั้นงานทั้งหมด
          </h2>

          <div aria-hidden="true" className={cn(TABLE_HEAD_SURFACE, "hidden grid-cols-[10rem_7.5rem_minmax(0,1fr)] gap-4 px-5 py-3 text-xs font-medium text-muted @2xl/ledger:grid")}>
            <span>ขั้นงาน</span>
            <span>สถานะ</span>
            <span>รายละเอียดและการทำต่อ</span>
          </div>

          {order.steps.length === 0 ? <p className="px-5 py-10 text-sm text-secondary">ยังไม่มีขั้นงานในใบผลิตนี้</p> : null}
          <ol className="divide-y divide-divider">
            {order.steps.map((step) => {
              const stepHeadingId = `${idPrefix}-ledger-step-${step.id}`;
              return (
                <li key={step.id}>
                  <article aria-labelledby={stepHeadingId} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-4 p-4 @lg/ledger:px-5 @2xl/ledger:grid-cols-[10rem_7.5rem_minmax(0,1fr)] @2xl/ledger:py-5">
                    <h3 id={stepHeadingId} className="min-w-0 text-sm font-semibold leading-relaxed text-strong">
                      {step.label}
                    </h3>
                    <div className="min-w-0">
                      <span className="sr-only">สถานะ: </span>
                      <StepStatus step={step} />
                    </div>
                    <div className="col-span-2 min-w-0 @2xl/ledger:col-span-1">
                      <StepBody step={step} order={order} boss={boss} primary={step.id === primaryStepId} compact />
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="min-w-0">
          <ReferencePanel order={order} />
        </div>
      </div>
    </div>
  );
}
