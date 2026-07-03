/**
 * verify แพ็คนับยืนยัน + รายการต่อกล่อง + แบ่งส่ง + blind ship (ก้อน 3)
 * รัน: npm run verify:pack · marker [PACK-VERIFY] ลบเกลี้ยงท้ายสคริปต์
 */
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";

const MARK = "[PACK-VERIFY]";
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

async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const caller = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });
  const customer = await prisma.customer.create({
    data: { name: `${MARK} แบรนด์ทดสอบ`, customerType: "CORPORATE", company: "แบรนด์ใจดี" },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `TEST-PACK-${Date.now()}`,
      title: `${MARK} งานทดสอบแพ็ค`,
      customerId: customer.id,
      createdById: owner.id,
      internalStatus: "PACKING",
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

  try {
    // ── 1. blind ship ──
    await caller.order.setBlindShip({ orderId: order.id, blindShip: true, blindShipSenderName: "แบรนด์ใจดี" });
    let ctx = await caller.delivery.packContext({ orderId: order.id });
    check("1.1 ธง blind ship + ชื่อผู้ส่ง", ctx.blindShip && ctx.blindShipSenderName === "แบรนด์ใจดี");
    check("1.2 ยอดเหลือแพ็คเริ่มต้น 10", ctx.totalRemaining === 10 && ctx.lines.length === 2);

    // ── 2. แพ็ครอบแรก M×4 ──
    const base = {
      orderId: order.id,
      recipientName: "คุณรับของ",
      phone: "0812345678",
      address: "99 ถ.ทดสอบ",
      shippingMethod: "KERRY",
    };
    const d1 = await caller.delivery.create({
      ...base,
      lines: [{ description: "เสื้อยืด", size: "M", color: "ดำ", qty: 4 }],
    });
    ctx = await caller.delivery.packContext({ orderId: order.id });
    check("2.1 รอบแรก M×4 → เหลือ M2/L4", ctx.totalRemaining === 6);

    // ── 3. กันแพ็คเกินต่อไซส์ ──
    await caller.delivery
      .create({ ...base, lines: [{ description: "เสื้อยืด", size: "M", color: "ดำ", qty: 3 }] })
      .then(
        () => check("3.1 แพ็คเกิน (M เหลือ 2 ใส่ 3) → โดนกัน", false),
        (e) => check("3.1 แพ็คเกิน (M เหลือ 2 ใส่ 3) → โดนกัน", String(e.message).includes("แพ็คเกินยอดงาน"))
      );

    // ── 4. แบ่งส่ง: รอบสองส่วนที่เหลือ → ส่งครบทุกใบค่อยเด้ง SHIPPED ──
    const d2 = await caller.delivery.create({
      ...base,
      lines: [
        { description: "เสื้อยืด", size: "M", color: "ดำ", qty: 2 },
        { description: "เสื้อยืด", size: "L", color: "ดำ", qty: 4 },
      ],
    });
    await caller.delivery.updateStatus({ id: d1.id, status: "SHIPPED", trackingNumber: "TRK-001" });
    let o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    check("4.1 กล่องแรกออก → ออเดอร์ยังไม่เด้ง (อีกใบค้าง)", o.internalStatus === "PACKING");
    await caller.delivery.updateStatus({ id: d2.id, status: "SHIPPED", trackingNumber: "TRK-002" });
    o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    check("4.2 ครบทุกใบ → ออเดอร์เด้ง SHIPPED", o.internalStatus === "SHIPPED");

    // ── 5. รายการต่อกล่องอ่านกลับได้ ──
    const dl = await caller.delivery.getByOrderId({ orderId: order.id });
    check(
      "5.1 บอกได้ว่ากล่องไหนมีอะไร",
      dl.find((d) => d.id === d1.id)?.lines.length === 1 &&
        dl.find((d) => d.id === d2.id)?.lines.length === 2
    );

    // ── 6. เด้งตามจำนวนตัว ไม่ใช่จำนวนใบ — กล่องแรกออกก่อนสร้างใบที่เหลือ ──
    const order2 = await prisma.order.create({
      data: {
        orderNumber: `TEST-PACK2-${Date.now()}`,
        title: `${MARK} งานทดสอบเด้งตามจำนวน`,
        customerId: customer.id,
        createdById: owner.id,
        internalStatus: "PACKING",
        items: {
          create: [{
            description: `${MARK} เสื้อ`, totalQuantity: 10, sortOrder: 0,
            products: { create: [{ productType: "TSHIRT", description: `${MARK} เสื้อยืด`, baseUnitPrice: 0,
              variants: { create: [{ size: "M", color: "ดำ", quantity: 10 }] } }] },
          }],
        },
      },
    });
    const e1 = await caller.delivery.create({ ...base, orderId: order2.id, lines: [{ description: "เสื้อยืด", size: "M", color: "ดำ", qty: 4 }] });
    await caller.delivery.updateStatus({ id: e1.id, status: "SHIPPED", trackingNumber: "TRK-E1" });
    let o2 = await prisma.order.findUniqueOrThrow({ where: { id: order2.id } });
    check("6.1 กล่องเดียวออก 4/10 ตัว (ไม่มีใบอื่นค้าง) → ไม่เด้ง SHIPPED", o2.internalStatus === "PACKING");
    const e2 = await caller.delivery.create({ ...base, orderId: order2.id, lines: [{ description: "เสื้อยืด", size: "M", color: "ดำ", qty: 6 }] });
    await caller.delivery.updateStatus({ id: e2.id, status: "SHIPPED", trackingNumber: "TRK-E2" });
    o2 = await prisma.order.findUniqueOrThrow({ where: { id: order2.id } });
    check("6.2 ครบ 10/10 ตัว → เด้ง SHIPPED", o2.internalStatus === "SHIPPED");

    // ── 7. B13: เลขพัสดุทุกสถานะ + state machine + self ไม่ re-notify ──
    const expectThrow = async (fn: () => Promise<unknown>): Promise<boolean> => {
      try { await fn(); return false; } catch { return true; }
    };
    const order3 = await prisma.order.create({
      data: {
        orderNumber: `TEST-PACK3-${Date.now()}`,
        title: `${MARK} งานทดสอบ B13`,
        customerId: customer.id, createdById: owner.id, internalStatus: "PACKING",
      },
    });
    const d3 = await caller.delivery.create({ ...base, orderId: order3.id });

    // 7.1 เลขพัสดุกรอกตอน PREPARING ต้องเก็บ (เดิมเขียนเฉพาะ SHIPPED — หายเงียบ)
    await caller.delivery.updateStatus({ id: d3.id, status: "PREPARING", trackingNumber: "TRK-PREP-1" });
    let d3db = await prisma.delivery.findUniqueOrThrow({ where: { id: d3.id } });
    check("7.1 เลขพัสดุกรอกตอน PREPARING → เก็บบนใบส่ง (เดิมหายเงียบ)",
      d3db.trackingNumber === "TRK-PREP-1" && d3db.status === "PREPARING", d3db.trackingNumber ?? "null");
    const o3after = await prisma.order.findUniqueOrThrow({ where: { id: order3.id } });
    check("7.2 PREPARING ไม่ดันออเดอร์เป็น SHIPPED (ยัง PACKING)", o3after.internalStatus === "PACKING");

    // 7.3 เดินหน้า PREPARING→SHIPPED ได้ + self SHIPPED→SHIPPED แก้เลขพัสดุได้ + ไม่ทับวันส่ง
    await caller.delivery.updateStatus({ id: d3.id, status: "SHIPPED", trackingNumber: "TRK-SHIP-1" });
    const shippedAt1 = (await prisma.delivery.findUniqueOrThrow({ where: { id: d3.id } })).shippedAt;
    await new Promise((r) => setTimeout(r, 10));
    await caller.delivery.updateStatus({ id: d3.id, status: "SHIPPED", trackingNumber: "TRK-SHIP-2" });
    d3db = await prisma.delivery.findUniqueOrThrow({ where: { id: d3.id } });
    check("7.3 self SHIPPED→SHIPPED แก้เลขพัสดุได้ (ไม่บล็อก)", d3db.trackingNumber === "TRK-SHIP-2");
    check("7.3b self SHIPPED→SHIPPED ไม่ทับ shippedAt เป็นวันนี้ (เก็บวันส่งจริง · review B13)",
      d3db.shippedAt?.getTime() === shippedAt1?.getTime(), `${shippedAt1?.toISOString()} vs ${d3db.shippedAt?.toISOString()}`);

    // 7.4 ถอยหนึ่งก้าว SHIPPED→PREPARING ได้ · แต่ SHIPPED→PENDING (ถอยไกล) โดนบล็อก
    await caller.delivery.updateStatus({ id: d3.id, status: "SHIPPED" }); // กลับไป SHIPPED ก่อน
    check("7.4 ถอยไกล SHIPPED→PENDING → บล็อก (เดินทีละขั้น)",
      await expectThrow(() => caller.delivery.updateStatus({ id: d3.id, status: "PENDING" })));
    await caller.delivery.updateStatus({ id: d3.id, status: "PREPARING" });
    d3db = await prisma.delivery.findUniqueOrThrow({ where: { id: d3.id } });
    check("7.5 ถอยหนึ่งก้าว SHIPPED→PREPARING → ได้", d3db.status === "PREPARING");

    // 7.6 RETURNED เตือนผู้จัดการ · self RETURNED→RETURNED ไม่เตือนซ้ำ
    await caller.delivery.updateStatus({ id: d3.id, status: "RETURNED" });
    const notif1 = await prisma.notification.count({ where: { entityId: order3.id, title: { contains: "ตีกลับ" } } });
    await caller.delivery.updateStatus({ id: d3.id, status: "RETURNED", trackingNumber: "TRK-RET" });
    const notif2 = await prisma.notification.count({ where: { entityId: order3.id, title: { contains: "ตีกลับ" } } });
    check("7.6 RETURNED เตือนผู้จัดการ (>0)", notif1 > 0, String(notif1));
    check("7.7 self RETURNED→RETURNED ไม่เตือนซ้ำ (guard statusChanged)", notif2 === notif1, `${notif1}→${notif2}`);

    // 7.8 ของส่งถึงแล้วลูกค้าตีกลับ: DELIVERED→RETURNED ต้องทำได้ (state machine + UI ปุ่มโชว์)
    const d4 = await caller.delivery.create({ ...base, orderId: order3.id });
    await caller.delivery.updateStatus({ id: d4.id, status: "DELIVERED" });
    await caller.delivery.updateStatus({ id: d4.id, status: "RETURNED" });
    const d4db = await prisma.delivery.findUniqueOrThrow({ where: { id: d4.id } });
    check("7.8 DELIVERED→RETURNED ได้ (ของส่งถึงแล้วตีกลับ · เดิม UI ปุ่มซ่อนกดไม่ได้)", d4db.status === "RETURNED");
  } finally {
    const allOrders = await prisma.order.findMany({ where: { title: { contains: MARK } }, select: { id: true } });
    const orderIds = allOrders.map((o) => o.id);
    const dels = await prisma.delivery.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } });
    await prisma.deliveryLine.deleteMany({ where: { deliveryId: { in: dels.map((d) => d.id) } } });
    await prisma.delivery.deleteMany({ where: { orderId: { in: orderIds } } });
    // แจ้งเตือนของตีกลับ (B13 test) ผูก entityId = orderId — ลบก่อน order
    await prisma.notification.deleteMany({ where: { entityId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.customer.delete({ where: { id: customer.id } });
  }

  console.log(`\n=== ผล: ผ่าน ${pass} · ตก ${fails.length} ===`);
  if (fails.length > 0) {
    console.log("ตก:", fails.join(" / "));
    process.exit(1);
  }
  await prisma.$disconnect();
}

main();
