import { describe, expect, it } from "vitest";
import { splitPrintRunsByStage } from "./print-run-workspace";

describe("splitPrintRunsByStage", () => {
  it("แยกรอบบนเครื่องออกจากรอบที่รอตัด แม้รายการต้นทางเรียงสลับกัน", () => {
    const grouped = splitPrintRunsByStage([
      { id: "printed-newer", status: "PRINTED" },
      { id: "printing", status: "PRINTING" },
      { id: "completed", status: "COMPLETED" },
      { id: "cancelled", status: "CANCELLED" },
    ] as const);

    expect(grouped.printingRuns.map((run) => run.id)).toEqual(["printing"]);
    expect(grouped.printedRuns.map((run) => run.id)).toEqual(["printed-newer"]);
    expect(grouped.historyRuns.map((run) => run.id)).toEqual([
      "completed",
      "cancelled",
    ]);
  });

  it("รักษาลำดับจาก service ภายในแต่ละช่วง", () => {
    const grouped = splitPrintRunsByStage([
      { id: "printing-new", status: "PRINTING" },
      { id: "printed-new", status: "PRINTED" },
      { id: "printing-old", status: "PRINTING" },
      { id: "printed-old", status: "PRINTED" },
    ] as const);

    expect(grouped.printingRuns.map((run) => run.id)).toEqual([
      "printing-new",
      "printing-old",
    ]);
    expect(grouped.printedRuns.map((run) => run.id)).toEqual([
      "printed-new",
      "printed-old",
    ]);
  });
});
