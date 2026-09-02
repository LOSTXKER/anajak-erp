"use client";

/**
 * ใบผลิต `/production/[id]` — แบบ D "แท็บ + 2 คอลัมน์" (เบสเคาะ 2026-09-03 จากหน้าลอง /proto/work-order)
 *
 *   หัวใบ: ตัวเลข 4 ช่อง (จำนวน · กำหนดส่ง · ผ่านแล้ว x/y · ติดปัญหา) + การ์ดปัญหาแดง — เห็นทุกแท็บ
 *   แท็บ: ขั้นงาน / ทำอะไร / ข้อมูลใบ / ประวัติ — ทุกแท็บ 2 คอลัมน์
 *   ขั้นงาน: ซ้าย = รายการขั้น (กดเลือก) · ขวา = ขั้นที่เลือก + โซนลงมือมาตรฐาน (ข้อกำหนด → ปุ่มเดียว)
 *
 * กติกา server ทั้งหมดเป็นของเดิม: production.getById · updateStep · reportStationProblem · dialog เดิม
 * (StepUpdateDialog / StepOutsourceDialog / StepQtySheet / GarmentPickCard / GoodsReceiptDialog / MaterialUsage)
 * ปุ่มไหนกดได้มาจาก selectNowSteps + evaluateHeatPressGate ชุดเดียวกับที่หน้าเดิมใช้ — ไม่มีทางลัดสถานะใหม่
 */

import { Suspense, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  History,
  Shirt,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useConfirm, usePromptText } from "@/components/ui/confirm-dialog";
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
import { GoodsReceiptDialog } from "@/components/goods-receipt/goods-receipt-dialog";
import { GarmentPickCard } from "@/components/production/garment-pick-card";
import { ProductionDesignCard } from "@/components/production/production-design-card";
import { ProductionMockupTab } from "@/components/production/production-mockup-tab";
import { StepOutsourceDialog } from "@/components/production/step-outsource-dialog";
import { StepQtySheet } from "@/components/production/step-qty-sheet";
import { StepUpdateDialog } from "@/components/production/step-update-dialog";
import type { ProductionDetail, ProductionStep } from "@/components/production/types";
import { PRIORITY_LABELS } from "@/lib/order-status";
import { currentProductionProblemReason } from "@/lib/production-problem";
import { selectNowSteps, type NowStep } from "@/lib/production-step-actions";
import {
  OUTSOURCE_STATUS_LABELS,
  STEP_TYPE_LABELS,
  evaluateHeatPressGate,
  isOutsourceStep,
  productionWorkflowSteps,
} from "@/lib/production-steps";
import { workOrderStandards } from "@/lib/work-order-standards";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromNow(value: Date | string | null | undefined, nowMs: number): number | null {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

function stepLabel(step: ProductionStep) {
  return step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
}

type StepView = {
  state: "done" | "active" | "blocked" | "waiting" | "todo";
  label: string;
  chip: "neutral" | "info" | "warning" | "error" | "success";
};

const STEP_VIEW: Record<StepView["state"], Omit<StepView, "state">> = {
  done: { label: "ผ่านแล้ว", chip: "success" },
  active: { label: "กำลังทำ", chip: "info" },
  blocked: { label: "ติดปัญหา", chip: "error" },
  waiting: { label: "รอ", chip: "warning" },
  todo: { label: "ยังไม่ถึง", chip: "neutral" },
};

function viewOf(step: ProductionStep, now: NowStep<ProductionStep> | undefined): StepView {
  const state: StepView["state"] =
    step.status === "COMPLETED"
      ? "done"
      : step.status === "FAILED" || step.status === "ON_HOLD"
        ? "blocked"
        : now && now.waitingOn.length > 0
          ? "waiting"
          : step.status === "IN_PROGRESS"
            ? "active"
            : now && now.group === "current"
              ? "active"
              : "todo";
  return { state, ...STEP_VIEW[state] };
}

function activeOutsource(step: ProductionStep) {
  return step.outsourceOrders.find((o) => !["QC_PASSED", "QC_FAILED", "CANCELLED"].includes(o.status)) ?? null;
}

/* ───────────────────────── ชิ้นส่วน ───────────────────────── */

function StateChip({ view, kind, size = "sm" }: { view: StepView; kind: "inhouse" | "outsource"; size?: "sm" | "md" }) {
  return (
    <InfoChip size={size} tone={view.chip} strong={view.state === "active" || view.state === "blocked"} icon={kind === "outsource" ? Truck : Wrench}>
      {view.label}
    </InfoChip>
  );
}

function Qty({ step, size = "sm" }: { step: ProductionStep; size?: "sm" | "md" }) {
  if (step.qtyTotal === null || step.qtyTotal === 0) {
    return <span className="text-xs text-muted">{step.status === "COMPLETED" ? "ผ่านแล้ว" : "ไม่นับจำนวน"}</span>;
  }
  return (
    <Metric
      value={`${(step.qtyDone ?? 0).toLocaleString("th-TH")}/${step.qtyTotal.toLocaleString("th-TH")}`}
      size={size}
      tone={(step.qtyDone ?? 0) >= step.qtyTotal ? "success" : "default"}
    />
  );
}

function Owner({ step }: { step: ProductionStep }) {
  return step.assignedTo ? (
    <span className="inline-flex items-center gap-1.5 text-secondary">
      <UserRound className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      {step.assignedTo.name}
    </span>
  ) : (
    <span className="text-muted">ยังไม่มีคนรับ</span>
  );
}

function ProblemCard({ step }: { step: ProductionStep }) {
  const reason = currentProductionProblemReason(step);
  const title = step.status === "FAILED" ? "งานติดปัญหา" : "งานถูกพักไว้";
  return (
    <Alert variant="error" title={`${title} — ${stepLabel(step)}`}>
      <p>{reason ?? step.notes ?? "ยังไม่ระบุเหตุ"}</p>
      {step.assignedTo ? <p className="mt-1 text-xs opacity-80">ผู้รับผิดชอบ {step.assignedTo.name}</p> : null}
    </Alert>
  );
}

// nowMs มาจากเวลาที่ query อัปเดต ไม่เรียก Date.now() ตอนเรนเดอร์ (react-compiler ตีว่าไม่บริสุทธิ์)
function OutsourceFacts({ step, nowMs }: { step: ProductionStep; nowMs: number }) {
  const o = step.outsourceOrders[0];
  if (!o) return null;
  const awaiting = !["QC_PASSED", "QC_FAILED", "CANCELLED"].includes(o.status);
  const overdue = awaiting && !!o.expectedBackAt && new Date(o.expectedBackAt).getTime() < nowMs - DAY_MS;
  return (
    <FactList columns={3}>
      <Fact icon={Truck} label="ร้านนอก" value={o.vendor.name} sub={o.sentAt ? `ส่งไป ${formatDate(o.sentAt)}` : "ยังไม่บันทึกวันส่ง"} />
      <Fact label="งานที่ส่ง" value={o.description ?? stepLabel(step)} sub={o.quantity ? `${o.quantity.toLocaleString("th-TH")} ชิ้น` : undefined} />
      <div>
        <p className="text-xs font-medium text-muted">{awaiting ? "นัดรับกลับ" : "สถานะ"}</p>
        <InfoChip
          tone={!awaiting ? (o.status === "QC_PASSED" ? "success" : "error") : overdue ? "error" : "info"}
          strong={awaiting && !!o.expectedBackAt}
          icon={CalendarCheck}
          className="mt-1"
        >
          {awaiting ? (o.expectedBackAt ? formatDate(o.expectedBackAt) : "ยังไม่นัด") : (OUTSOURCE_STATUS_LABELS[o.status as keyof typeof OUTSOURCE_STATUS_LABELS] ?? o.status)}
        </InfoChip>
      </div>
    </FactList>
  );
}

/* ───────────────────────── หน้า ───────────────────────── */

function WorkOrder({ id }: { id: string }) {
  const productionQuery = trpc.production.getById.useQuery(
    { id },
    {
      retry: (failureCount, error) => error.data?.code !== "NOT_FOUND" && failureCount < 3,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  );
  const production = productionQuery.data;
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const confirm = useConfirm();
  const promptText = usePromptText();
  const utils = trpc.useUtils();

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [editStep, setEditStep] = useState<{ step: ProductionStep; mode: "operation" | "manager" } | null>(null);
  const [outsourceStep, setOutsourceStep] = useState<ProductionStep | null>(null);
  const [qtyStepId, setQtyStepId] = useState<string | null>(null);
  const [goodsReceiptStepId, setGoodsReceiptStepId] = useState<string | null>(null);

  // สิทธิ์ชุดเดียวกับหน้าเดิม — ปุ่มที่ server จะปฏิเสธต้องไม่ถูกวาด
  const canSeeCost = !meQuery.isError && permAllows(me?.permissions, "see_finance");
  const canSuperviseOperations = !!me && permAllows(me.permissions, "supervise_operations");
  const canCreateOutsource = !!me && permAllows(me.permissions, "manage_settings");
  const hasProductionPermission = !!me && permAllows(me.permissions, "manage_production");

  const invalidate = [
    utils.production.getById,
    utils.production.getByOrderId,
    utils.production.kanban,
    utils.factory.stationQueue,
    utils.order.getById,
    utils.task.myToday,
  ];
  const quickPass = useMutationWithInvalidation(trpc.production.updateStep, {
    invalidate,
    onSuccess: () => setQtyStepId(null),
    onError: (err: { message?: string }) => toast.error(err.message ?? "อัปเดตขั้นตอนไม่สำเร็จ"),
  });
  const reportProblem = useMutationWithInvalidation(trpc.production.reportStationProblem, {
    invalidate,
    onSuccess: () => toast.success("แจ้งปัญหาให้หัวหน้าแล้ว"),
    onError: (err: { message?: string }) => toast.error("แจ้งปัญหาไม่สำเร็จ", { description: err.message }),
  });
  const legacyFinalize = useMutationWithInvalidation(trpc.production.finalizeLegacyPackaging, {
    invalidate: [...invalidate, utils.factory.stationContext],
    onSuccess: (data: { orderStatus: string; alreadyFinalized: boolean }) => {
      if (data.orderStatus === "QUALITY_CHECK") toast.success(data.alreadyFinalized ? "งานอยู่ใน QC แล้ว" : "ส่งงานเข้า QC แล้ว");
      else if (data.orderStatus === "PRODUCING") toast.success("ปิดใบผลิตนี้แล้ว — ยังมีใบผลิตอื่นค้างอยู่");
      else toast.success("ใบผลิตนี้ถูกปิดไว้แล้ว");
    },
    onError: (err: { message?: string }) => toast.error(err.message ?? "ส่งงานเข้า QC ไม่สำเร็จ"),
  });

  const order = production?.order;
  const workflowSteps = productionWorkflowSteps(production?.steps ?? []);
  const orderCanProduce = order?.internalStatus === "PRODUCING";
  const writeDataStale = (productionQuery.isError && Boolean(production)) || (meQuery.isError && Boolean(me));
  const canUpdateStep = hasProductionPermission && orderCanProduce && !writeDataStale;
  const canOutsource = orderCanProduce && canCreateOutsource && !writeDataStale;
  const canSuperviseStep = canSuperviseOperations && !writeDataStale;
  const canOwnOrSupervise = (step: ProductionStep) => canSuperviseStep || !step.assignedTo || step.assignedTo.id === me?.id;

  const pressGate = evaluateHeatPressGate(workflowSteps);
  const nowSteps = production
    ? selectNowSteps(workflowSteps, {
        canOutsource,
        canUpdateStep,
        canSupervise: canSuperviseStep,
        meId: me?.id ?? null,
        pressGate,
      })
    : [];
  const nowById = new Map(nowSteps.map((n) => [n.step.id, n]));

  const nowMs = productionQuery.dataUpdatedAt || 0;
  const totalQty = order?.items.reduce((sum, item) => sum + item.totalQuantity, 0) ?? 0;
  const completedSteps = workflowSteps.filter((s) => s.status === "COMPLETED").length;
  const problemSteps = workflowSteps.filter((s) => s.status === "FAILED" || s.status === "ON_HOLD");
  const hasPendingLegacyPackaging = production?.steps.some((s) => s.stepType === "PACKAGING" && s.status !== "COMPLETED") ?? false;
  const legacyPackagingReadyForQc = orderCanProduce && hasPendingLegacyPackaging && workflowSteps.every((s) => s.status === "COMPLETED");

  const defaultStepId =
    problemSteps[0]?.id ??
    nowSteps.find((n) => n.group === "current")?.step.id ??
    workflowSteps.find((s) => s.status !== "COMPLETED")?.id ??
    workflowSteps[0]?.id ??
    null;
  const selectedStep = workflowSteps.find((s) => s.id === selectedStepId) ?? workflowSteps.find((s) => s.id === defaultStepId) ?? null;
  const selectedNow = selectedStep ? nowById.get(selectedStep.id) : undefined;
  const qtySheetStep = qtyStepId ? (workflowSteps.find((s) => s.id === qtyStepId) ?? null) : null;

  // ---- ลงมือ: ยิง updateStep เดิมเสมอ (ทางเดียวกับหน้าเดิม) ----
  async function handleStart(step: ProductionStep) {
    quickPass.mutate({ stepId: step.id, status: "IN_PROGRESS" });
  }
  function handleComplete(step: ProductionStep) {
    const counting = step.qtyTotal !== null && step.qtyTotal > 0;
    if (counting && (step.qtyDone ?? 0) < (step.qtyTotal ?? 0)) {
      setQtyStepId(step.id);
      return;
    }
    quickPass.mutate({ stepId: step.id, status: "COMPLETED" });
  }
  async function handleQuickPass(step: ProductionStep) {
    const ok = await confirm({
      title: "ผ่านรวดขั้นตอนนี้?",
      description: `"${stepLabel(step)}" จะถูกปิดเป็นเสร็จ — ใช้เมื่อร้านนอกทำเสร็จแล้วแต่ไม่ได้เปิดใบส่งร้าน`,
      confirmText: "ผ่านรวด",
    });
    if (!ok) return;
    quickPass.mutate({ stepId: step.id, status: "COMPLETED" });
  }
  async function handleReportProblem(step: ProductionStep) {
    const reason = await promptText({
      title: "แจ้งปัญหาของขั้นนี้",
      description: "ระบุสิ่งที่พบให้หัวหน้าตัดสินใจ ขั้นนี้จะหยุดไว้จนกว่าจะแก้",
      label: "รายละเอียดปัญหา",
      placeholder: "เช่น เสื้อไม่ครบ 1 ตัว หรือฟิล์มมีตำหนิ",
      confirmText: "แจ้งปัญหา",
      required: true,
      minLength: 3,
      validationMessage: "กรุณาระบุปัญหาอย่างน้อย 3 ตัวอักษร",
      destructive: true,
    });
    if (reason === null) return;
    if (reason.trim().length < 3) {
      toast.error("กรุณาระบุปัญหาอย่างน้อย 3 ตัวอักษร");
      return;
    }
    reportProblem.mutate({ stepId: step.id, reason: reason.trim() });
  }

  /** ปุ่มหลักปุ่มเดียวของขั้น — มาจาก NowStep.action ชุดเดียวกับหน้าเดิม */
  function primaryButton(step: ProductionStep, now: NowStep<ProductionStep> | undefined) {
    const busy = quickPass.isPending;
    if (step.status === "COMPLETED") {
      return (
        <Button variant="outline" disabled>
          ผ่านแล้ว
        </Button>
      );
    }
    if (step.status === "FAILED" || step.status === "ON_HOLD") {
      return canSuperviseStep && hasProductionPermission ? (
        <Button variant="destructive" onClick={() => setEditStep({ step, mode: "manager" })}>
          จัดการปัญหา
        </Button>
      ) : (
        <Button variant="outline" disabled>
          รอหัวหน้าจัดการ
        </Button>
      );
    }
    if (step.stepType === "GARMENT_RECEIVE" && canUpdateStep && canOwnOrSupervise(step)) {
      return (
        <Button onClick={() => setGoodsReceiptStepId(step.id)} disabled={busy}>
          บันทึกตรวจรับเสื้อลูกค้า
        </Button>
      );
    }
    if (step.stepType === "GARMENT_PICK") {
      return null; // การ์ดเบิกเสื้อ (GarmentPickCard) มีปุ่มเบิกของตัวเองใต้โซนนี้
    }
    if (step.stepType === "DTF_PRINT" && canUpdateStep && step.printRunItems.length > 0) {
      return (
        <Button variant="outline" disabled>
          อยู่ในรอบพิมพ์ {step.printRunItems[0]!.printRun.runNumber}
        </Button>
      );
    }
    switch (now?.action) {
      case "start":
        return (
          <Button onClick={() => void handleStart(step)} disabled={busy}>
            {!step.assignedTo && !canSuperviseStep ? "รับงานนี้" : "เริ่มทำ"}
          </Button>
        );
      case "complete":
      case "record-qty":
        return (
          <Button onClick={() => handleComplete(step)} disabled={busy}>
            {step.qtyTotal && (step.qtyDone ?? 0) < step.qtyTotal ? "บันทึกยอด / ปิดขั้น" : "ปิดขั้นนี้"}
          </Button>
        );
      case "send-outsource":
        return (
          <Button onClick={() => setOutsourceStep(step)} disabled={busy}>
            <Truck /> ส่งร้านนอก
          </Button>
        );
      case "quick-pass":
        return (
          <Button onClick={() => void handleQuickPass(step)} disabled={busy}>
            ผ่านรวด (ร้านทำเสร็จแล้ว)
          </Button>
        );
      default:
        return null;
    }
  }

  const notFound = productionQuery.error?.data?.code === "NOT_FOUND";

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
          production && selectedStep && canSuperviseStep && hasProductionPermission && selectedStep.status !== "COMPLETED" ? (
            <Button variant="outline" onClick={() => setEditStep({ step: selectedStep, mode: "manager" })}>
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
            : productionQuery.isError && !production && !notFound
              ? { message: "โหลดใบผลิตไม่สำเร็จ", onRetry: () => productionQuery.refetch() }
              : null
        }
      >
        {notFound || !production || !order ? (
          <RecordNotFound what="ใบผลิตนี้" backHref="/production" backLabel="กลับหน้าการผลิต" />
        ) : (
          <div className="space-y-6">
            {writeDataStale ? (
              <Alert variant="warning" title="ข้อมูลล่าสุดอาจยังไม่ครบ">
                กำลังแสดงข้อมูลเดิมที่โหลดไว้ — ปุ่มลงมือถูกปิดจนกว่าจะโหลดใหม่สำเร็จ
              </Alert>
            ) : null}

            {/* ตัวเลข 4 ช่อง — ชั้น 1 */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="card-surface rounded-2xl p-4">
                <Metric label="จำนวนที่ต้องผลิต" value={totalQty.toLocaleString("th-TH")} unit="ตัว" size="lg" icon={Shirt} />
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
                <Metric label="ผ่านแล้ว" value={`${completedSteps}/${workflowSteps.length}`} unit="ขั้น" size="lg" icon={CheckCircle2} tone={workflowSteps.length > 0 && completedSteps === workflowSteps.length ? "success" : "default"} />
              </div>
              <div className="card-surface rounded-2xl p-4">
                <Metric label="ติดปัญหา" value={problemSteps.length} unit="ขั้น" size="lg" icon={AlertTriangle} tone={problemSteps.length > 0 ? "danger" : "muted"} />
              </div>
            </div>

            {problemSteps.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {problemSteps.map((step) => (
                  <ProblemCard key={step.id} step={step} />
                ))}
              </div>
            ) : null}

            {legacyPackagingReadyForQc ? (
              <Alert variant="success" title="ทุกขั้นผลิตเสร็จแล้ว">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span>ส่งงานเข้าตรวจ QC เพื่อไปต่อขั้นแพ็กและจัดส่ง</span>
                  {canUpdateStep ? (
                    <Button size="sm" onClick={() => legacyFinalize.mutate({ productionId: production.id })} disabled={legacyFinalize.isPending}>
                      ส่งเข้า QC
                    </Button>
                  ) : null}
                </span>
              </Alert>
            ) : null}

            <Tabs defaultValue="steps" className="space-y-6">
              <TabsBar>
                <TabsList aria-label="ส่วนของใบผลิต">
                  <TabsTrigger value="steps" hasPending={problemSteps.length > 0}>
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
                    <Section title="ขั้นงานทั้งหมด" meta={`${completedSteps}/${workflowSteps.length} ผ่านแล้ว`} icon={Wrench} tone="production" flush>
                      <ol className="divide-y divide-divider">
                        {workflowSteps.map((step, index) => {
                          const view = viewOf(step, nowById.get(step.id));
                          const on = selectedStep?.id === step.id;
                          const outsource = isOutsourceStep(step.stepType);
                          return (
                            <li key={step.id}>
                              <button
                                type="button"
                                aria-pressed={on}
                                onClick={() => setSelectedStepId(step.id)}
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
                        step={selectedStep}
                        now={selectedNow}
                        nowMs={nowMs}
                        production={production}
                        primary={primaryButton(selectedStep, selectedNow)}
                        canReport={canUpdateStep && canOwnOrSupervise(selectedStep) && selectedStep.status !== "COMPLETED" && selectedStep.status !== "FAILED"}
                        onReport={() => void handleReportProblem(selectedStep)}
                        canEdit={canUpdateStep && canOwnOrSupervise(selectedStep) && selectedStep.status !== "COMPLETED"}
                        onEdit={() => setEditStep({ step: selectedStep, mode: "operation" })}
                        garment={
                          selectedStep.stepType === "GARMENT_PICK" ? (
                            <GarmentPickCard
                              productionId={production.id}
                              steps={workflowSteps}
                              stepId={selectedStep.id}
                              canIssueGarments={canUpdateStep && canOwnOrSupervise(selectedStep) && selectedStep.status !== "COMPLETED"}
                              canReturnGarments={canSuperviseStep && hasProductionPermission && !writeDataStale}
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
                      {hasProductionPermission ? (
                        <MaterialUsage productionId={production.id} orderNumber={order.orderNumber} showCosts={canSeeCost} readOnly={!canUpdateStep || !canSuperviseStep} embedded />
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

      {editStep ? <StepUpdateDialog key={editStep.step.id + editStep.mode} step={editStep.step} mode={editStep.mode} onClose={() => setEditStep(null)} /> : null}
      {outsourceStep ? <StepOutsourceDialog key={outsourceStep.id} step={outsourceStep} onClose={() => setOutsourceStep(null)} /> : null}
      {qtySheetStep ? (
        <StepQtySheet
          step={qtySheetStep}
          busy={quickPass.isPending}
          onSubmit={(payload) => quickPass.mutate({ stepId: qtySheetStep.id, ...payload })}
          onClose={() => setQtyStepId(null)}
        />
      ) : null}
      {goodsReceiptStepId && order ? (
        <GoodsReceiptDialog key={goodsReceiptStepId} orderId={order.id} productionStepId={goodsReceiptStepId} receiptType="CUSTOMER_GARMENT" onClose={() => setGoodsReceiptStepId(null)} />
      ) : null}
    </>
  );
}

/* ───────────────────────── ขั้นที่เลือก + โซนลงมือมาตรฐาน ───────────────────────── */

function StepDetail({
  step,
  now,
  nowMs,
  primary,
  canReport,
  onReport,
  canEdit,
  onEdit,
  garment,
}: {
  step: ProductionStep;
  now: NowStep<ProductionStep> | undefined;
  nowMs: number;
  production: ProductionDetail;
  primary: React.ReactNode;
  canReport: boolean;
  onReport: () => void;
  canEdit: boolean;
  onEdit: () => void;
  garment: React.ReactNode;
}) {
  const view = viewOf(step, now);
  const outsource = isOutsourceStep(step.stepType);
  const standards = workOrderStandards(step.stepType);
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
      meta={<StateChip view={view} kind={outsource ? "outsource" : "inhouse"} size="md" />}
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
            <Button variant="outline" onClick={onReport}>
              แจ้งปัญหา
            </Button>
          ) : null}
        </ActionZone>
      </div>
    </Section>
  );
}

/* ───────────────────────── ทำอะไร: สินค้า สี ไซซ์ ───────────────────────── */

function ItemsSection({ order }: { order: ProductionDetail["order"] }) {
  const products = order.items.flatMap((item) => item.products);
  const total = order.items.reduce((sum, item) => sum + item.totalQuantity, 0);
  return (
    <Section title="สินค้า สี ไซซ์" meta={`${products.length} รายการ · ${total.toLocaleString("th-TH")} ตัว`} icon={Shirt} tone="product">
      {products.length === 0 ? (
        <p className="text-sm text-muted">ออเดอร์นี้ยังไม่มีรายการสินค้า</p>
      ) : (
        <ul className="divide-y divide-divider">
          {products.map((product) => (
            <li key={product.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-medium text-strong">
                  {product.description || product.productType || "สินค้า"}
                  {product.fabricColor ? <span className="text-secondary"> · {product.fabricColor}</span> : null}
                </p>
                <Metric value={product.totalQuantity.toLocaleString("th-TH")} unit="ตัว" size="sm" />
              </div>
              {product.variants.length > 0 ? (
                <InfoChipRow className="mt-1.5">
                  {product.variants.map((v) => (
                    <InfoChip key={v.id} size="sm">
                      {v.size}
                      {v.color && v.color !== product.fabricColor ? ` ${v.color}` : ""} <span className="font-semibold">{v.quantity}</span>
                    </InfoChip>
                  ))}
                </InfoChipRow>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function WorkOrderPage({ id }: { id: string }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <WorkOrder id={id} />
    </Suspense>
  );
}
