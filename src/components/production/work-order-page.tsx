"use client";

/**
 * ใบผลิต `/production/[id]` — แบบ D "แท็บ + 2 คอลัมน์" (เบสเคาะ 2026-09-03 จากหน้าลอง /proto/work-order)
 *
 *   หัวใบ: ตัวเลข 4 ช่อง (จำนวน · กำหนดส่ง · ผ่านแล้ว x/y · ติดปัญหา) + การ์ดปัญหาแดง — เห็นทุกแท็บ
 *   แท็บ: ขั้นงาน / ทำอะไร / ข้อมูลใบ / ประวัติ — ทุกแท็บ 2 คอลัมน์
 *   ขั้นงาน: ซ้าย = รายการขั้น (กดเลือก) · ขวา = ขั้นที่เลือก + โซนลงมือมาตรฐาน (ข้อกำหนด → ปุ่มเดียว)
 *
 * โครง "หนึ่งโมดูล สองสายตา" (เบสเคาะ 09-03): หัวหน้าทำได้ครบในหน้านี้ — ลงมือ · แจ้งปัญหา (กดเลือกเหตุ) · "แก้ให้" · วางแผน
 * และทุกขั้นบอกว่าอยู่สถานีไหน · ช่างเปิดใบเดียวกันจะถูกพาไปหน้าลงมือของโหมดหน้างาน (/production/floor) แทน
 *
 * เครื่องยนต์ (query · สิทธิ์ · mutation · dialog) อยู่ work-order-controller.tsx — โหมดหน้างานใช้ตัวเดียวกัน
 * ชิ้นส่วนอ่านอย่างเดียวอยู่ work-order-pieces.tsx · dialog แจ้งปัญหา/แก้ให้อยู่ step-command-dialogs.tsx
 */

import { Suspense, useState } from "react";
import { AlertTriangle, CalendarCheck, CheckCircle2, ClipboardCheck, Factory, History, Shirt, Truck, UserRound, Wrench } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { ActionZone } from "@/components/ui/action-zone";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DueTag } from "@/components/ui/due-tag";
import { EmptyState } from "@/components/ui/empty-state";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaterialUsage } from "@/components/material-usage";
import { GarmentPickCard } from "@/components/production/garment-pick-card";
import { ProductionDesignCard } from "@/components/production/production-design-card";
import { ProductionMockupTab } from "@/components/production/production-mockup-tab";
import { FixDialog, ProblemDialog } from "@/components/production/step-command-dialogs";
import { STATION_ICON } from "@/components/station/station-pieces";
import type { ProductionDetail, ProductionStep } from "@/components/production/types";
import { PRIORITY_LABELS } from "@/lib/order-status";
import type { NowStep } from "@/lib/production-step-actions";
import { isOutsourceStep } from "@/lib/production-steps";
import { stationForStep } from "@/lib/station-desk";
import { workOrderStandards } from "@/lib/work-order-standards";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { useWorkOrderController, type WorkOrderController } from "./work-order-controller";
import { ItemsSection, OutsourceFacts, Owner, ProblemCard, Qty, StateChip, activeOutsource, daysFromNow, stepLabel, viewOf } from "./work-order-pieces";

/* ───────────────────────── หน้า ───────────────────────── */

function WorkOrder({ id }: { id: string }) {
  const c = useWorkOrderController(id);
  const { production, order, me, productionQuery, meQuery, workflowSteps, nowById, nowMs, selectedStep, selectedNow } = c;

  return (
    <>
      <PageShell
        title={order?.orderNumber ?? "ใบผลิต"}
        icon={Factory}
        tone="production"
        back={{ href: "/production", label: "กลับหน้าการผลิต" }}
        description={order ? `${order.customer?.name ?? "ไม่ระบุลูกค้า"}` : "ภาพรวมการผลิตของออเดอร์นี้และการลงมือทีละขั้น"}
        titleBadge={
          order ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <Badge variant="accent" size="sm">
                {order.internalStatus === "PRODUCING" ? "กำลังผลิต" : order.internalStatus}
              </Badge>
              {order.priority === "URGENT" || order.priority === "HIGH" ? (
                <Badge variant={order.priority === "URGENT" ? "destructive" : "warning"} size="sm">
                  {PRIORITY_LABELS[order.priority] ?? order.priority}
                </Badge>
              ) : null}
            </span>
          ) : undefined
        }
        action={
          production && selectedStep && c.canSuperviseStep && c.hasProductionPermission && selectedStep.status !== "COMPLETED" ? (
            <Button variant="outline" onClick={() => c.openEdit(selectedStep, "manager")}>
              <UserRound /> มอบหมาย / จัดการขั้นที่เลือก
            </Button>
          ) : undefined
        }
        loading={productionQuery.isLoading || meQuery.isLoading}
        skeleton={
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-10 rounded-lg" />
            <div className="grid gap-5 lg:grid-cols-2">
              <Skeleton className="h-96 rounded-2xl" />
              <Skeleton className="h-96 rounded-2xl" />
            </div>
          </>
        }
        error={
          meQuery.isError && !me
            ? { message: "โหลดสิทธิ์การผลิตไม่สำเร็จ", onRetry: () => meQuery.refetch() }
            : productionQuery.isError && !production && !c.notFound
              ? { message: "โหลดใบผลิตไม่สำเร็จ", onRetry: () => productionQuery.refetch() }
              : null
        }
      >
        {c.notFound || !production || !order ? (
          <RecordNotFound what="ใบผลิตนี้" backHref="/production" backLabel="กลับหน้าการผลิต" />
        ) : (
          <div className="space-y-6">
            {c.writeDataStale ? (
              <Alert variant="warning" title="ข้อมูลล่าสุดอาจยังไม่ครบ">
                กำลังแสดงข้อมูลเดิมที่โหลดไว้ — ปุ่มลงมือถูกปิดจนกว่าจะโหลดใหม่สำเร็จ
              </Alert>
            ) : null}

            {/* ตัวเลข 4 ช่อง — ชั้น 1 */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="card-surface rounded-2xl p-4">
                <Metric label="จำนวนที่ต้องผลิต" value={c.totalQty.toLocaleString("th-TH")} unit="ตัว" size="lg" icon={Shirt} />
              </div>
              <div className="card-surface rounded-2xl p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <CalendarCheck className="h-4 w-4" aria-hidden="true" /> กำหนดส่ง
                </p>
                <div className="mt-2">
                  <DueTag dueInDays={daysFromNow(order.deadline, nowMs)} dateLabel={order.deadline ? formatDate(order.deadline) : null} size="lg" />
                </div>
              </div>
              <div className="card-surface rounded-2xl p-4">
                <Metric label="ผ่านแล้ว" value={`${c.completedSteps}/${workflowSteps.length}`} unit="ขั้น" size="lg" icon={CheckCircle2} tone={workflowSteps.length > 0 && c.completedSteps === workflowSteps.length ? "success" : "default"} />
              </div>
              <div className="card-surface rounded-2xl p-4">
                <Metric label="ติดปัญหา" value={c.problemSteps.length} unit="ขั้น" size="lg" icon={AlertTriangle} tone={c.problemSteps.length > 0 ? "danger" : "muted"} />
              </div>
            </div>

            {c.problemSteps.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {c.problemSteps.map((step) => (
                  <ProblemCard key={step.id} step={step} />
                ))}
              </div>
            ) : null}

            {c.legacyPackagingReadyForQc ? (
              <Alert
                variant="success"
                title="ทุกขั้นผลิตเสร็จแล้ว"
                action={
                  c.canUpdateStep ? (
                    <Button size="sm" onClick={() => c.legacyFinalize.mutate({ productionId: production.id })} disabled={c.legacyFinalize.isPending}>
                      ส่งเข้า QC
                    </Button>
                  ) : undefined
                }
              >
                ส่งงานเข้าตรวจ QC เพื่อไปต่อขั้นแพ็กและจัดส่ง
              </Alert>
            ) : null}

            <Tabs defaultValue="steps" className="space-y-6">
              <TabsBar>
                <TabsList aria-label="ส่วนของใบผลิต">
                  <TabsTrigger value="steps" hasPending={c.problemSteps.length > 0}>
                    ขั้นงาน
                  </TabsTrigger>
                  <TabsTrigger value="make">ทำอะไร</TabsTrigger>
                  <TabsTrigger value="info">ข้อมูลใบ</TabsTrigger>
                  <TabsTrigger value="history">ประวัติ</TabsTrigger>
                </TabsList>
              </TabsBar>

              {/* ── ขั้นงาน: ซ้าย รายการ · ขวา ขั้นที่เลือก + โซนลงมือ ── */}
              <TabsContent value="steps">
                {workflowSteps.length === 0 ? (
                  <div className="card-surface rounded-2xl">
                    <EmptyState icon={Wrench} title="ใบผลิตนี้ยังไม่มีขั้นตอน" />
                  </div>
                ) : (
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
                    <Section title="ขั้นงานทั้งหมด" meta={`${c.completedSteps}/${workflowSteps.length} ผ่านแล้ว`} icon={Wrench} tone="production" flush>
                      <ol className="divide-y divide-divider">
                        {workflowSteps.map((step, index) => {
                          const view = viewOf(step, nowById.get(step.id));
                          const on = selectedStep?.id === step.id;
                          const outsource = isOutsourceStep(step.stepType);
                          const st = stationForStep(step.stepType);
                          return (
                            <li key={step.id}>
                              <button
                                type="button"
                                aria-pressed={on}
                                onClick={() => c.setSelectedStepId(step.id)}
                                className={cn(
                                  "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-interactive-hover",
                                  on && "bg-interactive-selected",
                                )}
                              >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-medium tabular-nums text-muted">
                                  {index + 1}
                                </span>
                                <span className="min-w-0">
                                  <span className={cn("block truncate text-sm", on ? "font-semibold text-strong" : "font-medium text-strong")}>{stepLabel(step)}</span>
                                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <StateChip view={view} kind={outsource ? "outsource" : "inhouse"} />
                                    <InfoChip size="sm" icon={STATION_ICON[st.key] ?? Wrench}>
                                      {st.label}
                                    </InfoChip>
                                    {step.assignedTo ? <InfoChip size="sm">{step.assignedTo.name}</InfoChip> : null}
                                  </span>
                                </span>
                                <Qty step={step} />
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    </Section>

                    {selectedStep ? (
                      <StepDetail
                        key={selectedStep.id}
                        c={c}
                        step={selectedStep}
                        now={selectedNow}
                        nowMs={nowMs}
                        primary={c.primaryButton(selectedStep, selectedNow)}
                        canReport={c.canUpdateStep && c.canOwnOrSupervise(selectedStep) && selectedStep.status !== "COMPLETED" && selectedStep.status !== "FAILED"}
                        canFix={c.canSuperviseStep && c.hasProductionPermission && selectedStep.status !== "COMPLETED"}
                        canEdit={c.canUpdateStep && c.canOwnOrSupervise(selectedStep) && selectedStep.status !== "COMPLETED"}
                        onEdit={() => c.openEdit(selectedStep, "operation")}
                        garment={
                          selectedStep.stepType === "GARMENT_PICK" ? (
                            <GarmentPickCard
                              productionId={production.id}
                              steps={workflowSteps}
                              stepId={selectedStep.id}
                              canIssueGarments={c.canUpdateStep && c.canOwnOrSupervise(selectedStep) && selectedStep.status !== "COMPLETED"}
                              canReturnGarments={c.canSuperviseStep && c.hasProductionPermission && !c.writeDataStale}
                              embedded
                              primaryTask={selectedNow?.group === "current"}
                            />
                          ) : null
                        }
                      />
                    ) : null}
                  </div>
                )}
              </TabsContent>

              {/* ── ทำอะไร: ซ้าย สินค้า/ไซซ์ · ขวา ลาย + ม็อกอัพ ── */}
              <TabsContent value="make">
                <div className="grid gap-5 lg:grid-cols-2">
                  <ItemsSection order={order} />
                  <Section title="ลายและม็อกอัพที่อนุมัติ" icon={ClipboardCheck} tone="production">
                    <ProductionDesignCard order={order} embedded />
                  </Section>
                </div>
              </TabsContent>

              {/* ── ข้อมูลใบ: ซ้าย ออเดอร์/ใบ · ขวา เสื้อ+วัตถุดิบ ── */}
              <TabsContent value="info">
                <div className="grid gap-5 lg:grid-cols-2">
                  <Section title="ออเดอร์และใบผลิต" icon={ClipboardCheck} tone="production">
                    <FactList columns={2}>
                      <Fact label="ลูกค้า" value={order.customer?.name ?? "ไม่ระบุ"} />
                      <Fact label="สถานะออเดอร์" value={order.internalStatus === "PRODUCING" ? "กำลังผลิต" : order.internalStatus} />
                      <Fact label="กำหนดส่ง" value={order.deadline ? formatDate(order.deadline) : "ยังไม่กำหนด"} icon={CalendarCheck} />
                      <Fact label="ความสำคัญ" value={PRIORITY_LABELS[order.priority] ?? order.priority} />
                      <Fact label="สถานะใบผลิต" value={production.status} />
                      <Fact label="ขั้นทั้งหมด" value={`${workflowSteps.length} ขั้น`} sub={`ร้านนอก ${workflowSteps.filter((s) => isOutsourceStep(s.stepType)).length} ขั้น`} />
                    </FactList>
                    {production.notes ? (
                      <Alert variant="warning" className="mt-4" title="หมายเหตุใบผลิต">
                        {production.notes}
                      </Alert>
                    ) : null}
                  </Section>
                  <div className="space-y-5">
                    <Section title="เสื้อและวัตถุดิบ" icon={Shirt} tone="product">
                      {c.hasProductionPermission ? (
                        <MaterialUsage productionId={production.id} orderNumber={order.orderNumber} showCosts={c.canSeeCost} readOnly={!c.canUpdateStep || !c.canSuperviseStep} embedded />
                      ) : (
                        <p className="text-sm text-muted">บัญชีนี้ดูใบผลิตได้ แต่ไม่มีสิทธิ์จัดการรายการวัตถุดิบ</p>
                      )}
                    </Section>
                    <Section title="งานร้านนอกในใบนี้" icon={Truck} tone="production" meta={`${workflowSteps.filter((s) => s.outsourceOrders.length > 0).length} งาน`}>
                      {workflowSteps.some((s) => s.outsourceOrders.length > 0) ? (
                        <ul className="divide-y divide-divider">
                          {workflowSteps
                            .filter((s) => s.outsourceOrders.length > 0)
                            .map((s) => (
                              <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                                <p className="mb-2 text-sm font-medium text-strong">{stepLabel(s)}</p>
                                <OutsourceFacts step={s} nowMs={nowMs} />
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted">ยังไม่มีขั้นที่ส่งร้านนอก</p>
                      )}
                    </Section>
                  </div>
                </div>
              </TabsContent>

              {/* ── ประวัติ: ซ้าย เหตุการณ์ต่อขั้น · ขวา ม็อกอัพทุกเวอร์ชัน ── */}
              <TabsContent value="history">
                <div className="grid gap-5 lg:grid-cols-2">
                  <Section title="เวลาจริงต่อขั้น" icon={History} tone="system">
                    <ol className="divide-y divide-divider">
                      {workflowSteps.map((step) => {
                        const view = viewOf(step, nowById.get(step.id));
                        return (
                          <li key={step.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                            <span className="min-w-0">
                              <span className="block truncate text-sm text-strong">{stepLabel(step)}</span>
                              <span className="block text-xs text-muted">{view.label}{step.assignedTo ? ` · ${step.assignedTo.name}` : ""}</span>
                            </span>
                            <InfoChipRow>
                              {step.startedAt ? <InfoChip size="sm" tone="info">เริ่ม {formatDateTime(step.startedAt)}</InfoChip> : null}
                              {step.completedAt ? <InfoChip size="sm" tone="success">เสร็จ {formatDateTime(step.completedAt)}</InfoChip> : null}
                              {!step.startedAt && !step.completedAt ? <InfoChip size="sm">ยังไม่เริ่ม</InfoChip> : null}
                            </InfoChipRow>
                          </li>
                        );
                      })}
                    </ol>
                    <p className="mt-4 text-xs text-muted">ประวัติละเอียด (ใครกดอะไรเมื่อไร) ดูได้ที่ตั้งค่า → ประวัติการใช้งาน</p>
                  </Section>
                  <Section title="ม็อกอัพทุกเวอร์ชัน" icon={ClipboardCheck} tone="production">
                    <ProductionMockupTab order={order} />
                  </Section>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </PageShell>

      {c.dialogs}
    </>
  );
}

/* ───────────────────────── ขั้นที่เลือก + โซนลงมือมาตรฐาน ───────────────────────── */

export function StepDetail({
  c,
  step,
  now,
  nowMs,
  primary,
  canReport,
  canFix,
  canEdit,
  onEdit,
  garment,
}: {
  c: WorkOrderController;
  step: ProductionStep;
  now: NowStep<ProductionStep> | undefined;
  nowMs: number;
  primary: React.ReactNode;
  canReport: boolean;
  /** หัวหน้า "แก้ให้" — ยอด · คน · พัก · คืนคิว · ผ่านแทน (dialog ชุดเดียวกับโหมดหน้างาน) */
  canFix: boolean;
  canEdit: boolean;
  onEdit: () => void;
  garment: React.ReactNode;
}) {
  const view = viewOf(step, now);
  const outsource = isOutsourceStep(step.stepType);
  const st = stationForStep(step.stepType);
  const standards = workOrderStandards(step.stepType);
  const [problemOpen, setProblemOpen] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const blockedReason =
    step.status === "COMPLETED"
      ? `ปิดขั้นแล้ว${step.completedAt ? ` ${formatDateTime(step.completedAt)}` : ""}${step.assignedTo ? ` · โดย ${step.assignedTo.name}` : ""}`
      : step.status === "FAILED" || step.status === "ON_HOLD"
        ? "แก้ปัญหาก่อน จึงลงมือขั้นนี้ต่อได้"
        : now && now.waitingOn.length > 0
          ? now.waitingOn.join(" · ")
          : now?.note ?? (now ? null : "ยังไม่ถึงคิวขั้นนี้ — ทำขั้นก่อนหน้าให้จบก่อน");
  const active = activeOutsource(step);

  return (
    <Section
      title={stepLabel(step)}
      meta={
        // Section วาง meta ไว้ใน <p> — ต้องเป็น span ห้ามใช้ InfoChipRow (div) ไม่งั้น hydration พัง
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StateChip view={view} kind={outsource ? "outsource" : "inhouse"} size="md" />
          <InfoChip size="md" icon={STATION_ICON[st.key] ?? Wrench}>
            {st.label}
          </InfoChip>
        </span>
      }
      action={<Owner step={step} />}
      tone="production"
    >
      <div className="space-y-5">
        <FactList columns={3}>
          <div>
            {step.qtyTotal ? (
              <Metric label="ทำแล้ว" value={(step.qtyDone ?? 0).toLocaleString("th-TH")} unit={`/ ${step.qtyTotal.toLocaleString("th-TH")} ตัว`} size="lg" tone={(step.qtyDone ?? 0) >= step.qtyTotal ? "success" : "default"} />
            ) : (
              <Metric label="จำนวน" value="—" size="lg" tone="muted" />
            )}
          </div>
          <Fact label="เริ่มเมื่อ" value={step.startedAt ? formatDateTime(step.startedAt) : "ยังไม่เริ่ม"} tone={step.startedAt ? "default" : "muted"} />
          <Fact label="เสร็จเมื่อ" value={step.completedAt ? formatDateTime(step.completedAt) : "ยังไม่เสร็จ"} tone={step.completedAt ? "success" : "muted"} />
        </FactList>

        {step.outsourceOrders.length > 0 ? <OutsourceFacts step={step} nowMs={nowMs} /> : null}
        {step.printRunItems.length > 0 ? (
          <InfoChip tone="info" strong>
            อยู่ในรอบพิมพ์ {step.printRunItems[0]!.printRun.runNumber}
          </InfoChip>
        ) : null}
        {step.notes && step.status !== "FAILED" && step.status !== "ON_HOLD" ? <p className="text-sm text-secondary">{step.notes}</p> : null}
        {step.qcNotes ? <p className="text-sm text-secondary">QC: {step.qcNotes}</p> : null}

        {garment}

        {/* โซนลงมือมาตรฐาน — เหมือนกันทุกขั้น */}
        <div>
          <p className="text-xs font-medium text-muted">ข้อกำหนดมาตรฐานของขั้นนี้</p>
          <ul className="mt-1.5 space-y-1">
            {standards.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="text-strong">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <ActionZone note={blockedReason ?? (active ? `ร้านนอก: ${active.vendor.name}` : undefined)}>
          {primary ?? (
            step.stepType === "GARMENT_PICK" ? null : (
              <Button variant="outline" disabled>
                ลงมือไม่ได้ตอนนี้
              </Button>
            )
          )}
          {canEdit ? (
            <Button variant="outline" onClick={onEdit}>
              บันทึกรายละเอียด
            </Button>
          ) : null}
          {canReport ? (
            <Button variant="outline" onClick={() => setProblemOpen(true)}>
              <AlertTriangle /> แจ้งปัญหา
            </Button>
          ) : null}
          {canFix ? (
            <Button variant="outline" onClick={() => setFixOpen(true)}>
              <Wrench /> แก้ให้
            </Button>
          ) : null}
        </ActionZone>
      </div>
      <ProblemDialog open={problemOpen} onClose={() => setProblemOpen(false)} step={step} c={c} />
      <FixDialog open={fixOpen} onClose={() => setFixOpen(false)} step={step} c={c} />
    </Section>
  );
}

export type { ProductionDetail };

export function WorkOrderPage({ id }: { id: string }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <WorkOrder id={id} />
    </Suspense>
  );
}
