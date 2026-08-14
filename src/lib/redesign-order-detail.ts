import type { InternalStatus } from "@prisma/client";
import { billingOverview, type BillingUiInvoice } from "@/lib/billing-ui";
import {
  getOrderNextStep,
  type NextStep,
  type NextStepAction,
} from "@/lib/order-next-step";
import {
  getRedesignFlowState,
  getRedesignStageLabel,
  type RedesignFlowState,
  type RedesignProductionRoutes,
} from "@/lib/redesign-flow";
import { buildNextStepInput, tabForAnchor } from "@/lib/order-tabs";
import { sumOrderQuantity } from "@/lib/pricing";
import {
  isOutsourceStep,
  laneOf,
  STEP_TYPE_LABELS,
} from "@/lib/production-steps";
import { ITEM_SOURCES, PRINT_TYPES } from "@/types/order-form";
import { buildOrderEditHref } from "@/lib/order-edit-navigation";

export const REDESIGN_ORDER_DETAIL_STAGES = [
  { key: "intake", label: "รับงาน" },
  { key: "artwork", label: "อาร์ตเวิร์ก" },
  { key: "readiness", label: "ความพร้อม" },
  { key: "dtf", label: "DTF ภายใน" },
  { key: "outsource", label: "งานร้านนอก" },
  { key: "qc-pack", label: "QC / แพ็ค" },
  { key: "delivery-close", label: "ส่ง / ปิด" },
] as const;

interface RedesignOrderProductInput {
  itemSource?: string | null;
  variants?: { quantity: number }[] | null;
}

interface RedesignOrderPrintInput {
  printType: string;
}

interface RedesignOrderItemInput {
  products?: RedesignOrderProductInput[] | null;
  prints?: RedesignOrderPrintInput[] | null;
}

interface RedesignProductionStepInput {
  id: string;
  stepType: string;
  customStepName?: string | null;
  status: string;
  sortOrder: number;
  assignedTo?: { name: string } | null;
}

interface RedesignProductionInput {
  id: string;
  status: string;
  steps?: RedesignProductionStepInput[] | null;
}

interface RedesignDeliveryInput {
  status: string;
  shippingMethod: string;
  trackingNumber?: string | null;
  createdAt: Date | string;
}

export interface RedesignOrderDetailInput {
  internalStatus: InternalStatus;
  items?: RedesignOrderItemInput[] | null;
  productions?: RedesignProductionInput[] | null;
  deliveries?: RedesignDeliveryInput[] | null;
}

export interface RedesignOrderStage {
  key: (typeof REDESIGN_ORDER_DETAIL_STAGES)[number]["key"];
  label: (typeof REDESIGN_ORDER_DETAIL_STAGES)[number]["label"];
  state: RedesignFlowState;
}

export interface RedesignOrderDetailViewModel {
  productionRoutes: RedesignProductionRoutes;
  stageLabel: string | null;
  stages: RedesignOrderStage[];
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
  billing: {
    invoiceCount: number;
    openInvoiceCount: number;
    outstanding: number;
  } | null;
}

export interface RedesignOrderDetailOptions {
  canSeeMoney: boolean;
  billingInvoices?: readonly BillingUiInvoice[];
}

export type RedesignOrderNextStepInput = Parameters<
  typeof buildNextStepInput
>[0];

export function deriveRedesignProductionRoutes(
  items: RedesignOrderItemInput[] | null | undefined,
): RedesignProductionRoutes {
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
  productions: RedesignProductionInput[] | null | undefined,
): RedesignProductionRoutes | null {
  const stepTypes = (productions ?? []).flatMap((production) =>
    (production.steps ?? []).map((step) => step.stepType),
  );
  const hasDtf = stepTypes.some((stepType) => laneOf(stepType) === "DTF");
  const hasOutsource = stepTypes.some(isOutsourceStep);

  return hasDtf || hasOutsource
    ? { inHouseDtf: hasDtf, outsource: hasOutsource }
    : null;
}

function labelsFor(
  values: (string | null | undefined)[],
  labels: Record<string, string>,
): string[] {
  return [
    ...new Set(
      values
        .filter((value): value is string => Boolean(value))
        .map((value) => labels[value] ?? value),
    ),
  ];
}

function latestDelivery(
  deliveries: RedesignDeliveryInput[],
): RedesignDeliveryInput | null {
  return deliveries.reduce<RedesignDeliveryInput | null>((latest, delivery) => {
    if (!latest) return delivery;
    return new Date(delivery.createdAt).getTime() > new Date(latest.createdAt).getTime()
      ? delivery
      : latest;
  }, null);
}

function productionTargetId(
  productions: RedesignProductionInput[],
): string | null {
  const active = productions.filter(
    (production) => production.status !== "COMPLETED",
  );
  if (active.length === 1) return active[0].id;
  if (active.length > 1) return null;
  return productions.length === 1 ? productions[0].id : null;
}

export function buildRedesignOrderDetailViewModel(
  order: RedesignOrderDetailInput,
  options: RedesignOrderDetailOptions,
): RedesignOrderDetailViewModel {
  const items = order.items ?? [];
  const productions = order.productions ?? [];
  const deliveries = order.deliveries ?? [];
  const productionRoutes =
    productionRoutesFromSteps(productions) ??
    deriveRedesignProductionRoutes(items);
  const flowOrder = {
    internalStatus: order.internalStatus,
    productionRoutes,
  };
  const steps = productions
    .flatMap((production) => production.steps ?? [])
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const completedSteps = steps.filter((step) => step.status === "COMPLETED").length;
  const currentStep = steps.find((step) => step.status !== "COMPLETED") ?? null;
  const latest = latestDelivery(deliveries);
  const billingOverviewData =
    options.canSeeMoney && options.billingInvoices !== undefined
      ? billingOverview(options.billingInvoices)
      : null;

  return {
    productionRoutes,
    stageLabel: getRedesignStageLabel(flowOrder),
    stages: REDESIGN_ORDER_DETAIL_STAGES.map((stage, index) => ({
      ...stage,
      state: getRedesignFlowState(flowOrder, index),
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
    billing: billingOverviewData
      ? {
          invoiceCount: options.billingInvoices!.filter((invoice) => !invoice.isVoided)
            .length,
          openInvoiceCount: options.billingInvoices!.filter(
            (invoice) => billingOverview([invoice]).totalOutstanding > 0,
          ).length,
          outstanding: billingOverviewData.totalOutstanding,
        }
      : null,
  };
}

export function canonicalOrderActionHref(
  orderId: string,
  action: NextStepAction,
): string | null {
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

export function getRedesignOrderNextStep(
  order: RedesignOrderNextStepInput,
  options: Pick<RedesignOrderDetailOptions, "canSeeMoney">,
): NextStep | null {
  if (!options.canSeeMoney && order.internalStatus === "SHIPPED") {
    return {
      title: "ตรวจขั้นถัดไปในรายละเอียดเต็ม",
      description: "เปิดหน้ารายละเอียดเพื่อดูงานที่เกี่ยวข้องตามสิทธิ์ของคุณ",
      buttonLabel: "เปิดรายละเอียดเต็ม",
      action: { type: "NONE" },
    };
  }

  return getOrderNextStep(buildNextStepInput(order));
}
