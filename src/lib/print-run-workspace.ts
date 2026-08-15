export type PrintRunWorkspaceStatus =
  | "PRINTING"
  | "PRINTED"
  | "COMPLETED"
  | "CANCELLED";

export function splitPrintRunsByStage<
  T extends { status: PrintRunWorkspaceStatus },
>(runs: readonly T[]) {
  return {
    printingRuns: runs.filter((run) => run.status === "PRINTING"),
    printedRuns: runs.filter((run) => run.status === "PRINTED"),
    historyRuns: runs.filter(
      (run) => run.status === "COMPLETED" || run.status === "CANCELLED",
    ),
  };
}
