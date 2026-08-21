import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GarmentPickCard } from "./garment-pick-card";
import type { ProductionStep } from "./types";

const useGarmentPickQuery = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  trpc: {
    production: {
      garmentPick: {
        useQuery: useGarmentPickQuery,
      },
    },
  },
}));

const garmentPickStep = {
  id: "garment-pick-1",
  productionId: "production-1",
  stepType: "GARMENT_PICK",
  customStepName: null,
  status: "PENDING",
  sortOrder: 1,
  qtyDone: 0,
  qtyTotal: 2,
  startedAt: null,
  completedAt: null,
  qcPassed: null,
  qcNotes: null,
  notes: null,
  assignedTo: null,
  outsourceOrders: [],
  printRunItems: [],
} as ProductionStep;

const baseProps: ComponentProps<typeof GarmentPickCard> = {
  productionId: "production-1",
  steps: [garmentPickStep],
  stepId: garmentPickStep.id,
  canIssueGarments: true,
  canReturnGarments: false,
  embedded: true,
  primaryTask: true,
};

function render(props: Partial<ComponentProps<typeof GarmentPickCard>> = {}) {
  return renderToStaticMarkup(
    createElement(GarmentPickCard, { ...baseProps, ...props }),
  );
}

describe("GarmentPickCard Station presentation", () => {
  beforeEach(() => {
    useGarmentPickQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      errorUpdatedAt: 0,
      data: {
        configured: true,
        stockMode: "demo-local",
        problems: [],
        lines: [
          {
            sku: "CVC-BLACK-M",
            productName: "เสื้อ CVC สีดำ",
            size: "M",
            color: "ดำ",
            needed: 2,
            issued: 0,
            returned: 0,
            available: 20,
          },
        ],
      },
    });
  });

  it("ขยายเฉพาะปุ่มเบิกหลักบน Station และคงปุ่ม ERP แบบเดิม", () => {
    const stationHtml = render({ stationMode: true });
    const erpHtml = render();
    const stationButton = stationHtml.match(
      /<button[^>]*data-station-primary-action=""[^>]*>/,
    )?.[0];
    const stationActionBar = stationHtml.match(
      /<div[^>]*data-station-action-bar=""[^>]*>/,
    )?.[0];

    expect(stationButton).toContain("h-14");
    expect(stationButton).toContain("w-full");
    expect(stationButton).toContain("sm:w-full");
    expect(stationActionBar).toContain("fixed");
    expect(stationActionBar).toContain("z-40");
    expect(stationHtml).toContain("safe-area-inset-bottom");
    expect(stationActionBar).toContain("bg-surface");
    expect(stationHtml).toContain("เสื้อ CVC สีดำ");
    expect(stationHtml).toContain("ไซส์ M · สี ดำ");
    expect(erpHtml).toContain("sm:w-auto");
    expect(erpHtml).toContain("sm:min-w-56");
    expect(erpHtml).not.toContain("data-station-primary-action");
  });
});
