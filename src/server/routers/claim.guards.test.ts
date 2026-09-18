import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { claimRouter } from "./claim";

/**
 * ด่านของใบเคลม (ก้อน 1) — ยิงผ่าน router จริงบน prisma ปลอม
 * พิสูจน์สามข้อที่ตัวตรวจแบบชี้ว่าจะพังถ้าไม่กัน:
 *   1. ตัดสิน "ลดราคา/คืนเงิน" ตอนยังไม่มีใบกำกับ = ใบเคลมจะปิดไม่ลงตลอดกาล
 *   2. สั่งงานแก้ทั้งที่ยังไม่ตัดสิน = เดินสถานะออเดอร์โดยไม่มีคนรับผิดชอบ
 *   3. ยกเลิกเรื่องหลังสั่งงานแก้ไปแล้ว = งานค้างในสายผลิตโดยไม่มีใบกำกับหัว
 */
function contextFor(options: {
  role: Context["userRole"];
  claim?: Record<string, unknown> | null;
  billableInvoices?: number;
}) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    orderClaim: { update: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    orderRevision: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
    order: { findUniqueOrThrow: vi.fn() },
  };
  const ctx: Context = {
    prisma: {
      orderClaim: { findUnique: vi.fn().mockResolvedValue(options.claim ?? null) },
      invoice: { count: vi.fn().mockResolvedValue(options.billableInvoices ?? 0) },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn(async (callback: (transaction: unknown) => unknown) => callback(tx)),
    } as unknown as Context["prisma"],
    userId: "user-1",
    userRole: options.role,
    permissionOverrides: null,
  };
  return { ctx, tx };
}

const DECIDE_INPUT = {
  id: "claim-1",
  resolution: "DISCOUNT" as const,
  fault: "SHOP" as const,
  agreedCredit: 1500,
  agreedCharge: 0,
};

describe("claim.decide", () => {
  it("ลดราคาตอนออเดอร์ยังไม่มีใบกำกับ = ปฏิเสธพร้อมบอกทางไปต่อ", async () => {
    const { ctx, tx } = contextFor({
      role: "SALES",
      claim: { id: "claim-1", state: "OPEN", orderId: "order-1", claimNumber: "CLM-2609-0001" },
      billableInvoices: 0,
    });

    await expect(claimRouter.createCaller(ctx).decide(DECIDE_INPUT)).rejects.toThrow(
      "ยังไม่ได้วางบิล",
    );
    expect(tx.orderClaim.update).not.toHaveBeenCalled();
  });

  it("มีใบกำกับแล้ว ฝ่ายขายตัดสินได้ (เบสเคาะ 2026-09-18)", async () => {
    const { ctx, tx } = contextFor({
      role: "SALES",
      claim: { id: "claim-1", state: "OPEN", orderId: "order-1", claimNumber: "CLM-2609-0001" },
      billableInvoices: 1,
    });
    tx.orderClaim.update.mockResolvedValue({ id: "claim-1", state: "DECIDED" });

    await claimRouter.createCaller(ctx).decide(DECIDE_INPUT);
    expect(tx.orderClaim.update).toHaveBeenCalledOnce();
    expect(tx.orderRevision.create).toHaveBeenCalledOnce();
  });

  it("ช่างตัดสินไม่ได้ — สิทธิ์ decide_claims ไม่ได้ให้ฝ่ายผลิต", async () => {
    const { ctx, tx } = contextFor({
      role: "PRODUCTION_STAFF",
      claim: { id: "claim-1", state: "OPEN", orderId: "order-1", claimNumber: "CLM-2609-0001" },
      billableInvoices: 1,
    });

    await expect(claimRouter.createCaller(ctx).decide(DECIDE_INPUT)).rejects.toThrow();
    expect(tx.orderClaim.update).not.toHaveBeenCalled();
  });

  it("ใบที่ปิดไปแล้ว ตัดสินซ้ำไม่ได้", async () => {
    const { ctx, tx } = contextFor({
      role: "MANAGER",
      claim: { id: "claim-1", state: "CLOSED", orderId: "order-1", claimNumber: "CLM-2609-0001" },
      billableInvoices: 1,
    });

    await expect(claimRouter.createCaller(ctx).decide(DECIDE_INPUT)).rejects.toThrow("จบไปแล้ว");
    expect(tx.orderClaim.update).not.toHaveBeenCalled();
  });
});

describe("claim.startRework", () => {
  it("ยังไม่ตัดสิน = สั่งงานแก้ไม่ได้", async () => {
    const { ctx, tx } = contextFor({
      role: "MANAGER",
      claim: {
        id: "claim-1",
        state: "OPEN",
        resolution: null,
        orderId: "order-1",
        claimNumber: "CLM-2609-0001",
        round: 1,
      },
    });

    await expect(claimRouter.createCaller(ctx).startRework({ id: "claim-1" })).rejects.toThrow(
      "ยังไม่ได้ตัดสิน",
    );
    expect(tx.order.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("ตัดสินว่าลดราคา (ไม่ใช่ซ่อม) = สั่งงานแก้ไม่ได้", async () => {
    const { ctx, tx } = contextFor({
      role: "MANAGER",
      claim: {
        id: "claim-1",
        state: "DECIDED",
        resolution: "DISCOUNT",
        orderId: "order-1",
        claimNumber: "CLM-2609-0001",
        round: 1,
      },
    });

    await expect(claimRouter.createCaller(ctx).startRework({ id: "claim-1" })).rejects.toThrow(
      "ยังไม่ได้ตัดสิน",
    );
    expect(tx.order.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("ฝ่ายขายสั่งงานแก้เองไม่ได้ — ขานี้ถอยสถานะข้ามเส้น ต้องหัวหน้า", async () => {
    const { ctx } = contextFor({
      role: "SALES",
      claim: {
        id: "claim-1",
        state: "DECIDED",
        resolution: "REWORK",
        orderId: "order-1",
        claimNumber: "CLM-2609-0001",
        round: 1,
      },
    });

    await expect(claimRouter.createCaller(ctx).startRework({ id: "claim-1" })).rejects.toThrow();
  });
});

describe("claim.cancel", () => {
  it("สั่งงานแก้เข้าสายผลิตไปแล้ว ยกเลิกเรื่องไม่ได้", async () => {
    const { ctx, tx } = contextFor({
      role: "MANAGER",
      claim: {
        id: "claim-1",
        state: "DECIDED",
        orderId: "order-1",
        claimNumber: "CLM-2609-0001",
        steps: [{ id: "step-1" }],
      },
    });

    await expect(
      claimRouter.createCaller(ctx).cancel({ id: "claim-1", reason: "ลูกค้าถอนเรื่อง" }),
    ).rejects.toThrow("ยกเลิกเรื่องไม่ได้");
    expect(tx.orderClaim.update).not.toHaveBeenCalled();
  });
});
