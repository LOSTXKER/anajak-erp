import { describe, it, expect } from "vitest";
import {
  spareAvailableOf,
  assertValidQcCounts,
  assertQcNotOverCount,
  qcNextMove,
} from "./qc-count";

describe("spareAvailableOf — เสื้อสำรองคงเหลือจากแถวเบิก", () => {
  it("เบิกเผื่อเกินที่ต้องใช้ = สำรอง (เบิก 105 คืน 0 ต้องใช้ 100 → 5)", () => {
    expect(spareAvailableOf([{ issued: 105, returned: 0, needed: 100 }])).toBe(5);
  });

  it("คืนของแล้วหักออกจากสำรอง (เบิก 110 คืน 5 ต้องใช้ 100 → 5)", () => {
    expect(spareAvailableOf([{ issued: 110, returned: 5, needed: 100 }])).toBe(5);
  });

  it("แถวเบิกขาด (ติดลบ) นับ 0 — ไม่หักส่วนเกินของแถวอื่น", () => {
    // แถวแรกขาด 3 · แถวสองเกิน 4 → สำรองรวม = 4 ไม่ใช่ 1 (ไซส์ M ขาดไม่ได้แปลว่า
    // เอาไซส์ L ส่วนเกินไปโปะได้ — คนละไซส์)
    expect(
      spareAvailableOf([
        { issued: 7, returned: 0, needed: 10 },
        { issued: 14, returned: 0, needed: 10 },
      ])
    ).toBe(4);
  });

  it("ไม่มีแถวเบิก (งานไม่ใช่เสื้อจากสต๊อค) → 0", () => {
    expect(spareAvailableOf([])).toBe(0);
  });
});

describe("assertValidQcCounts — ด่านกรอกผลตรวจ", () => {
  const good = { qty: 2, reason: "PRINT_PEEL" };

  it("กรอกถูก → คืนยอดของเสียรวม", () => {
    expect(assertValidQcCounts({ qtyGood: 10, defects: [good, { qty: 3, reason: "OTHER" }] })).toBe(5);
    expect(assertValidQcCounts({ qtyGood: 10, defects: [] })).toBe(0);
  });

  it("ของเสียจำนวนไม่ใช่จำนวนเต็มบวก → ปฏิเสธ", () => {
    expect(() => assertValidQcCounts({ qtyGood: 0, defects: [{ ...good, qty: 0 }] })).toThrow(
      "จำนวนของเสียต้องเป็นจำนวนเต็มมากกว่า 0"
    );
    expect(() => assertValidQcCounts({ qtyGood: 0, defects: [{ ...good, qty: 1.5 }] })).toThrow();
    expect(() => assertValidQcCounts({ qtyGood: 0, defects: [{ ...good, qty: -2 }] })).toThrow();
    // ตัวผิดอยู่ตำแหน่งที่สอง — pin ว่า validate ทุกแถวไม่ใช่แค่แถวแรก (review จับด้วย
    // mutation slice(0,1) · ต้อง assert ข้อความเป๊ะ: ถ้าเช็คแค่แถวแรก เคสนี้จะไปโยน
    // "ยังไม่ได้นับอะไรเลย" แทน เพราะ 2+(-2)=0)
    expect(() =>
      assertValidQcCounts({ qtyGood: 0, defects: [good, { ...good, qty: -2 }] })
    ).toThrow("จำนวนของเสียต้องเป็นจำนวนเต็มมากกว่า 0");
  });

  // ทุกช่องผิดพร้อมกัน → ข้อความของเสียมาก่อน (pin ลำดับด่าน: loop ของเสีย → ของดี → นับศูนย์)
  it("หลายช่องผิดพร้อมกัน → ข้อความของเสียมาก่อน", () => {
    expect(() =>
      assertValidQcCounts({ qtyGood: -1, defects: [{ qty: 0, reason: "MELTED" }] })
    ).toThrow("จำนวนของเสียต้องเป็นจำนวนเต็มมากกว่า 0");
  });

  it("สาเหตุของเสียไม่รู้จัก → ปฏิเสธพร้อมชื่อสาเหตุ (กัน typo จากคนยิง API ตรง)", () => {
    expect(() =>
      assertValidQcCounts({ qtyGood: 0, defects: [{ qty: 1, reason: "MELTED" }] })
    ).toThrow("ไม่รู้จักสาเหตุของเสีย: MELTED");
  });

  it("ของดีติดลบ/ไม่ใช่จำนวนเต็ม → ปฏิเสธ", () => {
    expect(() => assertValidQcCounts({ qtyGood: -1, defects: [good] })).toThrow(
      "จำนวนของดีต้องเป็นจำนวนเต็มตั้งแต่ 0"
    );
    expect(() => assertValidQcCounts({ qtyGood: 2.5, defects: [good] })).toThrow();
  });

  it("ไม่ได้นับอะไรเลย (ดี 0 เสีย 0) → ปฏิเสธ", () => {
    expect(() => assertValidQcCounts({ qtyGood: 0, defects: [] })).toThrow("ยังไม่ได้นับอะไรเลย");
  });
});

describe("assertQcNotOverCount — ด่านนับเกิน (ตรวจได้หลายรอบ)", () => {
  it("สะสม+รอบนี้พอดียอด → ผ่าน", () => {
    expect(() =>
      assertQcNotOverCount({ totalExpected: 300, checkedGood: 100, qtyGood: 200 })
    ).not.toThrow();
  });

  it("สะสม+รอบนี้เกินยอด → ปฏิเสธพร้อมจำนวนที่ใส่ได้อีก", () => {
    expect(() =>
      assertQcNotOverCount({ totalExpected: 300, checkedGood: 100, qtyGood: 250 })
    ).toThrow("นับเกินยอดงาน: ผ่านแล้ว 100 จาก 300 ตัว — รอบนี้ใส่ของดีได้อีกไม่เกิน 200");
  });

  it("งานไม่รู้ยอด (totalExpected 0 เช่น เปิดเบา) → นับอิสระ ไม่กั้น", () => {
    expect(() =>
      assertQcNotOverCount({ totalExpected: 0, checkedGood: 0, qtyGood: 999 })
    ).not.toThrow();
  });
});

describe("qcNextMove — ทางไปต่อหลังบันทึกผลรอบนี้", () => {
  const base = {
    qtyGood: 0,
    qtyDefect: 0,
    totalExpected: 100,
    checkedGood: 0,
    hasFromStock: true,
    spareAvailable: 0,
  };

  it("มีของเสีย + สำรองพอ → REWORK กลับผลิตแก้เลย", () => {
    expect(qcNextMove({ ...base, qtyDefect: 3, spareAvailable: 3 })).toBe("REWORK");
    expect(qcNextMove({ ...base, qtyDefect: 3, spareAvailable: 10 })).toBe("REWORK");
  });

  it("มีของเสีย + สำรองไม่พอ → HOLD_FOR_STOCK พักรอของ (งานแก้ห้ามเข้าคิวทั้งที่ไม่มีเสื้อ)", () => {
    expect(qcNextMove({ ...base, qtyDefect: 3, spareAvailable: 2 })).toBe("HOLD_FOR_STOCK");
  });

  it("มีของเสียแต่งานไม่มีแถวเบิกสต๊อค (ระบบไม่รู้ยอดสำรอง) → REWORK เสมอ ไม่เดาพักงาน", () => {
    expect(
      qcNextMove({ ...base, qtyDefect: 5, hasFromStock: false, spareAvailable: 0 })
    ).toBe("REWORK");
  });

  it("มีทั้งดีและเสียในรอบเดียว → ของเสียชนะ (กลับผลิตก่อน ค่อยตรวจรอบใหม่)", () => {
    expect(
      qcNextMove({ ...base, qtyGood: 90, qtyDefect: 10, spareAvailable: 10 })
    ).toBe("REWORK");
    // เคสชี้ขาดลำดับ branch (review จับ: 90/10 ไม่ครบยอด PACK เป็นเท็จอยู่แล้ว จับสลับ
    // ลำดับไม่ได้) — ดีครบยอด 100/100 พร้อมของเสีย 5 จากตัวสำรอง ต้องยังไปทางของเสีย
    // ไม่ใช่ประกาศเข้าแพ็คทั้งที่มีของเสียค้างไม่ถูกแก้
    expect(
      qcNextMove({ ...base, qtyGood: 100, qtyDefect: 5, spareAvailable: 10 })
    ).toBe("REWORK");
    expect(
      qcNextMove({ ...base, qtyGood: 100, qtyDefect: 5, spareAvailable: 0 })
    ).toBe("HOLD_FOR_STOCK");
  });

  it("ดีล้วนครบยอด (รวมสะสมรอบก่อน) → PACK", () => {
    expect(qcNextMove({ ...base, qtyGood: 100 })).toBe("PACK");
    expect(qcNextMove({ ...base, qtyGood: 40, checkedGood: 60 })).toBe("PACK");
  });

  it("ดีบางส่วน → STAY ค้างด่านตรวจให้ตรวจต่อ (ห้ามประกาศพร้อมแพ็ค)", () => {
    expect(qcNextMove({ ...base, qtyGood: 40, checkedGood: 0 })).toBe("STAY");
  });

  it("งานไม่รู้ยอด (totalExpected 0) + ดีอย่างน้อย 1 → PACK ปิดได้เลย", () => {
    expect(qcNextMove({ ...base, totalExpected: 0, qtyGood: 1 })).toBe("PACK");
  });
});
