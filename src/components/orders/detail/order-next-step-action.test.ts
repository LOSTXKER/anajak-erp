import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { NextStep } from "@/lib/order-next-step";
import { OrderNextStepAction, OrderNextStepGuidance, nextStepBlockers } from "./order-next-step-action";

const nextStep: NextStep = {
  title: "เข้าคิวผลิต",
  description: "ตรวจเสื้อให้ครบก่อนส่งเข้าคิวผลิต",
  buttonLabel: "เข้าคิวผลิต",
  action: { type: "STATUS", to: "PRODUCTION_QUEUE" },
};

const readiness = {
  ready: false,
  checks: [
    { key: "payment", label: "เงินตามเทอม", ok: false, detail: "รับแล้ว 1,000/3,000 บาท", waitingOn: "การเงินตามลูกค้า" },
    { key: "materials", label: "เสื้อ", ok: false, detail: "ยังไม่ได้ตรวจรับ 2 รายการ", waitingOn: "รอคลังตรวจรับ" },
  ],
};

const callbacks = { onStatus: () => {}, onAnchor: () => {} };

describe("คำแนะนำขั้นต่อไปของออเดอร์", () => {
  it("แสดงคำช่วยบนหน้าและผูกกับปุ่มโดยไม่ต้องใช้ hover", () => {
    const props = { nextStep, readiness: { ready: true, checks: [] }, ...callbacks };
    const guidance = renderToStaticMarkup(createElement(OrderNextStepGuidance, props));
    const action = renderToStaticMarkup(createElement(OrderNextStepAction, { ...props, isPending: false }));
    expect(guidance).toContain(nextStep.description);
    expect(action).toContain('aria-describedby="order-next-step-guidance"');
    expect(action).not.toContain('title=');
  });

  it("งานติดด่านยังเดินสถานะไม่ได้ แต่มีทางไปแก้และรู้จำนวนที่ขาดพร้อมคนที่รอ", () => {
    const props = { nextStep, readiness, ...callbacks };
    expect(renderToStaticMarkup(createElement(OrderNextStepAction, { ...props, isPending: false }))).toBe("");
    const guidance = renderToStaticMarkup(createElement(OrderNextStepGuidance, props));
    expect(guidance).toContain("ดูเงินและบิล");
    expect(guidance).toContain("ตรวจเสื้อและใบผลิต");
    expect(nextStepBlockers(nextStep, readiness)[0]).toContain("1,000/3,000");
    expect(nextStepBlockers(nextStep, readiness)[0]).toContain("การเงินตามลูกค้า");
  });

  it("ผู้ไม่มีสิทธิ์เงินไม่เห็นทางเข้าการเงิน และเห็นคนที่ต้องรอแทนคำสั่งที่ทำไม่ได้", () => {
    const blocked = renderToStaticMarkup(createElement(OrderNextStepGuidance, {
      nextStep, readiness, ...callbacks, canSeeMoney: false,
    }));
    expect(blocked).not.toContain("ดูเงินและบิล");
    const waiting = renderToStaticMarkup(createElement(OrderNextStepGuidance, {
      nextStep: { ...nextStep, action: { type: "ANCHOR", target: "billing" } },
      readiness: null, ...callbacks, canSeeMoney: false,
    }));
    expect(waiting).toContain("รอฝ่ายขายหรือการเงิน");
    expect(waiting).not.toContain(nextStep.description);
  });
});
