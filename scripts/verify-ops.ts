// verify จริงกับ DB: แพ็คเก็บตกหน้างาน + outsource
// (1) ปิดงานต้องวางบิลครบ (2) outsource ครบวงจร: สร้าง/กันซ้อน/QC ไม่ผ่าน→รอบใหม่/QC ผ่านปิด step
// (3) ลูกค้าตัดสินแบบ → กระดิ่งทีม (4) ขั้นตอน DTF/DTG ใช้ได้จริง
// ลบข้อมูลทดสอบเกลี้ยง + คืน DocumentSequence · ห้ามรันบน DB ใช้งานจริง
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";
import { currentPeriod } from "@/server/services/document-number";
import { randomBytes } from "crypto";

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

const SEQ_TYPES = ["FINAL_INVOICE", "ORDER"];

async function main() {
  const period = currentPeriod();
  const seqBefore = await prisma.documentSequence.findMany({
    where: { period, docType: { in: SEQ_TYPES } },
  });

  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const caller = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });

  const ids = { customer: "", orders: [] as string[], vendor: "" };

  try {
    const customer = await prisma.customer.create({ data: { name: "[OPS-VERIFY] ลูกค้าทดสอบ" } });
    ids.customer = customer.id;
    const vendor = await prisma.vendor.create({
      data: { name: "[OPS-VERIFY] ร้านสกรีนทดสอบ", capabilities: ["สกรีน"] },
    });
    ids.vendor = vendor.id;

    const o1 = await prisma.order.create({
      data: {
        orderNumber: "TEST-OPS-1",
        orderType: "CUSTOM",
        channel: "LINE",
        customerId: customer.id,
        createdById: owner.id,
        internalStatus: "CONFIRMED",
        customerStatus: "ORDER_RECEIVED",
        title: "[OPS-VERIFY] งานผสม DTF+สกรีน",
        totalAmount: 1000,
      },
    });
    ids.orders.push(o1.id);

    // ---------- 1) ขั้นตอน DTF + outsource ครบวงจร ----------
    const prod = await caller.production.create({
      orderId: o1.id,
      steps: [
        { stepType: "DTF_PRINT", sortOrder: 1 },
        { stepType: "HEAT_PRESS", sortOrder: 2 },
        { stepType: "SCREEN_PRINTING", sortOrder: 3 },
      ],
    });
    ok("1.1 ใบผลิตรับขั้นตอน DTF_PRINT/HEAT_PRESS ได้", prod.steps.length === 3, prod.steps.length);

    const screenStep = prod.steps.find((s) => s.stepType === "SCREEN_PRINTING")!;
    const os1 = await caller.outsource.createOrder({
      productionStepId: screenStep.id,
      vendorId: vendor.id,
      description: "[OPS-VERIFY] สกรีนหน้าอก",
      quantity: 50,
      unitCost: 12.5,
      expectedBackAt: new Date(Date.now() + 3 * 86400_000).toISOString(),
    });
    ok("1.2 สร้างงาน outsource ผูก step ได้ + ต้นทุนรวมถูก", os1.totalCost === 625, os1.totalCost);

    await expectError(
      "1.3 เปิดงานซ้อนบน step เดิม → ปฏิเสธ",
      () =>
        caller.outsource.createOrder({
          productionStepId: screenStep.id,
          vendorId: vendor.id,
          description: "ซ้อน",
          quantity: 1,
          unitCost: 1,
        }),
      "งานค้างอยู่กับร้าน"
    );

    await caller.outsource.updateOrderStatus({ id: os1.id, status: "SENT" });
    await caller.outsource.updateOrderStatus({ id: os1.id, status: "RECEIVED_BACK" });
    await caller.outsource.updateOrderStatus({
      id: os1.id,
      status: "QC_FAILED",
      qcNotes: "สีเพี้ยน 5 ตัว",
    });
    let stepDb = await prisma.productionStep.findUniqueOrThrow({ where: { id: screenStep.id } });
    ok(
      "1.4 QC ไม่ผ่าน → step ไม่ปิด + ติดธง qcPassed=false",
      stepDb.status !== "COMPLETED" && stepDb.qcPassed === false,
      { status: stepDb.status, qc: stepDb.qcPassed }
    );

    const os2 = await caller.outsource.createOrder({
      productionStepId: screenStep.id,
      vendorId: vendor.id,
      description: "[OPS-VERIFY] ส่งแก้รอบ 2",
      quantity: 5,
      unitCost: 12.5,
    });
    ok("1.5 หลัง QC ไม่ผ่าน เปิดรอบส่งแก้ใหม่ได้", !!os2.id, os2.id);

    await caller.outsource.updateOrderStatus({ id: os2.id, status: "SENT" });
    await caller.outsource.updateOrderStatus({ id: os2.id, status: "RECEIVED_BACK" });
    await caller.outsource.updateOrderStatus({ id: os2.id, status: "QC_PASSED" });
    stepDb = await prisma.productionStep.findUniqueOrThrow({ where: { id: screenStep.id } });
    ok(
      "1.6 QC ผ่าน → step ปิด COMPLETED + qcPassed=true",
      stepDb.status === "COMPLETED" && stepDb.qcPassed === true,
      { status: stepDb.status, qc: stepDb.qcPassed }
    );

    await expectError(
      "1.7 ใบที่ QC ตัดสินแล้วถูกเปิดใหม่ไม่ได้ (กันสองจอกดชนกัน)",
      () => caller.outsource.updateOrderStatus({ id: os2.id, status: "RECEIVED_BACK" }),
      "ไม่ได้"
    );

    // ---------- 2) ปิดงานต้องวางบิลครบ ----------
    for (const status of ["QUALITY_CHECK", "PACKING", "READY_TO_SHIP", "SHIPPED"] as const) {
      await caller.order.updateStatus({ id: o1.id, internalStatus: status });
    }
    await expectError(
      "2.1 ปิดงานทั้งที่ยังไม่วางบิล → ปฏิเสธ",
      () => caller.order.updateStatus({ id: o1.id, internalStatus: "COMPLETED" }),
      "วางบิล"
    );

    await caller.billing.create({
      orderId: o1.id,
      customerId: customer.id,
      type: "FINAL_INVOICE",
      amount: 1000,
    });
    const closed = await caller.order.updateStatus({ id: o1.id, internalStatus: "COMPLETED" });
    ok("2.2 วางบิลครบแล้วปิดงานได้", closed.internalStatus === "COMPLETED", closed.internalStatus);

    // ---------- 3) ลูกค้าตัดสินแบบ → กระดิ่งทีม ----------
    const o2 = await prisma.order.create({
      data: {
        orderNumber: "TEST-OPS-2",
        orderType: "CUSTOM",
        channel: "LINE",
        customerId: customer.id,
        createdById: owner.id,
        internalStatus: "DESIGNING",
        customerStatus: "PREPARING",
        title: "[OPS-VERIFY] งานรออนุมัติแบบ",
        totalAmount: 500,
      },
    });
    ids.orders.push(o2.id);
    const token = randomBytes(32).toString("hex");
    await prisma.designVersion.create({
      data: {
        orderId: o2.id,
        versionNumber: 1,
        fileUrl: "https://example.com/test-design.png",
        approvalToken: token,
        tokenExpiresAt: new Date(Date.now() + 86400_000),
      },
    });

    const teamCount = await prisma.user.count({
      where: { role: { in: ["OWNER", "MANAGER", "SALES", "DESIGNER"] }, isActive: true },
    });
    await caller.design.approveByToken({ token, approved: true, comment: "สวยมากครับ" });
    const notifs = await prisma.notification.findMany({
      where: { entityType: "ORDER", entityId: o2.id },
    });
    ok(
      `3.1 ลูกค้าอนุมัติแบบ → แจ้งทีมครบ ${teamCount} คน พร้อมลิงก์ไปออเดอร์`,
      notifs.length === teamCount && notifs.every((n) => n.link === `/orders/${o2.id}`),
      notifs.length
    );
    const o2Db = await prisma.order.findUniqueOrThrow({ where: { id: o2.id } });
    ok("3.2 สถานะออเดอร์เดินเป็น DESIGN_APPROVED", o2Db.internalStatus === "DESIGN_APPROVED", o2Db.internalStatus);

    // ---------- 4) ที่อยู่จัดส่งไหลกลับโปรไฟล์ลูกค้า ----------
    await caller.delivery.create({
      orderId: o2.id,
      recipientName: "คุณส้ม",
      phone: "0891234567",
      address: "99/1 ถ.ทดสอบ",
      district: "เมือง",
      province: "เชียงใหม่",
      postalCode: "50000",
      shippingMethod: "KERRY",
      saveAsCustomerAddress: true,
    });
    const custDb = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    ok(
      "4.1 ลูกค้าแชท (ไม่มีที่อยู่/เบอร์) → ที่อยู่จัดส่ง+เบอร์ไหลกลับโปรไฟล์",
      custDb.address === "99/1 ถ.ทดสอบ เมือง เชียงใหม่ 50000" && custDb.phone === "0891234567",
      { address: custDb.address, phone: custDb.phone }
    );

    const found = await caller.customer.list({ search: "0891234567", limit: 5 });
    ok("4.2 ค้นหาลูกค้าด้วยเบอร์เจอ", found.customers.some((c) => c.id === customer.id), found.total);

    // ---------- 5) ฟอร์มเดียว: derive ชนิด/สถานะ/ภาษีต่อรายการ ----------
    const light = await caller.order.create({
      customerId: customer.id,
      title: "[OPS-VERIFY] เปิดเบาจากแชท",
      description: "ลูกค้าถามราคาเสื้อทีม 50 ตัว",
      items: [],
    });
    ids.orders.push(light.id);
    ok(
      "5.1 เปิดงานไม่มีรายการ → เริ่มเป็นการสอบถาม (INQUIRY/CUSTOM)",
      light.internalStatus === "INQUIRY" && light.orderType === "CUSTOM",
      { s: light.internalStatus, t: light.orderType }
    );

    await expectError(
      "5.2 ยืนยันออเดอร์ที่ยังไม่มีรายการ → ปฏิเสธ",
      () => caller.order.updateStatus({ id: light.id, internalStatus: "CONFIRMED" }),
      "ยังไม่มีรายการ"
    );

    const plainItem = {
      products: [
        {
          productType: "T_SHIRT",
          description: "เสื้อเปล่าจากสต๊อก",
          baseUnitPrice: 120,
          variants: [{ size: "L", quantity: 20 }],
        },
      ],
      prints: [],
      addons: [],
    };
    await caller.order.updateItems({ id: light.id, items: [plainItem], discount: 0 });
    const lightDb = await prisma.order.findUniqueOrThrow({
      where: { id: light.id },
      include: { items: true },
    });
    ok(
      "5.3 เติมรายการเสื้อเปล่าล้วน → re-derive เป็นสำเร็จรูป + ภาษีขายสินค้า",
      lightDb.orderType === "READY_MADE" && lightDb.items[0].taxLineType === "GOODS",
      { t: lightDb.orderType, tax: lightDb.items[0].taxLineType }
    );

    const lightConfirmed = await caller.order.updateStatus({
      id: light.id,
      internalStatus: "CONFIRMED",
    });
    ok(
      "5.4 สอบถาม→ยืนยันได้แม้กลายเป็นสำเร็จรูป (ทางลัดใหม่)",
      lightConfirmed.internalStatus === "CONFIRMED",
      lightConfirmed.internalStatus
    );

    const mixed = await caller.order.create({
      customerId: customer.id,
      title: "[OPS-VERIFY] ออเดอร์ผสม",
      items: [
        {
          products: [
            {
              productType: "T_SHIRT",
              description: "เสื้อพิมพ์ลาย",
              baseUnitPrice: 100,
              variants: [{ size: "M", quantity: 10 }],
            },
          ],
          prints: [{ position: "FRONT", printType: "DTF", unitPrice: 20 }],
          addons: [],
        },
        plainItem,
      ],
    });
    ids.orders.push(mixed.id);
    const mixedTax = mixed.items.map((it: { taxLineType: string }) => it.taxLineType).sort();
    ok(
      "5.5 ออเดอร์ผสม → ภาษีต่อรายการ (จ้างทำของ+ขายสินค้า ในใบเดียว) + เริ่ม INQUIRY",
      mixed.internalStatus === "INQUIRY" &&
        mixed.orderType === "CUSTOM" &&
        mixedTax.join(",") === "GOODS,HIRE_OF_WORK",
      { s: mixed.internalStatus, tax: mixedTax }
    );
  } finally {
    // ---------- ล้างเกลี้ยง + คืนเลขเอกสาร ----------
    await prisma.notification.deleteMany({ where: { entityId: { in: ids.orders } } });
    const invoices = await prisma.invoice.findMany({
      where: { orderId: { in: ids.orders } },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...ids.orders, ...invoices.map((i) => i.id)] } },
    });
    await prisma.invoice.deleteMany({ where: { orderId: { in: ids.orders } } });
    const prods = await prisma.production.findMany({
      where: { orderId: { in: ids.orders } },
      select: { id: true, steps: { select: { id: true } } },
    });
    const stepIds = prods.flatMap((p) => p.steps.map((s) => s.id));
    const osOrders = await prisma.outsourceOrder.findMany({
      where: { productionStepId: { in: stepIds } },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...osOrders.map((o) => o.id), ...prods.map((p) => p.id), ids.vendor] } },
    });
    await prisma.outsourceOrder.deleteMany({ where: { productionStepId: { in: stepIds } } });
    const deliveries = await prisma.delivery.findMany({
      where: { orderId: { in: ids.orders } },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: deliveries.map((d) => d.id) } } });
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
