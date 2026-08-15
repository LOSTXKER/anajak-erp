"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { TINT } from "@/components/ui/tokens";
import type { NowStep } from "@/lib/production-step-actions";
import type { ProductionStep } from "./types";
import { CheckCircle2, Clock, Plus, Play, Truck, FastForward } from "lucide-react";

/* ============================================================
   กล่อง "ตอนนี้ต้องทำ" ของใบผลิต (ใบงาน PC2 · 2026-08-15)

   บอร์ดผลิตถอดปุ่มลงมือออกแล้ว หน้านี้จึงเป็นที่เดียวที่กดทำงานได้ —
   ขั้นที่ลงมือได้ตอนนี้ต้องอยู่บนสุด ปุ่มใหญ่พอสำหรับจอทัชในโรงงาน

   งานผสมเดินหลายเลนพร้อมกัน จึงแสดงได้หลายขั้น (เลนละไม่เกินหนึ่ง)
   ขั้นที่ลงมือไม่ได้ยังแสดงอยู่พร้อมเหตุผล — ไม่ซ่อน เพราะช่างต้องรู้ว่ารออะไร
   ============================================================ */

function stepLabel(step: ProductionStep) {
  return step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
}

const ACTION_LABEL: Record<string, string> = {
  start: "เริ่มทำ",
  complete: "เสร็จขั้นนี้",
  "record-qty": "บันทึกจำนวน",
  "send-outsource": "เปิดใบส่งร้าน",
  "quick-pass": "ผ่านรวด",
};

export function ProductionNowCard({
  nowSteps,
  allDone,
  busy,
  onStart,
  onComplete,
  onSendOutsource,
  onQuickPass,
  onOpenStep,
  canOpenStep = () => true,
  printRunsHref = "/production/print-runs",
}: {
  nowSteps: readonly NowStep<ProductionStep>[];
  allDone: boolean;
  busy: boolean;
  onStart: (step: ProductionStep) => void;
  onComplete: (step: ProductionStep) => void;
  onSendOutsource: (step: ProductionStep) => void;
  onQuickPass: (step: ProductionStep) => void;
  onOpenStep: (step: ProductionStep) => void;
  canOpenStep?: (step: ProductionStep) => boolean;
  printRunsHref?: string;
}) {
  if (allDone) {
    return (
      <section className={cn(TINT.success, "flex items-center gap-2 rounded-2xl border px-4 py-3")}>
        <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="text-sm font-semibold">ทุกขั้นเสร็จแล้ว — งานพร้อมเข้าขั้นถัดไป</p>
      </section>
    );
  }

  if (nowSteps.length === 0) {
    return (
      <section className="card-surface rounded-2xl px-4 py-3">
        <p className="text-sm text-muted">ยังไม่มีขั้นตอนผลิตในใบนี้</p>
      </section>
    );
  }

  return (
    <section className="card-surface rounded-2xl p-4" aria-labelledby="production-now">
      <h2 id="production-now" className="text-sm font-semibold text-muted">
        ตอนนี้ต้องทำ
      </h2>
      <div className="mt-3 space-y-3">
        {nowSteps.map(({ step, action, waitingOn, note }) => {
          const counting = step.qtyTotal !== null && step.qtyTotal > 0;
          const donePct = counting
            ? Math.round(((step.qtyDone ?? 0) / (step.qtyTotal ?? 1)) * 100)
            : 0;
          return (
            <div key={step.id} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-lg font-semibold text-strong">{stepLabel(step)}</span>
                {counting && (
                  <span className="text-sm tabular-nums text-muted">
                    {step.qtyDone}/{step.qtyTotal} ตัว
                  </span>
                )}
              </div>

              {counting && (
                <div
                  role="progressbar"
                  aria-label={`ความคืบหน้า ${stepLabel(step)}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={donePct}
                  className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
                >
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${donePct}%` }} />
                </div>
              )}

              {waitingOn.length > 0 ? (
                <div className="space-y-1.5">
                  {waitingOn.map((reason) => (
                    <p
                      key={reason}
                      className={cn(
                        TINT.warning,
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
                      )}
                    >
                      <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {reason}
                    </p>
                  ))}
                </div>
              ) : note ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-muted">{note}</p>
                  {step.stepType === "DTF_PRINT" && step.status !== "FAILED" ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={printRunsHref}>เปิดรอบพิมพ์ DTF</Link>
                    </Button>
                  ) : canOpenStep(step) ? (
                    <Button variant="outline" size="sm" onClick={() => onOpenStep(step)}>
                      เปิดดูขั้นนี้
                    </Button>
                  ) : null}
                </div>
              ) : action ? (
                // ปุ่มเต็มความกว้างบนจอแคบ/จอทัช — นิ้วโดนแน่ ไม่ต้องเล็ง
                <Button
                  size="lg"
                  disabled={busy}
                  className="w-full gap-2 sm:w-auto sm:min-w-56"
                  onClick={() => {
                    if (action === "start") onStart(step);
                    else if (action === "complete" || action === "record-qty") onComplete(step);
                    else if (action === "send-outsource") onSendOutsource(step);
                    else if (action === "quick-pass") onQuickPass(step);
                  }}
                >
                  {action === "start" && <Play />}
                  {action === "record-qty" && <Plus />}
                  {action === "complete" && <CheckCircle2 />}
                  {action === "send-outsource" && <Truck />}
                  {action === "quick-pass" && <FastForward />}
                  {ACTION_LABEL[action]}
                  {action === "record-qty" && counting && ` (${step.qtyDone}/${step.qtyTotal})`}
                </Button>
              ) : canOpenStep(step) ? (
                <Button variant="outline" size="sm" onClick={() => onOpenStep(step)}>
                  เปิดดูขั้นนี้
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
