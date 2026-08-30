import { describe, expect, it } from "vitest";
import type { InternalStatus } from "@prisma/client";
import { EMPTY_ITEM } from "@/types/order-form";
import {
  buildOrderEditFormSeed,
  buildOrderEditSavePlan,
  canEditOrderReferenceImage,
  getOrderEditCapability,
  getOrderEditBilledFloorState,
  getOrderEditEmptyWorkResiduals,
  orderEditDateInputValue,
  requiresOrderEditReason,
  type OrderEditActor,
  type OrderEditAttachment,
  type OrderEditFormValues,
  type OrderEditOrder,
} from "./order-edit-form";

const actor: OrderEditActor = { id: "user-sales", role: "SALES" };

function orderFixture(
  overrides: Record<string, unknown> = {},
): OrderEditOrder {
  return {
    id: "order-1",
    orderNumber: "ORD-TEST-1",
    updatedAt: new Date("2026-08-14T10:00:00.000Z"),
    orderType: "CUSTOM",
    internalStatus: "INQUIRY",
    customerStatus: "ORDER_RECEIVED",
    customerId: "customer-1",
    channel: "SHOPEE",
    description: null,
    deadline: new Date("2026-08-20T00:00:00.000Z"),
    notes: null,
    priority: "HIGH",
    paymentTerms: null,
    poNumber: null,
    externalOrderId: null,
    taxRate: 7,
    discount: 90,
    platformFee: null,
    billedFloor: 600,
    totalAmount: 1_284,
    shippingRecipientName: "Best",
    shippingPhone: null,
    shippingAddress: null,
    shippingSubDistrict: null,
    shippingDistrict: null,
    shippingProvince: null,
    shippingPostalCode: null,
    customer: {
      id: "customer-1",
      name: "ลูกค้าทดสอบ",
      customerType: "CORPORATE",
      totalOrders: 7,
    },
    items: [
      {
        id: "item-1",
        description: "ชุดงาน",
        notes: null,
        products: [
          {
            id: "saved-1",
            productId: "product-1",
            productType: "T_SHIRT",
            description: "เสื้อทดสอบ",
            material: "CVC",
            baseUnitPrice: 100,
            discount: 0,
            packagingOptionId: null,
            itemSource: "FROM_STOCK",
            fabricType: null,
            fabricWeight: null,
            fabricColor: null,
            processingType: "PRINT_ONLY",
            patternId: null,
            collarType: null,
            sleeveType: null,
            bodyFit: null,
            patternFileUrl: null,
            patternNote: null,
            garmentCondition: null,
            receivedInspected: false,
            receiveNote: null,
            product: {
              name: "เสื้อ CVC",
              sku: "CVC-001",
              imageUrl: "/shirt.png",
            },
            variants: [{ size: "M", color: null, quantity: 10 }],
          },
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
            designNote: null,
            designImageUrl: "/design.png",
            artworkId: "artwork-1",
          },
        ],
        addons: [
          {
            addonType: "PACKAGING",
            name: "ถุงแพ็ก",
            description: "ถุงใส OPP",
            pricingType: "PER_PIECE",
            unitPrice: 2,
            quantity: 4,
            notes: "แพ็กเฉพาะ 4 ชิ้น",
          },
        ],
      },
    ],
    fees: [{
      feeType: "SHIPPING",
      name: "ค่าส่ง",
      amount: 40,
      description: "ส่งด่วน",
      notes: "เก็บกล่องเดิม",
    }],
    ...overrides,
  } as unknown as OrderEditOrder;
}

function attachmentFixture(
  overrides: Partial<OrderEditAttachment> = {},
): OrderEditAttachment {
  return {
    id: "attachment-1",
    entityType: "ORDER",
    entityId: "order-1",
    fileName: "reference.png",
    fileUrl: "/reference.png",
    fileType: "image/png",
    fileSize: 1234,
    category: "REFERENCE_IMAGE",
    printPosition: null,
    notes: null,
    uploadedById: actor.id,
    uploadedBy: null,
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    ...overrides,
  } as OrderEditAttachment;
}

function valuesFromSeed(
  seed: ReturnType<typeof buildOrderEditFormSeed>,
): OrderEditFormValues {
  return structuredClone({
    header: seed.header,
    items: seed.items,
    fees: seed.fees,
    includeShipping: seed.includeShipping,
    shipping: seed.shipping,
    referenceImages: seed.referenceImages,
  });
}

describe("order edit form seed", () => {
  it("map หัวใบ วันที่ null รายการ ค่าธรรมเนียม และ shipping โดยไม่เติม default create ทับ", () => {
    const seed = buildOrderEditFormSeed(orderFixture(), [], actor);

    expect(seed.header).toMatchObject({
      customerId: "customer-1",
      channel: "SHOPEE",
      description: "",
      deadline: "2026-08-20",
      notes: "",
      priority: "HIGH",
      paymentTerms: "",
      poNumber: "",
      externalOrderId: "",
      taxRate: 7,
      discount: 90,
      platformFee: 0,
    });
    expect(seed.selectedCustomer).toMatchObject({
      id: "customer-1",
      name: "ลูกค้าทดสอบ",
      _count: { orders: 7 },
    });
    expect(seed.expectedUpdatedAt).toEqual(
      new Date("2026-08-14T10:00:00.000Z"),
    );
    expect(seed).toMatchObject({ billedFloor: 600, originalTotal: 1_284 });
    expect(seed.items[0].products[0]).toMatchObject({
      formKey: "saved-product-saved-1",
      savedProductId: "saved-1",
      productId: "product-1",
      productName: "เสื้อ CVC",
      variants: [{ size: "M", color: "", quantity: 10 }],
    });
    expect(seed.items[0].prints[0]).toMatchObject({
      designImageUrl: "/design.png",
      artworkId: "artwork-1",
    });
    expect(seed.items[0].addons[0]).toMatchObject({
      description: "ถุงใส OPP",
      quantity: 4,
      notes: "แพ็กเฉพาะ 4 ชิ้น",
    });
    expect(seed.fees).toEqual([
      {
        feeType: "SHIPPING",
        name: "ค่าส่ง",
        amount: 40,
        description: "ส่งด่วน",
        notes: "เก็บกล่องเดิม",
      },
    ]);
    // legacy บางใบมีแค่ชื่อผู้รับ — ต้องโชว์ค่าจริง ไม่ตีเป็น "ไม่มีจัดส่ง"
    expect(seed.includeShipping).toBe(true);
    expect(seed.shipping).toEqual({
      recipientName: "Best",
      phone: "",
      address: "",
      subDistrict: "",
      district: "",
      province: "",
      postalCode: "",
    });
  });

  it("เอาเฉพาะ REFERENCE_IMAGE และคำนวณ canEdit จากเจ้าของไฟล์/role", () => {
    const attachments = [
      attachmentFixture(),
      attachmentFixture({
        id: "customer-file",
        fileName: "brief.pdf",
        fileUrl: "/brief.pdf",
        fileType: "application/pdf",
        uploadedById: null,
      }),
      attachmentFixture({ id: "print-file", category: "PRINT_FILE" }),
    ];
    const seed = buildOrderEditFormSeed(orderFixture(), attachments, actor);

    expect(seed.referenceImages).toEqual([
      expect.objectContaining({
        id: "attachment-1",
        preview: "/reference.png",
        canEdit: true,
      }),
      expect.objectContaining({
        id: "customer-file",
        canEdit: false,
      }),
    ]);
    expect(seed.referenceImages[1]).not.toHaveProperty("preview");
    expect(
      canEditOrderReferenceImage(
        { uploadedById: null },
        { id: "manager", role: "MANAGER" },
      ),
    ).toBe(true);
  });

  it("แปลง Date/string/null เป็นวันที่ input เดียวกัน", () => {
    expect(orderEditDateInputValue(new Date("2026-08-20T00:00:00Z"))).toBe(
      "2026-08-20",
    );
    expect(orderEditDateInputValue("2026-08-20T12:30:00+07:00")).toBe(
      "2026-08-20",
    );
    expect(orderEditDateInputValue(null)).toBe("");
    expect(orderEditDateInputValue("not-a-date")).toBe("");
  });
});

describe("normalized dirty state and save plan", () => {
  it("ไม่ dirty จาก formKey/preview/canEdit, ช่องว่างที่ server trim หรือลำดับไฟล์จาก refetch", () => {
    const seed = buildOrderEditFormSeed(
      orderFixture(),
      [
        attachmentFixture({ id: "b" }),
        attachmentFixture({ id: "a", fileUrl: "/a.png" }),
      ],
      actor,
    );
    const current = valuesFromSeed(seed);
    current.header.customerId = "locked-customer-must-not-dirty";
    current.header.channel = "LOCKED_CHANNEL_MUST_NOT_DIRTY";
    current.shipping.recipientName = ` ${current.shipping.recipientName} `;
    current.items[0].products[0].formKey = "new-ui-key";
    current.items[0].products[0].productName = "ชื่อแสดงผลจาก cache ใหม่";
    current.referenceImages.reverse();
    current.referenceImages[0].canEdit = !current.referenceImages[0].canEdit;
    current.referenceImages[0].preview = "data:image/png;base64,previewใหม่";

    expect(buildOrderEditSavePlan(seed.originalSnapshot, current)).toEqual({
      headerChanged: false,
      shippingChanged: false,
      hasChanges: false,
    });
  });

  it("แยก meta ออกจาก work และส่งเฉพาะก้อน work ที่เปลี่ยน", () => {
    const seed = buildOrderEditFormSeed(orderFixture(), [], actor);

    const metaOnly = valuesFromSeed(seed);
    metaOnly.header.notes = "หมายเหตุใหม่";
    const metaPlan = buildOrderEditSavePlan(seed.originalSnapshot, metaOnly);
    expect(metaPlan).toMatchObject({ hasChanges: true });
    expect(metaPlan.meta).toEqual({ notes: "หมายเหตุใหม่" });
    expect(metaPlan.headerChanged).toBe(true);
    expect(metaPlan.shippingChanged).toBe(false);
    expect(metaPlan.work).toBeUndefined();
    expect(metaPlan.referenceImages).toBeUndefined();

    const itemOnly = valuesFromSeed(seed);
    itemOnly.items[0].products[0].baseUnitPrice = 125;
    const itemPlan = buildOrderEditSavePlan(seed.originalSnapshot, itemOnly);
    expect(itemPlan.work?.items?.[0].products[0].baseUnitPrice).toBe(125);
    expect(itemPlan.work?.items?.[0].products[0].savedProductId).toBe("saved-1");
    expect(itemPlan.work).not.toHaveProperty("fees");
    expect(itemPlan.work).not.toHaveProperty("discount");
    expect(itemPlan.meta).toBeUndefined();

    const allWork = valuesFromSeed(seed);
    allWork.items[0].products[0].baseUnitPrice = 130;
    allWork.fees[0].amount = 55;
    allWork.header.discount = 100;
    const workPlan = buildOrderEditSavePlan(seed.originalSnapshot, allWork);
    expect(workPlan.work).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        fees: [{
          feeType: "SHIPPING",
          name: "ค่าส่ง",
          amount: 55,
          description: "ส่งด่วน",
          notes: "เก็บกล่องเดิม",
        }],
        discount: 100,
      }),
    );
    expect(workPlan.work?.items?.[0].addons[0]).toMatchObject({
      description: "ถุงใส OPP",
      quantity: 4,
      notes: "แพ็กเฉพาะ 4 ชิ้น",
    });
  });

  it("referenceImages เปลี่ยนเฉพาะตำแหน่งแล้วไม่พ่วง meta/work", () => {
    const seed = buildOrderEditFormSeed(
      orderFixture(),
      [attachmentFixture()],
      actor,
    );
    const current = valuesFromSeed(seed);
    current.referenceImages[0].printPosition = "FRONT";

    expect(buildOrderEditSavePlan(seed.originalSnapshot, current)).toEqual({
      referenceImages: [
        {
          id: "attachment-1",
          fileUrl: "/reference.png",
          fileName: "reference.png",
          fileSize: 1234,
          printPosition: "FRONT",
        },
      ],
      headerChanged: false,
      shippingChanged: false,
      hasChanges: true,
    });
  });

  it("รองรับไฟล์อัปโหลดใหม่ที่ยังไม่มี Attachment id", () => {
    const seed = buildOrderEditFormSeed(orderFixture(), [], actor);
    const current = valuesFromSeed(seed);
    current.referenceImages.push({
      fileUrl: "/new-reference.png",
      fileName: "new-reference.png",
      fileSize: 500,
      canEdit: true,
    });

    const plan = buildOrderEditSavePlan(seed.originalSnapshot, current);
    expect(plan.referenceImages).toEqual([
      {
        fileUrl: "/new-reference.png",
        fileName: "new-reference.png",
        fileSize: 500,
      },
    ]);
  });

  it("shipping เปลี่ยนแล้วแยกจาก header เพื่อ validate เฉพาะ section ที่แตะ", () => {
    const seed = buildOrderEditFormSeed(orderFixture(), [], actor);
    const current = valuesFromSeed(seed);
    current.shipping.address = "99 ถนนสุขุมวิท";

    const plan = buildOrderEditSavePlan(seed.originalSnapshot, current);
    expect(plan.headerChanged).toBe(false);
    expect(plan.shippingChanged).toBe(true);
    expect(plan.meta).toEqual({ shippingAddress: "99 ถนนสุขุมวิท" });
  });

  it("ปิด shipping แล้วส่ง null เฉพาะช่องเดิมที่ต้องล้าง", () => {
    const seed = buildOrderEditFormSeed(orderFixture(), [], actor);
    const current = valuesFromSeed(seed);
    current.includeShipping = false;

    const plan = buildOrderEditSavePlan(seed.originalSnapshot, current);
    expect(plan.shippingChanged).toBe(true);
    expect(plan.meta).toEqual({ shippingRecipientName: null });
  });

  it("ไม่ dirty เมื่อ hook เติม EMPTY_ITEM ให้ legacy order ที่ไม่มีรายการ", () => {
    const seed = buildOrderEditFormSeed(orderFixture({ items: [] }), [], actor);
    const current = valuesFromSeed(seed);
    current.items = [structuredClone(EMPTY_ITEM)];

    expect(buildOrderEditSavePlan(seed.originalSnapshot, current)).toEqual({
      headerChanged: false,
      shippingChanged: false,
      hasChanges: false,
    });
  });

  it("note บน empty item ทำให้ dirty แต่ไม่สร้าง work.items ว่างที่ server รับไม่ได้", () => {
    const seed = buildOrderEditFormSeed(orderFixture({ items: [] }), [], actor);
    const current = valuesFromSeed(seed);
    current.items = [{ ...structuredClone(EMPTY_ITEM), notes: "เก็บรายละเอียดนี้ไว้" }];

    const plan = buildOrderEditSavePlan(seed.originalSnapshot, current);

    expect(plan).toMatchObject({
      hasChanges: true,
      hasResidualItemNotes: true,
    });
    expect(plan.work).toBeUndefined();
  });

  it("ชี้ residual fee/note/discount เมื่อยังไม่มีรายการจริง โดยไม่แนบ work.items=[]", () => {
    const seed = buildOrderEditFormSeed(orderFixture({ items: [], fees: [], discount: 0 }), [], actor);
    const current = valuesFromSeed(seed);
    current.items = [{ ...structuredClone(EMPTY_ITEM), notes: "หมายเหตุที่ยังไม่มีรายการ" }];
    current.fees = [{ feeType: "SHIPPING", name: "ค่าส่ง", amount: 50 }];
    current.header.discount = 20;

    const plan = buildOrderEditSavePlan(seed.originalSnapshot, current);

    expect(plan.work).toEqual({
      fees: [{ feeType: "SHIPPING", name: "ค่าส่ง", amount: 50 }],
      discount: 20,
    });
    expect(plan.work).not.toHaveProperty("items");
    expect(
      getOrderEditEmptyWorkResiduals(plan, {
        items: current.items,
        fees: current.fees,
        discount: current.header.discount,
      }),
    ).toEqual({
      itemNotes: true,
      feesWithoutItems: true,
      discountWithoutItems: true,
    });
  });

  it("กัน note บนการ์ดเปล่าแม้ในฟอร์มมีรายการจริงใบอื่นอยู่แล้ว", () => {
    const seed = buildOrderEditFormSeed(orderFixture(), [], actor);
    const current = valuesFromSeed(seed);
    current.items.push({
      ...structuredClone(EMPTY_ITEM),
      notes: "หมายเหตุของรายการที่ยังไม่ได้ใส่สินค้า",
    });

    const plan = buildOrderEditSavePlan(seed.originalSnapshot, current);

    expect(plan).toMatchObject({
      hasChanges: true,
      hasResidualItemNotes: true,
    });
    expect(plan.work).toBeUndefined();
    expect(
      getOrderEditEmptyWorkResiduals(plan, {
        items: current.items,
        fees: current.fees,
        discount: current.header.discount,
      }),
    ).toEqual({
      itemNotes: true,
      feesWithoutItems: false,
      discountWithoutItems: false,
    });
  });
});

describe("status capability and change-order reason", () => {
  it("เตือน floor ต่างกันระหว่างแก้ตรงกับใบแก้ไข และไม่เตือน legacy ที่ยอดไม่ได้ลด", () => {
    expect(
      getOrderEditBilledFloorState({
        capability: "direct",
        newTotal: 500,
        billedFloor: 600,
        originalTotal: 1_000,
      }),
    ).toBe("blocked");
    expect(
      getOrderEditBilledFloorState({
        capability: "change_order",
        newTotal: 500,
        billedFloor: 600,
        originalTotal: 1_000,
      }),
    ).toBe("credit_note");
    expect(
      getOrderEditBilledFloorState({
        capability: "direct",
        newTotal: 550,
        billedFloor: 600,
        originalTotal: 500,
      }),
    ).toBeNull();
  });

  it.each([
    ["DRAFT", "direct"],
    ["INQUIRY", "direct"],
    ["CONFIRMED", "direct"],
    ["DESIGNING", "direct"],
    ["DESIGN_APPROVED", "change_order"],
    ["PRODUCTION_QUEUE", "change_order"],
    ["ON_HOLD", "read_only"],
    ["PRODUCING", "read_only"],
    ["COMPLETED", "read_only"],
    ["CANCELLED", "read_only"],
  ] satisfies Array<[InternalStatus, ReturnType<typeof getOrderEditCapability>]>) (
    "%s → %s",
    (status, expected) => {
      expect(getOrderEditCapability(status)).toBe(expected);
    },
  );

  it("บังคับเหตุผลเฉพาะ change_order ที่มี work เปลี่ยนจริง", () => {
    const seed = buildOrderEditFormSeed(orderFixture(), [], actor);
    const meta = valuesFromSeed(seed);
    meta.header.notes = "แก้คำอธิบาย";
    const metaPlan = buildOrderEditSavePlan(seed.originalSnapshot, meta);

    const work = valuesFromSeed(seed);
    work.header.discount += 10;
    const workPlan = buildOrderEditSavePlan(seed.originalSnapshot, work);

    expect(requiresOrderEditReason("DESIGN_APPROVED", metaPlan)).toBe(false);
    expect(requiresOrderEditReason("DESIGN_APPROVED", workPlan)).toBe(true);
    expect(requiresOrderEditReason("INQUIRY", workPlan)).toBe(false);
    expect(requiresOrderEditReason("PRODUCING", workPlan)).toBe(false);
  });
});
