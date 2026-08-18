import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { NowStep } from "@/lib/production-step-actions";
import { ProductionNowCard } from "./production-now-card";
import type { ProductionStep } from "./types";

const step = (overrides: Partial<ProductionStep> = {}): ProductionStep =>
  ({
    id: "step-1",
    stepType: "HEAT_PRESS",
    customStepName: null,
    status: "PENDING",
    sortOrder: 1,
    qtyDone: 0,
    qtyTotal: 1,
    assignedTo: null,
    outsourceOrders: [],
    printRunItems: [],
    ...overrides,
  }) as ProductionStep;

const waitingStep = (
  overrides: Partial<NowStep<ProductionStep>> = {},
): NowStep<ProductionStep> => ({
  step: step(),
  group: "waiting",
  action: null,
  waitingOn: [],
  note: null,
  ...overrides,
});

const baseProps: Omit<ComponentProps<typeof ProductionNowCard>, "nowSteps"> = {
  allDone: false,
  busy: false,
  onStart: vi.fn(),
  onComplete: vi.fn(),
  onSendOutsource: vi.fn(),
  onQuickPass: vi.fn(),
  onOpenStep: vi.fn(),
};

function render(
  nowSteps: readonly NowStep<ProductionStep>[],
  props: Partial<ComponentProps<typeof ProductionNowCard>> = {},
) {
  return renderToStaticMarkup(
    createElement(ProductionNowCard, { ...baseProps, nowSteps, ...props }),
  );
}

describe("ProductionNowCard presentation contracts", () => {
  it("บอกตรงๆ เมื่อสิทธิ์อ่านอย่างเดียวและไม่สร้างทางเข้ารายละเอียดปลอม", () => {
    const html = render([waitingStep()], {
      embedded: true,
      canOpenStep: () => false,
    });

    expect(html).toContain("งานที่กำลังรอ");
    expect(html).toContain("สิทธิ์นี้ดูขั้นตอนนี้ได้อย่างเดียว");
    expect(html).not.toContain("เปิดรายละเอียด");
  });

  it("คงทางเข้ารายละเอียดของขั้นที่รอ เมื่อผู้ใช้มีสิทธิ์เปิด", () => {
    const html = render(
      [waitingStep({ note: "อยู่ที่ร้านนอก" })],
      { embedded: true, canOpenStep: () => true },
    );

    expect(html).toContain("อยู่ที่ร้านนอก");
    expect(html).toContain("เปิดรายละเอียด");
  });

  it("คง grammar เดิมของ Station เมื่อไม่ได้ใช้ embedded workspace", () => {
    const html = render(
      [waitingStep({ note: "เป็นงานของคนอื่น" })],
      { embedded: false, canOpenStep: () => false },
    );

    expect(html).toContain("ทำตอนนี้");
    expect(html).toContain("รอต่อจากนี้");
    expect(html).toContain("เป็นงานของคนอื่น");
    expect(html).not.toContain("งานที่กำลังรอ");
    expect(html).not.toContain("ขั้นถัดไป");
  });
});
