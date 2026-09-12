import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PublicLinkError } from "./public-link-error";

vi.mock("@/lib/trpc", () => ({
  trpc: { settings: { publicContact: { useQuery: () => ({ data: null, isLoading: false, refetch: vi.fn() }) } } },
}));

describe("PublicLinkError recovery", () => {
  it("does not claim the link expired when the network failed", () => {
    const html = renderToStaticMarkup(createElement(PublicLinkError, { error: {}, onRetry: () => undefined }));
    expect(html).toContain("โหลดข้อมูลไม่สำเร็จ");
    expect(html).toContain("ลองเปิดอีกครั้ง");
    expect(html).not.toContain("หมดอายุ");
  });

  it("explains an unavailable link without a back button that may do nothing", () => {
    const html = renderToStaticMarkup(createElement(PublicLinkError, {
      error: { data: { code: "NOT_FOUND" } }, message: "ไม่พบใบงานนี้",
    }));
    expect(html).toContain("ไม่พบใบงานนี้");
    expect(html).toContain("กลับไปที่แชตหรืออีเมลที่ได้รับลิงก์นี้");
    expect(html).not.toContain("<button");
  });

  it("preserves the caller explanation for forbidden results", () => {
    const html = renderToStaticMarkup(createElement(PublicLinkError, { error: { data: { code: "FORBIDDEN" } }, message: "ขอใบเสนอราคาฉบับใหม่" }));
    expect(html).toContain("ขอใบเสนอราคาฉบับใหม่");
  });

  it("does not label an initial offline/paused query as an expired link", () => {
    const html = renderToStaticMarkup(createElement(PublicLinkError, { error: null, message: "ลิงก์หมดอายุแล้ว" }));
    expect(html).toContain("ตรวจการเชื่อมต่ออินเทอร์เน็ต");
    expect(html).not.toContain("ลิงก์หมดอายุแล้ว");
  });
});
