import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { selectNowSteps, type NowStep } from "@/lib/production-step-actions";
import { ProductionStepNavigator, defaultProductionStepId } from "./production-step-navigator";
import type { ProductionStep } from "./types";

const step = (id: string, overrides: Partial<ProductionStep> = {}): ProductionStep =>
  ({
    id,
    stepType: "HEAT_PRESS",
    customStepName: null,
    status: "PENDING",
    sortOrder: Number(id.replace(/\D/g, "")) || 1,
    qtyDone: 0,
    qtyTotal: 1,
    assignedTo: null,
    outsourceOrders: [],
    printRunItems: [],
    ...overrides,
  }) as ProductionStep;

const now = (
  currentStep: ProductionStep,
  group: "current" | "waiting" = "current",
): NowStep<ProductionStep> => ({
  step: currentStep,
  group,
  action: group === "current" ? "start" : null,
  waitingOn: group === "waiting" ? ["รอเสื้อ"] : [],
  note: null,
});

describe("defaultProductionStepId", () => {
  it("คงขั้นที่ผู้ใช้เลือกถ้ายังอยู่หลัง refetch", () => {
    const steps = [step("s1"), step("s2")];
    expect(defaultProductionStepId(steps, [now(steps[0]!)], "s2")).toBe("s2");
  });

  it("เลือกงานปัจจุบันก่อนงานที่รอและเรียงตาม sortOrder", () => {
    const first = step("s1");
    const second = step("s2");
    expect(defaultProductionStepId([first, second], [now(second, "waiting"), now(first)])).toBe("s1");
  });

  it("เมื่อเสร็จทั้งหมดเลือกขั้นท้ายไว้ดูหลักฐาน", () => {
    const steps = [
      step("s1", { status: "COMPLETED" }),
      step("s2", { status: "COMPLETED" }),
    ];
    expect(defaultProductionStepId(steps, [])).toBe("s2");
  });
});

describe("ProductionStepNavigator", () => {
  it("นับ DTF และงานร้านนอกที่ทำพร้อมกันจาก action policy จริง", () => {
    const first = step("s1", { stepType: "DTF_PRINT" });
    const second = step("s2", { stepType: "EMBROIDERY" });
    const nowSteps = selectNowSteps([first, second], {
      canOutsource: true,
      canUpdateStep: true,
      canSupervise: true,
      meId: "me",
      pressGate: { ready: true, waitingOn: [] },
    });
    const html = renderToStaticMarkup(
      createElement(ProductionStepNavigator, {
        steps: [first, second],
        nowSteps,
        value: "s1",
        onValueChange: vi.fn(),
        readOnly: false,
        renderStep: (item) => createElement("p", null, item.id),
      }),
    );

    expect(html).toContain("ทำพร้อมกันได้ 2 งาน");
    expect(html.match(/ทำได้ตอนนี้/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("ขั้นตอนการผลิต");
    expect(html).toContain("กำลังดูขั้น 1/2");
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).not.toContain("aria-current");
  });

  it("บอกสถานะ workflow ว่ากำลังทำ แม้งานยังอยู่ร้านนอก", () => {
    const active = step("s1", {
      stepType: "EMBROIDERY",
      status: "IN_PROGRESS",
      outsourceOrders: [{ status: "IN_PROGRESS" }] as ProductionStep["outsourceOrders"],
    });
    const nowSteps = selectNowSteps([active], {
      canOutsource: true,
      canUpdateStep: true,
      canSupervise: true,
      meId: "me",
      pressGate: { ready: true, waitingOn: [] },
    });
    const html = renderToStaticMarkup(
      createElement(ProductionStepNavigator, {
        steps: [active],
        nowSteps,
        value: "s1",
        onValueChange: vi.fn(),
        readOnly: false,
        renderStep: (item) => createElement("p", null, item.id),
      }),
    );

    expect(html).toContain("กำลังทำ");
    expect(html).not.toContain("ติดเงื่อนไข");
  });
});
