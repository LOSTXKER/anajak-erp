import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChecklistCard } from "./work-order-checklist";
import { WorkOrderSteps } from "./work-order-steps";
import { OutsourceReturnReceipt, WorkOrderPrimaryButton, type WorkOrderController } from "./work-order-controller";
import { dtfUnavailableReason, outsourceReceiptCandidates, outsourceStepReason } from "./work-order-pieces";
import { workOrderStandards } from "@/lib/work-order-standards";
import type { ProductionStep } from "./types";

(globalThis as Record<string, unknown>).React = React;

describe("ใบผลิตบอกสถานะและหลักฐานตามข้อมูลจริง", () => {
  function finishedOrder(internalStatus: string) {
    const c = {
      production: { id: "production-1", notes: null },
      order: { id: "order-1", internalStatus, designs: [], customer: { name: "ลูกค้า" }, deadline: null },
      workflowSteps: [], totalQty: 120, nowMs: 0,
    } as unknown as WorkOrderController;
    return renderToStaticMarkup(React.createElement(WorkOrderSteps, {
      c, current: null, pairedOpen: [], allDone: true, qcAction: null,
    }));
  }

  it("ใบนี้ครบแล้วแต่ออเดอร์ยังผลิตอยู่ ต้องไม่อ้างว่าอยู่ QC", () => {
    const html = finishedOrder("PRODUCING");
    expect(html).toContain("กำลังผลิต");
    expect(html).toContain("ดูงานผลิตทั้งออเดอร์");
    expect(html).toContain("/orders/order-1?tab=production");
    expect(html).not.toContain("อยู่ที่ QC");
    expect(html).not.toContain("ไปตรวจ QC");
  });

  it.each([
    ["QUALITY_CHECK", "production", "ไปตรวจ QC"],
    ["PACKING", "delivery", "ดูการแพ็กและจัดส่ง"],
    ["READY_TO_SHIP", "delivery", "พร้อมจัดส่ง"],
    ["COMPLETED", "delivery", "เสร็จสิ้น"],
  ])("สถานะ %s ส่งไปแท็บที่เกี่ยว", (status, tab, text) => {
    const html = finishedOrder(status);
    expect(html).toContain(`/orders/order-1?tab=${tab}`);
    expect(html).toContain(text);
  });

  it("ขั้นปิดแล้วคงผลติ๊กจริง ไม่ติ๊กข้อที่ไม่มีหลักฐานให้เอง", () => {
    const standards = workOrderStandards("HEAT_PRESS");
    const step = {
      id: "step-1", stepType: "HEAT_PRESS", status: "COMPLETED", assignedTo: null,
      checks: [{ itemKey: standards[0], checkedBy: { name: "ผู้ตรวจ" } }], outsourceOrders: [],
    } as unknown as ProductionStep;
    const c = { canUpdateStep: true, canOwnOrSupervise: () => true, tickPending: false } as unknown as WorkOrderController;
    const html = renderToStaticMarkup(React.createElement(ChecklistCard, { step, c, nowMs: 0 }));
    expect((html.match(/checked=""/g) ?? []).length).toBe(1);
    expect((html.match(/disabled=""/g) ?? []).length).toBe(standards.length);
    expect(html).toContain(`1/${standards.length}`);
    expect(html).toContain("ติ๊กโดย ผู้ตรวจ");
  });

  it.each([false, true])("DTF เปิดคิวหรือรอบจริง โดยไม่มีปุ่มเริ่มและปิดขั้นทั่วไป (มีรอบ=%s)", (hasRun) => {
    const step = {
      id: "dtf-step", productionId: "production-1", stepType: "DTF_PRINT",
      status: hasRun ? "IN_PROGRESS" : "PENDING", outsourceOrders: [],
      printRunItems: hasRun ? [{ printRun: { runNumber: "FR-2609-0001", status: "PRINTING" } }] : [],
    } as unknown as ProductionStep;
    const noop = vi.fn();
    const html = renderToStaticMarkup(React.createElement(WorkOrderPrimaryButton, {
      step, now: undefined, busy: false, canUpdateStep: true, canSuperviseStep: true,
      hasProductionPermission: true, canOwnOrSupervise: () => true,
      onStart: noop, onComplete: noop, onQuickPass: noop, onManage: noop,
      onGoodsReceipt: noop, onOutsource: noop,
    }));
    expect(html).toContain(hasRun ? 'href="/production/print-runs?run=FR-2609-0001"' : 'href="/production/print-runs"');
    expect(html).toContain(hasRun ? "เปิดรอบ FR-2609-0001" : "เปิดคิวรอบพิมพ์ DTF");
    expect(html).not.toContain("<button");
    expect(dtfUnavailableReason(step)).toContain(hasRun ? "เปิดรอบเพื่อยืนยันพิมพ์จบ" : "เลือกงานและจำนวนรวมเข้าม้วน");
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
