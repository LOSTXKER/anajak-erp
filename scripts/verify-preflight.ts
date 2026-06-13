/**
 * verify preflight ไฟล์งานพิมพ์ DTF (ก้อน 4) — integration จริงกับ DB + storage + Gemini
 * รัน: npm run verify:preflight
 * เน้น: SKIP (.ai/.psd) · ERROR (ไฟล์หาย) · pipeline เต็ม (โหลดไฟล์→แกะ header→Gemini→เก็บผล) ·
 *   idempotent (upsert แถวเดียว) · เก็บค่าถูกชนิด
 * ใช้ storage จริง — อัปไฟล์ทดสอบลง bucket designs แล้วลบเกลี้ยงท้ายสคริปต์
 */
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase-admin";
import { proxyFileUrl } from "@/lib/file-urls";
import { runFilePreflight } from "@/server/services/preflight";

// 1x1 PNG โปร่งใส (PNG จริง valid — RGBA colorType 6)
const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; console.log(`PASS: ${name}`); }
  else { fails.push(name); console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function main() {
  const admin = createAdminClient();
  const stamp = Date.now();
  const objectPath = `preflight-verify/test-${stamp}.png`;
  const realUrl = proxyFileUrl("designs", objectPath);
  const skipUrl = proxyFileUrl("designs", `preflight-verify/art-${stamp}.ai`);
  const missingUrl = proxyFileUrl("designs", `preflight-verify/missing-${stamp}.png`);
  const cleanupUrls = [realUrl, skipUrl, missingUrl];

  try {
    // ── 1. SKIP (.ai — ไม่ต้องมีไฟล์จริง classifyFile ตัดก่อนโหลด) ──
    const skip = await runFilePreflight(prisma, { fileUrl: skipUrl });
    check("1.1 .ai → verdict SKIPPED", skip.verdict === "SKIPPED");
    check("1.2 .ai → format AI + ไม่เรียก AI (model null)", skip.format === "AI" && skip.model === null);

    // ── 2. ERROR (raster แต่ไฟล์ไม่มีจริง → โหลดไม่ได้) ──
    const err = await runFilePreflight(prisma, { fileUrl: missingUrl });
    check("2.1 raster ไฟล์หาย → verdict ERROR", err.verdict === "ERROR");

    // ── 3. pipeline เต็ม (อัป PNG จริง → โหลด → แกะ header → Gemini → เก็บผล) ──
    const buf = Buffer.from(PNG_1x1, "base64");
    const up = await admin.storage.from("designs").upload(objectPath, buf, {
      contentType: "image/png", upsert: false,
    });
    if (up.error) throw new Error(`อัปไฟล์ทดสอบไม่สำเร็จ: ${up.error.message}`);

    const res = await runFilePreflight(prisma, { fileUrl: realUrl });
    check("3.1 verdict เป็นค่าที่ถูกต้อง (GREEN/YELLOW/RED)", ["GREEN", "YELLOW", "RED"].includes(res.verdict), res.verdict);
    check("3.2 แกะ header ได้ (format PNG · width 1 · hasAlpha true)", res.format === "PNG" && res.width === 1 && res.hasAlpha === true);
    check("3.3 AI รันจริง (model = gemini)", !!res.model && res.model.includes("gemini"), res.model ?? "null");
    check("3.4 มี summary จาก AI", typeof res.summary === "string" && res.summary.length > 0);

    // เก็บลง DB จริง
    const row = await prisma.filePreflight.findUnique({ where: { fileUrl: realUrl } });
    check("3.5 บันทึกแถว FilePreflight ลง DB", !!row && row.verdict === res.verdict);

    // ── 4. idempotent (รันซ้ำ = upsert แถวเดียว) ──
    await runFilePreflight(prisma, { fileUrl: realUrl });
    const count = await prisma.filePreflight.count({ where: { fileUrl: realUrl } });
    check("4.1 รันซ้ำ → แถวเดียว (upsert ไม่เพิ่มซ้ำ)", count === 1);
  } finally {
    await prisma.filePreflight.deleteMany({ where: { fileUrl: { in: cleanupUrls } } });
    try { await createAdminClient().storage.from("designs").remove([objectPath]); } catch { /* ignore */ }
  }

  console.log(`\n${pass} PASS / ${fails.length} FAIL`);
  if (fails.length > 0) { console.log("FAILED:", fails.join(" · ")); process.exitCode = 1; }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
