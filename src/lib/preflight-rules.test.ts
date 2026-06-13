import { describe, expect, it } from "vitest";
import { classifyFile, fileExt, evaluateCodeChecks, codeOnlyVerdict } from "./preflight-rules";
import type { ImageMeta } from "./image-meta";

const img = (width: number, height: number): ImageMeta => ({
  format: "PNG", width, height, hasAlpha: true,
});

describe("classifyFile / fileExt", () => {
  it("raster (png/jpg/webp) = RASTER · อื่นๆ = SKIP", () => {
    expect(classifyFile("/api/files/designs/a/b.png").kind).toBe("RASTER");
    expect(classifyFile("x.JPG").kind).toBe("RASTER");
    expect(classifyFile("x.webp").kind).toBe("RASTER");
    expect(classifyFile("x.pdf").kind).toBe("SKIP");
    expect(classifyFile("art.ai").kind).toBe("SKIP");
    expect(classifyFile("art.psd").kind).toBe("SKIP");
  });
  it("ตัด query/hash", () => {
    expect(fileExt("/api/files/designs/a/b.png?t=xyz")).toBe("png");
  });
});

describe("evaluateCodeChecks — ความละเอียด", () => {
  it("ภาพเล็กกว่าเกณฑ์ (ด้านยาว < 700px) → เตือนความละเอียดต่ำ", () => {
    expect(evaluateCodeChecks(img(400, 300)).warnings.length).toBe(1);
    expect(evaluateCodeChecks(img(699, 200)).warnings[0]).toContain("ความละเอียด");
  });
  it("ภาพใหญ่พอ → ไม่เตือน", () => {
    expect(evaluateCodeChecks(img(2000, 1500)).warnings.length).toBe(0);
    expect(evaluateCodeChecks(img(700, 100)).warnings.length).toBe(0); // ด้านยาว 700 = เกณฑ์พอดี
  });
  it("ไม่รู้ขนาด → ไม่เตือน (ปล่อยให้ orchestrator ตัดสิน SKIPPED)", () => {
    expect(evaluateCodeChecks({ format: "WEBP", width: null, height: null, hasAlpha: null }).warnings.length).toBe(0);
  });
});

describe("codeOnlyVerdict", () => {
  it("มี warning = เหลือง · ไม่มี = เขียว", () => {
    expect(codeOnlyVerdict([])).toBe("GREEN");
    expect(codeOnlyVerdict(["ความละเอียดต่ำ"])).toBe("YELLOW");
  });
});
