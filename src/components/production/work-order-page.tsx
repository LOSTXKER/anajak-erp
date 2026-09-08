"use client";

/**
 * /production/[id] — ใบผลิตแบบฟอร์ม (เบสเคาะ 2026-09-08 จากหน้าลอง /proto/work-order-form รอบ 11 "โอเคทำเลย")
 *
 * โครงเดียวกับหน้าออเดอร์: หัวใบ → ราง 1 2 3 (OrderStatusBar ตัวเดียวกับหน้าออเดอร์) → 2 แท็บ
 *   · ปุ่มหลักบนหัวใบ = ปุ่มของขั้นที่ยืนอยู่ (จาก `work-order-controller.primaryButton` ชุดเดิม — ไม่มีทางลัดสถานะใหม่)
 *   · ขั้นตอน — ซ้าย = ตารางรายตัว (แถวละไซซ์) ของขั้นที่ยืนอยู่ กรอกยอดต่อแถวได้ · ขวา = เช็คลิสต์ติ๊กได้ + ข้อมูลออเดอร์
 *   · สินค้า — ตารางรายการตัวเดียวกับหน้าออเดอร์ (ไม่มีเงิน) + ลาย/ม็อกอัพ + วัตถุดิบ
 *
 * ระยะ 2 (ROADMAP §A9.2–A9.5 เบสอนุมัติ 09-09): ผลติ๊กเก็บใน ProductionStepCheck · server กั้นปิดขั้นจนติ๊กครบ ·
 * ยอดต่อแถวเก็บใน OperationQuantity (ยอดรวมของขั้น = ผลบวก) · ย้อนขั้นผ่าน production.reopenStep (หัวหน้า) ·
 * ช่องคู่ = ขั้นที่ตั้ง pairWithPrevious รวมกับขั้นก่อนเป็นช่องเดียวบนราง (src/lib/work-order-rail.ts)
 * ราง = ขั้นเรียงตาม sortOrder ยืนที่ช่องแรกที่ยังมีขั้นไม่ปิด (แบบ A — ทุกขั้นปิดด้วยปุ่ม รวมขั้นที่เคยจดบนกระดาษ)
 * ไม่มีคำอธิบายในจอ (A8 ระดับ 1) — ชื่อ ตัวเลข สถานะ และเหตุที่กดไม่ได้เท่านั้น
 */

import { Suspense, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Factory, Flag, History, ImageIcon, Pause, Printer, RotateCcw, Store, UserRound } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { OrderItemsDisplay } from "@/components/orders/detail/order-items-display";
import { OrderStatusBar } from "@/components/orders/detail/order-status-bar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DueTag } from "@/components/ui/due-tag";
import { EmptyState } from "@/components/ui/empty-state";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { MoreMenu, type MoreMenuItem } from "@/components/ui/more-menu";
import { NumberInput } from "@/components/ui/number-input";
import { QueryError } from "@/components/ui/query-error";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RADIUS, TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { MaterialUsage } from "@/components/material-usage";
import { GarmentPickCard } from "@/components/production/garment-pick-card";
import { ProductionDesignCard } from "@/components/production/production-design-card";
import { ProblemDialog } from "@/components/production/step-command-dialogs";
import type { ProductionDetail, ProductionStep } from "@/components/production/types";
import { trpc } from "@/lib/trpc";
import { PRIORITY_LABELS } from "@/lib/order-status";
import { latestPlainProductionNote } from "@/lib/production-problem";
import { FLOW_OWNED_STEP_TYPES } from "@/lib/production-steps";
import { PRINT_POSITIONS, PRINT_TYPES, PRODUCT_TYPES } from "@/types/order-form";
import { missingStandards, workOrderStandards } from "@/lib/work-order-standards";
import { currentRailNode, railNodesOf } from "@/lib/work-order-rail";
import { routeWaitingOn } from "@/lib/work-order-route";
import { cn, formatDate, isImageUrl } from "@/lib/utils";
import { useWorkOrderController, type WorkOrderController } from "./work-order-controller";
import { activeOutsource, ProblemCard, daysFromNow, stepLabel, viewOf } from "./work-order-pieces";

const CHECKLIST_ANCHOR = "work-order-checklist";

/** ข้อที่ยังไม่ได้ติ๊กของขั้น — ปุ่มบนหัวใบกับด่าน server ใช้รายการเดียวกัน */
function ticksMissing(step: ProductionStep): number {
  return missingStandards(step.stepType, step.checks.map((t) => t.itemKey)).length;
}

/* ───────────────────────── หน้า ───────────────────────── */

function WorkOrder({ id }: { id: string }) {
  const c = useWorkOrderController(id);
  // กระดาษเป็นหลัก (ROADMAP §A5): QR บนใบสั่งงานพกเวอร์ชันม็อกอัพที่พิมพ์ (?mockup=n) — สแกนใบเก่าต้องรู้ทันที
  const scannedMockup = Number(useSearchParams().get("mockup") ?? "");
  return <WorkOrderView c={c} scannedMockup={scannedMockup} />;
}

/**
 * ตัวหน้าทั้งหมดรับ controller เป็น prop — ของจริงส่ง useWorkOrderController · หน้าลอง /proto/work-order-states
 * ส่ง controller ปลอมต่อสถานะ เพื่อให้เบสดูทุกสถานะจากหน้าเดียวกับที่ทีมใช้จริง (ไม่วาดซ้ำ)
 * itemsTab = แทนเนื้อแท็บสินค้าทั้งก้อน (หน้าลองไม่มี tRPC ของใบจริง)
 */
export function WorkOrderView({ c, scannedMockup = Number.NaN, itemsTab }: { c: WorkOrderController; scannedMockup?: number; itemsTab?: ReactNode }) {
  const { production, order, me, productionQuery, meQuery, workflowSteps, nowById, nowMs } = c;
  const approvedMockup = order?.designs[0]?.versionNumber ?? null;
  const stalePaper = Number.isFinite(scannedMockup) && scannedMockup > 0 && approvedMockup !== null && scannedMockup < approvedMockup;
  const [problemOpen, setProblemOpen] = useState(false);

  // ราง: ช่องละขั้น · ขั้นที่ตั้ง "เดินคู่กับขั้นก่อน" รวมอยู่ช่องเดียวกัน · ยืนที่ช่องแรกที่ยังมีขั้นไม่ปิด (แบบ A)
  const nodes = railNodesOf(workflowSteps);
  const openNodeIndex = currentRailNode(nodes);
  const allDone = workflowSteps.length > 0 && openNodeIndex < 0;
  const currentNodeIndex = openNodeIndex < 0 ? nodes.length - 1 : openNodeIndex;
  const currentNode = nodes[currentNodeIndex] ?? [];
  // ปุ่มบนหัวใบเป็นของขั้นแรกในช่องที่ยังไม่ปิดและไม่ติดรอ — ขั้นคู่ที่เหลือมีปุ่มของตัวเองในฟอร์ม
  const openInNode = currentNode.filter((s) => s.status !== "COMPLETED");
  const current = openInNode.find((s) => routeWaitingOn(s, workflowSteps).length === 0) ?? openInNode[0] ?? currentNode[currentNode.length - 1] ?? null;
  const pairedOpen = openInNode.filter((s) => s !== current);
  const currentOutsource = current ? activeOutsource(current) : null;
  const railLabels = nodes.map((node, i) => {
    const label = node.map(stepLabel).join(" + ");
    return nodes.some((o, j) => j !== i && o.map(stepLabel).join(" + ") === label) ? `${label} ${i + 1}` : label;
  });

  // ปุ่มของขั้น: ของอยู่ร้านนอก = รับงานกลับ (ใบตรวจรับเดิม) · ไม่งั้นปุ่มจากกติกาเดิมทั้งชุด
  // ปิดขั้นได้เมื่อติ๊กข้อกำหนดครบ (server กั้นอีกชั้น) — ปุ่มยังอยู่ที่เดิม กดแล้วพาไปเช็คลิสต์
  function actionFor(step: ProductionStep) {
    const outsource = activeOutsource(step);
    if (outsource && c.canUpdateStep && c.canOwnOrSupervise(step)) {
      return (
        <Button onClick={() => c.openOutsourceReturn(step.id, outsource.id)} disabled={c.writeDataStale}>
          รับงานกลับ
        </Button>
      );
    }
    const now = nowById.get(step.id);
    const closes = now?.action === "complete" || now?.action === "record-qty" || now?.action === "quick-pass";
    const missing = closes ? ticksMissing(step) : 0;
    if (missing > 0 && step.status !== "COMPLETED") {
      return (
        <Button aria-disabled className="opacity-60" onClick={() => document.getElementById(CHECKLIST_ANCHOR)?.scrollIntoView({ behavior: "smooth", block: "center" })}>
          ปิดขั้นนี้
        </Button>
      );
    }
    return c.primaryButton(step, now);
  }

  // ปุ่มหลักบนหัวใบ: ส่งเข้า QC เมื่อทุกขั้นปิดแล้ว · ก่อนนั้นเป็นปุ่มของขั้นที่ยืนอยู่เสมอ
  // (เบสเคาะ 09-08 ทุกขั้นปิดด้วยปุ่ม + ติ๊กครบ — ไม่ให้ทางลัด "ถือว่าผ่านขั้นกระดาษ" ข้ามเช็คลิสต์)
  const qcAction = production && c.canUpdateStep && allDone && (c.readyForQcViaPaper || c.legacyPackagingReadyForQc) ? (c.readyForQcViaPaper ? "paper" : "legacy") : null;
  const primary = qcAction ? (
    <Button
      onClick={() => (qcAction === "paper" ? c.sendToQc.mutate({ productionId: production!.id }) : c.legacyFinalize.mutate({ productionId: production!.id }))}
      disabled={c.sendToQc.isPending || c.legacyFinalize.isPending}
    >
      ส่งเข้า QC
    </Button>
  ) : current && !allDone ? (
    actionFor(current)
  ) : null;

  // ประโยคใต้ราง (เฉพาะตอนไปต่อไม่ได้) — รออะไร / ติดอะไร
  const waitingNames = current ? routeWaitingOn(current, workflowSteps).map(stepLabel) : [];
  const blockers: string[] = [];
  if (current && !allDone && !qcAction) {
    const missing = ticksMissing(current);
    if (current.status === "FAILED" || current.status === "ON_HOLD") blockers.push(current.status === "ON_HOLD" ? "งานถูกพักไว้" : "ติดปัญหา — รอหัวหน้าจัดการ");
    else if (waitingNames.length > 0) blockers.push(`รอ ${waitingNames.length === 1 ? waitingNames[0] : `${waitingNames.length} ขั้นก่อนหน้า`}`);
    else if (current.stepType === "DTF_PRINT" && current.printRunItems.length > 0) blockers.push(`อยู่ในรอบพิมพ์ ${current.printRunItems[0]!.printRun.runNumber}`);
    else if (!c.canUpdateStep && c.hasProductionPermission) blockers.push("ออเดอร์ยังไม่อยู่ในสถานะกำลังผลิต");
    else if (current.status === "IN_PROGRESS" && !currentOutsource && missing > 0) blockers.push(`ติ๊กข้อกำหนดอีก ${missing} ข้อก่อนปิดขั้น`);
  }

  // ย้อนกลับ = เปิดขั้นที่ปิดล่าสุดก่อนหน้าให้ทำต่อ (หัวหน้า · server ตรวจว่าขั้นถัดไปยังไม่เริ่ม)
  const flatIndex = current ? workflowSteps.indexOf(current) : workflowSteps.length;
  const reopenTarget = allDone ? (workflowSteps[workflowSteps.length - 1] ?? null) : ([...workflowSteps.slice(0, flatIndex)].reverse().find((s) => s.status === "COMPLETED") ?? null);
  const reopenBlocked = !!reopenTarget && (FLOW_OWNED_STEP_TYPES.has(reopenTarget.stepType) || reopenTarget.outsourceOrders.length > 0);
  const canManage = c.canSuperviseStep && c.hasProductionPermission;
  const menu: MoreMenuItem[] = current
    ? [
        {
          key: "undo",
          label: reopenTarget ? `ย้อนกลับไป ${stepLabel(reopenTarget)}` : "ย้อนกลับขั้นก่อน",
          icon: RotateCcw,
          hint: !canManage ? "หัวหน้าเท่านั้น" : !reopenTarget ? "ยังไม่มีขั้นที่ปิดแล้ว" : reopenBlocked ? "ขั้นนี้ปิดผ่านหลักฐานของระบบ" : undefined,
          disabled: !canManage || !reopenTarget || reopenBlocked || c.reopenPending,
          danger: true,
          onSelect: () => void (reopenTarget && c.handleReopen(reopenTarget)),
        },
        {
          key: "problem",
          label: "แจ้งปัญหาขั้นนี้",
          icon: Flag,
          hint: current.status === "COMPLETED" ? "ขั้นนี้ปิดแล้ว" : current.status === "FAILED" ? "แจ้งไว้แล้ว" : undefined,
          disabled: !(c.canUpdateStep && c.canOwnOrSupervise(current) && current.status !== "COMPLETED" && current.status !== "FAILED"),
          onSelect: () => setProblemOpen(true),
        },
        {
          key: "assign",
          label: "มอบหมาย / แก้ให้",
          icon: UserRound,
          hint: canManage ? (current.status === "COMPLETED" ? "ขั้นนี้ปิดแล้ว" : undefined) : "หัวหน้าเท่านั้น",
          disabled: !canManage || current.status === "COMPLETED",
          onSelect: () => c.openEdit(current, "manager"),
        },
        ...(order ? [{ key: "history", label: "ประวัติออเดอร์", icon: History, onSelect: () => window.open(`/orders/${order.id}?tab=history`, "_blank") }] : []),
        {
          key: "hold",
          label: current.status === "ON_HOLD" ? "คืนขั้นนี้กลับคิว" : "พักขั้นนี้ไว้ก่อน",
          icon: Pause,
          hint: canManage ? (current.status === "COMPLETED" ? "ขั้นนี้ปิดแล้ว" : undefined) : "หัวหน้าเท่านั้น",
          disabled: !canManage || current.status === "COMPLETED" || current.status === "FAILED",
          danger: current.status !== "ON_HOLD",
          onSelect: () => void c.handleSupervisorStatus(current, current.status === "ON_HOLD" ? "PENDING" : "ON_HOLD"),
        },
      ]
    : [];

  return (
    <>
      <PageShell
        title={order?.orderNumber ?? "ใบผลิต"}
        icon={Factory}
        tone="production"
        back={{ href: "/production", label: "กลับหน้าการผลิต" }}
        description={order ? (order.customer?.name ?? "ไม่ระบุลูกค้า") : ""}
        titleBadge={
          order && (order.priority === "URGENT" || order.priority === "HIGH" || allDone) ? (
            <span className="flex flex-wrap items-center gap-1.5">
              {allDone ? <Badge variant="success" size="sm">ครบทุกขั้น</Badge> : null}
              {order.priority === "URGENT" || order.priority === "HIGH" ? (
                <Badge variant={order.priority === "URGENT" ? "destructive" : "warning"} size="sm">
                  {PRIORITY_LABELS[order.priority] ?? order.priority}
                </Badge>
              ) : null}
            </span>
          ) : undefined
        }
        action={
          production && order ? (
            <>
              <Button asChild variant="outline" size="sm">
                <a href={`/print/job-ticket/${order.id}?production=${production.id}`} target="_blank" rel="noreferrer" aria-label="พิมพ์ใบสั่งงาน (เปิดแท็บใหม่)">
                  <Printer />
                  <span className="hidden sm:inline">ใบสั่งงาน</span>
                </a>
              </Button>
              {primary}
              <MoreMenu items={menu} size="sm" />
            </>
          ) : undefined
        }
        loading={productionQuery.isLoading || meQuery.isLoading}
        skeleton={
          <>
            <Skeleton className="h-16 rounded-2xl" />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
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
            {workflowSteps.length > 0 ? (
              <OrderStatusBar
                flowSteps={railLabels}
                currentStepIndex={currentNodeIndex}
                internalStatus={railLabels[currentNodeIndex]!}
                customerStatus="PRODUCING"
                revisions={[]}
                cancelledAt={null}
                cancelledReason={null}
                blockers={blockers}
              />
            ) : null}

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
                แบบเปลี่ยนหลังพิมพ์ใบนี้
              </Alert>
            ) : null}
            {c.problemSteps.map((s) => (
              <ProblemCard key={s.id} step={s} />
            ))}

            {workflowSteps.length === 0 ? (
              <EmptyState icon={Factory} title="ใบผลิตนี้ยังไม่มีขั้นตอน" />
            ) : (
              <Tabs defaultValue="steps">
                <TabsBar>
                  <TabsList aria-label="ส่วนของใบผลิต">
                    <TabsTrigger value="steps" hasPending={c.problemSteps.length > 0}>ขั้นตอน</TabsTrigger>
                    <TabsTrigger value="items">สินค้า</TabsTrigger>
                  </TabsList>
                </TabsBar>
                <div className="mt-6">
                  <TabsContent value="steps" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
                    <div className="min-w-0 space-y-6">
                      {allDone || !current ? (
                        <Section title="ครบทุกขั้นแล้ว" icon={CheckCircle2} tone="production">
                          <p className="text-sm text-secondary">{qcAction ? "กดส่งเข้า QC บนหัวใบ" : "งานอยู่ที่ QC"}</p>
                        </Section>
                      ) : (
                        <>
                          {current.stepType === "GARMENT_PICK" ? (
                            <GarmentPickCard
                              productionId={production.id}
                              steps={workflowSteps}
                              stepId={current.id}
                              canIssueGarments={c.canUpdateStep && c.canOwnOrSupervise(current)}
                              canReturnGarments={c.canSuperviseStep && c.hasProductionPermission && !c.writeDataStale}
                              embedded
                              primaryTask
                            />
                          ) : (
                            <StepPieceTable key={current.id} step={current} order={order} c={c} />
                          )}
                          {pairedOpen.map((s) => (
                            <Section
                              key={s.id}
                              title={stepLabel(s)}
                              action={
                                <span className="flex items-center gap-2">
                                  <InfoChip size="sm" tone={viewOf(s, nowById.get(s.id)).chip}>{viewOf(s, nowById.get(s.id)).label}</InfoChip>
                                  {actionFor(s)}
                                </span>
                              }
                            >
                              <FactList columns={2}>
                                <Fact size="sm" icon={UserRound} label="ผู้ทำ" value={s.assignedTo?.name ?? "ยังไม่มีคนรับ"} tone={s.assignedTo ? "default" : "muted"} />
                                {s.qtyTotal ? <Fact size="sm" label="ทำแล้ว" value={`${(s.qtyDone ?? 0).toLocaleString("th-TH")} / ${s.qtyTotal.toLocaleString("th-TH")} ตัว`} /> : null}
                              </FactList>
                            </Section>
                          ))}
                        </>
                      )}
                    </div>
                    <aside className="space-y-6 lg:sticky lg:top-4">
                      {!allDone
                        ? [current, ...pairedOpen].filter((s): s is ProductionStep => !!s).map((s, i) => (
                            <div key={s.id} id={i === 0 ? CHECKLIST_ANCHOR : undefined}>
                              <ChecklistCard step={s} c={c} nowMs={nowMs} />
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
                  </TabsContent>

                  <TabsContent value="items" className="space-y-6">
                    {itemsTab ?? (
                      <>
                        <ProductsTab orderId={order.id} />
                        <ProductionDesignCard order={order} focusStepType={current?.stepType} />
                        <MaterialUsage productionId={production.id} orderNumber={order.orderNumber} showCosts={c.canSeeCost} readOnly={!c.canUpdateStep} embedded />
                      </>
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            )}
          </div>
        )}
      </PageShell>
      {current ? <ProblemDialog open={problemOpen} onClose={() => setProblemOpen(false)} step={current} c={c} /> : null}
      {c.dialogs}
    </>
  );
}

/* ───────────────────────── ซ้าย: ตารางรายตัวของขั้นที่ยืนอยู่ ───────────────────────── */

const TH = "px-2 py-2.5 text-xs font-medium";
const TD = "px-2 py-2 align-middle text-sm";

type PieceRow = { key: string; variantId: string | null; product: string; color: string | null; size: string | null; qty: number; thumb: string | null; prints: string[] };
type RowQty = { done: number; waste: number };

/** แถวละไซซ์จาก order.items ของใบผลิต (ชุดเดียวกับตารางรายการหน้าออเดอร์) */
export function pieceRowsOf(order: ProductionDetail["order"]): PieceRow[] {
  return order.items.flatMap((item) => {
    const prints = item.prints.map((p) => `${PRINT_POSITIONS[p.position] ?? p.position} ${PRINT_TYPES[p.printType] ?? p.printType}`);
    const thumbSrc = item.prints.map((p) => p.artwork?.imageUrl ?? p.designImageUrl).find((u) => isImageUrl(u)) ?? null;
    return item.products.flatMap((prod): PieceRow[] => {
      const name = prod.description || PRODUCT_TYPES[prod.productType ?? ""] || "สินค้า";
      if (prod.variants.length === 0) return [{ key: prod.id, variantId: null, product: name, color: prod.fabricColor ?? null, size: null, qty: prod.totalQuantity ?? 0, thumb: thumbSrc, prints }];
      return prod.variants.map((v) => ({ key: v.id, variantId: v.id, product: name, color: v.color ?? prod.fabricColor ?? null, size: v.size || null, qty: v.quantity, thumb: thumbSrc, prints }));
    });
  });
}

/** ตารางรายตัว: แถวละไซซ์ · ขั้นที่นับยอดกรอก "ทำแล้ว/เสีย" ต่อแถวได้ — ยอดรวมของขั้น = ผลบวก (server) */
export function StepPieceTable({ step, order, c }: { step: ProductionStep; order: ProductionDetail["order"]; c: WorkOrderController }) {
  const rows = pieceRowsOf(order);
  const total = rows.reduce((n, r) => n + r.qty, 0);
  const counting = step.qtyTotal !== null && step.qtyTotal > 0;
  const editable = counting && c.canUpdateStep && c.canOwnOrSupervise(step) && step.status !== "COMPLETED" && step.status !== "FAILED" && !FLOW_OWNED_STEP_TYPES.has(step.stepType);
  const view = viewOf(step, c.nowById.get(step.id));
  const saved = useMemo(() => {
    const map: Record<string, RowQty> = {};
    for (const q of step.quantities) if (q.sourceOrderItemVariantId) map[q.sourceOrderItemVariantId] = { done: q.qtyGood, waste: q.qtyScrap };
    return map;
  }, [step.quantities]);
  const [draft, setDraft] = useState<Record<string, RowQty>>({});
  const valueOf = (key: string): RowQty => draft[key] ?? saved[key] ?? { done: 0, waste: 0 };
  const variantRows = rows.filter((r) => r.variantId);
  const showQty = editable || step.quantities.length > 0;
  const dirty = variantRows.some((r) => {
    const d = draft[r.key];
    if (!d) return false;
    const s = saved[r.key] ?? { done: 0, waste: 0 };
    return d.done !== s.done || d.waste !== s.waste;
  });
  const doneSum = variantRows.reduce((n, r) => n + valueOf(r.key).done, 0);
  const wasteSum = variantRows.reduce((n, r) => n + valueOf(r.key).waste, 0);
  const setRow = (key: string, patch: Partial<RowQty>) => setDraft((d) => ({ ...d, [key]: { ...valueOf(key), ...patch } }));
  const fillAll = () => setDraft(Object.fromEntries(variantRows.map((r) => [r.key, { done: r.qty, waste: 0 }])));
  const save = () => c.savePieceQty(step.id, variantRows.map((r) => ({ variantId: r.variantId!, ...valueOf(r.key) })));

  return (
    <Section
      title={stepLabel(step)}
      meta={counting ? <span className="tabular-nums">{(step.qtyDone ?? 0).toLocaleString("th-TH")} / {step.qtyTotal!.toLocaleString("th-TH")} ตัว</span> : undefined}
      action={
        <span className="flex items-center gap-2">
          <InfoChip size="sm" tone={view.chip}>{view.label}</InfoChip>
          {editable && variantRows.length > 0 ? (
            <Button size="sm" variant="outline" onClick={fillAll}>
              ครบทุกแถว
            </Button>
          ) : null}
          {editable && variantRows.length === 0 ? (
            <Button size="sm" variant="outline" onClick={() => c.openQty(step.id)}>
              บันทึกยอด
            </Button>
          ) : null}
          {dirty ? (
            <Button size="sm" onClick={save} disabled={c.piecePending}>
              บันทึกยอด
            </Button>
          ) : null}
        </span>
      }
      flush
    >
      {rows.length === 0 ? (
        <EmptyState icon={ImageIcon} title="ออเดอร์นี้ยังไม่มีรายการเสื้อ" />
      ) : (
        <div className="overflow-x-auto">
          <table className={cn("w-full table-fixed", showQty ? "min-w-[640px]" : "min-w-[520px]")}>
            <colgroup>
              <col style={{ width: 40 }} />
              <col />
              <col style={{ width: 180 }} />
              <col style={{ width: 80 }} />
              {showQty ? <col style={{ width: 96 }} /> : null}
              {showQty ? <col style={{ width: 96 }} /> : null}
            </colgroup>
            <thead className={TABLE_HEAD_SURFACE}>
              <tr>
                <th className={cn(TH, "text-center")}>#</th>
                <th className={cn(TH, "text-left")}>สินค้า</th>
                <th className={cn(TH, "text-left")}>ลาย</th>
                <th className={cn(TH, "text-right")}>จำนวน</th>
                {showQty ? <th className={cn(TH, "text-right")}>ทำแล้ว</th> : null}
                {showQty ? <th className={cn(TH, "text-right")}>เสีย</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {rows.map((r, i) => {
                const v = valueOf(r.key);
                const rowLabel = [r.color, r.size].filter(Boolean).join(" ") || r.product;
                return (
                  <tr key={r.key}>
                    <td className={cn(TD, "text-center tabular-nums text-muted")}>{i + 1}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        {r.thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element -- รูปลายจากคลัง/ไฟล์ที่อัปโหลด
                          <img src={r.thumb} alt="" className={cn("h-10 w-10 shrink-0 border border-border bg-surface-muted object-cover", RADIUS.inner)} />
                        ) : (
                          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-surface-muted", RADIUS.inner)}>
                            <ImageIcon className="h-4 w-4 text-muted" aria-hidden="true" />
                          </div>
                        )}
                        <p className="min-w-0 text-sm font-medium text-strong [overflow-wrap:anywhere]">
                          {r.product}
                          {r.color || r.size ? <span className="ml-1.5 font-semibold">{[r.color, r.size].filter(Boolean).join(" ")}</span> : null}
                        </p>
                      </div>
                    </td>
                    <td className={cn(TD, "text-xs text-secondary")}>{r.prints.join(" · ") || "—"}</td>
                    <td className={cn(TD, "text-right text-base font-semibold tabular-nums text-strong")}>{r.qty.toLocaleString("th-TH")}</td>
                    {showQty ? (
                      <td className={cn(TD, "text-right")}>
                        {editable && r.variantId ? (
                          <NumberInput integer min={0} max={r.qty} value={v.done} onValueChange={(n) => setRow(r.key, { done: n })} placeholder="0" aria-label={`ทำแล้ว ${rowLabel}`} className="h-9 w-full text-right" />
                        ) : (
                          <span className={cn("tabular-nums", v.done > 0 ? "font-semibold text-strong" : "text-muted")}>{r.variantId ? v.done.toLocaleString("th-TH") : "—"}</span>
                        )}
                      </td>
                    ) : null}
                    {showQty ? (
                      <td className={cn(TD, "text-right")}>
                        {editable && r.variantId ? (
                          <NumberInput integer min={0} max={r.qty} value={v.waste} onValueChange={(n) => setRow(r.key, { waste: n })} placeholder="0" aria-label={`เสีย ${rowLabel}`} className="h-9 w-full text-right" />
                        ) : (
                          <span className={cn("tabular-nums", v.waste > 0 ? "font-semibold text-amber-700 dark:text-amber-300" : "text-muted")}>{r.variantId ? v.waste.toLocaleString("th-TH") : "—"}</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-divider">
                <td colSpan={3} className={cn(TD, "text-xs text-muted")}>รวม</td>
                <td className={cn(TD, "text-right")}>
                  <Metric size="sm" value={total.toLocaleString("th-TH")} unit="ตัว" className="items-end" />
                </td>
                {showQty ? (
                  <td className={cn(TD, "text-right")}>
                    <Metric size="sm" value={doneSum.toLocaleString("th-TH")} className="items-end" />
                  </td>
                ) : null}
                {showQty ? (
                  <td className={cn(TD, "text-right")}>
                    <Metric size="sm" value={wasteSum.toLocaleString("th-TH")} className="items-end" tone={wasteSum > 0 ? "warning" : undefined} />
                  </td>
                ) : null}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Section>
  );
}

/* ───────────────────────── ขวา: เช็คลิสต์ของขั้นที่ยืนอยู่ ───────────────────────── */

export function ChecklistCard({ step, c, nowMs }: { step: ProductionStep; c: WorkOrderController; nowMs: number }) {
  const standards = workOrderStandards(step.stepType);
  const done = step.status === "COMPLETED";
  const outsource = activeOutsource(step);
  const ticked = new Map(step.checks.map((t) => [t.itemKey, t.checkedBy.name]));
  const missing = done ? 0 : ticksMissing(step);
  const canTick = c.canUpdateStep && c.canOwnOrSupervise(step) && !done && step.status !== "FAILED";
  const view = viewOf(step, c.nowById.get(step.id));
  return (
    <Section
      title={stepLabel(step)}
      action={
        <span className="flex items-center gap-2">
          {missing > 0 ? <InfoChip size="sm" tone="warning">ติ๊กอีก {missing} ข้อ</InfoChip> : null}
          <InfoChip size="sm" tone={view.chip}>{view.label}</InfoChip>
        </span>
      }
    >
      <div className="space-y-4">
        <FactList columns={1}>
          <Fact size="sm" icon={UserRound} label="ผู้ทำ" value={step.assignedTo?.name ?? "ยังไม่มีคนรับ"} tone={step.assignedTo ? "default" : "muted"} />
        </FactList>
        {outsource ? (
          <FactList columns={1}>
            <Fact size="sm" icon={Store} label="ร้านนอก" value={outsource.vendor.name} sub={outsource.sentAt ? `ส่งไป ${formatDate(outsource.sentAt)}` : undefined} />
            <Fact
              size="sm"
              label="นัดรับกลับ"
              value={<DueTag dueInDays={daysFromNow(outsource.expectedBackAt, nowMs)} dateLabel={outsource.expectedBackAt ? formatDate(outsource.expectedBackAt) : "ยังไม่นัด"} size="sm" />}
            />
          </FactList>
        ) : null}
        {step.status === "FAILED" || step.status === "ON_HOLD" ? (
          <p className="flex items-start gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {step.status === "ON_HOLD" ? "พักไว้" : "รอหัวหน้าจัดการ"}
          </p>
        ) : null}
        {standards.length > 0 ? (
          <ul>
            {standards.map((label) => {
              const on = done || ticked.has(label);
              const who = ticked.get(label);
              return (
                <li key={label}>
                  <label className={cn("flex min-h-11 items-center gap-3 text-sm", canTick ? "cursor-pointer" : "cursor-default")}>
                    <Checkbox
                      checked={on}
                      disabled={!canTick || c.tickPending}
                      onChange={(e) => c.tickStandard(step.id, label, e.target.checked)}
                      className="h-5 w-5"
                    />
                    <span className={cn("min-w-0 flex-1", on ? "text-secondary" : "font-medium text-strong")}>{label}</span>
                    {who ? <span className="shrink-0 text-xs text-muted">{who}</span> : null}
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </Section>
  );
}

/* ───────────────────────── แท็บสินค้า — ตารางรายการตัวเดียวกับหน้าออเดอร์ ───────────────────────── */

function ProductsTab({ orderId }: { orderId: string }) {
  const q = trpc.order.getById.useQuery({ id: orderId });
  if (!q.data && (q.isLoading || q.isFetching)) return <Skeleton className="h-64 rounded-2xl" />;
  if (!q.data) return <QueryError message="โหลดรายการสินค้าไม่สำเร็จ" onRetry={() => void q.refetch()} />;
  return <OrderItemsDisplay orderId={orderId} items={q.data.items} fees={q.data.fees} showMoney={false} canEditReceiveTracking={false} />;
}

export type { ProductionDetail };

export function WorkOrderPage({ id }: { id: string }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <WorkOrder id={id} />
    </Suspense>
  );
}
