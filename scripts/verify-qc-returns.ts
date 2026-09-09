/** Local-only integration: returned pieces retain shipment history and get a fresh exact QC scope. */
import { prisma } from "@/lib/prisma";
import { appRouter } from "@/server/routers/_app";
import { workOrderStandards } from "@/lib/work-order-standards";

import { validateDemoDatabaseUrl } from "@/lib/demo-seed-plan";
validateDemoDatabaseUrl(process.env.DATABASE_URL);

const MARK = "[QC-RETURN-VERIFY]";
let passed = 0;
function check(label: string, ok: boolean) { if (!ok) throw new Error(`FAIL: ${label}`); console.log(`PASS: ${label}`); passed++; }
async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const caller = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });
  const customer = await prisma.customer.create({ data: { name: MARK } });
  try {
    const order = await prisma.order.create({ data: {
      orderNumber: `QC-RETURN-${Date.now()}`, notes: MARK, customerId: customer.id, createdById: owner.id,
      internalStatus: "QUALITY_CHECK", items: { create: [{ description: MARK, totalQuantity: 10,
        products: { create: [{ productType: "TSHIRT", description: MARK, baseUnitPrice: 0,
          variants: { create: [{ size: "M", color: "ดำ", quantity: 6 }, { size: "L", color: "ดำ", quantity: 4 }] } }] } }] },
      productions: { create: [{ status: "COMPLETED", steps: { create: [{ sortOrder: 0, stepType: "HEAT_PRESS", status: "COMPLETED", qtyTotal: 10, qtyDone: 10 }] } }] },
    } });
    await caller.qc.create({ orderId: order.id, idempotencyKey: "return-initial-qc", qtyGood: 10, defects: [] });
    const createParcel = (size: string, qty: number) => caller.delivery.create({ orderId: order.id,
      recipientName: "ผู้รับทดสอบ", phone: "0812345678", address: "1 ทดสอบ", shippingMethod: "PICKUP",
      lines: [{ description: MARK, size, color: "ดำ", qty }] });
    const first = await createParcel("M", 6);
    const second = await createParcel("L", 4);
    for (const parcel of [first, second]) {
      await caller.delivery.updateStatus({ id: parcel.id, status: "PREPARING" });
      await caller.delivery.updateStatus({ id: parcel.id, status: "SHIPPED" });
      await caller.delivery.updateStatus({ id: parcel.id, status: "DELIVERED" });
    }
    await caller.delivery.updateStatus({ id: second.id, status: "RETURNED" });
    await createParcel("L", 4).then(() => check("ห้ามส่งของคืนก่อนตรวจ", false), (error) => check("ห้ามส่งของคืนก่อนตรวจ", String(error.message).includes("ยังไม่ตรวจ QC")));
    await caller.order.updateStatus({ id: order.id, internalStatus: "QUALITY_CHECK", reason: "ลูกค้าคืนกล่อง L พบพิมพ์ลอก" });
    const context = await caller.qc.context({ orderId: order.id });
    check("คืนกล่อง L4 → ตรวจรอบใหม่0/4 และไม่ดึงกล่อง M6 มานับซ้ำ", context.totalExpected === 4 && context.checkedGood === 0 && context.lines.length === 1 && context.lines[0].size === "L");
    await caller.order.updateStatus({ id: order.id, internalStatus: "PACKING" }).then(
      () => check("ผลดีเก่าห้ามพาข้ามQCรับคืน", false), (error) => check("ผลดีเก่าห้ามพาข้ามQCรับคืน", String(error.message).includes("ตรวจนับ")));
    await caller.qc.create({ orderId: order.id, idempotencyKey: "return-inspect-damaged", qtyGood: 3,
      defects: [{ variantId: context.lines[0].variantId, size: "L", color: "ดำ", qty: 1, reason: "PRINT_PEEL" }] });
    const repair = await prisma.productionStep.findFirstOrThrow({ where: { production: { orderId: order.id }, stepType: "CUSTOM" }, include: { quantities: true } });
    check("รับคืน4พบดี3เสีย1 → เปิดงานแก้เฉพาะ L1", repair.qtyTotal === 1 && repair.quantities.length === 1 && repair.quantities[0].size === "L");
    await caller.production.updateStep({ stepId: repair.id, status: "IN_PROGRESS" });
    for (const item of workOrderStandards("CUSTOM")) await caller.production.tickStandard({ stepId: repair.id, item, checked: true });
    await caller.production.reportPieceQty({ stepId: repair.id, rows: [{ variantId: context.lines[0].variantId, done: 1, waste: 0 }] });
    await caller.production.updateStep({ stepId: repair.id, status: "COMPLETED" });
    await caller.qc.create({ orderId: order.id, idempotencyKey: "return-inspect-fixed", qtyGood: 1, defects: [] });
    const repaired = await caller.qc.context({ orderId: order.id });
    check("แก้L1→ตรวจซ้ำรวม4→แพ็ก และยอดดีเดิม10ไม่รวม", repaired.checkedGood === 4 && repaired.internalStatus === "PACKING");
    const original = await prisma.delivery.findUniqueOrThrow({ where: { id: first.id }, include: { lines: true } });
    check("กล่องM6ยังDELIVEREDและเก็บจำนวนส่งเดิม", original.status === "DELIVERED" && original.lines[0].qty === 6);
    const replacement = await createParcel("L", 4);
    for (const status of ["PREPARING", "SHIPPED", "DELIVERED"] as const) await caller.delivery.updateStatus({ id: replacement.id, status });
    await caller.delivery.updateStatus({ id: second.id, status: "PREPARING" }).then(() => check("ใบคืนเดิมห้ามเปิดซ้ำ", false), () => check("ใบคืนเดิมห้ามเปิดซ้ำ", true));
    await caller.qc.startReturnInspection({ orderId: order.id, reason: "คืนMบางตัวจากกล่อง6", returnedLines: [{ deliveryLineId: original.lines[0].id, qty: 2 }] });
    const partial = await caller.qc.context({ orderId: order.id });
    check("คืนM2จากกล่อง6 → เริ่ม0/2เฉพาะM", partial.totalExpected === 2 && partial.checkedGood === 0 && partial.lines.length === 1 && partial.lines[0].size === "M");
    const packing = await caller.delivery.packContext({ orderId: order.id });
    check("ของที่ลูกค้าเก็บ M4+L4 ยังนับส่งแล้ว คืนเฉพาะM2", packing.totalRemaining === 2 && packing.lines.find((line) => line.size === "M")?.packed === 4 && packing.lines.find((line) => line.size === "L")?.packed === 4);
    await caller.qc.startReturnInspection({ orderId: order.id, reason: "กดซ้ำ", returnedLines: [{ deliveryLineId: original.lines[0].id, qty: 2 }] }).then(() => check("ห้ามเปิดรอบคืนทับQCที่ยังไม่จบ", false), () => check("ห้ามเปิดรอบคืนทับQCที่ยังไม่จบ", true));
    await caller.qc.create({ orderId: order.id, idempotencyKey: "return-wrong-variant", qtyGood: 2, goodLines: [{ variantId: context.lines[0].variantId, qtyGood: 2 }], defects: [] }).then(
      () => check("Lที่ไม่คืนห้ามนับดีแทนM", false), () => check("Lที่ไม่คืนห้ามนับดีแทนM", true));
    await caller.qc.create({ orderId: order.id, idempotencyKey: "return-partial-good", qtyGood: 2, defects: [] });
    const recordIds = await prisma.qcRecord.findMany({ where: { orderId: order.id }, select: { id: true } });
    await prisma.auditLog.deleteMany({ where: { entityType: "QC_RECORD", entityId: { in: recordIds.map((record) => record.id) } } });
    check("ล้างauditแล้วหลักฐานQCรายไซซ์ยังคงครบ2", (await caller.qc.context({ orderId: order.id })).checkedGood === 2);
    await createParcel("M", 3).then(() => check("ใบส่งทดแทนเกินจำนวนคืนโดนกัน", false), (error) => check("ใบส่งทดแทนเกินจำนวนคืนโดนกัน", String(error.message).includes("แพ็คเกิน")));
    const partialReplacement = await createParcel("M", 2);
    for (const status of ["PREPARING", "SHIPPED", "DELIVERED"] as const) await caller.delivery.updateStatus({ id: partialReplacement.id, status });
    check("ส่งทดแทนM2แล้วงานจบSHIPPEDครบ10", (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).internalStatus === "SHIPPED");
    const retained = await prisma.delivery.findUniqueOrThrow({ where: { id: first.id }, include: { lines: true } });
    check("partialคืนไม่แก้ประวัติกล่องMเดิม6", retained.status === "DELIVERED" && retained.lines[0].qty === 6);
    await caller.qc.startReturnInspection({ orderId: order.id, reason: "คืนเกินที่ยังอยู่กับลูกค้า", returnedLines: [{ deliveryLineId: original.lines[0].id, qty: 5 }] }).then(
      () => check("คืนซ้ำเกินM4ที่ยังอยู่กับลูกค้าโดนกัน", false), () => check("คืนซ้ำเกินM4ที่ยังอยู่กับลูกค้าโดนกัน", true));
    const nextReturnLine = await prisma.deliveryLine.findFirstOrThrow({ where: { deliveryId: partialReplacement.id } });
    await caller.qc.startReturnInspection({ orderId: order.id, reason: "คืนA1ก่อน", returnedLines: [{ deliveryLineId: nextReturnLine.id, qty: 1 }] });
    await caller.delivery.updateStatus({ id: first.id, status: "RETURNED" });
    await caller.qc.create({ orderId: order.id, idempotencyKey: "return-a-while-b-arrives", qtyGood: 1, defects: [] });
    check("Bคืนระหว่างตรวจA → ตรวจAครบยังอยู่PACKING", (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).internalStatus === "PACKING");
    await caller.qc.startReturnInspection({ orderId: order.id, reason: "ตรวจB4ต่อก่อนส่งA", returnedLines: [{ deliveryLineId: original.lines[0].id, qty: 4 }] });
    check("เปิดรอบBจากPACKINGได้ไม่ต้องส่งAก่อน", (await caller.qc.context({ orderId: order.id })).totalExpected === 4);
    await caller.qc.create({ orderId: order.id, idempotencyKey: "return-b-inspected", qtyGood: 4, defects: [] });
    check("ตรวจA1และB4แล้วเหลือแพ็ก5 ไม่ทำของดีAหาย", (await caller.delivery.packContext({ orderId: order.id })).totalRemaining === 5);
    const lastReplacement = await createParcel("M", 5);
    for (const status of ["PREPARING", "SHIPPED", "DELIVERED"] as const) await caller.delivery.updateStatus({ id: lastReplacement.id, status });
    check("ส่งของคืนสองรอบรวม5ครบกลับSHIPPED", (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).internalStatus === "SHIPPED");
    const dto = await caller.delivery.getByOrderId({ orderId: order.id });
    check("DTOกล่องเดิมคงส่ง6แต่ระบุรับคืน6/ลูกค้าเหลือ0", dto.find((delivery) => delivery.id === first.id)?.qtyReturned === 6 && dto.find((delivery) => delivery.id === first.id)?.lines[0].qty === 6);
  } finally {
    const orders = await prisma.order.findMany({ where: { customerId: customer.id }, select: { id: true } });
    const ids = orders.map((row) => row.id);
    const records = await prisma.qcRecord.findMany({ where: { orderId: { in: ids } }, select: { id: true } });
    const steps = await prisma.productionStep.findMany({ where: { production: { orderId: { in: ids } } }, select: { id: true } });
    const deliveries = await prisma.delivery.findMany({ where: { orderId: { in: ids } }, select: { id: true } });
    await prisma.notification.deleteMany({ where: { OR: [{ entityId: { in: ids } }, { title: { contains: "QC-RETURN-" } }] } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: [...ids, ...records.map((r) => r.id), ...steps.map((s) => s.id), ...deliveries.map((d) => d.id)] } } });
    await prisma.qcRecord.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.production.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.$disconnect();
  }
  console.log(`Passed ${passed} return checks`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
