import { describe, it, expect } from "vitest";
import {
  buildItemPriceLines,
  calculateItemSubtotal,
  sumOrderQuantity,
} from "./pricing";


describe("buildItemPriceLines — แจกแจงราคาให้บวกตามได้", () => {
  const item = {
    baseUnitPrice: 100,
    totalQuantity: 10,
    products: [{ baseUnitPrice: 100, discount: 0, totalQuantity: 10 }],
    prints: [{ unitPrice: 20 }],
    addons: [{ pricingType: "PER_ORDER", unitPrice: 50 }],
  };

  it("แตกเป็น 3 บรรทัด และยอดพิมพ์คิดเป็น ราคา/ชิ้น × จำนวนรวม", () => {
    const lines = buildItemPriceLines(item);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ kind: "product", unitPrice: 100, quantity: 10, total: 1000 });
    expect(lines[1]).toMatchObject({ kind: "print", unitPrice: 20, quantity: 10, total: 200 });
    expect(lines[2]).toMatchObject({ kind: "addon", unitPrice: 50, quantity: 1, total: 50 });
  });

  it("ส่วนเสริมต่อชิ้นคิด × จำนวนรวม — จุดที่หน้าจอเดิมโชว์น้อยกว่าที่เก็บจริง 10 เท่า", () => {
    const lines = buildItemPriceLines({
      ...item,
      addons: [{ pricingType: "PER_PIECE", unitPrice: 50 }],
    });
    const addon = lines.find((l) => l.kind === "addon")!;
    expect(addon.quantity).toBe(10);
    expect(addon.total).toBe(500);
  });

  it("ส่วนเสริมต่อชิ้นที่ระบุจำนวนเอง ใช้จำนวนของตัวเอง ไม่ใช่จำนวนรวม", () => {
    const lines = buildItemPriceLines({
      ...item,
      addons: [{ pricingType: "PER_PIECE", unitPrice: 50, quantity: 3 }],
    });
    expect(lines.find((l) => l.kind === "addon")).toMatchObject({ quantity: 3, total: 150 });
  });

  it("ส่วนลดต่อชิ้นหักออกจากราคา/หน่วย และไม่ติดลบ", () => {
    const lines = buildItemPriceLines({
      ...item,
      products: [{ baseUnitPrice: 100, discount: 130, totalQuantity: 10 }],
    });
    expect(lines[0]).toMatchObject({ unitPrice: 0, total: 0 });
  });

  it("ผลรวมทุกบรรทัด = subtotal ของรายการเสมอ (กันสูตรสองที่หลุดจากกัน)", () => {
    const cases = [
      item,
      { ...item, addons: [{ pricingType: "PER_PIECE", unitPrice: 50 }] },
      { ...item, prints: [{ unitPrice: 20 }, { unitPrice: 15 }] },
      {
        ...item,
        products: [
          { baseUnitPrice: 100, discount: 10, totalQuantity: 6 },
          { baseUnitPrice: 250, totalQuantity: 4 },
        ],
      },
    ];
    for (const c of cases) {
      const sum = buildItemPriceLines(c).reduce((s, l) => s + l.total, 0);
      expect(sum).toBeCloseTo(calculateItemSubtotal(c), 2);
    }
  });
});

describe("sumOrderQuantity — จำนวนชิ้นรวมทั้งใบ", () => {
  it("บวกข้ามรายการและข้ามสินค้า", () => {
    expect(
      sumOrderQuantity([
        { products: [{ variants: [{ quantity: 10 }, { quantity: 5 }] }] },
        { products: [{ variants: [{ quantity: 3 }] }, { variants: [{ quantity: 2 }] }] },
      ]),
    ).toBe(20);
  });

  it("ทนของว่าง/null ทุกชั้น", () => {
    expect(sumOrderQuantity(null)).toBe(0);
    expect(sumOrderQuantity(undefined)).toBe(0);
    expect(sumOrderQuantity([])).toBe(0);
    expect(sumOrderQuantity([{ products: null }])).toBe(0);
    expect(sumOrderQuantity([{ products: [{ variants: null }] }])).toBe(0);
  });
});
