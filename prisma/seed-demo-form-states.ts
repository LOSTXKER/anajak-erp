/**
 * ใบผลิตตัวอย่างสำหรับ "กดไล่จากขั้นแรก" บนฐานทดลอง (เบสสั่ง 2026-09-09 "ให้ทุกใบผลิตเป็นสถานะแรกหมด จะได้ลองกดไล่ดู")
 *
 * ทุกใบ: ออเดอร์กำลังผลิต · ทุกขั้นยังไม่เริ่ม · ไม่มีติ๊ก/ยอด/ใบส่งร้าน — ต่างกันที่ "เส้นทาง" (ชุดขั้น) เพื่อให้เห็น UX ครบ:
 * รีดร้อน · รับเสื้อลูกค้า · ร้านนอกชนิดต่าง ๆ · ช่องคู่ · ใบขั้นเดียว (พิมพ์ DTF รอหน้ารอบพิมพ์ใหม่ §A3)
 * ชื่อลูกค้า = ชื่อเส้นทาง ("ลอง 2 · เสื้อลูกค้า → รีดร้อน → ตรวจ") เห็นจากหน้ารายการผลิตและหัวใบทันที
 * แยกจาก scenario หลักใน seed-demo.ts · ใบแบบเดิม (legacy) ล้วน · เลขออเดอร์ต่อจาก scenario หลัก · id `demo-production-form-<key>`
 */
import { Prisma } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1_000;
const fromNow = (days: number, hours = 0) =>
  new Date(Date.now() + days * DAY_MS + hours * 60 * 60 * 1_000);
const money = (value: number | string) => new Prisma.Decimal(value);

type StepType =
  | "GARMENT_RECEIVE"
  | "HEAT_PRESS"
  | "EMBROIDERY"
  | "SCREEN_PRINTING"
  | "TAGGING"
  | "SEWING"
  | "SUBLIMATION"
  | "CUSTOM";

type StepSpec = { key: string; stepType: StepType; name?: string; pairWithPrevious?: boolean };

type FormRoute = {
  key: string;
  customerName: string;
  note: string;
  deadlineInDays: number;
  printType: "HEAT_TRANSFER" | "EMBROIDERY" | "SILK_SCREEN" | "SUBLIMATION";
  /** เสื้อลูกค้ายังไม่ได้ตรวจรับ (มีขั้นรับเสื้อลูกค้า) */
  awaitingGarments?: boolean;
  steps: StepSpec[];
};

const QC: StepSpec = { key: "qc", stepType: "CUSTOM", name: "ตรวจคุณภาพขั้นสุดท้าย" };

export const FORM_ROUTES: FormRoute[] = [
  {
    key: "press",
    customerName: "ลอง 1 · รีดร้อน → ตรวจ",
    note: "เส้นทางสั้นสุด: เริ่มทำ → ติ๊ก 3 ข้อ → กรอกยอด → ปิดขั้น → ตรวจ → ส่งเข้า QC",
    deadlineInDays: 7,
    printType: "HEAT_TRANSFER",
    steps: [{ key: "press", stepType: "HEAT_PRESS" }, QC],
  },
  {
    key: "receive",
    customerName: "ลอง 2 · เสื้อลูกค้า → รีดร้อน → ตรวจ",
    note: "ขั้นแรกคือตรวจรับเสื้อที่ลูกค้าส่งมา (ใบตรวจรับ) ก่อนรีด",
    deadlineInDays: 8,
    printType: "HEAT_TRANSFER",
    awaitingGarments: true,
    steps: [{ key: "receive", stepType: "GARMENT_RECEIVE" }, { key: "press", stepType: "HEAT_PRESS" }, QC],
  },
  // ยังไม่มีเส้นทางพิมพ์ DTF: หน้ารอบพิมพ์ฟิล์มถอดออกแล้ว รอสร้างใหม่ (ROADMAP §A3) — ใส่แล้วจะกดต่อไม่ได้
  {
    key: "press-tag",
    customerName: "ลอง 3 · รีดร้อน → ป้ายคอร้านนอก → ตรวจ",
    note: "ทำเองก่อน แล้วส่งร้านนอกต่อ",
    deadlineInDays: 6,
    printType: "HEAT_TRANSFER",
    steps: [{ key: "press", stepType: "HEAT_PRESS" }, { key: "tag", stepType: "TAGGING" }, QC],
  },
  {
    key: "embroidery",
    customerName: "ลอง 4 · ปักร้านนอก → ตรวจ",
    note: "งานร้านนอก: ส่งร้านนอก → รอ → รับงานกลับ (ใบตรวจรับ) → ตรวจ",
    deadlineInDays: 10,
    printType: "EMBROIDERY",
    steps: [{ key: "emb", stepType: "EMBROIDERY" }, QC],
  },
  {
    key: "screen-tag",
    customerName: "ลอง 5 · สกรีนร้านนอก → ป้ายคอร้านนอก → ตรวจ",
    note: "ร้านนอกสองร้านต่อกัน",
    deadlineInDays: 12,
    printType: "SILK_SCREEN",
    steps: [{ key: "screen", stepType: "SCREEN_PRINTING" }, { key: "tag", stepType: "TAGGING" }, QC],
  },
  {
    key: "pair",
    customerName: "ลอง 6 · ช่องคู่: พับป้าย + ปักแขน → ตรวจ",
    note: "ขั้น “ปักแขน” ตั้งว่าเดินคู่กับขั้นก่อน — รางรวมสองขั้นเป็นช่องเดียว",
    deadlineInDays: 9,
    printType: "EMBROIDERY",
    steps: [
      { key: "fold", stepType: "CUSTOM", name: "พับ + ติดป้ายไซซ์" },
      { key: "emb", stepType: "EMBROIDERY", pairWithPrevious: true },
      QC,
    ],
  },
  {
    key: "long",
    customerName: "ลอง 7 · เสื้อลูกค้า → ปัก → รีดร้อน → ตรวจ → แพ็ก",
    note: "เส้นทางยาว 5 ขั้น ผสมทำเองกับร้านนอก",
    deadlineInDays: 14,
    printType: "EMBROIDERY",
    awaitingGarments: true,
    steps: [
      { key: "receive", stepType: "GARMENT_RECEIVE" },
      { key: "emb", stepType: "EMBROIDERY" },
      { key: "press", stepType: "HEAT_PRESS" },
      QC,
      { key: "pack", stepType: "CUSTOM", name: "แพ็กขั้นสุดท้าย" },
    ],
  },
  {
    key: "sewing",
    customerName: "ลอง 8 · ตัดเย็บร้านนอก → ตรวจ",
    note: "ตัดเย็บใหม่ทั้งตัวที่ร้านนอก",
    deadlineInDays: 20,
    printType: "SILK_SCREEN",
    steps: [{ key: "sew", stepType: "SEWING" }, QC],
  },
  {
    key: "sublimation",
    customerName: "ลอง 9 · ซับลิเมชันร้านนอก → ตรวจ",
    note: "งานซับลิเมชันที่ร้านนอก",
    deadlineInDays: 11,
    printType: "SUBLIMATION",
    steps: [{ key: "sub", stepType: "SUBLIMATION" }, QC],
  },
  {
    key: "single",
    customerName: "ลอง 10 · ขั้นเดียว: ติดสติกเกอร์",
    note: "ใบขั้นเดียว ปิดขั้นแล้วส่งเข้า QC ได้เลย",
    deadlineInDays: 3,
    printType: "HEAT_TRANSFER",
    steps: [{ key: "sticker", stepType: "CUSTOM", name: "ติดสติกเกอร์ทับลาย" }],
  },
];

const QUANTITY = 60;
const VARIANTS = [
  { size: "S", quantity: 15 },
  { size: "M", quantity: 24 },
  { size: "L", quantity: 21 },
] as const;

export async function seedWorkOrderFormStates(
  tx: Prisma.TransactionClient,
  input: { period: string; ownerId: string; sequenceStart: number; art: string },
) {
  const color = "ขาว";
  const unit = money(105);
  const printUnit = money(65);
  const subtotal = unit.plus(printUnit).mul(QUANTITY);
  const tax = subtotal.mul(7).div(100).toDecimalPlaces(2);

  for (const [index, route] of FORM_ROUTES.entries()) {
    const sequence = input.sequenceStart + index;
    const orderId = `demo-order-form-${route.key}`;
    const customerId = `demo-customer-form-${route.key}`;
    const productionId = `demo-production-form-${route.key}`;
    const itemId = `demo-item-form-${route.key}`;
    const productLineId = `demo-item-product-form-${route.key}`;
    const createdAt = fromNow(-3);
    const received = !route.awaitingGarments;

    await tx.customer.create({
      data: {
        id: customerId,
        name: route.customerName,
        company: null,
        customerType: "INDIVIDUAL",
        segment: "REGULAR",
        phone: `09-0000-00${String(index + 10).padStart(2, "0")}`,
        email: `form-${route.key}@demo.example.invalid`,
        tags: ["ตัวอย่างกดไล่ใบผลิต"],
        defaultPaymentTerms: "CASH",
      },
    });

    await tx.order.create({
      data: {
        id: orderId,
        orderNumber: `ORD-${input.period}-${String(sequence).padStart(4, "0")}`,
        orderType: "CUSTOM",
        channel: "LINE",
        customerId,
        createdById: input.ownerId,
        customerStatus: "IN_PRODUCTION",
        internalStatus: "PRODUCING",
        description: route.note,
        deadline: fromNow(route.deadlineInDays, 10),
        subtotalItems: subtotal,
        subtotalFees: money(0),
        discount: money(0),
        taxRate: money(7),
        taxAmount: tax,
        totalAmount: subtotal.plus(tax),
        priority: route.deadlineInDays <= 3 ? "URGENT" : route.deadlineInDays <= 6 ? "HIGH" : "NORMAL",
        paymentTerms: "CASH",
        shippingRecipientName: route.customerName,
        shippingPhone: "09-0000-0000",
        shippingAddress: "1 ถนนตัวอย่าง",
        shippingSubDistrict: "บางนาเหนือ",
        shippingDistrict: "บางนา",
        shippingProvince: "กรุงเทพมหานคร",
        shippingPostalCode: "10260",
        notes: "ข้อมูล demo local — ใบตัวอย่างกดไล่ใบผลิตจากขั้นแรก",
        createdAt,
        updatedAt: fromNow(0, -1),
      },
    });
    await tx.orderItem.create({
      data: { id: itemId, orderId, description: `เสื้อยืด Cotton 100% สี${color}`, totalQuantity: QUANTITY, subtotal, taxLineType: "HIRE_OF_WORK" },
    });
    await tx.orderItemProduct.create({
      data: {
        id: productLineId,
        orderItemId: itemId,
        productType: "T_SHIRT",
        description: `เสื้อยืด Cotton 100% สี${color}`,
        material: "Cotton 100%",
        baseUnitPrice: unit,
        totalQuantity: QUANTITY,
        subtotal: unit.mul(QUANTITY),
        itemSource: "CUSTOMER_PROVIDED",
        garmentCondition: received ? "สภาพดี พร้อมผลิต" : null,
        receivedInspected: received,
        receiveNote: received ? "ตรวจจำนวนและสภาพครบตามใบรับ" : null,
      },
    });
    await tx.orderItemVariant.createMany({
      data: VARIANTS.map((v) => ({ id: `demo-variant-form-${route.key}-${v.size}`, orderItemProductId: productLineId, size: v.size, color, quantity: v.quantity })),
    });
    await tx.orderItemPrint.create({
      data: {
        id: `demo-print-form-${route.key}`,
        orderItemId: itemId,
        position: route.printType === "EMBROIDERY" ? "SLEEVE_L" : "FRONT",
        printType: route.printType,
        printSize: "A4",
        width: 20,
        height: 25,
        designNote: "วางกึ่งกลางตาม mockup ที่อนุมัติ",
        designImageUrl: input.art,
        unitPrice: printUnit,
      },
    });
    await tx.designVersion.create({
      data: {
        id: `demo-design-form-${route.key}`,
        orderId,
        versionNumber: 1,
        fileUrl: input.art,
        thumbnailUrl: input.art,
        approvalStatus: "APPROVED",
        designerNotes: "ลูกค้าอนุมัติขนาดและตำแหน่งแล้ว",
        approvedAt: fromNow(-2),
        createdAt: fromNow(-2, -1),
      },
    });

    await tx.production.create({
      data: {
        id: productionId,
        orderId,
        status: "PENDING",
        notes: route.note,
        createdAt: fromNow(-1),
        updatedAt: fromNow(-1),
      },
    });
    await tx.productionStep.createMany({
      data: route.steps.map((step, stepIndex) => ({
        id: `demo-step-form-${route.key}-${step.key}`,
        productionId,
        stepType: step.stepType,
        customStepName: step.name ?? null,
        status: "PENDING" as const,
        sortOrder: (stepIndex + 1) * 10,
        qtyTotal: QUANTITY,
        qtyDone: 0,
        pairWithPrevious: step.pairWithPrevious ?? false,
        createdAt: fromNow(-1),
        updatedAt: fromNow(-1),
      })),
    });
  }
  return FORM_ROUTES.length;
}
