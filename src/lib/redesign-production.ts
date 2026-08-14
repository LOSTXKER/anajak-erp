import {
  evaluateHeatPressGate,
  LANE_LABELS,
  LANE_ORDER,
  OUTSOURCE_LANES,
  STEP_TYPE_LABELS,
  laneOf,
  type ProductionLane,
} from "@/lib/production-steps";

type DateLike = Date | string | null;

export type RedesignProductionStepInput = {
  id: string;
  stepType: string;
  customStepName?: string | null;
  status: string;
  sortOrder: number;
  assignedTo?: { id: string; name: string } | null;
};

export type RedesignProductionRunInput = {
  id: string;
  status: string;
  steps: readonly RedesignProductionStepInput[];
};

export type RedesignReadinessCheckInput = {
  label: string;
  ok: boolean;
  waitingOn?: string | null;
  detail?: string | null;
};

export type RedesignProductionOrderInput = {
  id: string;
  orderNumber: string;
  title: string;
  deadline: DateLike;
  priority?: string | null;
  internalStatus: string;
  blindShip?: boolean;
  customerName?: string | null;
  totalQuantity?: number;
  productions: readonly RedesignProductionRunInput[];
  readiness?: {
    ready: boolean;
    checks: readonly RedesignReadinessCheckInput[];
  } | null;
};

export type RedesignProductionCard = {
  key: string;
  sectionKey: string;
  sectionLabel: string;
  sectionKind: "lane" | "post";
  orderId: string;
  orderNumber: string;
  title: string;
  customerName: string | null;
  deadline: DateLike;
  priority: string | null;
  totalQuantity: number;
  blindShip: boolean;
  productionId: string | null;
  stepId: string | null;
  stepName: string;
  stepStatus: string | null;
  assignedTo: string | null;
  completedSteps: number;
  totalSteps: number;
  overdue: boolean;
  dueSoon: boolean;
  workbenchHref: string;
  actionHref: string;
};

export type RedesignProductionQueueItem = {
  orderId: string;
  orderNumber: string;
  title: string;
  customerName: string | null;
  deadline: DateLike;
  priority: string | null;
  totalQuantity: number;
  workbenchHref: string;
  createHref: string;
  blockers: string[];
  waitingOn: string[];
};

export type RedesignProductionException = {
  orderId: string;
  orderNumber: string;
  title: string;
  customerName: string | null;
  deadline: DateLike;
  priority: string | null;
  reasons: Array<{
    kind: "failed" | "overdue" | "blocked";
    label: string;
    tone: "danger" | "warning";
  }>;
  waitingOn: string[];
  workbenchHref: string;
  actionHref: string;
};

export type RedesignProductionLaneSummary = {
  key: string;
  label: string;
  kind: "lane" | "post";
  count: number;
  overdue: number;
  isOutsource: boolean;
};

export type RedesignProductionMyWork = {
  key: string;
  orderId: string;
  orderNumber: string;
  productionId: string;
  stepId: string;
  stepName: string;
  status: string;
  actionHref: string;
};

export type RedesignProductionModel = {
  totalOrders: number;
  capReached: boolean;
  exceptions: RedesignProductionException[];
  readyQueue: RedesignProductionQueueItem[];
  blockedQueue: RedesignProductionQueueItem[];
  lanes: RedesignProductionLaneSummary[];
  cards: RedesignProductionCard[];
  myWork: RedesignProductionMyWork[];
};

const POST_SECTIONS = [
  {
    key: "post:QUALITY_CHECK",
    label: "ตรวจคุณภาพ",
    status: "QUALITY_CHECK",
    stepName: "ตรวจนับ QC",
    tab: "production",
  },
  {
    key: "post:PACKING",
    label: "กำลังแพ็ค",
    status: "PACKING",
    stepName: "แพ็คสินค้า",
    tab: "production",
  },
  {
    key: "post:READY_TO_SHIP",
    label: "พร้อมจัดส่ง",
    status: "READY_TO_SHIP",
    stepName: "จัดส่งสินค้า",
    tab: "delivery",
  },
] as const;

const QUEUE_STATUSES = new Set([
  "CONFIRMED",
  "DESIGN_APPROVED",
  "PRODUCTION_QUEUE",
]);

const PRIORITY_RANK: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

function encoded(value: string) {
  return encodeURIComponent(value);
}

function workbenchHref(orderId: string) {
  return `/redesign/orders/${encoded(orderId)}`;
}

function canonicalOrderProductionHref(orderId: string) {
  return `/orders/${encoded(orderId)}?tab=production`;
}

function exceptionActionHref(order: RedesignProductionOrderInput) {
  if (order.internalStatus === "READY_TO_SHIP") {
    return `/orders/${encoded(order.id)}?tab=delivery`;
  }
  if (
    order.internalStatus === "QUALITY_CHECK" ||
    order.internalStatus === "PACKING"
  ) {
    return canonicalOrderProductionHref(order.id);
  }
  return redesignProductionActionHref(order);
}

export function selectRedesignProductionTarget(
  productions: readonly Pick<RedesignProductionRunInput, "id" | "status">[],
): string | null {
  const active = productions.filter(
    (production) => production.status !== "COMPLETED",
  );
  if (active.length === 1) return active[0]?.id ?? null;
  return null;
}

export function redesignProductionActionHref(
  order: Pick<RedesignProductionOrderInput, "id" | "productions">,
): string {
  const productionId = selectRedesignProductionTarget(order.productions);
  return productionId
    ? `/production/${encoded(productionId)}`
    : canonicalOrderProductionHref(order.id);
}

function timeOf(value: DateLike): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function urgency(deadline: DateLike, now: number) {
  const due = timeOf(deadline);
  if (due == null) return { overdue: false, dueSoon: false };
  return {
    overdue: due < now,
    dueSoon: due >= now && due <= now + 48 * 60 * 60 * 1000,
  };
}

function orderSort(
  a: Pick<RedesignProductionOrderInput, "deadline" | "priority">,
  b: Pick<RedesignProductionOrderInput, "deadline" | "priority">,
) {
  const aDeadline = timeOf(a.deadline) ?? Number.MAX_SAFE_INTEGER;
  const bDeadline = timeOf(b.deadline) ?? Number.MAX_SAFE_INTEGER;
  if (aDeadline !== bDeadline) return aDeadline - bDeadline;
  return (
    (PRIORITY_RANK[a.priority ?? "NORMAL"] ?? 2) -
    (PRIORITY_RANK[b.priority ?? "NORMAL"] ?? 2)
  );
}

function identity(order: RedesignProductionOrderInput) {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    title: order.title,
    customerName: order.customerName ?? null,
    deadline: order.deadline,
    priority: order.priority ?? null,
  };
}

function queueItem(order: RedesignProductionOrderInput) {
  const failing = (order.readiness?.checks ?? []).filter(
    (check) => !check.ok,
  );
  return {
    ...identity(order),
    totalQuantity: order.totalQuantity ?? 0,
    workbenchHref: workbenchHref(order.id),
    createHref: `/production?create=${encoded(order.id)}`,
    blockers: [...new Set(failing.map((check) => check.label))],
    waitingOn: [
      ...new Set(
        failing
          .map((check) => check.waitingOn)
          .filter((value): value is string => Boolean(value)),
      ),
    ],
  } satisfies RedesignProductionQueueItem;
}

function exceptionRank(exception: RedesignProductionException) {
  if (exception.reasons.some((reason) => reason.kind === "failed")) return 0;
  if (exception.reasons.some((reason) => reason.kind === "overdue")) return 1;
  return 2;
}

export function buildRedesignProductionModel(
  orders: readonly RedesignProductionOrderInput[],
  options: {
    viewerId?: string | null;
    showBlocked: boolean;
    now: Date | string;
  },
): RedesignProductionModel {
  const now = new Date(options.now).getTime();
  const nowMs = Number.isNaN(now) ? 0 : now;
  const sortedOrders = [...orders].sort(orderSort);
  const queueOrders = sortedOrders.filter(
    (order) =>
      QUEUE_STATUSES.has(order.internalStatus) ||
      (order.internalStatus === "PRODUCING" && order.productions.length === 0),
  );
  const readyQueue = queueOrders
    .filter((order) => order.readiness?.ready !== false)
    .map(queueItem);
  const blockedQueue = options.showBlocked
    ? queueOrders
        .filter((order) => order.readiness?.ready === false)
        .map(queueItem)
    : [];
  const hiddenBlockedOrderIds = options.showBlocked
    ? new Set<string>()
    : new Set(
        queueOrders
          .filter((order) => order.readiness?.ready === false)
          .map((order) => order.id),
      );

  const cards: RedesignProductionCard[] = [];
  const myWork: RedesignProductionMyWork[] = [];
  const blockedPressByOrder = new Map<string, string[]>();

  for (const order of sortedOrders) {
    if (order.internalStatus !== "PRODUCING") continue;
    const orderUrgency = urgency(order.deadline, nowMs);
    for (const production of order.productions) {
      const steps = [...production.steps].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      const pressGate = evaluateHeatPressGate(steps);
      const byLane = new Map<ProductionLane, RedesignProductionStepInput[]>();
      for (const step of steps) {
        const lane = laneOf(step.stepType);
        const laneSteps = byLane.get(lane) ?? [];
        laneSteps.push(step);
        byLane.set(lane, laneSteps);

        if (
          options.viewerId &&
          step.assignedTo?.id === options.viewerId &&
          step.status !== "COMPLETED" &&
          !(
            step.stepType === "HEAT_PRESS" &&
            !pressGate.ready &&
            step.status !== "FAILED"
          )
        ) {
          myWork.push({
            key: step.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            productionId: production.id,
            stepId: step.id,
            stepName:
              step.customStepName ||
              STEP_TYPE_LABELS[step.stepType] ||
              step.stepType,
            status: step.status,
            actionHref: `/production/${encoded(production.id)}`,
          });
        }
      }

      const nonPackDone = steps
        .filter((step) => laneOf(step.stepType) !== "PACK")
        .every((step) => step.status === "COMPLETED");

      for (const [lane, laneSteps] of byLane) {
        const pending = laneSteps.filter((step) => step.status !== "COMPLETED");
        if (pending.length === 0 || (lane === "PACK" && !nonPackDone)) continue;
        const current = pending[0];
        if (!current) continue;
        if (
          current.stepType === "HEAT_PRESS" &&
          !pressGate.ready &&
          current.status !== "FAILED"
        ) {
          blockedPressByOrder.set(order.id, [
            ...new Set([
              ...(blockedPressByOrder.get(order.id) ?? []),
              ...pressGate.waitingOn,
            ]),
          ]);
          continue;
        }
        cards.push({
          key: `${production.id}:${lane}`,
          sectionKey: `lane:${lane}`,
          sectionLabel: LANE_LABELS[lane],
          sectionKind: "lane",
          ...identity(order),
          totalQuantity: order.totalQuantity ?? 0,
          blindShip: Boolean(order.blindShip),
          productionId: production.id,
          stepId: current.id,
          stepName:
            current.customStepName ||
            STEP_TYPE_LABELS[current.stepType] ||
            current.stepType,
          stepStatus: current.status,
          assignedTo: current.assignedTo?.name ?? null,
          completedSteps: laneSteps.length - pending.length,
          totalSteps: laneSteps.length,
          ...orderUrgency,
          workbenchHref: workbenchHref(order.id),
          actionHref: `/production/${encoded(production.id)}`,
        });
      }
    }
  }

  for (const section of POST_SECTIONS) {
    for (const order of sortedOrders.filter(
      (candidate) => candidate.internalStatus === section.status,
    )) {
      const orderUrgency = urgency(order.deadline, nowMs);
      cards.push({
        key: `${section.key}:${order.id}`,
        sectionKey: section.key,
        sectionLabel: section.label,
        sectionKind: "post",
        ...identity(order),
        totalQuantity: order.totalQuantity ?? 0,
        blindShip: Boolean(order.blindShip),
        productionId: selectRedesignProductionTarget(order.productions),
        stepId: null,
        stepName: section.stepName,
        stepStatus: null,
        assignedTo: null,
        completedSteps: 0,
        totalSteps: 0,
        ...orderUrgency,
        workbenchHref: workbenchHref(order.id),
        actionHref: `/orders/${encoded(order.id)}?tab=${section.tab}`,
      });
    }
  }

  cards.sort((a, b) => orderSort(a, b));

  const exceptionMap = new Map<string, RedesignProductionException>();
  const ensureException = (order: RedesignProductionOrderInput) => {
    let current = exceptionMap.get(order.id);
    if (!current) {
      current = {
        ...identity(order),
        reasons: [],
        waitingOn: [],
        workbenchHref: workbenchHref(order.id),
        actionHref: exceptionActionHref(order),
      };
      exceptionMap.set(order.id, current);
    }
    return current;
  };

  for (const order of sortedOrders) {
    if (hiddenBlockedOrderIds.has(order.id)) continue;
    const failed = order.productions.some((production) =>
      production.steps.some((step) => step.status === "FAILED"),
    );
    if (failed) {
      ensureException(order).reasons.push({
        kind: "failed",
        label: "มีขั้นตอนล้มเหลว",
        tone: "danger",
      });
    }
    if (urgency(order.deadline, nowMs).overdue) {
      ensureException(order).reasons.push({
        kind: "overdue",
        label: "เลยกำหนด",
        tone: "danger",
      });
    }
    const pressWaiting = blockedPressByOrder.get(order.id);
    if (pressWaiting?.length) {
      const current = ensureException(order);
      current.reasons.push({
        kind: "blocked",
        label: "รีดร้อนยังไม่พร้อม",
        tone: "warning",
      });
      current.waitingOn = [
        ...new Set([...current.waitingOn, ...pressWaiting]),
      ];
    }
  }

  if (options.showBlocked) {
    for (const order of queueOrders.filter(
      (candidate) => candidate.readiness?.ready === false,
    )) {
      const current = ensureException(order);
      const failing = (order.readiness?.checks ?? []).filter(
        (check) => !check.ok,
      );
      for (const check of failing) {
        if (
          !current.reasons.some(
            (reason) =>
              reason.kind === "blocked" && reason.label === check.label,
          )
        ) {
          current.reasons.push({
            kind: "blocked",
            label: check.label,
            tone: "warning",
          });
        }
        if (check.waitingOn) current.waitingOn.push(check.waitingOn);
      }
      current.waitingOn = [...new Set(current.waitingOn)];
      current.actionHref = current.workbenchHref;
    }
  }

  const exceptions = [...exceptionMap.values()]
    .filter((exception) => exception.reasons.length > 0)
    .sort((a, b) => {
      const severity = exceptionRank(a) - exceptionRank(b);
      return severity || orderSort(a, b);
    });

  const laneSummaries: RedesignProductionLaneSummary[] = LANE_ORDER.flatMap(
    (lane) => {
      const laneCards = cards.filter(
        (card) => card.sectionKey === `lane:${lane}`,
      );
      return laneCards.length > 0
        ? [
            {
              key: `lane:${lane}`,
              label: LANE_LABELS[lane],
              kind: "lane" as const,
              count: laneCards.length,
              overdue: laneCards.filter((card) => card.overdue).length,
              isOutsource: OUTSOURCE_LANES.has(lane),
            },
          ]
        : [];
    },
  );
  const postSummaries = POST_SECTIONS.map((section) => {
    const sectionCards = cards.filter(
      (card) => card.sectionKey === section.key,
    );
    return {
      key: section.key,
      label: section.label,
      kind: "post" as const,
      count: sectionCards.length,
      overdue: sectionCards.filter((card) => card.overdue).length,
      isOutsource: false,
    };
  });

  return {
    totalOrders: orders.length,
    capReached: orders.length >= 200,
    exceptions,
    readyQueue,
    blockedQueue,
    lanes: [...laneSummaries, ...postSummaries],
    cards,
    myWork,
  };
}
