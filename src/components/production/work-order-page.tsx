"use client";
import { HelpTip } from "@/components/ui/help-tip";

/**
 * ใบผลิต `/production/[id]` — แบบ E "ตอนนี้ทำอะไร (รู้ทางขนาน)" (เบสเคาะ 2026-09-06 จากหน้าลอง /proto/work-order-redesign?v=flow
 * หลังบอกว่าแบบ D "แท็บ + 2 คอลัมน์" ยังใช้ยาก และถามว่า "ทำแบบ wizard ได้มั้ย แต่มันจะมีทางขนาน")
 *
 *   wizard ที่หน่วยไม่ใช่ "ขั้นที่ N จาก 7" แต่เป็น "สิ่งที่ทำได้ตอนนี้" — งานเดินหลายสายพร้อมกัน (เสื้อ · ฟิล์ม · ร้านนอก) จึงมีการ์ดได้หลายใบ
 *   หัวใบ: ตัวเลข 4 ช่อง (จำนวน · กำหนดส่ง · ผ่านแล้ว x/y · ติดปัญหา)
 *   แผนที่เส้นทาง: สายที่เดินขนานกันคนละแถว เส้นวิ่งรวมที่ขั้นบรรจบ (รีดร้อน · QC) — กดขั้นไหน = เปิดขั้นนั้น
 *   ตอนนี้ทำอะไร: ติดปัญหา (การ์ดปัญหา + โซนลงมือ) → ทำได้ตอนนี้ สายละใบ (ปุ่มเดียว/ใบ) → ถัดไป (บรรทัดสั้น "รอ X + Y")
 *   พับไว้ท้าย: ลายและม็อกอัพ · ข้อมูลใบ (ออเดอร์ · วัตถุดิบ · ร้านนอก) · ประวัติ — แทนแท็บเดิม ไม่มีอะไรหาย
 *
 * โครง "หนึ่งโมดูล สองสายตา" (เบสเคาะ 09-03) ยังอยู่: หัวหน้าทำได้ครบในหน้านี้ — ลงมือ · แจ้งปัญหา · "แก้ให้" · วางแผน
 * ช่างเปิดใบเดียวกันจะถูกพาไปหน้าลงมือของโหมดหน้างาน (/production/floor) แทน
 *
 * เครื่องยนต์ (query · สิทธิ์ · mutation · dialog) อยู่ work-order-controller.tsx — โหมดหน้างานใช้ตัวเดียวกัน
 * ชิ้นส่วนอ่านอย่างเดียวอยู่ work-order-pieces.tsx · แผนที่อยู่ work-order-route.tsx (ผังจาก lib/work-order-route) · dialog อยู่ step-command-dialogs.tsx
 * "ขั้นที่ทำได้ตอนนี้" = selectNowSteps + evaluateHeatPressGate ชุดเดิม · "รอ X + Y" = routeWaitingOn (วาดกติกาเดิม ไม่ใช่กติกาใหม่)
 */

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, CalendarCheck, CheckCircle2, ChevronRight, ClipboardCheck, Clock, Factory, FileText, History, MonitorSmartphone, Pencil, Printer, Shirt, Truck, UserRound, Wrench } from "lucide-react";

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
import { MoreMenu, type MoreMenuItem } from "@/components/ui/more-menu";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { MaterialUsage } from "@/components/material-usage";
import { GarmentPickCard } from "@/components/production/garment-pick-card";
import { ProductionDesignCard } from "@/components/production/production-design-card";
import { ProductionMockupTab } from "@/components/production/production-mockup-tab";
import { ProblemDialog, fixCommands } from "@/components/production/step-command-dialogs";
import { STATION_ICON } from "@/components/station/station-pieces";
import type { ProductionDetail, ProductionStep } from "@/components/production/types";
import { PRIORITY_LABELS } from "@/lib/order-status";
import type { NowStep } from "@/lib/production-step-actions";
import { isOutsourceStep } from "@/lib/production-steps";
import { latestPlainProductionNote } from "@/lib/production-problem";
import { stationForStep } from "@/lib/station-desk";
import { PAPER_STEP_NOTE, RECORD_MODE_LABEL, isInferredDone, recordModeOf, whyRecordOnScreen, type RecordMode } from "@/lib/work-order-record-mode";
import { routeWaitingOn } from "@/lib/work-order-route";
import { FOCUS_BUTTON, RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
import { workOrderStandards } from "@/lib/work-order-standards";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { useWorkOrderController, type WorkOrderController } from "./work-order-controller";
import { ItemsList, OutsourceFacts, Owner, ProblemCard, StateChip, activeOutsource, daysFromNow, stepLabel, viewOf } from "./work-order-pieces";
import { RouteMap, shortWaitList } from "./work-order-route";

/* ───────────────────────── หน้า ───────────────────────── */

function Disclosure({ summary, icon: Icon, children }: { summary: string; icon: typeof History; children: React.ReactNode }) {
  return (
    <details className="group card-surface rounded-2xl">
      <summary className={cn(FOCUS_BUTTON, "flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-2xl px-5 text-sm font-medium text-strong transition-colors hover:bg-interactive-hover [&::-webkit-details-marker]:hidden")}>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-90" aria-hidden="true" />
        <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        {summary}
      </summary>
      <div className="border-t border-divider px-5 py-5">{children}</div>
    </details>
  );
}

function WorkOrder({ id }: { id: string }) {
  const c = useWorkOrderController(id);
  const { production, order, me, productionQuery, meQuery, workflowSteps, nowById, nowMs } = c;
  // กระดาษเป็นหลัก (ROADMAP §A5): QR บนใบสั่งงานพกเวอร์ชันม็อกอัพที่พิมพ์ (?mockup=n) — สแกนใบเก่าแล้วต้องรู้ทันที
  const scannedMockup = Number(useSearchParams().get("mockup") ?? "");
  const approvedMockup = order?.designs[0]?.versionNumber ?? null;
  const stalePaper = Number.isFinite(scannedMockup) && scannedMockup > 0 && approvedMockup !== null && scannedMockup < approvedMockup;

  // กดขั้นในแผนที่ = เปิดขั้นนั้นแทนกลุ่ม "ตอนนี้" (null = โหมดตอนนี้)
  const [focusId, setFocusId] = useState<string | null>(null);
  const focused = focusId ? (workflowSteps.find((s) => s.id === focusId) ?? null) : null;

  // กลุ่ม "ตอนนี้": ติดปัญหา → ทำได้ตอนนี้ (ขั้นแรกที่ยังไม่ปิดของแต่ละสาย ที่ไม่ได้รอสายอื่น) → ถัดไป
  const problemIds = new Set(c.problemSteps.map((s) => s.id));
  const doable = c.nowSteps
    .filter((n) => !problemIds.has(n.step.id) && n.waitingOn.length === 0 && routeWaitingOn(n.step, workflowSteps).length === 0)
    .map((n) => n.step);
  const doableIds = new Set(doable.map((s) => s.id));
  const upcoming = workflowSteps.filter((s) => s.status !== "COMPLETED" && !problemIds.has(s.id) && !doableIds.has(s.id));

  function detailOf(step: ProductionStep) {
    const now = nowById.get(step.id);
    return (
      <StepDetail
        key={step.id}
        c={c}
        step={step}
        now={now}
        nowMs={nowMs}
        primary={c.primaryButton(step, now)}
        canReport={c.canUpdateStep && c.canOwnOrSupervise(step) && step.status !== "COMPLETED" && step.status !== "FAILED"}
        canFix={c.canSuperviseStep && c.hasProductionPermission && step.status !== "COMPLETED"}
        canEdit={c.canUpdateStep && c.canOwnOrSupervise(step) && step.status !== "COMPLETED"}
        onEdit={() => c.openEdit(step, "operation")}
        garment={
          step.stepType === "GARMENT_PICK" && production ? (
            <GarmentPickCard
              productionId={production.id}
              steps={workflowSteps}
              stepId={step.id}
              canIssueGarments={c.canUpdateStep && c.canOwnOrSupervise(step) && step.status !== "COMPLETED"}
              canReturnGarments={c.canSuperviseStep && c.hasProductionPermission && !c.writeDataStale}
              embedded
              primaryTask={now?.group === "current"}
            />
          ) : null
        }
      />
    );
  }

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
          production && focused && c.canSuperviseStep && c.hasProductionPermission && focused.status !== "COMPLETED" ? (
            <Button variant="outline" onClick={() => c.openEdit(focused, "manager")}>
              <UserRound /> มอบหมาย / จัดการขั้นนี้
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
            <Skeleton className="h-40 rounded-2xl" />
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
            {stalePaper ? (
              <Alert
                variant="error"
                title="กระดาษที่สแกนเป็นฉบับเก่า"
                meta={[
                  { label: "บนกระดาษ", value: `ม็อกอัพ v${scannedMockup}` },
                  { label: "ตอนนี้", value: `ม็อกอัพ v${approvedMockup}` },
                ]}
                action={
                  <Button asChild size="sm">
                    <a href={`/print/job-ticket/${order.id}?production=${production.id}`} target="_blank" rel="noreferrer">
                      <Printer /> พิมพ์ใบใหม่
                    </a>
                  </Button>
                }
              >
                แบบเปลี่ยนหลังพิมพ์ใบนี้ — พิมพ์ใบใหม่แล้วเก็บใบเก่าออกจากกองเสื้อก่อนทำต่อ
              </Alert>
            ) : null}
            {c.readyForQcViaPaper ? (
              <Alert
                variant="success"
                title="ขั้นที่จดในระบบครบแล้ว"
                meta={c.paperStepsPending.map((s) => ({ label: "จดบนกระดาษ", value: stepLabel(s) }))}
                action={
                  c.canUpdateStep ? (
                    <Button size="sm" onClick={() => c.sendToQc.mutate({ productionId: production.id })} disabled={c.sendToQc.isPending}>
                      ส่งเข้า QC
                    </Button>
                  ) : undefined
                }
              >
                กดส่งเข้า QC แล้วระบบจะถือว่าขั้นบนกระดาษผ่าน (ขึ้นเป็น “ถือว่าผ่าน” สีเทา) — ยอดจริงอยู่บนใบสั่งงาน
              </Alert>
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

            {/* แผนที่เส้นทาง — สายที่เดินขนานกันคนละแถว · กดขั้นไหน = เปิดขั้นนั้น */}
            <div className="card-surface rounded-2xl p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-strong">เส้นทางงาน</p>
                <HelpTip label="เส้นทางงาน">สายที่เดินพร้อมกันอยู่คนละแถว เส้นวิ่งมารวมที่ขั้นที่ต้องรอกัน — กดขั้นไหนเพื่อเปิดขั้นนั้น</HelpTip>
                <span className="ml-auto inline-flex flex-wrap items-center gap-2">
                  {approvedMockup !== null ? (
                    <InfoChip size="sm" tone="success" icon={CheckCircle2}>
                      ม็อกอัพอนุมัติ v{approvedMockup}
                    </InfoChip>
                  ) : (
                    <InfoChip size="sm" tone="warning">
                      ยังไม่มีม็อกอัพอนุมัติ
                    </InfoChip>
                  )}
                  <Button asChild variant="outline" size="sm">
                    <a href={`/print/job-ticket/${order.id}?production=${production.id}`} target="_blank" rel="noreferrer" aria-label="พิมพ์ใบสั่งงาน (เปิดแท็บใหม่)">
                      <Printer /> พิมพ์ใบสั่งงาน
                    </a>
                  </Button>
                </span>
              </div>
              {workflowSteps.length === 0 ? (
                <EmptyState icon={Wrench} title="ใบผลิตนี้ยังไม่มีขั้นตอน" />
              ) : (
                <RouteMap steps={workflowSteps} nowById={nowById} focusId={focusId} onFocus={setFocusId} />
              )}
            </div>

            {/* เสื้อที่กำลังทำ — แถบย่อ เห็นไซซ์ได้โดยไม่ต้องกาง */}
            <div className={cn(SUNK_PANEL, RADIUS.inner, "px-4 py-3")}>
              <ItemsList order={order} />
            </div>

            {focused ? (
              <section className="space-y-3" aria-label="ขั้นที่เลือก">
                <Button variant="ghost" size="sm" onClick={() => setFocusId(null)}>
                  <ArrowLeft /> กลับไปดู “ตอนนี้ทำอะไร”
                </Button>
                {problemIds.has(focused.id) ? <ProblemCard step={focused} /> : null}
                {detailOf(focused)}
              </section>
            ) : workflowSteps.length > 0 ? (
              <section className="space-y-6" aria-label="ตอนนี้ทำอะไร">
                {c.problemSteps.length > 0 ? (
                  <div className="space-y-3">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-strong">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" /> ติดปัญหา {c.problemSteps.length} ขั้น
                    </h2>
                    <div className={cn("grid gap-4", c.problemSteps.length > 1 && "lg:grid-cols-2")}>
                      {c.problemSteps.map((step) => (
                        <div key={step.id} className="space-y-3">
                          <ProblemCard step={step} />
                          {detailOf(step)}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <h2 className="text-lg font-semibold text-strong">
                    ตอนนี้ทำได้ {doable.length} อย่าง
                    {doable.length > 1 ? <span className="ml-2 text-sm font-normal text-secondary">คนละสาย ทำพร้อมกันได้</span> : null}
                  </h2>
                  {doable.length === 0 ? (
                    <Alert variant="info" title={c.completedSteps === workflowSteps.length ? "ทุกขั้นผ่านแล้ว" : "ยังไม่มีอะไรให้ทำตอนนี้"}>
                      {c.completedSteps === workflowSteps.length ? "ใบผลิตนี้ครบทุกขั้น" : c.problemSteps.length > 0 ? "ทุกสายกำลังรอกัน — ดูที่ติดปัญหาข้างบน" : "ทุกสายกำลังรอกัน — ดูว่าขั้นถัดไปรออะไรข้างล่าง"}
                    </Alert>
                  ) : (
                    <div className={cn("grid gap-4", doable.length > 1 && "lg:grid-cols-2")}>{doable.map((step) => detailOf(step))}</div>
                  )}
                </div>

                {upcoming.length > 0 ? (
                  <div className={cn(SUNK_PANEL, RADIUS.inner, "p-4")}>
                    <p className="text-xs font-medium text-muted">ถัดไป — ยังไม่ถึงคิว</p>
                    <ul className="mt-2 space-y-1.5">
                      {upcoming.map((step) => {
                        const now = nowById.get(step.id);
                        const pending = routeWaitingOn(step, workflowSteps);
                        const reason = now && now.waitingOn.length > 0 ? now.waitingOn.join(" · ") : pending.length > 0 ? `รอ ${shortWaitList(pending.map((p) => stepLabel(p)))}` : (now?.note ?? "ยังไม่ถึงคิว");
                        return (
                          <li key={step.id} className="flex flex-wrap items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                            <button type="button" onClick={() => setFocusId(step.id)} className={cn(FOCUS_BUTTON, "rounded font-medium text-strong hover:underline")}>
                              {stepLabel(step)}
                            </button>
                            <span className="text-secondary">{reason}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            {/* ส่วนที่เคยเป็นแท็บ — พับไว้ กดกางค่อยเห็น (ไม่มีอะไรหาย) */}
            <Disclosure summary="ลายและม็อกอัพที่อนุมัติ" icon={ClipboardCheck}>
              <ProductionDesignCard order={order} embedded />
            </Disclosure>

            <Disclosure summary="ข้อมูลใบ — ออเดอร์ วัตถุดิบ และงานร้านนอก" icon={FileText}>
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
            </Disclosure>

            <Disclosure summary="ประวัติ — เวลาจริงต่อขั้น · ม็อกอัพทุกเวอร์ชัน" icon={History}>
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
                </Section>
                <Section title="ม็อกอัพทุกเวอร์ชัน" icon={ClipboardCheck} tone="production">
                  <ProductionMockupTab order={order} />
                </Section>
              </div>
            </Disclosure>
          </div>
        )}
      </PageShell>

      {c.dialogs}
    </>
  );
}

/* ───────────────────────── ชิปโหมดจด (กระดาษเป็นหลัก) ───────────────────────── */

const RECORD_MODE_ICON = { screen: MonitorSmartphone, paper: FileText, auto: Printer } as const;
const RECORD_MODE_TONE = { screen: "info", paper: "neutral", auto: "success" } as const;

/** ค่าตั้งคงที่ของขั้น — ไม่ strong เพื่อไม่แย่งชั้น 1 กับชิปสถานะสด */
export function RecordModeChip({ mode, size = "sm" }: { mode: RecordMode; size?: "sm" | "md" }) {
  return (
    <InfoChip size={size} tone={RECORD_MODE_TONE[mode]} icon={RECORD_MODE_ICON[mode]}>
      {RECORD_MODE_LABEL[mode]}
    </InfoChip>
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
  const done = step.status === "COMPLETED";
  const stuck = step.status === "FAILED" || step.status === "ON_HOLD";
  // กระดาษเป็นหลัก (ROADMAP §A5): ขั้นที่จดบนกระดาษไม่มีปุ่มหลัก — ช่างติ๊ก/ยอด/ลงชื่อบนใบสั่งงาน · หัวหน้าจดให้ได้จากเมนู
  const mode = recordModeOf(step);
  const inferred = isInferredDone(step);
  const onPaper = mode === "paper" && !done && !stuck;
  const effectivePrimary = onPaper ? null : primary;
  const blockedReason =
    step.status === "COMPLETED"
      ? inferred
        ? `ถือว่าผ่านตอนส่งเข้า QC${step.completedAt ? ` ${formatDateTime(step.completedAt)}` : ""} — ยอดจริงอยู่บนใบสั่งงาน`
        : `ปิดขั้นแล้ว${step.completedAt ? ` ${formatDateTime(step.completedAt)}` : ""}${step.assignedTo ? ` · โดย ${step.assignedTo.name}` : ""}`
      : step.status === "FAILED" || step.status === "ON_HOLD"
        ? "แก้ปัญหาก่อน จึงลงมือขั้นนี้ต่อได้"
        : now && now.waitingOn.length > 0
          ? now.waitingOn.join(" · ")
          : onPaper
            ? PAPER_STEP_NOTE
            : now?.note ?? (now ? null : "ยังไม่ถึงคิวขั้นนี้ — ทำขั้นก่อนหน้าให้จบก่อน");
  const active = activeOutsource(step);
  const why = whyRecordOnScreen(step);
  // notes เก็บ trail (แจ้งปัญหา/แก้แล้ว/ถือว่าผ่าน) — โชว์เฉพาะหมายเหตุที่คนพิมพ์ ไม่ใช่ marker
  const plainNote = latestPlainProductionNote(step.notes);

  return (
    <Section
      title={stepLabel(step)}
      meta={
        // Section วาง meta ไว้ใน <p> — ต้องเป็น span ห้ามใช้ InfoChipRow (div) ไม่งั้น hydration พัง
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {inferred ? (
            <InfoChip size="md" icon={FileText}>
              ถือว่าผ่าน
            </InfoChip>
          ) : onPaper && !(now && now.waitingOn.length > 0) ? null : (
            <StateChip view={view} kind={outsource ? "outsource" : "inhouse"} size="md" />
          )}
          <RecordModeChip mode={mode} size="md" />
          {st.key === "lane:OTHER" ? null : (
            <InfoChip size="md" icon={STATION_ICON[st.key] ?? Wrench}>
              {st.label}
            </InfoChip>
          )}
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
        {plainNote && step.status !== "FAILED" && step.status !== "ON_HOLD" ? <p className="text-sm text-secondary">{plainNote}</p> : null}
        {step.qcNotes ? <p className="text-sm text-secondary">QC: {step.qcNotes}</p> : null}

        {garment}

        {/* โซนลงมือมาตรฐาน — เหมือนกันทุกขั้น */}
        <div>
          <p className="flex items-center justify-between text-xs font-medium text-muted">
            <span>ข้อกำหนดมาตรฐานของขั้นนี้</span>
            {mode === "paper" ? <span>ช่องติ๊กอยู่บนใบสั่งงาน</span> : null}
          </p>
          <ul className="mt-1.5 space-y-1">
            {standards.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="text-strong">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* แบบ A (เบสเคาะ 09-03): ประโยคสถานะบน · ปุ่มหลัก 1 · แจ้งปัญหาเบา · ที่เหลืออยู่ในเมนู "เพิ่มเติม" · ไม่มีปุ่มที่กดไม่ได้ */}
        <ActionZone
          note={blockedReason ?? (active ? `ร้านนอก: ${active.vendor.name}` : effectivePrimary ? (why ?? "พร้อมลงมือ — ทำครบข้อกำหนดแล้วค่อยกดปุ่ม") : undefined)}
          icon={done ? (inferred ? FileText : CheckCircle2) : stuck ? AlertTriangle : onPaper ? FileText : effectivePrimary ? (mode === "screen" ? MonitorSmartphone : Wrench) : Clock}
          tone={done ? "success" : stuck ? "error" : effectivePrimary ? "info" : "neutral"}
          menu={
            !done ? (
              <MoreMenu
                items={[
                  ...(canEdit ? [{ key: "edit", label: "บันทึกรายละเอียด", hint: "แก้ยอด หมายเหตุ และเวลาของขั้นนี้", icon: Pencil, onSelect: onEdit } satisfies MoreMenuItem] : []),
                  ...(canFix
                    ? fixCommands(step, c).map<MoreMenuItem>((row) => ({
                        key: row.key,
                        // ขั้นกระดาษ: "ผ่านแทนช่าง" คือการจดตามที่ช่างเขียนไว้ ไม่ใช่ทางลัด
                        label: onPaper && row.key === "skip" ? "จดว่าเสร็จแล้ว (จากกระดาษ)" : row.label,
                        hint: row.enabled ? (onPaper && row.key === "skip" ? "ใส่ตามที่ช่างเขียนไว้ — ไม่บังคับ ส่งเข้า QC ก็ถือว่าผ่านให้" : row.desc) : row.why,
                        icon: onPaper && row.key === "skip" ? FileText : Wrench,
                        danger: onPaper && row.key === "skip" ? false : row.danger,
                        disabled: !row.enabled,
                        onSelect: row.run,
                      }))
                    : []),
                ]}
              />
            ) : null
          }
        >
          {effectivePrimary ?? (stuck && canFix ? (
            <Button variant="destructive" onClick={() => c.openEdit(step, "manager")}>
              <Wrench /> ปลดปัญหา / เปลี่ยนคน
            </Button>
          ) : null)}
          {canReport ? (
            <Button variant="ghost" onClick={() => setProblemOpen(true)}>
              <AlertTriangle /> แจ้งปัญหา
            </Button>
          ) : null}
        </ActionZone>
      </div>
      <ProblemDialog open={problemOpen} onClose={() => setProblemOpen(false)} step={step} c={c} />
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
