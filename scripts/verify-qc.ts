/**
 * verify QC เชิงนับ (ก้อน 3) — integration จริงกับ DB
 * รัน: npm run verify:qc · ข้อมูลใช้ marker [QC-VERIFY] ลบเกลี้ยงท้ายสคริปต์
 */
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";

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
      title: `${MARK} งานทดสอบ QC ${suffix}`,
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

  try {
    // ── 1. ดีล้วนครบ → เด้งเข้าแพ็คเอง ──
    const A = await makeOrder(customer.id, owner.id, "A");
    const ctxA = await caller.qc.context({ orderId: A.order.id });
    check("1.1 context: ยอดคาด 10 (2 ไซส์)", ctxA.totalExpected === 10 && ctxA.lines.length === 2);
    await caller.qc.create({ orderId: A.order.id, qtyGood: 10, defects: [] });
    const aAfter = await prisma.order.findUniqueOrThrow({ where: { id: A.order.id } });
    check("1.2 ดีล้วน → ออเดอร์เด้ง PACKING", aAfter.internalStatus === "PACKING");

    // ── 2. มีของเสีย → ถอยกลับผลิต + งานแก้ + กระดิ่ง ──
    const B = await makeOrder(customer.id, owner.id, "B");
    await caller.qc.create({
      orderId: B.order.id,
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
      .create({ orderId: B.order.id, qtyGood: 10, defects: [] })
      .then(
        () => check("3.1 ตรวจขณะ PRODUCING → โดนกัน", false),
        (e) => check("3.1 ตรวจขณะ PRODUCING → โดนกัน", String(e.message).includes("ขั้นตรวจคุณภาพ"))
      );

    // ── 4. ประวัติตรวจ ──
    const list = await caller.qc.listByOrder({ orderId: B.order.id });
    check("4.1 ประวัติตรวจอ่านได้พร้อมคนตรวจ", list.length === 1 && !!list[0].checkedBy.name);
  } finally {
    const orders = await prisma.order.findMany({
      where: { title: { contains: MARK } },
      select: { id: true, orderNumber: true },
    });
    const ids = orders.map((o) => o.id);
    await prisma.notification.deleteMany({
      where: { type: "QC_DEFECT", OR: orders.map((o) => ({ title: { contains: o.orderNumber } })) },
    });
    await prisma.qcRecord.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.production.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
    await prisma.customer.deleteMany({ where: { name: { contains: MARK } } });
  }

  console.log(`\n=== ผล: ผ่าน ${pass} · ตก ${fails.length} ===`);
  if (fails.length > 0) {
    console.log("ตก:", fails.join(" / "));
    process.exit(1);
  }
  await prisma.$disconnect();
}

main();
