// Preflight orchestrator (FLOW-REDESIGN ก้อน 4 — preflight DTF) — server only
//
// รับ fileUrl (proxy) → โหลดไฟล์ (service role) → เช็ค 2 ชั้น → เก็บผลลง FilePreflight (1 แถว/ไฟล์)
// - ชั้นโค้ด: ขนาด/พื้นโปร่ง (PNG/JPEG) + พิกเซลเทียบขนาดลาย (ถ้ารู้ขนาด)
// - ชั้น AI: Gemini ดูเชิงสายตา (เบลอ/พื้นทึบ/ตัวอักษรเล็ก)
// - .ai/.psd → SKIPPED (อ่านอัตโนมัติไม่ได้) · ทุก error ไม่ throw — เก็บ verdict ERROR แทน

import { createAdminClient } from "@/lib/supabase-admin";
import { ALLOWED_FILE_BUCKETS, parseProxyFileUrl, safeDecode } from "@/lib/file-urls";
import { parseImageMeta, type ImageMeta } from "@/lib/image-meta";
import {
  classifyFile,
  evaluateCodeChecks,
  codeOnlyVerdict,
  worstVerdict,
  type Verdict,
} from "@/lib/preflight-rules";
import { geminiPreflightImage, GEMINI_MODEL, type GeminiPreflightResult } from "./gemini";
import type { ExtendedPrismaClient } from "@/lib/prisma";

const MAX_AI_BYTES = 7 * 1024 * 1024; // ใหญ่กว่านี้ base64 เกิน request limit — ข้าม AI
const MAX_FILE_BYTES = 30 * 1024 * 1024; // เพดานอัปจริง 25MB — เกินนี้ผิดปกติ ข้ามการตรวจ

const UNKNOWN_META: ImageMeta = { format: "UNKNOWN", width: null, height: null, hasAlpha: null };

interface PreflightInput {
  fileUrl: string;
  printWidthCm?: number | null;
  printHeightCm?: number | null;
}

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

export async function runFilePreflight(prisma: ExtendedPrismaClient, input: PreflightInput) {
  const { fileUrl } = input;
  const { kind, mimeType, ext } = classifyFile(fileUrl);

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

  // .ai/.psd/ฯลฯ — ตรวจอัตโนมัติไม่ได้
  if (kind === "SKIP") {
    return save({
      verdict: "SKIPPED",
      format: ext ? ext.toUpperCase() : null,
      width: null, height: null, hasAlpha: null,
      summary: `ไฟล์ .${ext || "?"} ตรวจอัตโนมัติไม่ได้ — ช่างตรวจเอง`,
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

  // ชั้นโค้ด (raster เท่านั้นที่แกะ header ได้)
  const meta = kind === "RASTER" ? parseImageMeta(bytes) : UNKNOWN_META;
  const code = evaluateCodeChecks({
    meta,
    printWidthCm: input.printWidthCm,
    printHeightCm: input.printHeightCm,
  });

  // ชั้น AI (Gemini)
  let ai: GeminiPreflightResult | null = null;
  let aiNote: string | null = null;
  if (mimeType && bytes.length <= MAX_AI_BYTES) {
    try {
      const base64 = Buffer.from(bytes).toString("base64");
      ai = await geminiPreflightImage(base64, mimeType);
    } catch {
      aiNote = "AI ตรวจไม่สำเร็จรอบนี้";
    }
  } else if (mimeType) {
    aiNote = "ไฟล์ใหญ่เกินส่งให้ AI — ตรวจด้วยระบบพื้นฐานเท่านั้น";
  }

  // รวมผล
  const warnings = Array.from(new Set([...code.warnings, ...(ai?.warnings ?? [])]));
  if (aiNote) warnings.push(aiNote);

  let verdict: Verdict;
  if (ai) verdict = worstVerdict(codeOnlyVerdict(code.warnings), ai.verdict);
  else if (kind === "RASTER") verdict = codeOnlyVerdict(code.warnings); // ยังมีเช็คโค้ด
  else verdict = "ERROR"; // PDF + AI ล่ม = ไม่มีอะไรตรวจได้

  const summary =
    ai?.summary ||
    (verdict === "GREEN"
      ? "ผ่านการตรวจเบื้องต้น"
      : verdict === "ERROR"
        ? "ตรวจอัตโนมัติไม่สำเร็จ"
        : "มีข้อควรระวัง — ดูคำเตือน");

  return save({
    verdict,
    format: meta.format === "UNKNOWN" ? (ext ? ext.toUpperCase() : null) : meta.format,
    width: meta.width,
    height: meta.height,
    hasAlpha: meta.hasAlpha,
    summary,
    warnings,
    model: ai ? GEMINI_MODEL : null,
  });
}
