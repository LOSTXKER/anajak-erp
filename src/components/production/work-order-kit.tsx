"use client";

/**
 * /production/[id] — ใบผลิตหนึ่งใบ
 *
 * โครงหน้า (ต้นแบบ mockup-production-calm-2026-09-15 · เบสสั่งลงจริง 2026-09-16):
 * แถบแจ้งเตือนบนสุด · หัวใบ (รูปม็อกอัพ เลขใบ ความสำคัญ | ใบสั่งงาน · ถัดไป · ⋯) · เส้นงานไม่มีกรอบ
 * แท็บ ขั้นตอน = การ์ดขั้น | เช็คลิสต์ · ข้อมูลออเดอร์ · แท็บ สินค้า · แท็บ ประวัติขั้นงาน
 *
 * ตารางรายรายการอยู่ work-order-step-card.tsx · การ์ดขวา/ประวัติอยู่ work-order-side.tsx
 * ไฟล์นี้เหลือหน้าที่เดียว: จัดหน้า และตัดสินว่าปุ่มไหนกดได้ตามกติกาของ useWorkOrderController
 * (ไม่มีทางลัดสถานะใหม่ · ขั้นพิมพ์ DTF ปิดจากหน้า "พิมพ์ DTF" ตามความจริงหน้าเครื่อง 09-16)
 */

import { Suspense, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Check,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  Ellipsis,
  Flag,
  History,
  Pause,
  Printer,
  RefreshCw,
  RotateCcw,
  Send,
  TriangleAlert,
  Undo2,
  UserRound,
  Wrench,
} from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { c, CardHead, Callout, PriorityChip, Thumb } from "@/components/kit/kit";
import { KitTabs } from "@/components/kit/tabs";
import { GarmentReceiveInline } from "@/components/production/garment-receive-inline";
import type { ProductionStep } from "@/components/production/types";
import { orderMockupCover } from "@/lib/mockup";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { STEP_STATUS_LABELS } from "@/lib/status-config";
import { permAllows } from "@/lib/permissions";
import { openProblemsOf } from "@/lib/production-problem";
import { FLOW_OWNED_STEP_TYPES } from "@/lib/production-steps";
import { formatDateTime } from "@/lib/utils";
import { currentRailNode, railNodesOf } from "@/lib/work-order-rail";
import { routeWaitingOn } from "@/lib/work-order-route";
import { useWorkOrderController, type WorkOrderController } from "./work-order-controller";
import { checklistAnchor, pieceTableAnchor, ticksMissing } from "./work-order-anchors";
import { canReportProblem, problemAnchor } from "./work-order-problem";
import { WorkOrderItemsTab } from "./work-order-items-tab";
import { activeOutsource, dtfUnavailableReason, outsourceReceiptCandidates, outsourceStepReason, stepLabel } from "./work-order-pieces";
import { ChecklistCard, HistoryCard, OrderInfoCard } from "./work-order-side";
import { WorkOrderStepCard } from "./work-order-step-card";

export const DTF_PAGE_HREF = "/production/print-runs";

function focusFirst(anchor: string, selector: string) {
  const el = document.querySelector<HTMLElement>(`#${anchor} ${selector}`) ?? document.getElementById(anchor);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  el?.focus?.();
}

/** ปุ่ม "ถัดไป" พาไปสิ่งที่ต้องทำก่อน: ติ๊กที่ยังว่าง → ช่องยอดแถวแรก → การ์ดของขั้น */
function focusWhatIsBlocking(stepId: string) {
  const el =
    document.querySelector<HTMLElement>(`#${checklistAnchor(stepId)} input[type=checkbox]:not(:checked)`) ??
    document.querySelector<HTMLElement>(`#${pieceTableAnchor(stepId)} input`) ??
    document.getElementById(pieceTableAnchor(stepId)) ??
    document.getElementById(checklistAnchor(stepId));
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  el?.focus?.();
}

/* ───────────────────────── เส้นงาน ───────────────────────── */

function WorkRail({ labels, currentIndex, allDone, stopped }: { labels: string[]; currentIndex: number; allDone: boolean; stopped: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const index = allDone ? labels.length - 1 : currentIndex;
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || wrap.scrollWidth <= wrap.clientWidth + 1) return;
    const node = wrap.querySelector<HTMLElement>('[aria-current="step"]');
    if (node) wrap.scrollLeft = node.offsetLeft - wrap.clientWidth / 2 + node.offsetWidth / 2;
  }, [index, labels.length]);
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- รางที่เลื่อนได้ต้องรับโฟกัสให้ผู้ใช้คีย์บอร์ดดูทุกขั้นได้
    <div ref={wrapRef} className={c("stepsw")} tabIndex={0} role="group" aria-label="เส้นทางงานของใบนี้">
      <ol className={c("steps")} style={{ "--n": labels.length, "--i": Math.max(0, index) } as CSSProperties}>
        {labels.map((label, position) => {
          const done = allDone || position < currentIndex;
          const cur = !allDone && position === currentIndex;
          return (
            <li
              key={`${label}-${position}`}
              className={c("step", done ? "done" : cur ? (stopped ? "stop" : "cur") : null)}
              style={{ "--k": position } as CSSProperties}
              aria-current={cur ? "step" : undefined}
              aria-label={`${label}: ${done ? "ผ่านแล้ว" : cur ? (stopped ? "ติดปัญหา" : "ขั้นที่ทำอยู่") : "ยังไม่ถึง"}`}
            >
              <span className={c("c")} aria-hidden="true">
                {done ? <Check /> : position + 1}
              </span>
              <span className={c("lb")} aria-hidden="true">
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ───────────────────────── หน้า ───────────────────────── */

function WorkOrderKit({ id }: { id: string }) {
  const ctl = useWorkOrderController(id);
  const scannedMockup = Number(useSearchParams().get("mockup") ?? "");
  return <WorkOrderKitView c={ctl} scannedMockup={scannedMockup} />;
}

export function WorkOrderKitView({ c: ctl, scannedMockup = Number.NaN }: { c: WorkOrderController; scannedMockup?: number }) {
  const { production, order, me, productionQuery, meQuery, workflowSteps, nowById } = ctl;
  const [fixReceiveOpen, setFixReceiveOpen] = useState(false);
  const [tab, setTab] = useState<"steps" | "items" | "history">("steps");

  const approvedMockup = order?.designs[0]?.versionNumber ?? null;
  const stalePaper = Number.isFinite(scannedMockup) && scannedMockup > 0 && approvedMockup !== null && scannedMockup < approvedMockup;

  const nodes = railNodesOf(workflowSteps);
  const openNodeIndex = currentRailNode(nodes);
  const allDone = workflowSteps.length > 0 && openNodeIndex < 0;
  const currentNodeIndex = openNodeIndex < 0 ? nodes.length - 1 : openNodeIndex;
  const currentNode = nodes[currentNodeIndex] ?? [];
  const openInNode = currentNode.filter((s) => s.status !== "COMPLETED");
  const actionable = openInNode.filter((s) => nowById.get(s.id)?.action && !activeOutsource(s));
  const notWaiting = openInNode.filter((s) => routeWaitingOn(s, workflowSteps).length === 0);
  const current = actionable[0] ?? notWaiting.find((s) => !activeOutsource(s)) ?? notWaiting[0] ?? openInNode[0] ?? currentNode[currentNode.length - 1] ?? null;
  const pairedOpen = openInNode.filter((s) => s !== current);
  const railLabels = nodes.map((node, i) => {
    const label = node.map(stepLabel).join(" + ");
    return nodes.some((o, j) => j !== i && o.map(stepLabel).join(" + ") === label) ? `${label} ${i + 1}` : label;
  });
  const canManageStep = ctl.canSuperviseStep && ctl.hasProductionPermission;
  const stopped = !allDone && !!current && (current.status === "FAILED" || current.status === "ON_HOLD");

  /** เหตุที่ขั้นนี้ยังลงมือไม่ได้ — แสดงเฉพาะตอนไม่มีปุ่มให้กดเลย (ติ๊ก/ยอดไม่ครบมีป้ายในเช็คลิสต์และปุ่มพาไปอยู่แล้ว) */
  function blockReason(step: ProductionStep): string | null {
    const outsource = activeOutsource(step);
    if (ctl.writeDataStale) return "โหลดข้อมูลล่าสุดก่อนลงมือ";
    if (!ctl.hasProductionPermission) return "บัญชีนี้ดูงานได้ ให้ทีมผลิตหรือหัวหน้าเป็นผู้บันทึก";
    if (step.status === "ON_HOLD" || step.status === "FAILED") return null;
    if (outsource) {
      const receipts = outsourceReceiptCandidates(step);
      if (receipts.length > 0 && !permAllows(me?.permissions, "manage_delivery")) return "ให้ผู้มีสิทธิ์รับของเข้าเป็นผู้บันทึกหลักฐานรับกลับ";
      if (receipts.length === 0) return outsourceStepReason(step);
      return null;
    }
    const waiting = routeWaitingOn(step, workflowSteps).map(stepLabel);
    if (waiting.length > 0 && !nowById.get(step.id)?.action) return `รอ ${waiting.length === 1 ? waiting[0] : `${waiting.length} ขั้นก่อนหน้า`}`;
    if (!ctl.canUpdateStep) return "ออเดอร์ยังไม่อยู่ในสถานะกำลังผลิต";
    if (step.assignedTo && !ctl.canOwnOrSupervise(step)) return `งานของ ${step.assignedTo.name}`;
    return null;
  }

  function actionFor(step: ProductionStep): ReactNode {
    if (step.stepType === "GARMENT_RECEIVE") return null;
    const outsource = activeOutsource(step);
    if (outsource) {
      const receipts = outsourceReceiptCandidates(step);
      if (!ctl.canUpdateStep || !ctl.canOwnOrSupervise(step) || !permAllows(me?.permissions, "manage_delivery") || receipts.length === 0) return null;
      return receipts.map((receipt) => (
        <div key={receipt.id} className={c("receipt")}>
          <span className={c("tx")}>
            <b>
              {receipt.vendor.name} · {receipt.quantity.toLocaleString("th-TH")} ตัว
            </b>
            <small>ใบส่งร้าน {formatDateTime(receipt.createdAt)}</small>
          </span>
          <button type="button" className={c("btn primary")} onClick={() => ctl.openOutsourceReturn(step.id, receipt.id)}>
            <ClipboardCheck aria-hidden="true" />
            บันทึกหลักฐานรับกลับ
          </button>
        </div>
      ));
    }
    if (step.stepType === "DTF_PRINT" && step.status !== "COMPLETED" && step.status !== "FAILED" && step.status !== "ON_HOLD" && !dtfUnavailableReason(step)?.startsWith("อยู่ในรอบ")) {
      return ctl.canUpdateStep && ctl.hasProductionPermission ? (
        <Link href={DTF_PAGE_HREF} className={c("btn primary")}>
          <Printer aria-hidden="true" />
          ไปหน้าพิมพ์ DTF
        </Link>
      ) : null;
    }
    const now = nowById.get(step.id);
    const closes = now?.action === "complete" || now?.action === "record-qty" || now?.action === "quick-pass";
    if (closes && step.status !== "COMPLETED") {
      if (ticksMissing(step) > 0) {
        return (
          <button type="button" className={c("btn primary")} aria-disabled onClick={() => focusFirst(checklistAnchor(step.id), "input[type=checkbox]:not(:checked)")}>
            <Check aria-hidden="true" />
            ปิดขั้นนี้
          </button>
        );
      }
      if (hasVariantRows && step.qtyTotal && (step.qtyDone ?? 0) < step.qtyTotal) {
        return (
          <button type="button" className={c("btn primary")} aria-disabled onClick={() => focusFirst(pieceTableAnchor(step.id), "input")}>
            <Check aria-hidden="true" />
            ปิดขั้นนี้
          </button>
        );
      }
    }
    return ctl.primaryButton(step, now, { kit: true });
  }

  const hasVariantRows = (order?.items ?? []).some((item) => item.products.some((prod) => prod.variants.length > 0));

  function assignAction(step: ProductionStep) {
    if (!canManageStep || step.status === "COMPLETED") return null;
    return (
      <button type="button" className={c("btn sm")} onClick={() => ctl.openEdit(step, "manager")}>
        <UserRound aria-hidden="true" />
        {step.assignedTo ? "เปลี่ยนคนทำ" : "มอบหมาย"}
      </button>
    );
  }

  const qcAction = production && ctl.canUpdateStep && allDone && (ctl.readyForQcViaPaper || ctl.legacyPackagingReadyForQc) ? (ctl.readyForQcViaPaper ? "paper" : "legacy") : null;
  const nextLabel = railLabels[currentNodeIndex + 1] ?? null;
  const flatIndex = current ? workflowSteps.indexOf(current) : workflowSteps.length;
  const reopenTarget = allDone
    ? (workflowSteps[workflowSteps.length - 1] ?? null)
    : ([...workflowSteps.slice(0, flatIndex)].reverse().find((s) => s.status === "COMPLETED") ?? null);
  /* ย้อนกลับเป็นปุ่มจริงบนหัวใบเมื่อย้อนได้ (เบสสั่ง 2026-09-18 "จะได้กดได้ง่ายๆ")
     ย้อนไม่ได้ = คงเป็นรายการจางในเมนู ⋯ พร้อมเหตุผล (ไม่โชว์ปุ่มที่กดแล้ว server ปฏิเสธ — B8)

     ด่านต้องตรงกับ server ทุกข้อ (production.reopenStep + assertStepReopenable):
     ปิดด้วยปุ่มเท่านั้น · ไม่มีใบส่งร้าน/รอบพิมพ์ผูก · ขั้นหลังจากนั้นยังไม่มีใครเริ่ม ·
     ออเดอร์ยังอยู่ระหว่างผลิต (ใช้ ctl.canUpdateStep ตัวเดียวกับปุ่มลงมือ ไม่เขียนกฎสถานะใหม่)
     นับขั้นพี่น้องจากทั้งใบ (production.steps) เหมือน server ไม่ใช่เฉพาะขั้นที่อยู่บนราง */
  const allStepsOfSheet = production?.steps ?? [];
  const reopenBlockedReason: string | null = !reopenTarget
    ? "ยังไม่มีขั้นที่ปิดให้ย้อน"
    : reopenTarget.status !== "COMPLETED"
      ? "ขั้นนี้ยังไม่ได้ปิด"
      : FLOW_OWNED_STEP_TYPES.has(reopenTarget.stepType) || reopenTarget.outsourceOrders.length > 0 || reopenTarget.printRunItems.length > 0
        ? "ปิดผ่านหลักฐานของระบบ"
        : allStepsOfSheet.some((s) => s.sortOrder > reopenTarget.sortOrder && s.status !== "PENDING")
          ? "ขั้นถัดไปเริ่มทำแล้ว"
          : !ctl.canUpdateStep
            ? "ออเดอร์ยังไม่อยู่ในสถานะกำลังผลิต"
            : null;
  const canReopenNow = canManageStep && !!reopenTarget && reopenBlockedReason === null;
  const receiveStep = workflowSteps.find((step) => step.stepType === "GARMENT_RECEIVE") ?? null;
  const sendQc = () =>
    production && (qcAction === "paper" ? ctl.sendToQc.mutate({ productionId: production.id }) : ctl.legacyFinalize.mutate({ productionId: production.id }));

  const printHref = order && production ? `/print/job-ticket/${order.id}?production=${production.id}` : "#";

  return (
    <>
      <PageShell
        title={order?.orderNumber ?? "ใบผลิต"}
        header={<div className="sr-only">{order?.orderNumber ?? "ใบผลิต"}</div>}
        loading={productionQuery.isLoading || meQuery.isLoading}
        skeleton={
          <div className={c("tokens page mfg")} role="status" aria-label="กำลังโหลดใบผลิต">
            <span className={c("sk")} style={{ height: 64, width: "50%" }} />
            <span className={c("sk")} style={{ height: 72 }} />
            <div className={c("two")}>
              <span className={c("sk")} style={{ height: 420 }} />
              <span className={c("sk")} style={{ height: 420 }} />
            </div>
          </div>
        }
        error={
          meQuery.isError && !me
            ? { message: "โหลดสิทธิ์การผลิตไม่สำเร็จ", onRetry: () => meQuery.refetch() }
            : productionQuery.isError && !production && !ctl.notFound
              ? { message: "โหลดใบผลิตไม่สำเร็จ", onRetry: () => productionQuery.refetch() }
              : null
        }
      >
        {ctl.notFound || !production || !order ? (
          <RecordNotFound what="ใบผลิตนี้" backHref="/production" backLabel="กลับหน้าการผลิต" />
        ) : (
          <div className={c("tokens page mfg")}>
            {ctl.writeDataStale || stalePaper || ctl.problemSteps.length > 0 ? (
              <div className={c("alerts")}>
                {ctl.problemSteps.flatMap((step) =>
                  openProblemsOf(step).map((problem) => (
                    <Callout
                      key={problem.id}
                      tone={problem.stopsWork && !problem.held ? "danger" : undefined}
                      icon={problem.held ? Pause : problem.stopsWork ? TriangleAlert : Flag}
                      role="alert"
                      action={
                        <button type="button" className={c("btn sm")} onClick={() => focusFirst(problemAnchor(step.id), "button")}>
                          ดูเรื่องนี้
                        </button>
                      }
                    >
                      <b>
                        {stepLabel(step)}
                        {problem.stopsWork ? STEP_STATUS_LABELS[problem.held ? "ON_HOLD" : "FAILED"] : " — แจ้งไว้ ทำต่อได้"}
                      </b>{" "}
                      — {problem.title}
                      {problem.raisedBy ? <span className={c("whoinline")}> แจ้งโดย {problem.raisedBy.name}</span> : null}
                    </Callout>
                  )),
                )}
                {stalePaper ? (
                  <Callout
                    tone="danger"
                    icon={Printer}
                    role="alert"
                    action={
                      <a href={printHref} target="_blank" rel="noreferrer" className={c("btn sm")}>
                        พิมพ์ใบใหม่
                      </a>
                    }
                  >
                    <b>กระดาษที่สแกนเป็นฉบับเก่า</b> — บนกระดาษม็อกอัพ v{scannedMockup} · ตอนนี้ v{approvedMockup}
                  </Callout>
                ) : null}
                {ctl.writeDataStale ? (
                  <Callout
                    icon={RefreshCw}
                    role="alert"
                    action={
                      <button type="button" className={c("btn sm")} onClick={() => void productionQuery.refetch()}>
                        โหลดใหม่
                      </button>
                    }
                  >
                    <b>ข้อมูลล่าสุดอาจยังไม่ครบ</b> กำลังแสดงข้อมูลเดิมที่โหลดไว้
                  </Callout>
                ) : null}
              </div>
            ) : null}

            <nav className={c("crumbs")} aria-label="ตำแหน่ง">
              <Link href="/production">การผลิต</Link>
              <ChevronRight aria-hidden="true" />
              <span>{order.orderNumber}</span>
            </nav>

            <div className={c("dhead")}>
              <div className={c("idrow")}>
                <Thumb cover={orderMockupCover(order)} alt={`ม็อกอัพ ${order.orderNumber}`} lg />
                <div className={c("h1row")}>
                  <h1>{order.orderNumber}</h1>
                  {allDone ? <span className={c("chip good lg")}>ครบทุกขั้น</span> : <PriorityChip priority={order.priority} lg />}
                </div>
              </div>
              <div className={c("acts")}>
                <a href={printHref} target="_blank" rel="noreferrer" className={c("btn")} aria-label="พิมพ์ใบสั่งงาน (เปิดแท็บใหม่)">
                  <Printer aria-hidden="true" />
                  <span className={c("lbl")}>ใบสั่งงาน</span>
                </a>
                {canReopenNow && reopenTarget ? (
                  <button
                    type="button"
                    className={c("btn")}
                    onClick={() => void ctl.handleReopen(reopenTarget)}
                    disabled={ctl.reopenPending}
                    aria-label={`ย้อนกลับ: ${stepLabel(reopenTarget)}`}
                  >
                    <Undo2 aria-hidden="true" />
                    <span className={c("lbl")}>ย้อนกลับ: {stepLabel(reopenTarget)}</span>
                  </button>
                ) : null}
                {qcAction ? (
                  <button type="button" className={c("btn primary")} onClick={sendQc} disabled={ctl.sendToQc.isPending || ctl.legacyFinalize.isPending}>
                    <Send aria-hidden="true" />
                    ส่งเข้า QC
                  </button>
                ) : current && !allDone && nextLabel ? (
                  <button type="button" className={c("btn next")} aria-disabled onClick={() => focusWhatIsBlocking(current.id)} title="กดเพื่อไปสิ่งที่ต้องทำก่อน">
                    <span>ถัดไป: {nextLabel}</span>
                  </button>
                ) : null}
                {current ? (
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button type="button" className={c("btn icon")} aria-label="คำสั่งเพิ่มเติม">
                        <Ellipsis aria-hidden="true" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content align="end" sideOffset={6} className={c("tokens dmenu")}>
                        <DropdownMenu.Item
                          className={c("mi")}
                          disabled={!canManageStep || current.status === "COMPLETED" || current.status === "FAILED"}
                          onSelect={() => void ctl.handleSupervisorStatus(current, current.status === "ON_HOLD" ? "PENDING" : "ON_HOLD")}
                        >
                          <Pause aria-hidden="true" />
                          {current.status === "ON_HOLD" ? "คืนขั้นนี้กลับคิว" : "พักขั้นนี้ไว้ก่อน"}
                          {!canManageStep ? <small>หัวหน้าเท่านั้น</small> : null}
                        </DropdownMenu.Item>
                        {receiveStep ? (
                          <DropdownMenu.Item className={c("mi")} disabled={!canManageStep} onSelect={() => setFixReceiveOpen(true)}>
                            <ClipboardCheck aria-hidden="true" />
                            แก้ยอดตรวจรับเสื้อ
                            {!canManageStep ? <small>หัวหน้าเท่านั้น</small> : null}
                          </DropdownMenu.Item>
                        ) : null}
                        {!canReopenNow ? (
                          <DropdownMenu.Item className={c("mi danger")} disabled>
                            <RotateCcw aria-hidden="true" />
                            {reopenTarget ? `ย้อนกลับไป ${stepLabel(reopenTarget)}` : "ย้อนกลับขั้นก่อน"}
                            {!canManageStep ? <small>หัวหน้าเท่านั้น</small> : <small>{reopenBlockedReason}</small>}
                          </DropdownMenu.Item>
                        ) : null}
                        <DropdownMenu.Separator className={c("sep")} />
                        <DropdownMenu.Item asChild className={c("mi")}>
                          <Link href={`/orders/${order.id}?tab=history`}>
                            <History aria-hidden="true" />
                            ประวัติออเดอร์
                          </Link>
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                ) : null}
              </div>
            </div>

            {workflowSteps.length > 0 ? <WorkRail labels={railLabels} currentIndex={currentNodeIndex} allDone={allDone} stopped={stopped} /> : null}

            <KitTabs
              label="ส่วนของใบผลิต"
              idPrefix="wo"
              value={tab}
              onChange={setTab}
              tabs={[
                { key: "steps", label: "ขั้นตอน", pending: ctl.problemSteps.length > 0 },
                { key: "items", label: "สินค้า" },
                { key: "history", label: "ประวัติขั้นงาน" },
              ]}
            />

            <div className={c("tabpanel")} role="tabpanel" id={`wo-panel-${tab}`} aria-labelledby={`wo-tab-${tab}`}>
              {tab === "history" ? (
                <HistoryCard steps={workflowSteps} />
              ) : tab === "items" ? (
                <WorkOrderItemsTab order={order} production={production} ctl={ctl} />
              ) : workflowSteps.length === 0 ? (
                <section className={c("card")}>
                  <div className={c("empty flat")}>
                    <span className={c("ring")} aria-hidden="true">
                      <Wrench />
                    </span>
                    <b>ใบผลิตนี้ยังไม่มีขั้นตอน</b>
                  </div>
                </section>
              ) : (
                <div className={c("two wide")}>
                  <div className={c("stack")}>
                    {allDone || !current ? (
                      <section className={c("card stepcard")} aria-labelledby="wo-done-h">
                        <CardHead icon={CircleCheck} tone="good" id="wo-done-h" title="ครบทุกขั้นในใบนี้แล้ว" />
                        <div className={c("cb")}>
                          <div className={c("facts")}>
                            <div className={c("fact good")}>
                              <span className={c("k")}>ทำแล้ว</span>
                              <span className={c("v")}>
                                {ctl.totalQty.toLocaleString("th-TH")} <small>ตัว</small>
                              </span>
                            </div>
                            <div className={c("fact")}>
                              <span className={c("k")}>สถานะออเดอร์</span>
                              <span className={c("v")} style={{ fontSize: 15 }}>
                                {INTERNAL_STATUS_LABELS[order.internalStatus] ?? order.internalStatus}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className={c("stepfoot")}>
                          <span className={c("why")} />
                          {qcAction ? (
                            <button type="button" className={c("btn primary")} onClick={sendQc} disabled={ctl.sendToQc.isPending || ctl.legacyFinalize.isPending}>
                              <Send aria-hidden="true" />
                              ส่งเข้า QC
                            </button>
                          ) : (
                            <Link href={`/orders/${order.id}?tab=${order.internalStatus === "QUALITY_CHECK" ? "production" : "delivery"}`} className={c("btn")}>
                              เปิดออเดอร์
                              <ChevronRight aria-hidden="true" />
                            </Link>
                          )}
                        </div>
                      </section>
                    ) : (
                      [current, ...pairedOpen].map((step) => {
                        const action = actionFor(step);
                        return (
                          <WorkOrderStepCard
                            key={step.id}
                            step={step}
                            ctl={ctl}
                            action={action}
                            reason={step.status !== "COMPLETED" && !action ? blockReason(step) : null}
                            canReport={canReportProblem(step, ctl)}
                          />
                        );
                      })
                    )}
                  </div>
                  <div className={c("stack sticky")}>
                    {!allDone && current ? [current, ...pairedOpen].map((step) => <ChecklistCard key={step.id} step={step} ctl={ctl} assign={assignAction(step)} />) : null}
                    <OrderInfoCard order={order} production={production} ctl={ctl} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </PageShell>
      {fixReceiveOpen && order && receiveStep ? (
        <Dialog open onOpenChange={(open) => !open && setFixReceiveOpen(false)}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>แก้ยอดตรวจรับเสื้อลูกค้า</DialogTitle>
              <DialogDescription>กรอกยอดที่ถูกต้อง ระบบออกใบส่วนต่างและเปิดขั้นกลับให้ถ้ายอดยังไม่ครบ</DialogDescription>
            </DialogHeader>
            <GarmentReceiveInline orderId={order.id} productionStepId={receiveStep.id} canRecord={false} canCorrect startCorrecting />
          </DialogContent>
        </Dialog>
      ) : null}
      {ctl.dialogs}
    </>
  );
}

export function WorkOrderKitPage({ id }: { id: string }) {
  return (
    <Suspense fallback={null}>
      <WorkOrderKit id={id} />
    </Suspense>
  );
}
