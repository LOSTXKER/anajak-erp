/**
 * verify ใบแก้ไขออเดอร์ (ก้อน 6 ชิ้น 3) — integration จริงกับ DB
 * รัน: npm run verify:co   (ต้อง migrate ตาราง change_orders ก่อน)
 * เน้น: ล็อกที่ DESIGN_APPROVED (updateItems/updateFees ตรงไม่ได้) · gate salesUp ·
 *   reason บังคับ · applyChangeOrder recompute ยอด + ออกเลข CO + บันทึก ChangeOrder/Revision ·
 *   PRODUCING ออกใบแก้ไขไม่ได้ · สถานะแก้ได้ (DESIGNING) updateItems ยังทำงาน
 * ข้อมูลใช้ marker [CO-VERIFY] ลบเกลี้ยงท้ายสคริปต์
 */
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";

const MARK = "[CO-VERIFY]";
let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; console.log(`PASS: ${name}`); }
  else { fails.push(name); console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`); }
}
async function expectThrow(fn: () => Promise<unknown>): Promise<boolean> {
  try { await fn(); return false; } catch { return true; }
}

// item ขั้นต่ำที่ผ่าน schema: เสื้อ 20 ตัว × 100 = 2000
const ITEM = {
  products: [
    { productType: "TSHIRT", description: `${MARK} เสื้อ`, baseUnitPrice: 100, variants: [{ size: "M", quantity: 20 }] },
  ],
  prints: [],
  addons: [],
};
const FEE = { feeType: "OTHER", name: `${MARK} ค่าจัดส่ง`, amount: 50 };

async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const ownerCaller = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });
  const staffCaller = appRouter.createCaller({ prisma, userId: owner.id, userRole: "PRODUCTION_STAFF" });

  let customer: { id: string } | null = null;
  let order: { id: string } | null = null;
  let order2: { id: string } | null = null;
  let order3: { id: string } | null = null;

  const getOrder = (id: string) =>
    prisma.order.findUniqueOrThrow({ where: { id }, include: { fees: true } });

  try {
    customer = await prisma.customer.create({ data: { name: `${MARK} ลูกค้า`, customerType: "INDIVIDUAL" } });
    // ออเดอร์อนุมัติแบบแล้ว: subtotal 1000 + 7% = 1070
    order = await prisma.order.create({
      data: {
        orderNumber: `TEST-CO-${Date.now()}`,
        title: `${MARK} งาน`,
        customerId: customer.id,
        createdById: owner.id,
        orderType: "CUSTOM",
        internalStatus: "DESIGN_APPROVED",
        customerStatus: "PREPARING",
        subtotalItems: 1000,
        taxRate: 7,
        discount: 0,
        totalAmount: 1070,
      },
    });

    // ── 1. ล็อกที่อนุมัติแบบ — แก้ตรงไม่ได้ ──
    check("1.1 updateItems ตรงโดน block (อนุมัติแล้ว)",
      await expectThrow(() => ownerCaller.order.updateItems({ id: order!.id, items: [ITEM], discount: 0 })));
    check("1.2 updateFees ตรงโดน block (อนุมัติแล้ว)",
      await expectThrow(() => ownerCaller.order.updateFees({ id: order!.id, fees: [FEE] })));

    // ── 2. gate + reason ──
    check("2.1 PRODUCTION_STAFF ออกใบแก้ไขไม่ได้ (salesUp)",
      await expectThrow(() => staffCaller.order.applyChangeOrder({ id: order!.id, items: [ITEM], fees: [], discount: 0, reason: "x" })));
    check("2.2 reason ว่าง → ถูกปฏิเสธ (บังคับกรอก)",
      await expectThrow(() => ownerCaller.order.applyChangeOrder({ id: order!.id, items: [ITEM], fees: [], discount: 0, reason: "   " })));

    // ── 3. applyChangeOrder สำเร็จ — recompute + เลข CO ──
    const res = await ownerCaller.order.applyChangeOrder({
      id: order.id, items: [ITEM], fees: [FEE], discount: 0, reason: "ลูกค้าเพิ่มจำนวน",
    });
    check("3.1 ได้เลขใบแก้ไข CO-*", typeof res.changeNumber === "string" && res.changeNumber.startsWith("CO-"), res.changeNumber);
    check("3.2 oldTotal = 1070", Number(res.oldTotal) === 1070, String(res.oldTotal));
    // (2000 + 50) * 1.07 = 2193.5
    check("3.3 newTotal = 2193.5", Number(res.newTotal) === 2193.5, String(res.newTotal));
    const o3 = await getOrder(order.id);
    check("3.4 order.totalAmount อัปเป็น 2193.5", Number(o3.totalAmount) === 2193.5, String(o3.totalAmount));
    check("3.5 subtotalItems = 2000", Number(o3.subtotalItems) === 2000, String(o3.subtotalItems));
    check("3.6 subtotalFees = 50", Number(o3.subtotalFees) === 50, String(o3.subtotalFees));

    // ── 4. บันทึก ChangeOrder + OrderRevision ──
    const co = await prisma.changeOrder.findFirst({ where: { orderId: order.id } });
    check("4.1 มีแถว ChangeOrder", !!co && co.changeNumber === res.changeNumber);
    check("4.2 ChangeOrder เก็บ old→new ถูก", !!co && Number(co.oldTotal) === 1070 && Number(co.newTotal) === 2193.5);
    const rev = await prisma.orderRevision.findFirst({ where: { orderId: order.id, changeType: "CHANGE_ORDER" } });
    check("4.3 OrderRevision changeType CHANGE_ORDER", !!rev);

    // ── 5. PRODUCING — เลยขั้น ออกใบแก้ไขไม่ได้ ──
    await prisma.order.update({ where: { id: order.id }, data: { internalStatus: "PRODUCING" } });
    check("5.1 PRODUCING applyChangeOrder ถูก block",
      await expectThrow(() => ownerCaller.order.applyChangeOrder({ id: order!.id, items: [ITEM], fees: [], discount: 0, reason: "y" })));
    check("5.2 PRODUCING updateItems ก็ยัง block",
      await expectThrow(() => ownerCaller.order.updateItems({ id: order!.id, items: [ITEM], discount: 0 })));

    // ── 6. สถานะแก้ได้ (DESIGNING) — updateItems ตรงยังทำงาน (ล็อกไม่ over-block) ──
    order2 = await prisma.order.create({
      data: {
        orderNumber: `TEST-CO2-${Date.now()}`,
        title: `${MARK} งาน2`,
        customerId: customer.id,
        createdById: owner.id,
        orderType: "CUSTOM",
        internalStatus: "DESIGNING",
        customerStatus: "PREPARING",
        subtotalItems: 0,
        taxRate: 7,
        discount: 0,
        totalAmount: 0,
      },
    });
    await ownerCaller.order.updateItems({ id: order2.id, items: [ITEM], discount: 0 });
    const o6 = await getOrder(order2.id);
    check("6.1 DESIGNING updateItems ตรงสำเร็จ (2000*1.07=2140)", Number(o6.totalAmount) === 2140, String(o6.totalAmount));
    const co6 = await prisma.changeOrder.count({ where: { orderId: order2.id } });
    check("6.2 แก้ตรง (ไม่ล็อก) ไม่ออกใบแก้ไข", co6 === 0);

    // ── 7. เพดานขาที่สอง (B9): CO ลดยอดต่ำกว่าบิลที่ออกแล้ว = "เตือน ไม่ block" โดยเจตนา ──
    // อย่าเปลี่ยนเป็น block: เคสจริง "ลดงานหลังรับมัดจำ+ออกใบกำกับ" เงินรับถูกกฎหมาย
    // void ใบไม่ได้ · CN อ้างใบเสร็จไม่ลด floor → block = ทางตันถาวร
    // ทางที่ถูก: CO แล้วออกใบลดหนี้/คืนเงินตาม (ธง invoicedWarning + UI เตือน)
    await prisma.order.update({
      where: { id: order2.id },
      data: { internalStatus: "DESIGN_APPROVED" },
    });
    await prisma.invoice.create({
      data: {
        invoiceNumber: `TEST-INV-CO-B9-${Date.now()}`,
        orderId: order2.id,
        customerId: customer.id,
        type: "DEPOSIT_INVOICE",
        amount: 1000,
        totalAmount: 1000,
      },
    });
    const SMALL_ITEM = {
      products: [
        { productType: "TSHIRT", description: `${MARK} เสื้อเล็ก`, baseUnitPrice: 100, variants: [{ size: "M", quantity: 5 }] },
      ],
      prints: [],
      addons: [],
    };
    const resB9 = await ownerCaller.order.applyChangeOrder({
      id: order2.id, items: [SMALL_ITEM], fees: [], discount: 0, reason: "ลูกค้าลดจำนวนหลังวางมัดจำ",
    });
    check("7.1 CO ลดยอดต่ำกว่าบิล (535 < มัดจำ 1000) → ผ่าน ไม่ block (โดยเจตนา)",
      Number(resB9.newTotal) === 535, String(resB9.newTotal));
    check("7.2 invoicedWarning ติดธง — UI เตือนให้ออกใบลดหนี้ตาม", resB9.invoicedWarning === true);

    // ── 8. B10: ON_HOLD ถอดจาก editable — แก้ตรงไม่ได้ ต้องปลดพักก่อน ──
    order3 = await prisma.order.create({
      data: {
        orderNumber: `TEST-CO3-${Date.now()}`,
        title: `${MARK} งานพัก`,
        customerId: customer.id,
        createdById: owner.id,
        orderType: "CUSTOM",
        internalStatus: "CONFIRMED",
        customerStatus: "ORDER_RECEIVED",
        subtotalItems: 1000,
        taxRate: 0,
        discount: 0,
        totalAmount: 1000,
      },
    });
    await ownerCaller.order.updateStatus({ id: order3.id, internalStatus: "ON_HOLD" });
    check("8.1 ON_HOLD updateItems ตรงโดน block (ต้องปลดพัก)",
      await expectThrow(() => ownerCaller.order.updateItems({ id: order3!.id, items: [ITEM], discount: 0 })));
    check("8.2 ON_HOLD updateFees ตรงโดน block",
      await expectThrow(() => ownerCaller.order.updateFees({ id: order3!.id, fees: [FEE] })));
    check("8.3 ON_HOLD แก้เงิน (discount) ผ่าน order.update โดน block",
      await expectThrow(() => ownerCaller.order.update({ id: order3!.id, discount: 100 })));
    check("8.4 ON_HOLD ออกใบแก้ไข (CO) ไม่ได้ (canIssueChangeOrder=false — ต้องปลดพัก)",
      await expectThrow(() => ownerCaller.order.applyChangeOrder({ id: order3!.id, items: [ITEM], fees: [], discount: 0, reason: "z" })));
    check("8.4b ON_HOLD คิดค่าแก้แบบ (addRevisionFee ดันยอด) โดน block — ต้องปลดพัก",
      await expectThrow(() => ownerCaller.order.addRevisionFee({ id: order3!.id })));
    // แก้เงินพร้อม field อื่น (dialog เดิมแนบ discount+taxRate เสมอ) → touchesMoney โดน block
    check("8.5a ON_HOLD update ที่แตะเงิน (discount+notes) โดน block ทั้งใบ",
      await expectThrow(() => ownerCaller.order.update({ id: order3!.id, discount: 0, notes: `${MARK} x` })));
    // field ที่ไม่ใช่เงินล้วน (dialog ตัด money fields ตอนล็อก) — บันทึกผ่าน ไม่โดน lock guard
    await ownerCaller.order.update({
      id: order3.id,
      notes: `${MARK} หมายเหตุตอนพัก`,
      shippingAddress: `${MARK} ที่อยู่ใหม่`,
    });
    const o8n = await getOrder(order3.id);
    check("8.5b ON_HOLD แก้ field ที่ไม่ใช่เงินล้วน (notes/ที่อยู่) ยังได้",
      o8n.notes === `${MARK} หมายเหตุตอนพัก` && o8n.shippingAddress === `${MARK} ที่อยู่ใหม่`);
    // ปลดพัก → CONFIRMED → แก้รายการได้ตามปกติ (กติกากลับมาตามสถานะที่กลับไป)
    await ownerCaller.order.updateStatus({ id: order3.id, internalStatus: "CONFIRMED" });
    await ownerCaller.order.updateItems({ id: order3.id, items: [ITEM], discount: 0 });
    const o8 = await getOrder(order3.id);
    check("8.6 ปลดพักแล้ว updateItems ตรงได้ (subtotalItems 2000)", Number(o8.subtotalItems) === 2000, String(o8.subtotalItems));
  } finally {
    // cleanup — order delete cascade ลบ items/fees/revisions/changeOrders
    // (invoice/audit/notification ไม่ cascade — ลบเองก่อน กันตกค้างแบบหนี้ B4)
    const coOrderIds = [order?.id, order2?.id, order3?.id].filter((x): x is string => !!x);
    await prisma.invoice.deleteMany({ where: { orderId: { in: coOrderIds } } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { entityId: { in: coOrderIds } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { entityId: { in: coOrderIds } } }).catch(() => {});
    if (order) await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
    if (order2) await prisma.order.delete({ where: { id: order2.id } }).catch(() => {});
    if (order3) await prisma.order.delete({ where: { id: order3.id } }).catch(() => {});
    if (customer) await prisma.customer.delete({ where: { id: customer.id } }).catch(() => {});
  }

  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) { console.log("FAILED:", fails.join(" · ")); process.exit(1); }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
