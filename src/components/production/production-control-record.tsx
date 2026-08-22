"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  UserRound,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TINT } from "@/components/ui/tokens";
import type { ProductionDetail, ProductionStep } from "@/components/production/types";
import {
  buildProductionControlView,
  summarizeGarmentControl,
  type GarmentControlEvidence,
  type ProductionControlTone,
} from "@/lib/production-control";
import { productionWorkflowSteps } from "@/lib/production-steps";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

const TONE_CLASS: Record<ProductionControlTone, string> = {
  danger: "bg-red-50 text-red-700 dark:bg-red-950/45 dark:text-red-300",
  warning: "bg-amber-50 text-amber-800 dark:bg-amber-950/45 dark:text-amber-200",
  active: "bg-blue-50 text-blue-700 dark:bg-blue-950/45 dark:text-blue-300",
  success: "bg-green-50 text-green-700 dark:bg-green-950/45 dark:text-green-300",
  neutral: "bg-surface-muted text-secondary",
};

function StatusPill({ tone, children }: { tone: ProductionControlTone; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        TONE_CLASS[tone],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

function stationHref(productionId: string, target: { station: string | null } | null) {
  if (!target?.station) return null;
  const params = new URLSearchParams({
    station: target.station,
    productionId,
  });
  return `/factory/station?${params.toString()}`;
}

export function ProductionControlRecord({
  production,
  canSupervise,
  writeDataStale,
  onManageStep,
}: {
  production: ProductionDetail;
  canSupervise: boolean;
  writeDataStale: boolean;
  onManageStep: (step: ProductionStep) => void;
}) {
  const order = production.order;
  const workflowSteps = productionWorkflowSteps(production.steps);
  const hasStockGarments = order.items.some((item) =>
    item.products.some((product) => product.itemSource === "FROM_STOCK"),
  );
  const hasGarmentPickStep = workflowSteps.some((step) => step.stepType === "GARMENT_PICK");
  const garmentQuery = trpc.production.garmentPick.useQuery(
    { productionId: production.id },
    { enabled: hasGarmentPickStep },
  );
  const garmentDataStale = garmentQuery.isError && Boolean(garmentQuery.data);
  const garmentEvidence: GarmentControlEvidence = !hasStockGarments && !hasGarmentPickStep
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
  const completedSteps = workflowSteps.filter((step) => step.status === "COMPLETED");
  const totalQty = order.items.reduce((sum, item) => sum + item.totalQuantity, 0);
  const progressPercent = workflowSteps.length > 0
    ? Math.round((completedSteps.length / workflowSteps.length) * 100)
    : 0;
  const attentionStep = attention?.step ?? null;
  const attentionRow = attentionStep
    ? control.rows.find((row) => row.step.id === attentionStep.id) ?? null
    : null;
  const handoffHref = stationHref(production.id, attention);
  const manageTarget = attentionStep ?? workflowSteps.find((step) => step.status !== "COMPLETED") ?? null;
  const garmentAttention =
    attentionStep?.stepType === "GARMENT_PICK" &&
    !["FAILED", "ON_HOLD"].includes(attentionStep.status) &&
    attention?.blocker.startsWith("ยังไม่ได้เบิกเสื้อ") &&
    !!garment?.missing;
  const missingGarmentLines = garment?.lines.filter(
    (line) => line.issued - line.returned < line.needed,
  ) ?? [];
  const firstMissingGarment = missingGarmentLines[0];
  const aggregateGarmentMetrics = (garment?.lines.length ?? 0) > 1;
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
  const completedActivity = [...completedSteps]
    .sort((left, right) => {
      const leftTime = left.completedAt ? new Date(left.completedAt).getTime() : 0;
      const rightTime = right.completedAt ? new Date(right.completedAt).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 3);

  return (
    <div
      data-production-control-record=""
      className="min-h-[calc(100dvh-4rem)] bg-bg px-4 py-5 sm:px-6 lg:px-8 lg:py-6"
    >
      <div className="mx-auto max-w-[78rem] space-y-5">
        <section className="card-surface overflow-hidden rounded-lg">
          <div className="px-4 py-4 sm:px-5 sm:py-5">
            <nav aria-label="ตำแหน่งปัจจุบัน" className="flex items-center gap-1.5 text-xs text-muted">
              <Link href="/production" className="font-medium text-blue-700 hover:underline dark:text-blue-300">
                ควบคุมการผลิต
              </Link>
              <span aria-hidden="true">/</span>
              <span>{order.orderNumber}</span>
            </nav>

            <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold text-strong">{order.orderNumber}</h1>
                  <StatusPill tone={overallDisplay.tone}>{overallDisplay.label}</StatusPill>
                </div>
                <p className="mt-1 break-words text-sm text-secondary">
                  {[order.title, order.customer?.name].filter(Boolean).join(" · ") || "ไม่ระบุชื่องาน"}
                </p>
                {!attention ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    ไม่มีปัญหาที่เปิดอยู่
                  </p>
                ) : null}
              </div>

              {!attention && canSupervise && manageTarget ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled={writeDataStale}
                  onClick={() => onManageStep(manageTarget)}
                >
                  <UserRound />
                  {manageTarget.assignedTo ? "เปลี่ยนผู้รับผิดชอบ" : "มอบหมายผู้รับผิดชอบ"}
                </Button>
              ) : null}
            </header>
          </div>

          <dl
            aria-label="ข้อมูลใบผลิต"
            className="grid grid-cols-2 border-t border-divider sm:grid-cols-[minmax(0,1.4fr)_minmax(7rem,0.6fr)_minmax(9rem,0.75fr)]"
          >
            <div className="col-span-2 px-4 py-3.5 sm:col-span-1 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-2xs font-medium text-muted">ความคืบหน้า</dt>
                <dd className="text-sm font-semibold tabular-nums text-strong">
                  {completedSteps.length} จาก {workflowSteps.length} ขั้น
                </dd>
              </div>
              <div
                role="progressbar"
                aria-label="ความคืบหน้าการผลิต"
                aria-valuemin={0}
                aria-valuemax={workflowSteps.length || 1}
                aria-valuenow={completedSteps.length}
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"
              >
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
            <div className="border-l border-t border-divider px-4 py-3.5 sm:border-t-0">
              <dt className="text-2xs font-medium text-muted">จำนวนผลิต</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-strong">
                {totalQty.toLocaleString("th-TH")} ตัว
              </dd>
            </div>
            <div className="border-l border-t border-divider px-4 py-3.5 sm:border-t-0 sm:px-5">
              <dt className="text-2xs font-medium text-muted">กำหนดส่ง</dt>
              <dd className={cn("mt-1 text-sm font-semibold", order.deadline ? "text-strong" : "text-amber-700 dark:text-amber-300")}>
                {order.deadline ? formatDate(order.deadline) : "ยังไม่กำหนด"}
              </dd>
            </div>
          </dl>
        </section>

        {attention && (attention.kind === "step" || garmentQueryNotice === null) ? (
          <section
            aria-labelledby="production-attention-title"
            className={cn(
              "overflow-hidden rounded-lg border",
              attention.tone === "danger" ? TINT.error : TINT.warning,
            )}
          >
            <div className="grid md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid min-w-0 gap-4 px-4 py-4 min-[1200px]:grid-cols-[minmax(14rem,1fr)_minmax(16rem,0.9fr)] min-[1200px]:items-center min-[1200px]:px-5">
                <div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <h2 id="production-attention-title" className="text-lg font-semibold text-strong">
                      {attention.blocker}
                    </h2>
                  </div>
                  <p className="mt-1 pl-7 text-sm text-secondary">
                    {attention.kind === "garment-readiness"
                      ? attention.detail
                      : `${attention.label} ต้องให้หัวหน้าตัดสินใจ${attention.station ? ` · จุดทำงาน ${attention.stationLabel}` : ""}`}
                  </p>
                </div>

                {garmentAttention && firstMissingGarment ? (
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-strong">
                        {missingGarmentLines.length > 1
                          ? `เสื้อขาด ${missingGarmentLines.length.toLocaleString("th-TH")} รายการ`
                          : firstMissingGarment.productName}
                      </p>
                      <p className="mt-0.5 text-sm text-secondary">
                        {missingGarmentLines.length > 1 ? `${firstMissingGarment.productName} · ` : ""}
                        ไซส์ {firstMissingGarment.size}{firstMissingGarment.color ? ` · สี ${firstMissingGarment.color}` : ""}
                      </p>
                    </div>
                    <dl className="grid shrink-0 grid-cols-3 divide-x divide-divider overflow-hidden rounded-lg border border-border bg-surface text-center tabular-nums">
                      <div className="px-3 py-2">
                        <dt className="text-2xs text-muted">{aggregateGarmentMetrics ? "ต้องใช้รวม" : "ต้องใช้"}</dt>
                        <dd className="mt-0.5 text-lg font-semibold text-strong">{garment.totalNeeded}</dd>
                      </div>
                      <div className="px-3 py-2">
                        <dt className="text-2xs text-muted">{aggregateGarmentMetrics ? "เบิกสุทธิรวม" : "เบิกสุทธิ"}</dt>
                        <dd className="mt-0.5 text-lg font-semibold text-strong">{garment.netIssued}</dd>
                      </div>
                      <div className="px-3 py-2">
                        <dt className="text-2xs text-muted">{aggregateGarmentMetrics ? "ยังขาดรวม" : "ยังขาด"}</dt>
                        <dd className="mt-0.5 text-lg font-semibold text-amber-700 dark:text-amber-300">{garment.missing}</dd>
                      </div>
                    </dl>
                  </div>
                ) : attentionRow ? (
                  <dl className="grid grid-cols-2 gap-3 rounded-lg bg-surface px-3 py-3">
                    <div>
                      <dt className="text-2xs font-medium text-muted">ผลจริง</dt>
                      <dd className="mt-1 font-semibold tabular-nums text-strong">{attentionRow.actualLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-2xs font-medium text-muted">ผู้รับผิดชอบ</dt>
                      <dd className="mt-1 font-semibold text-strong">{attentionRow.ownerLabel}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="rounded-lg bg-surface px-3 py-2 text-sm text-secondary">
                    {attention.detail || "ยังไม่มีรายละเอียดเพิ่มเติม"}
                  </p>
                )}
              </div>

              <div className="flex min-w-52 flex-col justify-center gap-2 border-t border-divider px-4 py-4 md:border-l md:border-t-0">
                {canSupervise && attentionStep ? (
                  <Button
                    type="button"
                    variant={attentionStep.status === "FAILED" ? "default" : "outline"}
                    disabled={writeDataStale}
                    onClick={() => onManageStep(attentionStep)}
                  >
                    {attentionStep.status === "FAILED"
                      ? "จัดการปัญหา"
                      : attentionStep.assignedTo
                        ? "เปลี่ยนผู้รับผิดชอบ"
                        : "มอบหมายผู้รับผิดชอบ"}
                  </Button>
                ) : attention.kind === "garment-readiness" ? (
                  <p className="text-sm text-secondary">ตรวจเสื้อจริงก่อนส่งต่องาน</p>
                ) : (
                  <p className="text-sm text-secondary">รอหัวหน้ามอบหมายผู้รับผิดชอบ</p>
                )}
              </div>
            </div>
          </section>
        ) : garmentQueryNotice}

        {attention?.kind === "step" ? garmentQueryNotice : null}

        <div className="grid items-start gap-5 min-[1500px]:grid-cols-[minmax(0,1.75fr)_minmax(19rem,0.75fr)]">
          <section className="card-surface overflow-hidden rounded-lg" aria-labelledby="production-ledger-title">
            <header className="border-b border-divider px-4 py-4 sm:px-5">
              <h2 id="production-ledger-title" className="font-semibold text-strong">เส้นทางงาน</h2>
              <p className="mt-0.5 text-xs text-muted">ผลจริง ผู้รับผิดชอบ และสิ่งที่ต้องรอในแต่ละขั้น</p>
            </header>
            <div
              className="hidden grid-cols-[minmax(12rem,1.3fr)_7rem_7rem_minmax(9rem,0.85fr)_minmax(10rem,1fr)] gap-3 border-b border-divider bg-surface-muted px-5 py-2.5 text-2xs font-medium text-muted min-[1200px]:grid"
              aria-hidden="true"
            >
              <span>ขั้นตอน / จุดทำงาน</span>
              <span>สถานะ</span>
              <span>ผลจริง</span>
              <span>ผู้รับผิดชอบ</span>
              <span>เงื่อนไข / ปัญหา</span>
            </div>
            <ol className="divide-y divide-divider">
              {control.rows.map((row, index) => (
                <li
                  key={row.step.id}
                  className={cn(
                    "grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 sm:px-5 min-[1200px]:grid-cols-[minmax(12rem,1.3fr)_7rem_7rem_minmax(9rem,0.85fr)_minmax(10rem,1fr)] min-[1200px]:items-center min-[1200px]:gap-3",
                    row.tone === "danger"
                      ? "bg-red-50/60 dark:bg-red-950/20"
                      : row.requiresAttention
                        ? "bg-amber-50/60 dark:bg-amber-950/20"
                        : row.tone === "active"
                          ? "bg-blue-50/45 dark:bg-blue-950/15"
                          : "bg-surface",
                  )}
                >
                  <div className="col-span-2 flex min-w-0 items-center gap-3 min-[1200px]:col-span-1">
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-2xs font-semibold tabular-nums", TONE_CLASS[row.tone])}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-strong">{row.label}</p>
                      <p className="mt-0.5 text-2xs text-muted">{row.stationLabel}</p>
                    </div>
                  </div>
                  <dl className="contents">
                    <div>
                      <dt className="mb-1 text-2xs font-medium text-muted min-[1200px]:sr-only">สถานะ</dt>
                      <dd><StatusPill tone={row.tone}>{row.statusLabel}</StatusPill></dd>
                    </div>
                    <div>
                      <dt className="mb-1 text-2xs font-medium text-muted min-[1200px]:sr-only">ผลจริง</dt>
                      <dd className="whitespace-nowrap font-semibold tabular-nums text-secondary">{row.actualLabel}</dd>
                    </div>
                    <div className="col-span-2 sm:col-span-1 min-[1200px]:col-span-1">
                      <dt className="mb-1 text-2xs font-medium text-muted min-[1200px]:sr-only">ผู้รับผิดชอบ</dt>
                      <dd className={row.step.assignedTo ? "text-secondary" : "text-muted"}>{row.ownerLabel}</dd>
                    </div>
                    <div className="col-span-2 min-[1200px]:col-span-1">
                      <dt className="mb-1 text-2xs font-medium text-muted min-[1200px]:sr-only">เงื่อนไข / ปัญหา</dt>
                      <dd
                        className={cn(
                          row.tone === "danger"
                            ? "font-medium text-red-700 dark:text-red-300"
                            : row.requiresAttention
                              ? "font-medium text-amber-800 dark:text-amber-200"
                              : row.blocker
                                ? "text-secondary"
                                : "text-muted",
                        )}
                      >
                        {row.blocker || "ไม่มีปัญหา"}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ol>
          </section>

          <div className="grid gap-4">
            <section className="card-surface overflow-hidden rounded-lg" aria-labelledby="production-readiness-title">
              <header className="border-b border-divider px-4 py-3.5">
                <h2 id="production-readiness-title" className="font-semibold text-strong">ความพร้อม</h2>
                <p className="mt-0.5 text-xs text-muted">เงื่อนไขก่อนส่งต่องาน</p>
              </header>
              <div className="space-y-3 px-4 py-4">
                {control.garmentReadiness.status !== "not-applicable" ? (
                  <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted text-sm font-semibold tabular-nums text-secondary" aria-hidden="true">01</span>
                    <div className="min-w-0">
                      <p className="font-medium text-strong">เสื้อ</p>
                      <p className="truncate text-xs text-muted">{control.garmentReadiness.detail}</p>
                    </div>
                    <StatusPill tone={control.garmentReadiness.tone}>{control.garmentReadiness.statusLabel}</StatusPill>
                  </div>
                ) : null}
                {control.dtfReadiness ? (
                  <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted text-sm font-semibold tabular-nums text-secondary" aria-hidden="true">02</span>
                    <div className="min-w-0">
                      <p className="font-medium text-strong">ฟิล์ม DTF</p>
                      <p className="truncate text-xs text-muted">{control.dtfReadiness.detail}</p>
                    </div>
                    <StatusPill tone={control.dtfReadiness.tone}>{control.dtfReadiness.statusLabel}</StatusPill>
                  </div>
                ) : null}
                {control.garmentReadiness.status === "not-applicable" && !control.dtfReadiness ? (
                  <p className="flex items-start gap-2 text-sm text-secondary">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700 dark:text-green-300" aria-hidden="true" />
                    ไม่มีเงื่อนไขเสื้อหรือฟิล์ม DTF ก่อนส่งต่องาน
                  </p>
                ) : null}
              </div>
              {handoffHref ? (
                <div className="border-t border-divider px-4 py-4">
                  <p className="mb-2 text-sm text-secondary">งานปฏิบัติจริงอยู่ที่ <strong>สถานี{attention?.stationLabel}</strong></p>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={handoffHref}>เปิดบริบทสถานี <ArrowRight /></Link>
                  </Button>
                </div>
              ) : null}
            </section>

            <section className="card-surface overflow-hidden rounded-lg" aria-labelledby="production-activity-title">
              <header className="border-b border-divider px-4 py-3.5">
                <h2 id="production-activity-title" className="font-semibold text-strong">กิจกรรมและหลักฐาน</h2>
                <p className="mt-0.5 text-xs text-muted">เหตุการณ์ล่าสุดของใบผลิตนี้</p>
              </header>
              <div className="space-y-3 px-4 py-4">
                {completedActivity.map((step) => (
                  <div key={step.id} className="grid grid-cols-[0.75rem_minmax(0,1fr)] gap-2">
                    <span className="mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-blue-600 bg-surface" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-strong">
                        {step.customStepName || control.rows.find((row) => row.step.id === step.id)?.label} เสร็จแล้ว
                      </p>
                      <p className="mt-0.5 text-2xs text-muted">
                        {step.completedAt ? formatDateTime(step.completedAt) : "เวลาไม่ถูกบันทึก"}
                        {step.assignedTo ? ` · ผู้รับผิดชอบ ${step.assignedTo.name}` : " · ไม่พบผู้รับผิดชอบ"}
                      </p>
                    </div>
                  </div>
                ))}
                {completedActivity.length === 0 ? (
                  <p className="text-sm text-muted">ยังไม่มีกิจกรรมเสร็จงานของใบผลิตนี้</p>
                ) : null}
                <div className="border-t border-divider pt-3 text-2xs text-muted">
                  <p className="font-medium text-secondary">หลักฐานที่ระบบบันทึกตอนนี้</p>
                  <p className="mt-0.5">เวลาเสร็จและผู้รับผิดชอบ · ยังไม่รวมผู้กด ต้นทาง และเหตุผลแก้ไข</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
