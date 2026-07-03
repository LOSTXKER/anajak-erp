import { describe, it, expect } from "vitest";
import { isOwnOutsourceFile, outsourceFilePrefix } from "./outsource-share";

const JOB = "job123";
const P = outsourceFilePrefix(JOB); // /api/files/designs/outsource/job123/

describe("isOwnOutsourceFile — กันไฟล์นอกโฟลเดอร์ใบงานรั่วสู่ลิงก์ public", () => {
  it("ไฟล์ legit ในโฟลเดอร์ใบ (ชื่อ <ts>-<rand>.ext) ผ่าน", () => {
    expect(isOwnOutsourceFile(JOB, `${P}1720000000-ab12.pdf`)).toBe(true);
    expect(isOwnOutsourceFile(JOB, `${P}1720000000-ab12.png`)).toBe(true);
  });

  it("null/ว่าง/ไม่ขึ้นต้น prefix → false", () => {
    expect(isOwnOutsourceFile(JOB, null)).toBe(false);
    expect(isOwnOutsourceFile(JOB, "")).toBe(false);
    expect(isOwnOutsourceFile(JOB, `${P}`)).toBe(false); // ไม่มีชื่อไฟล์
    expect(isOwnOutsourceFile(JOB, "/api/files/designs/payments/ord1/slip.jpg")).toBe(false);
  });

  it("โฟลเดอร์ใบอื่น (jobId ไม่ตรง) → false", () => {
    expect(isOwnOutsourceFile(JOB, "/api/files/designs/outsource/other/x.pdf")).toBe(false);
  });

  it("encoded traversal (..%2f / %2e%2e / %5c) เลี่ยง startsWith ได้ แต่โดนปฏิเสธ", () => {
    expect(isOwnOutsourceFile(JOB, `${P}..%2Fpayments%2Ford1%2Fslip.jpg`)).toBe(false);
    expect(isOwnOutsourceFile(JOB, `${P}%2e%2e%2Fpayments%2Fslip.jpg`)).toBe(false);
    expect(isOwnOutsourceFile(JOB, `${P}..%5Cpayments`)).toBe(false);
  });

  it("traversal/แยก path เพิ่มหลัง prefix → false", () => {
    expect(isOwnOutsourceFile(JOB, `${P}../payments/slip.jpg`)).toBe(false);
    expect(isOwnOutsourceFile(JOB, `${P}sub/nested.pdf`)).toBe(false);
    expect(isOwnOutsourceFile(JOB, `${P}a%2Fb.pdf`)).toBe(false);
  });
});
