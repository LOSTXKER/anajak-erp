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

  it("บอกว่าอัปเดตอัตโนมัติ พร้อมเวลาตรวจและรอบรีเฟรชโดยไม่เรียกตัวเองว่า realtime", () => {
    const html = renderToStaticMarkup(
      createElement(ProductionFreshness, {
        updatedAt: new Date("2026-08-24T23:48:00+07:00").getTime(),
        isFetching: false,
        stale: false,
      }),
    );

    expect(html).toContain("ระบบอัปเดตข้อมูลอัตโนมัติ");
    expect(html).toContain("ตรวจล่าสุด");
    expect(html).toContain("ทุก 30 วินาที");
    expect(html).not.toContain("LIVE");
    expect(html).not.toContain("สดแบบเรียลไทม์");
  });

  it("บอกกิจกรรมที่เกิดขึ้นจริงระหว่าง background refresh", () => {
    const html = renderToStaticMarkup(
      createElement(ProductionFreshness, {
        updatedAt: new Date("2026-08-24T23:48:00+07:00").getTime(),
        isFetching: true,
        stale: false,
      }),
    );

    expect(html).toContain('data-production-freshness="fetching"');
    expect(html).toContain("กำลังตรวจข้อมูลล่าสุด");
    expect(html).toContain("ข้อมูลก่อนหน้า");
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
    expect(html).toContain("อัปเดตข้อมูลไม่สำเร็จ");
    expect(html).toContain("ระบบจะลองอีกครั้ง");
    expect(html).not.toContain("animate-spin");
  });
});
