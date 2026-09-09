import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DueTag } from "@/components/ui/due-tag";
import { Fact, FactList } from "@/components/ui/fact";
import { Section } from "@/components/ui/section";
import { latestPlainProductionNote } from "@/lib/production-problem";
import { formatDate } from "@/lib/utils";
import type { ProductionStep } from "./types";
import type { WorkOrderController } from "./work-order-controller";
import { GarmentPickCard } from "./garment-pick-card";
import { GarmentReceiveInline } from "./garment-receive-inline";
import { DtfPrintCard } from "./dtf-print-card";
import { OutsourceStepCard } from "./outsource-step-card";
import { isOutsourceStep } from "@/lib/production-steps";
import { checklistAnchor, ChecklistCard } from "./work-order-checklist";
import { StepPieceTable } from "./work-order-quantities";
import { daysFromNow } from "./work-order-pieces";

type WorkOrderStepsProps = {
  c: WorkOrderController;
  current: ProductionStep | null;
  pairedOpen: ProductionStep[];
  allDone: boolean;
  qcAction: "complete" | "legacy" | null;
  /** ปุ่มของขั้นนั้น (ปุ่มดำเนินการ + แจ้งปัญหา) — วางท้ายกล่องของขั้นเอง ไม่ใช่บนหัวใบ (เบสสั่ง 2026-09-10) */
  stepFooter?: (step: ProductionStep) => ReactNode;
  /** ปุ่มมอบหมาย/แก้ให้ — วางในกล่องเช็คลิสต์ บรรทัดเดียวกับ "ผู้ทำ" */
  assignAction?: (step: ProductionStep) => ReactNode;
};

/** โครงฟอร์มเดิม: ตารางขั้นปัจจุบันซ้าย · เช็คลิสต์และข้อมูลใบขวา */
export function WorkOrderSteps({ c, current, pairedOpen, allDone, qcAction, stepFooter, assignAction }: WorkOrderStepsProps) {
  const { production, order, workflowSteps, nowMs } = c;
  if (!production || !order) return null;
  const approvedMockup = order.designs[0]?.versionNumber ?? null;
  const afterQc = ["PACKING", "READY_TO_SHIP", "SHIPPED", "COMPLETED"].includes(order.internalStatus);
  const nextHref = afterQc ? `/orders/${order.id}?tab=delivery` : order.internalStatus === "QUALITY_CHECK" ? `/orders/${order.id}?tab=production` : "/production";
  const nextText = afterQc ? "ไปหน้าแพ็กและส่ง" : order.internalStatus === "QUALITY_CHECK" ? "ไปหน้า QC" : "ดูใบผลิตที่เหลือ";
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <div className="min-w-0 space-y-5">
        {allDone || !current ? (
          <Section
            title="ครบทุกขั้นแล้ว"
            icon={CheckCircle2}
            tone="production"
            action={
              qcAction ? undefined : (
                <Button asChild size="sm" variant="outline">
                  <a href={nextHref}>{nextText}</a>
                </Button>
              )
            }
          >
            <FactList columns={2}>
              <Fact size="sm" label="ทำแล้ว" value={`${c.totalQty.toLocaleString("th-TH")} ตัว`} />
              <Fact size="sm" label="ตอนนี้" value={qcAction ? "รอส่งเข้า QC" : order.internalStatus === "QUALITY_CHECK" ? "รอตรวจ QC" : afterQc ? "ผ่าน QC แล้ว" : "รอใบผลิตอื่นให้ครบ"} />
            </FactList>
          </Section>
        ) : (
          <>
            {[current, ...pairedOpen].map((step) => (
              isOutsourceStep(step.stepType) || step.executionMode === "OUTSOURCE" || step.outsourceOrders.length > 0 ? (
                <OutsourceStepCard key={step.id} step={step} orderId={order.id} canCreate={c.canOutsource} enabled={c.canUpdateStep && c.canOwnOrSupervise(step)} canCancelDraft={c.canSuperviseStep} />
              ) : step.stepType === "DTF_PRINT" ? (
                <DtfPrintCard key={step.id} stepId={step.id} canOperate={c.hasProductionPermission && c.canOwnOrSupervise(step) && !c.writeDataStale} />
              ) : step.stepType === "GARMENT_PICK" ? (
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
            <Fact label="กำหนดส่ง" value={<DueTag dueInDays={daysFromNow(order.deadline, nowMs)} dateLabel={order.deadline ? formatDate(order.deadline) : null} size="sm" />} />
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
