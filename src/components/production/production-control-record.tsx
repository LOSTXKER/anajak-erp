"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Factory,
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

function DataGap({ children }: { children: string }) {
  return (
    <span className="inline-flex w-fit rounded-md border border-dashed border-border-strong bg-surface-muted px-2 py-1 text-2xs font-medium text-muted">
      {children}
    </span>
  );
}

function IdentityCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-20 min-w-0 flex-col justify-center gap-1 border-divider px-4 py-3 [&:nth-child(even)]:border-l [&:nth-child(n+3)]:border-t sm:border-l sm:border-t-0 sm:first:border-l-0 sm:[&:nth-child(4)]:border-l-0 sm:[&:nth-child(n+4)]:border-t xl:border-t-0 xl:[&:nth-child(4)]:border-l xl:[&:nth-child(n+4)]:border-t-0">
      <dt className="text-2xs font-medium text-muted">{label}</dt>
      <dd className="min-w-0 text-sm font-semibold text-strong">{children}</dd>
    </div>
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
  const overallDisplay =
    garmentQuery.isLoading && hasGarmentPickStep && control.overallTone !== "danger"
      ? { label: "กำลังตรวจข้อมูล", tone: "neutral" as const }
      : { label: control.overallLabel, tone: control.overallTone };
  const completedSteps = workflowSteps.filter((step) => step.status === "COMPLETED");
  const totalQty = order.items.reduce((sum, item) => sum + item.totalQuantity, 0);
  const attention = control.attention;
  const attentionStep = attention?.step ?? null;
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
      <div className="mx-auto max-w-[78rem] space-y-4">
        <nav aria-label="ตำแหน่งปัจจุบัน" className="flex items-center gap-1.5 text-xs text-muted">
          <Link href="/production" className="font-medium text-blue-700 hover:underline dark:text-blue-300">
            ควบคุมการผลิต
          </Link>
          <span aria-hidden="true">/</span>
          <span>{order.orderNumber}</span>
        </nav>

        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-strong">{order.orderNumber}</h1>
            <p className="mt-1 break-words text-sm text-secondary">
              {[order.title, order.customer?.name].filter(Boolean).join(" · ") || "ไม่ระบุชื่องาน"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {handoffHref ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href={handoffHref}>
                  <Factory />
                  เปิดที่สถานี{attention?.stationLabel}
                </Link>
              </Button>
            ) : null}
            {!attention && canSupervise && manageTarget ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={writeDataStale}
                onClick={() => onManageStep(manageTarget)}
              >
                <UserRound />
                มอบหมายงาน
              </Button>
            ) : null}
          </div>
        </header>

        <dl aria-label="ข้อมูลใบผลิต" className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-surface shadow-sm sm:grid-cols-3 xl:grid-cols-5">
          <IdentityCell label="สถานะใบผลิต">
            <StatusPill tone={overallDisplay.tone}>{overallDisplay.label}</StatusPill>
          </IdentityCell>
          <IdentityCell label="จำนวนผลิต">
            <span className="text-lg tabular-nums">{totalQty.toLocaleString("th-TH")} ตัว</span>
          </IdentityCell>
          <IdentityCell label="ความคืบหน้า">
            <span className="tabular-nums">{completedSteps.length} / {workflowSteps.length} ขั้น</span>
          </IdentityCell>
          <IdentityCell label="กำหนดส่ง">
            {order.deadline ? formatDate(order.deadline) : <DataGap>ยังไม่กำหนด</DataGap>}
          </IdentityCell>
          <IdentityCell label="ผู้รับผิดชอบหลัก">
            <DataGap>ยังไม่มีข้อมูลระดับใบผลิต</DataGap>
          </IdentityCell>
        </dl>

        {garmentDataStale ? (
          <section
            aria-label="คำเตือนข้อมูลเสื้อไม่สด"
            className={cn(TINT.warning, "flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between")}
          >
            <p role="alert" className="flex items-start gap-2 text-sm font-medium">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              โหลดข้อมูลเสื้อล่าสุดไม่สำเร็จ ตัวเลขที่เห็นอาจเป็นข้อมูลเก่า และระบบจะยังไม่สรุปว่างานพร้อม
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void garmentQuery.refetch()}>
              ลองโหลดข้อมูลล่าสุด
            </Button>
          </section>
        ) : null}

        {garmentQuery.isLoading && hasGarmentPickStep ? (
          <Skeleton className="h-36 rounded-xl" role="status" aria-label="กำลังตรวจหลักฐานการเบิกเสื้อ" />
        ) : hasGarmentPickStep && garmentQuery.isError && !garmentQuery.data ? (
          <section
            aria-labelledby="garment-readiness-error-title"
            className={cn(TINT.error, "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between")}
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
        ) : attention ? (
          <section
            aria-labelledby="production-attention-title"
            className={cn(
              "grid overflow-hidden rounded-xl border bg-surface shadow-sm md:grid-cols-[0.4rem_minmax(0,1fr)_auto]",
              attention.tone === "danger" ? "border-red-200 dark:border-red-900" : "border-amber-200 dark:border-amber-900",
            )}
          >
            <div className={attention.tone === "danger" ? "bg-red-500" : "bg-amber-500"} />
            <div className="grid min-w-0 gap-4 px-4 py-4 lg:grid-cols-[minmax(14rem,1fr)_minmax(18rem,1.2fr)] lg:items-center lg:px-5">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    className={cn(
                      "h-5 w-5 shrink-0",
                      attention.tone === "danger"
                        ? "text-red-700 dark:text-red-300"
                        : "text-amber-700 dark:text-amber-300",
                    )}
                    aria-hidden="true"
                  />
                  <h2 id="production-attention-title" className="text-lg font-semibold text-strong">
                    {attention.blocker}
                  </h2>
                </div>
                <p className="mt-1 text-sm text-secondary">
                  {attention.kind === "garment-readiness"
                    ? attention.detail
                    : `${attention.label} ยังไปต่อไม่ได้${attention.station ? ` · จุดทำงาน ${attention.stationLabel}` : " · ต้องให้หัวหน้ากำหนดเส้นทาง"}`}
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
                    <p className="mt-0.5 text-sm text-muted">
                      {missingGarmentLines.length > 1 ? `${firstMissingGarment.productName} · ` : ""}
                      ไซส์ {firstMissingGarment.size}{firstMissingGarment.color ? ` · สี ${firstMissingGarment.color}` : ""}
                    </p>
                  </div>
                  <dl className="grid shrink-0 grid-cols-3 divide-x divide-divider overflow-hidden rounded-lg border border-border bg-surface-muted text-center tabular-nums">
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
              ) : (
                <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-secondary">
                  {attention.detail || "ยังไม่มีรายละเอียดเพิ่มเติม"}
                </p>
              )}
            </div>
            <div className="flex min-w-52 flex-col justify-center gap-2 border-t border-divider px-4 py-4 md:border-l md:border-t-0">
              {canSupervise && attentionStep ? (
                <Button
                  type="button"
                  disabled={writeDataStale}
                  onClick={() => onManageStep(attentionStep)}
                >
                  {attentionStep.status === "FAILED" ? "จัดการปัญหา" : "มอบหมายงาน"}
                </Button>
              ) : attention.kind === "garment-readiness" ? (
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  ตรวจเสื้อจริงและแก้ข้อมูลเส้นทางก่อนส่งต่อสถานี
                </p>
              ) : (
                <p className="text-sm text-muted">รอหัวหน้ามอบหมายผู้แก้ไข</p>
              )}
              <p className="text-center text-2xs text-muted">อายุปัญหาและ SLA: ยังไม่มีข้อมูล</p>
            </div>
          </section>
        ) : (
          <section className={cn(TINT.success, "flex items-start gap-3 rounded-xl border px-4 py-3")}>
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">ยังไม่มีข้อยกเว้นที่ต้องจัดการ</h2>
              <p className="mt-0.5 text-sm">ติดตามผลจริงและ handoff ของแต่ละขั้นจากตารางด้านล่าง</p>
            </div>
          </section>
        )}

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(18rem,0.75fr)]">
          <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm" aria-labelledby="production-ledger-title">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-divider px-4 py-3.5">
              <div>
                <h2 id="production-ledger-title" className="font-semibold text-strong">สถานะทุกขั้นตอน</h2>
                <p className="mt-0.5 text-xs text-muted">ภาพควบคุมทั้งใบ — ไม่ใช่จอปฏิบัติงานของสถานี</p>
              </div>
              <DataGap>แผนต่อขั้น: ข้อมูลที่ต้องเพิ่ม</DataGap>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-sm">
                <thead className="bg-surface-muted text-left text-2xs font-medium text-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2.5">ขั้นตอน / จุดทำงาน</th>
                    <th scope="col" className="px-3 py-2.5">สถานะ</th>
                    <th scope="col" className="px-3 py-2.5">ผลจริง</th>
                    <th scope="col" className="px-3 py-2.5">ผู้รับผิดชอบ</th>
                    <th scope="col" className="px-3 py-2.5">เงื่อนไข / ปัญหา</th>
                  </tr>
                </thead>
                <tbody>
                  {control.rows.map((row, index) => (
                    <tr key={row.step.id} className="border-t border-divider first:border-t-0">
                      <td className="px-3 py-3" aria-label={`${row.label} จุดทำงาน ${row.stationLabel}`}>
                        <div className="flex min-w-44 items-center gap-2">
                          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-2xs font-semibold tabular-nums", TONE_CLASS[row.tone])}>
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <p className="font-semibold text-strong">{row.label}</p>
                            <p className="text-2xs text-muted">{row.stationLabel}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3"><StatusPill tone={row.tone}>{row.statusLabel}</StatusPill></td>
                      <td className="whitespace-nowrap px-3 py-3 font-medium tabular-nums text-secondary">{row.actualLabel}</td>
                      <td className="px-3 py-3">
                        {row.step.assignedTo ? (
                          <span className="text-secondary">{row.ownerLabel}</span>
                        ) : (
                          <DataGap>ยังไม่มอบหมาย</DataGap>
                        )}
                      </td>
                      <td className="max-w-64 px-3 py-3">
                        <span className={row.blocker ? "font-medium text-amber-800 dark:text-amber-200" : "text-muted"}>
                          {row.blocker || "ไม่มีปัญหาที่เปิดอยู่"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-4">
            <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm" aria-labelledby="production-readiness-title">
              <header className="border-b border-divider px-4 py-3.5">
                <h2 id="production-readiness-title" className="font-semibold text-strong">ความพร้อม</h2>
                <p className="mt-0.5 text-xs text-muted">เฉพาะเงื่อนไขที่กระทบงานใบนี้</p>
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
                  <p className="text-sm text-muted">ใบผลิตนี้ไม่มีเงื่อนไขเสื้อหรือฟิล์ม DTF</p>
                ) : null}
              </div>
              <div className="border-t border-divider px-4 py-4">
                {handoffHref ? (
                  <>
                    <p className="mb-2 text-sm text-secondary">งานปฏิบัติจริงอยู่ที่ <strong>สถานี{attention?.stationLabel}</strong></p>
                    <Button variant="outline" className="w-full" asChild>
                      <Link href={handoffHref}>เปิดบริบทสถานี <ArrowRight /></Link>
                    </Button>
                  </>
                ) : attention?.kind === "step" ? (
                  <p className="text-sm text-amber-800 dark:text-amber-200">งานนี้ยังไม่มีสถานีรองรับ ต้องให้หัวหน้ากำหนดเส้นทางก่อน</p>
                ) : (
                  <p className="text-sm text-muted">ยังไม่มี handoff ที่ต้องดำเนินการ</p>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm" aria-labelledby="production-activity-title">
              <header className="border-b border-divider px-4 py-3.5">
                <h2 id="production-activity-title" className="font-semibold text-strong">กิจกรรมและหลักฐาน</h2>
                <p className="mt-0.5 text-xs text-muted">ทุกการเปลี่ยนแปลงต้องมีที่มาและต้นทาง</p>
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
                <div className="rounded-lg border border-dashed border-border-strong bg-surface-muted px-3 py-2 text-2xs text-muted">
                  ผู้กดจริง · ต้นทาง ERP/Station · เหตุผลแก้ไข · หลักฐาน — ข้อมูลที่ต้องเพิ่ม
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
