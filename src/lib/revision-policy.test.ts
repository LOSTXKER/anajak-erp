import { describe, expect, it } from "vitest";
import { computeRevisionOverage } from "./revision-policy";

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
