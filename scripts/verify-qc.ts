/**
 * verify QC เชิงนับ (ก้อน 3) — integration จริงกับ DB
 * รัน: npm run verify:qc · ข้อมูลใช้ marker [QC-VERIFY] ลบเกลี้ยงท้ายสคริปต์
 */
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";
import { workOrderStandards } from "@/lib/work-order-standards";

const MARK = "[QC-VERIFY]";
let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++;
    console.log(`PASS: ${name}`);
  } else {
    fails.push(name);
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function makeOrder(customerId: string, userId: string, suffix: string) {
  const order = await prisma.order.create({
    data: {
      orderNumber: `TEST-QC-${suffix}-${Date.now()}`,
      notes: `${MARK} งานทดสอบ QC ${suffix}`,
      customerId,
      createdById: userId,
      internalStatus: "QUALITY_CHECK",
      items: {
        create: [
          {
            description: `${MARK} เสื้อ`,
            totalQuantity: 10,
            products: {
              create: [
                {
                  productType: "TSHIRT",
                  description: `${MARK} เสื้อยืด`,
                  baseUnitPrice: 0,
                  variants: {
                    create: [
                      { size: "M", color: "ดำ", quantity: 6 },
                      { size: "L", color: "ดำ", quantity: 4 },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });
  const production = await prisma.production.create({
    data: {
      orderId: order.id,
      status: "COMPLETED",
      steps: {
        create: [
          { stepType: "DTF_PRINT", status: "COMPLETED", sortOrder: 0, completedAt: new Date() },
          { stepType: "HEAT_PRESS", status: "COMPLETED", sortOrder: 1, completedAt: new Date() },
        ],
      },
    },
  });
  return { order, production };
}

async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const caller = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });
  const customer = await prisma.customer.create({
    data: { name: `${MARK} ลูกค้าทดสอบ`, customerType: "INDIVIDUAL" },
  });

  const deletedOutsourceIds: string[] = [];
  try {
    // ── 1. ดีล้วนครบ → เด้งเข้าแพ็คเอง ──
    const A = await makeOrder(customer.id, owner.id, "A");
    const ctxA = await caller.qc.context({ orderId: A.order.id });
    check("1.1 context: ยอดคาด 10 (2 ไซส์)", ctxA.totalExpected === 10 && ctxA.lines.length === 2);
    await caller.qc.create({
      orderId: A.order.id,
      idempotencyKey: "verify-qc-a-good",
      qtyGood: 10,
      defects: [],
    });
    const aAfter = await prisma.order.findUniqueOrThrow({ where: { id: A.order.id } });
    check("1.2 ดีล้วน → ออเดอร์เด้ง PACKING", aAfter.internalStatus === "PACKING");

    // ── 2. มีของเสีย → ถอยกลับผลิต + งานแก้ + กระดิ่ง ──
    const B = await makeOrder(customer.id, owner.id, "B");
    await caller.qc.create({
      orderId: B.order.id,
      idempotencyKey: "verify-qc-b-defect",
      qtyGood: 8,
      defects: [
        { qty: 2, size: "L", reason: "PRINT_PEEL", printLabel: "อกซ้าย", photoUrls: [], note: "ลอกมุม" },
      ],
    });
    const bAfter = await prisma.order.findUniqueOrThrow({ where: { id: B.order.id } });
    check("2.1 มีของเสีย → ออเดอร์ถอย PRODUCING", bAfter.internalStatus === "PRODUCING");
    const bProd = await prisma.production.findUniqueOrThrow({
      where: { id: B.production.id },
      include: { steps: true },
    });
    check("2.2 ใบผลิต reopen + มีขั้นงานแก้", bProd.status !== "COMPLETED" && bProd.steps.some((s) => s.customStepName?.includes("งานแก้")));
    const bRecord = await prisma.qcRecord.findFirst({
      where: { orderId: B.order.id },
      include: { defects: true },
    });
    check(
      "2.3 บันทึกนับ เสีย×ไซส์×ลาย×สาเหตุ ครบ",
      bRecord?.qtyDefect === 2 &&
        bRecord.defects[0].size === "L" &&
        bRecord.defects[0].reason === "PRINT_PEEL" &&
        bRecord.defects[0].printLabel === "อกซ้าย"
    );
    const bell = await prisma.notification.findFirst({
      where: { type: "QC_DEFECT", title: { contains: B.order.orderNumber } },
    });
    check("2.4 กระดิ่งแจ้งของเสีย + บอกเสื้อสำรอง", !!bell && bell.message.includes("เสื้อสำรอง"));

    // ── 3. ตรวจผิดจังหวะ → โดนกัน ──
    await caller.qc
      .create({
        orderId: B.order.id,
        idempotencyKey: "verify-qc-b-wrong-stage",
        qtyGood: 10,
        defects: [],
      })
      .then(
        () => check("3.1 ตรวจขณะ PRODUCING → โดนกัน", false),
        (e) => check("3.1 ตรวจขณะ PRODUCING → โดนกัน", String(e.message).includes("ขั้นตรวจคุณภาพ"))
      );

    // ── 4. ประวัติตรวจ ──
    const list = await caller.qc.listByOrder({ orderId: B.order.id });
    check("4.1 ประวัติตรวจอ่านได้พร้อมคนตรวจ", list.length === 1 && !!list[0].checkedBy.name);

    // วนงานแก้ผ่านคำสั่งจริง: L เสีย2 → แก้ดี1/เสีย1 → QCซ้ำ → แก้อีก1 → แพ็ก.
    const rework = bProd.steps.find((step) => step.customStepName?.includes("งานแก้"))!;
    const repairLines = await prisma.operationQuantity.findMany({ where: { productionStepId: rework.id } });
    check("4.2 งานแก้เก็บเฉพาะ L 2 ตัว", rework.qtyTotal === 2 && repairLines.length === 1 && repairLines[0].size === "L" && repairLines[0].qtyPlanned === 2);
    for (const item of workOrderStandards("CUSTOM")) {
      await caller.production.tickStandard({ stepId: rework.id, item, checked: true });
    }
    await caller.production.updateStep({ stepId: rework.id, status: "COMPLETED" }).then(
      () => check("4.3 ติ๊กครบแต่ยังไม่นับงานแก้ → ปิดไม่ได้", false),
      (error) => check("4.3 ติ๊กครบแต่ยังไม่นับงานแก้ → ปิดไม่ได้", String(error.message).includes("ครบทุกไซซ์")),
    );
    await caller.production.reportPieceQty({ stepId: rework.id, rows: [{ variantId: repairLines[0].sourceOrderItemVariantId!, done: 1, waste: 1 }] });
    await caller.production.updateStep({ stepId: rework.id, status: "COMPLETED" });
    const repairedStep = await prisma.productionStep.findUniqueOrThrow({ where: { id: rework.id } });
    const afterRepair = await prisma.order.findUniqueOrThrow({ where: { id: B.order.id } });
    check("4.4 ปิดดี1เสีย1 → กลับ QC และของดีไม่ถูกปลอมเป็น2", repairedStep.qtyDone === 1 && afterRepair.internalStatus === "QUALITY_CHECK");
    await caller.qc.create({ orderId: B.order.id, idempotencyKey: "verify-qc-b-second-repair", qtyGood: 1,
      defects: [{ variantId: repairLines[0].sourceOrderItemVariantId!, qty: 1, size: "L", reason: "PRINT_PEEL" }] });
    const secondRepair = await prisma.productionStep.findFirstOrThrow({ where: { productionId: B.production.id, status: "PENDING" }, include: { quantities: true } });
    check("4.5 เสียซ้ำ1 → งานแก้รอบใหม่ L1 เท่านั้น", secondRepair.qtyTotal === 1 && secondRepair.quantities.length === 1 && secondRepair.quantities[0].qtyPlanned === 1);
    for (const item of workOrderStandards("CUSTOM")) {
      await caller.production.tickStandard({ stepId: secondRepair.id, item, checked: true });
    }
    await caller.production.reportPieceQty({ stepId: secondRepair.id, rows: [{ variantId: repairLines[0].sourceOrderItemVariantId!, done: 1, waste: 0 }] });
    await caller.production.updateStep({ stepId: secondRepair.id, status: "COMPLETED" });
    await caller.qc.create({ orderId: B.order.id, idempotencyKey: "verify-qc-b-repaired-good", qtyGood: 1, defects: [] });
    const repairedOrder = await prisma.order.findUniqueOrThrow({ where: { id: B.order.id } });
    check("4.6 ดีสะสม8+1+1ครบ10 → เข้า PACKING หลังงานแก้จริง", repairedOrder.internalStatus === "PACKING");

    // ── 5. ดีบางส่วน — ค้างที่ด่านตรวจ + กันนับเกิน ──
    const D2 = await makeOrder(customer.id, owner.id, "D");
    const dContext = await caller.qc.context({ orderId: D2.order.id });
    await caller.qc.create({
      orderId: D2.order.id,
      idempotencyKey: "verify-qc-d2-partial-1",
      qtyGood: 4,
      goodLines: [{ variantId: dContext.lines.find((line) => line.size === "M")!.variantId, qtyGood: 4 }],
      defects: [],
    });
    let dNow = await prisma.order.findUniqueOrThrow({ where: { id: D2.order.id } });
    check("5.1 ดีบางส่วน 4/10 → ยังอยู่ด่านตรวจ", dNow.internalStatus === "QUALITY_CHECK");
    await caller.qc
      .create({
        orderId: D2.order.id,
        idempotencyKey: "verify-qc-d2-over-count",
        qtyGood: 7,
        defects: [],
      })
      .then(
        () => check("5.2 นับเกินยอดงาน (4+7>10) → โดนกัน", false),
        (e) => check("5.2 นับเกินยอดงาน (4+7>10) → โดนกัน", String(e.message).includes("นับเกินยอดงาน"))
      );
    await caller.qc.create({
      orderId: D2.order.id,
      idempotencyKey: "verify-qc-d2-partial-2",
      qtyGood: 6,
      defects: [],
    });
    dNow = await prisma.order.findUniqueOrThrow({ where: { id: D2.order.id } });
    check("5.3 นับครบสะสม 10/10 → เด้ง PACKING", dNow.internalStatus === "PACKING");

    // ── 6. Gate B4: ปิดทาง bypass ด่านตรวจ — เข้าแพ็คมือต้องมีผลตรวจนับก่อน ──
    const E = await makeOrder(customer.id, owner.id, "E");
    const eContext = await caller.qc.context({ orderId: E.order.id });
    await caller.order
      .updateStatus({ id: E.order.id, internalStatus: "PACKING" })
      .then(
        () => check("6.1 เข้าแพ็คมือโดยไม่เคยตรวจนับ → โดนกัน", false),
        (e) => check("6.1 เข้าแพ็คมือโดยไม่เคยตรวจนับ → โดนกัน", String(e.message).includes("ตรวจนับ"))
      );
    // มีหลักฐานเพียงบางส่วนยังไม่ใช่ของดีครบ: ปุ่มเปลี่ยนสถานะห้ามข้ามจำนวน.
    await caller.qc.create({
      orderId: E.order.id,
      idempotencyKey: "verify-qc-e-good",
      qtyGood: 7,
      goodLines: eContext.lines.map((line) => ({ variantId: line.variantId, qtyGood: line.size === "M" ? 6 : 1 })),
      defects: [],
    });
    await caller.order.updateStatus({
      id: E.order.id,
      internalStatus: "PACKING",
      reason: "ลูกค้ารับของ 7/10 — ตกลงกันแล้ว",
    }).then(
      () => check("6.2 นับดี7/10 → กดแพ็กมือไม่ได้", false),
      (error) => check("6.2 นับดี7/10 → กดแพ็กมือไม่ได้", String(error.message).includes("เหลือ 3 ตัว")),
    );
    await caller.qc.create({ orderId: E.order.id, idempotencyKey: "verify-qc-e-good-rest", qtyGood: 3, defects: [] });
    const eAfter = await prisma.order.findUniqueOrThrow({ where: { id: E.order.id } });
    check("6.3 ตรวจส่วนที่เหลือ3ครบ → เข้าแพ็กเอง", eAfter.internalStatus === "PACKING");

    // เครื่องเสียระหว่างทำ: มีฟิล์มดี4/10 ส่งร้านทำ6ที่เหลือ บนขั้นเดิม ไม่สร้างยอดซ้ำ.
    const fallbackOrder = await prisma.order.create({ data: {
      orderNumber: `TEST-QC-FALLBACK-${Date.now()}`, notes: `${MARK} เครื่องเสียส่งร้านแทน`,
      customerId: customer.id, createdById: owner.id, internalStatus: "PRODUCING",
      items: { create: [{ description: "เสื้อ", totalQuantity: 10,
        products: { create: [{ productType: "TSHIRT", description: "เสื้อ", baseUnitPrice: 0,
          variants: { create: [{ size: "M", color: "ดำ", quantity: 10 }] } }] } }] },
      productions: { create: [{ status: "IN_PROGRESS", steps: { create: [
        { stepType: "DTF_PRINT", status: "IN_PROGRESS", qtyTotal: 10, qtyDone: 4, sortOrder: 0 },
        { stepType: "HEAT_PRESS", status: "PENDING", qtyTotal: 10, qtyDone: 0, sortOrder: 1 },
      ] } }] },
    }, include: { productions: { include: { steps: true } }, items: { include: { products: { include: { variants: true } } } } } });
    const fallbackStep = fallbackOrder.productions[0].steps.find((step) => step.stepType === "DTF_PRINT")!;
    const pressStep = fallbackOrder.productions[0].steps.find((step) => step.stepType === "HEAT_PRESS")!;
    const vendor = await prisma.vendor.create({ data: { name: `${MARK} ร้านช่วยพิมพ์`, capabilities: ["DTF"] } });
    const activeRun = await prisma.printRun.create({ data: {
      runNumber: `TEST-QC-RUN-${Date.now()}`, note: MARK, createdById: owner.id,
      items: { create: [{ productionStepId: fallbackStep.id, orderId: fallbackOrder.id, qty: 6 }] },
    } });
    const fallbackInput = { productionStepId: fallbackStep.id, vendorId: vendor.id, description: "ฟิล์ม6ที่เหลือ", quantity: 6 };
    await caller.outsource.createOrder(fallbackInput).then(
      () => check("7.1 เครื่องยังมีรอบพิมพ์ค้าง → ส่งร้านซ้ำไม่ได้", false),
      (error) => check("7.1 เครื่องยังมีรอบพิมพ์ค้าง → ส่งร้านซ้ำไม่ได้", String(error.message).includes("ยกเลิกหรือปิดรอบเดิม")),
    );
    await caller.printRun.cancel({ runId: activeRun.id });
    const draft = await caller.outsource.createOrder(fallbackInput);
    deletedOutsourceIds.push(draft.id);
    await caller.outsource.cancelDraftOrder({ id: draft.id });
    check("7.2 ยกเลิกร่างส่งร้าน → คืนทำในโรงงานและคงของดี4", (await prisma.productionStep.findUniqueOrThrow({ where: { id: fallbackStep.id } })).executionMode === "IN_HOUSE");
    const fallbackJob = await caller.outsource.createOrder(fallbackInput);
    await caller.printRun.create({ items: [{ stepId: fallbackStep.id, qty: 6 }] }).then(
      () => check("7.3 ส่งร้านแล้ว → ห้ามเปิดรอบพิมพ์ในโรงงานซ้ำ", false),
      (error) => check("7.3 ส่งร้านแล้ว → ห้ามเปิดรอบพิมพ์ในโรงงานซ้ำ", String(error.message).includes("ส่งร้านนอกแล้ว")),
    );
    await caller.outsource.updateOrderStatus({ id: fallbackJob.id, status: "SENT" });
    await caller.goodsReceipt.create({ orderId: fallbackOrder.id, idempotencyKey: `verify-qc-fallback-${fallbackJob.id}`,
      receiptType: "OUTSOURCE_RETURN", outsourceOrderId: fallbackJob.id,
      lines: [{ description: "ฟิล์ม", qtyExpected: 6, qtyCounted: 6, defectQty: 0 }] });
    await caller.outsource.updateOrderStatus({ id: fallbackJob.id, status: "RECEIVED_BACK" });
    await caller.outsource.updateOrderStatus({ id: fallbackJob.id, status: "QC_PASSED", acceptGoodQuantity: 6 });
    const filmBack = await prisma.productionStep.findUniqueOrThrow({ where: { id: fallbackStep.id } });
    check("7.4 ทำเอง4+รับร้าน6 → ฟิล์มครบ10บนขั้นเดิม", filmBack.qtyDone === 10 && filmBack.status === "COMPLETED");
    await caller.production.updateStep({ stepId: pressStep.id, status: "IN_PROGRESS" });
    for (const item of workOrderStandards("HEAT_PRESS")) {
      await caller.production.tickStandard({ stepId: pressStep.id, item, checked: true });
    }
    await caller.production.reportPieceQty({ stepId: pressStep.id, rows: [{ variantId: fallbackOrder.items[0].products[0].variants[0].id, done: 10, waste: 0 }] });
    await caller.production.updateStep({ stepId: pressStep.id, status: "COMPLETED" });
    await caller.qc.create({ orderId: fallbackOrder.id, idempotencyKey: "verify-qc-fallback-final", qtyGood: 10, defects: [] });
    check("7.5 ฟิล์มร้านผ่าน → รีดร้อน → QCครบ → เข้าแพ็ก", (await prisma.order.findUniqueOrThrow({ where: { id: fallbackOrder.id } })).internalStatus === "PACKING");
  } finally {
    const orders = await prisma.order.findMany({
      where: { notes: { contains: MARK } },
      select: { id: true, orderNumber: true },
    });
    const ids = orders.map((o) => o.id);
    await prisma.notification.deleteMany({
      where: { type: "QC_DEFECT", OR: orders.map((o) => ({ title: { contains: o.orderNumber } })) },
    });
    // audit ของผลนับ + ออเดอร์ (updateStatus เคส 6) ไม่หายกับ cascade — ลบเองให้เกลี้ยง
    const qcRecords = await prisma.qcRecord.findMany({
      where: { orderId: { in: ids } },
      select: { id: true },
    });
    const steps = await prisma.productionStep.findMany({ where: { production: { orderId: { in: ids } } }, select: { id: true } });
    const outsourceJobs = await prisma.outsourceOrder.findMany({ where: { productionStepId: { in: steps.map((step) => step.id) } }, select: { id: true } });
    const receipts = await prisma.goodsReceipt.findMany({ where: { orderId: { in: ids } }, select: { id: true } });
    const runs = await prisma.printRun.findMany({ where: { note: MARK }, select: { id: true } });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...ids, ...deletedOutsourceIds, ...qcRecords.map((q) => q.id), ...steps.map((step) => step.id), ...outsourceJobs.map((job) => job.id), ...receipts.map((receipt) => receipt.id), ...runs.map((run) => run.id)] } },
    });
    await prisma.printRun.deleteMany({ where: { id: { in: runs.map((run) => run.id) } } });
    await prisma.goodsReceipt.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.outsourceOrder.deleteMany({ where: { id: { in: outsourceJobs.map((job) => job.id) } } });
    await prisma.qcRecord.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.production.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
    await prisma.customer.deleteMany({ where: { name: { contains: MARK } } });
    await prisma.vendor.deleteMany({ where: { name: { contains: MARK } } });
  }

  console.log(`\n=== ผล: ผ่าน ${pass} · ตก ${fails.length} ===`);
  if (fails.length > 0) {
    console.log("ตก:", fails.join(" / "));
    process.exit(1);
  }
  await prisma.$disconnect();
}

main();
