import { describe, expect, it } from "vitest";
import type { BillingUiInvoice } from "@/lib/billing-ui";
import {
  REDESIGN_ORDER_DETAIL_STAGES,
  buildRedesignOrderDetailViewModel,
  canonicalOrderActionHref,
  deriveRedesignProductionRoutes,
  getRedesignOrderNextStep,
  type RedesignOrderDetailInput,
} from "@/lib/redesign-order-detail";

const baseOrder: RedesignOrderDetailInput = {
  internalStatus: "PRODUCING",
  items: [],
  productions: [],
  deliveries: [],
};

function invoice(
  overrides: Partial<BillingUiInvoice> = {},
): BillingUiInvoice {
  return {
    type: "FINAL_INVOICE",
    totalAmount: 1_000,
    amount: 934.58,
    discount: 0,
    tax: 65.42,
    isVoided: false,
    paymentStatus: "PARTIALLY_PAID",
    payments: [],
    adjustments: [],
    ...overrides,
  };
}

describe("deriveRedesignProductionRoutes", () => {
  it("แยก DTF ภายใน ร้านนอก งานผสม และงานไม่มีลายจาก printType จริง", () => {
    expect(
      deriveRedesignProductionRoutes([{ prints: [{ printType: "DTF" }] }]),
    ).toEqual({ inHouseDtf: true, outsource: false });
    expect(
      deriveRedesignProductionRoutes([
        { prints: [{ printType: "SILK_SCREEN" }] },
      ]),
    ).toEqual({ inHouseDtf: false, outsource: true });
    expect(
      deriveRedesignProductionRoutes([
        { prints: [{ printType: "DTF" }, { printType: "EMBROIDERY" }] },
      ]),
    ).toEqual({ inHouseDtf: true, outsource: true });
    expect(deriveRedesignProductionRoutes([])).toEqual({
      inHouseDtf: false,
      outsource: false,
    });
  });
});

describe("buildRedesignOrderDetailViewModel", () => {
  it("สรุป 7 ช่วง จำนวน ป้าย และเลนงานผสมโดยไม่แต่งข้อมูล", () => {
    const result = buildRedesignOrderDetailViewModel(
      {
        ...baseOrder,
        items: [
          {
            products: [
              {
                itemSource: "FROM_STOCK",
                variants: [{ quantity: 12 }, { quantity: 8 }],
              },
              {
                itemSource: "CUSTOM_MADE",
                variants: [{ quantity: 5 }],
              },
            ],
            prints: [{ printType: "DTF" }, { printType: "EMBROIDERY" }],
          },
          {
            products: [
              {
                itemSource: "FROM_STOCK",
                variants: [{ quantity: 3 }],
              },
            ],
            prints: [{ printType: "DTF" }],
          },
        ],
      },
      { canSeeMoney: false },
    );

    expect(result.itemCount).toBe(2);
    expect(result.productCount).toBe(3);
    expect(result.totalQuantity).toBe(28);
    expect(result.printLabels).toEqual(["DTF", "ปัก"]);
    expect(result.sourceLabels).toEqual(["จากสต็อก", "ตัดเย็บใหม่"]);
    expect(result.productionRoutes).toEqual({
      inHouseDtf: true,
      outsource: true,
    });
    expect(result.stages).toHaveLength(REDESIGN_ORDER_DETAIL_STAGES.length);
    expect(result.stages.map((stage) => stage.state)).toEqual([
      "complete",
      "complete",
      "complete",
      "current",
      "current",
      "upcoming",
      "upcoming",
    ]);
  });

  it("ให้ขั้นผลิตจริงชนะ print fallback และสรุป progress/current step", () => {
    const result = buildRedesignOrderDetailViewModel(
      {
        ...baseOrder,
        items: [{ prints: [{ printType: "DTF" }] }],
        productions: [
          {
            id: "production-active",
            status: "PENDING",
            steps: [
              {
                id: "pack",
                stepType: "PACKAGING",
                status: "PENDING",
                sortOrder: 3,
              },
              {
                id: "embroider",
                stepType: "EMBROIDERY",
                customStepName: "ส่งปักโลโก้",
                status: "IN_PROGRESS",
                sortOrder: 2,
                assignedTo: { name: "แป้ง" },
              },
              {
                id: "receive",
                stepType: "GARMENT_RECEIVE",
                status: "COMPLETED",
                sortOrder: 1,
              },
            ],
          },
        ],
      },
      { canSeeMoney: false },
    );

    expect(result.productionRoutes).toEqual({
      inHouseDtf: false,
      outsource: true,
    });
    expect(result.production).toEqual({
      targetId: "production-active",
      productionCount: 1,
      completedSteps: 1,
      totalSteps: 3,
      percent: 33,
      currentStepName: "ส่งปักโลโก้",
      assigneeName: "แป้ง",
    });
  });

  it("เลือกใบผลิตเดียวที่ยังทำอยู่ และ fail closed เมื่อมีหลายใบที่กำกวม", () => {
    const production = (id: string, status: string) => ({
      id,
      status,
      steps: [],
    });
    const targetFor = (productions: ReturnType<typeof production>[]) =>
      buildRedesignOrderDetailViewModel(
        { ...baseOrder, productions },
        { canSeeMoney: false },
      ).production.targetId;

    expect(
      targetFor([
        production("closed", "COMPLETED"),
        production("active", "PENDING"),
      ]),
    ).toBe("active");
    expect(
      targetFor([
        production("active-a", "PENDING"),
        production("active-b", "IN_PROGRESS"),
      ]),
    ).toBeNull();
    expect(
      targetFor([
        production("closed-a", "COMPLETED"),
        production("closed-b", "COMPLETED"),
      ]),
    ).toBeNull();
    expect(targetFor([production("only", "COMPLETED")])).toBe("only");
  });

  it("เลือกใบส่งล่าสุดตามเวลา ไม่พึ่งลำดับ array", () => {
    const result = buildRedesignOrderDetailViewModel(
      {
        ...baseOrder,
        deliveries: [
          {
            status: "PENDING",
            shippingMethod: "FLASH",
            trackingNumber: null,
            createdAt: "2026-08-10T00:00:00.000Z",
          },
          {
            status: "SHIPPED",
            shippingMethod: "KERRY",
            trackingNumber: "TH123",
            createdAt: "2026-08-12T00:00:00.000Z",
          },
        ],
      },
      { canSeeMoney: false },
    );

    expect(result.delivery).toEqual({
      count: 2,
      latestStatus: "SHIPPED",
      trackingNumber: "TH123",
      carrier: "KERRY",
    });
  });

  it("fail closed เรื่องเงิน และใช้ billingOverview เมื่อมีสิทธิ์+ข้อมูลครบ", () => {
    const live = invoice({
      payments: [{ amount: 300, whtAmount: 0 }],
      adjustments: [
        { type: "CREDIT_NOTE", totalAmount: 100, isVoided: false },
      ],
    });
    const voided = invoice({ isVoided: true, totalAmount: 500 });

    expect(
      buildRedesignOrderDetailViewModel(baseOrder, {
        canSeeMoney: false,
        billingInvoices: [live],
      }).billing,
    ).toBeNull();
    expect(
      buildRedesignOrderDetailViewModel(baseOrder, {
        canSeeMoney: true,
      }).billing,
    ).toBeNull();
    expect(
      buildRedesignOrderDetailViewModel(baseOrder, {
        canSeeMoney: true,
        billingInvoices: [live, voided],
      }).billing,
    ).toEqual({
      invoiceCount: 1,
      openInvoiceCount: 1,
      outstanding: 600,
    });
  });
});

describe("canonicalOrderActionHref", () => {
  it("map action ไป canonical tab ผ่าน tabForAnchor และไม่สร้าง action ปลอม", () => {
    expect(canonicalOrderActionHref("order/1", { type: "EDIT_ITEMS" })).toBe(
      "/orders/order%2F1/edit?tab=items&returnTab=items",
    );
    expect(
      canonicalOrderActionHref("order-1", {
        type: "ANCHOR",
        target: "billing",
      }),
    ).toBe("/orders/order-1?tab=money");
    expect(
      canonicalOrderActionHref("order-1", {
        type: "ANCHOR",
        target: "qc",
      }),
    ).toBe("/orders/order-1?tab=production");
    expect(
      canonicalOrderActionHref("order-1", {
        type: "ANCHOR",
        target: "delivery",
      }),
    ).toBe("/orders/order-1?tab=delivery");
    expect(
      canonicalOrderActionHref("order-1", {
        type: "STATUS",
        to: "PACKING",
      }),
    ).toBe("/orders/order-1");
    expect(canonicalOrderActionHref("order-1", { type: "NONE" })).toBeNull();
  });
});

describe("getRedesignOrderNextStep", () => {
  const shippedOrder = {
    internalStatus: "SHIPPED",
    orderType: "CUSTOM",
    totalAmount: 1_000,
    paymentTerms: "NET_30",
    items: [{}],
    invoices: [
      {
        isVoided: false,
        type: "FINAL_INVOICE",
        totalAmount: 1_000,
      },
    ],
    designs: [],
    productions: [],
    deliveries: [{}],
  };

  it("ไม่สรุปสถานะเงินหรือเสนอปิดงานให้คนที่ไม่มีสิทธิ์เห็นเงิน", () => {
    const step = getRedesignOrderNextStep(shippedOrder, {
      canSeeMoney: false,
    });
    const copy = `${step?.title} ${step?.description} ${step?.buttonLabel}`;

    expect(step?.action).toEqual({ type: "NONE" });
    expect(step?.buttonLabel).toBe("เปิดรายละเอียดเต็ม");
    expect(copy).not.toContain("วางบิล");
    expect(copy).not.toContain("ปิดงาน");
  });

  it("คง next-step เดิมเมื่อมีสิทธิ์และเอกสารครบยอด", () => {
    expect(
      getRedesignOrderNextStep(shippedOrder, { canSeeMoney: true })?.action,
    ).toEqual({ type: "STATUS", to: "COMPLETED" });
  });
});
