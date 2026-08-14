import { describe, expect, it } from "vitest";
import {
  orderFeesFingerprint,
  orderItemsFingerprint,
  orderReferenceImagesFingerprint,
} from "./order-form-concurrency";

describe("order form child fingerprints", () => {
  it("ไม่เปลี่ยนตามลำดับ relation ที่ query คืนมา", () => {
    const first = {
      id: "item-1",
      sortOrder: 0,
      products: [
        {
          id: "product-b",
          receivedInspected: false,
          variants: [{ id: "variant-b", size: "L", quantity: 1 }],
        },
        {
          id: "product-a",
          receivedInspected: false,
          variants: [{ id: "variant-a", size: "M", quantity: 2 }],
        },
      ],
      prints: [],
      addons: [],
    };
    const reordered = {
      ...first,
      products: [...first.products].reverse(),
    };

    expect(orderItemsFingerprint([first])).toBe(
      orderItemsFingerprint([reordered]),
    );
  });

  it("เปลี่ยนเมื่อ field งานตรวจรับบน product ถูกแก้นอกฟอร์ม", () => {
    const before = {
      id: "item-1",
      products: [
        {
          id: "saved-product-1",
          receivedInspected: false,
          receiveNote: null,
          variants: [],
        },
      ],
      prints: [],
      addons: [],
    };
    const after = {
      ...before,
      products: [
        {
          ...before.products[0],
          receivedInspected: true,
          receiveNote: "รับครบแล้ว",
        },
      ],
    };

    expect(orderItemsFingerprint([before])).not.toBe(
      orderItemsFingerprint([after]),
    );
  });

  it("ครอบ identity และรายละเอียดของ fees กับ REFERENCE_IMAGE", () => {
    expect(
      orderFeesFingerprint([{ id: "fee-1", amount: 100 }]),
    ).not.toBe(orderFeesFingerprint([{ id: "fee-2", amount: 100 }]));
    expect(
      orderReferenceImagesFingerprint([
        { id: "file-1", fileUrl: "/a.png", printPosition: "FRONT" },
      ]),
    ).not.toBe(
      orderReferenceImagesFingerprint([
        { id: "file-1", fileUrl: "/a.png", printPosition: "BACK" },
      ]),
    );
  });
});
