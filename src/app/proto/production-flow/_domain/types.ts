/**
 * Prototype read contract over the existing V2 vocabulary (see prisma/schema.prisma).
 * These are simulation IDs and DTOs, not wire-compatible database records:
 * - FlowOrder.id -> Order.id; workOrders[].id/number -> Production.id/workOrderNumber.
 * - FlowOperation -> ProductionStep (operationCode/state, workCenter, assignment).
 * - predecessorIds -> OperationJobDependency; recipe identity -> RoutingVersion snapshot.
 * - QuantityScope -> OrderItem/OrderItemVariant plus OperationQuantity source references;
 *   a real adapter must resolve the parent OrderItemProduct and exact print IDs.
 * - films -> PrintRun/PrintRunItem results allocated to OperationQuantity print scopes.
 * - history -> OperationEvent + payload; processedCommands -> ManufacturingCommand.
 * - defect source/repair/reinspection -> QcDefect + ReworkCase and its source operation.
 * GarmentLot lineage/custody, per-scope partial transfer, mixed vendor receipt/QC,
 * and conditional recipe expansion are PROPOSED semantics, not current V2 features.
 * FlowState.revision is one simulation revision; production commands must keep the
 * existing per-operation/quantity revisions, locks, transactions, and idempotency.
 * No adapter in this folder reads or writes the database or calls production APIs.
 */
export type FlowRole = "supervisor" | "worker" | "viewer";
export interface FlowActor { id: string; name: string }
export const DEFAULT_ACTORS: Record<FlowRole, FlowActor> = {
  supervisor: { id: "supervisor-1", name: "หัวหน้าเบส" },
  worker: { id: "worker-1", name: "ช่างหนึ่ง" },
  viewer: { id: "viewer-1", name: "ผู้ดูงาน" },
};
export type FlowValue = string | number | boolean;
export interface ActionField {
  key: string; label: string; type: "number" | "select" | "text" | "textarea";
  required?: boolean; min?: number; max?: number; defaultValue?: FlowValue;
  options?: { value: string; label: string }[]; hint?: string;
}
export interface FlowAction {
  id: string; label: string; description: string; kind: string;
  operationId?: string; lotId?: string; scopeKey?: string;
  fields: ActionField[]; enabled: boolean; disabledReason?: string;
  primary?: boolean; supervisorOnly?: boolean;
}
export interface FlowCommand {
  commandId: string; expectedRevision: number; role: FlowRole; actor: FlowActor;
  actionId: string; values?: Record<string, FlowValue>;
}
export interface CommandResult { state: FlowState; error?: string; duplicate?: boolean }

export interface QuantityScope {
  key: string; itemId: string; variantId: string; product: string;
  color: string; size: string; orderedQty: number;
  source: "stock" | "customer" | "cutsew";
  prints: { id: string; label: string; technique: "DTF" | "EMBROIDERY" | "SCREEN"; artworkVersion: string }[];
}
export type OperationKind = "prepare" | "film" | "press" | "vendor" | "qc" | "pack" | "manual";
export interface FlowOperation {
  id: string; orderId: string; workOrderId: string; name: string; kind: OperationKind;
  station: string; sequence: number; scopeKeys: string[]; predecessorIds: string[];
  printIds: string[]; assignedTo: FlowActor | null; vendor?: string;
  machineDown?: boolean; outsourced?: boolean; issue?: string;
  standards: { id: string; label: string }[];
}
export interface FlowOrder {
  id: string; number: string; customer: string; dueAt: string; owner: string;
  scopes: QuantityScope[]; workOrders: { id: string; number: string }[];
  unknown?: boolean; released?: boolean;
}
export type LotCondition = "available" | "vendor" | "inspection" | "rework" | "waste" | "packed";
export interface GarmentLot {
  id: string; orderId: string; scopeKey: string; qty: number; parentLotId?: string;
  rootLotId: string; source: "original" | "replacement";
  custody: { kind: "factory" | "vendor" | "transit"; name: string };
  condition: LotCondition; currentOperationId: string;
  completedOperationIds: string[]; needsReinspection?: boolean;
  reworkOfOperationId?: string; reworkPlanned?: boolean; resultOperationId?: string; returnedFromVendor?: string; defectReason?: string;
}
export interface FilmSupply {
  id: string; orderId: string; operationId: string; scopeKey: string;
  printId: string; artworkVersion: string; producedQty: number; availableQty: number; wasteQty: number;
}
export interface FlowHistoryEntry {
  id: string; orderId: string; operationId?: string; lotId?: string;
  title: string; detail: string; actor: string; at: string; commandId?: string;
}
export interface FlowState {
  revision: number; clock: string; orders: FlowOrder[]; operations: FlowOperation[];
  lots: GarmentLot[]; films: FilmSupply[]; history: FlowHistoryEntry[];
  processedCommands: Record<string, string>;
}

export interface QuantityLineView {
  scopeKey: string; product: string; color: string; size: string; printLabel: string;
  planned: number; ready: number; good: number; rework: number; waste: number;
  waiting: number; atVendor: number; awaitingInspection: number;
}
export interface LotView {
  id: string; parentLotId?: string; scopeKey: string; label: string;
  qty: number; product: string; color: string; size: string; location: string;
  condition: LotCondition; conditionLabel: string; operationId: string;
  completedOperations: string[]; source: "original" | "replacement";
  actions: FlowAction[]; defectReason?: string;
}
export interface OperationView {
  id: string; workOrderId: string; name: string; kind: OperationKind; station: string;
  state: "ready" | "waiting" | "working" | "vendor" | "inspection" | "done" | "problem";
  statusLabel: string; summary: string; sequence: number; assignedTo: FlowActor | null;
  predecessorIds: string[]; waitingOn: string[]; blockers: string[]; issue?: string;
  qtyPlanned: number; qtyReady: number; qtyGood: number; qtyWaste: number; qtyRework: number;
  qtyAtVendor: number; qtyAwaitingInspection: number;
  lines: QuantityLineView[]; lots: LotView[]; actions: FlowAction[];
  standards: { id: string; label: string }[];
}
export interface OrderMetrics {
  ordered: number; received: number; ready: number; good: number; packed: number;
  rework: number; waste: number; atVendor: number; awaitingInspection: number; missing: number;
}
export interface OrderView {
  id: string; number: string; customer: string; dueAt: string; owner: string;
  status: "ready" | "working" | "waiting" | "problem" | "packed" | "unknown";
  statusLabel: string; summary: string; nextAction: string; blockers: string[];
  totalQty: number; goodQty: number; packedQty: number; reworkQty: number; wasteQty: number;
  missingQty: number; metrics: OrderMetrics; operations: OperationView[];
  lots: LotView[]; history: FlowHistoryEntry[]; actions: FlowAction[];
  workOrders: { id: string; number: string }[]; unknown: boolean;
}
export interface Scenario {
  id: string; title: string; description: string; focusOrderId: string;
  createState: () => FlowState;
}
