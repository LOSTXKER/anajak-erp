"use client";

/**
 * หน้าลงมือของจอสถานี — หนึ่งใบ หนึ่งขั้น หนึ่งปุ่ม (แบบ A · เบสเคาะ 2026-09-03)
 *   ซ้าย = ทำอะไร (ม็อกอัพ/ลายของขั้นนี้ · สินค้า/ไซซ์)  ·  ขวา = ขั้นนี้ (ตัวเลข → ปัญหา → ข้อกำหนดติ๊กทีละข้อ → ปุ่มหลักปุ่มเดียว)
 * เครื่องยนต์เดียวกับใบผลิต (work-order-controller): ปุ่มไหนกดได้มาจาก selectNowSteps · ทุก mutation เดินทางเดิม
 * แจ้งปัญหา = กดเลือกเหตุ ไม่ต้องพิมพ์ · หัวหน้ามี "แก้ให้" (ยอด · คน · ปลดปัญหา · พัก · ผ่านแทน)
 */

import { useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Circle, ShieldCheck, Wrench } from "lucide-react";
import { ActionZone } from "@/components/ui/action-zone";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DueTag } from "@/components/ui/due-tag";
import { EmptyState } from "@/components/ui/empty-state";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { RADIUS, SUNK_PANEL, TINT } from "@/components/ui/tokens";
import { GarmentPickCard } from "@/components/production/garment-pick-card";
import { ProductionDesignCard } from "@/components/production/production-design-card";
import type { ProductionStep } from "@/components/production/types";
import { useWorkOrderController, type WorkOrderController } from "@/components/production/work-order-controller";
import { OutsourceFacts, Owner, ProblemCard, StateChip, daysFromNow, stepLabel, viewOf } from "@/components/production/work-order-pieces";
import { isOutsourceStep } from "@/lib/production-steps";
import { STATION_PROBLEM_REASONS, type StationDef } from "@/lib/station-desk";
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
  station: StationDef;
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
      eyebrow={step ? `${station.label} — ${stepLabel(step)}` : station.label}
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
  const gated = !done && !stuck && TICK_GATED.has(now?.action ?? "") && !allTicked;

  const canReport = c.canUpdateStep && c.canOwnOrSupervise(step) && !done && step.status !== "FAILED";
  const note = done
    ? `ปิดขั้นแล้ว${step.completedAt ? ` ${formatDateTime(step.completedAt)}` : ""}${step.assignedTo ? ` โดย ${step.assignedTo.name}` : ""}`
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

  const primary = gated ? (
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

      <ActionZone touch note={note}>
        {primary ?? (
          step.stepType === "GARMENT_PICK" ? null : (
            <Button variant="outline" className="h-16 text-lg" disabled>
              ลงมือไม่ได้ตอนนี้
            </Button>
          )
        )}
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

/* ───────────────────────── แจ้งปัญหาแบบกดเลือก ───────────────────────── */

function ProblemDialog({ open, onClose, step, c }: { open: boolean; onClose: () => void; step: ProductionStep; c: WorkOrderController }) {
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const other = reason === "other";
  const text = other ? detail.trim() : reason ? `${reason}${detail.trim() ? ` — ${detail.trim()}` : ""}` : "";
  const ready = text.length >= 3;
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>แจ้งปัญหา — {stepLabel(step)}</DialogTitle>
          <DialogDescription>เลือกเรื่องที่เจอ งานนี้จะหยุดไว้และแจ้งหัวหน้าทันที</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {[...STATION_PROBLEM_REASONS, "other"].map((r) => {
            const label = r === "other" ? "อื่น ๆ (พิมพ์บอก)" : r;
            const on = reason === r;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={() => setReason(r)}
                className={cn(
                  "min-h-14 px-4 text-left text-base font-medium transition-colors",
                  RADIUS.inner,
                  on ? "bg-interactive-selected text-strong ring-2 ring-inset ring-blue-600 dark:ring-blue-400" : cn(SUNK_PANEL, "text-strong hover:bg-interactive-hover"),
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={other ? "พิมพ์สั้น ๆ ว่าเจออะไร (อย่างน้อย 3 ตัวอักษร)" : "รายละเอียดเพิ่มเติม (ไม่บังคับ)"} rows={2} />
        <DialogFooter>
          <Button variant="ghost" size="lg" onClick={onClose} disabled={c.reportProblem.isPending}>
            ยกเลิก
          </Button>
          <Button
            variant="destructive"
            size="lg"
            disabled={!ready || c.reportProblem.isPending}
            onClick={() => c.reportProblem.mutate({ stepId: step.id, reason: text }, { onSuccess: onClose })}
          >
            {c.reportProblem.isPending ? "กำลังแจ้ง…" : "แจ้งหัวหน้า"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── หัวหน้าแก้ให้ ───────────────────────── */

type FixRow = { key: string; label: string; desc: string; enabled: boolean; why?: string; danger?: boolean; run: () => void };

function FixDialog({ open, onClose, step, c }: { open: boolean; onClose: () => void; step: ProductionStep; c: WorkOrderController }) {
  const done = step.status === "COMPLETED";
  const stuck = step.status === "FAILED" || step.status === "ON_HOLD";
  const live = step.status === "PENDING" || step.status === "IN_PROGRESS";
  const serviceOwned = ["GARMENT_PICK", "GARMENT_RECEIVE", "DTF_PRINT"].includes(step.stepType);
  const rows: FixRow[] = [
    {
      key: "qty",
      label: "แก้ยอดที่บันทึก",
      desc: "นับผิดหรือกดเลขผิด — ใส่ยอดที่ถูกแทน",
      enabled: live && !!step.qtyTotal && !serviceOwned,
      why: done ? "ขั้นปิดแล้ว" : serviceOwned ? "ขั้นนี้แก้ยอดผ่านเมนูเฉพาะ (เบิก/ตรวจรับ/รอบพิมพ์)" : !step.qtyTotal ? "ขั้นนี้ไม่นับตัว" : undefined,
      run: () => c.openQty(step.id),
    },
    {
      key: "assign",
      label: stuck ? "ปลดปัญหา / เปลี่ยนคนทำ" : "เปลี่ยนคนทำ",
      desc: stuck ? "บอกวิธีที่แก้แล้ว หรือย้ายงานให้คนอื่น" : "ย้ายให้คนอื่น หรือปลดชื่อคนที่กดรับงานผิด",
      enabled: !done,
      why: done ? "ขั้นปิดแล้ว" : undefined,
      run: () => c.openEdit(step, "manager"),
    },
    {
      key: "hold",
      label: "พักงานนี้ไว้ก่อน",
      desc: "เอาออกจากคิวชั่วคราว ช่างจะไม่เห็นในคิวพร้อมทำ",
      enabled: live && !serviceOwned,
      why: !live ? "พักได้เฉพาะขั้นที่รอ/กำลังทำ" : serviceOwned ? "ขั้นนี้เดินผ่านเมนูเฉพาะ" : undefined,
      run: () => void c.handleSupervisorStatus(step, "ON_HOLD"),
    },
    {
      key: "requeue",
      label: "คืนกลับคิวพร้อมทำ",
      desc: "ช่างกดเริ่มผิดใบ — เอากลับเป็นรอทำ",
      enabled: step.status === "IN_PROGRESS" && !serviceOwned,
      why: step.status !== "IN_PROGRESS" ? "ใช้กับขั้นที่กำลังทำเท่านั้น" : serviceOwned ? "ขั้นนี้เดินผ่านเมนูเฉพาะ" : undefined,
      run: () => void c.handleSupervisorStatus(step, "PENDING"),
    },
    {
      key: "skip",
      label: "ผ่านขั้นนี้แทนช่าง",
      desc: "ทำแล้วจริงแต่ไม่ได้กดในระบบ — ปิดขั้นให้ในชื่อหัวหน้า",
      enabled: live && !serviceOwned,
      why: !live ? "ผ่านได้เฉพาะขั้นที่รอ/กำลังทำ" : serviceOwned ? "ขั้นนี้ปิดผ่านเมนูเฉพาะเท่านั้น" : undefined,
      danger: true,
      run: () => void c.handleSupervisorStatus(step, "COMPLETED"),
    },
    {
      key: "reopen",
      label: "ย้อนขั้นที่ปิดแล้วกลับ",
      desc: "ช่างกดปิดผิด — เปิดขั้นกลับมาทำต่อ",
      enabled: false,
      why: "ระบบยังไม่รองรับ — ขั้นที่ปิดแล้วแก้ย้อนหลังไม่ได้ (จดไว้ทำเพิ่ม)",
      run: () => undefined,
    },
  ];
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>แก้ให้ — {stepLabel(step)}</DialogTitle>
          <DialogDescription>
            {step.assignedTo ? `ผู้รับผิดชอบตอนนี้ ${step.assignedTo.name}` : "ยังไม่มีคนรับขั้นนี้"}
            {step.startedAt ? ` · เริ่ม ${formatDateTime(step.startedAt)}` : ""}
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-divider">
          {rows.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                disabled={!row.enabled}
                onClick={() => {
                  onClose();
                  row.run();
                }}
                className="flex w-full items-start gap-3 px-2 py-3 text-left transition-colors hover:bg-interactive-hover disabled:opacity-60 disabled:hover:bg-transparent"
              >
                <Wrench className={cn("mt-0.5 h-5 w-5 shrink-0", row.danger ? "text-red-600 dark:text-red-400" : "text-muted")} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-base font-medium", row.danger ? "text-red-700 dark:text-red-300" : "text-strong")}>{row.label}</span>
                  <span className="block text-sm text-secondary">{row.enabled ? row.desc : row.why}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className={cn("flex items-start gap-2 border p-3 text-sm", TINT.info, RADIUS.inner)}>
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>ทุกอย่างที่หัวหน้าแก้ ระบบจดชื่อและเวลาไว้ในประวัติการใช้งาน</span>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="lg" onClick={onClose}>
            ปิด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
