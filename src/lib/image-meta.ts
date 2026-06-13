// แกะ metadata รูปจาก header (FLOW-REDESIGN ก้อน 4 — preflight DTF)
//
// อ่านขนาด + "มีพื้นโปร่ง (alpha) ไหม" จาก header ตรงๆ ไม่ต้อง decode ทั้งรูป/ไม่ต้องลง lib
// — แม่นกว่าให้ AI เดา (AI เห็น RGB ที่ render แล้ว บอก alpha จริงไม่ได้)
// รองรับ PNG/JPEG (raster หลักของงาน) · format อื่นคืน UNKNOWN ให้ AI ช่วยดูแทน

export type ImageFormat = "PNG" | "JPEG" | "WEBP" | "UNKNOWN";

export interface ImageMeta {
  format: ImageFormat;
  width: number | null;
  height: number | null;
  hasAlpha: boolean | null; // null = บอกไม่ได้ (format ที่ไม่ได้แกะ)
}

const u32be = (b: Uint8Array, o: number) =>
  ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];

// u32be คืน unsigned (0..4.29e9) — IHDR ที่เพี้ยน/จงใจ อาจได้ค่าเกิน Postgres Int (2.15e9)
// → ลง DB แล้ว overflow เขียนพัง · clamp ค่านอกช่วงจริง (≤0 หรือ > 100000 px) เป็น null
const MAX_DIM = 100_000;
const safeDim = (n: number): number | null =>
  Number.isFinite(n) && n > 0 && n <= MAX_DIM ? n : null;

function asBytes(buf: ArrayBuffer | Uint8Array): Uint8Array {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(b: Uint8Array): boolean {
  return PNG_SIG.every((v, i) => b[i] === v);
}

/** มี chunk ชื่อ name อยู่ใน PNG ไหม (เช่น tRNS = โปร่งแบบ palette/grayscale) */
function pngHasChunk(b: Uint8Array, name: string): boolean {
  // เดิน chunk จาก byte 8: [len(4)][type(4)][data(len)][crc(4)]
  let o = 8;
  const code = [name.charCodeAt(0), name.charCodeAt(1), name.charCodeAt(2), name.charCodeAt(3)];
  while (o + 8 <= b.length) {
    const len = u32be(b, o);
    const t0 = b[o + 4], t1 = b[o + 5], t2 = b[o + 6], t3 = b[o + 7];
    if (t0 === code[0] && t1 === code[1] && t2 === code[2] && t3 === code[3]) return true;
    if (t0 === 0x49 && t1 === 0x44 && t2 === 0x41 && t3 === 0x54) return false; // ถึง IDAT แล้ว เลิกหา
    o += 12 + len; // 4(len)+4(type)+len+4(crc)
  }
  return false;
}

function parsePng(b: Uint8Array): ImageMeta {
  // IHDR เริ่ม byte 8: len(4)+"IHDR"(4) → width(16) height(20) bitDepth(24) colorType(25)
  const colorType = b[25];
  // 6=RGBA, 4=Gray+Alpha → มี alpha แน่ · 0/2/3 → โปร่งได้ผ่าน tRNS chunk เท่านั้น
  const hasAlpha =
    colorType === 6 || colorType === 4 ? true : pngHasChunk(b, "tRNS");
  return { format: "PNG", width: safeDim(u32be(b, 16)), height: safeDim(u32be(b, 20)), hasAlpha };
}

function parseJpeg(b: Uint8Array): ImageMeta {
  // เดิน marker หา SOF (FFC0–FFCF ยกเว้น C4/C8/CC) → height(2)+width(2) หลัง precision
  let o = 2;
  while (o + 9 < b.length) {
    if (b[o] !== 0xff) { o++; continue; }
    const marker = b[o + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      // JPEG ไม่มี alpha เสมอ · u16be ≤ 65535 อยู่ในช่วง Int อยู่แล้ว (clamp ไว้เผื่อค่าเพี้ยน)
      return {
        format: "JPEG",
        width: safeDim(u16be(b, o + 7)),
        height: safeDim(u16be(b, o + 5)),
        hasAlpha: false,
      };
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { o += 2; continue; }
    const segLen = u16be(b, o + 2);
    if (segLen < 2) break;
    o += 2 + segLen;
  }
  return { format: "JPEG", width: null, height: null, hasAlpha: false };
}

export function parseImageMeta(buf: ArrayBuffer | Uint8Array): ImageMeta {
  const b = asBytes(buf);
  if (b.length >= 26 && isPng(b)) return parsePng(b);
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) return parseJpeg(b);
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  ) {
    return { format: "WEBP", width: null, height: null, hasAlpha: null };
  }
  return { format: "UNKNOWN", width: null, height: null, hasAlpha: null };
}
