// E2E verify จริงกับ DB: เดิน "ทั้งวงจรออเดอร์" ในการวิ่งเดียว — เปิดงานจากแชท → ยืนยัน →
// มัดจำ → ออกแบบ (ลูกค้าขอแก้ → อนุมัติ) → ผลิต + outsource → QC → แพ็ค → ส่ง → วางบิลครบ → ปิดงาน
// สลับ role จริงทุกขั้น (SALES/ACCOUNTANT/DESIGNER/PRODUCTION_STAFF/MANAGER + ลูกค้าผ่าน token)
// flow B: READY_MADE ขายสด (ใบเสร็จใบเดียว) · flow C: ลูกค้ามีไฟล์ → ข้ามออกแบบ
// ลบข้อมูลทดสอบเกลี้ยง + คืน DocumentSequence · ห้ามรันบน DB ใช้งานจริง
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";
import { currentPeriod } from "@/server/services/document-number";
import type { Role } from "@prisma/client";

let passCount = 0;
const fails: string[] = [];
function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passCount++;
    console.log("PASS:", name);
  } else {
    fails.push(name);
    console.log("FAIL:", name, "→", JSON.stringify(detail));
  }
}
async function expectError(name: string, fn: () => Promise<unknown>, msgPart: string) {
  try {
    await fn();
    ok(name, false, "ไม่ throw เลย");
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    ok(name, m.includes(msgPart), m);
  }
}

const SEQ_TYPES = ["ORDER", "DEPOSIT_INVOICE", "FINAL_INVOICE", "RECEIPT", "QUOTATION"];

async function main() {
  const period = currentPeriod();
  const seqBefore = await prisma.documentSequence.findMany({
    where: { period, docType: { in: SEQ_TYPES } },
  });

  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const asRole = (role: Role) =>
    appRouter.createCaller({ prisma, userId: owner.id, userRole: role });
  const sales = asRole("SALES");
  const accountant = asRole("ACCOUNTANT");
  const designer = asRole("DESIGNER");
  const staff = asRole("PRODUCTION_STAFF");
  const manager = asRole("MANAGER");

  const ids = { customer: "", orders: [] as string[], vendor: "" };

  try {
    // ลูกค้าแชท LINE — มีแค่ชื่อ (โปรไฟล์โตตามงาน) + วงเงินพอสำหรับงานทดสอบ
    const customer = await prisma.customer.create({
      data: { name: "[E2E-VERIFY] ลูกค้าแชท", creditLimit: 100000 },
    });
    ids.customer = customer.id;
    const vendor = await prisma.vendor.create({
      data: { name: "[E2E-VERIFY] ร้านซิลค์สกรีน", capabilities: ["สกรีน"] },
    });
    ids.vendor = vendor.id;

    // ============ FLOW A: CUSTOM งานพิมพ์ DTF + มัดจำ 50% + ออกแบบ + outsource ============
    console.log("\n--- FLOW A: CUSTOM เต็มวงจร (มัดจำ/ออกแบบ/outsource/วางบิล/ปิดงาน) ---");

    // 1) ขายเปิดงานจากแชท
    const oa = await sales.order.create({
      customerId: customer.id,
      title: "[E2E-VERIFY] เสื้อทีมพิมพ์ DTF 20 ตัว",
      paymentTerms: "DEPOSIT_50",
      items: [
        {
          products: [
            {
              productType: "T_SHIRT",
              description: "เสื้อยืดคอกลม",
              baseUnitPrice: 100,
              variants: [
                { size: "M", quantity: 10 },
                { size: "L", quantity: 10 },
              ],
            },
          ],
          prints: [{ position: "FRONT", printType: "DTF", unitPrice: 30 }],
          addons: [],
        },
      ],
    });
    ids.orders.push(oa.id);
    ok(
      "A1 ขายเปิดงานพิมพ์ → CUSTOM เริ่ม INQUIRY + เลขออเดอร์รันจริง + ยอดคำนวณ",
      oa.orderType === "CUSTOM" && oa.internalStatus === "INQUIRY" && oa.totalAmount > 0,
      { t: oa.orderType, s: oa.internalStatus, total: oa.totalAmount }
    );
    const totalA = oa.totalAmount;

    // 2) ลูกค้าตกลง → ขายยืนยัน (ผ่านด่านวงเงิน)
    await sales.order.updateStatus({ id: oa.id, internalStatus: "CONFIRMED" });

    // 3) บัญชีเรียกมัดจำตามเทอม — suggest ต้องแนะ DEPOSIT_INVOICE 50%
    const sug = await accountant.billing.suggest({ orderId: oa.id });
    ok(
      "A2 ระบบแนะบิลมัดจำ 50% ตามเทอมจริง",
      sug.type === "DEPOSIT_INVOICE" && Math.abs(sug.amount + sug.tax - totalA / 2) < 0.02,
      sug
    );
    const dep = await accountant.billing.create({
      orderId: oa.id,
      customerId: customer.id,
      type: "DEPOSIT_INVOICE",
      amount: sug.amount,
      tax: sug.tax,
    });
    await accountant.billing.recordPayment({
      invoiceId: dep.id,
      amount: dep.totalAmount,
      method: "BANK_TRANSFER",
    });
    const depDb = await prisma.invoice.findUniqueOrThrow({ where: { id: dep.id } });
    ok("A3 รับมัดจำ → บิล PAID", depDb.paymentStatus === "PAID", depDb.paymentStatus);

    // 4) ส่งเข้าออกแบบ → กราฟิกอัปแบบ v1 → ลูกค้าขอแก้ → v2 → ลูกค้าอนุมัติ
    await sales.order.updateStatus({ id: oa.id, internalStatus: "DESIGNING" });
    const d1 = await designer.design.upload({
      orderId: oa.id,
      fileUrl: "https://example.com/e2e-v1.png",
    });
    await sales.design.approveByToken({
      token: d1.approvalToken!,
      approved: false,
      comment: "ขอโลโก้ใหญ่กว่านี้",
    });
    let oaDb = await prisma.order.findUniqueOrThrow({ where: { id: oa.id } });
    ok("A4 ลูกค้าขอแก้แบบ v1 → ออเดอร์ยังอยู่ขั้นออกแบบ", oaDb.internalStatus === "DESIGNING", oaDb.internalStatus);

    const d2 = await designer.design.upload({
      orderId: oa.id,
      fileUrl: "https://example.com/e2e-v2.png",
    });
    await expectError(
      "A5 ลูกค้าถือลิงก์ v1 (ตัดสินไปแล้ว) ตัดสินซ้ำ/กลับคำไม่ได้",
      () => sales.design.approveByToken({ token: d1.approvalToken!, approved: true }),
      "ตัดสินไปแล้ว"
    );
    // ลิงก์อนุมัติ regenerate ได้ (audit ข้อ 17) — เฉพาะแบบรอตัดสิน
    const d2New = await sales.design.regenerateToken({ designId: d2.id });
    ok(
      "A5.1 สร้างลิงก์อนุมัติใหม่ได้ (token เปลี่ยน + อายุใหม่)",
      d2New.approvalToken !== d2.approvalToken && d2New.tokenExpiresAt! > new Date(),
      { changed: d2New.approvalToken !== d2.approvalToken }
    );
    await expectError(
      "A5.2 ลิงก์เก่าตายทันทีหลังสร้างใหม่",
      () => sales.design.getByToken({ token: d2.approvalToken! }),
      ""
    );
    await expectError(
      "A5.3 แบบที่ตัดสินแล้ว สร้างลิงก์ใหม่ไม่ได้",
      () => sales.design.regenerateToken({ designId: d1.id }),
      "ตัดสินไปแล้ว"
    );

    await sales.design.approveByToken({ token: d2New.approvalToken!, approved: true, comment: "ผ่าน" });
    oaDb = await prisma.order.findUniqueOrThrow({ where: { id: oa.id } });
    ok("A6 ลูกค้าอนุมัติ v2 ผ่านลิงก์ (token ใหม่) → DESIGN_APPROVED", oaDb.internalStatus === "DESIGN_APPROVED", oaDb.internalStatus);

    // 5) เปิดใบผลิต (DTF in-house + สกรีน outsource)
    const prod = await manager.production.create({
      orderId: oa.id,
      steps: [
        { stepType: "DTF_PRINT", sortOrder: 1 },
        { stepType: "HEAT_PRESS", sortOrder: 2 },
        { stepType: "SCREEN_PRINTING", sortOrder: 3 },
      ],
    });
    oaDb = await prisma.order.findUniqueOrThrow({ where: { id: oa.id } });
    ok("A7 เปิดใบผลิต → ออเดอร์เข้า PRODUCING", oaDb.internalStatus === "PRODUCING", oaDb.internalStatus);

    // 6) ช่างติ๊กงาน in-house (auto-claim) + งานสกรีนส่งร้านนอกครบวงจร
    const dtfStep = prod.steps.find((s) => s.stepType === "DTF_PRINT")!;
    const pressStep = prod.steps.find((s) => s.stepType === "HEAT_PRESS")!;
    const screenStep = prod.steps.find((s) => s.stepType === "SCREEN_PRINTING")!;

    await staff.production.updateStep({ stepId: dtfStep.id, status: "COMPLETED" });
    const claimed = await prisma.productionStep.findUniqueOrThrow({ where: { id: dtfStep.id } });
    ok("A8 ช่างติ๊กขั้นตอนที่ยังไม่มีเจ้าของ → claim อัตโนมัติ", claimed.assignedToId === owner.id, claimed.assignedToId);

    const os = await manager.outsource.createOrder({
      productionStepId: screenStep.id,
      vendorId: vendor.id,
      description: "[E2E-VERIFY] สกรีนแขน",
      quantity: 20,
      unitCost: 15,
    });
    await staff.outsource.updateOrderStatus({ id: os.id, status: "SENT" });
    await staff.outsource.updateOrderStatus({ id: os.id, status: "RECEIVED_BACK" });
    await manager.outsource.updateOrderStatus({ id: os.id, status: "QC_PASSED" });

    await staff.production.updateStep({ stepId: pressStep.id, status: "COMPLETED" });
    oaDb = await prisma.order.findUniqueOrThrow({ where: { id: oa.id } });
    const prodDb = await prisma.production.findUniqueOrThrow({ where: { id: prod.id } });
    ok(
      "A9 ผลิตครบ (in-house + outsource QC ผ่าน) → ใบผลิตปิด + ออเดอร์เด้ง QUALITY_CHECK เอง",
      prodDb.status === "COMPLETED" && oaDb.internalStatus === "QUALITY_CHECK",
      { prod: prodDb.status, order: oaDb.internalStatus }
    );

    // 7) QC ผ่าน → แพ็ค → ส่งของ (ที่อยู่จากแชทไหลกลับโปรไฟล์) → ออเดอร์เด้ง SHIPPED
    await staff.order.updateStatus({ id: oa.id, internalStatus: "PACKING" });
    const del = await staff.delivery.create({
      orderId: oa.id,
      recipientName: "คุณลูกค้าแชท",
      phone: "0812345678",
      address: "55 ถ.อี2อี",
      province: "กรุงเทพมหานคร",
      shippingMethod: "FLASH",
      saveAsCustomerAddress: true,
    });
    await staff.delivery.updateStatus({ id: del.id, status: "SHIPPED", trackingNumber: "E2E-TRACK-1" });
    oaDb = await prisma.order.findUniqueOrThrow({ where: { id: oa.id } });
    const custDb = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    ok(
      "A10 กดส่งของตอนแพ็ค → ออเดอร์เดินเอง แพ็ค→พร้อมส่ง→SHIPPED + เลขพัสดุติดออเดอร์ + ที่อยู่ไหลกลับโปรไฟล์",
      oaDb.internalStatus === "SHIPPED" &&
        oaDb.trackingNumber === "E2E-TRACK-1" &&
        (custDb.address ?? "").includes("ถ.อี2อี"),
      { s: oaDb.internalStatus, trk: oaDb.trackingNumber, addr: custDb.address }
    );

    // 8) ปิดงานก่อนวางบิลครบ → โดนกัน · วางบิลส่วนที่เหลือ + รับเงิน → ปิดได้
    await expectError(
      "A11 ปิดงานทั้งที่วางบิลแค่มัดจำ → ระบบกัน (หนี้ไม่หล่น)",
      () => manager.order.updateStatus({ id: oa.id, internalStatus: "COMPLETED" }),
      "วางบิล"
    );
    const sugFinal = await accountant.billing.suggest({ orderId: oa.id });
    const fin = await accountant.billing.create({
      orderId: oa.id,
      customerId: customer.id,
      type: "FINAL_INVOICE",
      amount: sugFinal.amount,
      tax: sugFinal.tax,
    });
    await accountant.billing.recordPayment({
      invoiceId: fin.id,
      amount: fin.totalAmount,
      method: "BANK_TRANSFER",
    });
    const closed = await manager.order.updateStatus({ id: oa.id, internalStatus: "COMPLETED" });
    ok(
      "A12 วางบิลครบ (มัดจำ+ส่วนที่เหลือ = ยอดเต็ม) → ปิดงานได้ + completedAt + ลูกค้าเห็น 'เสร็จสิ้น'",
      closed.internalStatus === "COMPLETED" &&
        closed.completedAt !== null &&
        closed.customerStatus === "COMPLETED",
      { s: closed.internalStatus, cs: closed.customerStatus }
    );
    const sumBilled = (
      await prisma.invoice.findMany({
        where: { orderId: oa.id, isVoided: false, type: { in: ["DEPOSIT_INVOICE", "FINAL_INVOICE"] } },
      })
    ).reduce((s, i) => s + Number(i.totalAmount), 0);
    ok("A13 ยอดบิลรวมตรงยอดออเดอร์เป๊ะ (ไม่ขาดไม่เกิน)", Math.abs(sumBilled - totalA) < 0.02, {
      billed: sumBilled,
      order: totalA,
    });
    // 11 = ทุกการเปลี่ยนจริงบนเส้น A (ยืนยัน/เข้าออกแบบ/ตัดสินแบบ 2 ครั้ง/คิว/ผลิต/QC/แพ็ค/พร้อมส่ง/ส่ง/ปิด)
    const revisions = await prisma.orderRevision.count({ where: { orderId: oa.id } });
    ok("A14 ทุกการเปลี่ยนสถานะ/ตัดสินแบบมีรอยเท้า (OrderRevision ครบเส้น)", revisions >= 11, revisions);

    // ============ FLOW B: READY_MADE ขายสด (ใบเสร็จใบเดียว ไม่มีออกแบบ) ============
    console.log("\n--- FLOW B: READY_MADE ขายสด ---");
    const ob = await sales.order.create({
      customerId: customer.id,
      title: "[E2E-VERIFY] เสื้อเปล่าสต๊อก 5 ตัว",
      items: [
        {
          products: [
            {
              productType: "T_SHIRT",
              description: "เสื้อเปล่า",
              baseUnitPrice: 120,
              variants: [{ size: "L", quantity: 5 }],
            },
          ],
          prints: [],
          addons: [],
        },
      ],
    });
    ids.orders.push(ob.id);
    ok(
      "B1 เสื้อเปล่าล้วน → READY_MADE เกิดมา CONFIRMED เลย (ไม่ถามชนิด ไม่ผ่านสอบถาม)",
      ob.orderType === "READY_MADE" && ob.internalStatus === "CONFIRMED",
      { t: ob.orderType, s: ob.internalStatus }
    );
    // เดินมือถึงพร้อมส่ง (ไม่มีใบผลิตก็เดินได้ — งานหยิบ-แพ็ค)
    for (const s of ["PRODUCTION_QUEUE", "PRODUCING", "QUALITY_CHECK", "PACKING", "READY_TO_SHIP"] as const) {
      await manager.order.updateStatus({ id: ob.id, internalStatus: s });
    }
    // ด่านใหม่ (audit ข้อ 22): กดส่งแล้วด้วยมือโดยไม่มีใบส่งในระบบ → โดนกัน
    await expectError(
      "B2 กด 'ส่งแล้ว' มือโดยไม่มีใบส่ง → ระบบกัน (เลขพัสดุ/ที่อยู่ต้องอยู่ในระบบ)",
      () => manager.order.updateStatus({ id: ob.id, internalStatus: "SHIPPED" }),
      "ยังไม่มีใบส่ง"
    );
    const obDel = await staff.delivery.create({
      orderId: ob.id,
      recipientName: "ลูกค้าขายสด",
      phone: "0820000000",
      address: "2 ถ.ขายสด",
      shippingMethod: "PICKUP",
    });
    await staff.delivery.updateStatus({ id: obDel.id, status: "SHIPPED" });
    const rcp = await accountant.billing.create({
      orderId: ob.id,
      customerId: customer.id,
      type: "RECEIPT",
      amount: ob.totalAmount,
    });
    await accountant.billing.recordPayment({ invoiceId: rcp.id, amount: rcp.totalAmount, method: "CASH" });
    // ปิดงานโดย "บัญชี" — role ที่รู้ว่าบิลครบจริง (audit ข้อ 27: my-tasks มอบขั้นนี้ให้บัญชี)
    const obClosed = await accountant.order.updateStatus({ id: ob.id, internalStatus: "COMPLETED" });
    ok(
      "B3 ขายสดออกแต่ใบเสร็จ → 'บัญชี' ปิดงานเองได้ (ผ่านด่าน max(วางบิล, ใบเสร็จ))",
      obClosed.internalStatus === "COMPLETED",
      obClosed.internalStatus
    );
    await expectError(
      "B4 บัญชีเปลี่ยนสถานะอื่นนอกจากปิดงาน → ปฏิเสธ",
      () => accountant.order.updateStatus({ id: ob.id, internalStatus: "SHIPPED", reason: "ทดสอบ" }),
      "บัญชี"
    );

    // ---------- E: ถอยกลับ/เคลม (audit ข้อ 22/24/25) ----------
    console.log("\n--- FLOW E: เปิดงานกลับ + ของตีกลับ ---");
    await expectError(
      "E1 เปิดงานกลับโดยไม่ใส่เหตุผล → ปฏิเสธ",
      () => manager.order.updateStatus({ id: ob.id, internalStatus: "SHIPPED" }),
      "เหตุผล"
    );
    await expectError(
      "E2 ขายเปิดงานกลับเองไม่ได้ (ผู้จัดการขึ้นไป)",
      () => sales.order.updateStatus({ id: ob.id, internalStatus: "SHIPPED", reason: "ลองถอย" }),
      "ผู้จัดการ"
    );
    const reopened = await manager.order.updateStatus({
      id: ob.id,
      internalStatus: "SHIPPED",
      reason: "ลูกค้าเคลมหลังปิดงาน",
    });
    const obAfterReopen = await prisma.order.findUniqueOrThrow({ where: { id: ob.id } });
    ok(
      "E3 ผู้จัดการเปิดงานกลับ (COMPLETED→SHIPPED + เหตุผล) → completedAt ถูกล้าง",
      reopened.internalStatus === "SHIPPED" && obAfterReopen.completedAt === null,
      { s: reopened.internalStatus, c: obAfterReopen.completedAt }
    );

    const notifBefore = await prisma.notification.count({
      where: { entityId: ob.id, title: { contains: "ตีกลับ" } },
    });
    await staff.delivery.updateStatus({ id: obDel.id, status: "RETURNED" });
    const notifAfter = await prisma.notification.count({
      where: { entityId: ob.id, title: { contains: "ตีกลับ" } },
    });
    ok("E4 ของตีกลับ → กระดิ่งแจ้งผู้จัดการ (ห้ามจบเงียบ)", notifAfter > notifBefore, {
      before: notifBefore,
      after: notifAfter,
    });
    const backToQc = await manager.order.updateStatus({
      id: ob.id,
      internalStatus: "QUALITY_CHECK",
      reason: "ของตีกลับ — ตรวจสภาพก่อนตัดสิน",
    });
    ok(
      "E5 ของตีกลับ → ผู้จัดการดึงงานกลับเข้าวงจรตรวจ-ซ่อมได้ (SHIPPED→QUALITY_CHECK)",
      backToQc.internalStatus === "QUALITY_CHECK",
      backToQc.internalStatus
    );

    // ============ FLOW C: CUSTOM ลูกค้ามีไฟล์พร้อมพิมพ์ → ข้ามออกแบบ ============
    console.log("\n--- FLOW C: ลูกค้ามีไฟล์ → ข้ามออกแบบ ---");
    const oc = await sales.order.create({
      customerId: customer.id,
      title: "[E2E-VERIFY] ลูกค้ามีไฟล์เอง",
      items: [
        {
          products: [
            {
              productType: "T_SHIRT",
              description: "เสื้อพิมพ์ไฟล์ลูกค้า",
              baseUnitPrice: 100,
              variants: [{ size: "M", quantity: 3 }],
            },
          ],
          prints: [{ position: "FRONT", printType: "DTF", unitPrice: 25 }],
          addons: [],
        },
      ],
    });
    ids.orders.push(oc.id);
    await sales.order.updateStatus({ id: oc.id, internalStatus: "CONFIRMED" });
    const ocQueued = await sales.order.updateStatus({ id: oc.id, internalStatus: "PRODUCTION_QUEUE" });
    ok(
      "C1 CONFIRMED → เข้าคิวผลิตตรง (ข้ามออกแบบ — ไฟล์พร้อมแล้ว)",
      ocQueued.internalStatus === "PRODUCTION_QUEUE",
      ocQueued.internalStatus
    );

    // ============ FLOW F: สะพานใบเสนอ (audit ข้อ 8 BLOCKER + 9,10,11,12,13) ============
    console.log("\n--- FLOW F: สะพาน สอบถาม↔ใบเสนอ↔ออเดอร์ ---");
    const totalOrdersBefore = (
      await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })
    ).totalOrders;

    // เปิดงานเบาจากแชท (มีรายการจริง) → ออกใบเสนอผูกออเดอร์
    const of1 = await sales.order.create({
      customerId: customer.id,
      title: "[E2E-VERIFY] งานรอใบเสนอ",
      items: [
        {
          products: [
            {
              productType: "T_SHIRT",
              description: "เสื้อพิมพ์ลายทีม",
              baseUnitPrice: 150,
              variants: [{ size: "L", quantity: 10 }],
            },
          ],
          prints: [{ position: "FRONT", printType: "DTF", unitPrice: 30 }],
          addons: [],
        },
      ],
    });
    ids.orders.push(of1.id);

    const validTomorrow = new Date(Date.now() + 7 * 86400_000).toISOString();
    const q1 = await sales.quotation.create({
      customerId: customer.id,
      orderId: of1.id,
      title: "[E2E-VERIFY] ใบเสนอผูกออเดอร์",
      validUntil: validTomorrow,
      items: [{ name: "เสื้อทีมพิมพ์ DTF", quantity: 10, unit: "ตัว", unitPrice: 180 }],
    });
    ok("F1 ออกใบเสนอผูกออเดอร์ได้ (orderId ติดที่ใบเสนอ)", q1.id !== undefined, q1.id);

    // แก้รายการฉบับร่างได้ + totals คิดใหม่
    const q1Edited = await sales.quotation.updateItems({
      id: q1.id,
      items: [{ name: "เสื้อทีมพิมพ์ DTF", quantity: 10, unit: "ตัว", unitPrice: 200 }],
    });
    ok("F2 แก้รายการใบเสนอฉบับร่าง → ยอดคิดใหม่ (2000)", q1Edited.totalAmount === 2000, q1Edited.totalAmount);

    await sales.quotation.updateStatus({ id: q1.id, status: "SENT" });
    await expectError(
      "F3 ส่งแล้วแก้รายการไม่ได้ (ต้องดึงกลับร่างก่อน)",
      () =>
        sales.quotation.updateItems({
          id: q1.id,
          items: [{ name: "x", quantity: 1, unit: "ชิ้น", unitPrice: 1 }],
        }),
      "ฉบับร่าง"
    );

    await sales.quotation.updateStatus({ id: q1.id, status: "ACCEPTED" });
    const converted = await sales.quotation.convertToOrder({ id: q1.id });
    const totalOrdersAfter = (
      await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })
    ).totalOrders;
    ok(
      "F4 ลูกค้าตกลง → ยืนยัน 'ออเดอร์ใบเดิม' (id เดียวกัน ไม่สร้างซ้ำ + สถิติลูกค้าไม่นับเบิ้ล)",
      converted.id === of1.id &&
        converted.internalStatus === "CONFIRMED" &&
        totalOrdersAfter === totalOrdersBefore + 1, // +1 จากตอนเปิด of1 เท่านั้น
      { same: converted.id === of1.id, s: converted.internalStatus, n: totalOrdersAfter - totalOrdersBefore }
    );
    const of1Items = await prisma.orderItem.count({ where: { orderId: of1.id } });
    ok("F5 ออเดอร์ผูกที่มีรายการจริง → รายการเดิมไม่ถูกทับด้วยโครงใบเสนอ", of1Items === 1, of1Items);

    await expectError(
      "F6 กดแปลงซ้ำ → โดนกัน (ไม่เกิดออเดอร์คู่)",
      () => sales.quotation.convertToOrder({ id: q1.id }),
      ""
    );

    // ใบเสนอลอย (ไม่ผูกออเดอร์) → สร้างออเดอร์ใหม่ + เทอมไหลจากโปรไฟล์ลูกค้า + กันโครงเปล่าเข้าผลิต
    await prisma.customer.update({
      where: { id: customer.id },
      data: { defaultPaymentTerms: "DEPOSIT_50" },
    });
    const q2 = await sales.quotation.create({
      customerId: customer.id,
      title: "[E2E-VERIFY] ใบเสนอลอย",
      validUntil: validTomorrow,
      items: [{ name: "งานสกรีนหมวก", quantity: 20, unit: "ใบ", unitPrice: 50 }],
    });
    await sales.quotation.updateStatus({ id: q2.id, status: "SENT" });
    await sales.quotation.updateStatus({ id: q2.id, status: "ACCEPTED" });
    const newOrder = await sales.quotation.convertToOrder({ id: q2.id });
    ids.orders.push(newOrder.id);
    ok(
      "F7 ใบเสนอลอย → ออเดอร์ใหม่ CONFIRMED + เทอมชำระไหลจากโปรไฟล์ (มัดจำ 50%)",
      newOrder.internalStatus === "CONFIRMED" && newOrder.paymentTerms === "DEPOSIT_50",
      { s: newOrder.internalStatus, terms: newOrder.paymentTerms }
    );
    await expectError(
      "F8 รายการโครงใบเสนอ (OTHER/FREE ล้วน) → เปิดใบผลิตไม่ได้ ต้องใส่ของจริงก่อน",
      () =>
        manager.production.create({
          orderId: newOrder.id,
          steps: [{ stepType: "SCREEN_PRINTING", sortOrder: 1 }],
        }),
      "โครงจากใบเสนอ"
    );

    // ใบเสนอหมดอายุ → ตกลง/แปลงไม่ได้
    // (Gate A3: ส่งใบที่หมดอายุแล้วไม่ได้ — ต้องส่งตอนยังไม่หมด แล้วจำลองเวลาผ่านด้วยเขียนตรง)
    const q3 = await sales.quotation.create({
      customerId: customer.id,
      title: "[E2E-VERIFY] ใบเสนอหมดอายุ",
      validUntil: validTomorrow,
      items: [{ name: "งานเก่า", quantity: 1, unit: "ชิ้น", unitPrice: 100 }],
    });
    await sales.quotation.updateStatus({ id: q3.id, status: "SENT" });
    await prisma.quotation.update({
      where: { id: q3.id },
      data: { validUntil: new Date(Date.now() - 3 * 86400_000) },
    });
    await expectError(
      "F9 ใบเสนอหมดอายุ → บันทึกว่าลูกค้าตกลงไม่ได้ (ต้องยืนราคาใหม่)",
      () => sales.quotation.updateStatus({ id: q3.id, status: "ACCEPTED" }),
      "หมดอายุ"
    );

    // ============ ด่านสิทธิ์คร่อมเส้น (กันคนผิด role ทำขั้นที่ไม่ใช่ของตัว) ============
    await expectError(
      "D1 ช่างผลิตยืนยันออเดอร์ไม่ได้ (ฝั่งขายเท่านั้น)",
      () => staff.order.updateStatus({ id: oc.id, internalStatus: "ON_HOLD" }),
      "ฝ่ายผลิต"
    );
    await expectError(
      "D2 ขายบันทึกรับเงินไม่ได้ (บัญชี/เจ้าของเท่านั้น)",
      () => sales.billing.recordPayment({ invoiceId: rcp.id, amount: 1, method: "CASH" }),
      "ไม่มีสิทธิ์"
    );
  } finally {
    // ---------- ล้างเกลี้ยง + คืนเลขเอกสาร ----------
    const invoices = await prisma.invoice.findMany({
      where: { orderId: { in: ids.orders } },
      select: { id: true },
    });
    const invoiceIds = invoices.map((i) => i.id);
    await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.notification.deleteMany({ where: { entityId: { in: ids.orders } } });
    const prods = await prisma.production.findMany({
      where: { orderId: { in: ids.orders } },
      select: { id: true, steps: { select: { id: true } } },
    });
    const stepIds = prods.flatMap((p) => p.steps.map((s) => s.id));
    const osOrders = await prisma.outsourceOrder.findMany({
      where: { productionStepId: { in: stepIds } },
      select: { id: true },
    });
    const deliveries = await prisma.delivery.findMany({
      where: { orderId: { in: ids.orders } },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: {
        entityId: {
          in: [
            ...ids.orders,
            ...invoiceIds,
            ...stepIds,
            ...osOrders.map((o) => o.id),
            ...prods.map((p) => p.id),
            ...deliveries.map((d) => d.id),
            ids.vendor,
            ids.customer,
          ],
        },
      },
    });
    await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    const quotations = await prisma.quotation.findMany({
      where: { customerId: ids.customer },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: quotations.map((q) => q.id) } },
    });
    await prisma.quotation.deleteMany({ where: { customerId: ids.customer } });
    await prisma.outsourceOrder.deleteMany({ where: { productionStepId: { in: stepIds } } });
    await prisma.delivery.deleteMany({ where: { orderId: { in: ids.orders } } });
    await prisma.production.deleteMany({ where: { orderId: { in: ids.orders } } });
    await prisma.designVersion.deleteMany({ where: { orderId: { in: ids.orders } } });
    await prisma.orderRevision.deleteMany({ where: { orderId: { in: ids.orders } } });
    await prisma.order.deleteMany({ where: { id: { in: ids.orders } } });
    if (ids.vendor) await prisma.vendor.deleteMany({ where: { id: ids.vendor } });
    if (ids.customer) await prisma.customer.deleteMany({ where: { id: ids.customer } });

    for (const docType of SEQ_TYPES) {
      const before = seqBefore.find((s) => s.docType === docType);
      if (before) {
        await prisma.documentSequence.updateMany({
          where: { docType, period },
          data: { lastNumber: before.lastNumber },
        });
      } else {
        await prisma.documentSequence.deleteMany({ where: { docType, period } });
      }
    }
  }

  console.log(`\n=== ผล: ผ่าน ${passCount} · ตก ${fails.length} ===`);
  if (fails.length > 0) {
    console.log("รายการที่ตก:", fails);
    process.exitCode = 1;
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("VERIFY CRASHED:", e);
  process.exit(1);
});
