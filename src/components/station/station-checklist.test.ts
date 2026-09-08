import React, { Children, isValidElement, type ReactNode, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StationStepChecklist, StationStepZone } from "./station-job";
import { workOrderStandards } from "@/lib/work-order-standards";
import type { ProductionStep } from "@/components/production/types";
import type { WorkOrderController } from "@/components/production/work-order-controller";
import type { NowStep, NowStepAction } from "@/lib/production-step-actions";

(globalThis as Record<string, unknown>).React = React;

const standards = workOrderStandards("HEAT_PRESS");
const step = {
  id: "step-1",
  stepType: "HEAT_PRESS",
  status: "IN_PROGRESS",
  checks: [{ itemKey: standards[0], checkedBy: { name: "บาส" } }],
} as ProductionStep;

function controller() {
  return { canUpdateStep: true, canOwnOrSupervise: () => true, tickPending: false, tickStandard: vi.fn() };
}

function buttons(node: ReactNode): ReactElement<{ onClick: () => void }>[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return [];
    if (child.type === "button") return [child as ReactElement<{ onClick: () => void }>];
    return buttons(child.props.children);
  });
}

describe("station checklist uses saved production checks", () => {
  it("เปิดขั้นแล้วเห็นผลติ๊กที่เคยบันทึกพร้อมชื่อคนทำ", () => {
    const html = renderToStaticMarkup(React.createElement(StationStepChecklist, { step, c: controller() }));
    expect(html).toContain("1/3");
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    expect(html).toContain("ติ๊กโดย บาส");
  });

  it("ติ๊กและถอนติ๊กส่งคำสั่งบันทึกจริงของขั้นเดียวกับใบผลิต", () => {
    const c = controller();
    const controls = buttons(StationStepChecklist({ step, c }));
    controls[0].props.onClick();
    controls[1].props.onClick();
    expect(c.tickStandard.mock.calls).toEqual([
      ["step-1", standards[0], false],
      ["step-1", standards[1], true],
    ]);
  });

  it("งานเก่าที่ปิดขั้นแล้วไม่แสดงว่าติ๊กครบหากไม่มีผลบันทึก", () => {
    const html = renderToStaticMarkup(React.createElement(StationStepChecklist, {
      step: { ...step, status: "COMPLETED", checks: [] } as ProductionStep,
      c: controller(),
    }));
    expect(html).toContain("0/3");
    expect(html).not.toContain('aria-pressed="true"');
  });

  it.each([
    ["ไม่มีสิทธิ์", { canUpdateStep: false }, "IN_PROGRESS"],
    ["เป็นขั้นของคนอื่น", { canOwnOrSupervise: () => false }, "IN_PROGRESS"],
    ["กำลังบันทึก", { tickPending: true }, "IN_PROGRESS"],
    ["พักงาน", {}, "ON_HOLD"],
    ["ปิดขั้นแล้ว", {}, "COMPLETED"],
  ])("ห้ามติ๊กเมื่อ%s", (_, overrides, status) => {
    const html = renderToStaticMarkup(React.createElement(StationStepChecklist, {
      step: { ...step, status } as ProductionStep,
      c: { ...controller(), ...overrides },
    }));
    expect((html.match(/disabled=""/g) ?? []).length).toBe(3);
  });
});

describe("station actions follow work-order rules", () => {
  function renderStep(action: NowStepAction | null, checked: boolean, pending = false, stepType = "HEAT_PRESS") {
    const currentStep = {
      ...step,
      stepType,
      checks: checked ? workOrderStandards(stepType).map((itemKey) => ({ itemKey, checkedBy: { name: "บาส" } })) : [],
      outsourceOrders: [],
      printRunItems: [],
      assignedTo: null,
      notes: null,
      startedAt: null,
      completedAt: null,
    } as unknown as ProductionStep;
    const now: NowStep<ProductionStep> = { action, group: "current", waitingOn: [], step: currentStep, note: null };
    const primaryButton = vi.fn(() => React.createElement("button", {}, "ปุ่มจากใบผลิต"));
    const c = {
      ...controller(),
      tickPending: pending,
      primaryButton,
      canSuperviseStep: false,
      hasProductionPermission: true,
      reportProblem: { isPending: false },
    } as unknown as WorkOrderController;
    const html = renderToStaticMarkup(React.createElement(StationStepZone, {
      c, step: currentStep, index: 1, total: 1, boss: false, autoFix: false,
      nowMs: 0, nowById: new Map([[step.id, now]]), productionId: "production-1",
    }));
    return { html, primaryButton };
  }

  it("ช่างรีดร้อนเริ่มงานได้จาก controller แม้ยังไม่ติ๊กข้อกำหนด", () => {
    const { html, primaryButton } = renderStep("start", false);
    expect(primaryButton).toHaveBeenCalledOnce();
    expect(html).toContain("ปุ่มจากใบผลิต");
    expect(html).not.toContain("จดบนกระดาษ");
  });

  it("ช่างรีดร้อนปิดขั้นได้เมื่อผลติ๊กจาก server ครบแล้ว", () => {
    const { html, primaryButton } = renderStep("complete", true);
    expect(primaryButton).toHaveBeenCalledOnce();
    expect(html).toContain("ปุ่มจากใบผลิต");
  });

  it("ผลติ๊กไม่ครบหรือยังบันทึกไม่เสร็จ ห้ามยิงคำสั่งปิดขั้น", () => {
    for (const pending of [false, true]) {
      const { html, primaryButton } = renderStep("complete", pending, pending);
      expect(primaryButton).not.toHaveBeenCalled();
      expect(html).toContain('aria-disabled="true"');
    }
  });

  it.each([
    ["DTF_PRINT", null],
    ["GARMENT_RECEIVE", null],
    ["EMBROIDERY", "send-outsource"],
  ] as const)("คงทางลงมือเฉพาะของ %s ผ่าน controller", (stepType, action) => {
    expect(renderStep(action, false, false, stepType).primaryButton).toHaveBeenCalledOnce();
  });
});
