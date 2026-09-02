import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  printTypesForProductionStep,
  ProductionDesignCard,
} from "./production-design-card";
import type { ProductionDetail } from "./types";

const order = {
  designs: [
    {
      versionNumber: 2,
      fileUrl: "https://example.com/approved.pdf",
      thumbnailUrl: null,
      approvedAt: null,
    },
  ],
  items: [
    {
      id: "item-1",
      totalQuantity: 2,
      prints: [
        {
          id: "print-dtf",
          position: "FRONT",
          printType: "DTF",
          printSize: "A4",
          width: 21,
          height: 29.7,
          colorCount: 1,
          designNote: null,
          designImageUrl: null,
        },
      ],
      products: [
        {
          id: "product-dtf",
          productType: "TSHIRT",
          description: "เสื้อสำหรับงาน DTF",
          itemSource: "STOCK",
          fabricColor: "ดำ",
          totalQuantity: 2,
          variants: [
            { id: "variant-dtf", size: "L", color: "ดำ", quantity: 2 },
          ],
        },
      ],
    },
    {
      id: "item-2",
      totalQuantity: 3,
      prints: [
        {
          id: "print-silk",
          position: "BACK",
          printType: "SILK_SCREEN",
          printSize: "A3",
          width: 29.7,
          height: 42,
          colorCount: 2,
          designNote: null,
          designImageUrl: null,
        },
      ],
      products: [
        {
          id: "product-silk",
          productType: "TSHIRT",
          description: "เสื้อสำหรับงาน Silk Screen",
          itemSource: "STOCK",
          fabricColor: "ขาว",
          totalQuantity: 3,
          variants: [
            { id: "variant-silk", size: "XL", color: "ขาว", quantity: 3 },
          ],
        },
      ],
    },
  ],
} as unknown as ProductionDetail["order"];

function renderFocused(stepType: string) {
  return renderToStaticMarkup(
    createElement(ProductionDesignCard, { order, focusStepType: stepType }),
  );
}

function renderStationWorkSheet(stepType: string) {
  return renderToStaticMarkup(
    createElement(ProductionDesignCard, {
      order: {
        ...order,
        designs: [
          {
            ...order.designs[0],
            thumbnailUrl:
              "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E",
          },
        ],
      } as ProductionDetail["order"],
      focusStepType: stepType,
      presentation: "station-work-sheet",
      embedded: true,
    }),
  );
}

describe("printTypesForProductionStep", () => {
  it("จำกัดงาน DTF และรีดร้อนให้เห็นเฉพาะลายที่นำไปรีด", () => {
    expect(printTypesForProductionStep("DTF_PRINT")).toEqual([
      "DTF",
      "HEAT_TRANSFER",
    ]);
    expect(printTypesForProductionStep("HEAT_PRESS")).toEqual([
      "DTF",
      "HEAT_TRANSFER",
    ]);
  });

  it("จับคู่ขั้นพิมพ์ร้านนอกกับชนิดลายของขั้นนั้น", () => {
    expect(printTypesForProductionStep("DTG_PRETREAT")).toEqual(["DTG"]);
    expect(printTypesForProductionStep("DTG_PRINT")).toEqual(["DTG"]);
    expect(printTypesForProductionStep("CURING")).toEqual(["DTG"]);
    expect(printTypesForProductionStep("SCREEN_PRINTING")).toEqual([
      "SILK_SCREEN",
    ]);
    expect(printTypesForProductionStep("EMBROIDERY")).toEqual(["EMBROIDERY"]);
    expect(printTypesForProductionStep("SUBLIMATION")).toEqual(["SUBLIMATION"]);
  });

  it("ซ่อนลายทั้งหมดในขั้นสินค้าอย่างเดียว", () => {
    for (const stepType of [
      "GARMENT_PICK",
      "GARMENT_RECEIVE",
      "PATTERN_MAKING",
      "SEWING",
      "TAGGING",
    ]) {
      expect(printTypesForProductionStep(stepType)).toEqual([]);
    }
  });

  it("คงพฤติกรรมเดิมเมื่อไม่ระบุขั้นหรือเป็นขั้นพิเศษ", () => {
    expect(printTypesForProductionStep()).toBeNull();
    expect(printTypesForProductionStep("SPECIAL_PRINT")).toBeNull();
    expect(printTypesForProductionStep("CUSTOM")).toBeNull();
  });

  it("ขั้นสินค้าแสดงไซส์ แต่ไม่พ่วงแบบอนุมัติหรือลายพิมพ์", () => {
    const html = renderFocused("GARMENT_RECEIVE");

    expect(html).toContain("สินค้าและจำนวน");
    expect(html).toContain("เสื้อสำหรับงาน DTF");
    expect(html).toContain("เสื้อสำหรับงาน Silk Screen");
    expect(html).toContain("×2");
    expect(html).toContain("×3");
    expect(html).not.toContain("แบบอนุมัติล่าสุด");
    expect(html).not.toContain("ลายพิมพ์");
  });

  it("ขั้น DTF ไม่แสดงลายหรือสินค้าและไซส์ของ item สกรีนร้านนอก", () => {
    const html = renderFocused("DTF_PRINT");

    expect(html).toContain("DTF");
    expect(html).toContain("เสื้อสำหรับงาน DTF");
    expect(html).toContain("×2");
    expect(html).not.toContain("Silk Screen");
    expect(html).not.toContain("เสื้อสำหรับงาน Silk Screen");
    expect(html).not.toContain("×3");
  });

  it("station work sheet ใช้ visual สำหรับหน้างานและยังกรองสินค้า/ลายตามขั้น DTF", () => {
    const html = renderStationWorkSheet("DTF_PRINT");

    expect(html).toContain("data-station-garment-preview");
    expect(html).toContain("data-station-approved-reference");
    expect(html).toContain("เสื้อสำหรับงาน DTF");
    expect(html).toContain("หน้า");
    expect(html).not.toContain("เสื้อสำหรับงาน Silk Screen");
    expect(html).not.toContain("หลัง");
  });

  it("station work sheet คงการจับคู่ item เมื่อเสื้อสองแบบมีลาย FRONT เหมือนกัน", () => {
    const samePositionOrder = {
      ...order,
      items: order.items.map((item, index) => ({
        ...item,
        prints: item.prints.map((print) => ({
          ...print,
          id: `front-${index + 1}`,
          position: "FRONT",
          printType: "DTF",
          designImageUrl: `/front-${index + 1}.png`,
        })),
      })),
    } as ProductionDetail["order"];

    const html = renderToStaticMarkup(
      createElement(ProductionDesignCard, {
        order: samePositionOrder,
        focusStepType: "HEAT_PRESS",
        presentation: "station-work-sheet",
        embedded: true,
      }),
    );

    expect(html).toContain('data-station-work-group="item-1"');
    expect(html).toContain('data-station-work-group="item-2"');
    expect(html).toContain("ใช้กับ เสื้อสำหรับงาน DTF · ดำ");
    expect(html).toContain("ใช้กับ เสื้อสำหรับงาน Silk Screen · ขาว");
    expect(html).toContain("front-1.png");
    expect(html).toContain("front-2.png");
  });

  it("presentation เดิมของ ERP ไม่ถูกเปลี่ยนเป็น station work sheet", () => {
    const html = renderFocused("DTF_PRINT");

    expect(html).toContain("แบบและสเปกสำหรับขั้นนี้");
    expect(html).not.toContain("data-station-garment-preview");
    expect(html).not.toContain("แบบและจุดที่ต้องทำ");
  });
});
