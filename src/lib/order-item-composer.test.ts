import { describe, expect, it } from "vitest";
import {
  buildOrderItemPriceSummary,
  getProductSourcePresentation,
  moveOrderItemProduct,
  resolveFeeCatalogSelection,
} from "./order-item-composer";
import { EMPTY_PRODUCT, type OrderItemForm } from "@/types/order-form";

function product(
  overrides: Partial<OrderItemForm["products"][number]> = {},
): OrderItemForm["products"][number] {
  return {
    ...structuredClone(EMPTY_PRODUCT),
    ...overrides,
  };
}

describe("buildOrderItemPriceSummary", () => {
  it("สร้างบรรทัดสรุปด้วยสูตรราคาเดิมและตัดบรรทัดที่ไม่มีจำนวน/ราคา", () => {
    const item: OrderItemForm = {
      description: "เสื้อทีม",
      notes: "",
      products: [
        product({
          productName: "เสื้อ Cotton",
          baseUnitPrice: 100,
          discount: 10,
          variants: [
            { color: "ดำ", size: "M", quantity: 2 },
            { color: "ดำ", size: "L", quantity: 1 },
          ],
        }),
        product({
          description: "เสื้อลูกค้า",
          baseUnitPrice: 50,
          discount: 60,
          variants: [{ color: "ขาว", size: "XL", quantity: 2 }],
        }),
        product({
          description: "แถวที่ยังไม่กรอกจำนวน",
          baseUnitPrice: 999,
          variants: [{ color: "", size: "", quantity: 0 }],
        }),
      ],
      prints: [
        {
          position: "FRONT",
          printType: "DTF",
          colorCount: 1,
          unitPrice: 20,
          printSize: "A4",
          width: 21,
          height: 29.7,
          designNote: "",
        },
        {
          position: "BACK",
          printType: "DTG",
          colorCount: 1,
          unitPrice: 0,
          printSize: "",
          width: 0,
          height: 0,
          designNote: "",
        },
      ],
      addons: [
        { addonType: "PACK", name: "แพ็กถุง", pricingType: "PER_PIECE", unitPrice: 5 },
        { addonType: "SETUP", name: "ค่าเซ็ต", pricingType: "PER_ORDER", unitPrice: 40 },
        { addonType: "FREE", name: "ของแถม", pricingType: "PER_ORDER", unitPrice: 0 },
      ],
    };

    expect(buildOrderItemPriceSummary(item)).toEqual({
      totalQuantity: 5,
      subtotal: 435,
      averageUnitPrice: 87,
      lines: [
        {
          key: "product-0",
          kind: "product",
          label: "เสื้อ Cotton",
          detail: "ดำ M",
          discount: 10,
          unitPrice: 90,
          quantity: 3,
          total: 270,
        },
        {
          key: "product-1",
          kind: "product",
          label: "เสื้อลูกค้า",
          detail: "ขาว XL",
          discount: 60,
          unitPrice: 0,
          quantity: 2,
          total: 0,
        },
        {
          key: "print-0",
          kind: "print",
          label: "DTF",
          detail: "หน้า",
          unitPrice: 20,
          quantity: 5,
          total: 100,
        },
        {
          key: "addon-0",
          kind: "addon",
          label: "แพ็กถุง",
          detail: "ต่อชิ้น",
          unitPrice: 5,
          quantity: 5,
          total: 25,
        },
        {
          key: "addon-1",
          kind: "addon",
          label: "ค่าเซ็ต",
          detail: "ต่อออเดอร์",
          unitPrice: 40,
          quantity: 1,
          total: 40,
        },
      ],
    });
  });

  it("ไม่หารค่าเฉลี่ยเมื่อจำนวนรวมเป็นศูนย์", () => {
    const item: OrderItemForm = {
      description: "",
      notes: "",
      products: [],
      prints: [],
      addons: [],
    };

    expect(buildOrderItemPriceSummary(item)).toEqual({
      totalQuantity: 0,
      subtotal: 0,
      averageUnitPrice: null,
      lines: [],
    });
  });
});

describe("getProductSourcePresentation", () => {
  it.each([
    ["FROM_STOCK", "จากสต็อก", "default"],
    ["CUSTOM_MADE", "ตัดเย็บใหม่", "accent"],
    ["CUSTOMER_PROVIDED", "ลูกค้าส่งมา", "warning"],
    ["LEGACY_SOURCE", "LEGACY_SOURCE", "warning"],
  ] as const)("แปลง %s เป็น label และสี badge ที่ UI ใช้อยู่", (source, label, variant) => {
    expect(getProductSourcePresentation(source)).toEqual({ label, variant });
  });
});

describe("moveOrderItemProduct", () => {
  const customMade = product({
    formKey: "custom-made",
    itemSource: "CUSTOM_MADE",
    description: "เสื้อโรงเย็บ",
    patternId: "pattern-1",
    material: "Cotton 100%",
    variants: [
      { color: "ดำ", size: "M", quantity: 12 },
      { color: "ดำ", size: "L", quantity: 8 },
    ],
  });
  const customerProvided = product({
    formKey: "customer-provided",
    itemSource: "CUSTOMER_PROVIDED",
    description: "เสื้อลูกค้า",
    garmentCondition: "GOOD",
    receiveNote: "ครบทุกถุง",
    variants: [{ color: "ขาว", size: "XL", quantity: 20 }],
  });
  const otherItemProduct = product({
    formKey: "other-item",
    itemSource: "FROM_STOCK",
    description: "สินค้าอีกชุดงาน",
  });

  const items: OrderItemForm[] = [
    {
      description: "ชุดงานแรก",
      notes: "",
      products: [customMade, customerProvided],
      prints: [],
      addons: [],
    },
    {
      description: "ชุดงานที่สอง",
      notes: "",
      products: [otherItemProduct],
      prints: [],
      addons: [],
    },
  ];

  it("ย้ายสินค้าทั้งก้อนโดยคง variants และสเปคไว้กับ form key เดิม", () => {
    const moved = moveOrderItemProduct(items, 0, 1, -1);

    expect(moved[0].products.map((entry) => entry.formKey)).toEqual([
      "customer-provided",
      "custom-made",
    ]);
    expect(moved[0].products[0]).toMatchObject({
      garmentCondition: "GOOD",
      receiveNote: "ครบทุกถุง",
      variants: [{ color: "ขาว", size: "XL", quantity: 20 }],
    });
    expect(moved[0].products[1]).toMatchObject({
      patternId: "pattern-1",
      material: "Cotton 100%",
      variants: [
        { color: "ดำ", size: "M", quantity: 12 },
        { color: "ดำ", size: "L", quantity: 8 },
      ],
    });
    expect(moved[1]).toBe(items[1]);
    expect(items[0].products.map((entry) => entry.formKey)).toEqual([
      "custom-made",
      "customer-provided",
    ]);
  });

  it("ไม่ข้ามขอบรายการและไม่แตะชุดงานอื่น", () => {
    expect(moveOrderItemProduct(items, 0, 0, -1)).toEqual(items);
    expect(moveOrderItemProduct(items, 0, 1, 1)).toEqual(items);
    expect(moveOrderItemProduct(items, 0, -1, 1)).toEqual(items);
    expect(moveOrderItemProduct(items, 0, 2, -1)).toEqual(items);
    expect(moveOrderItemProduct(items, 9, 0, 1)).toEqual(items);
  });
});

describe("resolveFeeCatalogSelection", () => {
  const catalog = [
    {
      id: "delivery",
      name: "ค่าจัดส่ง",
      type: "SHIPPING",
      defaultPrice: 120,
      pricingType: "PER_ORDER",
    },
  ];

  it("คืนเฉพาะค่าที่ต้องเขียนลง fee form", () => {
    expect(resolveFeeCatalogSelection(catalog, "delivery")).toEqual({
      feeType: "SHIPPING",
      name: "ค่าจัดส่ง",
      amount: 120,
    });
  });

  it("คืน null เมื่อไม่มี id หรือหาแค็ตตาล็อกไม่เจอ", () => {
    expect(resolveFeeCatalogSelection(catalog, "")).toBeNull();
    expect(resolveFeeCatalogSelection(catalog, "missing")).toBeNull();
    expect(resolveFeeCatalogSelection(undefined, "delivery")).toBeNull();
  });
});
