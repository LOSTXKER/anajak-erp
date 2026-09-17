import { describe, expect, it } from "vitest";
import {
  buildOrderItemPriceSummary,
  createProductForSource,
  duplicateOrderItem,
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

describe("createProductForSource", () => {
  const itemWith = (products: OrderItemForm["products"]): OrderItemForm => ({
    description: "",
    notes: "",
    prints: [{ position: "FRONT", printType: "DTF", colorCount: 1, unitPrice: 25, printSize: "", width: 0, height: 0, designNote: "" }],
    addons: [],
    products,
  });

  it("ตัดเย็บใหม่/ลูกค้าส่งมาที่ยังไม่กรอกไซส์ นับ 0 ตัวและยอด 0 — ไม่มีแถวไซส์ว่างจำนวน 1 ติดมา (เบสเจอ 2026-09-18)", () => {
    const customMade = { ...createProductForSource("CUSTOM_MADE"), baseUnitPrice: 240 };
    const provided = createProductForSource("CUSTOMER_PROVIDED");
    expect(customMade.variants).toEqual([]);
    expect(provided.variants).toEqual([]);
    expect(provided.baseUnitPrice).toBe(0);
    const summary = buildOrderItemPriceSummary(itemWith([customMade, provided]));
    expect(summary.totalQuantity).toBe(0);
    expect(summary.subtotal).toBe(0);
  });

  it("จากสต็อกคงค่าตั้งต้นเดิม (มีแถวสินค้าให้กรอกจำนวน)", () => {
    const stock = createProductForSource("FROM_STOCK");
    expect(stock.itemSource).toBe("FROM_STOCK");
    expect(stock.variants).toEqual(EMPTY_PRODUCT.variants);
    expect(stock.formKey).toBeTruthy();
  });
});

describe("duplicateOrderItem", () => {
  const items = (): OrderItemForm[] => [
    {
      description: "เสื้อทีม",
      notes: "แยกถุง",
      prints: [{ position: "FRONT", printType: "DTF", colorCount: 2, unitPrice: 25, printSize: "A3", width: 29.7, height: 42, designNote: "", designImageUrl: "https://storage.example/a.png" }],
      addons: [{ addonType: "NECK_LABEL", name: "ป้ายคอ", pricingType: "PER_PIECE", unitPrice: 12 }],
      products: [
        product({ formKey: "old-key", savedProductId: "saved-1", itemSource: "CUSTOM_MADE", description: "โปโลตัดเย็บ", baseUnitPrice: 240, variants: [{ size: "M", color: "ดำ", quantity: 4 }] }),
      ],
    },
    { description: "ชุดอื่น", notes: "", prints: [], addons: [], products: [] },
  ];

  it("วางชุดที่คัดลอกไว้ท้ายรายการ (ไม่แทรกกลาง) พร้อมลาย สินค้า ไซส์ ส่วนเสริม และหมายเหตุ", () => {
    const next = duplicateOrderItem(items(), 0);
    expect(next).toHaveLength(3);
    // ชุดอื่นต้องอยู่ index เดิม — เลข index เป็นตัวชี้ของหน้า (ชุดเป้าหมายของ picker/คีย์การ์ด)
    expect(next[1].description).toBe("ชุดอื่น");
    expect(next[2].description).toBe("เสื้อทีม");
    expect(next[2].notes).toBe("แยกถุง");
    expect(next[2].prints).toEqual(items()[0].prints);
    expect(next[2].addons).toEqual(items()[0].addons);
    expect(next[2].products[0].variants).toEqual([{ size: "M", color: "ดำ", quantity: 4 }]);
  });

  it("แถวสินค้าในชุดใหม่ได้ form key ใหม่และไม่พา savedProductId ของแถวเดิมไป (กันหน้าแก้ผูกใบตรวจรับผิดตัว)", () => {
    const next = duplicateOrderItem(items(), 0);
    expect(next[2].products[0].savedProductId).toBeUndefined();
    expect(next[2].products[0].formKey).toBeTruthy();
    expect(next[2].products[0].formKey).not.toBe("old-key");
    expect(next[0].products[0].formKey).toBe("old-key");
    expect(next[0].products[0].savedProductId).toBe("saved-1");
  });

  it("แก้ชุดที่คัดลอกแล้วชุดต้นทางไม่เปลี่ยนตาม (ก๊อปลึก)", () => {
    const next = duplicateOrderItem(items(), 0);
    next[2].prints[0].unitPrice = 99;
    next[2].products[0].variants[0].quantity = 10;
    expect(next[0].prints[0].unitPrice).toBe(25);
    expect(next[0].products[0].variants[0].quantity).toBe(4);
  });

  it("ไม่พาหลักฐานการรับของของแถวเดิมไปชุดใหม่ (สภาพ · หมายเหตุรับของ · ตรวจรับแล้ว)", () => {
    const withReceipt = items();
    withReceipt[0].products = [
      product({
        itemSource: "CUSTOMER_PROVIDED",
        description: "เสื้อลูกค้า",
        baseUnitPrice: 0,
        garmentCondition: "GOOD",
        receiveNote: "รับครบ 20 ตัว ถุงครบ",
        receivedInspected: true,
        variants: [{ size: "L", color: "ขาว", quantity: 20 }],
      }),
    ];
    const clone = duplicateOrderItem(withReceipt, 0)[2].products[0];
    expect(clone.garmentCondition).toBe("");
    expect(clone.receiveNote).toBe("");
    expect(clone.receivedInspected).toBe(false);
    expect(clone.variants).toEqual([{ size: "L", color: "ขาว", quantity: 20 }]);
  });

  it("ดัชนีที่ไม่มีอยู่ = คืนรายการเดิม", () => {
    const original = items();
    expect(duplicateOrderItem(original, 5)).toBe(original);
  });
});
