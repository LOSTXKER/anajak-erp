/**
 * verify CRM (Gate B7) — integration จริงกับ DB
 * รัน: npm run verify:crm · ข้อมูลใช้ marker [CRM-VERIFY] ลบเกลี้ยงท้ายสคริปต์
 * โจทย์: customer.update ครบ field + ล้างค่า + SALES แก้วงเงินไม่ได้ ·
 * addCommunicationLog + role gate · list pagination (เกิน limit ต้องเปิดหน้าถัดไปได้)
 */
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";

const MARK = "[CRM-VERIFY]";
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

async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const caller = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });
  const sales = appRouter.createCaller({ prisma, userId: owner.id, userRole: "SALES" });
  const staff = appRouter.createCaller({
    prisma,
    userId: owner.id,
    userRole: "PRODUCTION_STAFF",
  });

  try {
    // ── 1) update ครบ field ──
    const c1 = await caller.customer.create({
      name: `${MARK} ลูกค้าแก้ข้อมูล`,
      customerType: "INDIVIDUAL",
    });
    await caller.customer.update({
      id: c1.id,
      customerType: "CORPORATE",
      name: `${MARK} ผู้ติดต่อใหม่`,
      company: "บริษัท ทดสอบ จำกัด",
      phone: "081-234-5678", // ต้องถูก normalize
      email: "test@example.com",
      segment: "VIP",
      taxId: "0105511112223",
      branchNumber: "00001",
      creditLimit: 50000,
      defaultPaymentTerms: "NET_30",
      billingAddress: "99 ถ.ทดสอบ",
      billingProvince: "กรุงเทพมหานคร",
    });
    let db = await prisma.customer.findUniqueOrThrow({ where: { id: c1.id } });
    check(
      "1.1 update ครบ field: ชนิด/ชื่อ/บริษัท/segment/ภาษี/สาขา/วงเงิน/เทอม/ที่อยู่บิล",
      db.customerType === "CORPORATE" &&
        db.name === `${MARK} ผู้ติดต่อใหม่` &&
        db.company === "บริษัท ทดสอบ จำกัด" &&
        db.segment === "VIP" &&
        db.taxId === "0105511112223" &&
        db.branchNumber === "00001" &&
        Number(db.creditLimit) === 50000 &&
        db.defaultPaymentTerms === "NET_30" &&
        db.billingAddress === "99 ถ.ทดสอบ",
      { t: db.customerType, seg: db.segment, credit: db.creditLimit }
    );
    check("1.2 เบอร์ถูก normalize ที่ทางเข้า server", db.phone === "0812345678", db.phone);

    // ── 2) ล้างค่า ──
    await caller.customer.update({
      id: c1.id,
      email: "",
      branchNumber: null,
      creditLimit: null,
      defaultPaymentTerms: null,
      billingAddress: null,
    });
    db = await prisma.customer.findUniqueOrThrow({ where: { id: c1.id } });
    check(
      "2.1 ล้างค่า: email ว่าง→null · nullable (สาขา/วงเงิน/เทอม/ที่อยู่บิล)→null",
      db.email === null &&
        db.branchNumber === null &&
        db.creditLimit === null &&
        db.defaultPaymentTerms === null &&
        db.billingAddress === null,
      { email: db.email, branch: db.branchNumber, credit: db.creditLimit }
    );

    // ── 3) SALES กับวงเงินเครดิต ──
    await caller.customer.update({ id: c1.id, creditLimit: 10000 });
    await sales.customer
      .update({ id: c1.id, creditLimit: 99999 })
      .then(
        () => check("3.1 SALES แก้วงเงินเครดิต → โดนกัน", false),
        (e) => check("3.1 SALES แก้วงเงินเครดิต → โดนกัน", String(e.message).includes("วงเงิน"))
      );
    // ไม่ส่ง creditLimit เลย (pattern dialog ฝั่ง SALES) → แก้ field อื่นได้ปกติ
    await sales.customer.update({ id: c1.id, notes: "SALES จดโน้ตได้" });
    db = await prisma.customer.findUniqueOrThrow({ where: { id: c1.id } });
    check(
      "3.2 SALES ไม่ส่ง creditLimit → แก้ field อื่นผ่าน (วงเงินเดิมคงอยู่)",
      db.notes === "SALES จดโน้ตได้" && Number(db.creditLimit) === 10000
    );

    // ── 4) บันทึกการคุย ──
    const log = await sales.customer.addCommunicationLog({
      customerId: c1.id,
      channel: "LINE",
      subject: "ตามมัดจำ",
      content: "ลูกค้าบอกจะโอนพรุ่งนี้",
    });
    const logDb = await prisma.communicationLog.findUniqueOrThrow({
      where: { id: log.id },
      include: { user: { select: { id: true } } },
    });
    check(
      "4.1 บันทึกการคุยลง DB พร้อมคนบันทึก",
      logDb.channel === "LINE" && logDb.content.includes("โอนพรุ่งนี้") && logDb.user.id === owner.id
    );
    await staff.customer
      .addCommunicationLog({ customerId: c1.id, channel: "LINE", content: "x" })
      .then(
        () => check("4.2 ช่างผลิตจดบันทึกการคุยไม่ได้ (role gate)", false),
        () => check("4.2 ช่างผลิตจดบันทึกการคุยไม่ได้ (role gate)", true)
      );

    // ── 5) pagination ──
    for (let i = 0; i < 24; i++) {
      await prisma.customer.create({ data: { name: `${MARK} เพจ ${String(i).padStart(2, "0")}` } });
    }
    const p1 = await caller.customer.list({ search: `${MARK} เพจ`, page: 1, limit: 10 });
    const p3 = await caller.customer.list({ search: `${MARK} เพจ`, page: 3, limit: 10 });
    check(
      "5.1 pagination: total 24 · 3 หน้า · หน้า 3 เหลือ 4 ราย",
      p1.total === 24 && p1.pages === 3 && p1.customers.length === 10 && p3.customers.length === 4,
      { total: p1.total, pages: p1.pages, p3: p3.customers.length }
    );
    const p1Ids = new Set(p1.customers.map((c) => c.id));
    check(
      "5.2 หน้า 3 ไม่ซ้ำกับหน้า 1",
      p3.customers.every((c) => !p1Ids.has(c.id))
    );
  } finally {
    const customers = await prisma.customer.findMany({
      where: { name: { contains: MARK } },
      select: { id: true },
    });
    const ids = customers.map((c) => c.id);
    // communicationLog cascade กับ customer · audit ของ create/update ลบเอง
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.customer.deleteMany({ where: { id: { in: ids } } });
  }

  console.log(`\n=== ผล: ผ่าน ${pass} · ตก ${fails.length} ===`);
  if (fails.length > 0) {
    console.log("ตก:", fails.join(" / "));
    process.exit(1);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("VERIFY CRASHED:", e);
  process.exit(1);
});
