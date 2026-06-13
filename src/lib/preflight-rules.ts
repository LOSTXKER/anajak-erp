// กฎ preflight ไฟล์ลูกค้า (FLOW-REDESIGN ก้อน 4) — pure logic (มี unit test)
//
// **โค้ดล้วน ไม่มี AI** (เบสเคาะ 2026-06-14: AI เช็คผิดบ่อย + ตัดสินดีไซน์ที่ลูกค้าอาจตั้งใจ
// → ตัดออก) · เช็คสิ่งเดียวที่เชื่อได้จริงและมีค่า = "ความละเอียดเล็กเกินไปสำหรับพิมพ์"
// (พื้นโปร่งไม่เช็ก — ไฟล์อ้างอิงลูกค้าไม่ใช่ไฟล์พิมพ์จริง · ลูกค้าอาจตั้งใจมีพื้น)

import type { ImageMeta } from "./image-meta";

export type Verdict = "GREEN" | "YELLOW" | "RED" | "SKIPPED" | "ERROR";

// ชนิดการตรวจตามนามสกุล:
// RASTER = PNG/JPG/WEBP (แกะ header อ่านขนาดได้) · SKIP = PDF/.ai/.psd/ฯลฯ (อ่านขนาดไม่ได้)
export type PreflightKind = "RASTER" | "SKIP";

const RASTER_EXTS = new Set(["png", "jpg", "jpeg", "webp"]);

// ด้านยาวต่ำกว่านี้ = เล็กเกินพิมพ์งานใหญ่ (เช่นโลโก้/รูป thumbnail เว็บ) — เตือนให้ขอไฟล์ใหญ่กว่า
export const MIN_PRINT_LONG_EDGE_PX = 700;

/** นามสกุลไฟล์จาก URL/ชื่อไฟล์ (ตัด query · lowercase) */
export function fileExt(urlOrName: string): string {
  const clean = urlOrName.split(/[?#]/)[0];
  const base = clean.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export function classifyFile(urlOrName: string): { ext: string; kind: PreflightKind } {
  const ext = fileExt(urlOrName);
  return { ext, kind: RASTER_EXTS.has(ext) ? "RASTER" : "SKIP" };
}

/** เช็คชั้นโค้ด — ความละเอียดเล็กเกินไปไหม (คืน warnings ภาษาไทย) */
export function evaluateCodeChecks(meta: ImageMeta): { warnings: string[] } {
  const warnings: string[] = [];
  if (meta.width && meta.height) {
    const longEdge = Math.max(meta.width, meta.height);
    if (longEdge < MIN_PRINT_LONG_EDGE_PX) {
      warnings.push(
        `ความละเอียดค่อนข้างต่ำ (${meta.width}×${meta.height}px) — อาจไม่คมพอสำหรับพิมพ์ขนาดใหญ่`
      );
    }
  }
  return { warnings };
}

/** verdict จากชั้นโค้ด — มี warning = เหลือง */
export function codeOnlyVerdict(warnings: string[]): Verdict {
  return warnings.length > 0 ? "YELLOW" : "GREEN";
}
