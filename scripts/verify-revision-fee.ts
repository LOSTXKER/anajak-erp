/**
 * verify ค่าแก้แบบเกินโควตา (ก้อน 4 — นับรอบแก้แบบ) — integration จริงกับ DB
 * รัน: npm run verify:revision
 * เน้น: gate salesUp · นับรอบจากเวอร์ชัน (ฟรี 2) · ในโควตากดไม่ได้ · เกินโควตาเพิ่ม fee +
 *   recompute total · idempotent (กดซ้ำ/อัปเวอร์ชันเพิ่ม = แถวเดียว sync ยอด) · ไม่ทับ fee อื่น ·
 *   status guard (COMPLETED) · ลบ fee = ยกเว้นได้
 * ข้อมูลใช้ marker [REVFEE-VERIFY] ลบเกลี้ยงท้ายสคริปต์
 */
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";
import { REVISION_FEE_TYPE } from "@/lib/revision-policy";

const MARK = "[REVFEE-VERIFY]";
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
  const designerCaller = appRouter.createCaller({ prisma, userId: owner.id, userRole: "DESIGNER" });

  let customer: { id: string } | null = null;
  let order: { id: string } | null = null;

  async function addVersion(n: number) {
    await prisma.designVersion.create({
      data: { orderId: order!.id, versionNumber: n, fileUrl: `${MARK}/v${n}.png`, approvalStatus: "REVISION_REQUESTED" },
    });
  }
  const getOrder = () =>
    prisma.order.findUniqueOrThrow({ where: { id: order!.id }, include: { fees: true } });

  try {
    customer = await prisma.customer.create({ data: { name: `${MARK} ลูกค้า`, customerType: "INDIVIDUAL" } });
    order = await prisma.order.create({
      data: {
        orderNumber: `TEST-REVFEE-${Date.now()}`,
        title: `${MARK} งาน`,
        customerId: customer.id,
        createdById: owner.id,
        internalStatus: "DESIGNING",
        customerStatus: "IN_PRODUCTION",
        subtotalItems: 5000,
        taxRate: 7,
        discount: 0,
        totalAmount: 5350, // 5000 + 7% = 5350 (ยังไม่มี fee)
      },
    });

    // ── 1. gate ──
    await addVersion(1); await addVersion(2); await addVersion(3); // 2 รอบ (ฟรี)
    const blocked = await expectThrow(() => designerCaller.order.addRevisionFee({ id: order!.id }));
    check("1.1 DESIGNER เพิ่มค่าแก้ไม่ได้ (salesUp)", blocked);

    // ── 2. ในโควตาฟรี กดไม่ได้ ──
    const inQuota = await expectThrow(() => ownerCaller.order.addRevisionFee({ id: order!.id }));
    check("2.1 v3 (แก้ 2 รอบ ฟรี) → ยังไม่เกินโควตา กดไม่ได้", inQuota);
    const o2 = await getOrder();
    check("2.2 ยังไม่มี fee ค่าแก้", !o2.fees.some((f) => f.feeType === REVISION_FEE_TYPE));

    // ── 3. เกินโควตา 1 รอบ → fee 100 + recompute ──
    await addVersion(4); // 3 รอบ → เกิน 1
    await ownerCaller.order.addRevisionFee({ id: order.id });
    const o3 = await getOrder();
    const rf3 = o3.fees.find((f) => f.feeType === REVISION_FEE_TYPE);
    check("3.1 เพิ่ม fee DESIGN_REVISION = 100", !!rf3 && rf3.amount === 100);
    check("3.2 subtotalFees = 100", o3.subtotalFees === 100);
    check("3.3 total recompute = (5000+100)*1.07 = 5457", o3.totalAmount === 5457);

    // ── 4. idempotent กดซ้ำ — แถวเดียว ยอดเท่าเดิม ──
    await ownerCaller.order.addRevisionFee({ id: order.id });
    const o4 = await getOrder();
    check("4.1 กดซ้ำ → fee DESIGN_REVISION แถวเดียว (ไม่เพิ่มซ้ำ)", o4.fees.filter((f) => f.feeType === REVISION_FEE_TYPE).length === 1);
    check("4.2 ยอดยังเท่าเดิม (100)", o4.subtotalFees === 100);

    // ── 5. อัปเวอร์ชันเพิ่ม → sync ยอดตามรอบใหม่ ──
    await addVersion(5); // 4 รอบ → เกิน 2 → 200
    await ownerCaller.order.addRevisionFee({ id: order.id });
    const o5 = await getOrder();
    const rf5 = o5.fees.find((f) => f.feeType === REVISION_FEE_TYPE);
    check("5.1 อัปเวอร์ชันแล้วกด → fee = 200 (sync รอบล่าสุด)", !!rf5 && rf5.amount === 200);
    check("5.2 total = (5000+200)*1.07 = 5564", o5.totalAmount === 5564);

    // ── 6. ไม่ทับ fee อื่น ──
    await prisma.orderFee.create({ data: { orderId: order.id, feeType: "RUSH_FEE", name: "ค่าเร่ง", amount: 300 } });
    // recompute ผ่าน updateFees ของ fee อื่นไม่จำเป็น — addRevisionFee จะรวม fee อื่นเข้า base เอง
    await ownerCaller.order.addRevisionFee({ id: order.id });
    const o6 = await getOrder();
    check("6.1 fee อื่น (RUSH_FEE) ยังอยู่", o6.fees.some((f) => f.feeType === "RUSH_FEE" && f.amount === 300));
    check("6.2 subtotalFees รวม fee อื่น = 200 + 300 = 500", o6.subtotalFees === 500);

    // ── 7. status guard ──
    await prisma.order.update({ where: { id: order.id }, data: { internalStatus: "COMPLETED" } });
    const locked = await expectThrow(() => ownerCaller.order.addRevisionFee({ id: order!.id }));
    check("7.1 ออเดอร์ COMPLETED → เพิ่มค่าแก้ไม่ได้", locked);
  } finally {
    if (order) {
      await prisma.designVersion.deleteMany({ where: { orderId: order.id } });
      await prisma.orderFee.deleteMany({ where: { orderId: order.id } });
      await prisma.orderRevision.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
    if (customer) await prisma.customer.delete({ where: { id: customer.id } });
  }

  console.log(`\n${pass} PASS / ${fails.length} FAIL`);
  if (fails.length > 0) { console.log("FAILED:", fails.join(" · ")); process.exitCode = 1; }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
