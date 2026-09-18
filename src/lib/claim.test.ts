import { describe, expect, it } from "vitest";
import { claimCloseBlockers, claimHeadline, type ClaimCloseInput } from "./claim";

/**
 * ด่านปิดใบเคลม (ก้อน 1) — เจตนาคือปิดช่องที่วันนี้ปล่อยให้ใบงานค้างสภาพ
 * "ตัดสินแล้วแต่ไม่มีเอกสาร" ได้ถาวร แต่ไม่บังคับสิ่งที่ระบบยังทำไม่ได้จริง
 */
const BASE: ClaimCloseInput = {
  state: "DECIDED",
  resolution: "REWORK",
  agreedCredit: 0,
  agreedCharge: 0,
  creditNoteTotal: 0,
  debitNoteTotal: 0,
  openReworkSteps: 0,
  reworkSteps: 1,
  orderBackToShipped: true,
  closeNote: null,
};

describe("claimCloseBlockers", () => {
  it("ยังไม่ตัดสิน = ปิดไม่ได้ และไม่ต้องไล่ด่านอื่นต่อ", () => {
    const blockers = claimCloseBlockers({ ...BASE, state: "OPEN", resolution: null });
    expect(blockers).toEqual(["ยังไม่ได้ตัดสินว่าจะจัดการอย่างไร"]);
  });

  it("ตัดสินว่าซ่อม แต่ยังไม่สั่งงานแก้ = ปิดไม่ได้", () => {
    const blockers = claimCloseBlockers({ ...BASE, reworkSteps: 0 });
    expect(blockers).toContain("ยังไม่ได้สั่งงานแก้เข้าสายผลิต");
  });

  it("งานแก้ยังไม่จบ = ปิดไม่ได้ และบอกว่าเหลือกี่ขั้น", () => {
    const blockers = claimCloseBlockers({ ...BASE, openReworkSteps: 2 });
    expect(blockers.some((b) => b.includes("เหลืออีก 2 ขั้น"))).toBe(true);
  });

  it("ตกลงลดราคาแต่ยังไม่ออกใบลดหนี้ = ปิดไม่ได้", () => {
    const blockers = claimCloseBlockers({
      ...BASE,
      resolution: "DISCOUNT",
      agreedCredit: 1500,
      reworkSteps: 0,
    });
    expect(blockers).toContain("ยังไม่ได้ออกใบลดหนี้ตามที่ตกลง");
  });

  it("ออกใบลดหนี้แล้วแต่ยอดไม่ตรงกับที่ตกลง = ปิดไม่ได้", () => {
    const blockers = claimCloseBlockers({
      ...BASE,
      resolution: "DISCOUNT",
      agreedCredit: 1500,
      creditNoteTotal: 1200,
      reworkSteps: 0,
    });
    expect(blockers.some((b) => b.includes("ไม่ตรงกับที่ตกลงไว้"))).toBe(true);
  });

  it("ยอดใบลดหนี้ตรงกับที่ตกลง = ผ่าน", () => {
    expect(
      claimCloseBlockers({
        ...BASE,
        resolution: "DISCOUNT",
        agreedCredit: 1500,
        creditNoteTotal: 1500,
        reworkSteps: 0,
      }),
    ).toEqual([]);
  });

  it("เก็บเงินเพิ่มต้องมีใบเพิ่มหนี้ ไม่ใช่ใบลดหนี้", () => {
    const blockers = claimCloseBlockers({
      ...BASE,
      resolution: "EXTRA_CHARGE",
      agreedCharge: 800,
      creditNoteTotal: 800, // ออกผิดชนิด
      reworkSteps: 0,
    });
    expect(blockers).toContain("ยังไม่ได้ออกใบเพิ่มหนี้ตามที่ตกลง");
  });

  it("ซ่อมเสร็จแต่ออเดอร์ยังไม่กลับไปจัดส่งแล้ว = ต้องเขียนเหตุผลปิดกำกับ", () => {
    const stuck = { ...BASE, orderBackToShipped: false };
    expect(claimCloseBlockers(stuck).some((b) => b.includes("เขียนเหตุผลที่ปิดใบ"))).toBe(true);
    // เขียนกำกับแล้วปิดได้ — เพราะตีกลับบางส่วนยังทำไม่ได้จริงในระบบก้อนนี้
    expect(claimCloseBlockers({ ...stuck, closeNote: "ส่งชดเชยครบแล้ว ใบส่งเดิมตีกลับทั้งใบ" })).toEqual([]);
  });

  it("ทางที่ไม่แตะของและไม่แตะเงิน (ไม่รับเคลม) ปิดได้ทันที", () => {
    expect(claimCloseBlockers({ ...BASE, resolution: "REJECTED", reworkSteps: 0 })).toEqual([]);
  });

  it("ปิดหรือยกเลิกไปแล้ว ปิดซ้ำไม่ได้", () => {
    expect(claimCloseBlockers({ ...BASE, state: "CLOSED" })).toContain("ใบนี้ปิดไปแล้ว");
    expect(claimCloseBlockers({ ...BASE, state: "CANCELLED" })).toContain("ใบนี้ถูกยกเลิกเรื่องไปแล้ว");
  });
});

describe("claimHeadline", () => {
  it("รอตัดสิน บอกรอบและจำนวน", () => {
    expect(claimHeadline({ round: 2, state: "OPEN", resolution: null, qtyClaimed: 12 })).toBe(
      "งานแก้ รอบที่ 2 · 12 ตัว · รอตัดสิน",
    );
  });

  it("ตัดสินแล้ว บอกว่าจะทำอะไร", () => {
    expect(claimHeadline({ round: 1, state: "DECIDED", resolution: "REWORK", qtyClaimed: 3 })).toBe(
      "งานแก้ รอบที่ 1 · 3 ตัว · ซ่อม/ทำใหม่เฉพาะที่เสีย",
    );
  });

  it("ยังไม่รู้จำนวน ก็ไม่ต้องโชว์เลขศูนย์", () => {
    expect(claimHeadline({ round: 1, state: "OPEN", resolution: null, qtyClaimed: 0 })).toBe(
      "งานแก้ รอบที่ 1 · รอตัดสิน",
    );
  });
});
