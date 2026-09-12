/** Browser QA fixtures only: prepare → inspect local URLs → expire → cleanup. Never targets shared data. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { validateDemoDatabaseUrl } from "../src/lib/demo-seed-plan";
import { appRouter } from "../src/server/routers/_app";

const prefix = "UI-QA-20260913";
const directory = ".tmp-test/ui-complete-20260913";
const manifestPath = `${directory}/public-fixtures.json`;
const future = () => new Date(Date.now() + 86400000);
const token = () => randomBytes(32).toString("hex");

async function main() {
  validateDemoDatabaseUrl(process.env.DATABASE_URL);
  assert.equal(process.env.ANAJAK_ERP_DEMO_MODE, "1");
  const mode = process.argv[2];
  assert(["prepare", "expire", "cleanup"].includes(mode), "ใช้ prepare, expire หรือ cleanup");
  if (mode !== "prepare") {
    const ids = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, string>;
    assert.equal(ids.prefix, prefix);
    const order = await prisma.order.findUnique({ where: { id: ids.order } });
    assert(order?.orderNumber === prefix, "fixture ไม่ตรง หยุดก่อนเขียน");
    if (mode === "expire") {
      await prisma.$transaction([
        prisma.order.update({ where: { id: ids.order }, data: { statusTokenExpiresAt: new Date(0), uploadTokenExpiresAt: new Date(0) } }),
        prisma.designVersion.updateMany({ where: { orderId: ids.order }, data: { tokenExpiresAt: new Date(0) } }),
        prisma.quotation.update({ where: { id: ids.quotation }, data: { validUntil: new Date(0) } }),
        prisma.outsourceOrder.update({ where: { id: ids.outsource }, data: { shareTokenExpiresAt: new Date(0) } }),
      ]);
    } else {
      await prisma.$transaction(async (tx) => {
        const invoices = await tx.invoice.findMany({ where: { orderId: ids.order }, select: { id: true } });
        const invoiceIds = invoices.map((invoice) => invoice.id);
        const payments = await tx.payment.findMany({
          where: { invoiceId: { in: invoiceIds } },
          select: { id: true },
        });
        const auditEntityIds = [ids.order, ids.quotation, ids.outsource, ids.design,
          ids.customer, ids.vendor, ids.receipt, ids.invoice, ids.note, ids.delivery,
          ...invoiceIds,
          ...payments.map((payment) => payment.id)];
        await tx.billingNote.delete({ where: { id: ids.note } });
        await tx.notification.deleteMany({ where: { entityId: { in: auditEntityIds } } });
        await tx.auditLog.deleteMany({ where: { entityId: { in: auditEntityIds } } });
        await tx.attachment.deleteMany({ where: { entityType: "ORDER", entityId: ids.order } });
        await tx.quotation.delete({ where: { id: ids.quotation } });
        // Linked receipts reference payments with Restrict; remove the fixture's receipts first.
        await tx.invoice.deleteMany({ where: { id: { in: invoiceIds }, forPaymentId: { not: null } } });
        await tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
        await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
        await tx.order.delete({ where: { id: ids.order } });
        await tx.vendor.delete({ where: { id: ids.vendor } });
        await tx.customer.delete({ where: { id: ids.customer } });
        assert.equal(await tx.communicationLog.count({ where: { customerId: ids.customer } }), 0);
        assert.equal(await tx.auditLog.count({ where: { entityId: { in: auditEntityIds } } }), 0);
        assert.equal(await tx.notification.count({ where: { entityId: { in: auditEntityIds } } }), 0);
      });
    }
    console.log(`${mode}: fixture ${prefix} only`);
    return;
  }
  assert.equal(await prisma.order.count({ where: { orderNumber: prefix } }), 0, "fixture ยังอยู่ ให้ cleanup ก่อน");
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  await mkdir(directory, { recursive: true });
  const ids = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({ data: { name: "ลูกค้าทดสอบหน้าจอ", company: "บริษัท ตัวอย่าง จำกัด", phone: "0800000000", taxId: "0000000000000", billingAddress: "99 ถนนตัวอย่าง กรุงเทพฯ 10110" } });
    const order = await tx.order.create({ data: {
      orderNumber: prefix, orderType: "CUSTOM", channel: "LINE", customerId: customer.id, createdById: owner.id,
      internalStatus: "DESIGNING", customerStatus: "PREPARING", deadline: future(), subtotalItems: 1200, taxRate: 7, taxAmount: 84, totalAmount: 1284,
      statusToken: token(), statusTokenExpiresAt: future(), uploadToken: token(), uploadTokenExpiresAt: future(),
      items: { create: [{ description: "เสื้อทีมงานตัวอย่าง", totalQuantity: 12, subtotal: 1200, products: { create: [{ productType: "T_SHIRT", description: "เสื้อคอกลมสีดำ", baseUnitPrice: 100, totalQuantity: 12, subtotal: 1200, itemSource: "CUSTOM_MADE", variants: { create: [{ size: "M", color: "ดำ", quantity: 5 }, { size: "L", color: "ดำ", quantity: 7 }] } }] } }] },
      productions: { create: [{ steps: { create: [{ stepType: "SCREEN_PRINTING", sortOrder: 0 }, { stepType: "PACKAGING", sortOrder: 1 }] } }] },
    }, include: { productions: { include: { steps: true } } } });
    const originalArt = await tx.designVersion.findFirst({ where: { orderId: { startsWith: "demo-order-" } }, select: { fileUrl: true } });
    assert(originalArt, "ต้องมีภาพแบบจาก demo seed");
    const design = await tx.designVersion.create({ data: { orderId: order.id, versionNumber: 1, fileUrl: originalArt.fileUrl, approvalToken: token(), tokenExpiresAt: future() } });
    const quotation = await tx.quotation.create({ data: { quotationNumber: `${prefix}-QT`, customerId: customer.id, createdById: owner.id, status: "SENT", sentAt: new Date(), validUntil: future(), subtotal: 1200, discount: 0, tax: 84, totalAmount: 1284, confirmToken: token(), terms: "ชำระก่อนเริ่มผลิต", items: { create: [{ name: "เสื้อทีมงานตัวอย่าง", quantity: 12, unit: "ตัว", unitPrice: 100, totalPrice: 1200 }] } } });
    const receipt = await tx.invoice.create({ data: { invoiceNumber: `${prefix}-REC`, orderId: order.id, customerId: customer.id, type: "RECEIPT", amount: 1200, discount: 0, tax: 84, totalAmount: 1284, paymentStatus: "PAID", paidAt: new Date(), payments: { create: [{ amount: 1284, method: "BANK_TRANSFER", reference: "DEMO-ONLY" }] } } });
    const invoice = await tx.invoice.create({ data: { invoiceNumber: `${prefix}-INV`, orderId: order.id, customerId: customer.id, type: "FINAL_INVOICE", amount: 1200, discount: 0, tax: 84, totalAmount: 1284, dueDate: future() } });
    const note = await tx.billingNote.create({ data: { billingNoteNumber: `${prefix}-BN`, customerId: customer.id, totalAmount: 1284, dueDate: future(), items: { create: [{ invoiceId: invoice.id, amount: 1284 }] } } });
    const delivery = await tx.delivery.create({ data: { orderId: order.id, recipientName: "ผู้รับทดสอบ", phone: "0800000000", address: "99 ถนนตัวอย่าง", province: "กรุงเทพฯ", postalCode: "10110", shippingMethod: "PICKUP", lines: { create: [{ description: "เสื้อทีมงานตัวอย่าง", size: "M", color: "ดำ", qty: 5 }, { description: "เสื้อทีมงานตัวอย่าง", size: "L", color: "ดำ", qty: 7 }] } } });
    const vendor = await tx.vendor.create({ data: { name: "ร้านนอกทดสอบหน้าจอ", capabilities: ["SCREEN_PRINTING"] } });
    const step = order.productions[0].steps.find((s) => s.stepType === "SCREEN_PRINTING")!;
    const outsource = await tx.outsourceOrder.create({ data: { productionStepId: step.id, vendorId: vendor.id, description: "พิมพ์เสื้อทีมงานตัวอย่าง", quantity: 12, unitCost: 10, totalCost: 120, status: "SENT", sentAt: new Date(), expectedBackAt: future(), shareToken: token(), shareTokenExpiresAt: future() } });
    const manifest = { prefix, customer: customer.id, order: order.id, design: design.id, quotation: quotation.id, receipt: receipt.id, invoice: invoice.id, note: note.id, delivery: delivery.id, vendor: vendor.id, outsource: outsource.id, statusToken: order.statusToken!, uploadToken: order.uploadToken!, designToken: design.approvalToken!, quoteToken: quotation.confirmToken!, jobToken: outsource.shareToken! };
    // A failed manifest write rolls the fixture back; failed sanity calls still have a cleanup manifest.
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });
    return manifest;
  });
  const caller = appRouter.createCaller({ prisma, userId: null, userRole: null });
  await Promise.all([caller.customerStatus.getStatus({ token: ids.statusToken }), caller.customerUpload.getInfo({ token: ids.uploadToken }), caller.design.getByToken({ token: ids.designToken }), caller.quotationConfirm.getQuote({ token: ids.quoteToken }), caller.outsourceShare.getByToken({ token: ids.jobToken })]);
  console.log(`Prepared 5 public links and 5 print documents: ${manifestPath}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
