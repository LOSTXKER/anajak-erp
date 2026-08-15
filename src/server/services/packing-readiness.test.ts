import { describe, expect, it, vi } from "vitest";
import {
  assertOrderPackingReadyToShip,
  findPackingOverflow,
  packingEvidenceFromOrder,
  packingLineKey,
} from "./packing-readiness";

type Variant = {
  size: string | null;
  color: string | null;
  quantity: number;
};

const packingOrder = (params?: {
  variants?: Variant[];
  deliveries?: Array<{
    status: string;
    lines: Array<{
      description: string;
      size: string | null;
      color: string | null;
      qty: number;
    }>;
  }>;
}) => ({
  items: params?.variants
    ? [
        {
          products: [
            {
              description: "เสื้อยืด",
              variants: params.variants,
            },
          ],
        },
      ]
    : [],
  deliveries: params?.deliveries ?? [],
});

describe("packingEvidenceFromOrder", () => {
  it("blocks readiness when there is no non-returned delivery", () => {
    const evidence = packingEvidenceFromOrder(
      packingOrder({
        variants: [{ size: "M", color: "ดำ", quantity: 4 }],
        deliveries: [
          {
            status: "RETURNED",
            lines: [{ description: "เสื้อยืด", size: "M", color: "ดำ", qty: 4 }],
          },
        ],
      }),
    );

    expect(evidence.hasNonReturnedDelivery).toBe(false);
    expect(evidence.totalPacked).toBe(0);
    expect(evidence.totalRemaining).toBe(4);
    expect(evidence.isReadyToShip).toBe(false);
  });

  it("allows a non-returned delivery when the order has no positive variant quantity", () => {
    const evidence = packingEvidenceFromOrder(
      packingOrder({
        variants: [{ size: "M", color: "ดำ", quantity: 0 }],
        deliveries: [{ status: "PENDING", lines: [] }],
      }),
    );

    expect(evidence.hasOrderedVariantQuantity).toBe(false);
    expect(evidence.hasNonReturnedDelivery).toBe(true);
    expect(evidence.isReadyToShip).toBe(true);
  });

  it("requires every ordered size/color key to be fully packed", () => {
    const evidence = packingEvidenceFromOrder(
      packingOrder({
        variants: [
          { size: "M", color: "ดำ", quantity: 6 },
          { size: "L", color: "ดำ", quantity: 4 },
        ],
        deliveries: [
          {
            status: "PREPARING",
            lines: [
              { description: " เสื้อยืด ", size: " m ", color: "ดำ", qty: 6 },
              { description: "เสื้อยืด", size: "L", color: "ดำ", qty: 3 },
              { description: "ของแถม", size: null, color: null, qty: 100 },
            ],
          },
        ],
      }),
    );

    expect(evidence.totalOrdered).toBe(10);
    expect(evidence.totalPacked).toBe(9);
    expect(evidence.totalRemaining).toBe(1);
    expect(evidence.lines.find((line) => line.size === "L")?.remaining).toBe(1);
    expect(evidence.isReadyToShip).toBe(false);
  });

  it("combines ordered and packed quantities across rows and deliveries", () => {
    const order = {
      items: [
        {
          products: [
            {
              description: "เสื้อรุ่น A",
              variants: [{ size: "XL", color: " Navy ", quantity: 2 }],
            },
            {
              description: "เสื้อรุ่น B",
              variants: [{ size: "xl", color: "navy", quantity: 3 }],
            },
          ],
        },
      ],
      deliveries: [
        {
          status: "PENDING",
          lines: [{ description: "เสื้อรุ่น A", size: "XL", color: "NAVY", qty: 2 }],
        },
        {
          status: "SHIPPED",
          lines: [{ description: "เสื้อรุ่น B", size: " xl ", color: "navy", qty: 3 }],
        },
        {
          status: "RETURNED",
          lines: [{ description: "เสื้อรุ่น A", size: "XL", color: "navy", qty: 50 }],
        },
      ],
    };

    const evidence = packingEvidenceFromOrder(order);

    expect(evidence.lines).toHaveLength(2);
    expect(evidence.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ description: "เสื้อรุ่น A", ordered: 2, packed: 2 }),
        expect.objectContaining({ description: "เสื้อรุ่น B", ordered: 3, packed: 3 }),
      ]),
    );
    expect(evidence.isReadyToShip).toBe(true);
    expect(packingLineKey(" เสื้อรุ่น A ", " XL ", "Navy")).toBe(
      packingLineKey("เสื้อรุ่น a", "xl", " navy "),
    );
  });

  it("does not let one product satisfy another product with the same size/color", () => {
    const evidence = packingEvidenceFromOrder({
      items: [
        {
          products: [
            {
              description: "เสื้อรุ่น A",
              variants: [{ size: "XL", color: "navy", quantity: 2 }],
            },
            {
              description: "เสื้อรุ่น B",
              variants: [{ size: "XL", color: "navy", quantity: 3 }],
            },
          ],
        },
      ],
      deliveries: [
        {
          status: "PENDING",
          lines: [{ description: "เสื้อรุ่น A", size: "XL", color: "navy", qty: 5 }],
        },
      ],
    });

    expect(evidence.lines.find((line) => line.description === "เสื้อรุ่น B")?.remaining).toBe(3);
    expect(evidence.isReadyToShip).toBe(false);
  });
});

describe("findPackingOverflow", () => {
  it("checks incoming duplicate lines against the shared packing counts", () => {
    const evidence = packingEvidenceFromOrder(
      packingOrder({
        variants: [{ size: "M", color: "ดำ", quantity: 6 }],
        deliveries: [
          {
            status: "PENDING",
            lines: [{ description: "เสื้อยืด", size: "M", color: "ดำ", qty: 3 }],
          },
        ],
      }),
    );

    expect(
      findPackingOverflow(evidence, [
        { description: "เสื้อยืด", size: "M", color: "ดำ", qty: 2 },
        { description: "เสื้อยืด", size: "m", color: "ดำ", qty: 2 },
      ]),
    ).toMatchObject({ ordered: 6, alreadyPacked: 5, incomingQty: 2, remaining: 1 });
  });
});

describe("assertOrderPackingReadyToShip", () => {
  it("rejects a returned-only delivery as no usable delivery evidence", async () => {
    const tx = {
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(
          packingOrder({
            deliveries: [{ status: "RETURNED", lines: [] }],
          }),
        ),
      },
    };

    await expect(
      assertOrderPackingReadyToShip(tx as never, "order-1"),
    ).rejects.toThrow("ยังไม่มีใบส่งของที่ใช้งานอยู่");
  });

  it("loads the current evidence and explains an incomplete pack", async () => {
    const findUniqueOrThrow = vi.fn().mockResolvedValue(
      packingOrder({
        variants: [{ size: "M", color: "ดำ", quantity: 5 }],
        deliveries: [
          {
            status: "PENDING",
            lines: [{ description: "เสื้อยืด", size: "M", color: "ดำ", qty: 4 }],
          },
        ],
      }),
    );
    const tx = { order: { findUniqueOrThrow } };

    await expect(
      assertOrderPackingReadyToShip(tx as never, "order-1"),
    ).rejects.toThrow("ยังแพ็คสินค้าไม่ครบ");
    expect(findUniqueOrThrow).toHaveBeenCalledOnce();
  });

  it("returns complete evidence when the order can move to ready-to-ship", async () => {
    const tx = {
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(
          packingOrder({
            variants: [{ size: "M", color: "ดำ", quantity: 5 }],
            deliveries: [
              {
                status: "PREPARING",
                lines: [{ description: "เสื้อยืด", size: "M", color: "ดำ", qty: 5 }],
              },
            ],
          }),
        ),
      },
    };

    await expect(
      assertOrderPackingReadyToShip(tx as never, "order-1"),
    ).resolves.toMatchObject({ isReadyToShip: true, totalRemaining: 0 });
  });
});
