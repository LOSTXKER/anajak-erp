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
      <Skeleton className="h-14 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
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
  const canSeeCost = permAllows(me?.permissions, "see_finance");
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
  const allStepsDone = totalSteps > 0 && completedSteps === totalSteps;
  const orderCanProduce = order?.internalStatus === "PRODUCING";
  const stationOrderCanProduce = surface === "station" && orderCanProduce;
  const stationCanOperate =
    surface === "station" && !!station && stationOrderCanProduce;
  const canUpdateStep =
    hasProductionPermission &&
    orderCanProduce &&
    (surface === "erp" || stationCanOperate);
  // งานร้านนอกไม่มีสถานีใน Station Mode และ endpoint เดิมมีข้อมูลต้นทุนสำหรับหัวหน้า
  // จึงทำได้เฉพาะใน ERP canonical เท่านั้น ไม่ mount dialog/ยิง query จากจอสถานี
  const canOutsource =
    surface === "erp" && orderCanProduce && hasOutsourcePermission;
  const canActOnStep = (step: ProductionStep) =>
    surface === "erp" ||
    (stationCanOperate && factoryStationKeyForStep(step.stepType) === station);
  const canOpenStepDetails = (step: ProductionStep) =>
    canActOnStep(step) &&
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
        canSupervise: canOutsource,
        meId: me?.id ?? null,
        pressGate: evaluateHeatPressGate(workflowSteps),
      }).filter(({ step }) => canActOnStep(step))
    : [];
  const isOverdue = !!(
    order?.deadline &&
    new Date(order.deadline) < new Date(productionQuery.dataUpdatedAt || 0) &&
    !["SHIPPED", "COMPLETED", "CANCELLED"].includes(order.internalStatus)
  );

  return (
    <PageShell
      width="content"
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
          {productionQuery.isError && production && (
            <Alert variant="warning">
              ข้อมูลใบผลิตล่าสุดอาจยังไม่สด — ระบบกำลังลองเชื่อมต่อใหม่
            </Alert>
          )}
          {/* บริบทที่ช่างต้องรู้ก่อนจับงาน — กำหนดส่ง/ด่วน/จำนวน/ความคืบหน้า
              ถอด "สถานะออเดอร์" ออกเพราะเป็นข้อมูลอ้างอิงของฝั่งขาย ไม่ใช่สิ่งที่ช่างใช้ */}
          <div className="card-surface flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl px-4 py-3 text-sm">
            {order.deadline && (
              <span
                className={cn(
                  "flex items-center gap-1.5",
                  isOverdue ? "font-medium text-red-700 dark:text-red-300" : "text-secondary",
                )}
              >
                {isOverdue ? (
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                )}
                {isOverdue ? "เลยกำหนด " : "กำหนดส่ง "}
                {formatDate(order.deadline)}
              </span>
            )}
            {order.priority && order.priority !== "NORMAL" && (
              <Badge
                variant={order.priority === "URGENT" ? "destructive" : "warning"}
                size="sm"
              >
                {PRIORITY_LABELS[order.priority] ?? order.priority}
              </Badge>
            )}
            {totalQty > 0 && (
              <span className="flex items-center gap-1.5 text-secondary">
                <Shirt className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                {totalQty.toLocaleString("th-TH")} ตัว
              </span>
            )}
            <span className="ml-auto text-sm tabular-nums text-muted">
              เสร็จ {completedSteps}/{totalSteps} ขั้น
            </span>
          </div>

          {/* ตอนนี้ต้องทำ — บอร์ดผลิตไม่มีปุ่มแล้ว หน้านี้จึงเป็นที่เดียวที่ลงมือได้ */}
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
                "flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between",
              )}
            >
              <div className="flex min-w-0 gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <h2 id="legacy-production-ready" className="font-semibold">
                    ใบเก่านี้พร้อมส่งเข้า QC
                  </h2>
                  <p className="mt-0.5 text-sm">
                    ใบเก่านี้ยังมีขั้นแพ็กแบบเดิม ระบบจะปิดขั้นนั้นและส่งงานไป QC โดยยังไม่ถือว่าแพ็กสินค้าแล้ว
                  </p>
                </div>
              </div>
              {surface === "erp" && hasProductionPermission ? (
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

          {/* แบบ+ไซส์อยู่ติดกับ action หน้างาน — ช่างไม่ต้องเริ่มก่อนแล้วค่อยเลื่อนลงหาแบบ */}
          <ProductionDesignCard order={order} />

          {/* ขั้นตอนทั้งใบ — เช็กลิสต์เต็มไว้ไล่ดู ส่วนสิ่งที่ต้องกดอยู่ในกล่องด้านบนแล้ว */}
          <div className="card-surface rounded-2xl p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-semibold text-muted">ขั้นตอนทั้งใบ</h2>
            <ProductionStepsList
              steps={workflowSteps}
              canOutsource={canOutsource}
              canUpdateStep={canUpdateStep}
              canSupervise={canOutsource}
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
          </div>

          {/* เสื้อจากสต๊อค: เบิก (ตัดยอดจอง) + คืนเศษ — ผูกขั้น GARMENT_PICK (ก้อน 1) */}
          <GarmentPickCard
            productionId={production.id}
            steps={workflowSteps}
            canIssueGarments={
              canUpdateStep &&
              (surface === "erp" || station === "prep")
            }
            canReturnGarments={
              hasProductionPermission &&
              (surface === "erp" || (stationCanOperate && station === "prep"))
            }
          />

          {/* เบิกวัตถุดิบ — ช่างเบิกได้ แต่เงิน (ต้นทุน/หน่วย) โชว์เฉพาะหัวหน้า */}
          {surface === "erp" && (
            <MaterialUsage
              productionId={production.id}
              orderNumber={order.orderNumber}
              showCosts={canSeeCost}
            />
          )}

          {selectedStep && (
            <StepUpdateDialog step={selectedStep} onClose={() => setSelectedStep(null)} />
          )}
          {outsourceStep && (
            <StepOutsourceDialog step={outsourceStep} onClose={() => setOutsourceStep(null)} />
          )}
          {qtySheetStep && (
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
