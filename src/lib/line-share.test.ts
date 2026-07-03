import { describe, it, expect } from "vitest";
import { buildLineShareUrl, buildJobShareText } from "./line-share";

describe("buildLineShareUrl", () => {
  it("encode ข้อความไทย+ลิงก์ลง query เดียว (LINE share scheme)", () => {
    const url = buildLineShareUrl("ใบงาน x\nhttps://a.b/job/t1");
    expect(url.startsWith("https://line.me/R/share?text=")).toBe(true);
    // decode กลับต้องได้ข้อความเดิมครบ (ขึ้นบรรทัดใหม่ไม่หาย)
    expect(decodeURIComponent(url.split("text=")[1])).toBe("ใบงาน x\nhttps://a.b/job/t1");
  });

  it("อักขระพิเศษใน text ไม่ทำ URL แตก (& = %26)", () => {
    const url = buildLineShareUrl("A&B ×100");
    expect(url).not.toContain("&B");
    expect(url).toContain("%26");
  });
});

describe("buildJobShareText", () => {
  it("ครบสามบรรทัด: งาน/กำหนดส่งคืน/ลิงก์", () => {
    const text = buildJobShareText({
      description: "สกรีนหน้าอก",
      quantity: 120,
      dueText: "10 ก.ค. 2569",
      url: "https://erp.example/job/abc",
    });
    expect(text.split("\n")).toEqual([
      "ใบงาน: สกรีนหน้าอก — 120 ชิ้น",
      "กำหนดส่งคืน: 10 ก.ค. 2569",
      "รายละเอียด+ไฟล์ลาย: https://erp.example/job/abc",
    ]);
  });

  it("ไม่มีกำหนดส่งคืน → ข้ามบรรทัดนั้น (ไม่เหลือบรรทัดว่าง)", () => {
    const text = buildJobShareText({
      description: "ปักโลโก้",
      quantity: 50,
      dueText: null,
      url: "https://erp.example/job/xyz",
    });
    expect(text.split("\n")).toHaveLength(2);
    expect(text).not.toContain("กำหนดส่งคืน");
  });
});
