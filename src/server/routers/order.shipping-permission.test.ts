import type { Role } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Context } from "../trpc";
import { orderRouter } from "./order";

afterEach(() => {
  vi.unstubAllEnvs();
});

function shippingContext(role: Role, permissionOverrides: unknown = null) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    order: {
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValueOnce({
          orderType: "CUSTOM",
          internalStatus: "READY_TO_SHIP",
          stockReservationError: null,
        })
        .mockResolvedValueOnce({
          productionCompletionOwnerId: null,
          productions: [],
          productionCompletionOwner: null,
        })
        .mockResolvedValueOnce({
          items: [
            {
              products: [
                {
                  description: "เสื้อยืด",
                  variants: [
                    { size: "M", color: "ดำ", quantity: 1 },
                  ],
                },
              ],
            },
          ],
          deliveries: [
            {
              status: "PREPARING",
              lines: [
                {
                  description: "เสื้อยืด",
                  size: "M",
                  color: "ดำ",
                  qty: 1,
                },
              ],
            },
          ],
        })
        .mockResolvedValueOnce({
          id: "order-1",
          orderType: "CUSTOM",
          internalStatus: "SHIPPED",
          customerStatus: "SHIPPED",
        }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    orderRevision: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "revision-1" }),
    },
  };
  const auditCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
  const transaction = vi.fn(
    async (callback: (transaction: typeof tx) => unknown) => callback(tx),
  );
  const ctx: Context = {
    prisma: {
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "order-1",
          orderType: "CUSTOM",
          internalStatus: "READY_TO_SHIP",
          customerStatus: "READY_TO_SHIP",
        }),
      },
      auditLog: { create: auditCreate },
      $transaction: transaction,
    } as unknown as Context["prisma"],
    userId: `${role.toLowerCase()}-1`,
    userRole: role,
    permissionOverrides,
  };
  return { ctx, tx, transaction, auditCreate };
}

describe("order.updateStatus — Production V2 canonical writers", () => {
  it.each(["OWNER", "MANAGER", "SALES"] as const)(
    "%s ต้องยืนยัน SHIPPED จากใบจัดส่ง ไม่ใช่ generic Order status",
    async (role) => {
      vi.stubEnv("PRODUCTION_V2_ENABLED", "1");
      const { ctx, transaction, auditCreate } = shippingContext(role);

      await expect(
        orderRouter.createCaller(ctx).updateStatus({
          id: "order-1",
          internalStatus: "SHIPPED",
        }),
      ).rejects.toThrow("ต้องเปลี่ยนจากขั้นงานจริงในหน้าการผลิตหรือการจัดส่ง");

      expect(transaction).not.toHaveBeenCalled();
      expect(auditCreate).not.toHaveBeenCalled();
    },
  );

  it.each(["PRODUCTION_STAFF", "DESIGNER", "ACCOUNTANT"] as const)(
    "%s ไม่มี ship_orders จึงส่ง SHIPPED ไม่ได้",
    async (role) => {
      vi.stubEnv("PRODUCTION_V2_ENABLED", "true");
      const { ctx, transaction, auditCreate } = shippingContext(role);

      await expect(
        orderRouter.createCaller(ctx).updateStatus({
          id: "order-1",
          internalStatus: "SHIPPED",
        }),
      ).rejects.toThrow("ต้องเปลี่ยนจากขั้นงานจริงในหน้าการผลิตหรือการจัดส่ง");

      expect(transaction).not.toHaveBeenCalled();
      expect(auditCreate).not.toHaveBeenCalled();
    },
  );

  it("PACKING → READY_TO_SHIP ต้องมาจาก completeOperation ไม่ใช่ generic Order", async () => {
    vi.stubEnv("PRODUCTION_V2_ENABLED", "1");
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      order: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            orderType: "CUSTOM",
            internalStatus: "PACKING",
            stockReservationError: null,
          })
          .mockResolvedValueOnce({
            items: [
              {
                products: [
                  {
                    description: "เสื้อยืด",
                    variants: [{ size: "M", color: "ดำ", quantity: 1 }],
                  },
                ],
              },
            ],
            deliveries: [
              {
                status: "PREPARING",
                lines: [
                  {
                    description: "เสื้อยืด",
                    size: "M",
                    color: "ดำ",
                    qty: 1,
                  },
                ],
              },
            ],
          })
          .mockResolvedValueOnce({
            id: "order-1",
            internalStatus: "READY_TO_SHIP",
            customerStatus: "READY_TO_SHIP",
          }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      orderRevision: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "revision-1" }),
      },
    };
    const ctx: Context = {
      prisma: {
        order: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: "order-1",
            internalStatus: "PACKING",
            customerStatus: "IN_PRODUCTION",
          }),
        },
        auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
        $transaction: vi.fn(
          async (callback: (transaction: typeof tx) => unknown) => callback(tx),
        ),
      } as unknown as Context["prisma"],
      userId: "production-staff-1",
      userRole: "PRODUCTION_STAFF",
      permissionOverrides: null,
    };

    await expect(
      orderRouter.createCaller(ctx).updateStatus({
        id: "order-1",
        internalStatus: "READY_TO_SHIP",
      }),
    ).rejects.toThrow("ต้องเปลี่ยนจากขั้นงานจริงในหน้าการผลิตหรือการจัดส่ง");
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it("override ไม่สร้างทางลัดข้ามบ้านใบจัดส่ง", async () => {
    vi.stubEnv("PRODUCTION_V2_ENABLED", "1");
    const { ctx, transaction } = shippingContext("SALES", {
      ship_orders: false,
    });

    await expect(
      orderRouter.createCaller(ctx).updateStatus({
        id: "order-1",
        internalStatus: "SHIPPED",
      }),
    ).rejects.toThrow("ต้องเปลี่ยนจากขั้นงานจริงในหน้าการผลิตหรือการจัดส่ง");
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each(["ON_HOLD", "CANCELLED"] as const)(
    "มีใบสั่งผลิตแล้วต้องปฏิเสธ %s จาก Order แม้ flag ปิด โดยตรวจหลัง lock และไม่ transition",
    async (target) => {
      vi.stubEnv("PRODUCTION_V2_ENABLED", "0");
      const lockLog: string[] = [];
      const updateMany = vi.fn();
      const tx = {
        $queryRaw: vi.fn(async (query: TemplateStringsArray) => {
          const sql = Array.from(query).join("");
          if (sql.includes("pg_advisory_xact_lock")) {
            lockLog.push("topology");
            return [{ lock_result: "" }];
          }
          if (sql.includes("FROM orders")) {
            lockLog.push("order");
            return [];
          }
          if (sql.includes("work_order_number IS NOT NULL")) {
            lockLog.push("v2-record");
            return [{ id: "production-v2-1" }];
          }
          return [];
        }),
        order: { updateMany },
        orderRevision: { create: vi.fn() },
      };
      const auditCreate = vi.fn();
      const ctx: Context = {
        prisma: {
          order: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              id: "order-1",
              orderType: "CUSTOM",
              internalStatus: "PRODUCING",
              customerStatus: "IN_PRODUCTION",
              totalAmount: 0,
            }),
          },
          auditLog: { create: auditCreate },
          $transaction: vi.fn(
            async (callback: (transaction: typeof tx) => unknown) => callback(tx),
          ),
        } as unknown as Context["prisma"],
        userId: "owner-1",
        userRole: "OWNER",
        permissionOverrides: null,
      };

      await expect(
        orderRouter.createCaller(ctx).updateStatus({
          id: "order-1",
          internalStatus: target,
          ...(target === "CANCELLED" ? { confirmOutstandingBilling: true } : {}),
        }),
      ).rejects.toThrow("มีใบสั่งผลิตอยู่");

      expect(lockLog).toEqual(["topology", "order", "v2-record"]);
      expect(updateMany).not.toHaveBeenCalled();
      expect(tx.orderRevision.create).not.toHaveBeenCalled();
      expect(auditCreate).not.toHaveBeenCalled();
    },
  );

  it("ใบผลิตร่างกันการถอยออเดอร์กลับไปออกแบบ แม้เปิด flag อยู่", async () => {
    vi.stubEnv("PRODUCTION_V2_ENABLED", "1");
    const lockLog: string[] = [];
    const updateMany = vi.fn();
    const tx = {
      $queryRaw: vi.fn(async (query: TemplateStringsArray) => {
        const sql = Array.from(query).join("");
        if (sql.includes("pg_advisory_xact_lock")) {
          lockLog.push("topology");
          return [{ lock_result: "" }];
        }
        if (sql.includes("FROM orders")) {
          lockLog.push("order");
          return [];
        }
        if (sql.includes("work_order_number IS NOT NULL")) {
          lockLog.push("v2-record");
          return [{ id: "production-v2-draft" }];
        }
        return [];
      }),
      order: { updateMany },
      orderRevision: { count: vi.fn(), create: vi.fn() },
    };
    const auditCreate = vi.fn();
    const ctx: Context = {
      prisma: {
        order: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: "order-1",
            orderType: "CUSTOM",
            internalStatus: "DESIGN_APPROVED",
            customerStatus: "DESIGN_APPROVED",
            totalAmount: 0,
          }),
        },
        auditLog: { create: auditCreate },
        $transaction: vi.fn(
          async (callback: (transaction: typeof tx) => unknown) => callback(tx),
        ),
      } as unknown as Context["prisma"],
      userId: "owner-1",
      userRole: "OWNER",
      permissionOverrides: null,
    };

    await expect(
      orderRouter.createCaller(ctx).updateStatus({
        id: "order-1",
        internalStatus: "DESIGNING",
      }),
    ).rejects.toThrow("มีใบสั่งผลิตอยู่");

    expect(lockLog).toEqual(["topology", "order", "v2-record"]);
    expect(updateMany).not.toHaveBeenCalled();
    expect(tx.orderRevision.create).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("ออเดอร์เดิมที่ยังไม่มีใบผลิตยังถอยกลับไปออกแบบได้", async () => {
    vi.stubEnv("PRODUCTION_V2_ENABLED", "1");
    const lockLog: string[] = [];
    let liveStatus = "DESIGN_APPROVED";
    const updateMany = vi.fn(
      async ({ data }: { data: { internalStatus: string } }) => {
        liveStatus = data.internalStatus;
        return { count: 1 };
      },
    );
    const tx = {
      $queryRaw: vi.fn(async (query: TemplateStringsArray) => {
        const sql = Array.from(query).join("");
        if (sql.includes("pg_advisory_xact_lock")) {
          lockLog.push("topology");
          return [{ lock_result: "" }];
        }
        if (sql.includes("FROM orders")) {
          lockLog.push("order");
          return [];
        }
        if (sql.includes("work_order_number IS NOT NULL")) {
          lockLog.push("v2-record");
          return [];
        }
        return [];
      }),
      order: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: "order-1",
          orderType: "CUSTOM",
          internalStatus: liveStatus,
          customerStatus: liveStatus,
          stockReservationError: null,
        })),
        updateMany,
      },
      orderRevision: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "revision-1" }),
      },
    };
    const auditCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
    const ctx: Context = {
      prisma: {
        order: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: "order-1",
            orderType: "CUSTOM",
            internalStatus: "DESIGN_APPROVED",
            customerStatus: "DESIGN_APPROVED",
            totalAmount: 0,
          }),
        },
        auditLog: { create: auditCreate },
        $transaction: vi.fn(
          async (callback: (transaction: typeof tx) => unknown) => callback(tx),
        ),
      } as unknown as Context["prisma"],
      userId: "owner-1",
      userRole: "OWNER",
      permissionOverrides: null,
    };

    await expect(
      orderRouter.createCaller(ctx).updateStatus({
        id: "order-1",
        internalStatus: "DESIGNING",
      }),
    ).resolves.toMatchObject({ internalStatus: "DESIGNING" });

    expect(lockLog).toEqual(["topology", "order", "v2-record"]);
    expect(updateMany).toHaveBeenCalledOnce();
    expect(tx.orderRevision.create).toHaveBeenCalledOnce();
    expect(auditCreate).toHaveBeenCalledOnce();
  });

  it("ออเดอร์ V2 ที่ส่งแล้วปิดงานได้เมื่อวางบิลครบ โดยยังผ่าน lock และ transition กลาง", async () => {
    vi.stubEnv("PRODUCTION_V2_ENABLED", "1");
    const lockLog: string[] = [];
    let liveStatus = "SHIPPED";
    const updateMany = vi.fn(
      async ({ data }: { data: { internalStatus: string } }) => {
        liveStatus = data.internalStatus;
        return { count: 1 };
      },
    );
    const tx = {
      $queryRaw: vi.fn(async (query: TemplateStringsArray) => {
        const sql = Array.from(query).join("");
        if (sql.includes("pg_advisory_xact_lock")) {
          lockLog.push("topology");
          return [{ lock_result: "" }];
        }
        if (sql.includes("FROM orders")) {
          lockLog.push("order");
          return [];
        }
        if (sql.includes("work_order_number IS NOT NULL")) {
          lockLog.push("v2-record");
          return [{ id: "production-v2-1" }];
        }
        return [];
      }),
      order: {
        findUniqueOrThrow: vi.fn(
          async ({ select }: { select?: Record<string, unknown> }) =>
            select
              ? {
                  orderType: "CUSTOM",
                  internalStatus: liveStatus,
                  stockReservationError: null,
                }
              : {
                  id: "order-1",
                  orderType: "CUSTOM",
                  internalStatus: liveStatus,
                  customerStatus: liveStatus,
                  totalAmount: 1_000,
                },
        ),
        updateMany,
      },
      orderRevision: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "revision-1" }),
      },
    };
    const invoiceFindMany = vi.fn().mockResolvedValue([
      { type: "FINAL_INVOICE", totalAmount: 1_000, isVoided: false },
    ]);
    const auditCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
    const ctx: Context = {
      prisma: {
        order: {
          findUniqueOrThrow: vi.fn(
            async ({ select }: { select?: Record<string, unknown> }) =>
              select && "stockReservedAt" in select
                ? {
                    id: "order-1",
                    orderNumber: "ORD-001",
                    stockReservedAt: null,
                    stockReservationError: null,
                  }
                : {
                    id: "order-1",
                    orderType: "CUSTOM",
                    internalStatus: "SHIPPED",
                    customerStatus: "SHIPPED",
                    totalAmount: 1_000,
                  },
          ),
        },
        invoice: { findMany: invoiceFindMany },
        auditLog: { create: auditCreate },
        $transaction: vi.fn(
          async (callback: (transaction: typeof tx) => unknown) => callback(tx),
        ),
      } as unknown as Context["prisma"],
      userId: "accountant-1",
      userRole: "ACCOUNTANT",
      permissionOverrides: null,
    };

    await expect(
      orderRouter.createCaller(ctx).updateStatus({
        id: "order-1",
        internalStatus: "COMPLETED",
      }),
    ).resolves.toMatchObject({ internalStatus: "COMPLETED" });

    expect(invoiceFindMany).toHaveBeenCalledWith({
      where: { orderId: "order-1", isVoided: false },
      select: { type: true, totalAmount: true, isVoided: true },
    });
    expect(lockLog).toEqual(["topology", "order", "v2-record"]);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ internalStatus: "SHIPPED" }),
        data: expect.objectContaining({ internalStatus: "COMPLETED" }),
      }),
    );
    expect(tx.orderRevision.create).toHaveBeenCalledOnce();
    expect(auditCreate).toHaveBeenCalledOnce();
  });

  it("flag off คง whitelist legacy ที่ฝ่ายผลิตส่ง SHIPPED ได้", async () => {
    vi.stubEnv("PRODUCTION_V2_ENABLED", "0");
    const { ctx, tx } = shippingContext("PRODUCTION_STAFF");

    await expect(
      orderRouter.createCaller(ctx).updateStatus({
        id: "order-1",
        internalStatus: "SHIPPED",
      }),
    ).resolves.toMatchObject({ internalStatus: "SHIPPED" });
    expect(tx.order.updateMany).toHaveBeenCalledOnce();
  });
});
