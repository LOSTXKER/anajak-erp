import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stationModeSource = readFileSync(
  "src/components/factory/station-mode-screen.tsx",
  "utf8",
);
const goodsReceiptSource = readFileSync(
  "src/components/goods-receipt/goods-receipt-dialog.tsx",
  "utf8",
);
const printRunsSource = readFileSync(
  "src/components/production/print-runs-screen.tsx",
  "utf8",
);

describe("Station continuation UI contract", () => {
  it("เสนอจุดทำงานถัดไปของออเดอร์เดิมโดยไม่เริ่มงานอัตโนมัติ", () => {
    expect(stationModeSource).toContain("resolveStationContinuation({");
    expect(stationModeSource).toContain("FACTORY_STATIONS.flatMap");
    expect(stationModeSource).toContain("trpc.factory.stationQueueContext.useQuery");
    expect(stationModeSource).toContain("stationQueueContextQuery.refetch()");
    expect(stationModeSource).toContain("data-station-continuation");
    expect(stationModeSource).toContain("ยังไม่เริ่มหรือปิดขั้นให้อัตโนมัติ");
    expect(stationModeSource).toContain("router.replace(");
    expect(stationModeSource).toContain('item.station === "dtf-print"');
    expect(stationModeSource).toContain("opensDtfBatch ? null : item.productionId");
    expect(stationModeSource).toContain("focusStepId: item.stepId");
    expect(stationModeSource).toContain("continuation.alternatives.slice(0, 3)");
    expect(stationModeSource).toContain("data-station-continuation-unavailable");
    expect(stationModeSource).toContain("ระบบจึงไม่เลือกสถานีแทนโดยเดา");
    expect(printRunsSource).toContain("[data-print-run-queue-row]");
    expect(printRunsSource).toContain('target.focus({ preventScroll: true })');
    expect(printRunsSource).toContain("handledFocusStepRef.current === focusStepId");
  });

  it("รับเสื้อลูกค้าแล้วรีเฟรชคิวสถานีทันทีทั้งสองคำสั่ง", () => {
    expect(
      goodsReceiptSource.match(/utils\.factory\.stationQueue/g),
    ).toHaveLength(2);
  });
});
