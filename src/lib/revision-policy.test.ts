import { describe, expect, it } from "vitest";
import { computeRevisionOverage, visibleRevisionDescription } from "./revision-policy";

describe("computeRevisionOverage", () => {
  it("ยังไม่มีแบบ / มีแต่ต้นฉบับ → ไม่มีรอบแก้ ไม่มีค่าใช้จ่าย", () => {
    expect(computeRevisionOverage(0)).toMatchObject({ revisionRounds: 0, chargeableRounds: 0, fee: 0 });
    expect(computeRevisionOverage(1)).toMatchObject({ revisionRounds: 0, chargeableRounds: 0, fee: 0 });
  });

  it("แก้ในโควตาฟรี (v2, v3) → 1-2 รอบ ฟรี ไม่มีค่าใช้จ่าย", () => {
    expect(computeRevisionOverage(2)).toMatchObject({ revisionRounds: 1, chargeableRounds: 0, fee: 0 });
    expect(computeRevisionOverage(3)).toMatchObject({ revisionRounds: 2, chargeableRounds: 0, fee: 0 });
  });

  it("เกินโควตา (v4+) → คิด 100฿/รอบ", () => {
    expect(computeRevisionOverage(4)).toMatchObject({ revisionRounds: 3, chargeableRounds: 1, fee: 100 });
    expect(computeRevisionOverage(5)).toMatchObject({ revisionRounds: 4, chargeableRounds: 2, fee: 200 });
    expect(computeRevisionOverage(7)).toMatchObject({ revisionRounds: 6, chargeableRounds: 4, fee: 400 });
  });

  it("กันค่าเพี้ยน (ติดลบ/ทศนิยม) → ปัดเป็นจำนวนเต็มไม่ติดลบ", () => {
    expect(computeRevisionOverage(-3)).toMatchObject({ versionCount: 0, chargeableRounds: 0, fee: 0 });
    expect(computeRevisionOverage(4.9)).toMatchObject({ versionCount: 4, chargeableRounds: 1, fee: 100 });
  });
});

describe("visibleRevisionDescription", () => {
  it("คงรายละเอียดจริงไว้เมื่อผู้ใช้เห็นเงิน", () => {
    expect(
      visibleRevisionDescription("CHANGE_ORDER", "ใบแก้ไข CO-001: เพิ่มงาน 500 บาท", true),
    ).toBe("ใบแก้ไข CO-001: เพิ่มงาน 500 บาท");
  });

  it("แทนรายละเอียดที่อาจมียอดเงินด้วยข้อความปลอดภัย", () => {
    expect(
      visibleRevisionDescription("FEES", "คิดค่าแก้แบบเกินโควตา 2 รอบ (฿200)", false),
    ).toBe("แก้ไขค่าธรรมเนียม");
    expect(
      visibleRevisionDescription("CHANGE_ORDER", "ใบแก้ไข CO-001: เพิ่มงาน 500 บาท", false),
    ).toBe("ออกใบแก้ไขออเดอร์");
    expect(visibleRevisionDescription("PRICE", "ปรับเป็น 900฿", false)).toBe("อัปเดตออเดอร์");
  });

  it("คงข้อความสถานะซึ่งไม่มีข้อมูลเงิน", () => {
    expect(visibleRevisionDescription("STATUS", "CONFIRMED → DESIGNING", false)).toBe(
      "CONFIRMED → DESIGNING",
    );
  });
});
