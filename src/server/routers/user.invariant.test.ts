/**
 * เทส wiring ของ invariant "ระบบต้องเหลือ OWNER active ≥1" ผ่าน mutation จริงของ router
 * (review จับ: helpers.test.ts เทสแค่ตัว helper — ถอด guard ออกจาก user.update/setActive
 *  แล้วเทสยังเขียวหมด · ที่นี่ pin ฝั่ง block ด้วย stub prisma: count=0 → BAD_REQUEST
 *  ฝั่ง "ไม่ over-block" กับ DB จริงอยู่ verify:moneygate 8.8)
 *
 * stub จงใจไม่มี user.update ในเคส block — ถ้า guard หลุด เทสพังเสียงดัง ไม่ใช่ผ่านเงียบ
 */
import { describe, it, expect } from "vitest";
import { userRouter } from "./user";
import type { Context } from "../trpc";

function makeCtx(userStub: Record<string, unknown>, extra?: Record<string, unknown>): Context {
  return {
    prisma: { user: userStub, ...extra } as unknown as Context["prisma"],
    userId: "acting-owner",
    userRole: "OWNER",
    permissionOverrides: null,
  };
}

describe("OWNER invariant ผ่าน user router", () => {
  it("setActive: ปิดบัญชี OWNER active คนสุดท้าย → BAD_REQUEST (guard วิ่งก่อน write)", async () => {
    const ctx = makeCtx({
      findUniqueOrThrow: async () => ({ role: "OWNER", isActive: true }),
      count: async () => 0,
    });
    await expect(
      userRouter.createCaller(ctx).setActive({ id: "other-owner", isActive: false })
    ).rejects.toThrow("ปิดบัญชีไม่ได้ — ระบบต้องเหลือเจ้าของที่ใช้งานอยู่อย่างน้อย 1 คน");
  });

  it("update: ลด role ของ OWNER active คนสุดท้าย → BAD_REQUEST (guard วิ่งก่อน write)", async () => {
    const ctx = makeCtx({
      findUniqueOrThrow: async () => ({
        name: "เจ้าของคนเดียว",
        role: "OWNER",
        isActive: true,
        permissionOverrides: null,
      }),
      count: async () => 0,
    });
    await expect(
      userRouter.createCaller(ctx).update({ id: "other-owner", role: "SALES" })
    ).rejects.toThrow("เปลี่ยนตำแหน่งไม่ได้ — ระบบต้องเหลือเจ้าของที่ใช้งานอยู่อย่างน้อย 1 คน");
  });

  it("update: ลด role ของ OWNER ที่ยังมีเจ้าของ active คนอื่น → ผ่าน (ไม่ over-block)", async () => {
    const updated = { id: "other-owner", name: "อดีตเจ้าของ", role: "SALES" };
    const ctx = makeCtx(
      {
        findUniqueOrThrow: async () => ({
          name: "อดีตเจ้าของ",
          role: "OWNER",
          isActive: true,
          permissionOverrides: null,
        }),
        count: async () => 1,
        update: async () => updated,
      },
      { auditLog: { create: async () => ({}) } }
    );
    await expect(
      userRouter.createCaller(ctx).update({ id: "other-owner", role: "SALES" })
    ).resolves.toMatchObject({ role: "SALES" });
  });

  it("update: ลด role ของ OWNER ที่ปิดบัญชีไปแล้ว → ไม่แตะ count เลย (invariant นับเฉพาะ active)", async () => {
    const updated = { id: "other-owner", name: "เจ้าของปิดแล้ว", role: "SALES" };
    const ctx = makeCtx(
      {
        findUniqueOrThrow: async () => ({
          name: "เจ้าของปิดแล้ว",
          role: "OWNER",
          isActive: false,
          permissionOverrides: null,
        }),
        // ไม่มี count — ถ้า guard วิ่งทั้งที่ target inactive เทสพังเสียงดัง
        update: async () => updated,
      },
      { auditLog: { create: async () => ({}) } }
    );
    await expect(
      userRouter.createCaller(ctx).update({ id: "other-owner", role: "SALES" })
    ).resolves.toMatchObject({ role: "SALES" });
  });
});
