"use client";

/**
 * หน้าลงมือของโหมดหน้างาน `/production/floor` — หนึ่งใบ หนึ่งขั้น หนึ่งปุ่ม (แบบ A · เบสเคาะ 2026-09-03)
 *   ซ้าย = ทำอะไร (ม็อกอัพ/ลายของขั้นนี้ · สินค้า/ไซซ์)  ·  ขวา = ขั้นนี้ (ตัวเลข → ปัญหา → ข้อกำหนดติ๊กทีละข้อ → ปุ่มหลักปุ่มเดียว)
 * เครื่องยนต์เดียวกับใบผลิต (work-order-controller): ปุ่มไหนกดได้มาจาก selectNowSteps · ทุก mutation เดินทางเดิม
 * แจ้งปัญหา = กดเลือกเหตุ ไม่ต้องพิมพ์ · หัวหน้ามี "แก้ให้" — dialog ทั้งสองอยู่ step-command-dialogs (ใบผลิตใช้ชุดเดียวกัน)
 */

import { useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Circle, Clock, Wrench } from "lucide-react";
import { ActionZone } from "@/components/ui/action-zone";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DueTag } from "@/components/ui/due-tag";
import { EmptyState } from "@/components/ui/empty-state";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { Skeleton } from "@/components/ui/skeleton";
import { RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
import { GarmentPickCard } from "@/components/production/garment-pick-card";
import { ProductionDesignCard } from "@/components/production/production-design-card";
import { FixDialog, ProblemDialog } from "@/components/production/step-command-dialogs";
import type { ProductionStep } from "@/components/production/types";
import { useWorkOrderController, type WorkOrderController } from "@/components/production/work-order-controller";
import { OutsourceFacts, Owner, ProblemCard, StateChip, daysFromNow, stepLabel, viewOf } from "@/components/production/work-order-pieces";
import { isOutsourceStep } from "@/lib/production-steps";
import type { StationDef } from "@/lib/station-desk";
import { PAPER_STEP_NOTE, RECORD_MODE_LABEL, isInferredDone, recordModeOf } from "@/lib/work-order-record-mode";
import { workOrderStandards } from "@/lib/work-order-standards";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { StationShell } from "./station-pieces";

const TICK_GATED = new Set(["complete", "record-qty", "quick-pass"]);

export function StationJob({
  productionId,
  stepId,
  station,
  boss,
  autoFix = false,
  onBack,
  who,
  clock,
}: {
  productionId: string;
  stepId: string | null;
  /** null = เปิดจากลิงก์ที่ไม่ระบุสถานี และหาในคิวไม่เจอ (ใบที่ไม่มีขั้นค้าง) */
  station: StationDef | null;
  boss: boolean;
  /** หัวหน้ากด "แก้ให้" จากการ์ดคิว — เปิด dialog แก้ให้ทันทีที่โหลดเสร็จ */
  autoFix?: boolean;
  onBack: () => void;
  who: ReactNode;
  clock: string | null;
}) {
  const c = useWorkOrderController(productionId);
  const { production, order, workflowSteps } = c;
  const step = workflowSteps.find((s) => s.id === stepId) ?? c.selectedStep;
  const loading = c.productionQuery.isLoading || c.meQuery.isLoading;

  return (
    <StationShell
      title={order?.orderNumber ?? "ใบผลิต"}
      eyebrow={step ? `${station?.label ?? "ใบผลิต"} — ${stepLabel(step)}` : (station?.label ?? "ใบผลิต")}
      onBack={onBack}
      backLabel="กลับคิว"
      who={who}
      clock={clock}
    >
      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      ) : c.notFound || !production || !order ? (
        <EmptyState icon={AlertTriangle} title="ไม่พบใบผลิตนี้แล้ว" description="อาจถูกปิดหรือส่งต่อไปแล้ว" action={<Button size="lg" onClick={onBack}>กลับไปดูคิว</Button>} />
      ) : !step ? (
        <EmptyState icon={AlertTriangle} title="ใบนี้ไม่มีขั้นที่สถานีนี้แล้ว" description="งานอาจถูกส่งต่อไปสถานีถัดไป" action={<Button size="lg" onClick={onBack}>กลับไปดูคิว</Button>} />
      ) : (
        <>
          <StationJobBody c={c} step={step} boss={boss} autoFix={autoFix} />
          {c.dialogs}
        </>
      )}
    </StationShell>
  );
}

/** ตัววาดของหน้าลงมือ — รับเครื่องยนต์เป็น props (probe/ทดสอบส่งของปลอมเข้ามาได้โดยไม่ต้องล็อกอิน) */
export function StationJobBody({ c, step, boss, autoFix = false }: { c: WorkOrderController; step: ProductionStep; boss: boolean; autoFix?: boolean }) {
  const { production, order, workflowSteps, nowById, nowMs } = c;
  if (!production || !order) return null;
  return (
    <>
      {c.writeDataStale ? (
        <Alert variant="warning" title="ข้อมูลล่าสุดอาจยังไม่ครบ" className="mb-4">
          กำลังแสดงข้อมูลเดิมที่โหลดไว้ — ปุ่มลงมือถูกปิดจนกว่าจะโหลดใหม่สำเร็จ
        </Alert>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* ซ้าย: ทำอะไร */}
        <div className="space-y-4">
          <div className={cn("card-surface p-4", RADIUS.surface)}>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="text-2xl font-semibold tabular-nums text-strong">{order.orderNumber}</p>
                <p className="text-sm text-secondary">{order.customer?.name ?? "ไม่ระบุลูกค้า"}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Metric value={c.totalQty.toLocaleString("th-TH")} unit="ตัว" label="ทั้งใบ" size="lg" />
                <DueTag dueInDays={daysFromNow(order.deadline, nowMs)} dateLabel={order.deadline ? formatDate(order.deadline) : null} size="lg" />
              </div>
            </div>
            {/* ลายอนุมัติ + ตำแหน่งพิมพ์ + ตารางไซซ์ของขั้นนี้ — การ์ดเดิมของใบผลิต (มีปุ่มขยายรูปเต็มจอ) */}
            <div className="mt-4 border-t border-border pt-4">
              <ProductionDesignCard order={order} embedded focusStepType={step.stepType} />
            </div>
          </div>
          {production.notes ? (
            <Alert variant="warning" title="หมายเหตุใบผลิต">
              {production.notes}
            </Alert>
          ) : null}
        </div>

        {/* ขวา: ขั้นนี้ */}
        <StepZone key={step.id} c={c} step={step} index={workflowSteps.indexOf(step) + 1} total={workflowSteps.length} boss={boss} autoFix={autoFix} nowMs={nowMs} nowById={nowById} productionId={production.id} />
      </div>
    </>
  );
}

function StepZone({
  c,
  step,
  index,
  total,
  boss,
  autoFix,
  nowMs,
  nowById,
  productionId,
}: {
  c: WorkOrderController;
  step: ProductionStep;
  index: number;
  total: number;
  boss: boolean;
  autoFix: boolean;
  nowMs: number;
  nowById: Map<string, ReturnType<WorkOrderController["nowById"]["get"]>>;
  productionId: string;
}) {
  const now = nowById.get(step.id);
  const view = viewOf(step, now);
  const standards = workOrderStandards(step.stepType);
  const [ticks, setTicks] = useState<boolean[]>(() => standards.map(() => step.status === "COMPLETED"));
  const [problemOpen, setProblemOpen] = useState(false);
  const [fixOpen, setFixOpen] = useState(autoFix);
  const allTicked = ticks.every(Boolean);
  const done = step.status === "COMPLETED";
  const stuck = step.status === "FAILED" || step.status === "ON_HOLD";
  // กระดาษเป็นหลัก (ROADMAP §A5): ขั้นที่จดบนกระดาษไม่มีปุ่มหลักให้ช่าง — ติ๊ก/ยอด/ลงชื่ออยู่บนใบสั่งงาน
  const recordMode = recordModeOf(step);
  const onPaper = recordMode === "paper" && !done && !stuck;
  const inferredDone = isInferredDone(step);
  const gated = !onPaper && !done && !stuck && TICK_GATED.has(now?.action ?? "") && !allTicked;

  const canReport = c.canUpdateStep && c.canOwnOrSupervise(step) && !done && step.status !== "FAILED";
  const note = done
    ? inferredDone
      ? `ถือว่าผ่านตอนส่งเข้า QC${step.completedAt ? ` ${formatDateTime(step.completedAt)}` : ""} — ยอดจริงอยู่บนใบสั่งงาน`
      : `ปิดขั้นแล้ว${step.completedAt ? ` ${formatDateTime(step.completedAt)}` : ""}${step.assignedTo ? ` โดย ${step.assignedTo.name}` : ""}`
    : onPaper && !(now && now.waitingOn.length > 0)
      ? PAPER_STEP_NOTE
    : stuck
      ? boss
        ? "ติดปัญหาอยู่ — กด “จัดการปัญหา” เพื่อปลดให้ช่างทำต่อ"
        : "ติดปัญหาอยู่ — รอหัวหน้าแก้ก่อน จึงทำต่อได้"
      : now && now.waitingOn.length > 0
        ? `รอ: ${now.waitingOn.join(" และ ")}`
        : now?.note
          ? now.note
          : !now
            ? "ยังไม่ถึงคิวขั้นนี้ — ทำขั้นก่อนหน้าให้จบก่อน"
            : gated
              ? "ติ๊กข้อกำหนดให้ครบก่อน ปุ่มหลักถึงจะกดได้"
              : undefined;

  const primary = onPaper ? null : gated ? (
    <Button className="h-16 text-lg" disabled>
      {now?.action === "quick-pass" ? "ผ่านรวด" : "บันทึกยอด / ปิดขั้น"}
    </Button>
  ) : (
    c.primaryButton(step, now, { touch: true })
  );

  return (
    <div className="space-y-4">
      <div className={cn("card-surface p-5", RADIUS.surface)}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">
              ขั้นที่ {index} จาก {total}
            </p>
            <h2 className="text-2xl font-semibold text-strong">{stepLabel(step)}</h2>
            <InfoChipRow className="mt-2">
              <StateChip view={view} kind={isOutsourceStep(step.stepType) ? "outsource" : "inhouse"} size="lg" />
              <InfoChip size="md" tone={recordMode === "screen" ? "info" : recordMode === "auto" ? "success" : "neutral"}>
                {inferredDone ? "ถือว่าผ่าน" : RECORD_MODE_LABEL[recordMode]}
              </InfoChip>
              <InfoChip size="md">
                <Owner step={step} />
              </InfoChip>
            </InfoChipRow>
          </div>
          {step.qtyTotal ? (
            <Metric label="ทำแล้ว" value={(step.qtyDone ?? 0).toLocaleString("th-TH")} unit={`/ ${step.qtyTotal.toLocaleString("th-TH")} ตัว`} size="lg" tone={(step.qtyDone ?? 0) >= step.qtyTotal ? "success" : "default"} />
          ) : null}
        </div>

        {stuck ? (
          <div className="mt-4">
            <ProblemCard step={step} />
          </div>
        ) : null}
        {step.outsourceOrders.length > 0 ? (
          <div className="mt-4">
            <OutsourceFacts step={step} nowMs={nowMs} />
          </div>
        ) : null}
        {step.printRunItems.length > 0 ? (
          <InfoChip tone="info" strong className="mt-4">
            อยู่ในรอบพิมพ์ {step.printRunItems[0]!.printRun.runNumber}
          </InfoChip>
        ) : null}
        {step.notes && !stuck ? <p className="mt-3 text-sm text-secondary">{step.notes}</p> : null}

        {step.stepType === "GARMENT_PICK" ? (
          <div className="mt-4">
            <GarmentPickCard
              productionId={productionId}
              steps={c.workflowSteps}
              stepId={step.id}
              canIssueGarments={c.canUpdateStep && c.canOwnOrSupervise(step) && !done}
              canReturnGarments={c.canSuperviseStep && c.hasProductionPermission && !c.writeDataStale}
              embedded
              primaryTask={now?.group === "current"}
            />
          </div>
        ) : null}

        {/* ข้อกำหนดของขั้น — ติ๊กทีละข้อด้วยปุ่มใหญ่ (ยังไม่บันทึกลงฐาน · ROADMAP §A) */}
        <div className="mt-5">
          <p className="flex items-center justify-between text-sm font-medium text-strong">
            <span>ข้อกำหนดของขั้นนี้</span>
            <span className="tabular-nums text-muted">
              {ticks.filter(Boolean).length}/{ticks.length}
            </span>
          </p>
          <ul className="mt-2 space-y-1.5">
            {standards.map((label, i) => {
              const on = ticks[i] ?? false;
              return (
                <li key={label}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={done || stuck}
                    onClick={() => setTicks((t) => t.map((v, k) => (k === i ? !v : v)))}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 px-3 text-left text-base transition-colors disabled:cursor-default",
                      RADIUS.inner,
                      SUNK_PANEL,
                      !done && !stuck && "hover:bg-interactive-hover",
                      on ? "text-secondary" : "font-medium text-strong",
                    )}
                  >
                    {on ? <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" /> : <Circle className="h-6 w-6 shrink-0 text-muted" aria-hidden="true" />}
                    <span className={on ? "line-through decoration-muted" : undefined}>{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* ไม่มีปุ่มที่กดไม่ได้ — ลงมือไม่ได้ให้ประโยคสถานะบอก (เบสเคาะ A 09-03) */}
      <ActionZone touch note={note} icon={done ? CheckCircle2 : stuck ? AlertTriangle : now ? Wrench : Clock} tone={done ? "success" : stuck ? "error" : now && !gated ? "info" : "neutral"}>
        {primary}
        {canReport ? (
          <Button variant="outline" className="h-16 text-lg" onClick={() => setProblemOpen(true)}>
            <AlertTriangle /> แจ้งปัญหา
          </Button>
        ) : null}
        {boss && c.canSuperviseStep && c.hasProductionPermission ? (
          <Button variant="outline" className="h-16 text-lg" onClick={() => setFixOpen(true)}>
            <Wrench /> แก้ให้
          </Button>
        ) : null}
      </ActionZone>

      <FactList columns={2}>
        <Fact label="เริ่มเมื่อ" value={step.startedAt ? formatDateTime(step.startedAt) : "ยังไม่เริ่ม"} tone={step.startedAt ? "default" : "muted"} size="sm" />
        <Fact label="เสร็จเมื่อ" value={step.completedAt ? formatDateTime(step.completedAt) : "ยังไม่เสร็จ"} tone={step.completedAt ? "success" : "muted"} size="sm" />
      </FactList>

      <ProblemDialog open={problemOpen} onClose={() => setProblemOpen(false)} step={step} c={c} />
      <FixDialog open={fixOpen} onClose={() => setFixOpen(false)} step={step} c={c} />
    </div>
  );
}
