import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { accountedStepQty, StepPieceTable } from "./work-order-quantities";
import type { ProductionDetail, ProductionStep } from "./types";
import type { WorkOrderController } from "./work-order-controller";

const order = {
  items: [{
    prints: [],
    products: [{
      id: "product-1", description: "เสื้อทดสอบ", fabricColor: "ดำ", totalQuantity: 60,
      variants: [
        { id: "variant-s", size: "S", color: "ดำ", quantity: 30 },
        { id: "variant-m", size: "M", color: "ดำ", quantity: 30 },
      ],
    }],
  }],
} as unknown as ProductionDetail["order"];

const rework = {
  id: "step-rework", stepType: "CUSTOM", customStepName: "งานแก้ (QC ไม่ผ่าน)",
  status: "IN_PROGRESS", qtyTotal: 2, qtyDone: 1, outsourceOrders: [],
  quantities: [{ id: "line-m", sourceOrderItemVariantId: "variant-m", qtyPlanned: 2, qtyGood: 1, qtyScrap: 1 }],
} as unknown as ProductionStep;

function render(step = rework, pending = false) {
  return renderToStaticMarkup(createElement(StepPieceTable, {
    step, order,
    c: {
      canUpdateStep: true, canOwnOrSupervise: () => true,
      nowById: new Map(), piecePending: pending,
    } as unknown as WorkOrderController,
    footer: createElement("button", {}, "ปิดขั้นนี้"),
  }));
}

describe("work-order quantity evidence", () => {
  it("งานแก้แสดงเฉพาะไซซ์ M 2 ตัวตาม snapshot ไม่ดึงทั้งออเดอร์ 60 ตัวมาทำใหม่", () => {
    const html = render();
    expect(html).toContain('aria-label="ทำแล้ว เสื้อทดสอบ ดำ M"');
    expect(html).not.toContain('aria-label="ทำแล้ว เสื้อทดสอบ ดำ S"');
    expect(html).toContain('max="2"');
    expect(html).not.toContain('max="30"');
    expect(html).toContain("บันทึกแล้ว 2 / 2 ตัว");
  });

  it("ยอดประมวลผลครบรวมดีและเสีย โดยไม่เปลี่ยนยอดดีที่ตรวจได้จริง", () => {
    expect(accountedStepQty(rework)).toBe(2);
    expect(rework.qtyDone).toBe(1);
    expect(accountedStepQty({ ...rework, quantities: [], qtyDone: 3 })).toBe(3);
  });

  it("ขณะกำลังบันทึก ปุ่มปิดขั้นใน footer ใช้ไม่ได้จนผลบันทึกกลับมา", () => {
    expect(render(rework, true)).toMatch(/<fieldset[^>]*disabled=""[^>]*>.*ปิดขั้นนี้<\/button><\/fieldset>/);
    expect(render(rework, false)).not.toMatch(/<fieldset[^>]*disabled/);
  });
});
