import { describe, expect, it } from "vitest";
import { EMPTY_ITEM, EMPTY_PRINT, createOrderItemProduct } from "@/types/order-form";
import { EMPTY_ORDER_HEADER } from "./use-order-header-form";
import { EMPTY_SHIPPING_STATE } from "./use-order-shipping";
import {
  ORDER_DRAFT_TTL_MS,
  ORDER_DRAFT_VERSION,
  clearOrderDraft,
  loadOrderDraft,
  orderDraftStorageKey,
  referenceImagesForDraft,
  saveOrderDraft,
  saveOrderDraftIfCurrent,
  type OrderDraftData,
} from "./use-order-items-form";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function completeDraft(): OrderDraftData {
  return {
    header: {
      customerId: "customer-1",
      channel: "LAZADA",
      title: "เสื้อทีมหน้าร้าน",
      description: "รายละเอียดจากแชท",
      deadline: "2026-08-20",
      notes: "ส่งตัวอย่างก่อนผลิต",
      priority: "URGENT",
      paymentTerms: "CREDIT_30",
      poNumber: "PO-0099",
      externalOrderId: "LZD-123",
      taxRate: 0,
      discount: 250,
      platformFee: 125,
    },
    selectedCustomer: { id: "customer-1", name: "ลูกค้าทดสอบ", customerType: "CORPORATE" },
    items: [{ ...structuredClone(EMPTY_ITEM), description: "เสื้อ DTF 20 ตัว" }],
    fees: [{ feeType: "DELIVERY", name: "ค่าส่ง", amount: 80 }],
    includeShipping: true,
    shipping: {
      recipientName: "ฝ่ายจัดซื้อ",
      phone: "0812345678",
      address: "99 ถนนสุขุมวิท",
      subDistrict: "คลองเตย",
      district: "คลองเตย",
      province: "กรุงเทพฯ",
      postalCode: "10110",
    },
    filledFromCustomerId: "customer-1",
    referenceImages: [
      {
        fileUrl: "https://storage.example/reference.png",
        fileName: "reference.png",
        fileSize: 2048,
        printPosition: "FRONT",
      },
    ],
  };
}

describe("order create draft v2", () => {
  it("เก็บและกู้ทุกก้อนใน envelope ที่มี version + updatedAt", () => {
    const storage = new MemoryStorage();
    const now = Date.UTC(2026, 7, 13, 10);
    const draft = completeDraft();

    saveOrderDraft(draft, undefined, { storage, now });

    const raw = storage.getItem(orderDraftStorageKey());
    expect(raw).not.toBeNull();
    const envelope = JSON.parse(raw!);
    expect(envelope.version).toBe(ORDER_DRAFT_VERSION);
    expect(envelope.updatedAt).toBe(now);
    expect(loadOrderDraft(undefined, { storage, now: now + 1_000 })).toEqual(draft);
  });

  it("ไม่เขียน base64 preview ลง localStorage แต่คง metadata ของไฟล์", () => {
    const storage = new MemoryStorage();
    const draft = completeDraft();
    draft.items[0].prints = [{
      ...EMPTY_PRINT,
      designImageUrl: "https://storage.example/print.png",
      designImagePreview: "data:image/png;base64,print-preview",
    }];
    const images = referenceImagesForDraft([
      {
        ...draft.referenceImages[0],
        preview: "data:image/png;base64,very-large-preview",
      },
    ]);

    saveOrderDraft({ ...draft, referenceImages: images }, undefined, { storage, now: 100 });

    const raw = storage.getItem(orderDraftStorageKey())!;
    expect(raw).not.toContain("base64");
    expect(loadOrderDraft(undefined, { storage, now: 101 })?.referenceImages).toEqual(
      draft.referenceImages,
    );
    const restoredPrint = loadOrderDraft(undefined, { storage, now: 101 })?.items[0].prints[0];
    expect(restoredPrint).toMatchObject({
      designImageUrl: "https://storage.example/print.png",
    });
    expect(restoredPrint).not.toHaveProperty("designImagePreview");
  });

  it("กู้ลำดับสินค้าและ form key พร้อมสเปคของแต่ละแหล่งได้ครบ", () => {
    const storage = new MemoryStorage();
    const draft = completeDraft();
    draft.items[0].products = [
      createOrderItemProduct({
        formKey: "provided-1",
        itemSource: "CUSTOMER_PROVIDED",
        description: "เสื้อลูกค้า",
        garmentCondition: "GOOD",
        variants: [{ color: "ขาว", size: "L", quantity: 12 }],
      }),
      createOrderItemProduct({
        formKey: "custom-1",
        itemSource: "CUSTOM_MADE",
        description: "ตัดเย็บใหม่",
        patternId: "pattern-1",
        fabricType: "COTTON",
        variants: [{ color: "ดำ", size: "XL", quantity: 8 }],
      }),
    ];

    saveOrderDraft(draft, "reorder-user", { storage, now: 100 });
    const restored = loadOrderDraft("reorder-user", { storage, now: 101 });

    expect(restored?.items[0].products.map((entry) => entry.formKey)).toEqual([
      "provided-1",
      "custom-1",
    ]);
    expect(restored?.items[0].products[0]).toMatchObject({
      garmentCondition: "GOOD",
      variants: [{ color: "ขาว", size: "L", quantity: 12 }],
    });
    expect(restored?.items[0].products[1]).toMatchObject({
      patternId: "pattern-1",
      fabricType: "COTTON",
      variants: [{ color: "ดำ", size: "XL", quantity: 8 }],
    });
  });

  it("ลบ draft ที่หมดอายุหรือคนละ version แทนการกู้ข้อมูลเก่า", () => {
    const storage = new MemoryStorage();
    const key = orderDraftStorageKey();
    const now = 10_000;
    saveOrderDraft(completeDraft(), undefined, { storage, now });

    expect(
      loadOrderDraft(undefined, { storage, now: now + ORDER_DRAFT_TTL_MS + 1 }),
    ).toBeNull();
    expect(storage.getItem(key)).toBeNull();

    storage.setItem(key, JSON.stringify({
      version: ORDER_DRAFT_VERSION + 1,
      updatedAt: now,
      data: completeDraft(),
    }));
    expect(loadOrderDraft(undefined, { storage, now })).toBeNull();
    expect(storage.getItem(key)).toBeNull();
  });

  it("แยก key ตาม optional user scope และ clear เฉพาะ scope", () => {
    const storage = new MemoryStorage();
    saveOrderDraft(completeDraft(), "user-a", { storage, now: 100 });

    expect(loadOrderDraft("user-a", { storage, now: 101 })?.header.customerId).toBe("customer-1");
    expect(loadOrderDraft("user-b", { storage, now: 101 })).toBeNull();

    clearOrderDraft("user-a", { storage });
    expect(loadOrderDraft("user-a", { storage, now: 101 })).toBeNull();
  });

  it("ค่ามาตรฐานล้วนไม่สร้าง banner draft และล้าง key เดิม", () => {
    const storage = new MemoryStorage();
    const key = orderDraftStorageKey();
    storage.setItem(key, "stale");

    saveOrderDraft({
      header: { ...EMPTY_ORDER_HEADER },
      selectedCustomer: null,
      items: [structuredClone(EMPTY_ITEM)],
      fees: [],
      includeShipping: false,
      shipping: { ...EMPTY_SHIPPING_STATE },
      filledFromCustomerId: null,
      referenceImages: [],
    }, undefined, { storage, now: 100 });

    expect(storage.getItem(key)).toBeNull();
  });

  it("callback debounce เก่าหรือ callback หลัง success เขียน draft ที่ล้างแล้วกลับมาไม่ได้", () => {
    const storage = new MemoryStorage();
    const draft = completeDraft();
    const key = orderDraftStorageKey();

    saveOrderDraft(draft, undefined, { storage, now: 100 });
    clearOrderDraft(undefined, { storage });

    expect(saveOrderDraftIfCurrent(
      draft,
      undefined,
      { scheduledRevision: 1, currentRevision: 2, blocked: false },
      { storage, now: 101 },
    )).toBe(false);
    expect(saveOrderDraftIfCurrent(
      draft,
      undefined,
      { scheduledRevision: 2, currentRevision: 2, blocked: true },
      { storage, now: 102 },
    )).toBe(false);
    expect(storage.getItem(key)).toBeNull();

    expect(saveOrderDraftIfCurrent(
      draft,
      undefined,
      { scheduledRevision: 3, currentRevision: 3, blocked: false },
      { storage, now: 103 },
    )).toBe(true);
    expect(storage.getItem(key)).not.toBeNull();
  });
});
