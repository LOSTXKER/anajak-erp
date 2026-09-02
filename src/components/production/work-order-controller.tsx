"use client";

/**
 * "เครื่องยนต์" ของใบผลิตหนึ่งใบ — query · สิทธิ์ · mutation · dialog — แยกจากตัววาด
 * ใช้ร่วมกันโดยใบผลิต `/production/[id]` (แบบ D) และหน้าลงมือของจอสถานี `/station` (แบบ A)
 * เพื่อให้สองจอกดปุ่มเดียวกัน ผ่านกติกา server เดียวกัน (production.updateStep · reportStationProblem ฯลฯ)
 *
 * ปุ่มไหนกดได้มาจาก selectNowSteps + evaluateHeatPressGate ชุดเดิม — ไม่มีทางลัดสถานะใหม่
 */

import { useState, type ReactNode } from "react";
import { Truck } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useConfirm, usePromptText } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { GoodsReceiptDialog } from "@/components/goods-receipt/goods-receipt-dialog";
import { StepOutsourceDialog } from "@/components/production/step-outsource-dialog";
import { StepQtySheet } from "@/components/production/step-qty-sheet";
import { StepUpdateDialog } from "@/components/production/step-update-dialog";
import type { ProductionStep } from "@/components/production/types";
import { selectNowSteps, type NowStep } from "@/lib/production-step-actions";
import { evaluateHeatPressGate, productionWorkflowSteps } from "@/lib/production-steps";
import { cn } from "@/lib/utils";
import { stepLabel } from "./work-order-pieces";

export type WorkOrderButtonOptions = {
  /** จอทัช: ปุ่มสูง 64px ตัวหนังสือใหญ่ */
  touch?: boolean;
};

export function useWorkOrderController(id: string) {
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
  function handleStart(step: ProductionStep) {
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
  /** แจ้งปัญหาแบบพิมพ์เหตุเอง (ใบผลิต) — จอสถานีใช้ reportProblem ตรงกับเหตุที่กดเลือก */
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
  /** หัวหน้าพักงาน / ผ่านขั้นแทนช่าง — ยืนยันก่อน แล้วยิง updateStep เดิม (server จดชื่อผู้กดใน audit) */
  async function handleSupervisorStatus(step: ProductionStep, status: "ON_HOLD" | "COMPLETED" | "PENDING") {
    const copy =
      status === "ON_HOLD"
        ? { title: "พักงานนี้ไว้ก่อน?", description: `"${stepLabel(step)}" จะออกจากคิวพร้อมทำจนกว่าหัวหน้าจะปลด`, confirmText: "พักไว้" }
        : status === "COMPLETED"
          ? { title: "ผ่านขั้นนี้แทนช่าง?", description: `"${stepLabel(step)}" จะถูกปิดเป็นเสร็จในชื่อหัวหน้า — ใช้เมื่อทำแล้วจริงแต่ไม่ได้กดในระบบ`, confirmText: "ผ่านขั้นนี้" }
          : { title: "คืนขั้นนี้กลับคิวพร้อมทำ?", description: `"${stepLabel(step)}" จะกลับเป็นรอทำ`, confirmText: "คืนกลับคิว" };
    const ok = await confirm({ ...copy });
    if (!ok) return;
    quickPass.mutate({ stepId: step.id, status });
  }

  /** ปุ่มหลักปุ่มเดียวของขั้น — มาจาก NowStep.action ชุดเดียวกับหน้าเดิม */
  function primaryButton(step: ProductionStep, now: NowStep<ProductionStep> | undefined, options: WorkOrderButtonOptions = {}) {
    const busy = quickPass.isPending;
    const size = cn(options.touch && "h-16 text-lg");
    if (step.status === "COMPLETED") {
      return (
        <Button variant="outline" className={size} disabled>
          ผ่านแล้ว
        </Button>
      );
    }
    if (step.status === "FAILED" || step.status === "ON_HOLD") {
      return canSuperviseStep && hasProductionPermission ? (
        <Button variant="destructive" className={size} onClick={() => setEditStep({ step, mode: "manager" })}>
          จัดการปัญหา
        </Button>
      ) : (
        <Button variant="outline" className={size} disabled>
          รอหัวหน้าจัดการ
        </Button>
      );
    }
    if (step.stepType === "GARMENT_RECEIVE" && canUpdateStep && canOwnOrSupervise(step)) {
      return (
        <Button className={size} onClick={() => setGoodsReceiptStepId(step.id)} disabled={busy}>
          บันทึกตรวจรับเสื้อลูกค้า
        </Button>
      );
    }
    if (step.stepType === "GARMENT_PICK") {
      return null; // การ์ดเบิกเสื้อ (GarmentPickCard) มีปุ่มเบิกของตัวเองใต้โซนนี้
    }
    if (step.stepType === "DTF_PRINT" && canUpdateStep && step.printRunItems.length > 0) {
      return (
        <Button variant="outline" className={size} disabled>
          อยู่ในรอบพิมพ์ {step.printRunItems[0]!.printRun.runNumber}
        </Button>
      );
    }
    switch (now?.action) {
      case "start":
        return (
          <Button className={size} onClick={() => void handleStart(step)} disabled={busy}>
            {!step.assignedTo && !canSuperviseStep ? "รับงานนี้" : "เริ่มทำ"}
          </Button>
        );
      case "complete":
      case "record-qty":
        return (
          <Button className={size} onClick={() => handleComplete(step)} disabled={busy}>
            {step.qtyTotal && (step.qtyDone ?? 0) < step.qtyTotal ? "บันทึกยอด / ปิดขั้น" : "ปิดขั้นนี้"}
          </Button>
        );
      case "send-outsource":
        return (
          <Button className={size} onClick={() => setOutsourceStep(step)} disabled={busy}>
            <Truck /> ส่งร้านนอก
          </Button>
        );
      case "quick-pass":
        return (
          <Button className={size} onClick={() => void handleQuickPass(step)} disabled={busy}>
            ผ่านรวด (ร้านทำเสร็จแล้ว)
          </Button>
        );
      default:
        return null;
    }
  }

  const notFound = productionQuery.error?.data?.code === "NOT_FOUND";

  /** dialog ทั้งชุด — วางครั้งเดียวท้ายหน้าของผู้เรียก */
  const dialogs: ReactNode = (
    <>
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

  return {
    productionQuery,
    meQuery,
    production,
    order,
    me,
    notFound,
    workflowSteps,
    nowSteps,
    nowById,
    nowMs,
    totalQty,
    completedSteps,
    problemSteps,
    legacyPackagingReadyForQc,
    canSeeCost,
    canSuperviseOperations,
    hasProductionPermission,
    canUpdateStep,
    canSuperviseStep,
    writeDataStale,
    canOwnOrSupervise,
    selectedStep,
    selectedNow,
    setSelectedStepId,
    quickPass,
    reportProblem,
    legacyFinalize,
    handleReportProblem,
    handleSupervisorStatus,
    openEdit: (step: ProductionStep, mode: "operation" | "manager") => setEditStep({ step, mode }),
    openQty: (stepId: string) => setQtyStepId(stepId),
    primaryButton,
    dialogs,
  };
}

export type WorkOrderController = ReturnType<typeof useWorkOrderController>;
