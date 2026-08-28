import { describe, expect, it } from "vitest";
import {
  ORDER_WORKBENCH_STAGES,
  buildOrderWorkbenchViewModel,
  canonicalOrderActionHref,
  deriveOrderWorkbenchProductionRoutes,
  getOrderWorkbenchNextStep,
  type OrderWorkbenchInput,
} from "@/lib/order-workbench";

const baseOrder: OrderWorkbenchInput = {
  internalStatus: "PRODUCING",
  items: [],
  productions: [],
  deliveries: [],
};

describe("deriveOrderWorkbenchProductionRoutes", () => {
  it("แยก DTF ร้านนอก งานผสม และงานที่ยังไม่ระบุจาก printType จริง", () => {
    expect(
      deriveOrderWorkbenchProductionRoutes([{ prints: [{ printType: "DTF" }] }]),
    ).toEqual({ inHouseDtf: true, outsource: false });
    expect(
      deriveOrderWorkbenchProductionRoutes([
        { prints: [{ printType: "SILK_SCREEN" }] },
      ]),
    ).toEqual({ inHouseDtf: false, outsource: true });
    expect(
      deriveOrderWorkbenchProductionRoutes([
        { prints: [{ printType: "DTF" }, { printType: "EMBROIDERY" }] },
      ]),
    ).toEqual({ inHouseDtf: true, outsource: true });
    expect(deriveOrderWorkbenchProductionRoutes([])).toEqual({
      inHouseDtf: false,
      outsource: false,
    });
  });
});

describe("buildOrderWorkbenchViewModel", () => {
  it("สรุป 7 ช่วง จำนวน ป้าย และเลนงานผสมโดยไม่แต่งข้อมูล", () => {
    const result = buildOrderWorkbenchViewModel({
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
    });

    expect(result.itemCount).toBe(2);
    expect(result.productCount).toBe(3);
    expect(result.totalQuantity).toBe(28);
    expect(result.printLabels).toEqual(["DTF", "ปัก"]);
    expect(result.sourceLabels).toEqual(["จากสต็อก", "ตัดเย็บใหม่"]);
    expect(result.productionRoutes).toEqual({
      inHouseDtf: true,
      outsource: true,
    });
    expect(result.stages).toHaveLength(ORDER_WORKBENCH_STAGES.length);
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
    const result = buildOrderWorkbenchViewModel({
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
    });

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

  it("fail closed เมื่อมีใบผลิตที่ยังทำอยู่หลายใบ", () => {
    const result = buildOrderWorkbenchViewModel({
      ...baseOrder,
      productions: [
        { id: "active-a", status: "PENDING", steps: [] },
        { id: "active-b", status: "IN_PROGRESS", steps: [] },
      ],
    });

    expect(result.production.targetId).toBeNull();
  });

  it("เลือกใบส่งล่าสุดตามเวลา ไม่พึ่งลำดับ array", () => {
    const result = buildOrderWorkbenchViewModel({
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
    });

    expect(result.delivery).toEqual({
      count: 2,
      latestStatus: "SHIPPED",
      trackingNumber: "TH123",
      carrier: "KERRY",
    });
  });
});

describe("canonicalOrderActionHref", () => {
  it("ส่ง deep action กลับ canonical route เท่านั้น", () => {
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
        type: "STATUS",
        to: "PACKING",
      }),
    ).toBe("/orders/order-1");
    expect(canonicalOrderActionHref("order-1", { type: "NONE" })).toBeNull();
  });
});

describe("getOrderWorkbenchNextStep", () => {
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

  it("ไม่สรุปวางบิลหรือปิดงานให้คนที่ไม่มีสิทธิ์เห็นเงิน", () => {
    const step = getOrderWorkbenchNextStep(shippedOrder, {
      canSeeMoney: false,
    });
    const copy = `${step?.title} ${step?.description} ${step?.buttonLabel}`;

    expect(step?.action).toEqual({ type: "NONE" });
    expect(copy).not.toContain("วางบิล");
    expect(copy).not.toContain("ปิดงาน");
  });

  it("คง next-step เดิมเมื่อมีสิทธิ์และบิลครบยอด", () => {
    expect(
      getOrderWorkbenchNextStep(shippedOrder, { canSeeMoney: true })?.action,
    ).toEqual({ type: "STATUS", to: "COMPLETED" });
  });
});
