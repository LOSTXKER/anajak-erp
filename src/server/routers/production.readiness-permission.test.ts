import type { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { productionRouter } from "./production";

const ORDER_ID = "order-readiness-permission";

function makeContext(
  role: Role,
  permissionOverrides: unknown = null,
  paidAmount = 1_234
): Context {
  return {
    prisma: {
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          orderNumber: "ORD-TEST-001",
          title: "งานทดสอบสิทธิ์ readiness",
          items: [],
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: ORDER_ID,
            internalStatus: "CONFIRMED",
            paymentTerms: "DEPOSIT_50",
            totalAmount: 24_680,
            stockReservedAt: null,
            stockReservationError: null,
            designs: [],
            invoices: [
              {
                payments: [{ amount: paidAmount, whtAmount: 0 }],
              },
            ],
            items: [],
          },
        ]),
      },
    } as unknown as Context["prisma"],
    userId: "readiness-user",
    userRole: role,
    permissionOverrides,
  };
}

async function getPaymentDetail(
  role: Role,
  permissionOverrides: unknown = null,
  paidAmount?: number
) {
  const result = await productionRouter
    .createCaller(makeContext(role, permissionOverrides, paidAmount))
    .orderContext({ orderId: ORDER_ID });

  return result.readiness?.checks.find((check) => check.key === "payment")?.detail;
}

describe("production.orderContext readiness permission boundary", () => {
  it("override ตัดสิทธิ์ฝ่ายขายแล้ว response ดิบไม่มีจำนวนเงินหรือเลขจากเงื่อนไขชำระ", async () => {
    const detail = await getPaymentDetail("SALES", { see_order_money: false });

    expect(detail).toBe("รอเงินเข้า — ขาย/การเงินตามลูกค้า");
    expect(detail).not.toMatch(/\d/);
    expect(detail).not.toContain("บาท");
  });

  it("override เพิ่มสิทธิ์ให้ฝ่ายผลิตแล้วคงรายละเอียดเงินจริงครบ", async () => {
    const detail = await getPaymentDetail("PRODUCTION_STAFF", { see_order_money: true });

    expect(detail).toBe("มัดจำ 50%: รับแล้ว 1,234/12,340 บาท");
  });

  it("เงื่อนไขเงินผ่านแล้วก็ไม่ fallback กลับไปส่งยอดให้คนไม่มีสิทธิ์", async () => {
    const detail = await getPaymentDetail(
      "PRODUCTION_STAFF",
      { see_order_money: false },
      12_340
    );

    expect(detail).toBe("เงื่อนไขชำระไม่กั้นการผลิต");
    expect(detail).not.toMatch(/\d/);
    expect(detail).not.toContain("บาท");
  });
});
