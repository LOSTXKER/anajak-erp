/**
 * เทส assertAnotherActiveOwner — invariant "ระบบต้องเหลือ OWNER ที่ active อย่างน้อย 1 คน"
 * (PERM follow-up · ฝั่ง "ผ่านเมื่อเจ้าของจริงยังเหลือ" ทดสอบกับ DB จริงใน verify:moneygate 8.8
 *  ฝั่ง block จำลอง count=0 ที่นี่ — กับ DB จริงทำไม่ได้โดยไม่แตะบัญชีเจ้าของ)
 */
import { describe, it, expect } from "vitest";
import { assertAnotherActiveOwner } from "./helpers";

type Db = Parameters<typeof assertAnotherActiveOwner>[0];

function stubDb(count: number, capture?: { where?: unknown }) {
  return {
    user: {
      count: async (args: { where: unknown }) => {
        if (capture) capture.where = args.where;
        return count;
      },
    },
  } as unknown as Db;
}

describe("assertAnotherActiveOwner", () => {
  it("ไม่มี OWNER active คนอื่นเหลือ (count=0) → โยนข้อความที่ส่งเข้ามา", async () => {
    await expect(
      assertAnotherActiveOwner(stubDb(0), "u1", "ปิดบัญชีไม่ได้ — ต้องเหลือเจ้าของ")
    ).rejects.toThrow("ปิดบัญชีไม่ได้ — ต้องเหลือเจ้าของ");
  });

  it("ยังมี OWNER active คนอื่น (count≥1) → ผ่านเงียบ", async () => {
    await expect(assertAnotherActiveOwner(stubDb(1), "u1", "x")).resolves.toBeUndefined();
    await expect(assertAnotherActiveOwner(stubDb(2), "u1", "x")).resolves.toBeUndefined();
  });

  it("นับเฉพาะ OWNER ที่ active และไม่นับตัวเป้าหมายเอง (pin เงื่อนไข where)", async () => {
    const capture: { where?: unknown } = {};
    await assertAnotherActiveOwner(stubDb(1, capture), "target-id", "x");
    expect(capture.where).toEqual({
      role: "OWNER",
      isActive: true,
      id: { not: "target-id" },
    });
  });
});
