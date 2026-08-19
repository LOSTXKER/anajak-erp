"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { NowStep } from "@/lib/production-step-actions";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { ProductionStep } from "./types";

function stepLabel(step: ProductionStep) {
  return step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
}

export function defaultProductionStepId(
  steps: readonly ProductionStep[],
  nowSteps: readonly NowStep<ProductionStep>[],
  selectedId?: string | null,
): string | null {
  const sortedSteps = [...steps].sort((a, b) => a.sortOrder - b.sortOrder);
  if (selectedId && sortedSteps.some((step) => step.id === selectedId)) {
    return selectedId;
  }

  const sortedNow = [...nowSteps].sort((a, b) => a.step.sortOrder - b.step.sortOrder);
  const current = sortedNow.find(({ group }) => group === "current");
  if (current) return current.step.id;

  const waiting = sortedNow.find(({ group }) => group === "waiting");
  if (waiting) return waiting.step.id;

  const pending = sortedSteps.find((step) => step.status !== "COMPLETED");
  if (pending) return pending.id;

  return sortedSteps.at(-1)?.id ?? null;
}

function navigatorState(
  step: ProductionStep,
  nowStep: NowStep<ProductionStep> | undefined,
  readOnly: boolean,
) {
  if (step.status === "COMPLETED") {
    return { label: "เสร็จแล้ว", workflow: "completed" as const };
  }
  if (step.status === "FAILED") {
    return { label: "มีปัญหา", workflow: "failed" as const };
  }
  if (step.status === "ON_HOLD") {
    return { label: "พักไว้", workflow: "hold" as const };
  }
  // สถานะ workflow มาก่อนสิทธิ์/action ของคนที่กำลังดู — ขั้นที่เริ่มแล้วต้องอ่านว่า
  // "กำลังทำ" แม้ panel จะบอกต่อว่าอยู่ร้านนอกหรือผู้ใช้นี้แก้ไม่ได้
  if (step.status === "IN_PROGRESS") {
    return { label: "กำลังทำ", workflow: "in-progress" as const };
  }
  if (nowStep?.group === "waiting") {
    return {
      label: readOnly ? "ดูอย่างเดียว" : "ติดเงื่อนไข",
      workflow: "waiting" as const,
    };
  }
  if (nowStep?.group === "current") {
    const actionable = hasFocusedPrimaryAction(nowStep);
    return {
      label: readOnly ? "ดูอย่างเดียว" : actionable ? "ทำได้ตอนนี้" : "ต้องเปิดดู",
      workflow: "current" as const,
    };
  }

  return { label: "รอในสายงาน", workflow: "queued" as const };
}

function hasFocusedPrimaryAction({ step, group, action }: NowStep<ProductionStep>) {
  if (group !== "current" || step.status === "FAILED") return false;
  return (
    action !== null ||
    step.stepType === "GARMENT_PICK" ||
    step.stepType === "DTF_PRINT"
  );
}

export function ProductionStepNavigator({
  steps,
  nowSteps,
  value,
  onValueChange,
  readOnly,
  renderStep,
}: {
  steps: readonly ProductionStep[];
  nowSteps: readonly NowStep<ProductionStep>[];
  value: string;
  onValueChange: (stepId: string) => void;
  readOnly: boolean;
  renderStep: (step: ProductionStep) => ReactNode;
}) {
  const sortedSteps = [...steps].sort((a, b) => a.sortOrder - b.sortOrder);
  const nowById = new Map(nowSteps.map((nowStep) => [nowStep.step.id, nowStep]));
  const availableCount = readOnly ? 0 : nowSteps.filter(hasFocusedPrimaryAction).length;
  const selectedIndex = Math.max(0, sortedSteps.findIndex((step) => step.id === value));

  if (sortedSteps.length === 0) {
    return (
      <section
        className="border-y border-divider bg-surface p-5 sm:p-6"
        aria-labelledby="production-empty-route"
      >
        <h2 id="production-empty-route" className="font-semibold text-strong">
          ยังไม่มีขั้นตอนการผลิต
        </h2>
        <p className="mt-1 text-sm text-muted">กลับไปตรวจแผนการผลิตของออเดอร์นี้</p>
      </section>
    );
  }

  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      activationMode="manual"
      className="mx-auto min-w-0 max-w-[96rem] xl:grid xl:grid-cols-[16rem_minmax(0,1fr)] xl:items-start"
    >
      <section
        data-production-stage-dock=""
        className="min-w-0 border-b border-divider bg-surface px-4 py-3 sm:px-6 xl:sticky xl:top-20 xl:z-10 xl:border-b-0 xl:border-r xl:px-5 xl:py-6"
        aria-labelledby="production-step-rail-title"
      >
        <div className="mb-3 flex items-center justify-between gap-3 xl:mb-4">
          <h2 id="production-step-rail-title" className="text-sm font-semibold text-strong">
            ขั้นตอนงาน
          </h2>
          <span className="text-xs tabular-nums text-muted">
            {selectedIndex + 1}/{sortedSteps.length}
          </span>
        </div>
        <p className="sr-only">
          กำลังดูขั้น {selectedIndex + 1} จาก {sortedSteps.length}
          {availableCount > 1 ? ` ทำพร้อมกันได้ ${availableCount} งาน` : ""}
        </p>

        <TabsList
          aria-label="เลือกขั้นการผลิต"
          className="items-stretch gap-2 xl:flex-col xl:gap-1.5 xl:overflow-x-visible xl:pr-0"
        >
          {sortedSteps.map((step, index) => {
            const state = navigatorState(step, nowById.get(step.id), readOnly);
            const countLabel =
              step.qtyTotal !== null && step.qtyTotal > 0
                ? ` ${step.qtyDone ?? 0} จาก ${step.qtyTotal} ตัว`
                : "";

            return (
              <TabsTrigger
                key={step.id}
                value={step.id}
                aria-label={`${stepLabel(step)} ${state.label}${countLabel}`}
                data-workflow-state={state.workflow}
                className={cn(
                  "group -mb-0 h-auto min-h-14 basis-40 shrink-0 justify-start gap-3 rounded-xl border-b-0 px-3 py-2.5 text-left whitespace-normal",
                  "hover:bg-interactive-hover data-[state=active]:border-transparent data-[state=active]:bg-interactive-selected data-[state=active]:text-interactive-selected-text",
                  "xl:w-full xl:basis-auto",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                    state.workflow === "completed" &&
                      "border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-700",
                    (state.workflow === "current" || state.workflow === "in-progress") &&
                      "border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-600",
                    state.workflow === "failed" &&
                      "border-red-500 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950 dark:text-red-200",
                    (state.workflow === "hold" || state.workflow === "waiting") &&
                      "border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-200",
                    state.workflow === "queued" &&
                      "border-divider bg-surface-muted text-muted",
                  )}
                >
                  {state.workflow === "completed" ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block break-words text-sm font-medium leading-snug text-strong transition-colors",
                      (state.workflow === "current" || state.workflow === "in-progress") &&
                        "text-blue-700 dark:text-blue-300",
                      state.workflow === "failed" &&
                        "text-red-700 dark:text-red-300",
                      (state.workflow === "hold" || state.workflow === "waiting") &&
                        "text-amber-800 dark:text-amber-300",
                      "group-data-[state=active]:font-semibold group-data-[state=active]:text-interactive-selected-text",
                    )}
                  >
                    {stepLabel(step)}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block text-xs text-muted",
                      "group-data-[state=active]:text-interactive-selected-text/80",
                    )}
                  >
                    {state.label}
                    {step.qtyTotal !== null && step.qtyTotal > 0
                      ? ` · ${step.qtyDone ?? 0}/${step.qtyTotal} ตัว`
                      : ""}
                  </span>
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </section>

      {sortedSteps.map((step) => (
        <TabsContent
          key={step.id}
          value={step.id}
          className="m-0 min-w-0 bg-bg p-4 sm:p-6 lg:p-7"
        >
          {renderStep(step)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
