/**
 * verify คำถามค้างที่เบสเคาะ 2026-07-06 — integration จริงกับ DB
 * รัน: npm run verify:moneygate · ข้อมูลใช้ marker [MGATE] ลบเกลี้ยงท้ายสคริปต์
 * ครอบ: ⑦ ช่าง/กราฟิกไม่เห็นเงินฝั่งขาย (strip order/customer + gate quotation/creditStatus)
 *       ④ ยกเลิกออเดอร์ที่มีบิลค้าง → เตือน/ต้องยืนยัน · ⑤ convertToOrder ล้าง fee เดิม
 *       ⑥ updateItems/duplicate กันสินค้าที่ลบ
 */
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";
import { currentPeriod } from "@/server/services/document-number";

const MARK = "[MGATE]";
let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    pass++;
    console.log(`PASS: ${name}`);
  } else {
    fails.push(name);
    console.log(`FAIL: ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}
async function expectError(name: string, fn: () => Promise<unknown>, msgPart: string) {
  try {
    await fn();
    check(name, false, "ไม่ throw");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    check(name, msg.includes(msgPart), msg.slice(0, 120));
  }
}

const SEQ_TYPES = ["ORDER", "QUOTATION"];

async function main() {
  // คืนเลขเอกสารท้ายสคริปต์ — script เผาเลข ORDER/QUOTATION จริง (pattern verify-ops)
  const period = currentPeriod();
  const seqBefore = await prisma.documentSequence.findMany({
    where: { period, docType: { in: SEQ_TYPES } },
  });
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const asOwner = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });
  const asSales = appRouter.createCaller({ prisma, userId: owner.id, userRole: "SALES" });
  const asStaff = appRouter.createCaller({ prisma, userId: owner.id, userRole: "PRODUCTION_STAFF" });
  const asDesigner = appRouter.createCaller({ prisma, userId: owner.id, userRole: "DESIGNER" });

  const ids = {
    customers: [] as string[],
    orders: [] as string[],
    quotations: [] as string[],
    invoices: [] as string[],
    products: [] as string[],
  };

  try {
    // ── setup: ลูกค้า + สินค้า(มีสต๊อค) + ออเดอร์มีรายการ ──
    const customer = await prisma.customer.create({
      data: {
        name: `${MARK} ลูกค้าเงินลับ`,
        totalSpent: 12345.67,
        creditLimit: 90000,
      },
    });
    ids.customers.push(customer.id);

    const product = await prisma.product.create({
      data: {
        sku: `MGATE-SKU-${Date.now()}`,
        name: `${MARK} เสื้อทดสอบ`,
        productType: "TSHIRT",
        basePrice: 100,
        variants: {
          create: [{ size: "M", color: "ดำ", sku: `MGATE-VAR-${Date.now()}`, stock: 100, totalStock: 100 }],
        },
      },
      include: { variants: true },
    });
    ids.products.push(product.id);

    const order = await asOwner.order.create({
      customerId: customer.id,
      title: `${MARK} งานพิมพ์ราคาลับ`,
      items: [
        {
          products: [
            {
              productId: product.id,
              productType: "TSHIRT",
              description: `${MARK} เสื้อจากสต๊อก`,
              baseUnitPrice: 200,
              variants: [{ size: "M", color: "ดำ", quantity: 5 }],
            },
          ],
          prints: [],
          addons: [],
        },
      ],
      fees: [{ feeType: "RUSH_FEE", name: "งานด่วน", amount: 150 }],
      discount: 0,
      taxRate: 7,
    });
    ids.orders.push(order.id);

    // บิลค้างจริงบนออเดอร์ (สร้างตรง — เลี่ยงด่านเพดาน ไม่ใช่จุดที่เทส)
    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: `MGATE-INV-${Date.now()}`,
        orderId: order.id,
        customerId: customer.id,
        type: "FINAL_INVOICE",
        amount: 500,
        totalAmount: 500,
        paymentStatus: "UNPAID",
      },
    });
    ids.invoices.push(inv.id);

    // ── ⑦ order.list ──
    const staffList = await asStaff.order.list({ search: MARK, limit: 5 });
    const staffRow = staffList.orders.find((o) => o.id === order.id);
    check(
      "7.1 order.list (ช่าง): totalAmount/invoicedTotal = null · ไม่มี invoices แนบ",
      !!staffRow &&
        staffRow.totalAmount === null &&
        staffRow.invoicedTotal === null &&
        staffRow.subtotalItems === null &&
        Array.isArray(staffRow.invoices) &&
        staffRow.invoices.length === 0,
      staffRow && { t: staffRow.totalAmount, it: staffRow.invoicedTotal }
    );
    check(
      "7.1b order.list (ช่าง): totalCost/profitMargin ปิดด้วย (เดิมรั่วใน list)",
      !!staffRow && Number(staffRow.totalCost) === 0 && staffRow.profitMargin === null,
      staffRow && { c: staffRow.totalCost, m: staffRow.profitMargin }
    );
    const ownerList = await asOwner.order.list({ search: MARK, limit: 5 });
    const ownerRow = ownerList.orders.find((o) => o.id === order.id);
    check(
      "7.2 order.list (เจ้าของ): ตัวเลขครบเหมือนเดิม",
      !!ownerRow && typeof ownerRow.totalAmount === "number" && ownerRow.totalAmount > 0,
      ownerRow?.totalAmount
    );
    // ออเดอร์ใบสองราคาถูกกว่าแต่ใหม่กว่า — ถ้า sort ตามยอดจริง ใบแพง (เก่า) ต้องมาก่อน
    // ถ้าโดนบังคับกลับ createdAt desc ใบใหม่ (ถูก) ต้องมาก่อน (review จับ: เทสเดิม vacuous)
    const cheapNew = await asOwner.order.create({
      customerId: customer.id,
      title: `${MARK} ใบใหม่ราคาถูก`,
      items: [
        {
          products: [
            {
              productType: "TSHIRT",
              description: `${MARK} งานเล็ก`,
              baseUnitPrice: 10,
              variants: [{ size: "M", quantity: 1 }],
            },
          ],
          prints: [],
          addons: [],
        },
      ],
      isDraft: true,
    });
    ids.orders.push(cheapNew.id);
    const sortForced = await asStaff.order.list({
      search: MARK,
      sortBy: "totalAmount",
      sortOrder: "desc",
      limit: 10,
    });
    const mgateSeq = sortForced.orders.filter((o) => [order.id, cheapNew.id].includes(o.id));
    check(
      "7.3 order.list (ช่าง) ขอเรียงตามยอด → โดนบังคับกลับ createdAt (ใบใหม่ราคาถูกมาก่อนใบเก่าราคาแพง)",
      mgateSeq.length === 2 && mgateSeq[0].id === cheapNew.id,
      mgateSeq.map((o) => o.id === cheapNew.id ? "ใหม่ถูก" : "เก่าแพง")
    );
    const sortOwner = await asOwner.order.list({
      search: MARK,
      sortBy: "totalAmount",
      sortOrder: "desc",
      limit: 10,
    });
    const ownerSeq = sortOwner.orders.filter((o) => [order.id, cheapNew.id].includes(o.id));
    check(
      "7.3b order.list (เจ้าของ) เรียงตามยอดได้จริง (ใบแพงมาก่อน)",
      ownerSeq.length === 2 && ownerSeq[0].id === order.id,
      ownerSeq.map((o) => (o.id === order.id ? "เก่าแพง" : "ใหม่ถูก"))
    );

    // ── ⑦ order.getById ──
    const staffOrder = await asStaff.order.getById({ id: order.id });
    const sProd = staffOrder.items[0]?.products[0];
    check(
      "7.4 order.getById (ช่าง): เงินหัวใบ+รายชิ้น+fee+billedFloor = null · โครงงานยังครบ",
      staffOrder.totalAmount === null &&
        staffOrder.subtotalItems === null &&
        sProd?.baseUnitPrice === null &&
        sProd?.subtotal === null &&
        staffOrder.fees[0]?.amount === null &&
        staffOrder.billedFloor === null &&
        staffOrder.items[0]?.products[0]?.variants?.[0]?.quantity === 5,
      { t: staffOrder.totalAmount, p: sProd?.baseUnitPrice, f: staffOrder.fees[0]?.amount }
    );
    const staffInv = staffOrder.invoices.find((i) => i.id === inv.id);
    check(
      "7.5 order.getById (ช่าง): หัวใบบิลอยู่ (type/paymentStatus) แต่ยอด null + payments []",
      !!staffInv &&
        staffInv.totalAmount === null &&
        staffInv.paymentStatus === "UNPAID" &&
        staffInv.payments.length === 0,
      staffInv && { t: staffInv.totalAmount, s: staffInv.paymentStatus }
    );
    const ownerOrder = await asOwner.order.getById({ id: order.id });
    check(
      "7.6 order.getById (เจ้าของ): ตัวเลขครบเหมือนเดิม",
      typeof ownerOrder.totalAmount === "number" &&
        typeof ownerOrder.items[0]?.products[0]?.baseUnitPrice === "number" &&
        typeof ownerOrder.billedFloor === "number",
      ownerOrder.totalAmount
    );

    // ⑦ ช่องอ้อมที่ review จับ: ใบแก้ไข (CO) + revision JSON + ลูกค้าฝังในใบ
    await asOwner.order.updateItems({
      id: order.id,
      discount: 0,
      items: [
        {
          products: [
            {
              productType: "TSHIRT",
              description: `${MARK} แก้รายการให้เกิด revision เงิน`,
              baseUnitPrice: 250,
              variants: [{ size: "M", quantity: 4 }],
            },
          ],
          prints: [],
          addons: [],
        },
      ],
    });
    const staffOrder2 = await asStaff.order.getById({ id: order.id });
    const moneyRevisions = staffOrder2.revisions.filter(
      (r) =>
        r.changeType !== "STATUS" &&
        ((r.oldValue ?? "") + (r.newValue ?? "")).includes("totalAmount")
    );
    check(
      "7.15 order.getById (ช่าง): revision JSON เงิน (updateItems) โดน redact",
      staffOrder2.revisions.length > 0 && moneyRevisions.length === 0,
      { revs: staffOrder2.revisions.length, leaked: moneyRevisions.length }
    );
    check(
      "7.16 order.getById (ช่าง): เงินลูกค้าที่ฝังในใบ (totalSpent/creditLimit) = null",
      staffOrder2.customer.totalSpent === null && staffOrder2.customer.creditLimit === null,
      { s: staffOrder2.customer.totalSpent }
    );
    const staffCos = await asStaff.order.changeOrders({ id: order.id });
    const ownerCos = await asOwner.order.changeOrders({ id: order.id });
    check(
      "7.17 order.changeOrders (ช่าง): ยอดเก่า/ใหม่ = null ทุกใบ (เจ้าของเห็นปกติ)",
      staffCos.every((c) => c.oldTotal === null && c.newTotal === null) &&
        ownerCos.every((c) => c.oldTotal !== null || staffCos.length === 0),
      { staff: staffCos.length, owner: ownerCos.length }
    );

    // ── ⑦ quotation gate ──
    await expectError("7.7 quotation.list (ช่าง) → FORBIDDEN", () => asStaff.quotation.list({}), "สิทธิ์");
    await expectError(
      "7.8 quotation.list (กราฟิก) → FORBIDDEN",
      () => asDesigner.quotation.list({}),
      "สิทธิ์"
    );
    const salesQuotes = await asSales.quotation.list({});
    check("7.9 quotation.list (ขาย) → เปิดได้ปกติ", Array.isArray(salesQuotes.quotations));

    // ── ⑦ customer ──
    const staffCust = await asStaff.customer.list({ search: MARK });
    const staffCustRow = staffCust.customers.find((c) => c.id === customer.id);
    check(
      "7.10 customer.list (ช่าง): totalSpent/creditLimit = null",
      !!staffCustRow && staffCustRow.totalSpent === null && staffCustRow.creditLimit === null,
      staffCustRow && { s: staffCustRow.totalSpent }
    );
    const salesCustRow = (await asSales.customer.list({ search: MARK })).customers.find(
      (c) => c.id === customer.id
    );
    check(
      "7.11 customer.list (ขาย): เห็นยอดจริง (CRM ใช้)",
      !!salesCustRow && Number(salesCustRow.totalSpent) > 12000,
      salesCustRow?.totalSpent
    );
    const staffCustDetail = await asStaff.customer.getById({ id: customer.id });
    check(
      "7.12 customer.getById (ช่าง): เงินลูกค้า+มูลค่าออเดอร์ย้อนหลัง = null",
      staffCustDetail.totalSpent === null &&
        staffCustDetail.creditLimit === null &&
        (staffCustDetail.orders.length === 0 || staffCustDetail.orders[0].totalAmount === null)
    );
    await expectError(
      "7.13 customer.creditStatus (ช่าง) → FORBIDDEN",
      () => asStaff.customer.creditStatus({ customerId: customer.id }),
      "สิทธิ์"
    );
    const credit = await asSales.customer.creditStatus({ customerId: customer.id });
    check("7.14 customer.creditStatus (ขาย) → เปิดได้", credit.creditLimit === 90000, credit.creditLimit);

    // ── ④ ยกเลิกออเดอร์ที่มีบิลค้าง ──
    await expectError(
      "4.1 ยกเลิกออเดอร์ที่มีบิลค้าง (ไม่ยืนยัน) → เตือนพร้อมเลขใบ",
      () => asOwner.order.updateStatus({ id: order.id, internalStatus: "CANCELLED", reason: "ทดสอบ" }),
      "บิลค้างชำระ"
    );
    const cancelled = await asOwner.order.updateStatus({
      id: order.id,
      internalStatus: "CANCELLED",
      reason: "ทดสอบยืนยันข้าม",
      confirmOutstandingBilling: true,
    });
    check("4.2 ยืนยันข้าม (flag) → ยกเลิกได้", cancelled.internalStatus === "CANCELLED");

    // ── ⑤ convertToOrder ล้าง fee เดิม (ออเดอร์เปิดเบา fees ล้วน) ──
    const lightOrder = await asOwner.order.create({
      customerId: customer.id,
      title: `${MARK} เปิดเบา fees ล้วน`,
      items: [],
      fees: [{ feeType: "DESIGN_FEE", name: "ค่าออกแบบตั้งต้น", amount: 999 }],
    });
    ids.orders.push(lightOrder.id);
    const quote = await asOwner.quotation.create({
      customerId: customer.id,
      orderId: lightOrder.id,
      title: `${MARK} ใบเสนอราคาเหมา`,
      validUntil: new Date(Date.now() + 7 * 86400_000).toISOString(),
      discount: 0,
      tax: 0,
      items: [{ name: "งานเหมาทั้งโปรเจกต์", quantity: 1, unit: "งาน", unitPrice: 5000 }],
    });
    ids.quotations.push(quote.id);
    await asOwner.quotation.updateStatus({ id: quote.id, status: "SENT" });
    await asOwner.quotation.updateStatus({ id: quote.id, status: "ACCEPTED" });
    await asOwner.quotation.convertToOrder({ id: quote.id });
    const lightDb = await prisma.order.findUniqueOrThrow({
      where: { id: lightOrder.id },
      include: { fees: true },
    });
    check(
      "5.1 convert ทับออเดอร์เปิดเบา: fee เดิมถูกล้าง + subtotalFees=0 + ยอด=ใบเสนอ",
      lightDb.fees.length === 0 &&
        Number(lightDb.subtotalFees) === 0 &&
        Number(lightDb.totalAmount) === 5000,
      { fees: lightDb.fees.length, sf: lightDb.subtotalFees, t: lightDb.totalAmount }
    );

    // ── ⑥ สินค้าที่ลบ: updateItems / duplicate ──
    const delOrder = await asOwner.order.create({
      customerId: customer.id,
      title: `${MARK} อ้างสินค้าที่จะถูกลบ`,
      items: [
        {
          products: [
            {
              productId: product.id,
              productType: "TSHIRT",
              description: `${MARK} เสื้อจากสต๊อก`,
              baseUnitPrice: 200,
              variants: [{ size: "M", color: "ดำ", quantity: 2 }],
            },
          ],
          prints: [],
          addons: [],
        },
      ],
      isDraft: true,
    });
    ids.orders.push(delOrder.id);
    await prisma.product.update({ where: { id: product.id }, data: { deletedAt: new Date(), isActive: false } });

    // delta-check (review จับ): สินค้าที่อยู่บนออเดอร์อยู่แล้ว (สั่งตอนยังไม่ลบ)
    // แก้รายการต่อได้ ไม่ติดตาย — block เฉพาะ "ใส่ใหม่" บนออเดอร์ที่ไม่เคยอ้าง
    const keptEdit = await asOwner.order.updateItems({
      id: delOrder.id,
      discount: 0,
      items: [
        {
          products: [
            {
              productId: product.id,
              productType: "TSHIRT",
              description: `${MARK} เสื้อจากสต๊อก (คงไว้)`,
              baseUnitPrice: 210,
              variants: [{ size: "M", color: "ดำ", quantity: 3 }],
            },
          ],
          prints: [],
          addons: [],
        },
      ],
    });
    check("6.1a แก้ออเดอร์ที่อ้างสินค้าลบอยู่แล้ว (ตัวเดิม) → ผ่าน (ไม่ติดตาย)", !!keptEdit);
    await expectError(
      "6.1b ใส่สินค้าที่ลบแล้วเป็นตัวใหม่บนออเดอร์อื่น → ปฏิเสธ",
      () =>
        asOwner.order.updateItems({
          id: cheapNew.id,
          discount: 0,
          items: [
            {
              products: [
                {
                  productId: product.id,
                  productType: "TSHIRT",
                  description: `${MARK} แอบใส่ตัวลบ`,
                  baseUnitPrice: 200,
                  variants: [{ size: "M", color: "ดำ", quantity: 2 }],
                },
              ],
              prints: [],
              addons: [],
            },
          ],
        }),
      "ถูกลบไปแล้ว"
    );
    await expectError(
      "6.2 duplicate ออเดอร์ที่อ้างสินค้าที่ลบแล้ว → ปฏิเสธพร้อมชื่อสินค้า",
      () => asOwner.order.duplicate({ id: delOrder.id }),
      "ถูกลบไปแล้ว"
    );
  } finally {
    // ── cleanup ตามลำดับ FK ──
    const dupOrders = await prisma.order.findMany({
      where: { title: { contains: MARK } },
      select: { id: true },
    });
    const orderIds = [...new Set([...ids.orders, ...dupOrders.map((o) => o.id)])];
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entityId: { in: [...orderIds, ...ids.quotations, ...ids.invoices, ...ids.customers] } },
          { newValue: { string_contains: MARK } },
        ],
      },
    });
    await prisma.payment.deleteMany({ where: { invoice: { orderId: { in: orderIds } } } });
    await prisma.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.quotation.deleteMany({ where: { id: { in: ids.quotations } } });
    await prisma.orderRevision.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderFee.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.delivery.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.notification.deleteMany({ where: { entityId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.productVariant.deleteMany({ where: { productId: { in: ids.products } } });
    await prisma.product.deleteMany({ where: { id: { in: ids.products } } });
    await prisma.communicationLog.deleteMany({ where: { customerId: { in: ids.customers } } });
    await prisma.customer.deleteMany({ where: { id: { in: ids.customers } } });
    for (const docType of SEQ_TYPES) {
      const before = seqBefore.find((sq) => sq.docType === docType);
      if (before) {
        await prisma.documentSequence.updateMany({
          where: { docType, period },
          data: { lastNumber: before.lastNumber },
        });
      } else {
        await prisma.documentSequence.deleteMany({ where: { docType, period } });
      }
    }
    await prisma.$disconnect();
  }

  console.log(`\n=== ผล: ผ่าน ${pass} · ตก ${fails.length} ===`);
  if (fails.length > 0) {
    console.log("รายการที่ตก:", fails);
    process.exit(1);
  }
}

main();
