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
 * คำช่วยและเหตุที่ทำต่อไม่ได้อยู่ตรงขั้นที่เกี่ยว ตาม ui-guidance (A16)
 */

import { Suspense, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardCheck, Factory, Flag, History, Pause, Printer, RotateCcw, UserRound } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { OrderStatusBar } from "@/components/orders/detail/order-status-bar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
import { formatDateTime } from "@/lib/utils";
import { FLOW_OWNED_STEP_TYPES } from "@/lib/production-steps";
import { currentRailNode, railNodesOf } from "@/lib/work-order-rail";
import { routeWaitingOn } from "@/lib/work-order-route";
import { useWorkOrderController, type WorkOrderController } from "./work-order-controller";
import { activeOutsource, dtfUnavailableReason, outsourceReceiptCandidates, outsourceStepReason, ProblemCard, stepLabel } from "./work-order-pieces";
import { checklistAnchor, ticksMissing } from "./work-order-checklist";
import { pieceTableAnchor, pieceRowsOf } from "./work-order-quantities";
import { WorkOrderSteps } from "./work-order-steps";
import { WorkOrderItems } from "./work-order-items";

/** พาไปช่องแรกที่ยังต้องทำในโซนนั้น (ติ๊กที่ยังว่าง / ช่องยอดแถวแรก) — ปุ่มบนหัวใบใช้แทนการ disabled */
function focusFirst(anchor: string, selector: string) {
  const el = document.querySelector<HTMLElement>(`#${anchor} ${selector}`);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  el?.focus();
}

/**
 * ปุ่ม "ถัดไป" บนหัวใบกดแล้วพาไปสิ่งที่ต้องทำก่อน — เรียงเหมือนเหตุผลที่ปุ่มบอกไว้:
 * ติ๊กที่ยังว่าง → ช่องยอดแถวแรก → กล่องของขั้นนั้น (ขั้นที่ไม่มีตาราง เช่น เบิกเสื้อ/ตรวจรับ)
 */
function focusWhatIsBlocking(stepId: string) {
  const el =
    document.querySelector<HTMLElement>(`#${checklistAnchor(stepId)} input[type=checkbox]:not(:checked)`) ??
    document.querySelector<HTMLElement>(`#${pieceTableAnchor(stepId)} input`) ??
    document.getElementById(pieceTableAnchor(stepId)) ??
    document.getElementById(checklistAnchor(stepId));
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  el?.focus?.();
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
  const { production, order, me, productionQuery, meQuery, workflowSteps, nowById } = c;
  const approvedMockup = order?.designs[0]?.versionNumber ?? null;
  const stalePaper = Number.isFinite(scannedMockup) && scannedMockup > 0 && approvedMockup !== null && scannedMockup < approvedMockup;
  const [problemStep, setProblemStep] = useState<ProductionStep | null>(null);
  // แก้ยอดตรวจรับที่นับผิด (A15) — เปิดจากเมนู ⋯ เพราะกล่องของขั้นนั้นไม่แสดงแล้วเมื่อขั้นปิดไป
  const [fixReceiveOpen, setFixReceiveOpen] = useState(false);

  // ราง: ช่องละขั้น · ขั้นที่ตั้ง "เดินคู่กับขั้นก่อน" รวมอยู่ช่องเดียวกัน · ยืนที่ช่องแรกที่ยังมีขั้นไม่ปิด (แบบ A)
  const nodes = railNodesOf(workflowSteps);
  const openNodeIndex = currentRailNode(nodes);
  const allDone = workflowSteps.length > 0 && openNodeIndex < 0;
  const currentNodeIndex = openNodeIndex < 0 ? nodes.length - 1 : openNodeIndex;
  const currentNode = nodes[currentNodeIndex] ?? [];
  // ปุ่มบนหัวใบเป็นของขั้นแรกในช่องที่ยังไม่ปิดและไม่ติดรอ — ขั้นคู่ที่เหลือมีปุ่มของตัวเองในฟอร์ม
  const openInNode = currentNode.filter((s) => s.status !== "COMPLETED");
  // ลำดับเลือก: ขั้นที่มีปุ่มให้กดจริงและไม่ได้อยู่ร้านนอก → ขั้นที่ไม่ติดรอ → ขั้นแรกที่ยังไม่ปิด
  const actionable = openInNode.filter((s) => nowById.get(s.id)?.action && !activeOutsource(s));
  const notWaiting = openInNode.filter((s) => routeWaitingOn(s, workflowSteps).length === 0);
  const current = actionable[0] ?? notWaiting.find((s) => !activeOutsource(s)) ?? notWaiting[0] ?? openInNode[0] ?? currentNode[currentNode.length - 1] ?? null;
  const pairedOpen = openInNode.filter((s) => s !== current);
  const railLabels = nodes.map((node, i) => {
    const label = node.map(stepLabel).join(" + ");
    return nodes.some((o, j) => j !== i && o.map(stepLabel).join(" + ") === label) ? `${label} ${i + 1}` : label;
  });

  // ปุ่มของขั้น: ของอยู่ร้านนอก = รับงานกลับ (ใบตรวจรับเดิม) · ไม่งั้นปุ่มจากกติกาเดิมทั้งชุด
  // ปิดขั้นได้เมื่อติ๊กข้อกำหนดครบ (server กั้นอีกชั้น) — ปุ่มยังอยู่ที่เดิม กดแล้วพาไปเช็คลิสต์
  const hasVariantRows = order ? pieceRowsOf(order).some((r) => r.variantId) : false;
  function actionFor(step: ProductionStep) {
    // ขั้นตรวจรับเสื้อลูกค้ามีปุ่มบันทึกอยู่ในฟอร์มนับจริงในกล่องแล้ว (ไม่เด้ง dialog อีก)
    if (step.stepType === "GARMENT_RECEIVE") return null;
    const outsource = activeOutsource(step);
    if (outsource) {
      const receipts = outsourceReceiptCandidates(step);
      if (!c.canUpdateStep || !c.canOwnOrSupervise(step) || !permAllows(me?.permissions, "manage_delivery") || receipts.length === 0) return null;
      return (
        <div className="w-full divide-y divide-divider">
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

  // ปุ่มของขั้น อยู่ท้ายกล่องของขั้นนั้นเอง (เบสสั่ง 2026-09-10 "ปุ่มดำเนินการของขั้นตอนนั้น
  // ก็อยู่ในกล่องขั้นตอนนั้นไปเลย จะได้เข้าใจง่าย") — ทั้งปุ่มลงมือและปุ่มแจ้งปัญหาของขั้นนั้น
  function stepFooter(step: ProductionStep) {
    const action = actionFor(step);
    const canReport = c.canUpdateStep && c.canOwnOrSupervise(step) && step.status !== "COMPLETED" && step.status !== "FAILED";
    const reason = step.status !== "COMPLETED" ? blockReason(step) : null;
    if (!action && !canReport && !reason) return null;
    return (
      <>
        {reason ? <p className="w-full text-sm text-secondary">{reason}</p> : null}
        {action}
        {canReport ? (
          <Button variant="outline" onClick={() => setProblemStep(step)}>
            <Flag /> แจ้งปัญหาขั้นนี้
          </Button>
        ) : null}
      </>
    );
  }

  // ใครทำขั้นนี้อยู่ในกล่องเช็คลิสต์ ปุ่มเปลี่ยนคนทำจึงอยู่บรรทัดเดียวกัน ไม่ใช่ในเมนู ⋯ (เบสสั่ง 2026-09-10)
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
      if (receipts.length > 0) return `${receipts.length} ใบรอรับกลับ — ${permAllows(me?.permissions, "manage_delivery") ? "บันทึกได้เฉพาะหลักฐานรับกลับ สถานะร้านนอกยังไม่เปลี่ยน" : "ให้ผู้มีสิทธิ์รับของเข้าเป็นผู้บันทึกหลักฐานรับกลับ"}`;
      const state = outsourceStepReason(step);
      return `${state} — หน้าจัดการสถานะร้านนอกยังไม่พร้อมใช้งาน`;
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

  // ปุ่มบนหัวใบ = **ขั้นถัดไป** ไม่ใช่ปุ่มลงมือ (เบสสั่ง 2026-09-10 "CTA ข้างบนจะเป็นปุ่มขั้นถัดไป
  // แต่จะกดไม่ได้ และจะบอกด้วยว่าทำไมกดไม่ได้") — ปุ่มลงมือย้ายไปอยู่ในกล่องของขั้นแล้ว
  // ไม่ใช่ปุ่มตาย: กดแล้วพาไปกล่องขั้นที่ต้องทำ (pattern เดียวกับปุ่ม "ปิดขั้นนี้" ตอนติ๊กไม่ครบ)
  const qcAction = production && c.canUpdateStep && allDone && (c.readyForQcViaPaper || c.legacyPackagingReadyForQc) ? (c.readyForQcViaPaper ? "paper" : "legacy") : null;
  const nextLabel = railLabels[currentNodeIndex + 1] ?? null;
  const primary = qcAction ? (
    <Button
      onClick={() => (qcAction === "paper" ? c.sendToQc.mutate({ productionId: production!.id }) : c.legacyFinalize.mutate({ productionId: production!.id }))}
      disabled={c.sendToQc.isPending || c.legacyFinalize.isPending}
    >
      ส่งเข้า QC
    </Button>
  ) : current && !allDone && nextLabel ? (
    <Button variant="outline" aria-disabled className="max-w-[15rem] text-secondary" onClick={() => focusWhatIsBlocking(current.id)}>
      <span className="truncate">ถัดไป: {nextLabel}</span>
    </Button>
  ) : null;

  // ประโยคใต้ราง = เหตุผลว่าทำไมปุ่มขั้นถัดไปยังกดไม่ได้
  const blockers: string[] = [];
  if (current && !allDone && !qcAction && !c.writeDataStale) {
    blockers.push(blockReason(current));
  }

  // ย้อนกลับ = เปิดขั้นที่ปิดล่าสุดก่อนหน้าให้ทำต่อ (หัวหน้า · server ตรวจว่าขั้นถัดไปยังไม่เริ่ม)
  const flatIndex = current ? workflowSteps.indexOf(current) : workflowSteps.length;
  const reopenTarget = allDone ? (workflowSteps[workflowSteps.length - 1] ?? null) : ([...workflowSteps.slice(0, flatIndex)].reverse().find((s) => s.status === "COMPLETED") ?? null);
  const reopenBlocked = !!reopenTarget && (FLOW_OWNED_STEP_TYPES.has(reopenTarget.stepType) || reopenTarget.outsourceOrders.length > 0);
  const canManage = canManageStep;
  const receiveStep = workflowSteps.find((step) => step.stepType === "GARMENT_RECEIVE") ?? null;
  // เมนู "เพิ่มเติม" เรียงตามความถี่ที่หัวหน้าใช้จริง ไม่ใช่ตามลำดับที่เขียนโค้ด (เบสทัก 2026-09-10
  // "บางอันจำเป็นต้องใช้ แต่ก็ไปซ่อน"): แจ้งปัญหา/มอบหมาย = งานประจำของหัวหน้าอยู่บนสุด ·
  // พัก/ย้อนกลับ = นาน ๆ ใช้อยู่ล่าง · ขีดคั่นแยก "คำสั่งกับขั้นนี้" ออกจาก "ลิงก์ดูข้อมูลทั้งออเดอร์"
  // ตำแหน่งคงที่ทุกสถานะ (ของที่กดไม่ได้ disabled + hint ไม่ย้ายที่/ไม่ซ่อน) เพื่อให้คนจำตำแหน่งได้
  // แดงสงวนให้ย้อนกลับอย่างเดียว — พักขั้นเลิกได้จากเมนูเดิม ไม่ใช่ทางที่ต้องระวัง
  // เมนู ⋯ = เฉพาะคำสั่งที่นาน ๆ ใช้และไม่ผูกกับ "กล่อง" ไหนโดยตรง (เบสสั่ง 2026-09-10):
  // แจ้งปัญหา + ปุ่มดำเนินการ ย้ายไปอยู่ในกล่องของขั้น · มอบหมาย/แก้ให้ ไปอยู่ในกล่องเช็คลิสต์
  // ที่มีบรรทัด "ผู้ทำ" อยู่แล้ว · ที่เหลือ (พัก · ย้อนกลับ · ประวัติ) ยังอยู่ที่นี่พร้อมเหตุผลตอนกดไม่ได้
  const menu: MoreMenuItem[] = current
    ? [
        {
          key: "hold",
          label: current.status === "ON_HOLD" ? "คืนขั้นนี้กลับคิว" : "พักขั้นนี้ไว้ก่อน",
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
        ...(order ? [{ key: "history", label: "ประวัติออเดอร์", icon: History, separatorBefore: true, onSelect: () => window.open(`/orders/${order.id}?tab=history`, "_blank") }] : []),
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
                  <TabsContent value="steps">
                    <WorkOrderSteps c={c} current={current} pairedOpen={pairedOpen} allDone={allDone} qcAction={qcAction} stepFooter={stepFooter} assignAction={assignAction} />
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
}

export function WorkOrderPage({ id }: { id: string }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <WorkOrder id={id} />
    </Suspense>
  );
}
