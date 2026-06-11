import { describe, it, expect } from "vitest";
import { getOrderNextStep, type NextStepInput } from "./order-next-step";

const base: NextStepInput = {
  internalStatus: "INQUIRY",
  orderType: "CUSTOM",
  itemCount: 1,
  totalAmount: 1000,
  paymentTerms: null,
  hasInvoice: false,
  hasPendingDesign: false,
  hasApprovedDesign: false,
  hasProduction: false,
  hasDelivery: false,
  billingHandled: false,
};

describe("getOrderNextStep — จุดโฟกัสเดียวต่อสถานะ", () => {
  it("จบ/ยกเลิกแล้ว → ไม่มีขั้นถัดไป", () => {
    expect(getOrderNextStep({ ...base, internalStatus: "COMPLETED" })).toBeNull();
    expect(getOrderNextStep({ ...base, internalStatus: "CANCELLED" })).toBeNull();
  });

  it("ไม่มีรายการ → ชี้ไปใส่รายการก่อนเสมอ (ทุกสถานะที่ยังแก้ได้)", () => {
    const step = getOrderNextStep({ ...base, itemCount: 0 });
    expect(step?.action).toEqual({ type: "EDIT_ITEMS" });
  });

  it("ร่าง → เปิดงานไปสถานะแรกของเส้นทางตามชนิด (custom=สอบถาม / สำเร็จรูป=ยืนยัน)", () => {
    expect(getOrderNextStep({ ...base, internalStatus: "DRAFT" })?.action).toEqual({
      type: "STATUS",
      to: "INQUIRY",
    });
    expect(
      getOrderNextStep({ ...base, internalStatus: "DRAFT", orderType: "READY_MADE" })?.action
    ).toEqual({ type: "STATUS", to: "CONFIRMED" });
  });

  it("สอบถาม+มีรายการ → ยืนยันออเดอร์", () => {
    const step = getOrderNextStep(base);
    expect(step?.action).toEqual({ type: "STATUS", to: "CONFIRMED" });
  });

  it("ยืนยันแล้ว+เทอมมัดจำ+ยังไม่มีบิล → ชี้ไปเรียกมัดจำ", () => {
    const step = getOrderNextStep({
      ...base,
      internalStatus: "CONFIRMED",
      paymentTerms: "DEPOSIT_50",
    });
    expect(step?.action).toEqual({ type: "ANCHOR", target: "billing" });
    expect(step?.title).toContain("มัดจำ");
  });

  it("ยืนยันแล้ว+มัดจำเก็บแล้ว → ส่งเข้าออกแบบ (DESIGNING ตรง)", () => {
    const step = getOrderNextStep({
      ...base,
      internalStatus: "CONFIRMED",
      paymentTerms: "DEPOSIT_50",
      hasInvoice: true,
    });
    expect(step?.action).toEqual({ type: "STATUS", to: "DESIGNING" });
  });

  it("ยืนยันแล้ว+สำเร็จรูป → เข้าคิวผลิตตรง (ไม่ผ่านออกแบบ — state machine ไม่ยอม)", () => {
    const step = getOrderNextStep({
      ...base,
      internalStatus: "CONFIRMED",
      orderType: "READY_MADE",
    });
    expect(step?.action).toEqual({ type: "STATUS", to: "PRODUCTION_QUEUE" });
  });

  it("งานพัก → จุดกลับตามหลักฐาน: มีใบผลิต=คิวผลิต / ยังไม่มี=ยืนยันออเดอร์", () => {
    expect(getOrderNextStep({ ...base, internalStatus: "ON_HOLD" })?.action).toEqual({
      type: "STATUS",
      to: "CONFIRMED",
    });
    expect(
      getOrderNextStep({ ...base, internalStatus: "ON_HOLD", hasProduction: true })?.action
    ).toEqual({ type: "STATUS", to: "PRODUCTION_QUEUE" });
  });

  it("รอออกแบบ+ยังไม่มีไฟล์แบบ → ชี้ไปอัปโหลดแบบ", () => {
    const step = getOrderNextStep({ ...base, internalStatus: "DESIGNING" });
    expect(step?.title).toContain("อัปโหลดแบบ");
    expect(step?.action).toEqual({ type: "ANCHOR", target: "design" });
  });

  it("แบบอนุมัติแล้ว → เปิดใบผลิต", () => {
    const step = getOrderNextStep({
      ...base,
      internalStatus: "DESIGN_APPROVED",
      hasApprovedDesign: true,
    });
    expect(step?.action).toEqual({ type: "ANCHOR", target: "production" });
  });

  it("พร้อมส่ง → ชี้ไปส่วนจัดส่งเสมอ (สร้างใบส่ง/กดส่งที่ใบส่ง — ไม่ใช่ปุ่มข้าม)", () => {
    expect(getOrderNextStep({ ...base, internalStatus: "READY_TO_SHIP" })?.action).toEqual({
      type: "ANCHOR",
      target: "delivery",
    });
    expect(
      getOrderNextStep({ ...base, internalStatus: "READY_TO_SHIP", hasDelivery: true })?.action
    ).toEqual({ type: "ANCHOR", target: "delivery" });
  });

  it("ส่งแล้ว+วางบิลไม่ครบ → ชี้ไปวางบิล ไม่ใช่ปิดงาน", () => {
    const step = getOrderNextStep({ ...base, internalStatus: "SHIPPED" });
    expect(step?.action).toEqual({ type: "ANCHOR", target: "billing" });
  });

  it("ส่งแล้ว+วางบิลครบ → ปิดงาน", () => {
    const step = getOrderNextStep({
      ...base,
      internalStatus: "SHIPPED",
      billingHandled: true,
    });
    expect(step?.action).toEqual({ type: "STATUS", to: "COMPLETED" });
  });
});
