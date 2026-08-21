import type { FactoryStationKey } from "@/lib/factory-station";

export type StationContinuationSelection = {
  productionId?: string | null;
  orderId?: string | null;
};

export type StationContinuationEntry = {
  station: FactoryStationKey;
  orderId: string;
  productionId: string | null;
  stepId: string | null;
  status: "active" | "ready" | "blocked";
  sortOrder: number | null;
};

export type StationContinuationResult<
  T extends StationContinuationEntry = StationContinuationEntry,
> = {
  primary: T;
  alternatives: T[];
  alternativeCount: number;
};

type ResolveStationContinuationInput<T extends StationContinuationEntry> = {
  currentStation: FactoryStationKey;
  selection: StationContinuationSelection;
  productionOrderId?: string | null;
  entries: readonly T[];
};

const STATUS_RANK: Record<StationContinuationEntry["status"], number> = {
  active: 0,
  ready: 1,
  blocked: 2,
};

const STATION_RANK: Record<FactoryStationKey, number> = {
  prep: 0,
  "dtf-print": 1,
  "heat-press": 2,
  qc: 3,
  "final-pack": 4,
};

function compareNullableSortOrder(
  left: StationContinuationEntry,
  right: StationContinuationEntry,
): number {
  if (left.sortOrder === null && right.sortOrder === null) return 0;
  if (left.sortOrder === null) return 1;
  if (right.sortOrder === null) return -1;
  return left.sortOrder - right.sortOrder;
}

function compareStableId(left: string | null, right: string | null): number {
  return (left ?? "").localeCompare(right ?? "");
}

function compareContinuationEntries(
  left: StationContinuationEntry,
  right: StationContinuationEntry,
): number {
  const byStatus = STATUS_RANK[left.status] - STATUS_RANK[right.status];
  if (byStatus !== 0) return byStatus;

  const bySortOrder = compareNullableSortOrder(left, right);
  if (bySortOrder !== 0) return bySortOrder;

  const byStation = STATION_RANK[left.station] - STATION_RANK[right.station];
  if (byStation !== 0) return byStation;

  const byOrderId = left.orderId.localeCompare(right.orderId);
  if (byOrderId !== 0) return byOrderId;

  const byProductionId = compareStableId(left.productionId, right.productionId);
  if (byProductionId !== 0) return byProductionId;

  return compareStableId(left.stepId, right.stepId);
}

function matchesSelection(
  entry: StationContinuationEntry,
  selection: StationContinuationSelection,
): boolean {
  if (selection.productionId) return entry.productionId === selection.productionId;
  if (selection.orderId) return entry.orderId === selection.orderId;
  return false;
}

function contextKey(entry: StationContinuationEntry): string {
  return JSON.stringify([
    entry.station,
    entry.orderId,
    entry.productionId,
    entry.stepId,
  ]);
}

function sortAndDeduplicate<T extends StationContinuationEntry>(
  entries: readonly T[],
): T[] {
  const sorted = [...entries].sort(compareContinuationEntries);
  const seen = new Set<string>();

  return sorted.filter((entry) => {
    const key = contextKey(entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveStationContinuation<T extends StationContinuationEntry>({
  currentStation,
  selection,
  productionOrderId = null,
  entries,
}: ResolveStationContinuationInput<T>): StationContinuationResult<T> | null {
  if (
    entries.some(
      (entry) => entry.station === currentStation && matchesSelection(entry, selection),
    )
  ) {
    return null;
  }

  let candidates: readonly T[] = [];

  if (selection.productionId) {
    candidates = entries.filter(
      (entry) => entry.productionId === selection.productionId,
    );
  }

  // productionId เป็น context ที่เฉพาะกว่าเสมอ: deep link ที่มี orderId เก่าหรือ
  // ผิดออเดอร์ต้องไม่พาใบผลิตหนึ่งข้ามไปทำงานของอีกออเดอร์.
  const effectiveOrderId = selection.productionId
    ? productionOrderId
    : selection.orderId;
  if (candidates.length === 0 && effectiveOrderId) {
    candidates = entries.filter((entry) => entry.orderId === effectiveOrderId);
  }

  const uniqueCandidates = sortAndDeduplicate(candidates);
  const primary = uniqueCandidates[0];
  if (!primary) return null;

  return {
    primary,
    alternatives: uniqueCandidates.slice(1),
    alternativeCount: uniqueCandidates.length - 1,
  };
}
