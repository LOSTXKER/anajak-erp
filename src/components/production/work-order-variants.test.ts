import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useProtoController } from "@/app/proto/work-order-states/_controller";
import { makeOrder, stateOf, type Role } from "@/app/proto/work-order-states/_fixtures";
import { UiResetWorkOrder } from "@/app/proto/ui-reset/_work-order";
import { WorkOrderStepReadOnly, WorkOrderView } from "./work-order-page";
import { WorkOrderRouteOverview, type WorkOrderVariant } from "./work-order-steps";
import { WorkOrderPrimaryButton, type WorkOrderController } from "./work-order-controller";
import { operationsBack, operationsOrigin } from "./operations-navigation";

(globalThis as Record<string, unknown>).React = React;

function FixtureView({ scenario = "doing", variant, role = "boss" }: { scenario?: string; variant?: WorkOrderVariant; role?: Role }) {
  const c = useProtoController(stateOf(scenario), role);
  return React.createElement(WorkOrderView, { c, variant, itemsTab: React.createElement("p", null, "รายการตัวอย่าง") });
}

function render(scenario: string, variant?: WorkOrderVariant, role?: Role) {
  return renderToStaticMarkup(React.createElement(FixtureView, { scenario, variant, role }));
}

describe("หน้าลองใบผลิตคงคำสั่งจริงและแยกการอ่านออกจากการลงมือ", () => {
  it.each(["dtf-run", "outsource-shop"])("จอช่างเปิด %s แล้วกลับขั้นเดิมได้", (scenario) => {
    const step = stateOf(scenario).steps.find((item) => item.status === "IN_PROGRESS")!;
    const noop = vi.fn();
    const html = renderToStaticMarkup(React.createElement(WorkOrderPrimaryButton, {
      step, now: undefined, options: { touch: true }, busy: false,
      canUpdateStep: true, canSuperviseStep: false, hasProductionPermission: true,
      canOwnOrSupervise: () => true,
      onStart: noop, onComplete: noop, onQuickPass: noop, onManage: noop,
      onGoodsReceipt: noop, onOutsource: noop,
    }));
    const href = html.match(/href="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
    expect(href).toBeTruthy();
    const url = new URL(href!, "http://localhost");
    expect(url.pathname).toBe(scenario === "dtf-run" ? "/production/print-runs" : "/production/outsource");
    if (scenario === "dtf-run") expect(url.searchParams.get("run")).toBe("PR-2609-0007");
    const back = new URL(operationsBack(operationsOrigin(Object.fromEntries(url.searchParams))).href, "http://localhost");
    expect(back.pathname).toBe("/production/floor");
    expect(back.searchParams.get("job")).toBe(step.productionId);
    expect(back.searchParams.get("step")).toBe(step.id);
    expect(noop).not.toHaveBeenCalled();
  });

  it("เวลาตัวอย่างตรงกันแม้ server และ browser เปิดคนละนาที", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-11T14:00:00Z"));
      const serverOrder = makeOrder({});
      const serverHtml = render("doing", "a");
      vi.setSystemTime(new Date("2026-09-11T14:10:00Z"));
      expect(makeOrder({}).deadline).toEqual(serverOrder.deadline);
      expect(makeOrder({}).designs[0]?.approvedAt).toEqual(serverOrder.designs[0]?.approvedAt);
      expect(render("doing", "a")).toBe(serverHtml);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ไม่ส่ง variant ให้หน้าเดิมเหมือนส่ง current ทุกตัวอักษร", () => {
    expect(render("doing")).toBe(render("doing", "current"));
  });

  it("ใบจริงให้เลือกเปิดอ่านขั้น และบอกพร้อมทำแยกจากกำลังทำ", () => {
    const ready = render("start");
    expect(ready).toContain('aria-label="เลือกขั้นเพื่อเปิดดู"');
    expect(ready).toContain('aria-label="เปิดดู รีดร้อน · พร้อมทำ"');
    expect(ready).toContain('aria-label="เปิดดู ตรวจคุณภาพขั้นสุดท้าย · ยังไม่ถึง"');
    expect(render("doing")).toContain('aria-label="เปิดดู รีดร้อน · กำลังทำ"');
  });

  it("การเปิดอ่านขั้นไม่มีช่องเขียนหรือคำสั่งปิดขั้น แต่คงสินค้าและผลตรวจจริง", () => {
    function ReadOnlyFixture() {
      const c = useProtoController(stateOf("doing"), "boss");
      return React.createElement(WorkOrderStepReadOnly, { c, step: c.workflowSteps[0]!, onReturn: vi.fn(), allDone: false });
    }
    const html = renderToStaticMarkup(React.createElement(ReadOnlyFixture));
    expect(html).toContain("อ่านอย่างเดียว");
    expect(html).toContain("ผลตรวจที่บันทึก");
    expect(html).toContain("ติ๊กโดย");
    expect(html).toContain("ยังไม่มีผลตรวจ");
    expect(html).toContain("กลับขั้นปัจจุบัน");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("ปิดขั้นนี้");
    expect(html).not.toContain("เปลี่ยนคนทำ");
  });

  it.each(["a", "b"] as const)("แบบ %s ยกคำสั่งขึ้นก่อนตารางโดยรักษาช่องยอดและผลตรวจเดิม", (variant) => {
    const current = render("doing", "current");
    const html = render("doing", variant);
    expect(html.indexOf("ปิดขั้นนี้")).toBeLessThan(html.indexOf('id="work-order-pieces-s-press"'));
    expect(html.match(/type="number"/g)?.length).toBe(current.match(/type="number"/g)?.length);
    expect(html.match(/type="checkbox"/g)?.length).toBe(current.match(/type="checkbox"/g)?.length);
    expect(html.match(/checked=""/g)?.length).toBe(1);
    expect(html).toContain("ติ๊กข้อกำหนดของขั้นนี้อีก 2 ข้อ");
    expect(html).toContain("ใส่ครบทุกไซซ์");
    expect(html).toContain("เปลี่ยนคนทำ");
    expect(html).not.toContain("ยังไปต่อไม่ได้");
  });

  it.each(["a", "b"] as const)("แบบ %s ไม่เรียกขั้นพร้อมเริ่มว่ากำลังทำ", (variant) => {
    const html = render("start", variant);
    expect(html).toContain("พร้อมทำ");
    expect(html).toContain("เริ่มทำ");
    expect(html).not.toContain("กำลังดำเนินการ");
    expect(html).not.toContain("กด “เริ่มทำ” เมื่อพร้อมลงมือ");
    expect(html).not.toContain("ยังไปต่อไม่ได้");
  });

  it("เส้นทางเปิดอ่านขั้นที่ปิดแล้ว/ยังไม่เริ่มโดยไม่เพิ่มปุ่มลงมือหรือเรียก controller", () => {
    const fx = stateOf("pair");
    const mutation = vi.fn();
    const c = { workflowSteps: fx.steps, nowById: new Map(), nowMs: 0, tickStandard: mutation, savePieceQty: mutation, setSelectedStepId: mutation } as unknown as WorkOrderController;
    const html = renderToStaticMarkup(React.createElement(WorkOrderRouteOverview, { c, vertical: true }));
    expect(html.match(/<details/g)?.length).toBe(fx.steps.length);
    expect(html).toContain("ผ่านแล้ว");
    expect(html).toContain("ยังไม่ได้เริ่ม");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<input");
    expect(mutation).not.toHaveBeenCalled();
    expect(fx.steps.at(-1)?.status).toBe("PENDING");
  });

  it("ขั้น QC ที่ยังไม่ถึงไม่ใช้คำว่าพร้อมทำจาก now-action ของแต่ละขั้น", () => {
    const html = render("doing", "a");
    const summaries = html.match(/<summary[\s\S]*?<\/summary>/g) ?? [];
    expect(summaries).toHaveLength(2);
    expect(summaries.at(-1)).toContain("ยังไม่ถึง");
    expect(summaries.at(-1)).not.toContain("พร้อมทำ");
  });

  it.each(["a", "b"] as const)("แบบ %s คงขั้นคู่ทั้งสองและไม่เพิ่มช่องยอดร้านนอก", (variant) => {
    const current = render("pair", "current");
    const html = render("pair", variant);
    expect(html).toContain('id="work-order-task-s-fold"');
    expect(html).toContain('id="work-order-task-s-emb"');
    expect(html.match(/type="number"/g)?.length).toBe(current.match(/type="number"/g)?.length);
    expect(html).toContain("บันทึกหลักฐานรับกลับ");
    expect(html).toContain("ยืนยันรับกลับและผลตรวจจากหน้าใบงานร้านนอก");
    expect(html).toContain("/production/outsource?production=");
  });

  it("งานติดปัญหาคงเหตุและกั้นการแก้ยอด/ผลตรวจ", () => {
    const html = render("problem", "b");
    expect(html).toContain("ฟิล์มลอกหลังรีด");
    expect(html).not.toContain('type="number"');
    const checkboxes = html.match(/<input[^>]+type="checkbox"[^>]*>/g) ?? [];
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes.every((input) => input.includes('disabled=""'))).toBe(true);
  });

  it("สิทธิ์หน้าลองของคนทำไม่มีปุ่มเปลี่ยนคนทำของหัวหน้า", () => {
    const html = render("doing", "a", "staff");
    expect(html).not.toContain("เปลี่ยนคนทำ");
    expect(html).toContain("ปิดขั้นนี้");
  });

  it.each(["doing", "pair", "problem"] as const)("adapter %s เปิดทุกแบบได้โดยไม่ใช้ tRPC provider หรือฟอร์มตรวจรับจริง", (scenario) => {
    for (const variant of ["current", "a", "b"] as const) {
      const html = renderToStaticMarkup(React.createElement(UiResetWorkOrder, { variant, scenario }));
      expect(html).toContain("ORD-2609-0031");
      expect(html).not.toContain("แก้ยอดตรวจรับเสื้อ");
      expect(html).not.toContain('href="/print/');
      expect(html).not.toContain('href="/production');
    }
  });
});
