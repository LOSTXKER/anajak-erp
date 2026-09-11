"use client";

/**
 * controller ปลอมสำหรับหน้าลอง — รูปเดียวกับ useWorkOrderController แต่ไม่มี tRPC
 * กติกาที่ตัดสินปุ่ม (selectNowSteps · evaluateHeatPressGate · WorkOrderPrimaryButton) เป็นตัวจริงทั้งหมด
 * ติ๊กเช็คลิสต์/บันทึกยอดทำงานในหน้า (ไม่บันทึกฐาน) เพื่อให้เห็นจังหวะปุ่มเปลี่ยน
 */
import { createElement, useMemo, useState } from "react";
import { toast } from "sonner";

import type { WorkOrderController } from "@/components/production/work-order-controller";
import { WorkOrderPrimaryButton } from "@/components/production/work-order-controller";
import type { ProductionStep } from "@/components/production/types";
import { selectNowSteps } from "@/lib/production-step-actions";
import { evaluateHeatPressGate, productionWorkflowSteps } from "@/lib/production-steps";
import { defaultPermissionsOf, permAllows } from "@/lib/permissions";
import { FIXTURE_NOW, QUANTITY, USERS, type Role, type StateFixture } from "./_fixtures";

const noop = () => {};
const protoOnly = () => toast.message("หน้าลอง — คำสั่งนี้ไม่เปลี่ยนข้อมูลหรือสถานะจริง");
const PROTO_USERS = {
  boss: { ...USERS.boss, role: "MANAGER", permissions: defaultPermissionsOf("MANAGER") },
  staff: { ...USERS.staff, role: "PRODUCTION_STAFF", permissions: defaultPermissionsOf("PRODUCTION_STAFF") },
} as const;

type RowQty = { variantId: string; done: number; waste: number };

export function useProtoController(fx: StateFixture, role: Role): WorkOrderController {
  // ติ๊ก/ยอดที่แก้ในหน้า — key ต่อสถานะ เพื่อให้สลับสถานะแล้วกลับค่าเริ่มต้น
  const [ticked, setTicked] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState<Record<string, RowQty[]>>({});
  const me = PROTO_USERS[role];
  const nowMs = FIXTURE_NOW;

  return useMemo(() => {
    const steps: ProductionStep[] = fx.steps.map((s) => {
      const extraTicks = ticked[`${fx.key}:${s.id}`];
      const savedRows = qty[`${fx.key}:${s.id}`];
      const checks = extraTicks
        ? extraTicks.map((itemKey) => s.checks.find((c) => c.itemKey === itemKey) ?? { itemKey, checkedAt: new Date(), checkedBy: me })
        : s.checks;
      const quantities = savedRows
        ? savedRows.map((r) => ({ id: `q-${r.variantId}`, sourceOrderItemVariantId: r.variantId, qtyPlanned: s.quantities.find((q) => q.sourceOrderItemVariantId === r.variantId)?.qtyPlanned ?? 0, qtyGood: r.done, qtyScrap: r.waste }))
        : s.quantities;
      const qtyDone = savedRows ? savedRows.reduce((n, r) => n + r.done, 0) : s.qtyDone;
      const status = savedRows && s.status === "PENDING" && qtyDone > 0 ? "IN_PROGRESS" : s.status;
      return { ...s, checks, quantities, qtyDone, status } as ProductionStep;
    });
    const order = fx.order;
    const workflowSteps = productionWorkflowSteps(steps);
    const loading = !!fx.flags?.loading;
    const notFound = !!fx.flags?.notFound;
    const writeDataStale = !!fx.flags?.stale;
    const production = loading || notFound ? undefined : { id: "proto-prod", orderId: order.id, status: fx.productionStatus ?? "IN_PROGRESS", notes: null, order, steps };
    const hasProductionPermission = permAllows(me.permissions, "manage_production");
    const canSuperviseOperations = permAllows(me.permissions, "supervise_operations");
    const orderCanProduce = order.internalStatus === "PRODUCING";
    const canUpdateStep = hasProductionPermission && orderCanProduce && !writeDataStale;
    const canSuperviseStep = canSuperviseOperations && !writeDataStale;
    const canOwnOrSupervise = (step: ProductionStep) => canSuperviseStep || !step.assignedTo || step.assignedTo.id === me.id;
    const pressGate = evaluateHeatPressGate(workflowSteps);
    const canOutsource = orderCanProduce && permAllows(me.permissions, "manage_settings") && !writeDataStale;
    const nowSteps = production ? selectNowSteps(workflowSteps, { canOutsource, canUpdateStep, canSupervise: canSuperviseStep, meId: me.id, pressGate }) : [];
    const nowById = new Map(nowSteps.map((n) => [n.step.id, n]));
    const allDone = workflowSteps.length > 0 && workflowSteps.every((s) => s.status === "COMPLETED");
    const problemSteps = workflowSteps.filter((s) => s.status === "FAILED" || s.status === "ON_HOLD");

    const ctrl = {
      productionQuery: { isLoading: loading, isError: writeDataStale, refetch: noop, error: notFound ? { data: { code: "NOT_FOUND" } } : undefined },
      meQuery: { isLoading: false, isError: false, refetch: noop },
      production,
      order: production ? order : undefined,
      me,
      notFound,
      workflowSteps,
      nowSteps,
      nowById,
      nowMs,
      totalQty: QUANTITY,
      completedSteps: workflowSteps.filter((s) => s.status === "COMPLETED").length,
      problemSteps,
      legacyPackagingReadyForQc: false,
      paperStepsPending: 0,
      readyForQcViaPaper: allDone && orderCanProduce,
      canSeeCost: permAllows(me.permissions, "see_finance"),
      canSuperviseOperations,
      hasProductionPermission,
      canUpdateStep,
      canSuperviseStep,
      writeDataStale,
      canOwnOrSupervise,
      selectedStep: null,
      selectedNow: undefined,
      setSelectedStepId: noop,
      quickPass: { mutate: protoOnly, isPending: false },
      reportProblem: { mutate: protoOnly, isPending: false },
      legacyFinalize: { mutate: protoOnly, isPending: false },
      sendToQc: { mutate: protoOnly, isPending: false },
      handleSupervisorStatus: async () => protoOnly(),
      openEdit: protoOnly,
      openQty: protoOnly,
      openOutsourceReturn: protoOnly,
      tickStandard: (stepId: string, item: string, checked: boolean) =>
        setTicked((prev) => {
          const k = `${fx.key}:${stepId}`;
          const base = prev[k] ?? fx.steps.find((s) => s.id === stepId)?.checks.map((c) => c.itemKey) ?? [];
          return { ...prev, [k]: checked ? [...new Set([...base, item])] : base.filter((i) => i !== item) };
        }),
      tickPending: false,
      savePieceQty: (stepId: string, rowsIn: RowQty[]) => {
        setQty((prev) => ({ ...prev, [`${fx.key}:${stepId}`]: rowsIn }));
        toast.success("บันทึกยอดแล้ว (หน้าลอง)");
      },
      piecePending: false,
      handleReopen: async () => protoOnly(),
      reopenPending: false,
      primaryButton: (step: ProductionStep, now: ReturnType<typeof selectNowSteps<ProductionStep>>[number] | undefined) =>
        createElement(WorkOrderPrimaryButton, {
          step,
          now,
          busy: false,
          canUpdateStep,
          canSuperviseStep,
          hasProductionPermission,
          canOwnOrSupervise,
          onStart: protoOnly,
          onComplete: protoOnly,
          onQuickPass: protoOnly,
          onManage: protoOnly,
          onGoodsReceipt: protoOnly,
          onOutsource: protoOnly,
        }),
      dialogs: null,
    };
    return ctrl as unknown as WorkOrderController;
  }, [fx, ticked, qty, me, nowMs]);
}
