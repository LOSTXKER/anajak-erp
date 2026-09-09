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

import { Suspense, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Factory, Flag, History, Pause, Printer, RotateCcw, UserRound } from "lucide-react";

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
import { ProblemDialog } from "@/components/production/step-command-dialogs";
import type { ProductionStep } from "@/components/production/types";
import { PRIORITY_LABELS } from "@/lib/order-status";
import { FLOW_OWNED_STEP_TYPES } from "@/lib/production-steps";
import { currentRailNode, railNodesOf } from "@/lib/work-order-rail";
import { routeWaitingOn } from "@/lib/work-order-route";
import { useWorkOrderController, type WorkOrderController } from "./work-order-controller";
import { activeOutsource, ProblemCard, stepLabel } from "./work-order-pieces";
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
 * ตำแหน่งคำสั่งของขั้น — **ของจริงใช้ `split`** (เบสเคาะ 2026-09-10 จากหน้าลอง `/proto/step-commands`):
 * แจ้งปัญหา + มอบหมาย/แก้ให้ = งานประจำของหัวหน้า อยู่ใต้การ์ดขั้นที่กำลังมองอยู่ กดครั้งเดียว ·
 * พัก · ย้อนกลับ · ประวัติ = นาน ๆ ใช้ ยังอยู่ในเมนู ⋯ พร้อมเหตุผลตอนกดไม่ได้
 * ค่าอื่นเหลือไว้ให้หน้าลองเปิดเทียบย้อนหลัง: header = ทุกคำสั่งอยู่ในเมนู · step = ทุกคำสั่งอยู่กับขั้น
 */
export type StepCommandPlacement = "header" | "step" | "split";

/**
 * แถวคำสั่งใต้การ์ดขั้น (หน้าลอง `/proto/step-commands`) — วาง**เฉพาะคำสั่งที่กดได้ตอนนั้น**
 * ตามกติกา `docs/DESIGN.md` "ห้ามวางปุ่มที่กดไม่ได้" ซึ่งเป็นข้อแลกของทางนี้:
 * คำสั่งที่ยังทำไม่ได้จะหายไปเลย ต่างจากเมนู ⋯ ที่โชว์ disabled พร้อมเหตุผล
 */
function StepCommandRow({ items }: { items: MoreMenuItem[] }) {
  const usable = items.filter((item) => !item.disabled);
  if (usable.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {usable.map((item) => {
        const Icon = item.icon;
        return (
          <Button key={item.key} size="sm" variant="outline" onClick={item.onSelect} className={item.danger ? "text-red-700 dark:text-red-300" : undefined}>
            {Icon ? <Icon /> : null} {item.label}
          </Button>
        );
      })}
    </div>
  );
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
export function WorkOrderView({ c, scannedMockup = Number.NaN, itemsTab, commands = "split" }: { c: WorkOrderController; scannedMockup?: number; itemsTab?: ReactNode; commands?: StepCommandPlacement }) {
  const { production, order, me, productionQuery, meQuery, workflowSteps, nowById } = c;
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
    const outsource = activeOutsource(step);
    if (outsource) {
      return c.canUpdateStep && c.canOwnOrSupervise(step) ? (
        <Button onClick={() => c.openOutsourceReturn(step.id, outsource.id)}>
          รับงานกลับ
        </Button>
      ) : null;
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
  if (current && !allDone && !qcAction && !c.writeDataStale) {
    if (current.status === "FAILED" || current.status === "ON_HOLD") blockers.push(current.status === "ON_HOLD" ? "งานถูกพักไว้" : "ติดปัญหา — รอหัวหน้าจัดการ");
    else if (waitingNames.length > 0 && !nowById.get(current.id)?.action) blockers.push(`รอ ${waitingNames.length === 1 ? waitingNames[0] : `${waitingNames.length} ขั้นก่อนหน้า`}`);
    else if (!c.canUpdateStep && c.hasProductionPermission) blockers.push("ออเดอร์ยังไม่อยู่ในสถานะกำลังผลิต");
    else if (current.assignedTo && !c.canOwnOrSupervise(current)) blockers.push(`งานของ ${current.assignedTo.name}`);
  }

  // ย้อนกลับ = เปิดขั้นที่ปิดล่าสุดก่อนหน้าให้ทำต่อ (หัวหน้า · server ตรวจว่าขั้นถัดไปยังไม่เริ่ม)
  const flatIndex = current ? workflowSteps.indexOf(current) : workflowSteps.length;
  const reopenTarget = allDone ? (workflowSteps[workflowSteps.length - 1] ?? null) : ([...workflowSteps.slice(0, flatIndex)].reverse().find((s) => s.status === "COMPLETED") ?? null);
  const reopenBlocked = !!reopenTarget && (FLOW_OWNED_STEP_TYPES.has(reopenTarget.stepType) || reopenTarget.outsourceOrders.length > 0);
  const canManage = c.canSuperviseStep && c.hasProductionPermission;
  // เมนู "เพิ่มเติม" เรียงตามความถี่ที่หัวหน้าใช้จริง ไม่ใช่ตามลำดับที่เขียนโค้ด (เบสทัก 2026-09-10
  // "บางอันจำเป็นต้องใช้ แต่ก็ไปซ่อน"): แจ้งปัญหา/มอบหมาย = งานประจำของหัวหน้าอยู่บนสุด ·
  // พัก/ย้อนกลับ = นาน ๆ ใช้อยู่ล่าง · ขีดคั่นแยก "คำสั่งกับขั้นนี้" ออกจาก "ลิงก์ดูข้อมูลทั้งออเดอร์"
  // ตำแหน่งคงที่ทุกสถานะ (ของที่กดไม่ได้ disabled + hint ไม่ย้ายที่/ไม่ซ่อน) เพื่อให้คนจำตำแหน่งได้
  // แดงสงวนให้ย้อนกลับอย่างเดียว — พักขั้นเลิกได้จากเมนูเดิม ไม่ใช่ทางที่ต้องระวัง
  const menu: MoreMenuItem[] = current
    ? [
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
        {
          key: "hold",
          label: current.status === "ON_HOLD" ? "คืนขั้นนี้กลับคิว" : "พักขั้นนี้ไว้ก่อน",
          icon: Pause,
          hint: canManage ? (current.status === "COMPLETED" ? "ขั้นนี้ปิดแล้ว" : undefined) : "หัวหน้าเท่านั้น",
          disabled: !canManage || current.status === "COMPLETED" || current.status === "FAILED",
          onSelect: () => void c.handleSupervisorStatus(current, current.status === "ON_HOLD" ? "PENDING" : "ON_HOLD"),
        },
        {
          key: "undo",
          label: reopenTarget ? `ย้อนกลับไป ${stepLabel(reopenTarget)}` : "ย้อนกลับขั้นก่อน",
          icon: RotateCcw,
          hint: !canManage ? "หัวหน้าเท่านั้น" : !reopenTarget ? "ยังไม่มีขั้นที่ปิดแล้ว" : reopenBlocked ? "ขั้นนี้ปิดผ่านหลักฐานของระบบ" : undefined,
          disabled: !canManage || !reopenTarget || reopenBlocked || c.reopenPending,
          danger: true,
          onSelect: () => void (reopenTarget && c.handleReopen(reopenTarget)),
        },
      ]
    : [];
  const orderMenu: MoreMenuItem[] = order
    ? [{ key: "history", label: "ประวัติออเดอร์", icon: History, onSelect: () => window.open(`/orders/${order.id}?tab=history`, "_blank") }]
    : [];
  // ตำแหน่งคำสั่งของขั้น — ของจริงเป็น "header" (ทุกคำสั่งอยู่ในเมนู ⋯ บนหัวใบ)
  // "step"/"split" มีเฉพาะหน้าลอง `/proto/step-commands` ที่เบสกำลังเทียบ
  const inStep = commands === "step" ? menu : commands === "split" ? menu.filter((m) => m.key === "problem" || m.key === "assign") : [];
  const inHeader = [...menu.filter((m) => !inStep.includes(m)), ...orderMenu.map((m, i) => (i === 0 ? { ...m, separatorBefore: menu.length > inStep.length } : m))];
  const stepCommands = inStep.length > 0 ? <StepCommandRow items={inStep} /> : undefined;

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
              <MoreMenu items={inHeader} size="sm" />
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
                    <WorkOrderSteps c={c} current={current} pairedOpen={pairedOpen} allDone={allDone} qcAction={qcAction} actionFor={actionFor} stepCommands={stepCommands} />
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
      {current ? <ProblemDialog open={problemOpen} onClose={() => setProblemOpen(false)} step={current} c={c} /> : null}
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
