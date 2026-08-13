import type { InternalStatus } from "@prisma/client";

export type RedesignProductionRoutes = {
  inHouseDtf: boolean;
  outsource: boolean;
};

export type RedesignFlowOrder = {
  internalStatus: InternalStatus;
  productionRoutes: RedesignProductionRoutes;
};

export type RedesignFlowState =
  "complete" | "current" | "upcoming" | "not-applicable" | "unknown";

function phaseForStatus(status: InternalStatus) {
  if (["DRAFT", "INQUIRY", "CONFIRMED"].includes(status)) return 0;
  if (["DESIGNING", "DESIGN_APPROVED"].includes(status)) return 1;
  if (status === "PRODUCTION_QUEUE") return 2;
  if (status === "PRODUCING") return 3;
  if (["QUALITY_CHECK", "PACKING"].includes(status)) return 4;
  if (["READY_TO_SHIP", "SHIPPED"].includes(status)) return 5;
  if (status === "COMPLETED") return 6;
  return -1;
}

export function getRedesignFlowState(
  order: RedesignFlowOrder,
  stageIndex: number,
): RedesignFlowState {
  const phase = phaseForStatus(order.internalStatus);
  if (phase < 0) return "unknown";

  if (stageIndex <= 2) {
    if (phase > stageIndex) return "complete";
    if (phase === stageIndex) return "current";
    return "upcoming";
  }

  if (stageIndex === 3 || stageIndex === 4) {
    const hasKnownRoute =
      order.productionRoutes.inHouseDtf || order.productionRoutes.outsource;
    if (!hasKnownRoute) return "unknown";

    const routeApplies =
      stageIndex === 3
        ? order.productionRoutes.inHouseDtf
        : order.productionRoutes.outsource;
    if (!routeApplies) return "not-applicable";
    if (phase < 3) return "upcoming";
    if (phase === 3) return "current";
    return "complete";
  }

  if (stageIndex === 5) {
    if (phase < 4) return "upcoming";
    if (phase === 4) return "current";
    return "complete";
  }

  if (stageIndex === 6) {
    if (phase < 5) return "upcoming";
    if (phase === 5) return "current";
    return "complete";
  }

  return "unknown";
}

export function getRedesignStageLabel(order: RedesignFlowOrder) {
  const phase = phaseForStatus(order.internalStatus);
  if (phase === 3) {
    if (order.productionRoutes.inHouseDtf && order.productionRoutes.outsource) {
      return "DTF ภายใน + ร้านนอก";
    }
    if (order.productionRoutes.inHouseDtf) return "DTF ภายใน";
    if (order.productionRoutes.outsource) return "งานร้านนอก";
    return "กำลังผลิต — ยังไม่ระบุเลน";
  }
  if (phase < 0) return null;
  if (phase === 0) return "รับงาน";
  if (phase === 1) return "อาร์ตเวิร์ก";
  if (phase === 2) return "ความพร้อม";
  if (phase === 4) return "QC / แพ็ค";
  return "ส่ง / ปิด";
}
