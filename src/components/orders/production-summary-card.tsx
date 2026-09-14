"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Factory, ListChecks, Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { HomeChip, HomeIconTile, type HomeTone } from "@/components/dashboard/home/home-card";
import {
  STEP_TYPE_LABELS,
  OUTSOURCE_ACTIVE_STATUSES,
  productionWorkflowSteps,
} from "@/lib/production-steps";
import { differenceInBangkokDays } from "@/lib/date-utils";
import type { RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";

/* ============================================================
   การ์ดงานผลิตบนหน้าออเดอร์ — อ่านอย่างเดียว ไม่มี dialog/ไม่มีเงิน
   ตัวจัดการจริง (ขั้นตอน/QC/outsource/เบิกวัตถุดิบ) อยู่หน้าใบผลิต /production/[id]
   (แยกโมดูลผลิตออกจากหน้าออเดอร์ — เบสเคาะ 2026-06-12)

   หน้าตาตามต้นแบบหน้าออเดอร์รอบ 2 (ไล่ตรงต้นแบบ 2026-09-15): เลขใบผลิตที่หัวการ์ด + ปุ่มไปหน้าผลิต ·
   ขั้นตอนใบผลิตเป็นแถวเรียงลงมา วงเขียว = เสร็จ · แถวฟ้า = กำลังทำ (ใคร/ร้านไหน · ร้านนอกช้า) · วงเทา = รอ
   ============================================================ */

type OrderProductions = RouterOutput["order"]["getById"]["productions"];

interface ProductionSummaryCardProps {
  orderId: string;
  internalStatus: string;
  productions: OrderProductions;
  isManagerUp: boolean;
  productionV2Enabled: boolean;
}

type StepState = "done" | "current" | "todo";

export function ProductionSummaryCard({
  orderId,
  internalStatus,
  productions,
  isManagerUp,
  productionV2Enabled,
}: ProductionSummaryCardProps) {
  const [now] = useState(() => new Date());
  const hasProduction = productions.length > 0;

  // เงื่อนไขโชว์การ์ดเดียวกับ section เดิม — มีใบผลิต หรือสถานะอยู่ช่วงผลิต
  if (
    !hasProduction &&
    ![
      "PRODUCTION_QUEUE",
      "DESIGN_APPROVED",
      "CONFIRMED",
      "PRODUCING",
      "QUALITY_CHECK",
      "PACKING",
    ].includes(internalStatus)
  ) {
    return null;
  }

  // เปิดใบผลิต = อำนาจหัวหน้า + สถานะถึงเกณฑ์ (ชุดเดียวกับปุ่มเดิม)
  const canCreate =
    isManagerUp &&
    !hasProduction &&
    ["PRODUCTION_QUEUE", "DESIGN_APPROVED", "CONFIRMED"].includes(internalStatus);
  const openLabel = productionV2Enabled ? "เปิดใบสั่งผลิต" : "เปิดงานผลิต";
  const single = productions.length === 1 ? productions[0] : null;

  return (
    <Section
      title={
        <span className="flex items-center gap-2.5">
          <HomeIconTile icon={Factory} tone="warning" />
          งานผลิต
        </span>
      }
      action={
        single ? (
          <span className="flex flex-wrap items-center gap-2">
            {single.workOrderNumber ? (
              <HomeChip tone="brand" className="font-mono">
                {single.workOrderNumber}
              </HomeChip>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/production/${single.id}`}>
                {openLabel}
                <ArrowRight />
              </Link>
            </Button>
          </span>
        ) : !hasProduction ? (
          <HomeChip>ยังไม่เปิดใบผลิต</HomeChip>
        ) : undefined
      }
    >
      {!hasProduction ? (
        <div className="flex flex-wrap items-center gap-2.5 rounded-lg bg-surface-muted px-3 py-2.5 text-sm text-secondary">
          <Factory className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 basis-40">
            ยังไม่มีใบผลิต
            {canCreate && " — เปิดได้ที่หน้าการผลิต"}
          </span>
          {canCreate && (
            <Button size="sm" asChild>
              <Link href={`/production?create=${orderId}`}>
                <Plus />
                เปิดใบผลิต
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {productions.map((prod) => {
            const workflowSteps = productionWorkflowSteps(prod.steps);
            const completed = workflowSteps.filter((s) => s.status === "COMPLETED").length;
            const total = workflowSteps.length;
            // ขั้นที่กำลังทำอยู่ = ขั้นแรกที่ยังไม่เสร็จ
            const currentStep = workflowSteps.find((s) => s.status !== "COMPLETED");
            const hasPendingLegacyPackaging = prod.steps.some(
              (s) => s.stepType === "PACKAGING" && s.status !== "COMPLETED",
            );
            const legacyReadyForQc =
              internalStatus === "PRODUCING" &&
              hasPendingLegacyPackaging &&
              workflowSteps.every((s) => s.status === "COMPLETED");

            return (
              <div key={prod.id} className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-strong">
                    <HomeIconTile icon={ListChecks} tone="warning" size="sm" />
                    ขั้นตอนใบผลิต
                  </h3>
                  {!single ? (
                    <Link
                      href={`/production/${prod.id}`}
                      className="rounded-sm border-b border-blue-200 font-mono text-xs text-blue-700 dark:border-blue-800 dark:text-blue-300"
                    >
                      {prod.workOrderNumber ?? openLabel}
                    </Link>
                  ) : null}
                  <HomeChip tone={total > 0 && completed === total ? "success" : "neutral"} className="ml-auto">
                    {completed}/{total} เสร็จ
                  </HomeChip>
                </div>

                {legacyReadyForQc ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    ขั้นผลิตจริงครบแล้ว · รอส่งเข้า QC จากใบผลิต
                  </p>
                ) : null}

                {total === 0 ? (
                  <p className="text-sm text-muted">ใบผลิตนี้ยังไม่มีขั้นตอน</p>
                ) : (
                  <ol className="grid gap-1.5">
                    {workflowSteps.map((step, index) => {
                      const state: StepState =
                        step.status === "COMPLETED" ? "done" : step === currentStep ? "current" : "todo";
                      const activeOutsource = step.outsourceOrders.find((os) =>
                        OUTSOURCE_ACTIVE_STATUSES.includes(os.status),
                      );
                      const backIn = activeOutsource?.expectedBackAt
                        ? differenceInBangkokDays(activeOutsource.expectedBackAt, now)
                        : null;
                      const lateDays = backIn !== null && backIn < 0 ? -backIn : 0;
                      const who = activeOutsource?.vendor?.name ?? step.assignedTo?.name ?? null;
                      const name = step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
                      const chip: { tone: HomeTone; label: string } =
                        state === "done"
                          ? { tone: "success", label: "เสร็จ" }
                          : step.status === "FAILED"
                            ? { tone: "danger", label: "มีปัญหา" }
                            : step.status === "ON_HOLD"
                              ? { tone: "warning", label: "พักไว้" }
                              : state === "current"
                                ? lateDays > 0
                                  ? { tone: "danger", label: "ร้านนอกช้า" }
                                  : { tone: "brand", label: "กำลังทำ" }
                                : { tone: "neutral", label: "รอ" };
                      return (
                        <li
                          key={step.id}
                          className={cn(
                            "grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-2.5 py-2",
                            state === "current"
                              ? "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40"
                              : "border-divider",
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-full text-2xs font-semibold tabular-nums",
                              state === "done"
                                ? "bg-green-600 text-white dark:bg-green-500"
                                : state === "current"
                                  ? "border-2 border-blue-600 bg-surface text-blue-700 dark:border-blue-400 dark:text-blue-300"
                                  : "border-2 border-slate-300 text-muted dark:border-slate-600",
                            )}
                          >
                            {state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : index + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-strong [overflow-wrap:anywhere]">{name}</span>
                            <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                              {state === "done" ? "เสร็จแล้ว" : state === "current" ? "กำลังทำ" : "รอ"}
                              {state !== "todo" && who ? (
                                <span className="inline-flex items-center gap-1">
                                  · {activeOutsource ? <Truck className="h-3 w-3" aria-hidden="true" /> : null}
                                  {who}
                                </span>
                              ) : null}
                              {lateDays > 0 ? (
                                <span className="font-medium text-red-700 dark:text-red-300">· เลยกำหนดรับ {lateDays} วัน</span>
                              ) : null}
                            </span>
                          </span>
                          <HomeChip tone={chip.tone}>{chip.label}</HomeChip>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
