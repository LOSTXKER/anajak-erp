export const STATION_COMMANDS = [
  "assignOperation",
  "resequenceOperation",
  "startOperation",
  "pauseOperation",
  "reportOutput",
  "completeOperation",
  "raiseException",
  "recordPrep",
  "manageDtfBatch",
  "recordQuality",
  "reinspectQuality",
  "manageOutsource",
] as const;

export type StationCommand = (typeof STATION_COMMANDS)[number];

const LEGACY_STATION_TO_WORK_CENTER: Record<string, string> = {
  prep: "PREP",
  "dtf-print": "DTF_PRINT",
  "heat-press": "HEAT_PRESS",
  qc: "FINAL_QC",
  "final-pack": "FINAL_PACK",
  outsource: "OUTSOURCE",
};

export function workCenterCodeFromStationParam(value: string | null): string | null {
  if (!value) return null;
  return LEGACY_STATION_TO_WORK_CENTER[value] ?? value.toUpperCase();
}

export function remainingGoodQuantity(planned: number, good: number): number {
  return Math.max(0, planned - good);
}

export function primaryStationCommand(input: {
  state: string;
  remaining: number;
  availableCommands: readonly string[];
}): StationCommand | null {
  const available = new Set(input.availableCommands);

  if (
    input.state === "RUNNING" &&
    input.remaining === 0 &&
    available.has("completeOperation")
  ) {
    return "completeOperation";
  }

  for (const specialized of [
    "recordPrep",
    "manageDtfBatch",
    "reinspectQuality",
    "recordQuality",
    "manageOutsource",
  ] as const) {
    if (available.has(specialized)) return specialized;
  }

  if (input.state === "READY" && available.has("startOperation")) {
    return "startOperation";
  }
  if (input.state === "RUNNING") {
    if (available.has("reportOutput")) return "reportOutput";
  }
  return null;
}

type SameOrderCandidate = {
  id: string;
  state: string;
  order: { id: string };
  quantities: { remaining: number };
  availableCommands: readonly string[];
};

const HANDOFF_STATE_RANK: Record<string, number> = {
  RUNNING: 0,
  READY: 1,
};

export function nextSameOrderJob<T extends SameOrderCandidate>(
  jobs: readonly T[],
  orderId: string,
  completedOperationId: string,
): T | null {
  return (
    jobs
      .filter(
        (job) =>
          job.order.id === orderId &&
          job.id !== completedOperationId &&
          primaryStationCommand({
            state: job.state,
            remaining: job.quantities.remaining,
            availableCommands: job.availableCommands,
          }) !== null,
      )
      .sort(
        (left, right) =>
          (HANDOFF_STATE_RANK[left.state] ?? 9) -
          (HANDOFF_STATE_RANK[right.state] ?? 9),
      )[0] ?? null
  );
}
