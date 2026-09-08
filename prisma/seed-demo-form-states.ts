/**
 * ใบผลิตตัวอย่าง "ทุกสถานะของฟอร์มใบผลิต" บนฐานทดลอง (เบสสั่ง 2026-09-09 "ทำให้เห็นสถานะทั้งหมด")
 *
 * แยกจาก scenario หลักใน seed-demo.ts: ใบพวกนี้เป็นใบผลิตแบบเดิม (legacy) ล้วน ไม่มี V2/การเงิน/ส่งของ
 * ชื่อลูกค้า = ชื่อสถานะ ("ฟอร์ม 2 · กำลังทำ …") เพื่อให้เห็นจากหน้ารายการผลิตและหัวใบทันที
 * เลขออเดอร์ต่อจาก scenario หลัก (ORD-<งวด>-0016 …) · id คงที่ `demo-production-form-<key>` เปิดตรงได้
 */
import { Prisma } from "@prisma/client";
import { workOrderStandards } from "../src/lib/work-order-standards";
import { stationProblemNotes } from "../src/lib/production-problem";

const DAY_MS = 24 * 60 * 60 * 1_000;
const fromNow = (days: number, hours = 0) =>
  new Date(Date.now() + days * DAY_MS + hours * 60 * 60 * 1_000);
const money = (value: number | string) => new Prisma.Decimal(value);

type StepSpec = {
  key: string;
  stepType: "HEAT_PRESS" | "EMBROIDERY" | "CUSTOM" | "TAGGING";
  name?: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD" | "FAILED";
  qtyDone?: number;
  assignedTo?: string | null;
  /** ติ๊กข้อกำหนดกี่ข้อ (ค่าเริ่มต้น: ขั้นที่ปิดแล้ว = ครบ · อื่น = 0) */
  ticks?: number;
  /** ยอดต่อแถวไซซ์ S/M/L (ทำแล้ว) — ไม่ใส่ = ไม่มีแถว */
  rowsDone?: [number, number, number];
  problem?: string;
  pairWithPrevious?: boolean;
  outsource?: { status: "SENT" | "IN_PROGRESS"; sentDaysAgo: number; backInDays: number; vendorId: string };
};

type FormState = {
  key: string;
  customerName: string;
  note: string;
  internalStatus: "PRODUCING" | "QUALITY_CHECK";
  productionStatus: "IN_PROGRESS" | "COMPLETED";
  deadlineInDays: number;
  printType: "HEAT_TRANSFER" | "EMBROIDERY";
  steps: StepSpec[];
};

const PRESS = "demo-user-press";
const PREP = "demo-user-prep";
const SUPERVISOR = "demo-user-supervisor";

export const FORM_STATES: FormState[] = [
  {
    key: "start",
    customerName: "ฟอร์ม 1 · รอเริ่มขั้นแรก",
    note: "ตัวอย่าง: ยังไม่มีใครกดเริ่ม — ปุ่มบนหัวใบคือ “เริ่มทำ”",
    internalStatus: "PRODUCING",
    productionStatus: "IN_PROGRESS",
    deadlineInDays: 7,
    printType: "HEAT_TRANSFER",
    steps: [
      { key: "press", stepType: "HEAT_PRESS", status: "PENDING" },
      { key: "qc", stepType: "CUSTOM", name: "ตรวจคุณภาพขั้นสุดท้าย", status: "PENDING" },
    ],
  },
  {
    key: "doing",
    customerName: "ฟอร์ม 2 · กำลังทำ ติ๊ก 1/3 ยอด 20/60",
    note: "ตัวอย่าง: ติ๊กข้อกำหนดแล้ว 1 ข้อ กรอกยอด S ครบ M บางส่วน — ปุ่มปิดขั้นยังกดไม่ได้จนติ๊กครบ",
    internalStatus: "PRODUCING",
    productionStatus: "IN_PROGRESS",
    deadlineInDays: 5,
    printType: "HEAT_TRANSFER",
    steps: [
      { key: "press", stepType: "HEAT_PRESS", status: "IN_PROGRESS", qtyDone: 20, assignedTo: PRESS, ticks: 1, rowsDone: [15, 5, 0] },
      { key: "qc", stepType: "CUSTOM", name: "ตรวจคุณภาพขั้นสุดท้าย", status: "PENDING" },
    ],
  },
  {
    key: "ready-close",
    customerName: "ฟอร์ม 3 · ติ๊กครบ ยอดครบ พร้อมปิดขั้น",
    note: "ตัวอย่าง: ติ๊กครบ 3 ข้อ ยอด 60/60 — ปุ่มบนหัวใบคือ “ปิดขั้นนี้” กดได้ทันที",
    internalStatus: "PRODUCING",
    productionStatus: "IN_PROGRESS",
    deadlineInDays: 4,
    printType: "HEAT_TRANSFER",
    steps: [
      { key: "press", stepType: "HEAT_PRESS", status: "IN_PROGRESS", qtyDone: 60, assignedTo: PRESS, ticks: 3, rowsDone: [15, 24, 21] },
      { key: "qc", stepType: "CUSTOM", name: "ตรวจคุณภาพขั้นสุดท้าย", status: "PENDING" },
    ],
  },
  {
    key: "hold",
    customerName: "ฟอร์ม 4 · พักไว้",
    note: "ตัวอย่าง: หัวหน้าพักขั้นนี้ไว้ — เมนู ⋯ มี “คืนขั้นนี้กลับคิว”",
    internalStatus: "PRODUCING",
    productionStatus: "IN_PROGRESS",
    deadlineInDays: 6,
    printType: "HEAT_TRANSFER",
    steps: [
      { key: "press", stepType: "HEAT_PRESS", status: "ON_HOLD", qtyDone: 10, assignedTo: PRESS, ticks: 1, rowsDone: [10, 0, 0] },
      { key: "qc", stepType: "CUSTOM", name: "ตรวจคุณภาพขั้นสุดท้าย", status: "PENDING" },
    ],
  },
  {
    key: "problem",
    customerName: "ฟอร์ม 5 · ติดปัญหา รอหัวหน้า",
    note: "ตัวอย่าง: ช่างแจ้งปัญหา — การ์ดแดงบนใบ ปุ่มหลักเป็น “จัดการปัญหา” (หัวหน้า)",
    internalStatus: "PRODUCING",
    productionStatus: "IN_PROGRESS",
    deadlineInDays: 3,
    printType: "HEAT_TRANSFER",
    steps: [
      { key: "press", stepType: "HEAT_PRESS", status: "FAILED", qtyDone: 12, assignedTo: PRESS, ticks: 2, rowsDone: [12, 0, 0], problem: "ฟิล์มลอกหลังรีด 3 ตัว สงสัยอุณหภูมิเครื่องเพี้ยน" },
      { key: "qc", stepType: "CUSTOM", name: "ตรวจคุณภาพขั้นสุดท้าย", status: "PENDING" },
    ],
  },
  {
    key: "outsource",
    customerName: "ฟอร์ม 6 · ของอยู่ร้านปัก รอรับกลับ",
    note: "ตัวอย่าง: ส่งร้านปักแล้ว นัดรับอีก 3 วัน — ปุ่มบนหัวใบคือ “รับงานกลับ”",
    internalStatus: "PRODUCING",
    productionStatus: "IN_PROGRESS",
    deadlineInDays: 8,
    printType: "EMBROIDERY",
    steps: [
      { key: "emb", stepType: "EMBROIDERY", status: "IN_PROGRESS", assignedTo: PREP, outsource: { status: "SENT", sentDaysAgo: 2, backInDays: 3, vendorId: "demo-vendor-embroidery" } },
      { key: "qc", stepType: "CUSTOM", name: "ตรวจคุณภาพขั้นสุดท้าย", status: "PENDING" },
    ],
  },
  {
    key: "pair",
    customerName: "ฟอร์ม 7 · ช่องคู่ (พับป้าย + ปักแขน)",
    note: "ตัวอย่าง: ขั้น “ปักแขน” ตั้งว่าเดินคู่กับขั้นก่อน — รางรวมสองขั้นเป็นช่องเดียว",
    internalStatus: "PRODUCING",
    productionStatus: "IN_PROGRESS",
    deadlineInDays: 9,
    printType: "EMBROIDERY",
    steps: [
      { key: "prep", stepType: "CUSTOM", name: "เตรียมเสื้อ", status: "COMPLETED", qtyDone: 60, assignedTo: PREP },
      { key: "fold", stepType: "CUSTOM", name: "พับ + ติดป้ายไซซ์", status: "IN_PROGRESS", qtyDone: 24, assignedTo: PREP, ticks: 1, rowsDone: [15, 9, 0] },
      { key: "emb", stepType: "EMBROIDERY", status: "IN_PROGRESS", pairWithPrevious: true, outsource: { status: "IN_PROGRESS", sentDaysAgo: 1, backInDays: 4, vendorId: "demo-vendor-embroidery" } },
      { key: "qc", stepType: "CUSTOM", name: "ตรวจคุณภาพขั้นสุดท้าย", status: "PENDING" },
    ],
  },
  {
    key: "reopen",
    customerName: "ฟอร์ม 8 · ปิดขั้นแรกแล้ว ย้อนกลับได้",
    note: "ตัวอย่าง: ขั้นแรกปิดแล้ว ขั้นสองยังไม่เริ่ม — เมนู ⋯ มี “ย้อนกลับไป รีดร้อน” (หัวหน้า)",
    internalStatus: "PRODUCING",
    productionStatus: "IN_PROGRESS",
    deadlineInDays: 6,
    printType: "HEAT_TRANSFER",
    steps: [
      { key: "press", stepType: "HEAT_PRESS", status: "COMPLETED", qtyDone: 60, assignedTo: PRESS, rowsDone: [15, 24, 21] },
      { key: "tag", stepType: "CUSTOM", name: "ติดป้ายแขวน", status: "PENDING" },
    ],
  },
  {
    key: "all-done",
    customerName: "ฟอร์ม 9 · ครบทุกขั้น รอส่งเข้า QC",
    note: "ตัวอย่าง: ทุกขั้นปิดแล้ว — ปุ่มบนหัวใบคือ “ส่งเข้า QC”",
    internalStatus: "PRODUCING",
    productionStatus: "IN_PROGRESS",
    deadlineInDays: 2,
    printType: "HEAT_TRANSFER",
    steps: [
      { key: "press", stepType: "HEAT_PRESS", status: "COMPLETED", qtyDone: 60, assignedTo: PRESS, rowsDone: [15, 24, 21] },
      { key: "qc", stepType: "CUSTOM", name: "ตรวจคุณภาพขั้นสุดท้าย", status: "COMPLETED", qtyDone: 60, assignedTo: SUPERVISOR },
    ],
  },
  {
    key: "in-qc",
    customerName: "ฟอร์ม 10 · ส่งเข้า QC แล้ว",
    note: "ตัวอย่าง: ใบผลิตปิดแล้ว งานอยู่ที่ QC — ฟอร์มอ่านอย่างเดียว",
    internalStatus: "QUALITY_CHECK",
    productionStatus: "COMPLETED",
    deadlineInDays: 1,
    printType: "HEAT_TRANSFER",
    steps: [
      { key: "press", stepType: "HEAT_PRESS", status: "COMPLETED", qtyDone: 60, assignedTo: PRESS, rowsDone: [15, 24, 21] },
      { key: "qc", stepType: "CUSTOM", name: "ตรวจคุณภาพขั้นสุดท้าย", status: "COMPLETED", qtyDone: 60, assignedTo: SUPERVISOR },
    ],
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

  for (const [index, state] of FORM_STATES.entries()) {
    const sequence = input.sequenceStart + index;
    const orderId = `demo-order-form-${state.key}`;
    const customerId = `demo-customer-form-${state.key}`;
    const productionId = `demo-production-form-${state.key}`;
    const itemId = `demo-item-form-${state.key}`;
    const productLineId = `demo-item-product-form-${state.key}`;
    const createdAt = fromNow(-6);

    await tx.customer.create({
      data: {
        id: customerId,
        name: state.customerName,
        company: null,
        customerType: "INDIVIDUAL",
        segment: "REGULAR",
        phone: `09-0000-00${String(index + 10).padStart(2, "0")}`,
        email: `form-${state.key}@demo.example.invalid`,
        tags: ["ตัวอย่างฟอร์มใบผลิต"],
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
        internalStatus: state.internalStatus,
        description: state.note,
        deadline: fromNow(state.deadlineInDays, 10),
        subtotalItems: subtotal,
        subtotalFees: money(0),
        discount: money(0),
        taxRate: money(7),
        taxAmount: tax,
        totalAmount: subtotal.plus(tax),
        priority: state.deadlineInDays <= 2 ? "URGENT" : state.deadlineInDays <= 4 ? "HIGH" : "NORMAL",
        paymentTerms: "CASH",
        shippingRecipientName: state.customerName,
        shippingPhone: "09-0000-0000",
        shippingAddress: "1 ถนนตัวอย่าง",
        shippingSubDistrict: "บางนาเหนือ",
        shippingDistrict: "บางนา",
        shippingProvince: "กรุงเทพมหานคร",
        shippingPostalCode: "10260",
        notes: "ข้อมูล demo local — ใบตัวอย่างสถานะฟอร์มใบผลิต",
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
        garmentCondition: "สภาพดี พร้อมผลิต",
        receivedInspected: true,
        receiveNote: "ตรวจจำนวนและสภาพครบตามใบรับ",
      },
    });
    const variantIds = VARIANTS.map((v) => `demo-variant-form-${state.key}-${v.size}`);
    await tx.orderItemVariant.createMany({
      data: VARIANTS.map((v, i) => ({ id: variantIds[i]!, orderItemProductId: productLineId, size: v.size, color, quantity: v.quantity })),
    });
    await tx.orderItemPrint.create({
      data: {
        id: `demo-print-form-${state.key}`,
        orderItemId: itemId,
        position: state.printType === "EMBROIDERY" ? "SLEEVE_L" : "FRONT",
        printType: state.printType,
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
        id: `demo-design-form-${state.key}`,
        orderId,
        versionNumber: 1,
        fileUrl: input.art,
        thumbnailUrl: input.art,
        approvalStatus: "APPROVED",
        designerNotes: "ลูกค้าอนุมัติขนาดและตำแหน่งแล้ว",
        approvedAt: fromNow(-5),
        createdAt: fromNow(-5, -1),
      },
    });

    const allDone = state.steps.every((s) => s.status === "COMPLETED");
    await tx.production.create({
      data: {
        id: productionId,
        orderId,
        status: state.productionStatus,
        startDate: fromNow(-4),
        endDate: state.productionStatus === "COMPLETED" ? fromNow(-1) : null,
        notes: state.note,
        createdAt: fromNow(-4),
        updatedAt: fromNow(0, -1),
      },
    });

    for (const [stepIndex, step] of state.steps.entries()) {
      const stepId = `demo-step-form-${state.key}-${step.key}`;
      const started = step.status !== "PENDING";
      const completed = step.status === "COMPLETED";
      const startedAt = started ? fromNow(-3 + stepIndex, 1) : null;
      const completedAt = completed ? fromNow(-2 + stepIndex, 3) : null;
      await tx.productionStep.create({
        data: {
          id: stepId,
          productionId,
          stepType: step.stepType,
          customStepName: step.name ?? null,
          status: step.status,
          sortOrder: (stepIndex + 1) * 10,
          qtyTotal: QUANTITY,
          qtyDone: completed ? QUANTITY : (step.qtyDone ?? 0),
          assignedToId: step.assignedTo ?? null,
          startedAt,
          completedAt,
          pairWithPrevious: step.pairWithPrevious ?? false,
          notes: step.problem ? stationProblemNotes(null, step.problem) : null,
          createdAt: fromNow(-4),
          updatedAt: completedAt ?? startedAt ?? fromNow(-4),
        },
      });

      // ผลติ๊กข้อกำหนด — ขั้นที่ปิดแล้วถือว่าติ๊กครบ (ด่าน server ต้องผ่านมาแล้ว)
      const standards = workOrderStandards(step.stepType);
      const ticks = completed ? standards.length : (step.ticks ?? 0);
      if (ticks > 0) {
        await tx.productionStepCheck.createMany({
          data: standards.slice(0, ticks).map((item, i) => ({
            id: `demo-check-form-${state.key}-${step.key}-${i}`,
            productionStepId: stepId,
            itemKey: item,
            checkedById: step.assignedTo ?? input.ownerId,
            checkedAt: fromNow(-2 + stepIndex, 2 + i),
          })),
        });
      }

      // ยอดต่อแถวไซซ์ — แถวเดียวกับที่ฟอร์มบันทึก (OperationQuantity ชนิด VARIANT)
      const rows: readonly number[] | null = completed && !step.rowsDone ? null : (step.rowsDone ?? null);
      if (rows) {
        await tx.operationQuantity.createMany({
          data: VARIANTS.map((v, i) => ({
            id: `demo-qty-form-${state.key}-${step.key}-${v.size}`,
            productionId,
            productionStepId: stepId,
            scopeKey: `${productLineId}:${variantIds[i]}:NO_PRINT`,
            scopeKind: "VARIANT" as const,
            sourceOrderItemId: itemId,
            sourceOrderItemProductId: productLineId,
            sourceOrderItemVariantId: variantIds[i]!,
            description: `เสื้อยืด Cotton 100% สี${color}`,
            size: v.size,
            color,
            qtyPlanned: v.quantity,
            qtyGood: rows[i] ?? 0,
            qtyScrap: 0,
            referenceSnapshot: { description: `เสื้อยืด Cotton 100% สี${color}`, size: v.size, color, quantity: v.quantity, source: "WORK_ORDER_FORM" },
          })),
        });
      }

      if (step.outsource) {
        await tx.outsourceOrder.create({
          data: {
            id: `demo-outsource-form-${state.key}`,
            productionStepId: stepId,
            vendorId: step.outsource.vendorId,
            status: step.outsource.status,
            description: "ปักโลโก้แขนซ้าย 1 ตำแหน่ง",
            quantity: QUANTITY,
            unitCost: money(32),
            totalCost: money(32).mul(QUANTITY),
            sentAt: fromNow(-step.outsource.sentDaysAgo),
            expectedBackAt: fromNow(step.outsource.backInDays),
            createdAt: fromNow(-step.outsource.sentDaysAgo, -2),
            updatedAt: fromNow(-step.outsource.sentDaysAgo),
          },
        });
      }
    }
    void allDone;
  }
  return FORM_STATES.length;
}
