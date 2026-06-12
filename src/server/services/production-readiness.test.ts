import { describe, it, expect } from "vitest";
import { evaluateReadiness, type ReadinessOrderData } from "./production-readiness";

// ด่านพร้อมผลิต: เงินตามเทอม + แบบอนุมัติ + ของครบ — ตีความตาม decision 2026-06-12
// (เครดิตเทอม/COD/ไม่ระบุไม่กั้นเงิน · โรงเย็บไม่กั้นของ · สถานะพ้นเฟสออกแบบ = แบบผ่าน)

const base: ReadinessOrderData = {
  internalStatus: "PRODUCTION_QUEUE",
  paymentTerms: null,
  totalAmount: 10000,
  paidAmount: 0,
  hasApprovedDesign: false,
  printCount: 0,
  stockReservedAt: null,
  stockReservationError: null,
  products: [],
};

const checkOf = (r: ReturnType<typeof evaluateReadiness>, key: string) =>
  r.checks.find((c) => c.key === key)!;

describe("evaluateReadiness — เงินตามเทอม", () => {
  it("ไม่ระบุเทอม/เครดิตเทอม/COD = ไม่กั้น", () => {
    for (const terms of [null, "NET_30", "NET_7", "COD"]) {
      const r = evaluateReadiness({ ...base, paymentTerms: terms });
      expect(checkOf(r, "payment").ok).toBe(true);
    }
  });

  it("มัดจำ 50%: รับไม่ถึงเกณฑ์ = ติด · ถึงเกณฑ์ = ผ่าน", () => {
    const blocked = evaluateReadiness({ ...base, paymentTerms: "DEPOSIT_50", paidAmount: 4999 });
    expect(checkOf(blocked, "payment").ok).toBe(false);
    expect(blocked.ready).toBe(false);
    expect(checkOf(blocked, "payment").waitingOn).toContain("การเงิน");

    const passed = evaluateReadiness({ ...base, paymentTerms: "DEPOSIT_50", paidAmount: 5000 });
    expect(checkOf(passed, "payment").ok).toBe(true);
  });

  it("จ่ายเต็มล่วงหน้า: ต้องรับครบ 100% · เศษสตางค์จาก Decimal ไม่ทำให้ติดปลอม", () => {
    const r1 = evaluateReadiness({ ...base, paymentTerms: "FULL_PREPAY", paidAmount: 9999 });
    expect(checkOf(r1, "payment").ok).toBe(false);
    const r2 = evaluateReadiness({ ...base, paymentTerms: "FULL_PREPAY", paidAmount: 9999.998 });
    expect(checkOf(r2, "payment").ok).toBe(true);
  });

  it("ออเดอร์ยอด 0 (ยังไม่ตีราคา) ไม่กั้นด้วยเงิน", () => {
    const r = evaluateReadiness({
      ...base,
      totalAmount: 0,
      paymentTerms: "DEPOSIT_50",
    });
    expect(checkOf(r, "payment").ok).toBe(true);
  });
});

describe("evaluateReadiness — แบบอนุมัติ", () => {
  it("ไม่มีลายพิมพ์ = ไม่ต้องรอแบบ", () => {
    const r = evaluateReadiness({ ...base, internalStatus: "CONFIRMED", printCount: 0 });
    expect(checkOf(r, "design").ok).toBe(true);
  });

  it("มีลาย + ยังไม่พ้นเฟสออกแบบ + ไม่มีแบบอนุมัติ = ติด", () => {
    const r = evaluateReadiness({ ...base, internalStatus: "CONFIRMED", printCount: 2 });
    expect(checkOf(r, "design").ok).toBe(false);
  });

  it("มีลาย + แบบอนุมัติแล้ว (DesignVersion APPROVED) = ผ่าน", () => {
    const r = evaluateReadiness({
      ...base,
      internalStatus: "CONFIRMED",
      printCount: 2,
      hasApprovedDesign: true,
    });
    expect(checkOf(r, "design").ok).toBe(true);
  });

  it("มีลาย + สถานะพ้นเฟสออกแบบ (เช่น งานสั่งซ้ำข้ามขั้น) = ผ่าน", () => {
    const r = evaluateReadiness({ ...base, internalStatus: "PRODUCTION_QUEUE", printCount: 1 });
    expect(checkOf(r, "design").ok).toBe(true);
  });
});

describe("evaluateReadiness — ของครบ", () => {
  const stockLine = {
    itemSource: "FROM_STOCK",
    receivedInspected: false,
    description: "เสื้อสต๊อค",
  };
  const customerLine = {
    itemSource: "CUSTOMER_PROVIDED",
    receivedInspected: false,
    description: "เสื้อลูกค้า",
  };

  it("เสื้อจากสต๊อค: ยังไม่จอง = ติด · จองแล้ว = ผ่าน · จองพลาด = ติดพร้อมเหตุผล", () => {
    const noReserve = evaluateReadiness({ ...base, products: [stockLine] });
    expect(checkOf(noReserve, "materials").ok).toBe(false);

    const reserved = evaluateReadiness({
      ...base,
      products: [stockLine],
      stockReservedAt: new Date(),
    });
    expect(checkOf(reserved, "materials").ok).toBe(true);

    const failed = evaluateReadiness({
      ...base,
      products: [stockLine],
      stockReservedAt: new Date(),
      stockReservationError: "สต๊อคไม่พอจอง — เสื้อ M ขาด 20",
    });
    expect(checkOf(failed, "materials").ok).toBe(false);
    expect(checkOf(failed, "materials").detail).toContain("สต๊อคไม่พอจอง");
  });

  it("เสื้อลูกค้า: ยังไม่ตรวจรับ = ติด · ตรวจรับแล้ว = ผ่าน", () => {
    const r1 = evaluateReadiness({ ...base, products: [customerLine] });
    expect(checkOf(r1, "materials").ok).toBe(false);
    const r2 = evaluateReadiness({
      ...base,
      products: [{ ...customerLine, receivedInspected: true }],
    });
    expect(checkOf(r2, "materials").ok).toBe(true);
  });

  it("เสื้อโรงเย็บ (CUSTOM_MADE) จงใจไม่กั้น — การเย็บคือขั้นแรกในใบผลิตเอง", () => {
    const r = evaluateReadiness({
      ...base,
      products: [{ itemSource: "CUSTOM_MADE", receivedInspected: false, description: "เย็บใหม่" }],
    });
    expect(checkOf(r, "materials").ok).toBe(true);
    expect(r.ready).toBe(true);
  });

  it("ครบทั้ง 3 ด่าน = ready", () => {
    const r = evaluateReadiness({
      ...base,
      paymentTerms: "DEPOSIT_30",
      paidAmount: 3000,
      printCount: 1,
      hasApprovedDesign: true,
      products: [{ ...stockLine }],
      stockReservedAt: new Date(),
    });
    expect(r.ready).toBe(true);
    expect(r.checks).toHaveLength(3);
  });
});
