// verify จริงกับ DB: ลิงก์ใบงานร้านนอก LINE-friendly (Gate B14)
// (1) สร้าง/หมุนลิงก์ + เปิดผ่าน token (2) payload ครบ จำนวน×ไซซ์/ลาย/กำหนดรับ
// (3) กันรั่ว: ค่าจ้าง/ราคาขาย/ชื่อลูกค้า/qcNotes ต้องไม่โผล่ (4) ไฟล์แนบ OUTSOURCE_ORDER
// (5) allowlist ไฟล์ของ proxy (6) หมดอายุ/token มั่ว fail-closed (7) role gate
// ลบข้อมูลทดสอบเกลี้ยง · ห้ามรันบน DB ใช้งานจริง
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";
import { allowedShareFileUrls } from "@/server/services/outsource-share";

const MARK = "[OSHARE-VERIFY]";

let passCount = 0;
const fails: string[] = [];
function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passCount++;
    console.log("PASS:", name);
  } else {
    fails.push(name);
    console.log("FAIL:", name, "→", JSON.stringify(detail));
  }
}
async function expectError(name: string, fn: () => Promise<unknown>, msgPart: string) {
  try {
    await fn();
    ok(name, false, "ไม่ throw เลย");
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    ok(name, m.includes(msgPart), m);
  }
}

async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const ownerCaller = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });
  const staffCaller = appRouter.createCaller({
    prisma,
    userId: owner.id,
    userRole: "PRODUCTION_STAFF",
  });
  const salesCaller = appRouter.createCaller({ prisma, userId: owner.id, userRole: "SALES" });
  const publicCaller = appRouter.createCaller({
    prisma,
    userId: null as never,
    userRole: null as never,
  });

  const ids = { customer: "", order: "", vendor: "" };

  try {
    const customer = await prisma.customer.create({ data: { name: `${MARK} ลูกค้าห้ามรั่ว` } });
    ids.customer = customer.id;
    const vendor = await prisma.vendor.create({
      data: { name: `${MARK} ร้านสกรีนทดสอบ`, capabilities: ["สกรีน"] },
    });
    ids.vendor = vendor.id;

    // ออเดอร์มีตารางไซซ์ + สเปคพิมพ์ + แบบอนุมัติ — ครบทุกอย่างที่หน้าแชร์ต้องโชว์
    const order = await prisma.order.create({
      data: {
        orderNumber: `TEST-OSHARE-${Date.now()}`,
        orderType: "CUSTOM",
        channel: "LINE",
        customerId: customer.id,
        createdById: owner.id,
        internalStatus: "PRODUCING",
        customerStatus: "IN_PRODUCTION",
        title: `${MARK} งานสกรีนส่งร้านนอก`,
        totalAmount: 12345.67,
        items: {
          create: [
            {
              description: "เสื้อสกรีนหน้าอก",
              totalQuantity: 30,
              subtotal: 12345.67,
              products: {
                create: [
                  {
                    productType: "TSHIRT",
                    description: "เสื้อยืดคอกลม ดำ",
                    totalQuantity: 30,
                    baseUnitPrice: 300, // ราคาขายลับ — ต้องไม่โผล่หน้าแชร์
                    subtotal: 9000,
                    variants: {
                      create: [
                        { size: "L", color: "ดำ", quantity: 10 },
                        { size: "M", color: "ดำ", quantity: 20 },
                      ],
                    },
                  },
                ],
              },
              prints: {
                create: [
                  {
                    position: "FRONT",
                    printType: "SILK_SCREEN",
                    printSize: "A4",
                    colorCount: 2,
                    designNote: "สีขาวบนผ้าดำ",
                    designImageUrl: "/api/files/designs/test/oshare-print.png",
                    unitPrice: 45,
                  },
                ],
              },
            },
          ],
        },
        designs: {
          create: [
            {
              versionNumber: 1,
              fileUrl: "/api/files/designs/test/oshare-design.png",
              thumbnailUrl: "/api/files/designs/test/oshare-design-thumb.png",
              approvalStatus: "APPROVED",
            },
          ],
        },
      },
    });
    ids.order = order.id;

    const production = await ownerCaller.production.create({
      orderId: order.id,
      steps: [{ stepType: "SCREEN_PRINTING", sortOrder: 1 }],
    });
    const step = production.steps[0];
    const job = await ownerCaller.outsource.createOrder({
      productionStepId: step.id,
      vendorId: vendor.id,
      description: `${MARK} สกรีนหน้าอก`,
      quantity: 25, // แบ่งส่ง — น้อยกว่าตารางไซซ์ทั้งออเดอร์ (30)
      unitCost: 12.5, // ค่าจ้างลับ — ต้องไม่โผล่หน้าแชร์
      expectedBackAt: new Date(Date.now() + 3 * 86400_000).toISOString(),
      notes: "ผ้าหนา รีดอุณหภูมิต่ำ",
    });

    // ---------- 1) สร้างลิงก์ + เปิดผ่าน token ----------
    const staffLink = await staffCaller.outsourceShare.generateLink({ outsourceOrderId: job.id });
    ok("1.1 PRODUCTION_STAFF สร้างลิงก์ได้ (ตรง productionUp)", /^[0-9a-f]{64}$/.test(staffLink.token), staffLink.token);
    await expectError(
      "1.2 SALES สร้างลิงก์ไม่ได้ (role gate)",
      () => salesCaller.outsourceShare.generateLink({ outsourceOrderId: job.id }),
      "สิทธิ์"
    );
    await expectError(
      "1.3 ใบงานไม่มีจริง → notFound",
      () => ownerCaller.outsourceShare.generateLink({ outsourceOrderId: "ไม่มีจริง" }),
      "ไม่พบ"
    );

    const { token } = await ownerCaller.outsourceShare.generateLink({ outsourceOrderId: job.id });
    await expectError(
      "1.4 หมุนลิงก์แล้ว token เก่าตายทันที",
      () => publicCaller.outsourceShare.getByToken({ token: staffLink.token }),
      "ไม่พบ"
    );
    const gotLink = await ownerCaller.outsourceShare.getLink({ outsourceOrderId: job.id });
    ok("1.5 getLink คืน token ปัจจุบัน", gotLink.token === token, gotLink);
    await expectError(
      "1.6 SALES อ่าน getLink ไม่ได้ (gate เท่า generateLink — กันแจกลิงก์ข้าม role)",
      () => salesCaller.outsourceShare.getLink({ outsourceOrderId: job.id }),
      "สิทธิ์"
    );

    // ---------- 2) payload ครบ: จำนวน×ไซซ์/ลาย/กำหนดรับ ----------
    const d = await publicCaller.outsourceShare.getByToken({ token });
    ok("2.1 หัวใบครบ: งาน/จำนวน/ร้าน/กำหนดรับ/หมายเหตุ",
      d.description === `${MARK} สกรีนหน้าอก` &&
        d.quantity === 25 &&
        d.vendorName === `${MARK} ร้านสกรีนทดสอบ` &&
        !!d.expectedBackAt &&
        d.notes === "ผ้าหนา รีดอุณหภูมิต่ำ",
      d
    );
    const variants = d.items.flatMap((it) => it.products.flatMap((p) => p.variants));
    ok("2.2 ตารางไซซ์ครบ (M20 + L10 = ทั้งออเดอร์ 30)",
      d.orderTotalQuantity === 30 &&
        variants.length === 2 &&
        variants.some((v) => v.size === "M" && v.quantity === 20) &&
        variants.some((v) => v.size === "L" && v.quantity === 10),
      variants
    );
    const print = d.items.flatMap((it) => it.prints)[0];
    ok("2.3 สเปคพิมพ์ครบ + รูปลายแปะ ?os=token",
      !!print &&
        print.position === "FRONT" &&
        print.printType === "SILK_SCREEN" &&
        !!print.designImageUrl?.includes(`os=${token}`),
      print
    );
    ok("2.4 แบบอนุมัติแนบมา + รูปแปะ ?os=token",
      !!d.approvedDesign && !!d.approvedDesign.imageUrl?.includes(`os=${token}`),
      d.approvedDesign
    );

    // ---------- 3) กันรั่ว ----------
    const raw = JSON.stringify(d);
    ok("3.1 ค่าจ้างไม่รั่ว (unitCost/totalCost/12.5)",
      !raw.includes("unitCost") && !raw.includes("totalCost") && !raw.includes("12.5"),
      raw.match(/.{0,40}(unitCost|totalCost|12\.5).{0,40}/)?.[0]
    );
    ok("3.2 ราคาขายไม่รั่ว (unitPrice/subtotal/totalAmount/12345)",
      !raw.includes("unitPrice") &&
        !raw.includes("subtotal") &&
        !raw.includes("totalAmount") &&
        !raw.includes("12345"),
      raw.match(/.{0,40}(unitPrice|subtotal|totalAmount|12345).{0,40}/)?.[0]
    );
    ok("3.3 ชื่อลูกค้า/สถานะภายใน/qcNotes ไม่รั่ว",
      !raw.includes("ลูกค้าห้ามรั่ว") && !raw.includes("internalStatus") && !raw.includes("qcNotes"),
      undefined
    );

    // ---------- 4) ไฟล์แนบบนใบ outsource + กันรั่วไฟล์เงิน (review B14 จับ BLOCKER) ----------
    const jobPrefix = `/api/files/designs/outsource/${job.id}`;
    const att = await staffCaller.attachment.create({
      entityType: "OUTSOURCE_ORDER",
      entityId: job.id,
      fileName: "ลายจริง.pdf",
      fileUrl: `${jobPrefix}/oshare-attach.pdf`,
      fileType: "application/pdf",
      fileSize: 1234,
      category: "PRINT_FILE",
    });
    const d2 = await publicCaller.outsourceShare.getByToken({ token });
    ok("4.1 ไฟล์แนบในโฟลเดอร์ใบนี้โผล่บนหน้าแชร์ + URL แปะ ?os=token",
      d2.attachments.length === 1 &&
        d2.attachments[0].fileName === "ลายจริง.pdf" &&
        !!d2.attachments[0].fileUrl?.includes(`os=${token}`),
      d2.attachments
    );
    await expectError(
      "4.2 แนบไฟล์กับใบงานที่ไม่มีจริง → notFound",
      () =>
        staffCaller.attachment.create({
          entityType: "OUTSOURCE_ORDER",
          entityId: "ไม่มีจริง",
          fileName: "x.pdf",
          fileUrl: `${jobPrefix}/x.pdf`,
          fileType: "application/pdf",
          fileSize: 1,
        }),
      "ไม่พบ"
    );
    await expectError(
      "4.3 SALES แนบไฟล์บนใบ outsource ไม่ได้ (write-side gate — กันยัดไฟล์ทาง API)",
      () =>
        salesCaller.attachment.create({
          entityType: "OUTSOURCE_ORDER",
          entityId: job.id,
          fileName: "slip.jpg",
          fileUrl: `${jobPrefix}/slip.jpg`,
          fileType: "image/jpeg",
          fileSize: 1,
          category: "PRINT_FILE",
        }),
      "ทีมผลิต",
    );
    // ยัดไฟล์เงิน (path นอกโฟลเดอร์ใบ) — write-lock ต้องปฏิเสธที่ต้นทาง (ไม่ให้เข้า DB เลย)
    await expectError(
      "4.4 แนบไฟล์ path นอกโฟลเดอร์ใบ (payments/) → ถูกปฏิเสธที่ write",
      () =>
        staffCaller.attachment.create({
          entityType: "OUTSOURCE_ORDER",
          entityId: job.id,
          fileName: "สลิปโอนค่าจ้าง.jpg",
          fileUrl: `/api/files/designs/payments/${ids.order}/slip-secret.jpg`,
          fileType: "image/jpeg",
          fileSize: 5,
          category: "PRINT_FILE",
        }),
      "ช่องแนบไฟล์ของใบ"
    );
    // encoded-traversal (`..%2Fpayments`) เลี่ยง startsWith แต่ isOwnOutsourceFile ปฏิเสธ (skeptic B14)
    await expectError(
      "4.5 แนบไฟล์ encoded-traversal (..%2F) → ถูกปฏิเสธที่ write",
      () =>
        staffCaller.attachment.create({
          entityType: "OUTSOURCE_ORDER",
          entityId: job.id,
          fileName: "evil.jpg",
          fileUrl: `${jobPrefix}/..%2Fpayments%2F${ids.order}%2Fslip.jpg`,
          fileType: "image/jpeg",
          fileSize: 5,
          category: "PRINT_FILE",
        }),
      "ช่องแนบไฟล์ของใบ"
    );
    const d3 = await publicCaller.outsourceShare.getByToken({ token });
    ok("4.6 หน้าแชร์เหลือเฉพาะไฟล์ legit ของใบ (ยัดไฟล์เงินไม่เข้า DB)",
      d3.attachments.length === 1 && !JSON.stringify(d3.attachments).includes("slip"),
      d3.attachments
    );

    // ---------- 5) allowlist ไฟล์ของ proxy (/api/files?os=) ----------
    const allowed = await allowedShareFileUrls(prisma, token);
    ok("5.1 allowlist ครบ: ไฟล์แนบในโฟลเดอร์ใบ+แบบอนุมัติ(2 URL)+รูปลายพิมพ์",
      !!allowed &&
        allowed.includes(`${jobPrefix}/oshare-attach.pdf`) &&
        allowed.includes("/api/files/designs/test/oshare-design.png") &&
        allowed.includes("/api/files/designs/test/oshare-design-thumb.png") &&
        allowed.includes("/api/files/designs/test/oshare-print.png"),
      allowed
    );
    ok("5.2 ไฟล์เงินที่แนบไม่อยู่ใน allowlist (proxy ?os= เปิดไม่ได้)",
      !!allowed && !allowed.some((u) => u.includes("slip-secret")),
      allowed
    );
    const allowedBad = await allowedShareFileUrls(prisma, "token-มั่ว");
    ok("5.3 token มั่ว → allowlist = null (fail-closed)", allowedBad === null, allowedBad);

    // ---------- 6) หมดอายุ fail-closed ----------
    await prisma.outsourceOrder.update({
      where: { id: job.id },
      data: { shareTokenExpiresAt: new Date(Date.now() - 1000) },
    });
    await expectError(
      "6.1 ลิงก์หมดอายุ → เปิดไม่ได้",
      () => publicCaller.outsourceShare.getByToken({ token }),
      "หมดอายุ"
    );
    const allowedExpired = await allowedShareFileUrls(prisma, token);
    ok("6.2 ลิงก์หมดอายุ → allowlist = null (ไฟล์ปิดตาม)", allowedExpired === null, allowedExpired);
    await prisma.outsourceOrder.update({
      where: { id: job.id },
      data: { shareTokenExpiresAt: null },
    });
    await expectError(
      "6.3 ไม่มีวันหมดอายุ = ถือว่าหมดอายุ (fail-closed)",
      () => publicCaller.outsourceShare.getByToken({ token }),
      "หมดอายุ"
    );
    // ยังลบไฟล์แนบได้หลังลิงก์ตาย (staff ทำงานต่อได้ปกติ)
    await staffCaller.attachment.delete({ id: att.id });
    ok("6.4 ลบไฟล์แนบได้ (ไฟล์แนบไม่ผูกอายุลิงก์)", true);
  } finally {
    // ---------- ล้างเกลี้ยง ----------
    const prods = await prisma.production.findMany({
      where: { orderId: ids.order },
      select: { id: true, steps: { select: { id: true } } },
    });
    const stepIds = prods.flatMap((p) => p.steps.map((s) => s.id));
    const osOrders = await prisma.outsourceOrder.findMany({
      where: { productionStepId: { in: stepIds } },
      select: { id: true },
    });
    const osIds = osOrders.map((o) => o.id);
    await prisma.attachment.deleteMany({
      where: { entityType: "OUTSOURCE_ORDER", entityId: { in: osIds } },
    });
    await prisma.auditLog.deleteMany({
      where: {
        entityId: { in: [ids.order, ids.vendor, ...osIds, ...stepIds, ...prods.map((p) => p.id)] },
      },
    });
    await prisma.notification.deleteMany({ where: { entityId: ids.order } });
    await prisma.outsourceOrder.deleteMany({ where: { productionStepId: { in: stepIds } } });
    await prisma.production.deleteMany({ where: { orderId: ids.order } });
    await prisma.designVersion.deleteMany({ where: { orderId: ids.order } });
    if (ids.order) await prisma.order.deleteMany({ where: { id: ids.order } });
    if (ids.vendor) await prisma.vendor.deleteMany({ where: { id: ids.vendor } });
    if (ids.customer) await prisma.customer.deleteMany({ where: { id: ids.customer } });
    await prisma.$disconnect();
  }

  console.log(`\n${passCount} passed, ${fails.length} failed`);
  if (fails.length > 0) {
    console.log("FAILED:", fails.join(" | "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
