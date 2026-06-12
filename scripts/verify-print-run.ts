/**
 * verify รอบพิมพ์ฟิล์ม + คลังฟิล์ม (ก้อน 2) — integration จริงกับ DB
 * รัน: npm run verify:printrun (tsx --env-file=.env)
 * ข้อมูลทดสอบใช้ marker [PRINTRUN-VERIFY] ลบเกลี้ยงท้ายสคริปต์ · ไม่แตะ DocumentSequence
 * ของจริงนอกจาก PRINT_RUN (เลขรันต่อเนื่องตามจริง — ยอมรับได้ เอกสารภายใน)
 */
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";
import { evaluateHeatPressGate } from "@/lib/production-steps";

const MARK = "[PRINTRUN-VERIFY]";
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
async function expectError(name: string, fn: () => Promise<unknown>, contains: string) {
  try {
    await fn();
    check(name, false, "ไม่ถูกปฏิเสธ");
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    check(name, m.includes(contains), m);
  }
}

async function makeOrder(opts: { suffix: string; qty: number; customerId: string; userId: string }) {
  const order = await prisma.order.create({
    data: {
      orderNumber: `TEST-PR-${opts.suffix}-${Date.now()}`,
      title: `${MARK} งานทดสอบรอบพิมพ์ ${opts.suffix}`,
      customerId: opts.customerId,
      createdById: opts.userId,
      internalStatus: "PRODUCING", // พ้นเฟสออกแบบ = ไฟล์พร้อม
      items: { create: [{ description: `${MARK} เสื้อ`, totalQuantity: opts.qty, sortOrder: 0 }] },
    },
  });
  const production = await prisma.production.create({
    data: {
      orderId: order.id,
      steps: {
        create: [
          { stepType: "GARMENT_PICK", status: "COMPLETED", sortOrder: 0, completedAt: new Date() },
          { stepType: "DTF_PRINT", status: "PENDING", sortOrder: 1 },
          { stepType: "HEAT_PRESS", status: "PENDING", sortOrder: 2 },
        ],
      },
    },
    include: { steps: true },
  });
  const printStep = production.steps.find((s) => s.stepType === "DTF_PRINT")!;
  return { order, production, printStep };
}

async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const caller = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });
  const customer = await prisma.customer.create({
    data: { name: `${MARK} ลูกค้าทดสอบ`, customerType: "INDIVIDUAL" },
  });

  try {
    // ── 1. คิว + เปิดรอบ ──
    const A = await makeOrder({ suffix: "A", qty: 10, customerId: customer.id, userId: owner.id });
    const B = await makeOrder({ suffix: "B", qty: 20, customerId: customer.id, userId: owner.id });

    let queue = await caller.printRun.queue();
    check("1.1 งานไฟล์พร้อมโผล่ในคิว", queue.some((q) => q.stepId === A.printStep.id));
    check(
      "1.2 จำนวนในคิว = ยอดออเดอร์",
      queue.find((q) => q.stepId === A.printStep.id)?.remaining === 10
    );

    const run1 = await caller.printRun.create({
      items: [
        { stepId: A.printStep.id, qty: 10 },
        { stepId: B.printStep.id, qty: 8 }, // แบ่งพิมพ์ — เหลือ 12 ไว้รอบหน้า
      ],
    });
    check("2.1 เปิดรอบได้ เลข FR-", run1.runNumber.startsWith("FR-"));
    queue = await caller.printRun.queue();
    check(
      "2.2 งานติดรอบ active หายจากคิว",
      !queue.some((q) => q.stepId === A.printStep.id || q.stepId === B.printStep.id)
    );
    const stepA1 = await prisma.productionStep.findUniqueOrThrow({ where: { id: A.printStep.id } });
    check("2.3 ขั้นขยับเป็นกำลังทำ + seed qtyTotal", stepA1.status === "IN_PROGRESS" && stepA1.qtyTotal === 10);
    await expectError(
      "2.4 เปิดรอบซ้อนงานเดิม → โดนกัน",
      () => caller.printRun.create({ items: [{ stepId: A.printStep.id, qty: 1 }] }),
      "อยู่ในรอบพิมพ์อื่น"
    );
    await expectError(
      "2.5 พิมพ์เกินจำนวนงาน → โดนกัน",
      () => caller.printRun.create({ items: [{ stepId: B.printStep.id, qty: 999 }] }),
      "อยู่ในรอบพิมพ์อื่น" // B ติดรอบ run1 อยู่ — เช็คซ้อนมาก่อนเช็คจำนวน
    );

    // ── 2. ปิดรอบก่อนพิมพ์จบไม่ได้ · จังหวะ PRINTED → COMPLETED ──
    await expectError(
      "3.1 ตัดแยกก่อนพิมพ์จบ → โดนกัน",
      () => caller.printRun.complete({ runId: run1.id }),
      "ยังไม่ได้กดพิมพ์จบ"
    );
    await caller.printRun.markPrinted({ runId: run1.id });
    const itemA = run1.items.find((i) => i.productionStepId === A.printStep.id)!;
    await caller.printRun.complete({
      runId: run1.id,
      extras: [{ itemId: itemA.id, extraQty: 3, label: `${MARK} โลโก้ทดสอบ` }],
    });

    const stepA2 = await prisma.productionStep.findUniqueOrThrow({ where: { id: A.printStep.id } });
    check("3.2 พิมพ์ครบ → ขั้นปิด qtyDone=10", stepA2.status === "COMPLETED" && stepA2.qtyDone === 10);
    const stepB2 = await prisma.productionStep.findUniqueOrThrow({ where: { id: B.printStep.id } });
    check("3.3 พิมพ์บางส่วน → ขั้นยังเปิด qtyDone=8", stepB2.status === "IN_PROGRESS" && stepB2.qtyDone === 8);

    // ── 3. ฟิล์มเผื่อเข้าคลัง + หยิบใช้ ──
    const films = await caller.filmStock.list({ search: "โลโก้ทดสอบ" });
    const film = films.find((f) => f.orderId === A.order.id);
    check("4.1 ฟิล์มเผื่อเข้าคลัง 3 ชิ้น", film?.qty === 3 && film?.customer.name.includes("ลูกค้าทดสอบ"));
    await caller.filmStock.consume({ id: film!.id, qty: 2, note: `${MARK} หยิบใช้` });
    const film2 = await prisma.filmStock.findUniqueOrThrow({ where: { id: film!.id } });
    check("4.2 หยิบใช้ 2 → เหลือ 1", film2.qty === 1);
    await expectError(
      "4.3 หยิบเกินคงเหลือ → โดนกัน",
      () => caller.filmStock.consume({ id: film!.id, qty: 5 }),
      "คงเหลือไม่พอ"
    );

    // ── 4. gate คิวรีด ──
    const stepsA = await prisma.productionStep.findMany({ where: { productionId: A.production.id } });
    check("5.1 A: ฟิล์มเสร็จ+เสื้อพร้อม → รีดได้", evaluateHeatPressGate(stepsA).ready === true);
    const stepsB = await prisma.productionStep.findMany({ where: { productionId: B.production.id } });
    check("5.2 B: ฟิล์มยังไม่ครบ → ติด gate รอฟิล์ม", evaluateHeatPressGate(stepsB).filmReady === false);

    // ── 5. รอบที่สอง (ส่วนที่เหลือของ B) ปิดขั้นเมื่อครบ ──
    queue = await caller.printRun.queue();
    check("6.1 B กลับเข้าคิว เหลือ 12", queue.find((q) => q.stepId === B.printStep.id)?.remaining === 12);
    const run2 = await caller.printRun.create({ items: [{ stepId: B.printStep.id, qty: 12 }] });
    await caller.printRun.markPrinted({ runId: run2.id });
    await caller.printRun.complete({ runId: run2.id });
    const stepB3 = await prisma.productionStep.findUniqueOrThrow({ where: { id: B.printStep.id } });
    check("6.2 ครบจำนวน → ขั้นปิด", stepB3.status === "COMPLETED" && stepB3.qtyDone === 20);

    // ── 6. ยกเลิกรอบ → งานคืนคิว ──
    const C = await makeOrder({ suffix: "C", qty: 5, customerId: customer.id, userId: owner.id });
    const run3 = await caller.printRun.create({ items: [{ stepId: C.printStep.id, qty: 5 }] });
    await caller.printRun.cancel({ runId: run3.id });
    const stepC = await prisma.productionStep.findUniqueOrThrow({ where: { id: C.printStep.id } });
    check("7.1 ยกเลิกรอบ → ขั้นกลับ PENDING", stepC.status === "PENDING" && stepC.qtyDone === 0);
    queue = await caller.printRun.queue();
    check("7.2 งานกลับเข้าคิว", queue.some((q) => q.stepId === C.printStep.id));
    await caller.printRun.markPrinted({ runId: run3.id }).then(
      () => check("7.3 รอบที่ยกเลิกกดพิมพ์จบไม่ได้", false),
      () => check("7.3 รอบที่ยกเลิกกดพิมพ์จบไม่ได้", true)
    );
  } finally {
    // ── cleanup เกลี้ยง ──
    const orders = await prisma.order.findMany({
      where: { title: { contains: MARK } },
      select: { id: true },
    });
    const orderIds = orders.map((o) => o.id);
    await prisma.filmStock.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { label: { contains: MARK } }] } });
    await prisma.printRunItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.printRun.deleteMany({ where: { items: { none: {} }, runNumber: { startsWith: "FR-" } } });
    await prisma.production.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
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
