import { describe, expect, it } from "vitest";
import { parseImageMeta } from "./image-meta";

// สร้าง PNG header จำลอง (signature + IHDR) — พอให้แกะ width/height/colorType
function makePng(width: number, height: number, colorType: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // signature
  b.set([0x00, 0x00, 0x00, 0x0d], 8); // IHDR length 13
  b.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  b[16] = (width >>> 24) & 0xff; b[17] = (width >>> 16) & 0xff; b[18] = (width >>> 8) & 0xff; b[19] = width & 0xff;
  b[20] = (height >>> 24) & 0xff; b[21] = (height >>> 16) & 0xff; b[22] = (height >>> 8) & 0xff; b[23] = height & 0xff;
  b[24] = 8; // bit depth
  b[25] = colorType;
  return b;
}

// สร้าง JPEG header จำลอง (SOI + SOF0)
function makeJpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xc0, // SOF0
    0x00, 0x11, // segment length
    0x08, // precision
    (height >>> 8) & 0xff, height & 0xff,
    (width >>> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x22, 0x00,
  ]);
}

describe("parseImageMeta", () => {
  it("PNG RGBA (colorType 6) → ขนาดถูก + มีพื้นโปร่ง", () => {
    expect(parseImageMeta(makePng(2480, 3508, 6))).toEqual({
      format: "PNG", width: 2480, height: 3508, hasAlpha: true,
    });
  });

  it("PNG RGB (colorType 2 ไม่มี tRNS) → ไม่มีพื้นโปร่ง", () => {
    expect(parseImageMeta(makePng(800, 600, 2))).toMatchObject({
      format: "PNG", width: 800, height: 600, hasAlpha: false,
    });
  });

  it("PNG Gray+Alpha (colorType 4) → มีพื้นโปร่ง", () => {
    expect(parseImageMeta(makePng(100, 100, 4)).hasAlpha).toBe(true);
  });

  it("JPEG → ขนาดถูก + ไม่มี alpha เสมอ", () => {
    expect(parseImageMeta(makeJpeg(200, 100))).toEqual({
      format: "JPEG", width: 200, height: 100, hasAlpha: false,
    });
  });

  it("PNG ขนาดเพี้ยน/เกินช่วง (high bit set) → clamp เป็น null กัน Int overflow ลง DB", () => {
    const m = parseImageMeta(makePng(0xff000010, 0xff000010, 6));
    expect(m.width).toBeNull();
    expect(m.height).toBeNull();
    expect(m.hasAlpha).toBe(true); // ยังอ่าน colorType ได้
  });

  it("bytes มั่ว → UNKNOWN", () => {
    expect(parseImageMeta(new Uint8Array([1, 2, 3, 4, 5]))).toMatchObject({ format: "UNKNOWN" });
  });
});
