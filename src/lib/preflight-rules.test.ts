import { describe, expect, it } from "vitest";
import {
  classifyFile,
  fileExt,
  evaluateCodeChecks,
  worstVerdict,
  codeOnlyVerdict,
} from "./preflight-rules";
import type { ImageMeta } from "./image-meta";

const png = (hasAlpha: boolean | null, width = 0, height = 0): ImageMeta => ({
  format: "PNG", width, height, hasAlpha,
});

describe("classifyFile / fileExt", () => {
  it("แยกชนิดตามนามสกุล", () => {
    expect(classifyFile("/api/files/designs/a/b.png").kind).toBe("RASTER");
    expect(classifyFile("x.JPG").kind).toBe("RASTER");
    expect(classifyFile("x.pdf").kind).toBe("PDF");
    expect(classifyFile("art.ai").kind).toBe("SKIP");
    expect(classifyFile("art.psd").kind).toBe("SKIP");
  });
  it("ตัด query/hash + คืน mimeType", () => {
    expect(fileExt("/api/files/designs/a/b.png?t=xyz")).toBe("png");
    expect(classifyFile("a/b.jpeg?s=tok").mimeType).toBe("image/jpeg");
    expect(classifyFile("a/b.ai").mimeType).toBeNull();
  });
});

describe("evaluateCodeChecks — พื้นโปร่ง", () => {
  it("JPG → เตือนไม่มีพื้นโปร่ง", () => {
    const r = evaluateCodeChecks({ meta: { format: "JPEG", width: 0, height: 0, hasAlpha: false } });
    expect(r.warnings.some((w) => w.includes("JPG"))).toBe(true);
  });
  it("PNG ไม่มี alpha → เตือน", () => {
    expect(evaluateCodeChecks({ meta: png(false) }).warnings.length).toBe(1);
  });
  it("PNG มี alpha → ไม่เตือนเรื่องพื้น", () => {
    expect(evaluateCodeChecks({ meta: png(true) }).warnings.length).toBe(0);
  });
});

describe("evaluateCodeChecks — ความละเอียดเทียบขนาดลาย", () => {
  it("พิกเซลน้อยเทียบขนาดลาย → เตือน DPI ต่ำ", () => {
    // 300px กว้าง พิมพ์ 21cm → ~36 DPI
    const r = evaluateCodeChecks({ meta: png(true, 300, 300), printWidthCm: 21, printHeightCm: 21 });
    expect(r.effectiveDpi).toBeLessThan(150);
    expect(r.warnings.some((w) => w.includes("ความละเอียดต่ำ"))).toBe(true);
  });
  it("พิกเซลพอ → ไม่เตือน DPI", () => {
    // 2480px กว้าง พิมพ์ 21cm → ~300 DPI
    const r = evaluateCodeChecks({ meta: png(true, 2480, 2480), printWidthCm: 21, printHeightCm: 21 });
    expect(r.effectiveDpi).toBeGreaterThanOrEqual(150);
    expect(r.warnings.length).toBe(0);
  });
  it("ไม่รู้ขนาดลาย → ข้ามเช็ค DPI (effectiveDpi null)", () => {
    expect(evaluateCodeChecks({ meta: png(true, 300, 300) }).effectiveDpi).toBeNull();
  });
});

describe("worstVerdict / codeOnlyVerdict", () => {
  it("เลือกตัวที่เตือนหนักกว่า", () => {
    expect(worstVerdict("GREEN", "YELLOW")).toBe("YELLOW");
    expect(worstVerdict("YELLOW", "RED")).toBe("RED");
    expect(worstVerdict("GREEN", "GREEN")).toBe("GREEN");
  });
  it("โค้ดล้วน: มี warning = เหลือง", () => {
    expect(codeOnlyVerdict([])).toBe("GREEN");
    expect(codeOnlyVerdict(["x"])).toBe("YELLOW");
  });
});
