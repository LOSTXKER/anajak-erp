"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { TINT } from "@/components/ui/tokens";
import type { NowStep } from "@/lib/production-step-actions";
import type { ProductionStep } from "./types";
import {
  CheckCircle2,
  Clock,
  Plus,
  Play,
  Truck,
  FastForward,
  Printer,
} from "lucide-react";

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
  complete: "เสร็จขั้นนี้",
  "record-qty": "บันทึกจำนวน",
  "send-outsource": "เปิดใบส่งร้าน",
  "quick-pass": "ผ่านรวด",
};

export function ProductionNowCard({
  nowSteps,
  allDone,
  allDoneMessage = "ครบทุกขั้นการผลิตแล้ว",
  busy,
  onStart,
  onComplete,
  onSendOutsource,
  onQuickPass,
  onOpenStep,
  canOpenStep = () => true,
  printRunsHref = "/production/print-runs",
  embedded = false,
  emptyMessage = "ยังไม่มีขั้นตอนผลิตในใบนี้",
  getStartLabel,
  getCompletionHint,
}: {
  nowSteps: readonly NowStep<ProductionStep>[];
  allDone: boolean;
  allDoneMessage?: string;
  busy: boolean;
  onStart: (step: ProductionStep) => void;
  onComplete: (step: ProductionStep) => void;
  onSendOutsource: (step: ProductionStep) => void;
  onQuickPass: (step: ProductionStep) => void;
  onOpenStep: (step: ProductionStep) => void;
  canOpenStep?: (step: ProductionStep) => boolean;
  printRunsHref?: string;
  /** วางใน work workspace ก้อนเดียวกับคำสั่งงาน โดยไม่สร้าง card ซ้อน */
  embedded?: boolean;
  emptyMessage?: string;
  getStartLabel?: (step: ProductionStep) => string | null;
  getCompletionHint?: (step: ProductionStep) => string | null;
}) {
  if (allDone) {
    return (
      <section className={cn(TINT.success, "flex items-center gap-3 rounded-2xl border px-5 py-4")}>
        <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">งานผลิตส่วนนี้เสร็จแล้ว</h2>
          <p className="mt-0.5 text-sm">{allDoneMessage}</p>
        </div>
      </section>
    );
  }

  if (nowSteps.length === 0) {
    return (
      <section className={cn(!embedded && "card-surface rounded-2xl", "px-4 py-3")}>
        <p className="text-sm text-muted">{emptyMessage}</p>
      </section>
    );
  }

  const currentSteps = nowSteps.filter(({ group }) => group === "current");
  const waitingSteps = nowSteps.filter(({ group }) => group === "waiting");

  const renderStep = ({ step, group, action, waitingOn, note }: NowStep<ProductionStep>) => {
    const counting = step.qtyTotal !== null && step.qtyTotal > 0;
    const donePct = counting
      ? Math.round(((step.qtyDone ?? 0) / (step.qtyTotal ?? 1)) * 100)
      : 0;
    const canOpen = canOpenStep(step);
    const actionLabel = action === "start"
      ? (getStartLabel?.(step) ?? `เริ่ม${stepLabel(step)}`)
      : action
        ? ACTION_LABEL[action]
        : null;
    const completionHint = getCompletionHint?.(step) ?? null;

    return (
      <div
        key={step.id}
        className="space-y-3 border-t border-divider py-4 first:border-t-0 first:pt-0 last:pb-0"
      >
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
              <Button size="lg" asChild className="gap-2 sm:min-w-56">
                <Link href={printRunsHref}>
                  <Printer />
                  เปิดรอบพิมพ์ DTF
                </Link>
              </Button>
            ) : canOpen ? (
              <Button variant="outline" size="sm" onClick={() => onOpenStep(step)}>
                เปิดรายละเอียด
              </Button>
            ) : null}
          </div>
        ) : action ? (
          <div className="space-y-2">
            <Button
              size="lg"
              disabled={busy}
              aria-busy={busy || undefined}
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
              {actionLabel}
              {action === "record-qty" && counting && ` (${step.qtyDone}/${step.qtyTotal})`}
            </Button>
            {completionHint ? (
              <p className="text-xs text-muted">{completionHint}</p>
            ) : null}
          </div>
        ) : step.stepType === "GARMENT_PICK" && group === "current" ? (
          <p className="text-sm text-muted">เบิกเสื้อตามไซส์และจำนวนในรายการถัดไป</p>
        ) : canOpen ? (
          <Button variant="outline" size="sm" onClick={() => onOpenStep(step)}>
            เปิดรายละเอียด
          </Button>
        ) : (
          <p className="text-sm text-muted">สิทธิ์นี้ดูขั้นตอนนี้ได้อย่างเดียว</p>
        )}
      </div>
    );
  };

  return (
    <section
      className={cn(!embedded && "card-surface rounded-2xl", embedded ? "p-0" : "p-5 sm:p-6")}
      aria-labelledby="production-now"
    >
      <h2 id="production-now" className="text-xs font-semibold uppercase tracking-wide text-muted">
        ทำตอนนี้
      </h2>
      <div className="mt-4 space-y-5">
        {currentSteps.length > 0 && <div>{currentSteps.map(renderStep)}</div>}
        {waitingSteps.length > 0 && (
          <div className="border-t border-divider pt-4">
            <h3 className="text-sm font-semibold text-strong">รอต่อจากนี้</h3>
            <div className="mt-3">{waitingSteps.map(renderStep)}</div>
          </div>
        )}
      </div>
    </section>
  );
}
