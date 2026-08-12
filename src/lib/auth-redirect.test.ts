import { describe, expect, it } from "vitest";
import { safeAfterLoginHref } from "./auth-redirect";

describe("safeAfterLoginHref", () => {
  it("รักษา canonical path, query ซ้ำ และ hash", () => {
    expect(safeAfterLoginHref("/orders/abc?tab=items&x=1&x=2#files")).toBe(
      "/orders/abc?tab=items&x=1&x=2#files",
    );
  });

  it("แปลง bookmark V2 เป็น canonical path ก่อนกลับหลัง login", () => {
    expect(safeAfterLoginHref("/v2/orders/abc?tab=history")).toBe(
      "/orders/abc?tab=history",
    );
    expect(safeAfterLoginHref("/v2?from=bookmark")).toBe("/?from=bookmark");
  });

  it("ปฏิเสธ external URL, protocol-relative URL และ login loop", () => {
    expect(safeAfterLoginHref("https://evil.example/orders")).toBe("/home");
    expect(safeAfterLoginHref("//evil.example/orders")).toBe("/home");
    expect(safeAfterLoginHref("/\\evil.example/orders")).toBe("/home");
    expect(safeAfterLoginHref("/v2//evil.example/orders")).toBe("/home");
    expect(safeAfterLoginHref("/v2/\\evil.example/orders")).toBe("/home");
    expect(safeAfterLoginHref("/login?next=/orders")).toBe("/home");
    expect(safeAfterLoginHref("/v2/login?next=/orders")).toBe("/home");
    expect(safeAfterLoginHref(undefined)).toBe("/home");
  });
});
