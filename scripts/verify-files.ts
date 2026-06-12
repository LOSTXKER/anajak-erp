/**
 * verify ไฟล์ 3 ชั้น + signed URL proxy (ก้อน 4 ชิ้น 1) — integration จริงกับ DB
 * รัน: npm run verify:files [-- --base-url=http://localhost:3001]
 * ข้อมูลใช้ marker [FILES-VERIFY] ลบเกลี้ยงท้ายสคริปต์ (รวม object ใน storage)
 *
 * ส่วน HTTP (route /api/files) ต้องมี dev server รันอยู่ — ไม่เจอ server = FAIL ชัดๆ
 * (ไม่ skip เงียบ ตามกติกา "เคลมเสร็จต้องรันจริง")
 */
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase-admin";
import { FILE_PROXY_PREFIX } from "@/lib/file-urls";

const MARK = "[FILES-VERIFY]";
const baseUrlArg = process.argv.find((a) => a.startsWith("--base-url="));
const BASE_URL = baseUrlArg?.split("=")[1] ?? "http://localhost:3000";

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

// public URL ปลอมหน้าตาเหมือนของจริง — ใช้ทดสอบ normalize (host ไม่สำคัญ)
const FAKE_PUBLIC = (p: string) =>
  `https://fakeproj.supabase.co/storage/v1/object/public/designs/${p}`;

async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const ownerCaller = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });
  // role จาก ctx — ใช้ user เดิมสวม role ขายเพื่อทดสอบ gate ได้
  const salesCaller = appRouter.createCaller({ prisma, userId: owner.id, userRole: "SALES" });

  // สร้าง admin client "ก่อน" เขียน DB ใดๆ — env ไม่ครบต้อง throw ตั้งแต่ยังไม่มีขยะ
  const admin = createAdminClient();
  const storagePath = `verify/${Date.now()}-files-verify.png`;
  // PNG 1x1 จริง — ให้ storage มี object ให้ sign
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );

  // ประกาศนอก try — finally ลบเฉพาะที่สร้างสำเร็จ (fail กลางทางต้องไม่ทิ้งขยะใน DB จริง)
  let customer: { id: string } | null = null;
  let order: { id: string } | null = null;

  try {
    customer = await prisma.customer.create({
      data: { name: `${MARK} ลูกค้าทดสอบ`, customerType: "INDIVIDUAL" },
    });
    order = await prisma.order.create({
      data: {
        orderNumber: `TEST-FILES-${Date.now()}`,
        title: `${MARK} งานทดสอบไฟล์`,
        customerId: customer.id,
        createdById: owner.id,
        internalStatus: "DESIGNING",
      },
    });
    // ── 1. normalize ที่ทางเข้าเขียน (กัน URL round-trip pollution) ──
    const att1 = await ownerCaller.attachment.create({
      entityType: "ORDER",
      entityId: order.id,
      fileName: "chat-ref.png",
      fileUrl: FAKE_PUBLIC("orders/x/chat-ref.png"),
      fileType: "image/png",
      fileSize: 123,
      category: "OTHER",
    });
    check(
      "1.1 attachment.create แปลง public URL → proxy URL",
      att1.fileUrl === `${FILE_PROXY_PREFIX}designs/orders/x/chat-ref.png`,
      att1.fileUrl
    );

    const att2 = await ownerCaller.attachment.create({
      entityType: "ORDER",
      entityId: order.id,
      fileName: "echo.png",
      fileUrl: `${FILE_PROXY_PREFIX}designs/orders/x/echo.png?t=staletoken`,
      fileType: "image/png",
      fileSize: 123,
      category: "OTHER",
    });
    check(
      "1.2 proxy URL ที่มี ?t= ติดมา ถูกตัด query ก่อนลง DB",
      att2.fileUrl === `${FILE_PROXY_PREFIX}designs/orders/x/echo.png`,
      att2.fileUrl
    );

    const extUrl = "https://example.com/outside.png";
    const att3 = await ownerCaller.attachment.create({
      entityType: "ORDER",
      entityId: order.id,
      fileName: "outside.png",
      fileUrl: extUrl,
      fileType: "image/png",
      fileSize: 123,
      category: "OTHER",
    });
    check("1.3 URL นอกระบบไม่ถูกแตะ", att3.fileUrl === extUrl, att3.fileUrl);

    // ── 2. ชั้น 3 (PRINT_FILE) — gate role ──
    let salesBlocked = false;
    try {
      await salesCaller.attachment.create({
        entityType: "ORDER",
        entityId: order.id,
        fileName: "gang.pdf",
        fileUrl: FAKE_PUBLIC("orders/x/gang.pdf"),
        fileType: "application/pdf",
        fileSize: 999,
        category: "PRINT_FILE",
      });
    } catch {
      salesBlocked = true;
    }
    check("2.1 SALES แนบไฟล์พิมพ์จริงไม่ได้ (FORBIDDEN)", salesBlocked);

    const printAtt = await ownerCaller.attachment.create({
      entityType: "ORDER",
      entityId: order.id,
      fileName: "gang.pdf",
      fileUrl: FAKE_PUBLIC("orders/x/gang.pdf"),
      fileType: "application/pdf",
      fileSize: 999,
      category: "PRINT_FILE",
    });
    check("2.2 OWNER แนบไฟล์พิมพ์จริงได้", printAtt.category === "PRINT_FILE");

    let badCategory = false;
    try {
      await ownerCaller.attachment.create({
        entityType: "ORDER",
        entityId: order.id,
        fileName: "x.png",
        fileUrl: FAKE_PUBLIC("orders/x/x.png"),
        fileType: "image/png",
        fileSize: 1,
        category: "NOT_A_CATEGORY" as never,
      });
    } catch {
      badCategory = true;
    }
    check("2.3 category นอกลิสต์ถูกปฏิเสธ", badCategory);

    // ── 3. design.upload + getByToken (หน้า approve ลูกค้า) ──
    // อัปไฟล์จริงขึ้น storage ให้มี object ให้ sign
    const up = await admin.storage.from("designs").upload(storagePath, png, {
      contentType: "image/png",
    });
    check("3.0 อัปไฟล์ทดสอบขึ้น storage ได้ (service role)", !up.error, up.error?.message);

    const design = await ownerCaller.design.upload({
      orderId: order.id,
      fileUrl: FAKE_PUBLIC(storagePath), // จงใจส่ง public URL — ต้องถูก normalize
    });
    check(
      "3.1 design.upload แปลง public URL → proxy URL",
      design.fileUrl === `${FILE_PROXY_PREFIX}designs/${storagePath}`,
      design.fileUrl
    );
    const token = design.approvalToken!;

    const byToken = await ownerCaller.design.getByToken({ token });
    check(
      "3.2 getByToken คืน fileUrl พร้อม ?t=token (ลูกค้าไม่มี session)",
      byToken.fileUrl === `${FILE_PROXY_PREFIX}designs/${storagePath}?t=${encodeURIComponent(token)}`,
      byToken.fileUrl ?? "(null)"
    );
    check(
      "3.3 getByToken ไม่หลุด approvalToken/id ทั้ง row",
      !("approvalToken" in byToken) && !("id" in byToken)
    );

    // ── 4. HTTP route /api/files (ต้องมี dev server) ──
    const proxyPath = `${BASE_URL}/api/files/designs/${storagePath}`;
    let httpOk = true;
    try {
      const noAuth = await fetch(proxyPath, { redirect: "manual" });
      check("4.1 ไม่มี session/token → 401", noAuth.status === 401, `${noAuth.status}`);

      const withToken = await fetch(`${proxyPath}?t=${encodeURIComponent(token)}`, {
        redirect: "manual",
      });
      const loc = withToken.headers.get("location") ?? "";
      check(
        "4.2 token จริง + ไฟล์ของแบบใบนั้น → 302 ไป signed URL",
        withToken.status === 302 && loc.includes("/storage/v1/object/sign/designs/"),
        `${withToken.status} ${loc.slice(0, 80)}`
      );

      if (loc) {
        const signed = await fetch(loc);
        check("4.3 signed URL เปิดได้จริง (ไฟล์กลับมาครบ)", signed.ok, `${signed.status}`);
      } else {
        check("4.3 signed URL เปิดได้จริง (ไฟล์กลับมาครบ)", false, "ไม่มี Location จาก 4.2");
      }

      const wrongFile = await fetch(
        `${BASE_URL}/api/files/designs/orders/x/echo.png?t=${encodeURIComponent(token)}`,
        { redirect: "manual" }
      );
      check("4.4 token จริงแต่ขอไฟล์อื่น → 403", wrongFile.status === 403, `${wrongFile.status}`);

      // ตัดสินแบบแล้ว token expire ไป (เคสหมดอายุ): จำลองด้วย set tokenExpiresAt อดีต
      await prisma.designVersion.update({
        where: { id: design.id },
        data: { tokenExpiresAt: new Date(Date.now() - 1000) },
      });
      const expired = await fetch(`${proxyPath}?t=${encodeURIComponent(token)}`, {
        redirect: "manual",
      });
      check("4.5 token หมดอายุ → 403", expired.status === 403, `${expired.status}`);
    } catch (err) {
      httpOk = false;
      check(
        "4.x HTTP route ทดสอบไม่ได้ — dev server ไม่ได้รันที่ " + BASE_URL,
        false,
        err instanceof Error ? err.message : String(err)
      );
    }
    void httpOk;

    // ── 5. backfill migration เกลี้ยง — ไม่เหลือ public URL ใน DB ──
    const legacyCounts = await prisma.$queryRaw<{ src: string; n: bigint }[]>`
      SELECT 'users.avatar_url' AS src, count(*) AS n FROM users WHERE avatar_url LIKE '%/storage/v1/object/public/%'
      UNION ALL SELECT 'brand_profiles.logo_url', count(*) FROM brand_profiles WHERE logo_url LIKE '%/storage/v1/object/public/%'
      UNION ALL SELECT 'order_item_products.pattern_file_url', count(*) FROM order_item_products WHERE pattern_file_url LIKE '%/storage/v1/object/public/%'
      UNION ALL SELECT 'order_item_prints.design_image_url', count(*) FROM order_item_prints WHERE design_image_url LIKE '%/storage/v1/object/public/%'
      UNION ALL SELECT 'patterns.file_url', count(*) FROM patterns WHERE file_url LIKE '%/storage/v1/object/public/%'
      UNION ALL SELECT 'patterns.thumbnail_url', count(*) FROM patterns WHERE thumbnail_url LIKE '%/storage/v1/object/public/%'
      UNION ALL SELECT 'quotations.pdf_url', count(*) FROM quotations WHERE pdf_url LIKE '%/storage/v1/object/public/%'
      UNION ALL SELECT 'products.image_url', count(*) FROM products WHERE image_url LIKE '%/storage/v1/object/public/%'
      UNION ALL SELECT 'products.images', count(*) FROM products WHERE EXISTS (SELECT 1 FROM unnest(images) u WHERE u LIKE '%/storage/v1/object/public/%')
      UNION ALL SELECT 'attachments.file_url', count(*) FROM attachments WHERE file_url LIKE '%/storage/v1/object/public/%'
      UNION ALL SELECT 'design_versions.file_url', count(*) FROM design_versions WHERE file_url LIKE '%/storage/v1/object/public/%'
      UNION ALL SELECT 'design_versions.thumbnail_url', count(*) FROM design_versions WHERE thumbnail_url LIKE '%/storage/v1/object/public/%'
      UNION ALL SELECT 'goods_receipts.photo_urls', count(*) FROM goods_receipts WHERE EXISTS (SELECT 1 FROM unnest(photo_urls) u WHERE u LIKE '%/storage/v1/object/public/%')
      UNION ALL SELECT 'qc_defects.photo_urls', count(*) FROM qc_defects WHERE EXISTS (SELECT 1 FROM unnest(photo_urls) u WHERE u LIKE '%/storage/v1/object/public/%')
      UNION ALL SELECT 'payments.evidence_url', count(*) FROM payments WHERE evidence_url LIKE '%/storage/v1/object/public/%'
      UNION ALL SELECT 'wht_certificates.file_url', count(*) FROM wht_certificates WHERE file_url LIKE '%/storage/v1/object/public/%'
    `;
    const leftover = legacyCounts.filter((r) => Number(r.n) > 0);
    check(
      "5.1 ไม่เหลือ Supabase public URL ใน DB (16 คอลัมน์/13 ตาราง)",
      leftover.length === 0,
      leftover.map((r) => `${r.src}=${r.n}`).join(", ")
    );
  } finally {
    // ── cleanup — ลบเกลี้ยงทุกอย่างที่สร้างสำเร็จ ──
    if (order) {
      await prisma.designVersion.deleteMany({ where: { orderId: order.id } });
      await prisma.attachment.deleteMany({ where: { entityType: "ORDER", entityId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
    if (customer) {
      await prisma.customer.delete({ where: { id: customer.id } });
    }
    await admin.storage.from("designs").remove([storagePath]);
  }

  console.log(`\n${pass} PASS / ${fails.length} FAIL`);
  if (fails.length > 0) {
    console.log("FAILED:", fails.join(" · "));
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
