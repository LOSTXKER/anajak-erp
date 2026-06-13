/**
 * verify ลิงก์อัปโหลดไฟล์ลูกค้า (ก้อน 4 ชิ้น 3) — integration จริงกับ DB + storage
 * รัน: npm run verify:upload
 * ทดสอบ flow ลูกค้าไม่ login: generateLink → getInfo → createUploadUrl →
 *   อัปจริงผ่าน signed URL (anon client) → confirmUpload → Attachment โผล่
 * + ด่านความปลอดภัย: gate role / ext / ขนาด / path ข้ามออเดอร์ / phantom / หมดอายุ
 * ข้อมูลใช้ marker [UPLOAD-VERIFY] ลบเกลี้ยงท้ายสคริปต์ (รวม object ใน storage)
 */
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { FILE_PROXY_PREFIX } from "@/lib/file-urls";

const MARK = "[UPLOAD-VERIFY]";

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

async function expectThrow(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

// PNG 1x1 จริง
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function main() {
  const owner = await prisma.user.findFirstOrThrow({
    where: { role: "OWNER", isActive: true },
  });
  const ownerCaller = appRouter.createCaller({
    prisma,
    userId: owner.id,
    userRole: owner.role,
  });
  const staffCaller = appRouter.createCaller({
    prisma,
    userId: owner.id,
    userRole: "PRODUCTION_STAFF",
  });
  // ลูกค้าไม่มี session
  const publicCaller = appRouter.createCaller({
    prisma,
    userId: null as never,
    userRole: null as never,
  });

  // anon client (ใบเบิกทางคือ signed token — ไม่ต้อง login) จำลองลูกค้าจริง
  const anon = createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  let customer: { id: string } | null = null;
  let order: { id: string; orderNumber: string } | null = null;
  const uploadedPaths: string[] = [];

  try {
    customer = await prisma.customer.create({
      data: { name: `${MARK} ลูกค้าทดสอบ`, customerType: "INDIVIDUAL" },
    });
    order = await prisma.order.create({
      data: {
        orderNumber: `TEST-UPLOAD-${Date.now()}`,
        title: `${MARK} งานทดสอบอัปโหลด`,
        customerId: customer.id,
        createdById: owner.id,
        internalStatus: "DESIGNING",
        deadline: new Date(Date.now() + 7 * 86400000),
      },
    });

    // ── 1. staff สร้างลิงก์ + gate role ──
    const blockedStaff = await expectThrow(() =>
      staffCaller.customerUpload.generateLink({ orderId: order!.id })
    );
    check("1.1 PRODUCTION_STAFF สร้างลิงก์ไม่ได้ (FORBIDDEN)", blockedStaff);

    const link = await ownerCaller.customerUpload.generateLink({
      orderId: order.id,
    });
    check("1.2 OWNER สร้างลิงก์ได้ (ได้ token)", !!link.token && link.token.length >= 32);

    const got = await ownerCaller.customerUpload.getLink({ orderId: order.id });
    check("1.3 getLink คืน token เดียวกัน", got.token === link.token, got.token ?? "(null)");

    const token = link.token;

    // ── 2. getInfo (public) — โชว์เฉพาะข้อมูลลูกค้า ──
    const info = await publicCaller.customerUpload.getInfo({ token });
    check(
      "2.1 getInfo คืนข้อมูลออเดอร์ (เลข/ชื่องาน/ลูกค้า)",
      info.orderNumber === order.orderNumber && !!info.title && !!info.customerName
    );
    check("2.2 getInfo ไม่หลุดข้อมูลภายใน (ไม่มี id/เงิน/สถานะ)", !("id" in info) && !("totalAmount" in info));
    check("2.3 ยังไม่มีไฟล์", info.files.length === 0);

    // ── 3. ออก signed URL + อัปจริง + confirm ──
    const signed = await publicCaller.customerUpload.createUploadUrl({
      token,
      fileName: "โลโก้ลูกค้า.png",
      fileSize: PNG.length,
    });
    check(
      "3.1 createUploadUrl ออก path ใต้ <orderId>/customer/",
      signed.path.startsWith(`${order.id}/customer/`) && !!signed.uploadToken,
      signed.path
    );

    const up = await anon.storage
      .from(signed.bucket)
      .uploadToSignedUrl(signed.path, signed.uploadToken, PNG, {
        contentType: "image/png",
      });
    check("3.2 อัปไฟล์ผ่าน signed URL สำเร็จ (ไม่ต้อง login)", !up.error, up.error?.message);
    if (!up.error) uploadedPaths.push(signed.path);

    await publicCaller.customerUpload.confirmUpload({
      token,
      path: signed.path,
      fileName: "โลโก้ลูกค้า.png",
      fileType: "image/png",
      fileSize: PNG.length,
    });

    const att = await prisma.attachment.findFirst({
      where: { entityType: "ORDER", entityId: order.id, uploadedById: null },
    });
    check(
      "3.3 confirmUpload สร้าง Attachment (uploadedById=null, category RAW, proxy URL)",
      !!att &&
        att.uploadedById === null &&
        att.category === "REFERENCE_IMAGE" &&
        att.fileUrl === `${FILE_PROXY_PREFIX}designs/${signed.path}`,
      att?.fileUrl
    );

    const info2 = await publicCaller.customerUpload.getInfo({ token });
    check("3.4 getInfo โชว์ไฟล์ที่อัปแล้ว", info2.files.length === 1 && info2.files[0].fileName === "โลโก้ลูกค้า.png");

    // ── 4. ด่านความปลอดภัย ──
    const badExt = await expectThrow(() =>
      publicCaller.customerUpload.createUploadUrl({
        token,
        fileName: "virus.exe",
        fileSize: 100,
      })
    );
    check("4.1 นามสกุลนอกบัญชีขาว (.exe) ถูกปฏิเสธ", badExt);

    const tooBig = await expectThrow(() =>
      publicCaller.customerUpload.createUploadUrl({
        token,
        fileName: "huge.png",
        fileSize: 999 * 1024 * 1024,
      })
    );
    check("4.2 ไฟล์ใหญ่เกิน cap ถูกปฏิเสธ", tooBig);

    // confirm path ข้ามออเดอร์/ข้ามชั้น (ยัด path มั่ว)
    const crossPath = await expectThrow(() =>
      publicCaller.customerUpload.confirmUpload({
        token,
        path: `someoneelse/customer/x.png`,
        fileName: "x.png",
        fileType: "image/png",
        fileSize: 10,
      })
    );
    check("4.3 confirm path ข้ามออเดอร์ถูกปฏิเสธ", crossPath);

    // phantom: path ใต้ออเดอร์นี้แต่ไม่มีไฟล์จริง
    const phantom = await expectThrow(() =>
      publicCaller.customerUpload.confirmUpload({
        token,
        path: `${order!.id}/customer/never-uploaded.png`,
        fileName: "ghost.png",
        fileType: "image/png",
        fileSize: 10,
      })
    );
    check("4.4 confirm ไฟล์ที่ไม่ได้อัปจริง (phantom) ถูกปฏิเสธ", phantom);

    // ── 5. token หมดอายุ → public ทุกตัวปิด ──
    await prisma.order.update({
      where: { id: order.id },
      data: { uploadTokenExpiresAt: new Date(Date.now() - 1000) },
    });
    const expiredInfo = await expectThrow(() =>
      publicCaller.customerUpload.getInfo({ token })
    );
    check("5.1 token หมดอายุ → getInfo ปฏิเสธ", expiredInfo);
    const expiredCreate = await expectThrow(() =>
      publicCaller.customerUpload.createUploadUrl({ token, fileName: "a.png", fileSize: 10 })
    );
    check("5.2 token หมดอายุ → createUploadUrl ปฏิเสธ", expiredCreate);

    // token มั่ว → ปฏิเสธ
    const badToken = await expectThrow(() =>
      publicCaller.customerUpload.getInfo({ token: "ไม่มีจริง" })
    );
    check("5.3 token ไม่มีจริง → ปฏิเสธ", badToken);
  } finally {
    if (order) {
      await prisma.attachment.deleteMany({
        where: { entityType: "ORDER", entityId: order.id },
      });
      await prisma.order.delete({ where: { id: order.id } });
    }
    if (customer) {
      await prisma.customer.delete({ where: { id: customer.id } });
    }
    if (uploadedPaths.length > 0) {
      const admin = createSbClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await admin.storage.from("designs").remove(uploadedPaths);
    }
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
