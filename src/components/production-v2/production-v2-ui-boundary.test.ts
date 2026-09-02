import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const controlRecordSource = readFileSync(
  new URL("./production-v2-control-record.tsx", import.meta.url),
  "utf8",
);
const controlActionsSource = readFileSync(
  new URL("./production-v2-control-actions.tsx", import.meta.url),
  "utf8",
);

describe("Production V2 UI ownership boundaries", () => {
  it("Control Record ไม่เรียกคำสั่งลงมือแทนพนักงาน", () => {
    expect(controlRecordSource).not.toContain("manufacturing.startOperation");
    expect(controlRecordSource).not.toContain("manufacturing.reportOutput");
    expect(controlRecordSource).not.toContain("manufacturing.completeOperation");
  });

  it("Control Record แยก quantity ledger ตามขั้นงานและศูนย์งาน", () => {
    expect(controlRecordSource).toContain('title="จำนวนตามขั้นงาน"');
    expect(controlRecordSource).toContain("line.productionStepId");
    expect(controlRecordSource).toContain("group.operation?.workCenter?.name");
    expect(controlRecordSource).toContain("operations={workOrder.operations}");
  });

  it("Control Record อธิบาย release/rework blocker และกู้ Work Center query ได้", () => {
    expect(controlRecordSource).toContain("workOrder.releaseBlockers.map");
    expect(controlRecordSource).toContain('title="โหลดศูนย์งานไม่สำเร็จ"');
    expect(controlRecordSource).toContain("centersQuery.refetch()");
    expect(controlRecordSource).toContain("reworkCentersUnavailable");
    expect(controlRecordSource).toContain("กำหนดศูนย์งานแก้");
  });

  it("Control Record เปิดใบงานร้านนอกเฉพาะเมื่อ server ให้สิทธิ์สร้าง", () => {
    expect(controlActionsSource).toContain('includes(\n    "createOutsourceOrder",');
    expect(controlActionsSource).not.toContain('includes(\n    "manageOutsource",');
  });

  it("งานร้านนอกสร้างและตรวจรับจาก allocation รายการจริง ไม่เดาจากยอดรวม", () => {
    expect(controlActionsSource).toContain("quantityLines: selectedLines");
    expect(controlActionsSource).toContain("for (const order of openOrders)");
    expect(controlActionsSource).toContain("order.quantityAllocations");
    expect(controlActionsSource).toContain("openAllocatedByLine.get(line.id)");
  });

  it("การปิดปัญหา QC ส่ง disposition เดิมกลับไปยืนยันโดยไม่เปิดให้ UI เปลี่ยน", () => {
    expect(controlActionsSource).toContain("{ disposition: exception.disposition }");
    expect(controlActionsSource).toContain("trpc.manufacturing.decideQcDisposition");
    expect(controlActionsSource).toContain('includes(\n    "decideQcDisposition",');
  });
});
