import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  oldestSuccessfulUpdate,
  ProductionFreshness,
} from "./production-freshness";

describe("ProductionFreshness", () => {
  it("ใช้เวลาที่เก่าที่สุดเมื่อหน้าหนึ่งประกอบจากหลาย query", () => {
    expect(oldestSuccessfulUpdate(300, undefined, 100, 0, 200)).toBe(100);
    expect(oldestSuccessfulUpdate(undefined, 0)).toBe(0);
  });

  it("บอกเวลาซิงก์และรอบรีเฟรชโดยไม่เรียกตัวเองว่า realtime", () => {
    const html = renderToStaticMarkup(
      createElement(ProductionFreshness, {
        updatedAt: new Date("2026-08-24T23:48:00+07:00").getTime(),
        isFetching: false,
        stale: false,
      }),
    );

    expect(html).toContain("ซิงก์ล่าสุด");
    expect(html).toContain("ทุก 30 วิ");
    expect(html).not.toContain("LIVE");
    expect(html).not.toContain("สดแบบเรียลไทม์");
  });

  it("ประกาศเฉพาะข้อมูลค้างเป็น status และไม่ใช้ animation หลอก", () => {
    const html = renderToStaticMarkup(
      createElement(ProductionFreshness, {
        updatedAt: new Date("2026-08-24T23:48:00+07:00").getTime(),
        isFetching: false,
        stale: true,
      }),
    );

    expect(html).toContain('data-production-freshness="stale"');
    expect(html).toContain('role="status"');
    expect(html).toContain("ข้อมูลค้าง");
    expect(html).not.toContain("animate-spin");
  });
});
