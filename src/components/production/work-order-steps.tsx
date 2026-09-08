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
import { checklistAnchor, ChecklistCard } from "./work-order-checklist";
import { StepPieceTable } from "./work-order-quantities";
import { daysFromNow } from "./work-order-pieces";

type WorkOrderStepsProps = {
  c: WorkOrderController;
  current: ProductionStep | null;
  pairedOpen: ProductionStep[];
  allDone: boolean;
  qcAction: "paper" | "legacy" | null;
  actionFor: (step: ProductionStep) => ReactNode;
};

/** โครงฟอร์มเดิม: ตารางขั้นปัจจุบันซ้าย · เช็คลิสต์และข้อมูลใบขวา */
export function WorkOrderSteps({ c, current, pairedOpen, allDone, qcAction, actionFor }: WorkOrderStepsProps) {
  const { production, order, workflowSteps, nowMs } = c;
  if (!production || !order) return null;
  const approvedMockup = order.designs[0]?.versionNumber ?? null;
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
                  <a href={`/orders/${order.id}?tab=qc`}>ไปหน้า QC</a>
                </Button>
              )
            }
          >
            <FactList columns={2}>
              <Fact size="sm" label="ทำแล้ว" value={`${c.totalQty.toLocaleString("th-TH")} ตัว`} />
              <Fact size="sm" label="ตอนนี้" value={qcAction ? "รอส่งเข้า QC" : "อยู่ที่ QC"} />
            </FactList>
          </Section>
        ) : (
          <>
            {[current, ...pairedOpen].map((step, index) => (
              step.stepType === "GARMENT_PICK" ? (
                <div key={step.id} className="space-y-3">
                  {index > 0 ? <div className="flex justify-end">{actionFor(step)}</div> : null}
                  <GarmentPickCard
                    productionId={production.id}
                    steps={workflowSteps}
                    stepId={step.id}
                    canIssueGarments={c.canUpdateStep && c.canOwnOrSupervise(step)}
                    canReturnGarments={c.canSuperviseStep && c.hasProductionPermission && !c.writeDataStale}
                    embedded
                    primaryTask
                  />
                </div>
              ) : (
                <StepPieceTable key={step.id} step={step} order={order} c={c} stepAction={index > 0 ? actionFor(step) : undefined} />
              )
            ))}
          </>
        )}
      </div>
      <aside className="space-y-5 xl:sticky xl:top-4">
        {!allDone
          ? [current, ...pairedOpen].filter((s): s is ProductionStep => !!s).map((s) => (
              <div key={s.id} id={checklistAnchor(s.id)}>
                <ChecklistCard step={s} c={c} nowMs={nowMs} showStepName={pairedOpen.length > 0} />
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
