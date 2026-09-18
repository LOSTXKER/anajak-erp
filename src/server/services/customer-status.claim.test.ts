import { describe, expect, it, vi } from "vitest";
import { getOrderStatusByToken } from "./customer-status";
import type { PrismaTx } from "@/lib/prisma";

/**
 * หน้าติดตามงานของลูกค้าตอนมีรอบแก้ (ก้อน 1)
 *
 * หน้านี้เปิดได้โดยไม่ต้องล็อกอิน และลูกค้า reseller ส่งลิงก์ต่อให้ปลายทางได้ —
 * ใบเคลมจึงต้องออกจากฐานมาเป็น "ข้อความสำเร็จรูป" เท่านั้น เทสต์นี้ยิงผ่านฟังก์ชันจริง
 * เพื่อจับตอนที่ใครสักคนเผลอเพิ่ม field ลงใน select แล้ว spread ทั้งก้อนออกไป
 */
function prismaWith(claims: unknown[]) {
  const findUnique = vi.fn().mockResolvedValue({
    orderNumber: "ORD-2609-0001",
    deadline: null,
    createdAt: new Date("2026-09-01T03:00:00Z"),
    customerStatus: "IN_PRODUCTION",
    statusTokenExpiresAt: new Date("2099-01-01T00:00:00Z"),
    blindShip: false,
    blindShipSenderName: null,
    customer: { name: "ลูกค้าทดสอบ", company: null },
    designs: [],
    quotations: [],
    invoices: [],
    deliveries: [],
    claims,
  });
  return { order: { findUnique } } as unknown as Pick<PrismaTx, "order">;
}

const OPEN_CLAIM = {
  round: 2,
  state: "DECIDED",
  resolution: "REWORK",
  customerMessage: null,
  steps: [{ status: "IN_PROGRESS" }, { status: "COMPLETED" }],
};

describe("getOrderStatusByToken — รอบแก้งาน", () => {
  it("ไม่มีเรื่องค้าง = payload เหมือนเดิมทุกอย่าง (rework = null)", async () => {
    const data = await getOrderStatusByToken(prismaWith([]), "token-1");
    expect(data.rework).toBeNull();
  });

  it("มีรอบแก้ = ได้ขั้นที่ลูกค้าอ่านได้ พร้อมเลขรอบ", async () => {
    const data = await getOrderStatusByToken(prismaWith([OPEN_CLAIM]), "token-1");
    expect(data.rework).toEqual({
      round: 2,
      stage: "FIXING",
      headline: "กำลังแก้งานให้",
      note: "งานรอบแก้อยู่กับทีมผลิต จะแจ้งอีกครั้งเมื่อพร้อมส่งกลับ",
      steps: [
        { label: "รับเรื่อง", state: "done" },
        { label: "กำลังแก้งาน", state: "current" },
        { label: "ส่งกลับให้ใหม่", state: "todo" },
      ],
    });
  });

  it("บันทึกภายในของใบเคลมต้องไม่ติดออกไปกับ payload", async () => {
    // ใบจริงมี field พวกนี้อยู่ด้วย — ถ้าใครเปลี่ยน select เป็นดึงทั้งใบ เทสต์นี้ต้องแดง
    const data = await getOrderStatusByToken(
      prismaWith([
        {
          ...OPEN_CLAIM,
          claimNumber: "CLM-2609-0001",
          title: "ลายลอกหลังซัก 12 ตัว",
          fault: "SHOP",
          faultNote: "ช่างพิมพ์อุณหภูมิต่ำไป",
          agreedCredit: 1500,
        },
      ]),
      "token-1",
    );
    const dump = JSON.stringify(data);
    for (const secret of ["CLM-", "ลายลอก", "SHOP", "อุณหภูมิ", "1500", "เคลม"]) {
      expect(dump).not.toContain(secret);
    }
  });

  it("ใบที่ปิดแล้วถูกกรองที่ query — ถ้าหลุดมาถึงก็ยังต้องไม่ขึ้นบนหน้าลูกค้า", async () => {
    const data = await getOrderStatusByToken(
      prismaWith([{ ...OPEN_CLAIM, state: "CLOSED" }]),
      "token-1",
    );
    expect(data.rework).toBeNull();
  });
});
