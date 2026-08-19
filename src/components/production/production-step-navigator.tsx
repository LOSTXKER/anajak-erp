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
      <section className="card-surface rounded-2xl p-5 sm:p-6" aria-labelledby="production-empty-route">
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
      className="min-w-0 space-y-5"
    >
      <section className="min-w-0" aria-labelledby="production-step-rail-title">
        <h2 id="production-step-rail-title" className="sr-only">
          ขั้นตอนการผลิต
        </h2>
        <p className="sr-only">
          กำลังดูขั้น {selectedIndex + 1} จาก {sortedSteps.length}
          {availableCount > 1 ? ` ทำพร้อมกันได้ ${availableCount} งาน` : ""}
        </p>

        <TabsList
          aria-label="เลือกขั้นการผลิต"
          className="items-start gap-0 px-1 py-2 sm:gap-0 sm:px-2"
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
                  "group -mb-0 h-auto min-h-20 basis-28 grow shrink-0 flex-col justify-start gap-2 border-b-0 px-0 py-0 text-center whitespace-normal",
                  "data-[state=active]:border-transparent data-[state=active]:text-strong",
                )}
              >
                <span className="flex w-full items-center" aria-hidden="true">
                  <span
                    className={cn(
                      "h-px flex-1 bg-divider",
                      index === 0 && "bg-transparent",
                    )}
                  />
                  <span
                    className={cn(
                      "relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold tabular-nums transition-[border-color,background-color,color,box-shadow]",
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
                      "ring-offset-2 ring-offset-bg group-data-[state=active]:ring-4 group-data-[state=active]:ring-blue-200 dark:group-data-[state=active]:ring-blue-900",
                    )}
                  >
                    {state.workflow === "completed" ? (
                      <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                    ) : (
                      <span aria-hidden="true">{index + 1}</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "h-px flex-1 bg-divider",
                      index === sortedSteps.length - 1 && "bg-transparent",
                    )}
                  />
                </span>
                <span className="min-w-0 px-2 pb-1">
                  <span
                    className={cn(
                      "block break-words text-sm leading-snug text-muted transition-colors",
                      (state.workflow === "current" || state.workflow === "in-progress") &&
                        "font-semibold text-blue-700 dark:text-blue-300",
                      state.workflow === "failed" &&
                        "font-semibold text-red-700 dark:text-red-300",
                      (state.workflow === "hold" || state.workflow === "waiting") &&
                        "text-amber-800 dark:text-amber-300",
                      "group-data-[state=active]:font-semibold group-data-[state=active]:text-strong",
                    )}
                  >
                    {stepLabel(step)}
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
          className="card-surface m-0 overflow-hidden rounded-2xl p-0"
        >
          {renderStep(step)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
