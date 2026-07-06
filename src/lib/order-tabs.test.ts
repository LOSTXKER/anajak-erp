import { describe, it, expect } from "vitest";
import {
  defaultTabForStatus,
  tabForAnchor,
  buildNextStepInput,
  shouldGateOnReadiness,
} from "./order-tabs";
import type { NextStepAction } from "./order-next-step";

describe("defaultTabForStatus — แท็บเริ่มต้นตามสถานะ", () => {
  it("ช่วงผลิตเปิดแท็บงานผลิต", () => {
    for (const s of ["DESIGNING", "DESIGN_APPROVED", "PRODUCTION_QUEUE", "PRODUCING", "QUALITY_CHECK", "PACKING"]) {
      expect(defaultTabForStatus(s)).toBe("production");
    }
  });
  it("ช่วงส่งเปิดแท็บจัดส่ง", () => {
    expect(defaultTabForStatus("READY_TO_SHIP")).toBe("delivery");
    expect(defaultTabForStatus("SHIPPED")).toBe("delivery");
  });
  it("ช่วงต้น/ปิด/พัก เปิดภาพรวม", () => {
    for (const s of ["DRAFT", "INQUIRY", "CONFIRMED", "COMPLETED", "CANCELLED", "ON_HOLD"]) {
      expect(defaultTabForStatus(s)).toBe("overview");
    }
  });
});

describe("tabForAnchor — ANCHOR → แท็บ", () => {
  it("design/production/qc → production · delivery → delivery", () => {
    expect(tabForAnchor("design")).toBe("production");
    expect(tabForAnchor("production")).toBe("production");
    expect(tabForAnchor("qc")).toBe("production");
    expect(tabForAnchor("delivery")).toBe("delivery");
  });
  it("billing → null (อยู่ sidebar ไม่สลับแท็บ)", () => {
    expect(tabForAnchor("billing")).toBeNull();
  });
});

describe("shouldGateOnReadiness — บล็อกเฉพาะ STATUS→PRODUCTION_QUEUE", () => {
  const notReady = { ready: false };
  const ready = { ready: true };

  it("บล็อกเมื่อเข้าคิวผลิต (PRODUCTION_QUEUE) + ด่านไม่ผ่าน", () => {
    const a: NextStepAction = { type: "STATUS", to: "PRODUCTION_QUEUE" };
    expect(shouldGateOnReadiness(a, notReady)).toBe(true);
    expect(shouldGateOnReadiness(a, ready)).toBe(false);
    expect(shouldGateOnReadiness(a, null)).toBe(false);
  });

  it("ไม่บล็อก STATUS อื่นที่ server ไม่เช็ค readiness (กันบล็อกผิด)", () => {
    // CONFIRMED→DESIGNING (วงกลม) · INQUIRY→CONFIRMED · SHIPPED→COMPLETED · QC→PACKING
    for (const to of ["DESIGNING", "CONFIRMED", "COMPLETED", "PACKING", "READY_TO_SHIP"]) {
      expect(shouldGateOnReadiness({ type: "STATUS", to }, notReady)).toBe(false);
    }
  });

  it("ไม่บล็อก action ที่ไม่ใช่ STATUS (EDIT_ITEMS/ANCHOR/NONE)", () => {
    expect(shouldGateOnReadiness({ type: "EDIT_ITEMS" }, notReady)).toBe(false);
    expect(shouldGateOnReadiness({ type: "ANCHOR", target: "production" }, notReady)).toBe(false);
    expect(shouldGateOnReadiness({ type: "NONE" }, notReady)).toBe(false);
  });
});

describe("buildNextStepInput — map + สูตร billingHandled (เป๊ะตาม server)", () => {
  const base = {
    internalStatus: "SHIPPED",
    orderType: "CUSTOM",
    totalAmount: 1000,
    paymentTerms: "NET_30",
    items: [{}, {}],
    invoices: [],
    designs: [],
    productions: [],
    deliveries: [],
  };

  it("นับ field พื้นฐานถูก (item/invoice/design/production/delivery)", () => {
    const input = buildNextStepInput({
      ...base,
      invoices: [{ isVoided: false, type: "DEPOSIT_INVOICE", totalAmount: 500 }],
      designs: [{ approvalStatus: "PENDING" }, { approvalStatus: "APPROVED" }],
      productions: [{}],
      deliveries: [{}],
    });
    expect(input.itemCount).toBe(2);
    expect(input.hasInvoice).toBe(true);
    expect(input.hasPendingDesign).toBe(true);
    expect(input.hasApprovedDesign).toBe(true);
    expect(input.hasProduction).toBe(true);
    expect(input.hasDelivery).toBe(true);
  });

  it("ใบ void ไม่นับเป็น hasInvoice / ไม่เข้าสูตร billing", () => {
    const input = buildNextStepInput({
      ...base,
      invoices: [{ isVoided: true, type: "FINAL_INVOICE", totalAmount: 1000 }],
    });
    expect(input.hasInvoice).toBe(false);
    expect(input.billingHandled).toBe(false);
  });

  it("billingHandled: max(D+F, ใบเสร็จ) ≥ ยอด", () => {
    // วางบิล D+F ครบ 1000 → ปิดได้
    expect(
      buildNextStepInput({
        ...base,
        invoices: [
          { isVoided: false, type: "DEPOSIT_INVOICE", totalAmount: 300 },
          { isVoided: false, type: "FINAL_INVOICE", totalAmount: 700 },
        ],
      }).billingHandled
    ).toBe(true);
    // ใบเสร็จล้วน 1000 (ขายสด) → ปิดได้
    expect(
      buildNextStepInput({
        ...base,
        invoices: [{ isVoided: false, type: "RECEIPT", totalAmount: 1000 }],
      }).billingHandled
    ).toBe(true);
    // วางบิลแค่ 500 → ยังปิดไม่ได้
    expect(
      buildNextStepInput({
        ...base,
        invoices: [{ isVoided: false, type: "DEPOSIT_INVOICE", totalAmount: 500 }],
      }).billingHandled
    ).toBe(false);
    // D+F กับใบเสร็จ "ไม่บวกกัน" (กันนับซ้ำ) — D+F 600, ใบเสร็จ 600 → max=600 < 1000
    expect(
      buildNextStepInput({
        ...base,
        invoices: [
          { isVoided: false, type: "FINAL_INVOICE", totalAmount: 600 },
          { isVoided: false, type: "RECEIPT", totalAmount: 600 },
        ],
      }).billingHandled
    ).toBe(false);
  });

  it("ยอด ≤ 0 → ไม่กั้น (billingHandled true)", () => {
    expect(buildNextStepInput({ ...base, totalAmount: 0, invoices: [] }).billingHandled).toBe(true);
  });

  // ⑦ (เบสเคาะ 2026-07-06): viewer ที่ไม่เห็นเงิน ได้ totalAmount = null จาก server —
  // billingHandled จะเป็น true (แถบไม่บ่นเรื่องวางบิล ซึ่งไม่ใช่งานของช่างอยู่แล้ว)
  // แต่ hasInvoice ต้องยังจริง (หัวใบยังส่งมา) — pin ไว้กันคนหลังแก้ ?? 0 แล้วพัง
  it("ช่าง (เงินโดน strip เป็น null) → billingHandled=true + hasInvoice ยังถูก", () => {
    const input = buildNextStepInput({
      ...base,
      totalAmount: null,
      invoices: [{ isVoided: false, type: "DEPOSIT_INVOICE", totalAmount: null }],
    });
    expect(input.billingHandled).toBe(true);
    expect(input.hasInvoice).toBe(true);
    expect(input.totalAmount).toBe(0);
  });
});
