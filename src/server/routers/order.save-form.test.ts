import type { InternalStatus, Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { orderRouter } from "./order";
import {
  orderFeesFingerprint,
  orderItemsFingerprint,
  orderReferenceImagesFingerprint,
} from "@/lib/order-form-concurrency";

const ORDER_ID = "order-save-form";
const UPDATED_AT = new Date("2026-08-14T10:00:00.000Z");

function lockedOrder(internalStatus: InternalStatus) {
  return {
    id: ORDER_ID,
    updatedAt: UPDATED_AT,
    customerId: "customer-1",
    orderType: "CUSTOM",
    internalStatus,
    taxRate: 0,
    paymentTerms: null,
    platformFee: 0,
    subtotalItems: 1_000,
    subtotalFees: 0,
    discount: 0,
    totalAmount: 1_000,
    stockReservedAt: null,
  };
}

function makeContext(
  tx: Record<string, unknown>,
  options: { role?: Role; permissionOverrides?: unknown } = {},
): Context {
  return {
    prisma: {
      $transaction: vi.fn(async (callback: (transaction: unknown) => unknown) =>
        callback(tx),
      ),
    } as unknown as Context["prisma"],
    userId: "sales-1",
    userRole: options.role ?? "SALES",
    permissionOverrides: options.permissionOverrides ?? null,
  };
}

function baseTx(status: InternalStatus) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    order: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(lockedOrder(status)),
      findMany: vi.fn().mockResolvedValue([
        { id: ORDER_ID, totalAmount: 1_000 },
      ]),
      update: vi.fn().mockResolvedValue({ id: ORDER_ID }),
    },
    customer: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ creditLimit: null }),
    },
    invoice: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    orderItemProduct: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    goodsReceiptLine: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    orderItem: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    orderFee: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    attachment: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    orderRevision: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
    },
    changeOrder: { create: vi.fn() },
    documentSequence: {
      upsert: vi.fn().mockResolvedValue({ lastNumber: 7 }),
    },
    auditLog: { create: vi.fn() },
  };
}

function itemInput(savedProductId?: string) {
  return {
    description: "ชุดงาน",
    notes: "",
    products: [
      {
        savedProductId,
        productId: undefined as string | undefined,
        productType: "T_SHIRT",
        description: "เสื้อทดสอบ",
        baseUnitPrice: 100,
        discount: 0,
        itemSource: undefined as
          | "FROM_STOCK"
          | "CUSTOM_MADE"
          | "CUSTOMER_PROVIDED"
          | undefined,
        variants: [
          { size: "M", color: undefined as string | undefined, quantity: 10 },
        ],
      },
    ],
    prints: [],
    addons: [],
  };
}

describe("order.saveForm", () => {
  it("สร้างแถวสินค้ากลับด้วย ID เดิมเพื่อรักษาการผูก GoodsReceiptLine", async () => {
    const tx = baseTx("INQUIRY");
    tx.orderItemProduct.findMany.mockResolvedValue([
      {
        id: "saved-product-1",
        productId: null,
        productType: "T_SHIRT",
        itemSource: null,
        receivedInspected: true,
        variants: [{ size: "M", color: null }],
      },
    ]);
    tx.goodsReceiptLine.findMany.mockResolvedValue([
      { orderItemProductId: "saved-product-1" },
    ]);

    const edited = itemInput("saved-product-1");
    edited.products[0].variants[0].quantity = 12;
    await orderRouter.createCaller(makeContext(tx)).saveForm({
      id: ORDER_ID,
      expectedUpdatedAt: UPDATED_AT,
      expectedItemsFingerprint: orderItemsFingerprint([]),
      work: { items: [edited] },
    });

    expect(tx.orderItem.deleteMany).toHaveBeenCalledWith({
      where: { orderId: ORDER_ID },
    });
    expect(tx.orderItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: ORDER_ID,
        products: {
          create: [
            expect.objectContaining({
              id: "saved-product-1",
              receivedInspected: true,
            }),
          ],
        },
      }),
    });
    expect(tx.goodsReceiptLine.findMany).toHaveBeenCalledWith({
      where: { orderItemProductId: { in: ["saved-product-1"] } },
      select: { orderItemProductId: true },
    });
  });

  it("ไม่รับ receivedInspected จาก client และแถวใหม่เริ่ม false เสมอ", async () => {
    const tx = baseTx("INQUIRY");
    const edited = itemInput();
    Object.assign(edited.products[0], { receivedInspected: true });

    await orderRouter.createCaller(makeContext(tx)).saveForm({
      id: ORDER_ID,
      expectedUpdatedAt: UPDATED_AT,
      expectedItemsFingerprint: orderItemsFingerprint([]),
      work: { items: [edited] },
    });

    expect(tx.orderItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        products: {
          create: [expect.objectContaining({ receivedInspected: false })],
        },
      }),
    });
  });

  it("ไม่รับ savedProductId ที่เป็นของออเดอร์อื่น", async () => {
    const tx = baseTx("INQUIRY");
    tx.orderItemProduct.findMany.mockResolvedValue([
      { id: "saved-product-1", productId: null },
    ]);

    await expect(
      orderRouter.createCaller(makeContext(tx)).saveForm({
        id: ORDER_ID,
        expectedUpdatedAt: UPDATED_AT,
        expectedItemsFingerprint: orderItemsFingerprint([]),
        work: { items: [itemInput("foreign-product-row")] },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(tx.orderItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.orderItem.create).not.toHaveBeenCalled();
  });

  it("ไม่รับ savedProductId เดิมซ้ำสองแถวในคำขอเดียว", async () => {
    const tx = baseTx("INQUIRY");
    tx.orderItemProduct.findMany.mockResolvedValue([
      { id: "saved-product-1", productId: null },
    ]);
    const firstItem = itemInput("saved-product-1");
    firstItem.products.push({
      ...firstItem.products[0],
      description: "แถวซ้ำ",
    });

    await expect(
      orderRouter.createCaller(makeContext(tx)).saveForm({
        id: ORDER_ID,
        expectedUpdatedAt: UPDATED_AT,
        expectedItemsFingerprint: orderItemsFingerprint([]),
        work: { items: [firstItem] },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(tx.orderItem.deleteMany).not.toHaveBeenCalled();
  });

  it("ห้ามลบแถวสินค้าที่มีประวัติใบตรวจรับเพื่อไม่สร้าง receipt orphan", async () => {
    const tx = baseTx("INQUIRY");
    tx.orderItemProduct.findMany.mockResolvedValue([
      { id: "saved-product-1", productId: null },
      { id: "received-product", productId: null },
    ]);
    tx.goodsReceiptLine.findMany.mockResolvedValue([
      { orderItemProductId: "received-product" },
    ]);

    await expect(
      orderRouter.createCaller(makeContext(tx)).saveForm({
        id: ORDER_ID,
        expectedUpdatedAt: UPDATED_AT,
        expectedItemsFingerprint: orderItemsFingerprint([]),
        work: { items: [itemInput("saved-product-1")] },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(tx.goodsReceiptLine.findMany).toHaveBeenCalledWith({
      where: {
        orderItemProductId: {
          in: ["saved-product-1", "received-product"],
        },
      },
      select: { orderItemProductId: true },
    });
    expect(tx.orderItem.deleteMany).not.toHaveBeenCalled();
  });

  it("ห้ามเปลี่ยน catalog identity ของแถวที่มีใบตรวจรับ", async () => {
    const tx = baseTx("INQUIRY");
    tx.orderItemProduct.findMany.mockResolvedValue([
      {
        id: "saved-product-1",
        productId: "catalog-old",
        productType: "T_SHIRT",
        itemSource: "FROM_STOCK",
        variants: [{ size: "M", color: null }],
      },
    ]);
    tx.goodsReceiptLine.findMany.mockResolvedValue([
      { orderItemProductId: "saved-product-1" },
    ]);
    const changed = itemInput("saved-product-1");
    changed.products[0].productId = "catalog-new";
    changed.products[0].itemSource = "FROM_STOCK";

    await expect(
      orderRouter.createCaller(makeContext(tx)).saveForm({
        id: ORDER_ID,
        expectedUpdatedAt: UPDATED_AT,
        expectedItemsFingerprint: orderItemsFingerprint([]),
        work: { items: [changed] },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(tx.orderItem.deleteMany).not.toHaveBeenCalled();
  });

  it("ห้ามเปลี่ยน variant size/color ของแถวที่มีใบตรวจรับ แต่จำนวนยังแก้ได้", async () => {
    const tx = baseTx("INQUIRY");
    tx.orderItemProduct.findMany.mockResolvedValue([
      {
        id: "saved-product-1",
        productId: null,
        productType: "T_SHIRT",
        itemSource: null,
        variants: [{ size: "M", color: "ดำ" }],
      },
    ]);
    tx.goodsReceiptLine.findMany.mockResolvedValue([
      { orderItemProductId: "saved-product-1" },
    ]);
    const changed = itemInput("saved-product-1");
    changed.products[0].variants = [{ size: "L", color: "ดำ", quantity: 20 }];

    await expect(
      orderRouter.createCaller(makeContext(tx)).saveForm({
        id: ORDER_ID,
        expectedUpdatedAt: UPDATED_AT,
        expectedItemsFingerprint: orderItemsFingerprint([]),
        work: { items: [changed] },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(tx.orderItem.deleteMany).not.toHaveBeenCalled();
  });

  it("กันผู้ใช้ที่ถูกตัด see_order_money ก่อนเปิด transaction เมื่อแตะ work", async () => {
    const tx = baseTx("DRAFT");
    const ctx = makeContext(tx, {
      permissionOverrides: { see_order_money: false },
    });

    await expect(
      orderRouter.createCaller(ctx).saveForm({
        id: ORDER_ID,
        expectedUpdatedAt: UPDATED_AT,
        work: { discount: 100 },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("อ่านสถานะสดใต้ lock แล้วห้ามแก้ work หลังเริ่มผลิต", async () => {
    const tx = baseTx("PRODUCING");

    await expect(
      orderRouter.createCaller(makeContext(tx)).saveForm({
        id: ORDER_ID,
        expectedUpdatedAt: UPDATED_AT,
        work: { discount: 100 },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("direct edit ยังติด billed floor และ rollback ก่อนเขียนยอด", async () => {
    const tx = baseTx("DRAFT");
    tx.invoice.findMany.mockResolvedValue([
      {
        type: "FINAL_INVOICE",
        totalAmount: 900,
        isVoided: false,
        originalInvoice: null,
      },
    ]);

    await expect(
      orderRouter.createCaller(makeContext(tx)).saveForm({
        id: ORDER_ID,
        expectedUpdatedAt: UPDATED_AT,
        work: { discount: 200 },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("สถานะที่ออก CO ได้บันทึกยอด เหตุผล เลขเอกสาร revision และ audit ใน transaction เดียว", async () => {
    const tx = baseTx("DESIGN_APPROVED");
    tx.invoice.count.mockResolvedValue(1);

    const result = await orderRouter.createCaller(makeContext(tx)).saveForm({
      id: ORDER_ID,
      expectedUpdatedAt: UPDATED_AT,
      work: { discount: 100 },
      reason: "ลูกค้าลดจำนวนงาน",
    });

    expect(result).toMatchObject({
      id: ORDER_ID,
      invoicedWarning: true,
    });
    expect(result.changeNumber).toMatch(/^CO-\d{4}-0007$/);
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORDER_ID },
        data: expect.objectContaining({ discount: 100, totalAmount: 900 }),
      }),
    );
    expect(tx.changeOrder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: ORDER_ID,
        reason: "ลูกค้าลดจำนวนงาน",
        oldTotal: 1_000,
        newTotal: 900,
        invoicedWarning: true,
      }),
    });
    expect(tx.orderRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ changeType: "CHANGE_ORDER" }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "UPDATE",
        entityType: "ORDER",
        entityId: ORDER_ID,
        reason: "ลูกค้าลดจำนวนงาน",
      }),
    });
  });

  it("sync รูปอ้างอิงไม่แตะไฟล์หมวดอื่นและห้ามลบไฟล์ของผู้อื่น", async () => {
    const tx = baseTx("DRAFT");
    tx.attachment.findMany.mockResolvedValue([
      {
        id: "customer-upload",
        fileUrl: "/api/files/orders/customer-upload.jpg",
        fileName: "customer-upload.jpg",
        fileSize: 123,
        printPosition: null,
        uploadedById: null,
      },
    ]);

    await expect(
      orderRouter.createCaller(makeContext(tx)).saveForm({
        id: ORDER_ID,
        expectedUpdatedAt: UPDATED_AT,
        expectedReferenceImagesFingerprint: orderReferenceImagesFingerprint([
          {
            id: "customer-upload",
            fileUrl: "/api/files/orders/customer-upload.jpg",
            fileName: "customer-upload.jpg",
            fileSize: 123,
            printPosition: null,
            uploadedById: null,
          },
        ]),
        referenceImages: [],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(tx.attachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: "REFERENCE_IMAGE" }),
      }),
    );
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.attachment.deleteMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("กันฟอร์มเก่าทับสถานะตรวจรับของ product แม้ parent updatedAt ยังเท่าเดิม", async () => {
    const tx = baseTx("INQUIRY");
    const baseline = [
      {
        id: "item-1",
        sortOrder: 0,
        description: "ชุดงาน",
        totalQuantity: 10,
        subtotal: 1_000,
        taxLineType: "SALE_OF_GOODS",
        notes: null,
        products: [
          {
            id: "saved-product-1",
            sortOrder: 0,
            productType: "T_SHIRT",
            description: "เสื้อทดสอบ",
            baseUnitPrice: 100,
            discount: 0,
            totalQuantity: 10,
            subtotal: 1_000,
            receivedInspected: false,
            receiveNote: null,
            variants: [
              { id: "variant-1", size: "M", color: null, quantity: 10 },
            ],
          },
        ],
        prints: [],
        addons: [],
      },
    ];
    tx.orderItem.findMany.mockResolvedValue([
      {
        ...baseline[0],
        products: [
          {
            ...baseline[0].products[0],
            receivedInspected: true,
            receiveNote: "รับครบแล้ว",
          },
        ],
      },
    ]);

    await expect(
      orderRouter.createCaller(makeContext(tx)).saveForm({
        id: ORDER_ID,
        expectedUpdatedAt: UPDATED_AT,
        expectedItemsFingerprint: orderItemsFingerprint(baseline),
        work: { items: [itemInput("saved-product-1")] },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(tx.orderItemProduct.findMany).not.toHaveBeenCalled();
    expect(tx.orderItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("กันฟอร์มเก่าทับค่าธรรมเนียม child แม้ parent updatedAt ยังเท่าเดิม", async () => {
    const tx = baseTx("INQUIRY");
    const baseline = [
      {
        id: "fee-1",
        feeType: "SHIPPING",
        name: "ค่าส่ง",
        description: null,
        amount: 100,
        notes: null,
      },
    ];
    tx.orderFee.findMany.mockResolvedValue([
      { ...baseline[0], amount: 150 },
    ]);

    await expect(
      orderRouter.createCaller(makeContext(tx)).saveForm({
        id: ORDER_ID,
        expectedUpdatedAt: UPDATED_AT,
        expectedFeesFingerprint: orderFeesFingerprint(baseline),
        work: { fees: [] },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(tx.orderFee.deleteMany).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("กัน desired-set เก่าลบ REFERENCE_IMAGE ที่ถูกเพิ่มโดยทางเข้าอื่น", async () => {
    const tx = baseTx("INQUIRY");
    tx.attachment.findMany.mockResolvedValue([
      {
        id: "new-reference",
        fileUrl: "/api/files/orders/new-reference.png",
        fileName: "new-reference.png",
        fileType: "image/png",
        fileSize: 123,
        category: "REFERENCE_IMAGE",
        printPosition: null,
        uploadedById: "sales-1",
        notes: null,
      },
    ]);

    await expect(
      orderRouter.createCaller(makeContext(tx)).saveForm({
        id: ORDER_ID,
        expectedUpdatedAt: UPDATED_AT,
        expectedReferenceImagesFingerprint:
          orderReferenceImagesFingerprint([]),
        referenceImages: [],
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(tx.attachment.deleteMany).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("บังคับ baseline เฉพาะก้อน child ที่คำขอกำลัง replace", async () => {
    const missingBaselineTx = baseTx("INQUIRY");
    const missingBaselineContext = makeContext(missingBaselineTx);

    await expect(
      orderRouter.createCaller(missingBaselineContext).saveForm({
        id: ORDER_ID,
        expectedUpdatedAt: UPDATED_AT,
        work: { items: [itemInput("saved-product-1")] },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(missingBaselineContext.prisma.$transaction).not.toHaveBeenCalled();

    const metaOnlyTx = baseTx("INQUIRY");
    await orderRouter.createCaller(makeContext(metaOnlyTx)).saveForm({
      id: ORDER_ID,
      expectedUpdatedAt: UPDATED_AT,
      meta: { notes: "แก้เฉพาะหมายเหตุ" },
    });
    expect(metaOnlyTx.orderItem.findMany).not.toHaveBeenCalled();
    expect(metaOnlyTx.orderFee.findMany).not.toHaveBeenCalled();
    expect(metaOnlyTx.attachment.findMany).not.toHaveBeenCalled();
  });

  it("กันฟอร์มเก่าทับข้อมูลที่หน้าจออื่นบันทึกหลังจากโหลดฟอร์ม", async () => {
    const tx = baseTx("INQUIRY");
    tx.order.findUniqueOrThrow.mockResolvedValue({
      ...lockedOrder("INQUIRY"),
      updatedAt: new Date("2026-08-14T10:01:00.000Z"),
    });

    await expect(
      orderRouter.createCaller(makeContext(tx)).saveForm({
        id: ORDER_ID,
        expectedUpdatedAt: UPDATED_AT,
        meta: { notes: "จอเก่ากำลังจะทับ" },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("SALES เพิ่มยอดออเดอร์ที่ผูกพันแล้วต้องผ่านวงเงินเครดิตจาก delta เท่านั้น", async () => {
    const tx = baseTx("CONFIRMED");
    tx.customer.findUniqueOrThrow.mockResolvedValue({ creditLimit: 1_050 });

    await expect(
      orderRouter.createCaller(makeContext(tx)).saveForm({
        id: ORDER_ID,
        expectedUpdatedAt: UPDATED_AT,
        meta: { taxRate: 7 },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(tx.$queryRaw.mock.calls.map((call) => call[1])).toContain(
      "customer-1",
    );
    expect(tx.customer.findUniqueOrThrow).toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("แก้ราคาอย่างเดียวสร้าง PRICE revision และ audit ค่าเก่าเทียบค่าใหม่", async () => {
    const tx = baseTx("INQUIRY");

    await orderRouter.createCaller(makeContext(tx)).saveForm({
      id: ORDER_ID,
      expectedUpdatedAt: UPDATED_AT,
      work: { discount: 100 },
    });

    expect(tx.orderRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changeType: "PRICE",
        oldValue: expect.stringContaining('\"discount\":0'),
        newValue: expect.stringContaining('\"discount\":100'),
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        newValue: expect.objectContaining({
          money: expect.objectContaining({
            old: expect.objectContaining({ totalAmount: 1_000 }),
            new: expect.objectContaining({ totalAmount: 900 }),
          }),
        }),
      }),
    });
  });

  it("ล้างเงื่อนไขชำระเป็น null แล้วประวัติต้องไม่ย้อนกลับไปเก็บค่าเดิม", async () => {
    const tx = baseTx("INQUIRY");
    tx.order.findUniqueOrThrow.mockResolvedValue({
      ...lockedOrder("INQUIRY"),
      paymentTerms: "NET_30",
    });

    await orderRouter.createCaller(makeContext(tx)).saveForm({
      id: ORDER_ID,
      expectedUpdatedAt: UPDATED_AT,
      meta: { paymentTerms: null },
    });

    expect(tx.orderRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changeType: "PRICE",
        oldValue: expect.stringContaining('\"paymentTerms\":\"NET_30\"'),
        newValue: expect.stringContaining('\"paymentTerms\":null'),
      }),
    });
  });

  it("ปฏิเสธวันที่รูปแบบถูกแต่ไม่มีอยู่จริงก่อนเปิด transaction", async () => {
    const tx = baseTx("INQUIRY");
    const ctx = makeContext(tx);

    await expect(
      orderRouter.createCaller(ctx).saveForm({
        id: ORDER_ID,
        expectedUpdatedAt: UPDATED_AT,
        meta: { deadline: "2026-02-31" },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });
});
