import { describe, it, expect } from "vitest";
import { chatUrlSchema } from "./customer";

// ลิงก์ห้องแชทเป็นข้อความที่พนักงานพิมพ์เอง แล้วหน้ารายการออเดอร์เอาไปใส่ href
// → ถ้าไม่กัน จะยิงสคริปต์ใส่คนที่กดได้ · เทสต์นี้เฝ้าด่านนั้นไว้
describe("ลิงก์ห้องแชทของลูกค้า", () => {
  it("รับลิงก์เว็บปกติ", () => {
    expect(chatUrlSchema.parse("https://line.me/ti/p/~abc")).toBe(
      "https://line.me/ti/p/~abc",
    );
    expect(chatUrlSchema.parse("http://m.me/anajak")).toBe(
      "http://m.me/anajak",
    );
  });

  it("ตัดช่องว่างหัวท้าย", () => {
    expect(chatUrlSchema.parse("  https://line.me/x  ")).toBe(
      "https://line.me/x",
    );
  });

  it("เว้นว่าง = ไม่มีลิงก์ (null ไม่ใช่สตริงว่าง)", () => {
    expect(chatUrlSchema.parse("")).toBeNull();
    expect(chatUrlSchema.parse("   ")).toBeNull();
    expect(chatUrlSchema.parse(undefined)).toBeNull();
  });

  it("ปฏิเสธลิงก์ที่รันสคริปต์ได้", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "  javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
    ]) {
      expect(() => chatUrlSchema.parse(bad)).toThrow();
    }
  });

  it("ปฏิเสธข้อความที่ไม่ใช่ลิงก์ และลิงก์ที่ยาวเกินเหตุ", () => {
    expect(() => chatUrlSchema.parse("line: @somebody")).toThrow();
    expect(() => chatUrlSchema.parse("www.line.me/x")).toThrow();
    expect(() => chatUrlSchema.parse("https://a.com/" + "x".repeat(500))).toThrow();
  });
});
