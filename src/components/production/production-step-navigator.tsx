"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TINT } from "@/components/ui/tokens";
import type { NowStep } from "@/lib/production-step-actions";
import { LANE_LABELS, STEP_TYPE_LABELS, laneOf } from "@/lib/production-steps";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, Circle, CircleDot, Clock3 } from "lucide-react";
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
    return { label: "เสร็จแล้ว", variant: "success" as const, icon: Check };
  }
  if (step.status === "FAILED") {
    return { label: "มีปัญหา", variant: "destructive" as const, icon: AlertTriangle };
  }
  if (step.status === "ON_HOLD") {
    return { label: "พักไว้", variant: "warning" as const, icon: Clock3 };
  }
  // สถานะ workflow มาก่อนสิทธิ์/action ของคนที่กำลังดู — ขั้นที่เริ่มแล้วต้องอ่านว่า
  // "กำลังทำ" แม้ panel จะบอกต่อว่าอยู่ร้านนอกหรือผู้ใช้นี้แก้ไม่ได้
  if (step.status === "IN_PROGRESS") {
    return { label: "กำลังทำ", variant: "accent" as const, icon: CircleDot };
  }
  if (nowStep?.group === "waiting") {
    return { label: readOnly ? "ดูอย่างเดียว" : "ติดเงื่อนไข", variant: "warning" as const, icon: Clock3 };
  }
  if (nowStep?.group === "current") {
    const actionable = hasFocusedPrimaryAction(nowStep);
    return {
      label: readOnly ? "ดูอย่างเดียว" : actionable ? "ทำได้ตอนนี้" : "ต้องเปิดดู",
      variant: readOnly ? ("secondary" as const) : ("accent" as const),
      icon: CircleDot,
    };
  }

  return { label: "รอในสายงาน", variant: "secondary" as const, icon: Circle };
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
      className="card-surface overflow-hidden rounded-2xl"
    >
      <div className="border-b border-divider px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-strong">ขั้นตอนการผลิต</h2>
            <p className="mt-0.5 text-xs text-muted">
              เลือกทีละขั้น แล้วทำเฉพาะงานในขั้นนั้น
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs font-medium tabular-nums text-muted">
              กำลังดูขั้น {selectedIndex + 1}/{sortedSteps.length}
            </span>
            {availableCount > 1 ? (
              <Badge variant="accent" size="sm">
                ทำพร้อมกันได้ {availableCount} งาน
              </Badge>
            ) : null}
          </div>
        </div>

        <TabsList aria-label="เลือกขั้นการผลิต" className="gap-0 pb-4 sm:gap-0">
          {sortedSteps.map((step, index) => {
            const state = navigatorState(step, nowById.get(step.id), readOnly);
            const StateIcon = state.icon;
            const countLabel =
              step.qtyTotal !== null && step.qtyTotal > 0
                ? ` ${step.qtyDone ?? 0} จาก ${step.qtyTotal} ตัว`
                : "";

            return (
              <TabsTrigger
                key={step.id}
                value={step.id}
                aria-label={`${stepLabel(step)} ${state.label}${countLabel}`}
                className={cn(
                  "group -mb-0 h-auto min-h-20 min-w-40 flex-col justify-start gap-2 border-b-0 px-0 py-0 text-center whitespace-normal",
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
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-surface transition-colors",
                      step.status === "COMPLETED"
                        ? TINT.success
                        : step.status === "FAILED"
                          ? TINT.error
                          : nowById.get(step.id)?.group === "current"
                            ? TINT.info
                            : TINT.neutral,
                      "group-data-[state=active]:border-blue-600 group-data-[state=active]:ring-4 group-data-[state=active]:ring-blue-100 dark:group-data-[state=active]:border-blue-300 dark:group-data-[state=active]:ring-blue-950",
                    )}
                  >
                    <StateIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span
                    className={cn(
                      "h-px flex-1 bg-divider",
                      index === sortedSteps.length - 1 && "bg-transparent",
                    )}
                  />
                </span>
                <span className="min-w-0 px-2">
                  <span className="block break-words text-sm font-semibold text-strong">
                    {stepLabel(step)}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted">
                    <span>{LANE_LABELS[laneOf(step.stepType)]}</span>
                    <Badge variant={state.variant} size="sm">
                      {state.label}
                    </Badge>
                  </span>
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {sortedSteps.map((step) => (
        <TabsContent key={step.id} value={step.id} className="m-0 p-0">
          {renderStep(step)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
