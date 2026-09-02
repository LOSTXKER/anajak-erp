"use client";

import { useState, type RefObject } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  UserRound,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { Skeleton } from "@/components/ui/skeleton";
import { FOCUS_BUTTON, RADIUS, TINT } from "@/components/ui/tokens";
import {
  PRODUCTION_REFRESH_INTERVAL_MS,
  ProductionFreshness,
} from "@/components/production/production-freshness";
import { ProductionRouteRail } from "@/components/production/production-route-rail";
import type { ProductionDetail, ProductionStep } from "@/components/production/types";
import {
  buildProductionControlView,
  summarizeGarmentControl,
  type GarmentControlEvidence,
  type ProductionControlTone,
} from "@/lib/production-control";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { mockupCoverImage, mockupImageCount } from "@/lib/mockup";
import { productionWorkflowSteps } from "@/lib/production-steps";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

/* ป้ายสถานะของหน้าผลิตเคยเป็นแคปซูลพื้นสีที่เขียนสูตรเองในไฟล์นี้ — ทำให้ทั้งเว็บ
   พูดสถานะ 3 ภาษาพร้อมกัน (จุดสี+ข้อความ · <Badge> · แคปซูลตัวนี้)
   ตอนนี้ยืมภาษาเดียวกับที่เหลือ: วงแหวนบาง + จุดสี ไม่มีพื้นสี (UI-2026 เฟส 3) */
const TONE_VARIANT: Record<ProductionControlTone, BadgeProps["variant"]> = {
  danger: "destructive",
  warning: "warning",
  active: "accent",
  success: "success",
  neutral: "default",
};

const TONE_DOT: Record<ProductionControlTone, string> = {
  danger: "bg-red-500",
  warning: "bg-amber-500",
  active: "bg-blue-500",
  success: "bg-green-600 dark:bg-green-400",
  neutral: "bg-slate-500 dark:bg-slate-400",
};

function StatusPill({ tone, children }: { tone: ProductionControlTone; children: string }) {
  return (
    <Badge variant={TONE_VARIANT[tone]} className="min-h-7 w-fit px-2 py-1">
      <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[tone])} aria-hidden="true" />
      {children}
    </Badge>
  );
}

function completedHandoff(status: string) {
  switch (status) {
    case "QUALITY_CHECK":
      return { label: "ตรวจคุณภาพก่อนแพ็ก", owner: "QC", tab: "production" };
    case "PACKING":
      return { label: "แพ็กและเตรียมส่ง", owner: "ฝ่ายแพ็ก", tab: "production" };
    case "READY_TO_SHIP":
      return { label: "ส่งมอบให้ลูกค้า", owner: "ฝ่ายจัดส่ง", tab: "delivery" };
    case "SHIPPED":
      return { label: "ติดตามการส่งมอบ", owner: "ฝ่ายจัดส่ง", tab: "delivery" };
    case "COMPLETED":
      return { label: "ออเดอร์เสร็จแล้ว", owner: "ปิดงานแล้ว", tab: "overview" };
    case "CANCELLED":
      return { label: "ออเดอร์ถูกยกเลิก", owner: "ไม่ต้องส่งต่อ", tab: "overview" };
    default:
      return { label: "ตรวจขั้นตอนถัดไป", owner: "หัวหน้างาน", tab: "overview" };
  }
}

export function ProductionControlRecord({
  production,
  canSupervise,
  writeDataStale,
  dataUpdatedAt,
  isFetching,
  onManageStep,
  onOpenMockup,
  mockupButtonRef,
}: {
  production: ProductionDetail;
  canSupervise: boolean;
  writeDataStale: boolean;
  dataUpdatedAt: number;
  isFetching: boolean;
  onManageStep: (step: ProductionStep) => void;
  onOpenMockup: () => void;
  mockupButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  const order = production.order;
  const workflowSteps = productionWorkflowSteps(production.steps);
  const completedSteps = workflowSteps.filter((step) => step.status === "COMPLETED");
  const allStepsCompleted =
    workflowSteps.length > 0 && completedSteps.length === workflowSteps.length;
  const hasStockGarments = order.items.some((item) =>
    item.products.some((product) => product.itemSource === "FROM_STOCK"),
  );
  const hasGarmentPickStep = workflowSteps.some((step) => step.stepType === "GARMENT_PICK");
  const garmentQuery = trpc.production.garmentPick.useQuery(
    { productionId: production.id },
    {
      enabled: hasGarmentPickStep && !allStepsCompleted,
      refetchInterval: PRODUCTION_REFRESH_INTERVAL_MS,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  );
  const garmentDataStale = garmentQuery.isError && Boolean(garmentQuery.data);
  const garmentEvidence: GarmentControlEvidence = allStepsCompleted
    ? { kind: "not-applicable" }
    : !hasStockGarments && !hasGarmentPickStep
      ? { kind: "not-applicable" }
      : hasStockGarments && !hasGarmentPickStep
      ? {
          kind: "unknown",
          reason: "ใบเก่านี้ไม่มีขั้นเตรียมเสื้อ จึงต้องตรวจเสื้อจริงก่อนเริ่มงาน",
        }
        : garmentQuery.isLoading
        ? { kind: "unknown", reason: "กำลังตรวจหลักฐานการเบิกเสื้อ" }
        : garmentDataStale
          ? {
              kind: "unknown",
              reason: "ข้อมูลเสื้ออาจไม่สด — โหลดข้อมูลล่าสุดให้สำเร็จก่อนตัดสินว่างานพร้อม",
            }
        : garmentQuery.isError && !garmentQuery.data
          ? { kind: "unknown", reason: "โหลดหลักฐานการเบิกเสื้อไม่ได้" }
          : !garmentQuery.data || garmentQuery.data.lines.length === 0
            ? {
                kind: "unknown",
                reason: "ไม่พบรายการเสื้อที่ตรวจยอดจากสต๊อคได้",
              }
            : garmentQuery.data.problems.length > 0
              ? {
                  kind: "unknown",
                  reason: garmentQuery.data.problems.join(" · "),
                }
              : {
                  kind: "known",
                  summary: summarizeGarmentControl(garmentQuery.data.lines),
                };
  const garment = garmentEvidence.kind === "known" ? garmentEvidence.summary : null;
  const control = buildProductionControlView(workflowSteps, garmentEvidence);
  const attention = control.attention;
  const overallDisplay =
    garmentQuery.isLoading &&
    hasGarmentPickStep &&
    attention?.kind !== "step" &&
    control.overallTone !== "danger"
      ? { label: "กำลังตรวจข้อมูล", tone: "neutral" as const }
      : { label: control.overallLabel, tone: control.overallTone };
  const totalQty = order.items.reduce((sum, item) => sum + item.totalQuantity, 0);
  const latestMockup = order.designs[0] ?? null;
  const mockupCount = latestMockup ? mockupImageCount(latestMockup) : 0;
  const attentionStep = attention?.step ?? null;
  const missingGarmentLines = garment?.lines.filter(
    (line) => line.issued - line.returned < line.needed,
  ) ?? [];
  const firstMissingGarment = missingGarmentLines[0];
  const selectedGarmentLine = firstMissingGarment ?? garment?.lines[0] ?? null;
  const aggregateGarmentMetrics = (garment?.lines.length ?? 0) > 1;
  const preferredStepId =
    attentionStep?.id ??
    workflowSteps.find((step) => ["FAILED", "ON_HOLD", "IN_PROGRESS"].includes(step.status))?.id ??
    workflowSteps.find((step) => step.status !== "COMPLETED")?.id ??
    workflowSteps.at(-1)?.id ??
    "";
  const [requestedStepId, setRequestedStepId] = useState(preferredStepId);
  const requestedStepIndex = workflowSteps.findIndex((step) => step.id === requestedStepId);
  const preferredStepIndex = Math.max(
    0,
    workflowSteps.findIndex((step) => step.id === preferredStepId),
  );
  const selectedStepIndex = requestedStepIndex >= 0 ? requestedStepIndex : preferredStepIndex;
  const selectedStep = workflowSteps[selectedStepIndex] ?? null;
  const selectedRow = selectedStep
    ? control.rows.find((row) => row.step.id === selectedStep.id) ?? null
    : null;
  const selectedIsGarment = selectedStep?.stepType === "GARMENT_PICK";
  const selectedHasAttention =
    attention?.kind === "garment-readiness"
      ? selectedIsGarment || !hasGarmentPickStep
      : attentionStep?.id === selectedStep?.id;
  const garmentQueryNotice = garmentQuery.isLoading && hasGarmentPickStep ? (
    <Skeleton className="h-24 rounded-lg" role="status" aria-label="กำลังตรวจหลักฐานการเบิกเสื้อ" />
  ) : hasGarmentPickStep && garmentQuery.isError && !garmentQuery.data ? (
    <section
      aria-labelledby="garment-readiness-error-title"
      className={cn(TINT.error, "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between")}
    >
      <div className="flex items-start gap-3 text-red-800 dark:text-red-200">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <h2 id="garment-readiness-error-title" className="font-semibold">ตรวจความพร้อมเสื้อไม่ได้</h2>
          <p className="mt-0.5 text-sm">ระบบจะไม่สรุปว่างานพร้อมจนกว่าจะโหลดหลักฐานการเบิกได้</p>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => void garmentQuery.refetch()}>
        ลองใหม่
      </Button>
    </section>
  ) : garmentDataStale ? (
    <section
      aria-label="คำเตือนข้อมูลเสื้อไม่สด"
      className={cn(TINT.warning, "flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between")}
    >
      <p role="alert" className="flex items-start gap-2 text-sm font-medium">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        ข้อมูลเสื้ออาจไม่สด — โหลดข้อมูลล่าสุดให้สำเร็จ และระบบจะยังไม่สรุปว่างานพร้อม
      </p>
      <Button type="button" variant="outline" size="sm" onClick={() => void garmentQuery.refetch()}>
        ลองโหลดข้อมูลล่าสุด
      </Button>
    </section>
  ) : null;
  const sortedCompletedSteps = [...completedSteps]
    .sort((left, right) => {
      const leftTime = left.completedAt ? new Date(left.completedAt).getTime() : 0;
      const rightTime = right.completedAt ? new Date(right.completedAt).getTime() : 0;
      return rightTime - leftTime;
    });
  const finalStep = sortedCompletedSteps[0] ?? null;
  const handoff = completedHandoff(order.internalStatus);
  const completionHandoffHref = `/orders/${order.id}?tab=${handoff.tab}`;

  return (
    <div
      data-production-control-record=""
      className="min-h-[calc(100dvh-4rem)] bg-bg px-4 py-5 sm:px-6 lg:px-8 lg:py-6"
    >
      <div className="mx-auto max-w-[78rem] space-y-5">
        <section className="card-surface overflow-hidden rounded-2xl">
          <div className="px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <nav aria-label="ตำแหน่งปัจจุบัน" className="flex items-center gap-1.5 text-xs text-muted">
                <Link
                  href={`/orders/${order.id}`}
                  className="inline-flex min-h-11 items-center font-medium text-blue-700 hover:underline dark:text-blue-300"
                >
                  ออเดอร์
                </Link>
                <span aria-hidden="true">/</span>
                <span>{order.orderNumber}</span>
              </nav>
              <ProductionFreshness
                updatedAt={dataUpdatedAt}
                isFetching={isFetching}
                stale={writeDataStale}
              />
            </div>

            <header className="mt-3 grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted">ข้อมูลงาน</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold text-strong">{order.orderNumber}</h1>
                  <StatusPill tone={allStepsCompleted ? "success" : overallDisplay.tone}>
                    {allStepsCompleted ? "ผลิตเสร็จแล้ว" : overallDisplay.label}
                  </StatusPill>
                </div>
                <p className="mt-1 break-words text-sm text-secondary">
                  {order.customer?.name || "ไม่ระบุลูกค้า"}
                </p>
                <dl className="mt-4 flex flex-wrap items-start gap-x-5 gap-y-3 text-sm">
                  <div className="min-w-24 border-r border-divider pr-5">
                    <dt className="text-xs font-medium text-muted">จำนวนผลิต</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-strong">
                      {totalQty.toLocaleString("th-TH")} ตัว
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted">กำหนดส่ง</dt>
                    <dd className={cn("mt-0.5 font-semibold", order.deadline ? "text-strong" : "text-amber-700 dark:text-amber-300")}>
                      {order.deadline ? formatDate(order.deadline) : "ยังไม่กำหนด"}
                    </dd>
                  </div>
                </dl>
                {!attention && !allStepsCompleted ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    ไม่มีปัญหาที่เปิดอยู่
                  </p>
                ) : null}
              </div>

              <div className="w-full sm:w-auto">
                <button
                  ref={mockupButtonRef}
                  type="button"
                  onClick={onOpenMockup}
                  className={cn(
                    "flex min-h-20 w-full items-center gap-3 px-2 py-2 text-left transition-colors hover:bg-interactive-hover sm:min-w-64",
                    RADIUS.item,
                    FOCUS_BUTTON,
                  )}
                  aria-label={
                    latestMockup
                      ? `เปิดม็อกอัพที่อนุมัติ เวอร์ชัน ${latestMockup.versionNumber} จำนวน ${mockupCount} รูป`
                      : "เปิดข้อมูลแบบและม็อกอัพ งานนี้ยังไม่มีม็อกอัพที่อนุมัติ"
                  }
                >
                  <MockupThumbnail
                    cover={latestMockup ? mockupCoverImage(latestMockup) : null}
                    alt={latestMockup ? `ม็อกอัพที่อนุมัติ v${latestMockup.versionNumber}` : "ม็อกอัพ"}
                    count={mockupCount}
                    size="lg"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-muted">แบบที่ใช้ผลิต</span>
                    <span className="mt-0.5 block text-sm font-semibold text-strong">
                      {latestMockup ? `ม็อกอัพอนุมัติ v${latestMockup.versionNumber}` : "ยังไม่มีม็อกอัพอนุมัติ"}
                    </span>
                    <span className="mt-0.5 block text-xs text-secondary">
                      {latestMockup ? `${mockupCount} รูป · เปิดดูทุกด้าน` : "เปิดดูแบบและสเปกที่มี"}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                </button>
              </div>
            </header>
          </div>

          {allStepsCompleted ? (
            <dl
              aria-label="สรุปการปิดงานผลิต"
              className="grid border-t border-divider md:grid-cols-2"
            >
              <div className="px-4 py-4 sm:px-5">
                <dt className="text-xs font-medium text-muted">ปิดงานเมื่อ</dt>
                <dd className="mt-1 font-semibold text-strong">
                  {finalStep?.completedAt ? formatDateTime(finalStep.completedAt) : "เวลาไม่ถูกบันทึก"}
                </dd>
                <p className="mt-1 text-xs text-muted">
                  {finalStep?.customStepName || control.rows.find((row) => row.step.id === finalStep?.id)?.label || "ครบทุกขั้นการผลิต"}
                </p>
              </div>
              <div className="border-t border-divider bg-blue-50/45 px-4 py-4 dark:bg-blue-950/20 md:border-l md:border-t-0 sm:px-5">
                <dt className="text-xs font-medium text-blue-700 dark:text-blue-300">ส่งต่องาน</dt>
                <dd className="mt-1 font-semibold text-strong">{handoff.label}</dd>
                <p className="mt-0.5 text-xs text-secondary">เจ้าของถัดไป: {handoff.owner}</p>
                <Button asChild size="sm" className="mt-3 w-full sm:w-auto">
                  <Link href={completionHandoffHref}>
                    เปิดขั้นตอนถัดไป
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </dl>
          ) : null}
        </section>

        {selectedStep && selectedRow ? (
          <section
            data-production-step-flow=""
            className="card-surface overflow-hidden rounded-2xl"
            aria-labelledby="selected-production-step-title"
          >
            <header className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0">
                <p className="text-2xs font-medium tabular-nums text-muted">
                  ขั้น {selectedStepIndex + 1} จาก {workflowSteps.length}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h2 id="selected-production-step-title" className="text-xl font-semibold text-strong">
                    {selectedRow.label}
                  </h2>
                  <StatusPill tone={selectedRow.tone}>{selectedRow.statusLabel}</StatusPill>
                </div>
                <p className="mt-1 text-sm text-secondary">จุดทำงาน {selectedRow.stationLabel}</p>
              </div>

              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto" role="group" aria-label="เปลี่ยนขั้นที่กำลังดู">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={selectedStepIndex === 0}
                  onClick={() => setRequestedStepId(workflowSteps[selectedStepIndex - 1]?.id ?? selectedStep.id)}
                >
                  <ArrowLeft />
                  ขั้นก่อนหน้า
                </Button>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={selectedStepIndex === workflowSteps.length - 1}
                  onClick={() => setRequestedStepId(workflowSteps[selectedStepIndex + 1]?.id ?? selectedStep.id)}
                >
                  ขั้นถัดไป
                  <ArrowRight />
                </Button>
              </div>
            </header>

            <ProductionRouteRail
              steps={workflowSteps}
              selectedStepId={selectedStep.id}
            />

            {selectedHasAttention && attention && (!selectedIsGarment || garmentQueryNotice === null) ? (
              <div
                className={cn(
                  "flex items-start gap-3 border-b border-divider px-4 py-3.5 sm:px-5",
                  attention.tone === "danger" ? TINT.error : TINT.warning,
                )}
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-strong">{attention.blocker}</p>
                  {attention.detail && attention.detail !== attention.blocker ? (
                    <p className="mt-0.5 text-sm text-secondary">{attention.detail}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {selectedIsGarment ? garmentQueryNotice : null}

            <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
              <div className="px-4 py-5 sm:px-5">
                {selectedIsGarment && garment ? (
                  <div className="mb-5">
                    {selectedGarmentLine ? (
                      <div className="mb-3">
                        <p className="font-semibold text-strong">
                          {missingGarmentLines.length > 1
                            ? `เสื้อขาด ${missingGarmentLines.length.toLocaleString("th-TH")} รายการ`
                            : selectedGarmentLine.productName}
                        </p>
                        <p className="mt-0.5 text-sm text-secondary">
                          {selectedGarmentLine.productName}
                          {selectedGarmentLine.size
                            ? ` · ไซส์ ${selectedGarmentLine.size}`
                            : ""}
                          {selectedGarmentLine.color
                            ? ` · สี ${selectedGarmentLine.color}`
                            : ""}
                        </p>
                      </div>
                    ) : null}
                    <dl className="grid grid-cols-3 divide-x divide-divider overflow-hidden rounded-lg border border-border text-center tabular-nums">
                      <div className="px-3 py-3">
                        <dt className="text-xs text-muted">{aggregateGarmentMetrics ? "ต้องใช้รวม" : "ต้องใช้"}</dt>
                        <dd className="mt-1 text-xl font-semibold text-strong">{garment.totalNeeded}</dd>
                      </div>
                      <div className="px-3 py-3">
                        <dt className="text-xs text-muted">{aggregateGarmentMetrics ? "เบิกสุทธิรวม" : "เบิกสุทธิ"}</dt>
                        <dd className="mt-1 text-xl font-semibold text-strong">{garment.netIssued}</dd>
                      </div>
                      <div className="px-3 py-3">
                        <dt className="text-xs text-muted">{aggregateGarmentMetrics ? "ยังขาดรวม" : "ยังขาด"}</dt>
                        <dd className={cn("mt-1 text-xl font-semibold", garment.missing > 0 ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-green-300")}>
                          {garment.missing}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : null}

                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-muted">ผลจริง</dt>
                    <dd className="mt-1 font-semibold tabular-nums text-strong">{selectedRow.actualLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted">ผู้รับผิดชอบ</dt>
                    <dd className={cn("mt-1 font-semibold", selectedStep.assignedTo ? "text-strong" : "text-muted")}>
                      {selectedRow.ownerLabel}
                    </dd>
                  </div>
                </dl>

                {canSupervise && selectedStep.status !== "COMPLETED" ? (
                  <div className="mt-5 flex flex-col items-start gap-3 border-t border-divider pt-4 sm:flex-row sm:flex-wrap sm:items-center">
                    <Button
                      type="button"
                      variant={selectedStep.status === "FAILED" ? "destructive" : "outline"}
                      className="w-full sm:w-auto"
                      disabled={writeDataStale}
                      onClick={() => onManageStep(selectedStep)}
                    >
                      <UserRound />
                      {selectedStep.status === "FAILED"
                        ? "จัดการปัญหา"
                        : selectedStep.assignedTo
                          ? "เปลี่ยนผู้รับผิดชอบ"
                          : "มอบหมายผู้รับผิดชอบ"}
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-divider bg-surface-muted px-4 py-5 lg:border-l lg:border-t-0 sm:px-5">
                <p className="text-xs font-medium text-muted">
                  {selectedStep.status === "COMPLETED" ? "หลักฐานการปิดขั้น" : "เงื่อนไขของขั้นนี้"}
                </p>
                {selectedStep.status === "COMPLETED" ? (
                  <>
                    <p className="mt-1 font-semibold text-strong">
                      {selectedStep.completedAt ? formatDateTime(selectedStep.completedAt) : "เวลาไม่ถูกบันทึก"}
                    </p>
                    <p className="mt-2 text-sm text-secondary">
                      {selectedStep.assignedTo
                        ? `ผู้รับผิดชอบ ${selectedStep.assignedTo.name}`
                        : "ไม่พบผู้รับผิดชอบในหลักฐานขั้นนี้"}
                    </p>
                  </>
                ) : (
                  <p
                    className={cn(
                      "mt-1 text-sm",
                      selectedRow.tone === "danger"
                        ? "font-medium text-red-700 dark:text-red-300"
                        : selectedRow.requiresAttention
                          ? "font-medium text-amber-800 dark:text-amber-200"
                          : selectedRow.blocker
                            ? "text-secondary"
                            : "text-muted",
                    )}
                  >
                    {selectedRow.blocker || "ไม่มีเงื่อนไขหรือปัญหาที่เปิดอยู่"}
                  </p>
                )}
                <p className="mt-4 border-t border-divider pt-3 text-xs text-muted">
                  ระบบบันทึกเวลาเสร็จและผู้รับผิดชอบ · ยังไม่รวมผู้กด ต้นทาง และเหตุผลแก้ไข
                </p>
              </div>
            </div>

          </section>
        ) : (
          <section className="card-surface rounded-2xl px-4 py-5 text-sm text-muted sm:px-5">
            ใบผลิตนี้ยังไม่มีขั้นตอน
          </section>
        )}
      </div>
    </div>
  );
}
