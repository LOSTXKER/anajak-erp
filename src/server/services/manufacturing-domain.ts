import {
  EXCEPTION_TRANSITIONS,
  OPERATION_TRANSITIONS,
  REWORK_TRANSITIONS,
  WORK_ORDER_TRANSITIONS,
  type ManufacturingDependencyState,
  type ManufacturingExceptionState,
  type ManufacturingOperationState,
  type ManufacturingQualityDisposition,
  type ManufacturingQuantityDelta,
  type ManufacturingQuantityTotals,
  type ManufacturingReworkState,
  type ManufacturingWorkOrderState,
} from "@/lib/manufacturing";

export type ManufacturingDomainErrorCode =
  | "INVALID_TRANSITION"
  | "RELEASED_ROUTING_IMMUTABLE"
  | "EMPTY_ROUTING"
  | "UNKNOWN_OPERATION"
  | "DUPLICATE_OPERATION"
  | "DUPLICATE_DEPENDENCY"
  | "SELF_DEPENDENCY"
  | "ROUTING_CYCLE"
  | "INVALID_COMPLETION_FLOW"
  | "INVALID_QUANTITY"
  | "QUANTITY_EXCEEDS_PLAN"
  | "NOT_READY"
  | "REINSPECTION_REQUIRED"
  | "DISPOSITION_REQUIRED"
  | "SCOPE_MISMATCH"
  | "COMMAND_ID_REUSED"
  | "REVISION_CONFLICT";

export class ManufacturingDomainError extends Error {
  constructor(
    readonly code: ManufacturingDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ManufacturingDomainError";
  }
}

function assertTransition<State extends string>(params: {
  entityLabel: string;
  current: State;
  next: State;
  transitions: Readonly<Record<State, readonly State[]>>;
}): void {
  if (params.current === params.next) return;
  if (!params.transitions[params.current].includes(params.next)) {
    throw new ManufacturingDomainError(
      "INVALID_TRANSITION",
      `${params.entityLabel} เปลี่ยนจาก ${params.current} ไป ${params.next} ไม่ได้`,
    );
  }
}

export function assertWorkOrderTransition(
  current: ManufacturingWorkOrderState,
  next: ManufacturingWorkOrderState,
): void {
  assertTransition({
    entityLabel: "ใบผลิต",
    current,
    next,
    transitions: WORK_ORDER_TRANSITIONS,
  });
}

export function assertOperationTransition(
  current: ManufacturingOperationState,
  next: ManufacturingOperationState,
): void {
  assertTransition({
    entityLabel: "งานสถานี",
    current,
    next,
    transitions: OPERATION_TRANSITIONS,
  });
}

export function assertExceptionTransition(
  current: ManufacturingExceptionState,
  next: ManufacturingExceptionState,
): void {
  assertTransition({
    entityLabel: "ปัญหาการผลิต",
    current,
    next,
    transitions: EXCEPTION_TRANSITIONS,
  });
}

export function assertReworkTransition(
  current: ManufacturingReworkState,
  next: ManufacturingReworkState,
): void {
  assertTransition({
    entityLabel: "งานแก้",
    current,
    next,
    transitions: REWORK_TRANSITIONS,
  });
}

export function assertRoutingVersionMutable(state: "DRAFT" | "RELEASED"): void {
  if (state === "RELEASED") {
    throw new ManufacturingDomainError(
      "RELEASED_ROUTING_IMMUTABLE",
      "Routing เวอร์ชันที่ Release แล้วแก้ไม่ได้ ให้สร้างเวอร์ชันร่างใหม่",
    );
  }
}

export function assertCompletionOwnerBelongsToOrder(params: {
  orderId: string;
  ownerProductionOrderId: string;
}): void {
  if (params.orderId !== params.ownerProductionOrderId) {
    throw new ManufacturingDomainError(
      "SCOPE_MISMATCH",
      "ใบผลิตเจ้าของการปิดงานต้องอยู่ในออเดอร์เดียวกัน",
    );
  }
}

export function assertOperationBelongsToProduction(params: {
  productionId: string;
  operationProductionId: string;
}): void {
  if (params.productionId !== params.operationProductionId) {
    throw new ManufacturingDomainError(
      "SCOPE_MISMATCH",
      "งานสถานีต้องอยู่ในใบผลิตเดียวกัน",
    );
  }
}

export interface ManufacturingRoutingDependency {
  predecessorOperationId: string;
  successorOperationId: string;
}

/**
 * Validates a routing DAG and returns a stable topological order. Operations
 * that can run in parallel keep their original order; no fake serial lane is
 * introduced just to make the graph easy to render.
 */
export function validateRoutingGraph(
  operationIds: readonly string[],
  dependencies: readonly ManufacturingRoutingDependency[],
): string[] {
  if (operationIds.length === 0) {
    throw new ManufacturingDomainError("EMPTY_ROUTING", "Routing ต้องมีอย่างน้อยหนึ่งงาน");
  }

  const operationSet = new Set<string>();
  for (const id of operationIds) {
    if (operationSet.has(id)) {
      throw new ManufacturingDomainError("DUPLICATE_OPERATION", `Routing มีงาน ${id} ซ้ำ`);
    }
    operationSet.add(id);
  }

  const successors = new Map(operationIds.map((id) => [id, [] as string[]]));
  const indegree = new Map(operationIds.map((id) => [id, 0]));
  const edgeSet = new Set<string>();

  for (const dependency of dependencies) {
    const { predecessorOperationId: predecessor, successorOperationId: successor } = dependency;
    if (!operationSet.has(predecessor) || !operationSet.has(successor)) {
      throw new ManufacturingDomainError(
        "UNKNOWN_OPERATION",
        `Dependency อ้างงานที่ไม่มีใน Routing: ${predecessor} → ${successor}`,
      );
    }
    if (predecessor === successor) {
      throw new ManufacturingDomainError("SELF_DEPENDENCY", `งาน ${predecessor} รอตัวเองไม่ได้`);
    }
    const key = `${predecessor}\u0000${successor}`;
    if (edgeSet.has(key)) {
      throw new ManufacturingDomainError(
        "DUPLICATE_DEPENDENCY",
        `Dependency ${predecessor} → ${successor} ซ้ำ`,
      );
    }
    edgeSet.add(key);
    successors.get(predecessor)!.push(successor);
    indegree.set(successor, indegree.get(successor)! + 1);
  }

  const sourceIndex = new Map(operationIds.map((id, index) => [id, index]));
  const queue = operationIds.filter((id) => indegree.get(id) === 0);
  const ordered: string[] = [];

  while (queue.length > 0) {
    queue.sort((a, b) => sourceIndex.get(a)! - sourceIndex.get(b)!);
    const current = queue.shift()!;
    ordered.push(current);
    for (const successor of successors.get(current)!) {
      const nextIndegree = indegree.get(successor)! - 1;
      indegree.set(successor, nextIndegree);
      if (nextIndegree === 0) queue.push(successor);
    }
  }

  if (ordered.length !== operationIds.length) {
    const cycleMembers = operationIds.filter((id) => !ordered.includes(id));
    throw new ManufacturingDomainError(
      "ROUTING_CYCLE",
      `Routing มีวงวนระหว่างงาน: ${cycleMembers.join(", ")}`,
    );
  }

  return ordered;
}

export function assertRoutingConvergesToFinalPack(
  operations: readonly { id: string; operationCode: string }[],
  dependencies: readonly ManufacturingRoutingDependency[],
): string {
  validateRoutingGraph(
    operations.map((operation) => operation.id),
    dependencies,
  );

  const finalPackOperations = operations.filter(
    (operation) => operation.operationCode === "FINAL_PACK",
  );
  if (finalPackOperations.length !== 1) {
    throw new ManufacturingDomainError(
      "INVALID_COMPLETION_FLOW",
      "เส้นทางผลิตต้องมีขั้นแพ็กสุดท้ายเพียงหนึ่งขั้น",
    );
  }
  const finalPackId = finalPackOperations[0]!.id;
  const successors = new Map(
    operations.map((operation) => [operation.id, [] as string[]]),
  );
  const predecessors = new Map(
    operations.map((operation) => [operation.id, [] as string[]]),
  );
  for (const dependency of dependencies) {
    successors.get(dependency.predecessorOperationId)!.push(
      dependency.successorOperationId,
    );
    predecessors.get(dependency.successorOperationId)!.push(
      dependency.predecessorOperationId,
    );
  }

  if (successors.get(finalPackId)!.length > 0) {
    throw new ManufacturingDomainError(
      "INVALID_COMPLETION_FLOW",
      "ขั้นแพ็กสุดท้ายต้องเป็นขั้นจบของงาน ห้ามมีงานต่อท้าย",
    );
  }

  const terminalOperations = operations.filter(
    (operation) => successors.get(operation.id)!.length === 0,
  );
  if (
    terminalOperations.length !== 1 ||
    terminalOperations[0]!.id !== finalPackId
  ) {
    throw new ManufacturingDomainError(
      "INVALID_COMPLETION_FLOW",
      "เส้นทางผลิตมีจุดจบมากกว่าหนึ่งจุด ทุกสายต้องรวมที่ขั้นแพ็กสุดท้าย",
    );
  }

  const reachesFinalPack = new Set([finalPackId]);
  const queue = [finalPackId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const predecessor of predecessors.get(current)!) {
      if (reachesFinalPack.has(predecessor)) continue;
      reachesFinalPack.add(predecessor);
      queue.push(predecessor);
    }
  }
  if (operations.some((operation) => !reachesFinalPack.has(operation.id))) {
    throw new ManufacturingDomainError(
      "INVALID_COMPLETION_FLOW",
      "มีบางสายงานที่ไม่ส่งต่อถึงขั้นแพ็กสุดท้าย กรุณาเชื่อมเส้นทางให้ครบ",
    );
  }

  return finalPackId;
}

export interface OperationReadinessResult {
  ready: boolean;
  waitingOnOperationIds: string[];
  blockedByException: boolean;
  executionDisabled: boolean;
}

export function evaluateOperationReadiness(params: {
  state: ManufacturingOperationState;
  executionEnabled: boolean;
  blockingExceptionCount: number;
  predecessors: readonly ManufacturingDependencyState[];
}): OperationReadinessResult {
  const waitingOnOperationIds = params.predecessors
    .filter((dependency) => dependency.state !== "COMPLETED")
    .map((dependency) => dependency.operationId);
  const blockedByException = params.blockingExceptionCount > 0;
  const executionDisabled = !params.executionEnabled;
  const stateCanBecomeReady =
    params.state === "PLANNED" ||
    params.state === "READY" ||
    params.state === "RUNNING" ||
    params.state === "BLOCKED";

  return {
    ready:
      stateCanBecomeReady &&
      !executionDisabled &&
      !blockedByException &&
      waitingOnOperationIds.length === 0,
    waitingOnOperationIds,
    blockedByException,
    executionDisabled,
  };
}

function assertWholeNonNegative(label: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ManufacturingDomainError(
      "INVALID_QUANTITY",
      `${label} ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป`,
    );
  }
}

export function assertQuantityInvariant(quantity: ManufacturingQuantityTotals): void {
  assertWholeNonNegative("จำนวนตามแผน", quantity.qtyPlanned);
  assertWholeNonNegative("จำนวนดี", quantity.qtyGood);
  assertWholeNonNegative("จำนวนเสีย", quantity.qtyScrap);
  assertWholeNonNegative("จำนวนรอแก้", quantity.qtyRework);

  if (quantity.qtyGood > quantity.qtyPlanned) {
    throw new ManufacturingDomainError(
      "QUANTITY_EXCEEDS_PLAN",
      "จำนวนดีเกินจำนวนเป้าหมายตามแผน",
    );
  }
}

export function reportOperationOutput(
  current: ManufacturingQuantityTotals,
  delta: ManufacturingQuantityDelta,
): ManufacturingQuantityTotals {
  assertQuantityInvariant(current);
  assertWholeNonNegative("จำนวนดีที่รายงาน", delta.qtyGood);
  assertWholeNonNegative("จำนวนเสียที่รายงาน", delta.qtyScrap);
  assertWholeNonNegative("จำนวนส่งแก้ที่รายงาน", delta.qtyRework);

  if (delta.qtyGood + delta.qtyScrap + delta.qtyRework === 0) {
    throw new ManufacturingDomainError(
      "INVALID_QUANTITY",
      "ต้องรายงานจำนวนดี เสีย หรือส่งแก้อย่างน้อยหนึ่งรายการ",
    );
  }

  const next = {
    qtyPlanned: current.qtyPlanned,
    qtyGood: current.qtyGood + delta.qtyGood,
    qtyScrap: current.qtyScrap + delta.qtyScrap,
    qtyRework: current.qtyRework + delta.qtyRework,
  };
  assertQuantityInvariant(next);
  return next;
}

export function resolveReworkOutput(params: {
  current: ManufacturingQuantityTotals;
  qtyFromRework: number;
  disposition: "GOOD" | "SCRAP";
}): ManufacturingQuantityTotals {
  assertQuantityInvariant(params.current);
  if (!Number.isSafeInteger(params.qtyFromRework) || params.qtyFromRework <= 0) {
    throw new ManufacturingDomainError(
      "INVALID_QUANTITY",
      "จำนวนผลตรวจซ้ำต้องเป็นจำนวนเต็มมากกว่า 0",
    );
  }
  if (params.qtyFromRework > params.current.qtyRework) {
    throw new ManufacturingDomainError(
      "QUANTITY_EXCEEDS_PLAN",
      "จำนวนผลตรวจซ้ำมากกว่าจำนวนที่รอแก้",
    );
  }

  const next = {
    ...params.current,
    qtyRework: params.current.qtyRework - params.qtyFromRework,
    qtyGood:
      params.current.qtyGood + (params.disposition === "GOOD" ? params.qtyFromRework : 0),
    qtyScrap:
      params.current.qtyScrap + (params.disposition === "SCRAP" ? params.qtyFromRework : 0),
  };
  assertQuantityInvariant(next);
  return next;
}

export function assertOperationCompletable(quantity: ManufacturingQuantityTotals): void {
  assertQuantityInvariant(quantity);
  if (quantity.qtyRework > 0) {
    throw new ManufacturingDomainError(
      "REINSPECTION_REQUIRED",
      "ยังมีงานแก้ที่ต้องตรวจซ้ำก่อนปิดงานสถานี",
    );
  }
  if (quantity.qtyPlanned > 0 && quantity.qtyGood !== quantity.qtyPlanned) {
    throw new ManufacturingDomainError(
      "NOT_READY",
      "จำนวนดียังไม่ครบเป้าหมายตามแผน",
    );
  }
}

/** Only accepted good quantity is allowed to feed successor operations. */
export function forwardableQuantity(quantity: ManufacturingQuantityTotals): number {
  assertQuantityInvariant(quantity);
  return quantity.qtyGood;
}

export function assertPrintRunItemResult(result: {
  qty: number;
  qtyGood: number;
  qtyScrap: number;
  qtyReprint: number;
}): void {
  assertWholeNonNegative("จำนวนเป้าหมายรอบพิมพ์", result.qty);
  assertWholeNonNegative("จำนวนฟิล์มดี", result.qtyGood);
  assertWholeNonNegative("จำนวนฟิล์มเสีย", result.qtyScrap);
  assertWholeNonNegative("จำนวนพิมพ์ซ้ำ", result.qtyReprint);
  if (result.qtyGood > result.qty) {
    throw new ManufacturingDomainError(
      "QUANTITY_EXCEEDS_PLAN",
      "จำนวนฟิล์มดีเกินจำนวนเป้าหมายของงาน",
    );
  }
  if (result.qtyReprint > result.qtyScrap) {
    throw new ManufacturingDomainError(
      "INVALID_QUANTITY",
      "จำนวนพิมพ์ซ้ำต้องไม่เกินจำนวนฟิล์มเสียที่รายงาน",
    );
  }
}

export function assertDefectDisposition(params: {
  qtyDefect: number;
  disposition: ManufacturingQualityDisposition | null | undefined;
}): void {
  assertWholeNonNegative("จำนวนไม่ผ่าน", params.qtyDefect);
  if (params.qtyDefect > 0 && !params.disposition) {
    throw new ManufacturingDomainError(
      "DISPOSITION_REQUIRED",
      "ของที่ไม่ผ่านต้องเลือกพักงาน ส่งแก้ หรือคัดทิ้ง",
    );
  }
}

export function assertReworkCompletion(params: {
  requiresReinspection: boolean;
  reinspectedAt: Date | null;
  reinspectionPassed: boolean | null;
}): void {
  if (
    params.requiresReinspection &&
    (params.reinspectedAt === null || params.reinspectionPassed !== true)
  ) {
    throw new ManufacturingDomainError(
      "REINSPECTION_REQUIRED",
      "งานแก้ต้องผ่านการตรวจซ้ำก่อนปิดเคส",
    );
  }
}
