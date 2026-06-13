/**
 * verify ลิงก์สถานะออเดอร์ให้ลูกค้า (ก้อน 4 — portal ขั้น 1) — integration จริงกับ DB
 * รัน: npm run verify:status
 * เน้น: **กันรั่วข้อมูลภายใน** (ต้นทุน/กำไร/internalStatus/notes/ราคาแยก) + โชว์ของลูกค้าครบ
 *   (สถานะ/steps/แบบอนุมัติ+token/ใบเสนอ/ใบแจ้งหนี้/พัสดุ/blindShip) + gate + หมดอายุ
 * ข้อมูลใช้ marker [STATUS-VERIFY] ลบเกลี้ยงท้ายสคริปต์
 */
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";
import { FILE_PROXY_PREFIX } from "@/lib/file-urls";

const MARK = "[STATUS-VERIFY]";
let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; console.log(`PASS: ${name}`); }
  else { fails.push(name); console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`); }
}
async function expectThrow(fn: () => Promise<unknown>): Promise<boolean> {
  try { await fn(); return false; } catch { return true; }
}

async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const ownerCaller = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });
  const staffCaller = appRouter.createCaller({ prisma, userId: owner.id, userRole: "PRODUCTION_STAFF" });
  const publicCaller = appRouter.createCaller({ prisma, userId: null as never, userRole: null as never });

  let customer: { id: string } | null = null;
  let order: { id: string; orderNumber: string } | null = null;

  try {
    customer = await prisma.customer.create({
      data: { name: `${MARK} ลูกค้าทดสอบ`, customerType: "INDIVIDUAL" },
    });
    order = await prisma.order.create({
      data: {
        orderNumber: `TEST-STATUS-${Date.now()}`,
        title: `${MARK} งานทดสอบสถานะ`,
        customerId: customer.id,
        createdById: owner.id,
        internalStatus: "PRODUCING",
        customerStatus: "IN_PRODUCTION",
        deadline: new Date(Date.now() + 7 * 86400000),
        // ค่าภายในที่ "ต้องไม่รั่ว"
        totalAmount: 5000,
        totalCost: 1234,
        profitMargin: 60,
        taxAmount: 327,
        discount: 100,
        notes: "โน้ตภายในห้ามรั่ว",
        paymentTerms: "NET_30",
      },
    });
    const designFileUrl = `${FILE_PROXY_PREFIX}designs/orders/${order.id}/approved.png`;
    await prisma.designVersion.create({
      data: {
        orderId: order.id,
        versionNumber: 1,
        fileUrl: designFileUrl,
        approvalStatus: "APPROVED",
      },
    });
    await prisma.quotation.create({
      data: {
        quotationNumber: `QT-STATUS-${Date.now()}`,
        orderId: order.id,
        customerId: customer.id,
        createdById: owner.id,
        status: "ACCEPTED",
        sentAt: new Date(), // ส่งลูกค้าแล้ว → ต้องโผล่
        title: `${MARK} ใบเสนอ`,
        validUntil: new Date(Date.now() + 14 * 86400000),
        subtotal: 4673,
        discount: 100,
        tax: 327,
        totalAmount: 5000,
        items: { create: [{ name: "เสื้อสกรีน", quantity: 100, unit: "ตัว", unitPrice: 50, totalPrice: 5000 }] },
      },
    });
    // ใบร่าง DRAFT (sentAt = null) — ราคาภายในที่ยังไม่ส่ง → ต้อง "ไม่โผล่" บนหน้า public
    await prisma.quotation.create({
      data: {
        quotationNumber: `QT-DRAFT-${Date.now()}`,
        orderId: order.id,
        customerId: customer.id,
        createdById: owner.id,
        status: "DRAFT",
        title: `${MARK} ร่างห้ามรั่ว`,
        validUntil: new Date(Date.now() + 14 * 86400000),
        subtotal: 9999,
        totalAmount: 9999,
      },
    });
    await prisma.invoice.create({
      data: {
        invoiceNumber: `IV-STATUS-${Date.now()}`,
        orderId: order.id,
        customerId: customer.id,
        type: "FINAL_INVOICE",
        amount: 4673,
        discount: 100,
        tax: 327,
        totalAmount: 5000,
        paymentStatus: "PAID",
        dueDate: new Date(Date.now() + 30 * 86400000),
      },
    });
    await prisma.delivery.create({
      data: {
        orderId: order.id,
        recipientName: "คุณทดสอบ",
        phone: "0800000000",
        address: "123 ถนนทดสอบ",
        province: "กรุงเทพ",
        shippingMethod: "J_AND_T",
        trackingNumber: "JT123456789",
        status: "SHIPPED",
        shippedAt: new Date(),
        shippingCost: 50,
        lines: { create: [{ description: "เสื้อสกรีน", size: "M", color: "ดำ", qty: 100 }] },
      },
    });

    // ── 1. gate + token ──
    const blocked = await expectThrow(() => staffCaller.customerStatus.generateLink({ orderId: order!.id }));
    check("1.1 PRODUCTION_STAFF สร้างลิงก์ไม่ได้ (FORBIDDEN)", blocked);
    const link = await ownerCaller.customerStatus.generateLink({ orderId: order.id });
    check("1.2 OWNER สร้างลิงก์ได้ (token)", !!link.token && link.token.length >= 32);
    const got = await ownerCaller.customerStatus.getLink({ orderId: order.id });
    check("1.3 getLink คืน token เดียวกัน", got.token === link.token);
    const token = link.token;

    // ── 2. getStatus (public) + กันรั่ว ──
    const d = await publicCaller.customerStatus.getStatus({ token });
    check("2.1 คืนสถานะลูกค้า (IN_PRODUCTION) + steps", d.customerStatus === "IN_PRODUCTION" && d.steps.length === 6);
    check("2.2 คืนเลข/ชื่องาน/ลูกค้า", d.orderNumber === order.orderNumber && !!d.title && !!d.customerName);

    const topKeys = Object.keys(d);
    const forbiddenTop = ["totalAmount", "totalCost", "profitMargin", "internalStatus", "notes", "taxAmount", "discount", "subtotalItems", "subtotalFees", "paymentTerms"];
    const leakedTop = forbiddenTop.filter((k) => topKeys.includes(k));
    check("2.3 ไม่รั่ว field ภายในระดับบน (เงิน/ต้นทุน/กำไร/internalStatus/notes)", leakedTop.length === 0, leakedTop.join(","));

    const invKeys = d.invoices[0] ? Object.keys(d.invoices[0]) : [];
    check("2.4 ใบแจ้งหนี้ไม่รั่ว amount/discount/tax แยก (โชว์แค่ totalAmount)", !invKeys.includes("amount") && !invKeys.includes("discount") && !invKeys.includes("tax") && invKeys.includes("totalAmount"));

    const qKeys = d.quotations[0] ? Object.keys(d.quotations[0]) : [];
    check("2.5 ใบเสนอไม่รั่ว subtotal/discount/tax แยก", !qKeys.includes("subtotal") && !qKeys.includes("discount") && !qKeys.includes("tax") && qKeys.includes("totalAmount"));

    // ── 3. เนื้อหา ──
    check("3.1 แบบที่อนุมัติโผล่ + imageUrl พก ?s=token", !!d.approvedDesign && (d.approvedDesign.imageUrl ?? "").includes(`?s=${token}`));
    check("3.2 ใบเสนอที่ส่งแล้วโผล่ 1 ใบ + ยอด 5000 + items", d.quotations.length === 1 && d.quotations[0].totalAmount === 5000 && d.quotations[0].items.length === 1);
    check("3.2b ใบเสนอ DRAFT (ยังไม่ส่ง) ไม่โผล่ — กันราคาภายในรั่ว", d.quotations.every((q) => q.totalAmount !== 9999));
    check("3.3 ใบแจ้งหนี้ 1 ใบ + จ่ายแล้ว", d.invoices.length === 1 && d.invoices[0].paymentStatus === "PAID");
    check("3.4 พัสดุ 1 รายการ + tracking + lines", d.deliveries.length === 1 && d.deliveries[0].trackingNumber === "JT123456789" && d.deliveries[0].lines.length === 1);
    check("3.5 ไม่ blindShip → brandName = Anajak Print", d.isBlindShip === false && d.brandName === "Anajak Print");

    // ── 4. blindShip ──
    await prisma.order.update({ where: { id: order.id }, data: { blindShip: true, blindShipSenderName: "แบรนด์ลูกค้า" } });
    const db = await publicCaller.customerStatus.getStatus({ token });
    check("4.1 blindShip → brandName = ชื่อลูกค้า (กลบ Anajak)", db.isBlindShip === true && db.brandName === "แบรนด์ลูกค้า");

    // ── 5. หมดอายุ / token มั่ว ──
    await prisma.order.update({ where: { id: order.id }, data: { statusTokenExpiresAt: new Date(Date.now() - 1000) } });
    const expired = await expectThrow(() => publicCaller.customerStatus.getStatus({ token }));
    check("5.1 token หมดอายุ → ปฏิเสธ", expired);
    const bad = await expectThrow(() => publicCaller.customerStatus.getStatus({ token: "ไม่มีจริง" }));
    check("5.2 token ไม่มีจริง → ปฏิเสธ", bad);
  } finally {
    if (order) {
      await prisma.designVersion.deleteMany({ where: { orderId: order.id } });
      await prisma.quotation.deleteMany({ where: { orderId: order.id } });
      await prisma.invoice.deleteMany({ where: { orderId: order.id } });
      await prisma.delivery.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
    if (customer) await prisma.customer.delete({ where: { id: customer.id } });
  }

  console.log(`\n${pass} PASS / ${fails.length} FAIL`);
  if (fails.length > 0) { console.log("FAILED:", fails.join(" · ")); process.exitCode = 1; }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
