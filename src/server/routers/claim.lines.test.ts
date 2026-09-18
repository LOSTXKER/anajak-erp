import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { claimRouter } from "./claim";

/**
 * จำนวนที่เสียรายไซซ์ (เบสยืนยัน "S เสีย 3 M เสีย 2" · เคาะหน้าตาจากหน้าลอง 2026-09-19)
 *
 * ก้อน 1 มีตารางรองรับตั้งแต่แรก แต่ไม่มีทางกรอกบนจอ — ใบเคลมจริงบนเว็บจึงไม่มีจำนวนเลย
 * เทสต์นี้ล็อกทางเขียนใหม่: แทนของเดิมทั้งชุด · ใบที่จบแล้วห้ามแก้ · เขียนประวัติทุกครั้ง
 */
function contextFor(options: { role: Context["userRole"]; claim?: Record<string, unknown> | null }) {
  const tx = {
    orderClaimLine: { deleteMany: vi.fn(), createMany: vi.fn() },
    orderRevision: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  const ctx: Context = {
    prisma: {
      orderClaim: { findUnique: vi.fn().mockResolvedValue(options.claim ?? null) },
      orderItemVariant: {
        findMany: vi.fn().mockResolvedValue([
          { size: "M", quantity: 30 },
          { size: "S", quantity: 18 },
          { size: "M", quantity: 10 },
          { size: "ฟรีไซซ์", quantity: 4 },
        ]),
      },
      $transaction: vi.fn(async (callback: (transaction: unknown) => unknown) => callback(tx)),
    } as unknown as Context["prisma"],
    userId: "user-1",
    userRole: options.role,
    permissionOverrides: null,
  };
  return { ctx, tx };
}

const OPEN_CLAIM = { id: "claim-1", state: "OPEN", orderId: "order-1", claimNumber: "CLM-2609-0001" };

describe("claim.orderSizes", () => {
  it("รวมไซซ์ข้ามรายการสินค้า และเรียงตามลำดับไซซ์จริง ไม่ใช่ตามตัวอักษร", async () => {
    const { ctx } = contextFor({ role: "SALES" });
    const rows = await claimRouter.createCaller(ctx).orderSizes({ orderId: "order-1" });
    expect(rows).toEqual([
      { size: "S", sent: 18 },
      { size: "M", sent: 40 },
      { size: "ฟรีไซซ์", sent: 4 },
    ]);
  });
});

describe("claim.setLines", () => {
  it("แทนของเดิมทั้งชุด และจดประวัติพร้อมยอดรวม", async () => {
    const { ctx, tx } = contextFor({ role: "MANAGER", claim: OPEN_CLAIM });
    const result = await claimRouter
      .createCaller(ctx)
      .setLines({ id: "claim-1", lines: [{ size: "M", qtyClaimed: 7 }, { size: "L", qtyClaimed: 5 }] });

    expect(result).toEqual({ total: 12 });
    expect(tx.orderClaimLine.deleteMany).toHaveBeenCalledWith({ where: { claimId: "claim-1" } });
    expect(tx.orderClaimLine.createMany).toHaveBeenCalledOnce();
    expect(tx.orderRevision.create).toHaveBeenCalledOnce();
    const revision = tx.orderRevision.create.mock.calls[0][0].data.description as string;
    expect(revision).toContain("รวม 12 ตัว");
  });

  it("ส่งรายการว่างมา = ล้างของเดิม ไม่ใช่ error (ยังไม่รู้จำนวนก็มีจริง)", async () => {
    const { ctx, tx } = contextFor({ role: "MANAGER", claim: OPEN_CLAIM });
    await claimRouter.createCaller(ctx).setLines({ id: "claim-1", lines: [] });
    expect(tx.orderClaimLine.deleteMany).toHaveBeenCalledOnce();
    expect(tx.orderClaimLine.createMany).not.toHaveBeenCalled();
  });

  it("ใบที่ปิดแล้วแก้จำนวนย้อนหลังไม่ได้ — จำนวนคือฐานของเอกสารเงินที่ออกไปแล้ว", async () => {
    const { ctx, tx } = contextFor({ role: "MANAGER", claim: { ...OPEN_CLAIM, state: "CLOSED" } });
    await expect(
      claimRouter.createCaller(ctx).setLines({ id: "claim-1", lines: [{ size: "M", qtyClaimed: 1 }] }),
    ).rejects.toThrow("จบไปแล้ว");
    expect(tx.orderClaimLine.deleteMany).not.toHaveBeenCalled();
  });

  it("ช่างแก้จำนวนไม่ได้ — ใช้กุญแจเดียวกับการตัดสินใบเคลม", async () => {
    const { ctx } = contextFor({ role: "PRODUCTION_STAFF", claim: OPEN_CLAIM });
    await expect(
      claimRouter.createCaller(ctx).setLines({ id: "claim-1", lines: [{ size: "M", qtyClaimed: 1 }] }),
    ).rejects.toThrow();
  });
});

/**
 * รูปหลักฐานอยู่ในใบเคลมของรอบนั้น (เบสเลือก 2026-09-19) — ไม่กองรวมกับไฟล์ออเดอร์
 * ล็อกไว้สองข้อ: ใบที่จบแล้วแนบเพิ่มไม่ได้ · และรูปเป็นของภายใน ไม่มีทางออกไปฝั่งลูกค้า
 */
describe("claim.setPhotos", () => {
  it("แนบรูปกับใบที่ยังไม่จบได้", async () => {
    const { ctx } = contextFor({ role: "SALES", claim: OPEN_CLAIM });
    const update = vi.fn().mockResolvedValue({ id: "claim-1" });
    (ctx.prisma as unknown as { orderClaim: unknown }).orderClaim = {
      findUnique: vi.fn().mockResolvedValue(OPEN_CLAIM),
      update,
    };
    await claimRouter.createCaller(ctx).setPhotos({ id: "claim-1", photoUrls: ["/api/files/a.jpg"] });
    expect(update).toHaveBeenCalledWith({
      where: { id: "claim-1" },
      data: { photoUrls: ["/api/files/a.jpg"] },
    });
  });

  it("ใบที่ปิดแล้วแนบรูปเพิ่มไม่ได้", async () => {
    const { ctx } = contextFor({ role: "MANAGER", claim: { ...OPEN_CLAIM, state: "CLOSED" } });
    await expect(
      claimRouter.createCaller(ctx).setPhotos({ id: "claim-1", photoUrls: ["/api/files/a.jpg"] }),
    ).rejects.toThrow("จบไปแล้ว");
  });
});
