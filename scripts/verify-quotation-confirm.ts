/**
 * verify ลิงก์ยืนยันใบเสนอราคาให้ลูกค้า (ก้อน 4 — ขอบลูกค้า) — integration จริงกับ DB
 * รัน: npm run verify:confirm
 * เน้น: gate (salesUp + SENT) · public getQuote โชว์ราคาเต็มแต่ไม่รั่ว notes/orderId/createdBy ·
 *   accept/reject race-safe + กระดิ่งทีม · หมดอายุ/DRAFT/token มั่ว ปฏิเสธ · regenerate ลิงก์เก่าตาย
 * ข้อมูลใช้ marker [CONFIRM-VERIFY] ลบเกลี้ยงท้ายสคริปต์
 */
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";

const MARK = "[CONFIRM-VERIFY]";
let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; console.log(`PASS: ${name}`); }
  else { fails.push(name); console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`); }
}
async function expectThrow(fn: () => Promise<unknown>): Promise<boolean> {
  try { await fn(); return false; } catch { return true; }
}

const FUTURE = () => new Date(Date.now() + 14 * 86400000);
const PAST = () => new Date(Date.now() - 3 * 86400000);

async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const ownerCaller = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });
  const staffCaller = appRouter.createCaller({ prisma, userId: owner.id, userRole: "PRODUCTION_STAFF" });
  const publicCaller = appRouter.createCaller({ prisma, userId: null as never, userRole: null as never });

  // ทีมที่ "ต้องได้กระดิ่ง" เมื่อลูกค้าตัดสิน
  const teamCount = await prisma.user.count({
    where: { role: { in: ["OWNER", "MANAGER", "SALES"] }, isActive: true },
  });

  let customer: { id: string } | null = null;
  const qids: string[] = [];

  // helper สร้างใบเสนอ
  async function mkQuote(opts: { status: string; validUntil: Date; token?: string; sentAt?: Date | null }) {
    const q = await prisma.quotation.create({
      data: {
        quotationNumber: `QT-CONFIRM-${Date.now()}-${qids.length}`,
        customerId: customer!.id,
        createdById: owner.id,
        status: opts.status,
        title: `${MARK} งานเสื้อสกรีน`,
        description: "รายละเอียดงาน",
        terms: "มัดจำ 50%",
        validUntil: opts.validUntil,
        subtotal: 5000,
        discount: 200,
        tax: 336,
        totalAmount: 5136,
        notes: "โน้ตภายในห้ามรั่ว",
        sentAt: opts.sentAt === undefined ? new Date() : opts.sentAt,
        confirmToken: opts.token,
        items: { create: [{ name: "เสื้อคอกลม", quantity: 100, unit: "ตัว", unitPrice: 50, totalPrice: 5000 }] },
      },
    });
    qids.push(q.id);
    return q;
  }

  try {
    customer = await prisma.customer.create({
      data: { name: `${MARK} ลูกค้าทดสอบ`, customerType: "INDIVIDUAL" },
    });

    // ── 1. gate generateLink ──
    const draft = await mkQuote({ status: "DRAFT", validUntil: FUTURE(), sentAt: null });
    const blockedRole = await expectThrow(() => staffCaller.quotationConfirm.generateLink({ quotationId: draft.id }));
    check("1.1 PRODUCTION_STAFF สร้างลิงก์ไม่ได้ (FORBIDDEN)", blockedRole);
    const blockedDraft = await expectThrow(() => ownerCaller.quotationConfirm.generateLink({ quotationId: draft.id }));
    check("1.2 สร้างลิงก์บนใบ DRAFT ไม่ได้ (ต้อง SENT ก่อน)", blockedDraft);

    const sent = await mkQuote({ status: "SENT", validUntil: FUTURE() });
    const link = await ownerCaller.quotationConfirm.generateLink({ quotationId: sent.id });
    check("1.3 OWNER สร้างลิงก์บนใบ SENT ได้ (token)", !!link.token && link.token.length >= 32);
    const got = await ownerCaller.quotationConfirm.getLink({ quotationId: sent.id });
    check("1.4 getLink คืน token เดียวกัน + status SENT", got.token === link.token && got.status === "SENT");
    const token = link.token;

    // ── 2. public getQuote — โชว์ราคาเต็ม + กันรั่ว ──
    const q = await publicCaller.quotationConfirm.getQuote({ token });
    check("2.1 คืนเลขใบ/ชื่องาน/ลูกค้า", q.quotationNumber === sent.quotationNumber && !!q.title && !!q.customerName);
    check("2.2 โชว์ราคาเต็ม (subtotal/discount/tax/total)", q.subtotal === 5000 && q.discount === 200 && q.tax === 336 && q.totalAmount === 5136);
    check("2.3 รายการมีราคาต่อหน่วย+รวม", q.items.length === 1 && q.items[0].unitPrice === 50 && q.items[0].totalPrice === 5000);
    const keys = Object.keys(q);
    const forbidden = ["notes", "orderId", "createdById", "createdBy", "customerId", "sentAt", "acceptedAt"];
    const leaked = forbidden.filter((k) => keys.includes(k));
    check("2.4 ไม่รั่ว notes/orderId/createdBy/customerId ภายใน", leaked.length === 0, leaked.join(","));
    check("2.5 isExpired = false (ยังไม่หมดอายุ)", q.isExpired === false);

    // ── 3. accept (public) ──
    const before = await prisma.notification.count({ where: { entityType: "QUOTATION", entityId: sent.id } });
    const res = await publicCaller.quotationConfirm.accept({ token });
    check("3.1 accept คืน ACCEPTED", res.status === "ACCEPTED");
    const after = await prisma.quotation.findUniqueOrThrow({ where: { id: sent.id }, select: { status: true, acceptedAt: true } });
    check("3.2 ใบเป็น ACCEPTED + ปั๊ม acceptedAt", after.status === "ACCEPTED" && !!after.acceptedAt);
    const notif = await prisma.notification.count({ where: { entityType: "QUOTATION", entityId: sent.id } });
    check("3.3 เด้งกระดิ่งทีม (OWNER/MANAGER/SALES)", notif - before === teamCount && teamCount > 0, `+${notif - before} (ทีม ${teamCount})`);
    const acceptAgain = await expectThrow(() => publicCaller.quotationConfirm.accept({ token }));
    check("3.4 accept ซ้ำ → CONFLICT (กดสองที)", acceptAgain);
    const q2 = await publicCaller.quotationConfirm.getQuote({ token });
    check("3.5 getQuote หลัง accept → status ACCEPTED", q2.status === "ACCEPTED");

    // ── 4. reject (public) ──
    const sent2 = await mkQuote({ status: "SENT", validUntil: FUTURE() });
    const link2 = await ownerCaller.quotationConfirm.generateLink({ quotationId: sent2.id });
    const before2 = await prisma.notification.count({ where: { entityType: "QUOTATION", entityId: sent2.id } });
    const rej = await publicCaller.quotationConfirm.reject({ token: link2.token, reason: "ขอลดราคาหน่อย" });
    check("4.1 reject คืน REJECTED", rej.status === "REJECTED");
    const after2 = await prisma.quotation.findUniqueOrThrow({ where: { id: sent2.id }, select: { status: true, rejectedReason: true, rejectedAt: true } });
    check("4.2 ใบเป็น REJECTED + เก็บเหตุผล + rejectedAt", after2.status === "REJECTED" && after2.rejectedReason === "ขอลดราคาหน่อย" && !!after2.rejectedAt);
    const notif2 = await prisma.notification.count({ where: { entityType: "QUOTATION", entityId: sent2.id } });
    check("4.3 reject เด้งกระดิ่งทีม", notif2 - before2 === teamCount);
    const rejAgain = await expectThrow(() => publicCaller.quotationConfirm.reject({ token: link2.token }));
    check("4.4 reject ใบที่ตัดสินแล้ว → CONFLICT", rejAgain);

    // ── 5. หมดอายุ / DRAFT / token มั่ว ──
    const expiredTok = "expiredtok" + "0".repeat(54);
    await mkQuote({ status: "SENT", validUntil: PAST(), token: expiredTok });
    const qe = await publicCaller.quotationConfirm.getQuote({ token: expiredTok });
    check("5.1 ใบหมดอายุ → getQuote isExpired = true", qe.isExpired === true);
    const acceptExpired = await expectThrow(() => publicCaller.quotationConfirm.accept({ token: expiredTok }));
    check("5.2 accept ใบหมดอายุ → ปฏิเสธ", acceptExpired);

    const draftTok = "drafttok00" + "0".repeat(54);
    await mkQuote({ status: "DRAFT", validUntil: FUTURE(), token: draftTok, sentAt: null });
    const draftLeak = await expectThrow(() => publicCaller.quotationConfirm.getQuote({ token: draftTok }));
    check("5.3 ใบ DRAFT (ถูกดึงกลับแก้) → getQuote ปฏิเสธ (กันราคาร่างรั่ว)", draftLeak);

    const badGet = await expectThrow(() => publicCaller.quotationConfirm.getQuote({ token: "ไม่มีจริง" }));
    const badAccept = await expectThrow(() => publicCaller.quotationConfirm.accept({ token: "ไม่มีจริง" }));
    check("5.4 token มั่ว → getQuote + accept ปฏิเสธ", badGet && badAccept);

    // ── 6. regenerate ลิงก์เก่าตาย ──
    const sent3 = await mkQuote({ status: "SENT", validUntil: FUTURE() });
    const l1 = await ownerCaller.quotationConfirm.generateLink({ quotationId: sent3.id });
    const l2 = await ownerCaller.quotationConfirm.generateLink({ quotationId: sent3.id });
    check("6.1 สร้างลิงก์ใหม่ได้ token ใหม่", l1.token !== l2.token);
    const oldDead = await expectThrow(() => publicCaller.quotationConfirm.getQuote({ token: l1.token }));
    check("6.2 token เก่าใช้ไม่ได้แล้ว (ลิงก์เก่าตาย)", oldDead);
  } finally {
    if (qids.length) {
      await prisma.notification.deleteMany({ where: { entityType: "QUOTATION", entityId: { in: qids } } });
      await prisma.quotation.deleteMany({ where: { id: { in: qids } } });
    }
    if (customer) await prisma.customer.delete({ where: { id: customer.id } });
  }

  console.log(`\n${pass} PASS / ${fails.length} FAIL`);
  if (fails.length > 0) { console.log("FAILED:", fails.join(" · ")); process.exitCode = 1; }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
