export const FACTORY_STATION_KEYS = [
  "prep",
  "dtf-print",
  "heat-press",
  "qc",
  "final-pack",
] as const;

export type FactoryStationKey = (typeof FACTORY_STATION_KEYS)[number];

export type FactoryStationDefinition = {
  key: FactoryStationKey;
  label: string;
};

export const FACTORY_STATIONS: readonly FactoryStationDefinition[] = [
  { key: "prep", label: "เตรียมเสื้อ" },
  { key: "dtf-print", label: "พิมพ์ DTF" },
  { key: "heat-press", label: "รีดร้อน" },
  { key: "qc", label: "QC" },
  { key: "final-pack", label: "แพ็กสุดท้าย" },
];

const FACTORY_STATION_KEY_SET = new Set<string>(FACTORY_STATION_KEYS);

export function isFactoryStationKey(value: string): value is FactoryStationKey {
  return FACTORY_STATION_KEY_SET.has(value);
}

export function factoryStationKeyForStep(stepType: string): FactoryStationKey | null {
  switch (stepType) {
    case "GARMENT_PICK":
    case "GARMENT_RECEIVE":
      return "prep";
    case "DTF_PRINT":
      return "dtf-print";
    case "HEAT_PRESS":
      return "heat-press";
    default:
      return null;
  }
}

export function factoryStationKeyForOrderStatus(
  internalStatus: string,
): FactoryStationKey | null {
  if (internalStatus === "QUALITY_CHECK") return "qc";
  if (internalStatus === "PACKING") return "final-pack";
  return null;
}

export type FactoryStationQueueEntry = {
  key: string;
  station: FactoryStationKey;
  orderId: string;
  productionId: string | null;
  stepId: string | null;
  orderNumber: string;
  deadline: Date | string | null;
  priority?: string | null;
  status: string;
  qtyDone?: number | null;
  qtyTotal?: number | null;
};

export type FactoryStationQueue<T extends FactoryStationQueueEntry> = {
  station: FactoryStationKey;
  active: T[];
  ready: T[];
  blocked: T[];
};

const PRIORITY_RANK: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

function deadlineTime(value: Date | string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function compareQueueEntries(
  left: FactoryStationQueueEntry,
  right: FactoryStationQueueEntry,
): number {
  const leftDeadline = deadlineTime(left.deadline);
  const rightDeadline = deadlineTime(right.deadline);
  if (leftDeadline !== rightDeadline) return leftDeadline - rightDeadline;

  const byPriority =
    (PRIORITY_RANK[left.priority ?? "NORMAL"] ?? PRIORITY_RANK.NORMAL) -
    (PRIORITY_RANK[right.priority ?? "NORMAL"] ?? PRIORITY_RANK.NORMAL);
  if (byPriority !== 0) return byPriority;
  return left.orderNumber.localeCompare(right.orderNumber);
}

export function buildFactoryStationQueue<T extends FactoryStationQueueEntry>(
  station: FactoryStationKey,
  entries: readonly T[],
): FactoryStationQueue<T> {
  const active: T[] = [];
  const ready: T[] = [];
  const blocked: T[] = [];

  for (const entry of entries) {
    if (entry.station !== station) continue;
    if (entry.status === "IN_PROGRESS") active.push(entry);
    else if (entry.status === "PENDING") ready.push(entry);
    else if (entry.status === "ON_HOLD" || entry.status === "FAILED") blocked.push(entry);
  }

  active.sort(compareQueueEntries);
  ready.sort(compareQueueEntries);
  blocked.sort(compareQueueEntries);
  return { station, active, ready, blocked };
}
