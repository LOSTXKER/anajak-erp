import React, { Children, isValidElement, type ReactNode, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StationStepChecklist, StationStepZone } from "./station-job";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { WorkOrderView } from "@/components/production/work-order-page";
import { ChecklistCard, ticksMissing } from "@/components/production/work-order-checklist";
import { useProtoController } from "@/app/proto/work-order-states/_controller";
import { stateOf } from "@/app/proto/work-order-states/_fixtures";
import { workOrderStandards } from "@/lib/work-order-standards";
import type { ProductionStep } from "@/components/production/types";
import type { WorkOrderController } from "@/components/production/work-order-controller";
import type { NowStep, NowStepAction } from "@/lib/production-step-actions";

(globalThis as Record<string, unknown>).React = React;
vi.mock("@/components/production/dtf-print-card", () => ({ DtfPrintCard: () => React.createElement("div", {}, "บันทึกรอบพิมพ์จริง") }));
vi.mock("@/components/production/outsource-step-card", () => ({ OutsourceStepCard: () => React.createElement("div", {}, "ส่งและรับร้านนอกจากหลักฐาน") }));

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
  it("งานรีดที่ส่งร้านแทนใช้ใบตรวจรับเป็นหลักฐาน ไม่ให้ติ๊กรีดในโรงงานซ้ำทั้งสองจอ", () => {
    const outsourced = { ...step, executionMode: "OUTSOURCE", outsourceOrders: [], assignedTo: null } as ProductionStep;
    const c = controller();
    const station = renderToStaticMarkup(React.createElement(StationStepChecklist, { step: outsourced, c }));
    const workOrder = renderToStaticMarkup(React.createElement(ChecklistCard, { step: outsourced, c: c as unknown as WorkOrderController, nowMs: 0 }));
    expect(station).toContain("ยืนยันด้วยหลักฐานของขั้น");
    expect((station.match(/disabled=""/g) ?? []).length).toBe(standards.length);
    expect(workOrder).not.toContain('type="checkbox"');
    expect(workOrder).not.toContain("ติ๊กอีก");
    expect(ticksMissing(outsourced)).toBe(0);
    expect(c.tickStandard).not.toHaveBeenCalled();
  });

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

describe("outsource status on the real work-order header", () => {
  it("ใบร่างบอกว่ายังรอส่ง และใบรับกลับบอกว่ารอตรวจ โดยไม่อ้างว่าของยังอยู่ร้าน", () => {
    for (const status of ["DRAFT", "RECEIVED_BACK"] as const) {
      const base = stateOf("outsource-shop");
      const fixture = {
        ...base,
        steps: base.steps.map((entry) => ({
          ...entry,
          outsourceOrders: entry.outsourceOrders.map((job) => ({ ...job, status, sentAt: status === "DRAFT" ? null : job.sentAt })),
        })),
      };
      function FixtureView() {
        return React.createElement(WorkOrderView, { c: useProtoController(fixture, "boss") });
      }
      const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}, hmrRefresh() {} } as never;
      const html = renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: router },
        React.createElement(PathnameContext.Provider, { value: "/production/proto-prod" },
          React.createElement(SearchParamsContext.Provider, { value: new URLSearchParams() }, React.createElement(FixtureView))),
      ));
      const vendorName = fixture.steps.flatMap((entry) => entry.outsourceOrders)[0]!.vendor.name;
      expect(html).toContain(status === "DRAFT" ? `รอส่งของให้ ${vendorName}` : `รอตรวจรับของจาก ${vendorName}`);
      expect(html).not.toContain(`ของอยู่ที่ ${vendorName} รอรับงานกลับ`);
    }
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
      order: { id: "order-1" },
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

  it("รับเสื้อลูกค้าผ่านคำสั่งใบตรวจรับเดิม", () => {
    expect(renderStep(null, false, false, "GARMENT_RECEIVE").primaryButton).toHaveBeenCalledOnce();
  });
  it.each([
    ["DTF_PRINT", null, "บันทึกรอบพิมพ์จริง"],
    ["EMBROIDERY", "send-outsource", "ส่งและรับร้านนอกจากหลักฐาน"],
  ] as const)("%s ใช้การ์ดหลักฐานเฉพาะและไม่มีปุ่มปิดลอยซ้ำ", (stepType, action, text) => {
    const result = renderStep(action, false, false, stepType);
    expect(result.primaryButton).not.toHaveBeenCalled();
    expect(result.html).toContain(text);
  });
});
