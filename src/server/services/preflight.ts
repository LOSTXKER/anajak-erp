// Preflight orchestrator (FLOW-REDESIGN ก้อน 4) — server only · **โค้ดล้วน ไม่มี AI**
//
// รับ fileUrl (proxy) → โหลดไฟล์ (service role) → แกะ header อ่านขนาด → เช็ค "ความละเอียดเล็กไป"
// → เก็บผลลง FilePreflight (1 แถว/ไฟล์) · เบสเคาะ 2026-06-14: ตัด AI ออก (เช็คผิดบ่อย/ตัดสินดีไซน์)
// PDF/.ai/.psd → SKIPPED (อ่านขนาดไม่ได้) · ทุก error ไม่ throw — เก็บ verdict ERROR แทน

import { createAdminClient } from "@/lib/supabase-admin";
import { ALLOWED_FILE_BUCKETS, parseProxyFileUrl, safeDecode } from "@/lib/file-urls";
import { parseImageMeta } from "@/lib/image-meta";
import { classifyFile, evaluateCodeChecks, codeOnlyVerdict, type Verdict } from "@/lib/preflight-rules";
import type { ExtendedPrismaClient } from "@/lib/prisma";

const MAX_FILE_BYTES = 30 * 1024 * 1024; // เพดานอัปจริง 25MB — เกินนี้ผิดปกติ ข้ามการตรวจ

interface SaveData {
  verdict: Verdict;
  format: string | null;
  width: number | null;
  height: number | null;
  hasAlpha: boolean | null;
  summary: string;
  warnings: string[];
  model: string | null;
}

export async function runFilePreflight(prisma: ExtendedPrismaClient, input: { fileUrl: string }) {
  const { fileUrl } = input;
  const { kind, ext } = classifyFile(fileUrl);

  const save = async (data: SaveData) => {
    try {
      return await prisma.filePreflight.upsert({
        where: { fileUrl },
        create: { fileUrl, ...data },
        update: { ...data },
      });
    } catch {
      // contract: runFilePreflight ห้าม throw — เขียน DB ไม่ได้ (P2002 ยิงพร้อมกัน/DB ล่ม)
      // คืน object รูปเดียวกันให้ mutation resolve (UI อ่านผลจาก getByUrls แยกอยู่แล้ว)
      return { fileUrl, ...data };
    }
  };

  // PDF/.ai/.psd/ฯลฯ — อ่านขนาดอัตโนมัติไม่ได้
  if (kind === "SKIP") {
    return save({
      verdict: "SKIPPED",
      format: ext ? ext.toUpperCase() : null,
      width: null, height: null, hasAlpha: null,
      summary: `ไฟล์ .${ext || "?"} ตรวจขนาดอัตโนมัติไม่ได้`,
      warnings: [], model: null,
    });
  }

  // โหลดไฟล์ด้วย service role
  const parsed = parseProxyFileUrl(fileUrl);
  if (!parsed || !(ALLOWED_FILE_BUCKETS as readonly string[]).includes(parsed.bucket)) {
    return save({
      verdict: "ERROR", format: null, width: null, height: null, hasAlpha: null,
      summary: "เปิดไฟล์ไม่ได้ (URL ไม่ถูกต้อง)", warnings: [], model: null,
    });
  }

  // กัน path traversal — segment ว่าง/'.'/'..' ต้องไม่หลุดถึง storage (เลียน guard ของ /api/files)
  const segs = parsed.path.split("/").map(safeDecode);
  if (segs.some((s) => !s || s === "." || s === "..")) {
    return save({
      verdict: "ERROR", format: null, width: null, height: null, hasAlpha: null,
      summary: "เปิดไฟล์ไม่ได้ (path ไม่ถูกต้อง)", warnings: [], model: null,
    });
  }
  const objectPath = segs.join("/");

  let bytes: Uint8Array;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(parsed.bucket).download(objectPath);
    if (error || !data) throw new Error(error?.message || "no data");
    bytes = new Uint8Array(await data.arrayBuffer());
  } catch {
    return save({
      verdict: "ERROR", format: null, width: null, height: null, hasAlpha: null,
      summary: "โหลดไฟล์มาตรวจไม่สำเร็จ", warnings: [], model: null,
    });
  }

  // ไฟล์ใหญ่ผิดปกติ (เกินเพดานอัป) — ข้าม กัน memory/abuse
  if (bytes.length > MAX_FILE_BYTES) {
    return save({
      verdict: "SKIPPED", format: ext ? ext.toUpperCase() : null,
      width: null, height: null, hasAlpha: null,
      summary: "ไฟล์ใหญ่เกินกำหนด — ข้ามการตรวจอัตโนมัติ", warnings: [], model: null,
    });
  }

  // แกะ header อ่านขนาด → เช็คความละเอียด
  const meta = parseImageMeta(bytes);
  const { warnings } = evaluateCodeChecks(meta);
  // อ่านขนาดไม่ได้ (รูปเพี้ยน/format ที่ไม่รองรับ) = ตรวจไม่ได้
  const verdict: Verdict = meta.width && meta.height ? codeOnlyVerdict(warnings) : "SKIPPED";

  const summary =
    verdict === "SKIPPED"
      ? "อ่านขนาดภาพไม่ได้ — ช่างตรวจเอง"
      : warnings.length > 0
        ? "ความละเอียดค่อนข้างต่ำ — ดูคำเตือน"
        : `ความละเอียดผ่าน (${meta.width}×${meta.height}px)`;

  return save({
    verdict,
    format: meta.format === "UNKNOWN" ? (ext ? ext.toUpperCase() : null) : meta.format,
    width: meta.width,
    height: meta.height,
    hasAlpha: meta.hasAlpha,
    summary,
    warnings,
    model: null,
  });
}
