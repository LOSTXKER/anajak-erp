"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/page-shell";
import { MaterialUsage } from "@/components/material-usage";
import { GarmentPickCard } from "@/components/production/garment-pick-card";
import { ProductionDesignCard } from "@/components/production/production-design-card";
import { ProductionStepsList } from "@/components/production/production-steps-list";
import { ProductionNowCard } from "@/components/production/production-now-card";
import { ProductionModuleNav } from "@/components/production/production-module-nav";
import { StepUpdateDialog } from "@/components/production/step-update-dialog";
import { StepOutsourceDialog } from "@/components/production/step-outsource-dialog";
import { StepQtySheet } from "@/components/production/step-qty-sheet";
import type { ProductionStep } from "@/components/production/types";
import { PRIORITY_LABELS } from "@/lib/order-status";
import { cn, formatDate } from "@/lib/utils";
import { ArrowRight, ClipboardList, ExternalLink, Clock, AlertTriangle, Shirt } from "lucide-react";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  STEP_TYPE_LABELS,
  evaluateHeatPressGate,
  productionWorkflowSteps,
} from "@/lib/production-steps";
import { selectNowSteps } from "@/lib/production-step-actions";
import { toast } from "sonner";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { TINT } from "@/components/ui/tokens";
import { Alert } from "@/components/ui/alert";
import {
  FACTORY_STATIONS,
  factoryStationKeyForStep,
  type FactoryStationKey,
} from "@/lib/factory-station";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";

function ProductionDetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}

function productionCompletionMessage(status?: string) {
  switch (status) {
    case "QUALITY_CHECK":
      return "ผลิตครบแล้ว — รอ QC ก่อนแพ็กสินค้า";
    case "PACKING":
      return "QC ผ่านแล้ว — อยู่ขั้นแพ็กสินค้า";
    case "READY_TO_SHIP":
      return "แพ็กแล้ว — พร้อมจัดส่ง";
    case "SHIPPED":
    case "COMPLETED":
      return "งานผลิตและการจัดส่งเสร็จแล้ว";
    case "CANCELLED":
      return "ออเดอร์นี้ถูกยกเลิกแล้ว";
    default:
      return "ครบทุกขั้นการผลิตแล้ว";
  }
}

// หน้าใบผลิต — บ้านของฝั่งโรงงาน (แยกจากหน้าออเดอร์ 2026-06-12 เบสเคาะ)
// ช่างใช้หน้านี้บนมือถือหน้างาน: อัปเดตขั้นตอน/QC/เบิกวัตถุดิบ — ไม่มีเงินของออเดอร์บนหน้านี้
export function ProductionDetailScreen({
  id,
  surface = "erp",
  station = null,
}: {
  id: string;
  surface?: "erp" | "station";
  station?: FactoryStationKey | null;
}) {
  const [selectedStep, setSelectedStep] = useState<ProductionStep | null>(null);
  const [outsourceStep, setOutsourceStep] = useState<ProductionStep | null>(null);
  // ขั้นนับจำนวนที่กด "เสร็จขั้นนี้" — เปิด sheet ถามจำนวน (UX1: 2 แตะ)
  // เก็บแค่ id แล้ว derive ตัว step สดจาก query ทุก render — snapshot เก่าทำยอดถอยหลังได้
  // (sheet ส่ง qtyDone แบบ absolute ถ้าฐานเก่าจะทับของจริง)
  const [qtyStepId, setQtyStepId] = useState<string | null>(null);

  const productionQuery = trpc.production.getById.useQuery(
    { id },
    {
      refetchInterval: surface === "station" ? 30_000 : false,
      refetchOnWindowFocus: surface === "station",
      refetchOnReconnect: surface === "station",
    },
  );
  const production = productionQuery.data;
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  // PERM: ต้นทุน/หน่วยเห็นเฉพาะสายการเงิน (server listMaterials คืน cost ให้ทุก role ที่ผ่าน
  // gate ผลิต — ชั้นนี้เป็น cosmetic กันช่างเห็นตัวเลขต้นทุนบนจอ)
  const canSeeCost =
    !meQuery.isError && permAllows(me?.permissions, "see_finance");
  // เปิดใบส่งร้านนอก = ผู้จัดการขึ้นไป (ตรง managerUp ฝั่ง server)
  const hasOutsourcePermission =
    !!me && permAllows(me.permissions, "supervise_operations");
  // อัปเดต/ผ่านรวดขั้นตอน = ทีมผลิตขึ้นไป (ตรง productionTeam ฝั่ง server — กันปุ่มที่กดแล้ว FORBIDDEN)
  const hasProductionPermission =
    !!me && permAllows(me.permissions, "manage_production");

  // mutation ก้อนเดียวใช้ทุกปุ่มเร็ว (ผ่านรวด/รับงาน/เริ่ม/เสร็จ/sheet จำนวน) —
  // ยิง updateStep เดิมเสมอ ไม่มีทางลัดสถานะใหม่ (การ์ดกัน regress ใบงาน UX)
  const quickPass = useMutationWithInvalidation(trpc.production.updateStep, {
    invalidate: [
      utils.production.getById,
      utils.production.getByOrderId,
      utils.production.kanban,
      utils.factory.stationQueue,
      utils.order.getById,
      utils.task.myToday,
    ],
    onSuccess: () => setQtyStepId(null),
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "อัปเดตขั้นตอนไม่สำเร็จ");
    },
  });
  const legacyFinalize = useMutationWithInvalidation(
    trpc.production.finalizeLegacyPackaging,
    {
      invalidate: [
        utils.production.getById,
        utils.production.getByOrderId,
        utils.production.kanban,
        utils.factory.stationQueue,
        utils.order.getById,
        utils.factory.stationContext,
        utils.task.myToday,
      ],
      onSuccess: (data: { orderStatus: string; alreadyFinalized: boolean }) => {
        if (data.orderStatus === "QUALITY_CHECK") {
          toast.success(data.alreadyFinalized ? "งานอยู่ใน QC แล้ว" : "ส่งงานเข้า QC แล้ว");
        } else if (data.orderStatus === "PRODUCING") {
          toast.success("ปิดใบผลิตนี้แล้ว — ยังมีใบผลิตอื่นค้างอยู่");
        } else {
          toast.success("ใบผลิตนี้ถูกปิดไว้แล้ว");
        }
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message ?? "ส่งงานเข้า QC ไม่สำเร็จ");
      },
    },
  );

  async function handleQuickPass(step: ProductionStep) {
    const stepName = step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
    const ok = await confirm({
      title: "ผ่านรวดขั้นตอนนี้?",
      description: `"${stepName}" จะถูกปิดเป็นเสร็จ — ใช้เมื่อร้านนอกทำเสร็จแล้วแต่ไม่ได้เปิดใบส่งร้าน`,
      confirmText: "ผ่านรวด",
    });
    if (!ok) return;
    quickPass.mutate({ stepId: step.id, status: "COMPLETED" });
  }

  // รับงาน/เริ่มทำ 1 แตะ — ช่างกดบนขั้นว่าง server auto-claim เป็นชื่อตัวเองเอง
  function handleStartStep(step: ProductionStep) {
    quickPass.mutate({ stepId: step.id, status: "IN_PROGRESS" });
  }

  // เสร็จขั้นนี้ — ขั้นนับจำนวนที่ยังไม่ครบ เปิด sheet ถามจำนวน (2 แตะ) ·
  // ขั้นติ๊กเฉยๆ/นับครบแล้ว ปิดเลย 1 แตะ (server snap จำนวน + ตั้ง completedAt เอง)
  function handleCompleteStep(step: ProductionStep) {
    const counting = step.qtyTotal !== null && step.qtyTotal > 0;
    if (counting && (step.qtyDone ?? 0) < (step.qtyTotal ?? 0)) {
      setQtyStepId(step.id);
      return;
    }
    quickPass.mutate({ stepId: step.id, status: "COMPLETED" });
  }

  const order = production?.order;
  // PACKAGING ในใบเก่าเป็น compatibility row เท่านั้น — flow จริงแพ็กหลัง QC ผ่านสถานะออเดอร์
  const workflowSteps = productionWorkflowSteps(production?.steps ?? []);
  const selectedStepLive = selectedStep
    ? (workflowSteps.find((step) => step.id === selectedStep.id) ?? null)
    : null;
  const hasPendingLegacyPackaging =
    production?.steps.some(
      (step) => step.stepType === "PACKAGING" && step.status !== "COMPLETED",
    ) ?? false;
  const legacyPackagingReadyForQc =
    order?.internalStatus === "PRODUCING" &&
    hasPendingLegacyPackaging &&
    workflowSteps.every((step) => step.status === "COMPLETED");
  // step ของ sheet จำนวน — อ่านสดจาก query เสมอ (ดูคอมเมนต์ที่ qtyStepId)
  const qtySheetStep = production && qtyStepId
    ? (workflowSteps.find((s) => s.id === qtyStepId) ?? null)
    : null;
  const totalQty = order?.items.reduce((s, it) => s + it.totalQuantity, 0) ?? 0;
  const completedSteps = workflowSteps.filter((s) => s.status === "COMPLETED").length;
  const totalSteps = workflowSteps.length;
  const completedPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const allStepsDone = totalSteps > 0 && completedSteps === totalSteps;
  const orderCanProduce = order?.internalStatus === "PRODUCING";
  const productionStale = productionQuery.isError && Boolean(production);
  const permissionStale = meQuery.isError && Boolean(me);
  const writeDataStale = productionStale || permissionStale;
  const stationOrderCanProduce = surface === "station" && orderCanProduce;
  const stationCanOperate =
    surface === "station" && !!station && stationOrderCanProduce;
  const canUpdateStep =
    hasProductionPermission &&
    orderCanProduce &&
    !writeDataStale &&
    (surface === "erp" || stationCanOperate);
  // งานร้านนอกไม่มีสถานีใน Station Mode และ endpoint เดิมมีข้อมูลต้นทุนสำหรับหัวหน้า
  // จึงทำได้เฉพาะใน ERP canonical เท่านั้น ไม่ mount dialog/ยิง query จากจอสถานี
  const canOutsource =
    surface === "erp" && orderCanProduce && hasOutsourcePermission && !writeDataStale;
  const canSuperviseStep = hasOutsourcePermission && !writeDataStale;
  const canActOnStep = (step: ProductionStep) =>
    surface === "erp" ||
    (stationCanOperate && factoryStationKeyForStep(step.stepType) === station);
  const canOwnOrSuperviseStep = (step: ProductionStep) =>
    canSuperviseStep || !step.assignedTo || step.assignedTo.id === me?.id;
  const canOpenStepDetails = (step: ProductionStep) =>
    canUpdateStep &&
    canActOnStep(step) &&
    canOwnOrSuperviseStep(step) &&
    (surface === "erp" || !["GARMENT_PICK", "DTF_PRINT"].includes(step.stepType));
  const stationHref = station
    ? `/factory/station?station=${encodeURIComponent(station)}`
    : "/factory/station";
  const stationLabel = station
    ? FACTORY_STATIONS.find((item) => item.key === station)?.label
    : null;
  const stationBlockMessage =
    surface !== "station"
      ? null
      : !station
        ? "เลือกสถานีก่อน จึงจะเริ่มหรือปิดขั้นผลิตได้"
        : !stationOrderCanProduce
          ? `ออเดอร์นี้อยู่สถานะ ${(INTERNAL_STATUS_LABELS as Record<string, string>)[order?.internalStatus ?? ""] ?? order?.internalStatus ?? "ไม่ทราบสถานะ"} — จอประจำสถานีจึงเปิดให้อ่านอย่างเดียว`
          : null;
  // ขั้นที่ลงมือได้ตอนนี้ (เลนละไม่เกินหนึ่ง) — ใช้กติกาปุ่มชุดเดียวกับรายการขั้นตอนด้านล่าง
  const nowSteps = production
    ? selectNowSteps(workflowSteps, {
        canOutsource,
        canUpdateStep,
        canSupervise: canSuperviseStep,
        meId: me?.id ?? null,
        pressGate: evaluateHeatPressGate(workflowSteps),
      }).filter(({ step }) => canActOnStep(step))
    : [];
  const isOverdue = !!(
    order?.deadline &&
    new Date(order.deadline) < new Date(productionQuery.dataUpdatedAt || 0) &&
    !["SHIPPED", "COMPLETED", "CANCELLED"].includes(order.internalStatus)
  );
  const allDoneMessage = productionCompletionMessage(order?.internalStatus);

  return (
    <PageShell
      width={surface === "erp" ? "full" : "content"}
      breadcrumb={
        order
          ? [
              {
                label: surface === "station" ? "จอประจำสถานี" : "การผลิต",
                href: surface === "station" ? stationHref : "/production",
              },
              { label: order.orderNumber },
            ]
          : [
              {
                label: surface === "station" ? "จอประจำสถานี" : "การผลิต",
                href: surface === "station" ? stationHref : "/production",
              },
            ]
      }
      title={order?.orderNumber ?? "งานผลิต"}
      description={order ? [order.title, order.customer?.name].filter(Boolean).join(" · ") : undefined}
      back={
        surface === "station"
          ? { href: stationHref, label: "กลับคิวสถานี" }
          : { href: "/production", label: "กลับคิวผลิต" }
      }
      titleBadge={
        me && (!canUpdateStep || stationBlockMessage) && !canOutsource ? (
          <Badge variant="outline" size="sm">
            ดูอย่างเดียว
          </Badge>
        ) : undefined
      }
      action={
        order ? (
          <>
            <Button variant="outline" size="sm" asChild>
              <a href={`/print/job-ticket/${order.id}`} target="_blank" rel="noreferrer">
                <ClipboardList />
                ใบสั่งงาน
              </a>
            </Button>
            {surface === "erp" && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/orders/${order.id}`}>
                  <ExternalLink />
                  ดูออเดอร์
                </Link>
              </Button>
            )}
          </>
        ) : undefined
      }
      headerChildren={surface === "erp" ? <ProductionModuleNav /> : undefined}
      loading={productionQuery.isLoading || meQuery.isLoading}
      error={
        meQuery.isError && !me
          ? {
              message: "โหลดสิทธิ์การผลิตไม่สำเร็จ",
              onRetry: () => meQuery.refetch(),
            }
          : productionQuery.isError && !production
            ? {
                message: "โหลดงานผลิตไม่สำเร็จ",
                onRetry: () => productionQuery.refetch(),
              }
            : null
      }
      skeleton={<ProductionDetailSkeleton />}
    >
      {production && order ? (
        <div className="space-y-5">
          {writeDataStale && (
            <Alert variant="warning">
              ข้อมูลล่าสุดอาจยังไม่สด — ปิดปุ่มบันทึกชั่วคราวและกำลังลองเชื่อมต่อใหม่
            </Alert>
          )}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            {/* ตอนนี้ต้องทำ — action เปลี่ยนสถานะอยู่ตรงนี้จุดเดียว */}
            <div className="min-w-0">
              {stationBlockMessage ? (
                <Alert variant="warning" icon={AlertTriangle}>
                  <span className="font-semibold">อ่านใบงานได้ แต่ยังลงมือไม่ได้</span>
                  <span className="mt-0.5 block text-sm">
                    {stationBlockMessage}
                    {stationLabel ? ` · สถานีปัจจุบัน: ${stationLabel}` : ""}
                  </span>
                </Alert>
              ) : legacyPackagingReadyForQc ? (
                <section
                  aria-labelledby="legacy-production-ready"
                  className={cn(
                    TINT.warning,
                    "flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between",
                  )}
                >
                  <div className="flex min-w-0 gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <div>
                      <h2 id="legacy-production-ready" className="font-semibold">
                        ใบเก่านี้พร้อมส่งเข้า QC
                      </h2>
                      <p className="mt-0.5 text-sm">
                        ระบบจะปิดขั้นแพ็กแบบเดิมและส่งเข้า QC โดยยังไม่ถือว่าแพ็กสินค้าแล้ว
                      </p>
                    </div>
                  </div>
                  {surface === "erp" && canUpdateStep ? (
                    <Button
                      className="shrink-0"
                      disabled={legacyFinalize.isPending}
                      aria-busy={legacyFinalize.isPending || undefined}
                      onClick={() => legacyFinalize.mutate({ productionId: production.id })}
                    >
                      {legacyFinalize.isPending ? "กำลังส่ง..." : "ส่งเข้า QC"}
                      <ArrowRight />
                    </Button>
                  ) : (
                    <p className="shrink-0 text-sm font-medium">รอหัวหน้าหรือทีมผลิตส่งเข้า QC</p>
                  )}
                </section>
              ) : (
                <ProductionNowCard
                  nowSteps={nowSteps}
                  allDone={allStepsDone}
                  allDoneMessage={allDoneMessage}
                  busy={quickPass.isPending}
                  onStart={handleStartStep}
                  onComplete={handleCompleteStep}
                  onSendOutsource={setOutsourceStep}
                  onQuickPass={handleQuickPass}
                  onOpenStep={setSelectedStep}
                  canOpenStep={canOpenStepDetails}
                  printRunsHref={
                    surface === "station"
                      ? "/factory/station?station=dtf-print"
                      : "/production/print-runs"
                  }
                />
              )}
            </div>

            <aside
              className="card-surface rounded-2xl p-5"
              aria-labelledby="production-job-context"
            >
              <h2 id="production-job-context" className="text-sm font-semibold text-strong">
                ข้อมูลใบงาน
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">สถานะ</dt>
                  <dd>
                    <Badge variant="outline" size="sm">
                      {(INTERNAL_STATUS_LABELS as Record<string, string>)[
                        order.internalStatus
                      ] ?? order.internalStatus}
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    กำหนดส่ง
                  </dt>
                  <dd
                    className={cn(
                      "text-right font-medium",
                      isOverdue ? "text-red-700 dark:text-red-300" : "text-strong",
                    )}
                  >
                    {order.deadline ? formatDate(order.deadline) : "ไม่ระบุ"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">ความสำคัญ</dt>
                  <dd>
                    <Badge
                      variant={
                        order.priority === "URGENT"
                          ? "destructive"
                          : order.priority === "HIGH"
                            ? "warning"
                            : "outline"
                      }
                      size="sm"
                    >
                      {PRIORITY_LABELS[order.priority] ?? order.priority}
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted">
                    <Shirt className="h-4 w-4" aria-hidden="true" />
                    จำนวน
                  </dt>
                  <dd className="font-medium tabular-nums text-strong">
                    {totalQty.toLocaleString("th-TH")} ตัว
                  </dd>
                </div>
              </dl>
              <div className="mt-5 border-t border-divider pt-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted">ขั้นการผลิต</span>
                  <span className="font-medium tabular-nums text-strong">
                    {completedSteps}/{totalSteps}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label="ความคืบหน้าขั้นการผลิต"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={completedPct}
                  className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted"
                >
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${completedPct}%` }}
                  />
                </div>
              </div>
            </aside>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)] xl:items-start">
            <div className="min-w-0 space-y-5">
              {/* แบบ+ไซส์อยู่ใกล้ action เพื่อไม่ต้องออกจากใบงานไปหาไฟล์อ้างอิง */}
              <ProductionDesignCard order={order} />

              <div id="production-garments" className="scroll-mt-24">
                <GarmentPickCard
                  productionId={production.id}
                  steps={workflowSteps}
                  canIssueGarments={canUpdateStep && (surface === "erp" || station === "prep")}
                  canReturnGarments={
                    hasProductionPermission &&
                    !writeDataStale &&
                    (surface === "erp" || (stationCanOperate && station === "prep"))
                  }
                />
              </div>

              {/* เบิกวัตถุดิบ — ช่างเบิกได้ แต่ต้นทุนโชว์เฉพาะผู้มีสิทธิ์การเงิน */}
              {surface === "erp" && (
                <MaterialUsage
                  productionId={production.id}
                  orderNumber={order.orderNumber}
                  showCosts={canSeeCost}
                  readOnly={!canUpdateStep}
                />
              )}
            </div>

            {/* อ่านย้อนหลังเท่านั้น — ไม่ทำ action ซ้ำกับกล่อง "ตอนนี้ต้องทำ" */}
            <section
              className="card-surface rounded-2xl p-5 sm:p-6"
              aria-labelledby="production-route"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 id="production-route" className="text-base font-semibold text-strong">
                  เส้นทางการผลิต
                </h2>
                <span className="text-xs tabular-nums text-muted">
                  {completedSteps}/{totalSteps} ขั้น
                </span>
              </div>
              {workflowSteps.length > 0 ? (
                <ProductionStepsList
                  readOnly
                  steps={workflowSteps}
                  canOutsource={canOutsource}
                  canUpdateStep={canUpdateStep}
                  canSupervise={canSuperviseStep}
                  canActOnStep={canActOnStep}
                  canOpenStepDetails={canOpenStepDetails}
                  meId={me?.id ?? null}
                  busy={quickPass.isPending}
                  onSelectStep={setSelectedStep}
                  onOutsourceStep={setOutsourceStep}
                  onQuickPass={handleQuickPass}
                  onStartStep={handleStartStep}
                  onCompleteStep={handleCompleteStep}
                  printRunsHref={
                    surface === "station"
                      ? "/factory/station?station=dtf-print"
                      : "/production/print-runs"
                  }
                />
              ) : (
                <p className="text-sm text-muted">ใบผลิตนี้ยังไม่มีขั้นตอน</p>
              )}
            </section>
          </div>

          {selectedStepLive && canOpenStepDetails(selectedStepLive) && (
            <StepUpdateDialog step={selectedStepLive} onClose={() => setSelectedStep(null)} />
          )}
          {outsourceStep && !writeDataStale && (
            <StepOutsourceDialog step={outsourceStep} onClose={() => setOutsourceStep(null)} />
          )}
          {qtySheetStep && !writeDataStale && (
            <StepQtySheet
              // key ผูกยอดจริง — ยอดเปลี่ยน (refetch/คนอื่นบันทึกคั่น) input reset เป็นที่เหลือใหม่
              key={`${qtySheetStep.id}:${qtySheetStep.qtyDone}`}
              step={qtySheetStep}
              busy={quickPass.isPending}
              onSubmit={(payload) => quickPass.mutate({ stepId: qtySheetStep.id, ...payload })}
              onClose={() => setQtyStepId(null)}
            />
          )}
        </div>
      ) : (
        <RecordNotFound
          what="งานผลิตใบนี้"
          backHref={surface === "station" ? stationHref : "/production"}
          backLabel={surface === "station" ? "กลับจอประจำสถานี" : "กลับไปการผลิต"}
        />
      )}
    </PageShell>
  );
}
