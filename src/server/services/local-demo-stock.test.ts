import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaTx } from "@/lib/prisma";
import {
  applyLocalDemoStockMovement,
  getLocalDemoStockAvailability,
  isLocalDemoStockEnabled,
  localDemoStockDocumentNumber,
} from "./local-demo-stock";

const demoUrl =
  "postgresql://demo:demo@127.0.0.1:5433/anajak_erp_demo?schema=public";

const currentLine = {
  sku: "TS-M-BLACK",
  qty: 10,
  productId: "product-1",
  variantId: "variant-m",
  productName: "เสื้อยืด",
  size: "M",
  color: "ดำ",
  needed: 10,
  issued: 0,
  returned: 0,
};

describe("local demo stock guard", () => {
  it("เปิดเฉพาะ flag + ฐาน local demo ตรงเป๊ะ", () => {
    expect(
      isLocalDemoStockEnabled({
        ANAJAK_ERP_DEMO_MODE: "1",
        DATABASE_URL: demoUrl,
      }),
    ).toBe(true);
    expect(
      isLocalDemoStockEnabled({
        ANAJAK_ERP_DEMO_MODE: "0",
        DATABASE_URL: demoUrl,
      }),
    ).toBe(false);
    expect(() =>
      isLocalDemoStockEnabled({
        ANAJAK_ERP_DEMO_MODE: "1",
        DATABASE_URL: demoUrl.replace("127.0.0.1", "localhost"),
      }),
    ).toThrow("อนุญาตเฉพาะ PostgreSQL 127.0.0.1:5433/anajak_erp_demo");
  });

  it("เลขเอกสารคงที่ต่อ key และแยก ISSUE/RETURN", () => {
    expect(localDemoStockDocumentNumber("ISSUE", "same-key")).toBe(
      localDemoStockDocumentNumber("ISSUE", "same-key"),
    );
    expect(localDemoStockDocumentNumber("ISSUE", "same-key")).not.toBe(
      localDemoStockDocumentNumber("RETURN", "same-key"),
    );
  });
});

describe("local demo availability", () => {
  it("กันยอดคงเหลือที่ออเดอร์อื่นยังต้องใช้หลังหักยอดเบิกสุทธิ", async () => {
    const tx = {
      order: {
        findMany: vi.fn().mockResolvedValue([
          {
            items: [
              {
                products: [
                  {
                    itemSource: "FROM_STOCK",
                    productId: "product-1",
                    description: "เสื้อยืด",
                    variants: [{ size: "M", color: "ดำ", quantity: 8 }],
                  },
                ],
              },
            ],
            productions: [
              {
                materialUsages: [
                  {
                    productId: "product-1",
                    productVariantId: "variant-m",
                    quantity: 3,
                    movementType: "ISSUE",
                  },
                ],
              },
            ],
          },
        ]),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "product-1",
            sku: "TS",
            name: "เสื้อยืด",
            variants: [
              {
                id: "variant-m",
                sku: "TS-M-BLACK",
                size: "M",
                color: "ดำ",
              },
            ],
          },
        ]),
      },
      productVariant: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "variant-m",
            sku: "TS-M-BLACK",
            stock: 20,
            totalStock: 20,
          },
        ]),
      },
    } as unknown as PrismaTx;

    const result = await getLocalDemoStockAvailability(tx, "current-order", [
      currentLine,
    ]);
    expect(result).toEqual([
      {
        sku: "TS-M-BLACK",
        onHand: 20,
        reservedForOtherOrders: 5,
        availableToThisOrder: 15,
        remainingNeeded: 10,
        shortage: 0,
      },
    ]);
  });

  it("ปฏิเสธ product-level SKU ที่ไม่มี variant", async () => {
    const tx = {} as PrismaTx;
    await expect(
      getLocalDemoStockAvailability(tx, "order-1", [
        { ...currentLine, sku: "TS", variantId: null },
      ]),
    ).rejects.toThrow("ต้องระบุไซส์และสี");
  });
});

describe("local demo movement", () => {
  beforeEach(() => {
    vi.stubEnv("ANAJAK_ERP_DEMO_MODE", "1");
    vi.stubEnv("DATABASE_URL", demoUrl);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    {
      flag: "0",
      url: demoUrl,
      label: "flag ปิด",
      expectedError: "เฉพาะโหมด demo บนฐาน local",
    },
    {
      flag: "1",
      url: "postgresql://demo:demo@db.example.com:5432/anajak_erp_demo?schema=public",
      label: "ฐานไม่ใช่ local demo",
      expectedError: "อนุญาตเฉพาะ PostgreSQL 127.0.0.1:5433/anajak_erp_demo",
    },
  ])(
    "fail-closed ก่อน query/write เมื่อ $label",
    async ({ flag, url, expectedError }) => {
      vi.stubEnv("ANAJAK_ERP_DEMO_MODE", flag);
      vi.stubEnv("DATABASE_URL", url);
      const queryRaw = vi.fn();
      const variantUpdate = vi.fn();
      const tx = {
        $queryRaw: queryRaw,
        productVariant: { update: variantUpdate },
      } as unknown as PrismaTx;

      await expect(
        applyLocalDemoStockMovement(tx, {
          movementType: "RETURN",
          orderId: "order-1",
          idempotencyKey: "must-not-write",
          requested: [{ sku: "TS-M-BLACK", qty: 1 }],
          stateLines: [currentLine],
        }),
      ).rejects.toThrow(expectedError);
      expect(queryRaw).not.toHaveBeenCalled();
      expect(variantUpdate).not.toHaveBeenCalled();
    },
  );

  it("ISSUE ลดยอด variant สอง field แล้ว derive ยอด product ใน transaction เดิม", async () => {
    const variantUpdate = vi.fn().mockResolvedValue({});
    const productUpdate = vi.fn().mockResolvedValue({});
    const queryRaw = vi.fn().mockResolvedValue([{ lock_result: "" }]);
    const tx = {
      $queryRaw: queryRaw,
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          stockReservedAt: new Date(),
          stockReservationError: null,
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([]),
        update: productUpdate,
      },
      productVariant: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "variant-m",
            sku: "TS-M-BLACK",
            stock: 20,
            totalStock: 20,
          },
        ]),
        findUnique: vi.fn().mockResolvedValue({
          id: "variant-m",
          productId: "product-1",
          stock: 20,
          totalStock: 20,
        }),
        update: variantUpdate,
        aggregate: vi.fn().mockResolvedValue({ _sum: { stock: 16 } }),
      },
    } as unknown as PrismaTx;

    const result = await applyLocalDemoStockMovement(tx, {
      movementType: "ISSUE",
      orderId: "order-1",
      idempotencyKey: "stable-idempotency-key",
      requested: [{ sku: "TS-M-BLACK", qty: 4 }],
      stateLines: [currentLine],
    });

    expect(result.docNumber).toMatch(/^DEMO-ISSUE-[A-F0-9]{12}$/);
    expect(variantUpdate).toHaveBeenCalledWith({
      where: { id: "variant-m" },
      data: { stock: 16, totalStock: 16 },
    });
    expect(productUpdate).toHaveBeenCalledWith({
      where: { id: "product-1" },
      data: { totalStock: 16 },
    });
    const sql = (queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join(" ");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("::text AS lock_result");
  });

  it("ISSUE ห้ามใช้ส่วนที่ออเดอร์อื่นจองไว้", async () => {
    const variantUpdate = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ lock_result: "" }]),
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          stockReservedAt: new Date(),
          stockReservationError: null,
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            items: [
              {
                products: [
                  {
                    itemSource: "FROM_STOCK",
                    productId: "product-1",
                    description: "เสื้อยืด",
                    variants: [{ size: "M", color: "ดำ", quantity: 8 }],
                  },
                ],
              },
            ],
            productions: [],
          },
        ]),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "product-1",
            sku: "TS",
            name: "เสื้อยืด",
            variants: [
              {
                id: "variant-m",
                sku: "TS-M-BLACK",
                size: "M",
                color: "ดำ",
              },
            ],
          },
        ]),
      },
      productVariant: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "variant-m",
            sku: "TS-M-BLACK",
            stock: 20,
            totalStock: 20,
          },
        ]),
        update: variantUpdate,
      },
    } as unknown as PrismaTx;

    await expect(
      applyLocalDemoStockMovement(tx, {
        movementType: "ISSUE",
        orderId: "order-1",
        idempotencyKey: "reservation-protection",
        requested: [{ sku: "TS-M-BLACK", qty: 13 }],
        stateLines: [currentLine],
      }),
    ).rejects.toThrow("กันยอดจองของออเดอร์อื่น");
    expect(variantUpdate).not.toHaveBeenCalled();
  });

  it("รวม SKU ซ้ำก่อนเช็ค availability เพื่อไม่กินยอดจองของออเดอร์อื่น", async () => {
    const variantUpdate = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ lock_result: "" }]),
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          stockReservedAt: new Date(),
          stockReservationError: null,
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            items: [
              {
                products: [
                  {
                    itemSource: "FROM_STOCK",
                    productId: "product-1",
                    description: "เสื้อยืด",
                    variants: [{ size: "M", color: "ดำ", quantity: 8 }],
                  },
                ],
              },
            ],
            productions: [],
          },
        ]),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "product-1",
            sku: "TS",
            name: "เสื้อยืด",
            variants: [
              {
                id: "variant-m",
                sku: "TS-M-BLACK",
                size: "M",
                color: "ดำ",
              },
            ],
          },
        ]),
      },
      productVariant: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "variant-m",
            sku: "TS-M-BLACK",
            stock: 20,
            totalStock: 20,
          },
        ]),
        update: variantUpdate,
      },
    } as unknown as PrismaTx;

    await expect(
      applyLocalDemoStockMovement(tx, {
        movementType: "ISSUE",
        orderId: "order-1",
        idempotencyKey: "duplicate-reservation-protection",
        requested: [
          { sku: "TS-M-BLACK", qty: 8 },
          { sku: "TS-M-BLACK", qty: 8 },
        ],
        stateLines: [currentLine],
      }),
    ).rejects.toThrow("กันยอดจองของออเดอร์อื่น");
    expect(variantUpdate).not.toHaveBeenCalled();
  });
});
