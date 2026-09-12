"use client";

/** ใบผลิตใช้ controller เดียวกับหน้างาน; การเลือกเปิดดูขั้นไม่มีผลต่อสถานะหรือคำสั่งที่ลงมือได้ */

import { Suspense, useRef, useState, type MouseEvent, type ReactNode, type Ref } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, Factory, Flag, History, Pause, Printer, RotateCcw, UserRound } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Fact, FactList } from "@/components/ui/fact";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { MoreMenu, type MoreMenuItem } from "@/components/ui/more-menu";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GarmentReceiveInline } from "@/components/production/garment-receive-inline";
import { ProblemDialog } from "@/components/production/step-command-dialogs";
import type { ProductionStep } from "@/components/production/types";
import { PRIORITY_LABELS } from "@/lib/order-status";
import { permAllows } from "@/lib/permissions";
import { cn, formatDateTime } from "@/lib/utils";
import { FLOW_OWNED_STEP_TYPES } from "@/lib/production-steps";
import { currentRailNode, railNodesOf } from "@/lib/work-order-rail";
import { routeWaitingOn } from "@/lib/work-order-route";
import { workOrderStandards } from "@/lib/work-order-standards";
import { useWorkOrderController, type WorkOrderController } from "./work-order-controller";
import { activeOutsource, dtfUnavailableReason, outsourceReceiptCandidates, outsourceStepReason, ProblemCard, StateChip, stepLabel, viewOf } from "./work-order-pieces";
import { checklistAnchor, ticksMissing } from "./work-order-checklist";
import { pieceTableAnchor, pieceRowsOf, StepPieceTable } from "./work-order-quantities";
import { WorkOrderRouteOverview, WorkOrderSteps, type WorkOrderVariant } from "./work-order-steps";
import { WorkOrderItems } from "./work-order-items";

/** พาไปช่องแรกที่ยังต้องทำก่อนปิดขั้น */
function focusFirst(anchor: string, selector: string) {
  const el = document.querySelector<HTMLElement>(`#${anchor} ${selector}`);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  el?.focus();
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
export function WorkOrderView({ c, scannedMockup = Number.NaN, itemsTab, variant = "current", onNavigate }: { c: WorkOrderController; scannedMockup?: number; itemsTab?: ReactNode; variant?: WorkOrderVariant; onNavigate?: (label: string) => void }) {
  const { production, order, me, productionQuery, meQuery, workflowSteps, nowById } = c;
  const approvedMockup = order?.designs[0]?.versionNumber ?? null;
  const stalePaper = Number.isFinite(scannedMockup) && scannedMockup > 0 && approvedMockup !== null && scannedMockup < approvedMockup;
  const [problemStep, setProblemStep] = useState<ProductionStep | null>(null);
  // แก้ยอดตรวจรับที่นับผิด (A15) — เปิดจากเมนู ⋯ เพราะกล่องของขั้นนั้นไม่แสดงแล้วเมื่อขั้นปิดไป
  const [fixReceiveOpen, setFixReceiveOpen] = useState(false);
  const [viewedStepId, setViewedStepId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("steps");
  const currentStepButtonRef = useRef<HTMLButtonElement>(null);

  // ขั้นที่ลงมือได้ยังมาจากลำดับและคำสั่งเดิม การเลือกเปิดดูด้านล่างไม่เปลี่ยนกลุ่มนี้
  const nodes = railNodesOf(workflowSteps);
  const openNodeIndex = currentRailNode(nodes);
  const allDone = workflowSteps.length > 0 && openNodeIndex < 0;
  const currentNodeIndex = openNodeIndex < 0 ? nodes.length - 1 : openNodeIndex;
  const currentNode = nodes[currentNodeIndex] ?? [];
  const openInNode = currentNode.filter((s) => s.status !== "COMPLETED");
  // ลำดับเลือก: ขั้นที่มีปุ่มให้กดจริงและไม่ได้อยู่ร้านนอก → ขั้นที่ไม่ติดรอ → ขั้นแรกที่ยังไม่ปิด
  const actionable = openInNode.filter((s) => nowById.get(s.id)?.action && !activeOutsource(s));
  const notWaiting = openInNode.filter((s) => routeWaitingOn(s, workflowSteps).length === 0);
  const current = actionable[0] ?? notWaiting.find((s) => !activeOutsource(s)) ?? notWaiting[0] ?? openInNode[0] ?? currentNode[currentNode.length - 1] ?? null;
  const pairedOpen = openInNode.filter((s) => s !== current);
  const viewedStep = workflowSteps.find((step) => step.id === viewedStepId) ?? null;
  const readOnlyStep = viewedStep && (allDone || !openInNode.some((step) => step.id === viewedStep.id)) ? viewedStep : null;

  // ปุ่มของขั้น: ของอยู่ร้านนอก = รับงานกลับ (ใบตรวจรับเดิม) · ไม่งั้นปุ่มจากกติกาเดิมทั้งชุด
  // ปิดขั้นได้เมื่อติ๊กข้อกำหนดครบ (server กั้นอีกชั้น) — ปุ่มยังอยู่ที่เดิม กดแล้วพาไปเช็คลิสต์
  const hasVariantRows = order ? pieceRowsOf(order).some((r) => r.variantId) : false;
  function actionFor(step: ProductionStep) {
    // ขั้นตรวจรับเสื้อลูกค้ามีปุ่มบันทึกอยู่ในฟอร์มนับจริงในกล่องแล้ว (ไม่เด้ง dialog อีก)
    if (step.stepType === "GARMENT_RECEIVE" && !activeOutsource(step)) return null;
    const outsource = activeOutsource(step);
    if (outsource) {
      const receipts = outsourceReceiptCandidates(step);
      if (!c.canUpdateStep || !c.canOwnOrSupervise(step) || !permAllows(me?.permissions, "manage_delivery") || receipts.length === 0) return <Button asChild variant="outline"><Link href={onNavigate ? "#work-order-preview" : `/production/outsource?production=${step.productionId}`}>จัดการส่ง / รับกลับ / ตรวจรับ</Link></Button>;
      return (
        <div className="w-full divide-y divide-divider">
          <Button asChild variant="outline" className="mb-3"><Link href={onNavigate ? "#work-order-preview" : `/production/outsource?production=${step.productionId}`}>เปิดใบงานร้านนอก</Link></Button>
          {receipts.map((receipt) => (
            <div key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-strong">{receipt.vendor.name} · {receipt.quantity.toLocaleString("th-TH")} ตัว</p>
                <p className="text-sm text-secondary">{receipt.description || stepLabel(step)}</p>
                <p className="text-xs text-muted">ใบวันที่ {formatDateTime(receipt.createdAt)}</p>
              </div>
              <Button aria-label={`บันทึกหลักฐานรับกลับจาก ${receipt.vendor.name} ${receipt.quantity} ตัว ใบวันที่ ${formatDateTime(receipt.createdAt)}`} onClick={() => c.openOutsourceReturn(step.id, receipt.id)}>บันทึกหลักฐานรับกลับ</Button>
            </div>
          ))}
        </div>
      );
    }
    const now = nowById.get(step.id);
    const closes = now?.action === "complete" || now?.action === "record-qty" || now?.action === "quick-pass";
    if (closes && step.status !== "COMPLETED") {
      // ยังติ๊กไม่ครบ → ปุ่มพาไปข้อแรกที่ยังว่าง · ยอดยังไม่ครบ (ใบที่มีตารางรายตัว) → พาไปช่องยอดแถวแรก
      if (ticksMissing(step) > 0) {
        return (
          <Button aria-disabled onClick={() => focusFirst(checklistAnchor(step.id), "input[type=checkbox]:not(:checked)")}>
            ปิดขั้นนี้
          </Button>
        );
      }
      if (hasVariantRows && step.qtyTotal && (step.qtyDone ?? 0) < step.qtyTotal) {
        return (
          <Button aria-disabled onClick={() => focusFirst(pieceTableAnchor(step.id), "input")}>
            ปิดขั้นนี้
          </Button>
        );
      }
    }
    return c.primaryButton(step, now);
  }

  const canManageStep = c.canSuperviseStep && c.hasProductionPermission;

  // คำสั่งและเงื่อนไขอยู่กับข้อมูลของขั้นที่คำสั่งจะเปลี่ยน
  function stepFooter(step: ProductionStep) {
    const action = actionFor(step);
    const canReport = c.canUpdateStep && c.canOwnOrSupervise(step) && step.status !== "COMPLETED" && step.status !== "FAILED";
    const reason = step.status !== "COMPLETED" ? blockReason(step) : null;
    const now = nowById.get(step.id);
    // คงคำช่วยเมื่อมีเงื่อนไขที่ต้องแก้ก่อนลงมือ
    const readyAction = c.canUpdateStep && c.canOwnOrSupervise(step) && !activeOutsource(step) && !dtfUnavailableReason(step)
      && step.status !== "ON_HOLD" && step.status !== "FAILED"
      && (now?.action === "start" || now?.action === "send-outsource"
        || ((now?.action === "complete" || now?.action === "record-qty" || now?.action === "quick-pass")
          && ticksMissing(step) === 0 && !(hasVariantRows && step.qtyTotal && (step.qtyDone ?? 0) < step.qtyTotal)));
    const visibleReason = !readyAction ? reason : null;
    if (!action && !canReport && !reason) return null;
    return (
      <>
        {visibleReason ? <p className="w-full text-sm text-secondary">{visibleReason}</p> : null}
        {action}
        {canReport ? (
          <Button variant="outline" onClick={() => setProblemStep(step)}>
            <Flag /> แจ้งปัญหาขั้นนี้
          </Button>
        ) : null}
      </>
    );
  }

  function assignAction(step: ProductionStep) {
    if (!canManageStep || step.status === "COMPLETED") return null;
    return (
      <Button size="sm" variant="outline" onClick={() => c.openEdit(step, "manager")}>
        <UserRound /> {step.assignedTo ? "เปลี่ยนคนทำ" : "มอบหมาย"}
      </Button>
    );
  }

  /** ทำไมยังไปขั้นถัดไปไม่ได้ — ประโยคเดียวที่หัวใบใช้บอกคนอ่าน (เรียงจากเหตุที่ "แก้ได้ที่นี่เลย" ก่อน) */
  function blockReason(step: ProductionStep): string {
    const outsource = activeOutsource(step);
    if (c.writeDataStale) return "โหลดข้อมูลล่าสุดก่อนลงมือ เพื่อไม่บันทึกทับข้อมูลที่เปลี่ยนไป";
    if (!c.hasProductionPermission) return "บัญชีนี้ดูงานได้ ให้ทีมผลิตหรือหัวหน้าเป็นผู้บันทึกขั้นนี้";
    if (step.status === "ON_HOLD") return "ขั้นนี้ถูกพักไว้";
    if (step.status === "FAILED") return "ขั้นนี้ติดปัญหา รอหัวหน้าจัดการ";
    if (outsource) {
      const receipts = outsourceReceiptCandidates(step);
      if (receipts.length > 0) return `${receipts.length} ใบรอรับกลับ — ตรวจนับของจริง แล้วยืนยันรับกลับและผลตรวจจากหน้าใบงานร้านนอก`;
      const state = outsourceStepReason(step);
      return `${state} — เปิดใบงานร้านนอกเพื่อส่ง รับกลับ หรือตรวจรับ`;
    }
    const waiting = routeWaitingOn(step, workflowSteps).map(stepLabel);
    if (waiting.length > 0 && !nowById.get(step.id)?.action) return `รอ ${waiting.length === 1 ? waiting[0] : `${waiting.length} ขั้นก่อนหน้า`}`;
    if (!c.canUpdateStep && c.hasProductionPermission) return "ออเดอร์ยังไม่อยู่ในสถานะกำลังผลิต";
    if (step.assignedTo && !c.canOwnOrSupervise(step)) return `งานของ ${step.assignedTo.name}`;
    const dtfReason = dtfUnavailableReason(step);
    if (dtfReason) return dtfReason;
    if (step.stepType === "GARMENT_RECEIVE") return "นับเสื้อที่รับจริงในตาราง แล้วบันทึกหลักฐานตรวจรับ";
    const now = nowById.get(step.id);
    if (now?.action === "start") return `กด “${!step.assignedTo && !c.canSuperviseStep ? "รับงานนี้" : "เริ่มทำ"}” เมื่อพร้อมลงมือ`;
    if (now?.action === "send-outsource") return "สร้างใบร้านนอกเพื่อระบุร้าน จำนวน และกำหนดรับกลับ";
    const closes = now?.action === "complete" || now?.action === "record-qty" || now?.action === "quick-pass";
    const missing = ticksMissing(step);
    if (closes && missing > 0) return `ติ๊กข้อกำหนดของขั้นนี้อีก ${missing} ข้อ`;
    if (closes && hasVariantRows && step.qtyTotal && (step.qtyDone ?? 0) < step.qtyTotal) {
      return `ยอดยังไม่ครบ ${(step.qtyDone ?? 0).toLocaleString("th-TH")} / ${step.qtyTotal.toLocaleString("th-TH")} ตัว`;
    }
    const note = now?.note;
    if (note) return note;
    return `กดปิดขั้น ${stepLabel(step)} ในกล่องด้านล่าง`;
  }

  const qcAction = production && c.canUpdateStep && allDone && (c.readyForQcViaPaper || c.legacyPackagingReadyForQc) ? (c.readyForQcViaPaper ? "paper" : "legacy") : null;
  const primary = qcAction ? (
    <Button
      onClick={() => (qcAction === "paper" ? c.sendToQc.mutate({ productionId: production!.id }) : c.legacyFinalize.mutate({ productionId: production!.id }))}
      disabled={c.sendToQc.isPending || c.legacyFinalize.isPending}
    >
      ส่งเข้า QC
    </Button>
  ) : null;

  // ย้อนกลับ = เปิดขั้นที่ปิดล่าสุดก่อนหน้าให้ทำต่อ (หัวหน้า · server ตรวจว่าขั้นถัดไปยังไม่เริ่ม)
  const flatIndex = current ? workflowSteps.indexOf(current) : workflowSteps.length;
  const reopenTarget = allDone ? (workflowSteps[workflowSteps.length - 1] ?? null) : ([...workflowSteps.slice(0, flatIndex)].reverse().find((s) => s.status === "COMPLETED") ?? null);
  const reopenBlocked = !!reopenTarget && (FLOW_OWNED_STEP_TYPES.has(reopenTarget.stepType) || reopenTarget.outsourceOrders.length > 0);
  const canManage = canManageStep;
  const receiveStep = workflowSteps.find((step) => step.stepType === "GARMENT_RECEIVE") ?? null;
  // คำสั่งในเมนูระบุขั้นเป้าหมายจริง แม้ผู้ใช้กำลังเปิดอ่านขั้นอื่น
  const menu: MoreMenuItem[] = current
    ? [
        {
          key: "hold",
          label: current.status === "ON_HOLD" ? `คืน ${stepLabel(current)} กลับคิว` : `พัก ${stepLabel(current)}`,
          icon: Pause,
          hint: canManage ? (current.status === "COMPLETED" ? "ขั้นนี้ปิดแล้ว" : undefined) : "หัวหน้าเท่านั้น",
          disabled: !canManage || current.status === "COMPLETED" || current.status === "FAILED",
          onSelect: () => void c.handleSupervisorStatus(current, current.status === "ON_HOLD" ? "PENDING" : "ON_HOLD"),
        },
        ...(receiveStep
          ? [
              {
                key: "fix-receive",
                label: "แก้ยอดตรวจรับเสื้อ",
                icon: ClipboardCheck,
                hint: canManage ? "นับผิด/รับไม่ครบ — กรอกยอดที่ถูกต้อง ระบบออกใบส่วนต่างให้" : "หัวหน้าเท่านั้น",
                disabled: !canManage,
                onSelect: () => setFixReceiveOpen(true),
              },
            ]
          : []),
        {
          key: "undo",
          label: reopenTarget ? `ย้อนกลับไป ${stepLabel(reopenTarget)}` : "ย้อนกลับขั้นก่อน",
          icon: RotateCcw,
          hint: !canManage ? "หัวหน้าเท่านั้น" : !reopenTarget ? "ยังไม่มีขั้นที่ปิดแล้ว" : reopenBlocked ? "ขั้นนี้ปิดผ่านหลักฐานของระบบ" : undefined,
          disabled: !canManage || !reopenTarget || reopenBlocked || c.reopenPending,
          danger: true,
          onSelect: () => void (reopenTarget && c.handleReopen(reopenTarget)),
        },
        ...(order ? [{ key: "history", label: "ประวัติออเดอร์", icon: History, separatorBefore: true, onSelect: () => onNavigate ? onNavigate("เปิดประวัติออเดอร์") : window.open(`/orders/${order.id}?tab=history`, "_blank") }] : []),
      ]
    : [];

  const content = (
    <>
      <PageShell
        title={order?.orderNumber ?? "ใบผลิต"}
        icon={Factory}
        tone="production"
        back={{ href: onNavigate ? "#work-order-preview" : "/production", label: "กลับหน้าการผลิต" }}
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
                <a href={onNavigate ? "#work-order-preview" : `/print/job-ticket/${order.id}?production=${production.id}`} target="_blank" rel="noreferrer" aria-label="พิมพ์ใบสั่งงาน (เปิดแท็บใหม่)">
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
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
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
          <RecordNotFound what="ใบผลิตนี้" backHref={onNavigate ? "#work-order-preview" : "/production"} backLabel="กลับหน้าการผลิต" />
        ) : (
          <div className="space-y-6">
            {workflowSteps.length > 0 && variant === "current" ? (
              <WorkOrderStepNavigation
                c={c}
                activeIds={openInNode.map((step) => step.id)}
                selectedId={viewedStep?.id ?? current?.id ?? null}
                currentId={current?.id ?? null}
                currentButtonRef={currentStepButtonRef}
                onSelect={(stepId) => {
                  setViewedStepId(stepId);
                  setActiveTab("steps");
                  requestAnimationFrame(() => document.getElementById(`work-order-task-${stepId}`)?.scrollIntoView({ block: "nearest" }));
                }}
              />
            ) : workflowSteps.length > 0 && variant === "a" ? <WorkOrderRouteOverview c={c} /> : null}

            {c.writeDataStale ? (
              <Alert
                variant="warning"
                title="ข้อมูลล่าสุดอาจยังไม่ครบ"
                action={
                  <Button size="sm" variant="outline" onClick={() => void productionQuery.refetch()}>
                    โหลดใหม่
                  </Button>
                }
              >
                กำลังแสดงข้อมูลเดิมที่โหลดไว้
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
                    <a href={onNavigate ? "#work-order-preview" : `/print/job-ticket/${order.id}?production=${production.id}`} target="_blank" rel="noreferrer">
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
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsBar>
                  <TabsList aria-label="ส่วนของใบผลิต">
                    <TabsTrigger value="steps" hasPending={c.problemSteps.length > 0}>ขั้นตอน</TabsTrigger>
                    <TabsTrigger value="items">สินค้า</TabsTrigger>
                  </TabsList>
                </TabsBar>
                <div className="mt-6">
                  <TabsContent value="steps" keepMounted>
                    {variant === "current" && readOnlyStep ? (
                      <WorkOrderStepReadOnly step={readOnlyStep} c={c} onReturn={() => {
                        setViewedStepId(null);
                        requestAnimationFrame(() => {
                          const button = currentStepButtonRef.current;
                          button?.focus({ preventScroll: true });
                          button?.scrollIntoView({ block: "nearest", inline: "nearest" });
                        });
                      }} allDone={allDone} />
                    ) : null}
                    <div hidden={variant === "current" && !!readOnlyStep}>
                      <WorkOrderSteps c={c} current={current} pairedOpen={pairedOpen} allDone={allDone} qcAction={qcAction} stepFooter={stepFooter} assignAction={assignAction} variant={variant === "current" ? "a" : variant} />
                    </div>
                  </TabsContent>

                  <TabsContent value="items" className="space-y-6">
                    {itemsTab ?? (
                      <WorkOrderItems production={production} order={order} current={current} c={c} />
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            )}
          </div>
        )}
      </PageShell>
      {problemStep ? <ProblemDialog open onClose={() => setProblemStep(null)} step={problemStep} c={c} /> : null}
      {fixReceiveOpen && order && receiveStep ? (
        <Dialog open onOpenChange={(open) => !open && setFixReceiveOpen(false)}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>แก้ยอดตรวจรับเสื้อลูกค้า</DialogTitle>
              <DialogDescription>
                ใช้เมื่อนับผิดหรือรับมาไม่ครบตามที่บันทึกไว้ — กรอกยอดที่ถูกต้อง ระบบจะออกใบส่วนต่างและเปิดขั้นกลับให้ถ้ายอดยังไม่ครบ
              </DialogDescription>
            </DialogHeader>
            <GarmentReceiveInline
              orderId={order.id}
              productionStepId={receiveStep.id}
              canRecord={false}
              canCorrect
              startCorrecting
            />
          </DialogContent>
        </Dialog>
      ) : null}
      {c.dialogs}
    </>
  );
  if (!onNavigate) return content;
  const interceptNavigation = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest("a");
    if (!link) return;
    event.preventDefault();
    event.stopPropagation();
    onNavigate(link.getAttribute("aria-label") || link.textContent?.trim() || "เปิดลิงก์");
  };
  return <div id="work-order-preview" onClickCapture={interceptNavigation} onAuxClickCapture={interceptNavigation}>{content}</div>;
}

export function WorkOrderStepNavigation({ c, activeIds, selectedId, currentId, currentButtonRef, onSelect }: {
  c: WorkOrderController;
  activeIds: readonly string[];
  selectedId: string | null;
  currentId: string | null;
  currentButtonRef?: Ref<HTMLButtonElement>;
  onSelect: (stepId: string) => void;
}) {
  return (
    <nav aria-label="เลือกขั้นเพื่อเปิดดู" className="space-y-2">
      <p className="text-sm text-secondary">เปิดดูแต่ละขั้นได้ การเริ่มงานอยู่ในขั้นที่พร้อมทำ</p>
      <ol className="flex gap-1 overflow-x-auto border-b border-divider">
        {c.workflowSteps.map((step, index) => {
          const view = viewOf(step, c.nowById.get(step.id));
          const status = step.status === "PENDING" && !activeIds.includes(step.id) ? "ยังไม่ถึง" : view.label;
          const selected = selectedId === step.id;
          return (
            <li key={step.id} className="shrink-0">
              <button
                ref={step.id === currentId ? currentButtonRef : undefined}
                type="button"
                aria-pressed={selected}
                aria-label={`เปิดดู ${stepLabel(step)} · ${status}`}
                onClick={() => onSelect(step.id)}
                className={cn("flex min-h-16 items-center gap-3 border-b-2 px-3 py-3 text-left transition-colors hover:bg-interactive-hover", FOCUS_BUTTON, selected ? "border-blue-600 bg-blue-50/60 dark:border-blue-400 dark:bg-blue-950/20" : "border-transparent")}
              >
                <span className={cn("text-sm tabular-nums", step.status === "COMPLETED" ? "text-green-700 dark:text-green-400" : "text-muted")}>
                  {step.status === "COMPLETED" ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : index + 1}
                </span>
                <span className="space-y-1">
                  <span className={cn("block text-sm font-medium", selected ? "text-blue-700 dark:text-blue-300" : "text-strong")}>{stepLabel(step)}</span>
                  <span className="block text-xs text-secondary">{status}{step.pairWithPrevious ? " · ทำคู่ขั้นก่อน" : ""}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function WorkOrderStepReadOnly({ step, c, onReturn, allDone }: { step: ProductionStep; c: WorkOrderController; onReturn: () => void; allDone: boolean }) {
  if (!c.order) return null;
  const readOnly = { ...c, canUpdateStep: false };
  const checked = new Map(step.checks.map((check) => [check.itemKey, check]));
  const standards = workOrderStandards(step.stepType);
  const view = viewOf(step, c.nowById.get(step.id));
  const waiting = routeWaitingOn(step, c.workflowSteps).map(stepLabel);
  return (
    <section id={`work-order-task-${step.id}`} aria-label={`รายละเอียด ${stepLabel(step)} · อ่านอย่างเดียว`} className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-divider pb-4">
        <div className="space-y-2">
          <p className="text-sm text-secondary">กำลังเปิดดู · อ่านอย่างเดียว</p>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-strong">{stepLabel(step)}</h2>
            <StateChip view={step.status === "PENDING" ? { state: "todo", label: "ยังไม่ถึง", chip: "neutral" } : view} kind={step.outsourceOrders.length > 0 ? "outsource" : "inhouse"} />
          </div>
          {waiting.length > 0 && step.status !== "COMPLETED" ? <p className="text-sm text-secondary">รอ {waiting.join(" และ ")}</p> : null}
        </div>
        <Button variant="outline" onClick={onReturn}>{allDone ? "กลับสรุปใบผลิต" : "กลับขั้นปัจจุบัน"}</Button>
      </header>
      <FactList columns={3}>
        <Fact label="ผู้ทำ" value={step.assignedTo?.name ?? "ยังไม่มอบหมาย"} />
        <Fact label="เริ่มทำ" value={step.startedAt ? formatDateTime(step.startedAt) : "ยังไม่ได้เริ่ม"} />
        <Fact label="ปิดขั้น" value={step.completedAt ? formatDateTime(step.completedAt) : "ยังไม่ปิด"} />
      </FactList>
      <StepPieceTable key={step.id} step={step} order={c.order} c={readOnly} presentation="embedded" />
      {step.outsourceOrders.length > 0 ? (
        <div className="divide-y divide-divider border-y border-divider">
          {step.outsourceOrders.map((receipt) => <div key={receipt.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{receipt.vendor.name} · {receipt.description || stepLabel(step)}</span><span className="tabular-nums">{receipt.quantity.toLocaleString("th-TH")} ตัว</span></div>)}
        </div>
      ) : null}
      {standards.length > 0 ? (
        <div className="border-t border-divider pt-4">
          <h3 className="text-sm font-semibold text-strong">ผลตรวจที่บันทึก</h3>
          <ul className="mt-2 divide-y divide-divider">
            {standards.map((label) => {
              const check = checked.get(label);
              return <li key={label} className="flex items-start justify-between gap-4 py-3 text-sm"><span>{label}</span><span className="shrink-0 text-secondary">{check ? `ติ๊กโดย ${check.checkedBy.name}` : "ยังไม่มีผลตรวจ"}</span></li>;
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function WorkOrderPage({ id }: { id: string }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <WorkOrder id={id} />
    </Suspense>
  );
}
