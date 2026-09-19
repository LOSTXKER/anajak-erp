import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChecklistCard } from "./work-order-side";
import { OutsourceReturnReceipt, type WorkOrderController } from "./work-order-controller";
import { dtfUnavailableReason, outsourceReceiptCandidates, outsourceStepReason } from "./work-order-pieces";
import { workOrderStandards } from "@/lib/work-order-standards";
import type { ProductionStep } from "./types";

(globalThis as Record<string, unknown>).React = React;

describe("ใบผลิตบอกสถานะและหลักฐานตามข้อมูลจริง", () => {
  it("ขั้นปิดแล้วคงผลติ๊กจริง ไม่ติ๊กข้อที่ไม่มีหลักฐานให้เอง", () => {
    const standards = workOrderStandards("HEAT_PRESS");
    const step = {
      id: "step-1", stepType: "HEAT_PRESS", status: "COMPLETED", assignedTo: null,
      checks: [{ itemKey: standards[0], checkedBy: { name: "ผู้ตรวจ" } }], outsourceOrders: [],
    } as unknown as ProductionStep;
    const ctl = { canUpdateStep: true, canOwnOrSupervise: () => true, tickPending: false } as unknown as WorkOrderController;
    const html = renderToStaticMarkup(React.createElement(ChecklistCard, { step, ctl, assign: null }));
    expect((html.match(/checked=""/g) ?? []).length).toBe(1);
    expect((html.match(/disabled=""/g) ?? []).length).toBe(standards.length);
    // ขั้นที่ปิดแล้วต้องบอกตามหลักฐานที่จดไว้ ไม่ใช่เหมาว่า "ครบ"
    expect(html).toContain(`บันทึกไว้ 1/${standards.length} ข้อ`);
    expect(html).not.toContain(">ครบ<");
    expect(html).toContain("ติ๊กโดย ผู้ตรวจ");
  });

  it("ขั้นที่ยังทำอยู่บอกจำนวนข้อที่เหลือ และติ๊กได้", () => {
    const step = {
      id: "step-2", stepType: "HEAT_PRESS", status: "IN_PROGRESS", assignedTo: { id: "u", name: "บาส" },
      checks: [], outsourceOrders: [],
    } as unknown as ProductionStep;
    const ctl = { canUpdateStep: true, canOwnOrSupervise: () => true, tickPending: false } as unknown as WorkOrderController;
    const html = renderToStaticMarkup(React.createElement(ChecklistCard, { step, ctl, assign: null }));
    expect(html).toContain(`ติ๊กอีก ${workOrderStandards("HEAT_PRESS").length} ข้อ`);
    expect(html).toContain("บาส");
    expect(html).not.toContain('disabled=""');
  });

  it("DTF ที่ยังไม่เสร็จพาไปหน้าพิมพ์ DTF", () => {
    const step = { stepType: "DTF_PRINT", status: "PENDING", printRunItems: [], outsourceOrders: [] } as unknown as ProductionStep;
    expect(dtfUnavailableReason(step)).toContain("หน้าพิมพ์ DTF");
    expect(dtfUnavailableReason({ ...step, status: "COMPLETED" })).toBeNull();
  });
});

describe("ใบรับของร้านนอกใช้ข้อมูลใบที่เลือกและคำสั่งที่ server รองรับ", () => {
  const step = {
    id: "step-1", stepType: "EMBROIDERY", status: "IN_PROGRESS", customStepName: null,
    outsourceOrders: [
      { id: "other", quantity: 90, description: "งานอีกร้าน" },
      { id: "chosen", quantity: 30, description: "ปักแขน", status: "SENT", vendor: { name: "ร้านปัก" } },
    ],
  } as unknown as ProductionStep;

  it("รับ 30 ตัวของใบที่เลือก ไม่ใช้ยอด 120 ตัวทั้งออเดอร์หรือคำสั่งตรวจรับเสื้อลูกค้า", () => {
    const dialog = OutsourceReturnReceipt({ orderId: "order-1", step, outsourceOrderId: "chosen", onClose: vi.fn() });
    expect(dialog?.props).toMatchObject({
      orderId: "order-1", outsourceOrderId: "chosen", receiptType: "OUTSOURCE_RETURN",
      presetLines: [{ description: "ปักแขน", qtyExpected: 30 }],
    });
    expect(dialog?.props).not.toHaveProperty("productionStepId");
    expect(dialog?.props).not.toHaveProperty("operationJobId");
  });

  it("ไม่เปิดใบรับกลับเมื่อ id ไม่ได้อยู่ในขั้นนี้", () => {
    expect(OutsourceReturnReceipt({ orderId: "order-1", step, outsourceOrderId: "missing", onClose: vi.fn() })).toBeNull();
  });

  it("ใบร่างไม่อ้างว่าของอยู่กับร้านแล้ว", () => {
    const draft = { ...step, outsourceOrders: [{ ...step.outsourceOrders[1]!, status: "DRAFT" as const }] };
    const reason = outsourceStepReason(draft);
    expect(reason).toContain("ยังรอส่ง");
    expect(reason).toContain("ยังไม่ยืนยันว่าของออกจากโรงงาน");
    expect(OutsourceReturnReceipt({ orderId: "order-1", step: draft, outsourceOrderId: "chosen", onClose: vi.fn() })).toBeNull();
  });

  it("ใบรับกลับแล้วไม่เปิดฟอร์มรับยอดทั้งใบซ้ำ", () => {
    const received = { ...step, outsourceOrders: [{ ...step.outsourceOrders[1]!, status: "RECEIVED_BACK" as const }] };
    expect(OutsourceReturnReceipt({ orderId: "order-1", step: received, outsourceOrderId: "chosen", onClose: vi.fn() })).toBeNull();
  });

  it("ใบร่างใหม่ไม่บังใบรอรับกลับก่อนหน้าในขั้นที่แบ่งส่งหลายร้าน", () => {
    const split = { ...step, outsourceOrders: [
      { ...step.outsourceOrders[1]!, id: "new-draft", status: "DRAFT" as const },
      step.outsourceOrders[1]!,
      { ...step.outsourceOrders[1]!, id: "second-shop", status: "COMPLETED" as const },
      { ...step.outsourceOrders[1]!, id: "already-received", status: "RECEIVED_BACK" as const },
    ] };
    expect(outsourceReceiptCandidates(split).map((order) => order.id)).toEqual(["chosen", "second-shop"]);
  });
});
