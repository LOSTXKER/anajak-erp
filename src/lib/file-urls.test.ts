import { describe, expect, it } from "vitest";
import {
  normalizeFileUrl,
  parseProxyFileUrl,
  proxyFileUrl,
  safeDecode,
  safeFileExt,
  withFileToken,
} from "./file-urls";

const PUBLIC_URL =
  "https://abcd1234.supabase.co/storage/v1/object/public/designs/orders/o1/169-x.png";
const SIGNED_URL =
  "https://abcd1234.supabase.co/storage/v1/object/sign/designs/orders/o1/169-x.png?token=eyJabc";
const PROXY_URL = "/api/files/designs/orders/o1/169-x.png";

describe("normalizeFileUrl", () => {
  it("แปลง public URL ของ Supabase เป็น proxy URL (host-agnostic)", () => {
    expect(normalizeFileUrl(PUBLIC_URL)).toBe(PROXY_URL);
    expect(
      normalizeFileUrl(
        "https://other-host.example.com/storage/v1/object/public/designs/qc/a.jpg"
      )
    ).toBe("/api/files/designs/qc/a.jpg");
  });

  it("แปลง signed URL เป็น proxy URL และตัด query ทิ้ง", () => {
    expect(normalizeFileUrl(SIGNED_URL)).toBe(PROXY_URL);
  });

  it("proxy URL ที่มี ?t= ติดมา (echo จากหน้า approve) ถูกตัดเหลือ URL เปล่า", () => {
    expect(normalizeFileUrl(`${PROXY_URL}?t=sometoken`)).toBe(PROXY_URL);
  });

  it("proxy URL แบบ absolute ถูกลดรูปเป็น relative", () => {
    expect(normalizeFileUrl(`https://erp.anajak.com${PROXY_URL}`)).toBe(PROXY_URL);
  });

  it("proxy URL เปล่าคืนค่าเดิม (idempotent)", () => {
    expect(normalizeFileUrl(PROXY_URL)).toBe(PROXY_URL);
    expect(normalizeFileUrl(normalizeFileUrl(PUBLIC_URL))).toBe(PROXY_URL);
  });

  it("URL นอกระบบ/ค่าขยะ ไม่ถูกแตะ (Product.imageUrl อาจกรอกมือ)", () => {
    expect(normalizeFileUrl("https://example.com/img/shirt.png")).toBe(
      "https://example.com/img/shirt.png"
    );
    expect(normalizeFileUrl("not a url at all")).toBe("not a url at all");
    expect(normalizeFileUrl("")).toBe("");
  });
});

describe("proxyFileUrl / parseProxyFileUrl", () => {
  it("round-trip ได้", () => {
    const url = proxyFileUrl("designs", "orders/o1/a.png");
    expect(url).toBe("/api/files/designs/orders/o1/a.png");
    expect(parseProxyFileUrl(url)).toEqual({
      bucket: "designs",
      path: "orders/o1/a.png",
    });
  });

  it("ตัด query ก่อน parse", () => {
    expect(parseProxyFileUrl(`${PROXY_URL}?t=tok`)).toEqual({
      bucket: "designs",
      path: "orders/o1/169-x.png",
    });
  });

  it("ไม่ใช่ proxy URL / โครงไม่ครบ คืน null", () => {
    expect(parseProxyFileUrl(PUBLIC_URL)).toBeNull();
    expect(parseProxyFileUrl("/api/files/designs")).toBeNull();
    expect(parseProxyFileUrl("/api/files/designs/")).toBeNull();
    expect(parseProxyFileUrl(null)).toBeNull();
    expect(parseProxyFileUrl(undefined)).toBeNull();
  });
});

describe("safeDecode", () => {
  it("decode percent-encoding ปกติ", () => {
    expect(safeDecode("a%20b")).toBe("a b");
    expect(safeDecode("orders/o1/x.png")).toBe("orders/o1/x.png");
  });

  it("ค่า malformed ไม่ throw — คืนค่าเดิม", () => {
    expect(safeDecode("100%")).toBe("100%");
  });
});

describe("safeFileExt", () => {
  it("นามสกุลปกติ → lowercase ASCII", () => {
    expect(safeFileExt("design.PNG")).toBe("png");
    expect(safeFileExt("a.b.gang-sheet.pdf")).toBe("pdf");
  });

  it("ไฟล์ไม่มีจุด/นามสกุลมีช่องว่าง-อักขระพิเศษ → bin", () => {
    expect(safeFileExt("FINAL ARTWORK")).toBe("bin");
    expect(safeFileExt("แบบเสื้อ")).toBe("bin");
    expect(safeFileExt("file.ส่วนลด 50%")).toBe("50");
    expect(safeFileExt("")).toBe("bin");
  });

  it("จำกัดความยาว 10 ตัว", () => {
    expect(safeFileExt("x.abcdefghijklmnop")).toBe("abcdefghij");
  });
});

describe("withFileToken", () => {
  it("แปะ ?t= ให้ proxy URL (normalize ก่อน)", () => {
    expect(withFileToken(PROXY_URL, "tok123")).toBe(`${PROXY_URL}?t=tok123`);
    expect(withFileToken(PUBLIC_URL, "tok123")).toBe(`${PROXY_URL}?t=tok123`);
  });

  it("token ถูก encode", () => {
    expect(withFileToken(PROXY_URL, "a/b c")).toBe(`${PROXY_URL}?t=a%2Fb%20c`);
  });

  it("URL นอกระบบคืนค่าเดิม · ค่าว่างคืน null", () => {
    expect(withFileToken("https://example.com/x.png", "tok")).toBe(
      "https://example.com/x.png"
    );
    expect(withFileToken(null, "tok")).toBeNull();
    expect(withFileToken(undefined, "tok")).toBeNull();
  });
});
