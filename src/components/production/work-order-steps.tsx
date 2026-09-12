import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DueTag } from "@/components/ui/due-tag";
import { Fact, FactList } from "@/components/ui/fact";
import { Section } from "@/components/ui/section";
import { TINT } from "@/components/ui/tokens";
import { latestPlainProductionNote } from "@/lib/production-problem";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { routeWaitingOn } from "@/lib/work-order-route";
import { currentRailNode, railNodesOf } from "@/lib/work-order-rail";
import { workOrderStandards } from "@/lib/work-order-standards";
import type { ProductionStep } from "./types";
import type { WorkOrderController } from "./work-order-controller";
import { GarmentPickCard } from "./garment-pick-card";
import { GarmentReceiveInline } from "./garment-receive-inline";
import { checklistAnchor, ChecklistCard } from "./work-order-checklist";
import { StepPieceTable } from "./work-order-quantities";
import { daysFromNow, StateChip, stepLabel, viewOf } from "./work-order-pieces";

export type WorkOrderVariant = "current" | "a" | "b";

type WorkOrderStepsProps = {
  variant?: WorkOrderVariant;
  c: WorkOrderController;
  current: ProductionStep | null;
  pairedOpen: ProductionStep[];
  allDone: boolean;
  qcAction: "paper" | "legacy" | null;
  /** ปุ่มของขั้นนั้น (ปุ่มดำเนินการ + แจ้งปัญหา) — วางท้ายกล่องของขั้นเอง ไม่ใช่บนหัวใบ (เบสสั่ง 2026-09-10) */
  stepFooter?: (step: ProductionStep) => ReactNode;
  /** ปุ่มมอบหมาย/แก้ให้ — วางในกล่องเช็คลิสต์ บรรทัดเดียวกับ "ผู้ทำ" */
  assignAction?: (step: ProductionStep) => ReactNode;
};

/** โครงฟอร์มเดิม: ตารางขั้นปัจจุบันซ้าย · เช็คลิสต์และข้อมูลใบขวา */
export function WorkOrderSteps({ c, current, pairedOpen, allDone, qcAction, stepFooter, assignAction, variant = "current" }: WorkOrderStepsProps) {
  const { production, order, workflowSteps, nowMs } = c;
  if (!production || !order) return null;
  const approvedMockup = order.designs[0]?.versionNumber ?? null;
  const afterProduction = ["PACKING", "READY_TO_SHIP", "SHIPPED", "COMPLETED"].includes(order.internalStatus);
  const nextTab = afterProduction ? "delivery" : "production";
  const nextLabel = order.internalStatus === "QUALITY_CHECK" ? "ไปตรวจ QC" : afterProduction ? "ดูการแพ็กและจัดส่ง" : "ดูงานผลิตทั้งออเดอร์";
  if (variant !== "current") {
    return <WorkOrderWorkspace c={c} current={current} pairedOpen={pairedOpen} allDone={allDone} qcAction={qcAction} stepFooter={stepFooter} assignAction={assignAction} variant={variant} />;
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <div className="min-w-0 space-y-5">
        {allDone || !current ? (
          <Section
            title="ครบทุกขั้นในใบนี้แล้ว"
            icon={CheckCircle2}
            tone="production"
            action={
              qcAction ? undefined : (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/orders/${order.id}?tab=${nextTab}`}>{nextLabel}</Link>
                </Button>
              )
            }
          >
            <FactList columns={2}>
              <Fact size="sm" label="ทำแล้ว" value={`${c.totalQty.toLocaleString("th-TH")} ตัว`} />
              <Fact size="sm" label="สถานะออเดอร์" value={INTERNAL_STATUS_LABELS[order.internalStatus]} />
            </FactList>
            {qcAction ? <p className="mt-3 text-sm text-secondary">กด “ส่งเข้า QC” เพื่อยืนยันใบนี้ ออเดอร์จะเข้า QC เมื่อทุกใบผลิตเสร็จ</p> : order.internalStatus === "PRODUCING" ? <p className="mt-3 text-sm text-secondary">ออเดอร์ยังอยู่ระหว่างผลิต เปิดดูงานทั้งออเดอร์เพื่อตรวจใบที่เหลือ</p> : null}
          </Section>
        ) : (
          <>
            {[current, ...pairedOpen].map((step) => (
              step.stepType === "GARMENT_PICK" ? (
                <div key={step.id} className="space-y-3">
                  <GarmentPickCard
                    productionId={production.id}
                    steps={workflowSteps}
                    stepId={step.id}
                    canIssueGarments={c.canUpdateStep && c.canOwnOrSupervise(step)}
                    canReturnGarments={c.canSuperviseStep && c.hasProductionPermission && !c.writeDataStale}
                    primaryTask
                    footer={stepFooter?.(step)}
                  />
                </div>
              ) : (
                <StepPieceTable
                  key={step.id}
                  step={step}
                  order={order}
                  c={c}
                  footer={stepFooter?.(step)}
                  // ตรวจรับเสื้อลูกค้า = นับจริงในกล่องเลย ไม่เด้ง dialog (เบสสั่ง 2026-09-10)
                  replaceBody={
                    step.stepType === "GARMENT_RECEIVE" ? (
                      <GarmentReceiveInline
                        orderId={order.id}
                        productionStepId={step.id}
                        canRecord={c.canUpdateStep && c.canOwnOrSupervise(step) && step.status !== "COMPLETED" && step.status !== "FAILED"}
                        canCorrect={c.canSuperviseStep && c.hasProductionPermission && step.status === "COMPLETED"}
                        footer={stepFooter?.(step)}
                      />
                    ) : undefined
                  }
                />
              )
            ))}
          </>
        )}
      </div>
      <aside className="space-y-5 xl:sticky xl:top-4">
        {!allDone
          ? [current, ...pairedOpen].filter((s): s is ProductionStep => !!s).map((s) => (
              <div key={s.id} id={checklistAnchor(s.id)}>
                <ChecklistCard step={s} c={c} nowMs={nowMs} showStepName={pairedOpen.length > 0} assignAction={assignAction?.(s)} />
              </div>
            ))
          : null}
        <Section title="ข้อมูลออเดอร์">
          <FactList columns={1}>
            <Fact label="ลูกค้า" value={order.customer?.name ?? "ไม่ระบุลูกค้า"} />
            <Fact label="กำหนดส่ง" value={order.deadline ? formatDate(order.deadline) : "ยังไม่กำหนดส่ง"} sub={order.deadline ? <DueTag dueInDays={daysFromNow(order.deadline, nowMs)} size="sm" /> : undefined} />
            <Fact label="จำนวนทั้งใบ" value={`${c.totalQty.toLocaleString("th-TH")} ตัว`} />
            <Fact
              label="ม็อกอัพอนุมัติ"
              value={approvedMockup !== null ? `v${approvedMockup}` : "ยังไม่มี"}
              tone={approvedMockup !== null ? "default" : "warning"}
              sub={order.designs[0]?.approvedAt ? formatDate(order.designs[0].approvedAt) : undefined}
            />
            {production.notes && latestPlainProductionNote(production.notes) ? <Fact label="หมายเหตุใบผลิต" value={<span className="[overflow-wrap:anywhere]">{latestPlainProductionNote(production.notes)}</span>} /> : null}
          </FactList>
        </Section>
      </aside>
    </div>
  );
}

/** อ่านได้ทุกขั้นโดยไม่เริ่มงาน ส่วนลงมือยังมีเฉพาะขั้นที่หน้าเดิมอนุญาต */
export function WorkOrderRouteOverview({ c, vertical = false }: { c: WorkOrderController; vertical?: boolean }) {
  const nodes = railNodesOf(c.workflowSteps);
  const currentIds = new Set((nodes[currentRailNode(nodes)] ?? []).map((step) => step.id));
  return (
    <nav aria-label="เส้นทางงาน · เปิดอ่านรายละเอียดโดยไม่เริ่มงาน">
      <ol className={cn(vertical ? "space-y-1" : "flex gap-2 overflow-x-auto pb-2")}>
        {c.workflowSteps.map((step, index) => {
          const view = step.status === "PENDING" && !currentIds.has(step.id)
            ? { label: "ยังไม่ถึง" }
            : viewOf(step, c.nowById.get(step.id));
          const waiting = routeWaitingOn(step, c.workflowSteps).map(stepLabel);
          const standards = workOrderStandards(step.stepType);
          const checked = standards.filter((label) => step.checks.some((check) => check.itemKey === label)).length;
          return (
            <li key={step.id} className={vertical ? "border-b border-divider last:border-b-0" : "min-w-44 flex-1"}>
              <details className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-start gap-3 rounded-lg px-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold", step.status === "COMPLETED" ? "border-green-600 text-green-700 dark:text-green-400" : "border-border text-secondary")}>{step.status === "COMPLETED" ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-strong">{stepLabel(step)}</span>
                    <span className="mt-1 block text-xs text-secondary">{view.label}</span>
                    {step.pairWithPrevious ? <span className="mt-1 block text-xs text-muted">ทำคู่กับขั้นก่อน</span> : null}
                  </span>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-90" aria-hidden="true" />
                </summary>
                <dl className="space-y-2 px-3 pb-4 text-xs text-secondary">
                  <div><dt className="text-muted">ผู้ทำ</dt><dd>{step.assignedTo?.name ?? "ยังไม่มอบหมาย"}</dd></div>
                  <div><dt className="text-muted">เริ่มทำ</dt><dd>{step.startedAt ? formatDateTime(step.startedAt) : "ยังไม่ได้เริ่ม"}</dd></div>
                  {step.qtyTotal !== null ? <div><dt className="text-muted">ทำแล้ว</dt><dd>{step.qtyDone ?? 0} / {step.qtyTotal} ตัว</dd></div> : null}
                  {standards.length > 0 ? <div><dt className="text-muted">ผลตรวจที่บันทึก</dt><dd>{checked} / {standards.length} ข้อ</dd></div> : null}
                  {waiting.length > 0 ? <div><dt className="text-muted">รอ</dt><dd>{waiting.join(" และ ")}</dd></div> : null}
                  {step.completedAt ? <div><dt className="text-muted">ปิดขั้น</dt><dd>{formatDateTime(step.completedAt)}</dd></div> : null}
                </dl>
              </details>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function WorkOrderWorkspace({ c, current, pairedOpen, allDone, qcAction, stepFooter, assignAction, variant }: WorkOrderStepsProps & { variant: "a" | "b" }) {
  const { order, production, nowMs } = c;
  if (!order || !production) return null;
  const displayed = [current, ...pairedOpen].filter((step): step is ProductionStep => !!step);
  return (
    <div className="space-y-6" data-work-order-variant={variant}>
      <FactList columns={4} className="grid-cols-2 rounded-lg border-y border-divider bg-surface-muted/35 px-4 py-4 sm:px-5">
        <Fact label="ออเดอร์" value={INTERNAL_STATUS_LABELS[order.internalStatus]} />
        <Fact label="กำหนดส่ง" value={order.deadline ? formatDate(order.deadline) : "ยังไม่กำหนดส่ง"} sub={order.deadline ? <DueTag dueInDays={daysFromNow(order.deadline, nowMs)} size="sm" /> : undefined} />
        <Fact label="จำนวนทั้งใบ" value={`${c.totalQty.toLocaleString("th-TH")} ตัว`} />
        <Fact label="ม็อกอัพอนุมัติ" value={order.designs[0] ? `v${order.designs[0].versionNumber}` : "ยังไม่มี"} sub={order.designs[0]?.approvedAt ? formatDate(order.designs[0].approvedAt) : undefined} />
      </FactList>
      {production.notes && latestPlainProductionNote(production.notes) ? <p className="text-sm text-secondary">{latestPlainProductionNote(production.notes)}</p> : null}
      <div className={cn(variant === "b" && "grid items-start gap-7 lg:grid-cols-[230px_minmax(0,1fr)]")}>
        {variant === "b" ? (
          <>
            <details className="group/route min-w-0 border-b border-divider pb-3 lg:hidden">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-medium text-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                <span>เส้นทางงาน · ขั้นที่ {current ? c.workflowSteps.indexOf(current) + 1 : c.workflowSteps.length}/{c.workflowSteps.length}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-open/route:rotate-90" aria-hidden="true" />
              </summary>
              <div className="pt-3"><WorkOrderRouteOverview c={c} vertical /></div>
            </details>
            <aside className="hidden min-w-0 lg:sticky lg:top-4 lg:block">
              <h2 className="mb-1 text-sm font-semibold text-strong">เส้นทางงาน</h2>
              <p className="mb-3 text-xs text-secondary">เปิดดูรายละเอียดได้ โดยไม่เริ่มงาน</p>
              <WorkOrderRouteOverview c={c} vertical />
            </aside>
          </>
        ) : null}
        <div className="min-w-0 space-y-7">
          {allDone || !current ? <WorkOrderSteps c={c} current={current} pairedOpen={pairedOpen} allDone={allDone} qcAction={qcAction} stepFooter={stepFooter} assignAction={assignAction} /> : displayed.map((step) => (
            <section key={step.id} aria-labelledby={`work-order-task-${step.id}`} className={cn(variant === "b" ? "rounded-2xl border border-border bg-surface p-5" : "border-b border-divider pb-7 last:border-b-0")}>
              <header className={cn("mb-5 flex flex-wrap items-start justify-between gap-4 rounded-lg border-l-3 px-4 py-4 sm:px-5", TINT.info, "border-blue-600 dark:border-blue-400")}>
                <div>
                  <p className="mb-2 text-xs font-medium text-blue-700 dark:text-blue-300">ขั้นที่ {c.workflowSteps.indexOf(step) + 1} จาก {c.workflowSteps.length}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 id={`work-order-task-${step.id}`} className="scroll-mt-16 text-xl font-semibold text-strong">{stepLabel(step)}</h2>
                    <StateChip view={viewOf(step, c.nowById.get(step.id))} kind={step.outsourceOrders.length ? "outsource" : "inhouse"} />
                    {step.qtyTotal !== null && step.qtyTotal > 0 ? <span className="text-sm tabular-nums text-secondary"><strong className="font-semibold text-strong">{(step.qtyDone ?? 0).toLocaleString("th-TH")}</strong> / {step.qtyTotal.toLocaleString("th-TH")} ตัว</span> : null}
                  </div>
                </div>
                <div className="flex max-w-xl flex-wrap items-center gap-2 sm:pt-1">{step.stepType === "GARMENT_RECEIVE" || step.stepType === "GARMENT_PICK" ? null : stepFooter?.(step)}</div>
              </header>
              <div className={cn("grid items-start gap-6", variant === "a" ? "lg:grid-cols-[minmax(0,1fr)_310px]" : "xl:grid-cols-[minmax(0,1fr)_290px]")}>
                <div className="min-w-0">
                  {step.stepType === "GARMENT_PICK" ? <GarmentPickCard productionId={production.id} steps={c.workflowSteps} stepId={step.id} canIssueGarments={c.canUpdateStep && c.canOwnOrSupervise(step)} canReturnGarments={c.canSuperviseStep && c.hasProductionPermission && !c.writeDataStale} primaryTask footer={stepFooter?.(step)} /> : (
                    <StepPieceTable step={step} order={order} c={c} presentation="embedded" replaceBody={step.stepType === "GARMENT_RECEIVE" ? <GarmentReceiveInline orderId={order.id} productionStepId={step.id} canRecord={c.canUpdateStep && c.canOwnOrSupervise(step) && step.status !== "COMPLETED" && step.status !== "FAILED"} canCorrect={c.canSuperviseStep && c.hasProductionPermission && step.status === "COMPLETED"} footer={stepFooter?.(step)} /> : undefined} />
                  )}
                </div>
                <div id={checklistAnchor(step.id)} className={cn("min-w-0 border-t border-divider pt-5", variant === "a" ? "lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" : "xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0")}>
                  <ChecklistCard step={step} c={c} nowMs={nowMs} assignAction={assignAction?.(step)} presentation="embedded" />
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
