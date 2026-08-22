import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dialogSource = readFileSync(
  "src/components/production/step-update-dialog.tsx",
  "utf8",
);
const detailSource = readFileSync(
  "src/components/production/production-detail-screen.tsx",
  "utf8",
);
const confirmSource = readFileSync(
  "src/components/ui/confirm-dialog.tsx",
  "utf8",
);
const garmentSource = readFileSync(
  "src/components/production/garment-pick-card.tsx",
  "utf8",
);
const stationModeSource = readFileSync(
  "src/components/factory/station-mode-screen.tsx",
  "utf8",
);

describe("production exception UI contract", () => {
  it("แยก manager commands จาก operation update และไม่ให้ manager กรอก status/qty/QC", () => {
    expect(dialogSource).toContain("trpc.production.assignProductionStep");
    expect(dialogSource).toContain("trpc.production.resolveStationProblem");
    expect(dialogSource).toContain("assignedToId: assignee || null");
    expect(dialogSource).toContain('if (managerOnly) {');
    expect(dialogSource).toContain("enabled: managerOnly && canAssign");
    expect(dialogSource).toContain("{!managerOnly ? (");
    expect(dialogSource).not.toContain('managerOnly ? "หมายเหตุสำหรับทีม"');
    expect(dialogSource).toContain("แก้ปัญหาแล้ว ส่งกลับสถานี");
    expect(dialogSource).toContain("disabled={!resolutionReady || assigneeChanged || managerPending}");
    const operationPayload = dialogSource.match(/updateStep\.mutate\(\{([\s\S]*?)\n\s*\}\);/)?.[1];
    expect(operationPayload).toBeTruthy();
    expect(operationPayload).not.toContain("assignedToId");
    expect(dialogSource).not.toContain('<option value="FAILED">');
  });

  it("Station แจ้งปัญหาได้เฉพาะ current ที่ไม่ blocked/future/active print run", () => {
    expect(detailSource).toContain('stationCurrentNowStep?.group === "current"');
    expect(detailSource).toContain("stationCurrentNowStep.waitingOn.length === 0");
    expect(detailSource).toContain("stationCurrentActionTarget?.printRunItems.length === 0");
    expect(detailSource).toContain("factoryStationKeyForStep(stationProblemTarget.stepType) === station");
    expect(detailSource).toContain('step.status !== "FAILED" &&');
    expect(detailSource).toContain("handleReportProblem(stationProblemTarget)");
  });

  it("Station วาด specialized action เฉพาะ current target และ dialog คืน focus ให้ปุ่มเดิม", () => {
    expect(detailSource).toContain("const stationCurrentActionTarget =");
    expect(detailSource).toContain("stationCurrentNowStep.step.id === stationCurrentStep?.id");
    expect(detailSource).toContain('stationCurrentActionTarget?.stepType === "GARMENT_PICK"');
    expect(detailSource).toContain('stationCurrentActionTarget?.stepType === "GARMENT_RECEIVE"');
    expect(detailSource).toContain("stationCurrentActionTarget.id === goodsReceiptStepId");
    expect(detailSource).toContain("productionStepId={goodsReceiptStepId}");
    expect(garmentSource).toContain("operationJobId ?? pickStep?.id ?? null");
    expect(garmentSource).toContain("pickStepId === issueStepId");
    expect(garmentSource).toContain(
      "stepId={operationJobId ? undefined : issueStepId}",
    );
    expect(detailSource).toContain("readOnly={!canUpdateStep || !canSuperviseStep}");
    expect(detailSource).toMatch(/canReturnGarments=\{[\s\S]*?surface === "erp" &&[\s\S]*?canSuperviseStep/);
    expect(detailSource).toContain("returnFocusRef={stepDialogReturnFocusRef}");
    expect(detailSource).toContain('? "งานพร้อมที่เปิดดู"');
    expect(detailSource).toContain('? "งานติดปัญหาที่เปิดดู"');
    expect(dialogSource).toContain("onCloseAutoFocus={(event) => {");
    expect(confirmSource).toContain("const returnFocusRef = React.useRef<HTMLElement | null>(null)");
    expect(confirmSource).toContain("returnFocusRef.current.focus()");
    expect(confirmSource).toContain("minLength?: number");
    expect(confirmSource).toContain('role="alert"');
    expect(confirmSource).toContain('htmlFor="confirm-dialog-prompt"');
    expect(detailSource).toContain('label: "รายละเอียดปัญหา"');
    expect(detailSource).toContain("minLength: 3");
    expect(garmentSource).toContain("const garmentDataStale = garmentPickQuery.isError");
    expect(garmentSource).toMatch(/!garmentDataStale\s*&&\s*data\.configured/);
    expect(garmentSource).toContain('data.stockMode === "demo-local"');
    expect(garmentSource).toContain("สต๊อกทดสอบในเครื่อง");
    expect(garmentSource).toContain("l.available");
    expect(stationModeSource).toContain("currentProductionProblemReason(spot.step)");
  });
});
