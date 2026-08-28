import type { InternalStatus } from "@prisma/client";
import {
  getOrderNextStep,
  type NextStep,
  type NextStepAction,
} from "@/lib/order-next-step";
import { buildNextStepInput, tabForAnchor } from "@/lib/order-tabs";
import { buildOrderEditHref } from "@/lib/order-edit-navigation";
import { sumOrderQuantity } from "@/lib/pricing";
import {
  isOutsourceStep,
  laneOf,
  STEP_TYPE_LABELS,
} from "@/lib/production-steps";
import { ITEM_SOURCES, PRINT_TYPES } from "@/types/order-form";

export const ORDER_WORKBENCH_STAGES = [
  { key: "intake", label: "รับงาน" },
  { key: "artwork", label: "อาร์ตเวิร์ก" },
  { key: "readiness", label: "ความพร้อม" },
  { key: "dtf", label: "DTF ภายใน" },
  { key: "outsource", label: "งานร้านนอก" },
  { key: "qc-pack", label: "QC / แพ็ค" },
  { key: "delivery-close", label: "ส่ง / ปิด" },
] as const;

export type OrderWorkbenchFlowState =
  | "complete"
  | "current"
  | "upcoming"
  | "not-applicable"
  | "unknown";

interface WorkbenchProductInput {
  itemSource?: string | null;
  variants?: { quantity: number }[] | null;
}

interface WorkbenchPrintInput {
  printType: string;
}

interface WorkbenchItemInput {
  products?: WorkbenchProductInput[] | null;
  prints?: WorkbenchPrintInput[] | null;
}

interface WorkbenchProductionStepInput {
  id: string;
  stepType: string;
  customStepName?: string | null;
  status: string;
  sortOrder: number;
  assignedTo?: { name: string } | null;
}

interface WorkbenchProductionInput {
  id: string;
  status: string;
  steps?: WorkbenchProductionStepInput[] | null;
}

interface WorkbenchDeliveryInput {
  status: string;
  shippingMethod: string;
  trackingNumber?: string | null;
  createdAt: Date | string;
}

export interface OrderWorkbenchInput {
  internalStatus: InternalStatus;
  items?: WorkbenchItemInput[] | null;
  productions?: WorkbenchProductionInput[] | null;
  deliveries?: WorkbenchDeliveryInput[] | null;
}

export interface OrderWorkbenchStage {
  key: (typeof ORDER_WORKBENCH_STAGES)[number]["key"];
  label: (typeof ORDER_WORKBENCH_STAGES)[number]["label"];
  state: OrderWorkbenchFlowState;
}

export interface OrderWorkbenchViewModel {
  productionRoutes: {
    inHouseDtf: boolean;
    outsource: boolean;
  };
  stageLabel: string | null;
  stages: OrderWorkbenchStage[];
  itemCount: number;
  productCount: number;
  totalQuantity: number;
  printLabels: string[];
  sourceLabels: string[];
  production: {
    targetId: string | null;
    productionCount: number;
    completedSteps: number;
    totalSteps: number;
    percent: number;
    currentStepName: string | null;
    assigneeName: string | null;
  };
  delivery: {
    count: number;
    latestStatus: string | null;
    trackingNumber: string | null;
    carrier: string | null;
  };
}

export type OrderWorkbenchNextStepInput = Parameters<
  typeof buildNextStepInput
>[0];

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

export function deriveOrderWorkbenchProductionRoutes(
  items: WorkbenchItemInput[] | null | undefined,
) {
  const printTypes = new Set(
    (items ?? []).flatMap((item) =>
      (item.prints ?? []).map((print) => print.printType).filter(Boolean),
    ),
  );

  return {
    inHouseDtf: printTypes.has("DTF"),
    outsource: [...printTypes].some((printType) => printType !== "DTF"),
  };
}

function productionRoutesFromSteps(
  productions: WorkbenchProductionInput[] | null | undefined,
) {
  const stepTypes = (productions ?? []).flatMap((production) =>
    (production.steps ?? []).map((step) => step.stepType),
  );
  const inHouseDtf = stepTypes.some((stepType) => laneOf(stepType) === "DTF");
  const outsource = stepTypes.some(isOutsourceStep);

  return inHouseDtf || outsource ? { inHouseDtf, outsource } : null;
}

function flowState(
  status: InternalStatus,
  routes: OrderWorkbenchViewModel["productionRoutes"],
  stageIndex: number,
): OrderWorkbenchFlowState {
  const phase = phaseForStatus(status);
  if (phase < 0) return "unknown";

  if (stageIndex <= 2) {
    if (phase > stageIndex) return "complete";
    if (phase === stageIndex) return "current";
    return "upcoming";
  }

  if (stageIndex === 3 || stageIndex === 4) {
    const hasKnownRoute = routes.inHouseDtf || routes.outsource;
    if (!hasKnownRoute) return "unknown";
    const applies = stageIndex === 3 ? routes.inHouseDtf : routes.outsource;
    if (!applies) return "not-applicable";
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

function stageLabel(
  status: InternalStatus,
  routes: OrderWorkbenchViewModel["productionRoutes"],
) {
  const phase = phaseForStatus(status);
  if (phase === 3) {
    if (routes.inHouseDtf && routes.outsource) return "DTF ภายใน + ร้านนอก";
    if (routes.inHouseDtf) return "DTF ภายใน";
    if (routes.outsource) return "งานร้านนอก";
    return "กำลังผลิต — ยังไม่ระบุเลน";
  }
  if (phase < 0) return null;
  if (phase === 0) return "รับงาน";
  if (phase === 1) return "อาร์ตเวิร์ก";
  if (phase === 2) return "ความพร้อม";
  if (phase === 4) return "QC / แพ็ค";
  return "ส่ง / ปิด";
}

function labelsFor(
  values: (string | null | undefined)[],
  labels: Record<string, string>,
) {
  return [
    ...new Set(
      values
        .filter((value): value is string => Boolean(value))
        .map((value) => labels[value] ?? value),
    ),
  ];
}

function latestDelivery(deliveries: WorkbenchDeliveryInput[]) {
  return deliveries.reduce<WorkbenchDeliveryInput | null>((latest, delivery) => {
    if (!latest) return delivery;
    return new Date(delivery.createdAt).getTime() > new Date(latest.createdAt).getTime()
      ? delivery
      : latest;
  }, null);
}

function productionTargetId(productions: WorkbenchProductionInput[]) {
  const active = productions.filter(
    (production) => production.status !== "COMPLETED",
  );
  if (active.length === 1) return active[0].id;
  if (active.length > 1) return null;
  return productions.length === 1 ? productions[0].id : null;
}

export function buildOrderWorkbenchViewModel(
  order: OrderWorkbenchInput,
): OrderWorkbenchViewModel {
  const items = order.items ?? [];
  const productions = order.productions ?? [];
  const deliveries = order.deliveries ?? [];
  const routes =
    productionRoutesFromSteps(productions) ??
    deriveOrderWorkbenchProductionRoutes(items);
  const steps = productions
    .flatMap((production) => production.steps ?? [])
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const completedSteps = steps.filter((step) => step.status === "COMPLETED").length;
  const currentStep = steps.find((step) => step.status !== "COMPLETED") ?? null;
  const latest = latestDelivery(deliveries);

  return {
    productionRoutes: routes,
    stageLabel: stageLabel(order.internalStatus, routes),
    stages: ORDER_WORKBENCH_STAGES.map((stage, index) => ({
      ...stage,
      state: flowState(order.internalStatus, routes, index),
    })),
    itemCount: items.length,
    productCount: items.reduce(
      (count, item) => count + (item.products?.length ?? 0),
      0,
    ),
    totalQuantity: sumOrderQuantity(items),
    printLabels: labelsFor(
      items.flatMap((item) => (item.prints ?? []).map((print) => print.printType)),
      PRINT_TYPES,
    ),
    sourceLabels: labelsFor(
      items.flatMap((item) =>
        (item.products ?? []).map((product) => product.itemSource),
      ),
      ITEM_SOURCES,
    ),
    production: {
      targetId: productionTargetId(productions),
      productionCount: productions.length,
      completedSteps,
      totalSteps: steps.length,
      percent:
        steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0,
      currentStepName: currentStep
        ? currentStep.customStepName ||
          STEP_TYPE_LABELS[currentStep.stepType] ||
          currentStep.stepType
        : null,
      assigneeName: currentStep?.assignedTo?.name ?? null,
    },
    delivery: {
      count: deliveries.length,
      latestStatus: latest?.status ?? null,
      trackingNumber: latest?.trackingNumber ?? null,
      carrier: latest?.shippingMethod ?? null,
    },
  };
}

export function canonicalOrderActionHref(
  orderId: string,
  action: NextStepAction,
) {
  const base = `/orders/${encodeURIComponent(orderId)}`;

  switch (action.type) {
    case "EDIT_ITEMS":
      return buildOrderEditHref(orderId, {
        tab: "items",
        returnTab: "items",
      });
    case "ANCHOR": {
      const tab = tabForAnchor(action.target);
      return tab ? `${base}?tab=${tab}` : base;
    }
    case "STATUS":
      return base;
    case "NONE":
      return null;
  }
}

export function getOrderWorkbenchNextStep(
  order: OrderWorkbenchNextStepInput,
  options: { canSeeMoney: boolean },
): NextStep | null {
  if (!options.canSeeMoney && order.internalStatus === "SHIPPED") {
    return {
      title: "ตรวจขั้นถัดไปในหน้าปัจจุบัน",
      description: "เปิดหน้ารายละเอียดเพื่อดูงานที่เกี่ยวข้องตามสิทธิ์ของคุณ",
      buttonLabel: "เปิดหน้าปัจจุบัน",
      action: { type: "NONE" },
    };
  }

  return getOrderNextStep(buildNextStepInput(order));
}
