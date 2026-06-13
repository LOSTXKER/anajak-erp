// กฎ preflight ไฟล์งานพิมพ์ DTF (FLOW-REDESIGN ก้อน 4) — pure logic (มี unit test)
//
// 2 ชั้น: (1) เช็คโค้ด (ขนาด/พื้นโปร่ง/พิกเซลเทียบขนาดลาย — แม่น ฟรี) (2) AI ดูเชิงสายตา
// ไฟล์นี้ดูแลชั้นโค้ด + การจัดชนิดไฟล์ + รวม verdict สุดท้าย (worst ของ 2 ชั้น)

import type { ImageMeta } from "./image-meta";

export type Verdict = "GREEN" | "YELLOW" | "RED" | "SKIPPED" | "ERROR";

// ชนิดการตรวจตามนามสกุล:
// RASTER = PNG/JPG/WEBP (แกะ header ได้ + Gemini ดูได้) · PDF = Gemini ดูได้ (ไม่แกะ header) ·
// SKIP = .ai/.psd/ฯลฯ (ทั้งโค้ดและ Gemini อ่านไม่ได้ — ช่างตรวจเอง)
export type PreflightKind = "RASTER" | "PDF" | "SKIP";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};

const RASTER_EXTS = new Set(["png", "jpg", "jpeg", "webp"]);

export const MIN_PRINT_DPI = 150; // ต่ำกว่านี้เสี่ยงแตกบนงานพิมพ์

/** นามสกุลไฟล์จาก URL/ชื่อไฟล์ (ตัด query · lowercase) */
export function fileExt(urlOrName: string): string {
  const clean = urlOrName.split(/[?#]/)[0];
  const base = clean.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export function classifyFile(urlOrName: string): {
  ext: string;
  kind: PreflightKind;
  mimeType: string | null;
} {
  const ext = fileExt(urlOrName);
  if (RASTER_EXTS.has(ext)) return { ext, kind: "RASTER", mimeType: MIME[ext] };
  if (ext === "pdf") return { ext, kind: "PDF", mimeType: MIME.pdf };
  return { ext, kind: "SKIP", mimeType: null };
}

const SEVERITY: Record<Verdict, number> = {
  GREEN: 0,
  SKIPPED: 0,
  YELLOW: 1,
  RED: 2,
  ERROR: 0, // ERROR แยกจัดการ ไม่ใช่ "แย่กว่า" RED
};

/** verdict ที่แย่กว่า (เตือนหนักกว่า) ระหว่าง 2 ค่า */
export function worstVerdict(a: Verdict, b: Verdict): Verdict {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

export interface CodeCheckInput {
  meta: ImageMeta;
  printWidthCm?: number | null;
  printHeightCm?: number | null;
}

export interface CodeCheckResult {
  effectiveDpi: number | null;
  warnings: string[];
}

/** เช็คชั้นโค้ด — พื้นโปร่ง + ความละเอียดเทียบขนาดลาย (คืน warnings ภาษาไทย) */
export function evaluateCodeChecks(input: CodeCheckInput): CodeCheckResult {
  const { meta, printWidthCm, printHeightCm } = input;
  const warnings: string[] = [];

  // พื้นโปร่ง — สำคัญสุดสำหรับ DTF/DTG
  if (meta.format === "JPEG") {
    warnings.push("ไฟล์ JPG ไม่มีพื้นโปร่ง — งาน DTF/DTG ควรใช้ PNG พื้นโปร่ง");
  } else if (meta.format === "PNG" && meta.hasAlpha === false) {
    warnings.push("PNG นี้ไม่มีพื้นโปร่ง — พื้นหลังอาจติดไปกับงานพิมพ์");
  }

  // ความละเอียดเทียบขนาดที่จะพิมพ์ (ต้องมีทั้งพิกเซลและขนาดลาย)
  let effectiveDpi: number | null = null;
  if (meta.width && meta.height && printWidthCm && printHeightCm && printWidthCm > 0 && printHeightCm > 0) {
    const dpiW = meta.width / (printWidthCm / 2.54);
    const dpiH = meta.height / (printHeightCm / 2.54);
    effectiveDpi = Math.round(Math.min(dpiW, dpiH));
    if (effectiveDpi < MIN_PRINT_DPI) {
      warnings.push(
        `ความละเอียดต่ำ (~${effectiveDpi} DPI ที่ขนาดพิมพ์ ${printWidthCm}×${printHeightCm} ซม.) อาจแตก — ควร ≥ ${MIN_PRINT_DPI} DPI`
      );
    }
  }

  return { effectiveDpi, warnings };
}

/** verdict จากชั้นโค้ดล้วน (ไม่มี AI / AI ล่ม) — มี warning = เหลือง */
export function codeOnlyVerdict(warnings: string[]): Verdict {
  return warnings.length > 0 ? "YELLOW" : "GREEN";
}
