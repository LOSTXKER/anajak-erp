import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { orderRouter } from "./order";
import { orderItemsFingerprint } from "@/lib/order-form-concurrency";

const ORDER_ID = "order-production-owned";
const UPDATED_AT = new Date("2026-08-22T08:00:00.000Z");

function itemInput() {
  return {
    description: "เสื้อพร้อมพิมพ์",
    products: [
      {
        productType: "T_SHIRT",
        description: "เสื้อยืด",
        baseUnitPrice: 100,
        discount: 0,
        variants: [{ size: "M", color: "ดำ", quantity: 10 }],
      },
    ],
    prints: [
      {
        position: "หน้าอก",
        printType: "DTF",
        unitPrice: 20,
      },
    ],
    addons: [],
  };
}

function productionOwnedTx() {
  const lockOrder: string[] = [];
  const tx = {
    $queryRaw: vi.fn(async (query: TemplateStringsArray) => {
      const sql = Array.from(query).join("");
      if (sql.includes("pg_advisory_xact_lock")) {
        lockOrder.push("topology");
        return [{ lock_result: "" }];
      }
      if (sql.includes("FROM orders")) {
        lockOrder.push("order");
        return [];
      }
      if (sql.includes("FROM productions")) {
        lockOrder.push("owner");
        return [{ id: "production-v2" }];
      }
      return [];
    }),
    order: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    orderItem: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    orderFee: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    invoice: {
      findMany: vi.fn(),
    },
    orderRevision: {
      create: vi.fn(),
    },
    changeOrder: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
  return { tx, lockOrder };
}

function contextFor(
  tx: ReturnType<typeof productionOwnedTx>["tx"],
  status: "INQUIRY" | "DESIGN_APPROVED",
) {
  const auditCreate = vi.fn();
  const revisionCreate = vi.fn();
  const transaction = vi.fn(
    async (callback: (transaction: typeof tx) => unknown) => callback(tx),
  );
  const ctx: Context = {
    prisma: {
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: ORDER_ID,
          customerId: "customer-1",
          internalStatus: status,
          stockReservedAt: null,
        }),
      },
      orderItemProduct: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      orderRevision: {
        count: vi.fn().mockResolvedValue(0),
        create: revisionCreate,
      },
      auditLog: {
        create: auditCreate,
      },
      $transaction: transaction,
    } as unknown as Context["prisma"],
    userId: "owner-1",
    userRole: "OWNER",
    permissionOverrides: null,
  };
  return { ctx, auditCreate, revisionCreate, transaction };
}

function expectNoDefinitionMutation(
  tx: ReturnType<typeof productionOwnedTx>["tx"],
  auditCreate: ReturnType<typeof vi.fn>,
  revisionCreate: ReturnType<typeof vi.fn>,
) {
  expect(tx.orderItem.deleteMany).not.toHaveBeenCalled();
  expect(tx.orderItem.create).not.toHaveBeenCalled();
  expect(tx.orderFee.deleteMany).not.toHaveBeenCalled();
  expect(tx.orderFee.create).not.toHaveBeenCalled();
  expect(tx.order.update).not.toHaveBeenCalled();
  expect(tx.changeOrder.create).not.toHaveBeenCalled();
  expect(tx.auditLog.create).not.toHaveBeenCalled();
  expect(tx.orderRevision.create).not.toHaveBeenCalled();
  expect(auditCreate).not.toHaveBeenCalled();
  expect(revisionCreate).not.toHaveBeenCalled();
}

describe("order item writers — production ownership", () => {
  it("saveForm ปฏิเสธก่อน replace สินค้า/ลาย และถือ topology ก่อน order lock", async () => {
    const { tx, lockOrder } = productionOwnedTx();
    const { ctx, auditCreate, revisionCreate } = contextFor(tx, "INQUIRY");

    await expect(
      orderRouter.createCaller(ctx).saveForm({
        id: ORDER_ID,
        expectedUpdatedAt: UPDATED_AT,
        expectedItemsFingerprint: orderItemsFingerprint([]),
        work: { items: [itemInput()] },
      }),
    ).rejects.toThrow("มีใบสั่งผลิตแล้ว");

    expect(lockOrder).toEqual(["topology", "order", "owner"]);
    expectNoDefinitionMutation(tx, auditCreate, revisionCreate);
  });

  it("updateItems ทางเดิมใช้ guard เดียวกันและไม่ลบรายการหรือสร้างประวัติ", async () => {
    const { tx, lockOrder } = productionOwnedTx();
    const { ctx, auditCreate, revisionCreate } = contextFor(tx, "INQUIRY");

    await expect(
      orderRouter.createCaller(ctx).updateItems({
        id: ORDER_ID,
        items: [itemInput()],
        discount: 0,
      }),
    ).rejects.toThrow("มีใบสั่งผลิตแล้ว");

    expect(lockOrder).toEqual(["topology", "order", "owner"]);
    expectNoDefinitionMutation(tx, auditCreate, revisionCreate);
  });

  it("updateItems ของออเดอร์เดิมที่ยังไม่มีใบสั่งผลิตยังแก้รายการได้ตามเดิม", async () => {
    const { tx, lockOrder } = productionOwnedTx();
    tx.$queryRaw.mockImplementation(async (query: TemplateStringsArray) => {
      const sql = Array.from(query).join("");
      if (sql.includes("pg_advisory_xact_lock")) {
        lockOrder.push("topology");
        return [{ lock_result: "" }];
      }
      if (sql.includes("FROM orders")) {
        lockOrder.push("order");
        return [];
      }
      if (sql.includes("FROM productions")) {
        lockOrder.push("owner");
        return [];
      }
      return [];
    });
    tx.order.findUniqueOrThrow.mockResolvedValue({
      taxRate: 0,
      subtotalItems: 1_000,
      totalAmount: 1_000,
    });
    tx.orderFee.findMany.mockResolvedValue([]);
    tx.invoice.findMany.mockResolvedValue([]);
    tx.order.update.mockResolvedValue({ id: ORDER_ID });
    const { ctx, auditCreate, revisionCreate } = contextFor(tx, "INQUIRY");

    await expect(
      orderRouter.createCaller(ctx).updateItems({
        id: ORDER_ID,
        items: [itemInput()],
        discount: 0,
      }),
    ).resolves.toMatchObject({ id: ORDER_ID });

    expect(lockOrder).toEqual(["topology", "order", "owner", "order"]);
    expect(tx.orderItem.deleteMany).toHaveBeenCalledOnce();
    expect(tx.orderItem.create).toHaveBeenCalledOnce();
    expect(revisionCreate).toHaveBeenCalledOnce();
    expect(auditCreate).toHaveBeenCalledOnce();
  });

  it("applyChangeOrder ใช้ guard เดียวกันและไม่เปลี่ยนสินค้า/ค่าธรรมเนียม/ใบแก้ไข", async () => {
    const { tx, lockOrder } = productionOwnedTx();
    const { ctx, auditCreate, revisionCreate } = contextFor(
      tx,
      "DESIGN_APPROVED",
    );

    await expect(
      orderRouter.createCaller(ctx).applyChangeOrder({
        id: ORDER_ID,
        items: [itemInput()],
        fees: [],
        discount: 0,
        reason: "ลูกค้าขอเปลี่ยนแบบ",
      }),
    ).rejects.toThrow("มีใบสั่งผลิตแล้ว");

    expect(lockOrder).toEqual(["topology", "order", "owner"]);
    expectNoDefinitionMutation(tx, auditCreate, revisionCreate);
  });
});
