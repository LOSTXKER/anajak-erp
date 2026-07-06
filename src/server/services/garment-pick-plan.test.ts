import { describe, it, expect } from "vitest";
import { mergePickUsage, planGarmentIssue, planGarmentReturn } from "./garment-pick-plan";

describe("mergePickUsage — รวมยอดเบิก/คืนสะสมลงแถวเบิก", () => {
  const lineA = { sku: "TS-M", productId: "p1", variantId: "v1", qty: 100 };
  const lineB = { sku: "TS-L", productId: "p1", variantId: "v2", qty: 50 };

  it("แยกเบิก/คืนต่อ (สินค้า, variant) ถูกแถว + needed = ยอดตามออเดอร์", () => {
    const merged = mergePickUsage(
      [lineA, lineB],
      [
        { productId: "p1", productVariantId: "v1", quantity: 60, movementType: "ISSUE" },
        { productId: "p1", productVariantId: "v1", quantity: 45, movementType: "ISSUE" },
        { productId: "p1", productVariantId: "v1", quantity: 5, movementType: "RETURN" },
        { productId: "p1", productVariantId: "v2", quantity: 20, movementType: "ISSUE" },
      ]
    );
    expect(merged[0]).toMatchObject({ sku: "TS-M", needed: 100, issued: 105, returned: 5 });
    expect(merged[1]).toMatchObject({ sku: "TS-L", needed: 50, issued: 20, returned: 0 });
  });

  it("variant null (จองระดับสินค้า) จับคู่กันเองไม่ปนกับ variant จริง", () => {
    const merged = mergePickUsage(
      [{ sku: "X", productId: "p1", variantId: null, qty: 10 }],
      [
        { productId: "p1", productVariantId: null, quantity: 4, movementType: "ISSUE" },
        { productId: "p1", productVariantId: "v9", quantity: 99, movementType: "ISSUE" },
      ]
    );
    expect(merged[0].issued).toBe(4);
  });

  it("usage ที่ key ไม่ตรงแถวไหน (รายการออเดอร์เปลี่ยนไปแล้ว) ถูกทิ้งเงียบ", () => {
    const merged = mergePickUsage(
      [lineA],
      [{ productId: "pX", productVariantId: "vX", quantity: 7, movementType: "ISSUE" }]
    );
    expect(merged[0]).toMatchObject({ issued: 0, returned: 0 });
  });
});

describe("planGarmentIssue — แผนเบิกรอบนี้ + stepDone", () => {
  const state = [
    { sku: "TS-M", issued: 0, returned: 0, needed: 100 },
    { sku: "TS-L", issued: 0, returned: 0, needed: 50 },
  ];

  it("กรองบรรทัด qty ≤ 0 ทิ้ง (ช่องว่างบนฟอร์ม) — เหลือแต่ที่เบิกจริง", () => {
    const plan = planGarmentIssue(state, [
      { sku: "TS-M", qty: 100 },
      { sku: "TS-L", qty: 0 },
    ]);
    expect(plan.requested).toEqual([{ sku: "TS-M", qty: 100 }]);
    expect(plan.issuedThisRound).toBe(100);
  });

  it("กรองก่อน validate — แถว qty 0 ของ sku ที่หลุดจากออเดอร์ไปแล้วไม่ล้มทั้งใบ", () => {
    const plan = planGarmentIssue(state, [
      { sku: "GHOST", qty: 0 },
      { sku: "TS-M", qty: 5 },
    ]);
    expect(plan.requested).toEqual([{ sku: "TS-M", qty: 5 }]);
  });

  it("ไม่ได้ระบุจำนวนเลย → ปฏิเสธ", () => {
    expect(() => planGarmentIssue(state, [{ sku: "TS-M", qty: 0 }])).toThrow(
      "ยังไม่ได้ระบุจำนวนที่เบิก"
    );
  });

  it("sku นอกรายการเสื้อจากสต๊อค → ปฏิเสธพร้อมชื่อ sku", () => {
    expect(() => planGarmentIssue(state, [{ sku: "GHOST", qty: 5 }])).toThrow(
      "รายการ GHOST ไม่อยู่ในรายการเสื้อจากสต๊อคของออเดอร์นี้"
    );
  });

  it("จำนวนไม่ใช่จำนวนเต็ม → ปฏิเสธ", () => {
    expect(() => planGarmentIssue(state, [{ sku: "TS-M", qty: 2.5 }])).toThrow(
      "จำนวนเบิกของ TS-M ต้องเป็นจำนวนเต็ม"
    );
  });

  it("เบิกเกิน needed ได้ (เบิกเผื่อเสียคือเรื่องปกติ — Stock เป็นคนกันของไม่พอ)", () => {
    const plan = planGarmentIssue(state, [
      { sku: "TS-M", qty: 105 },
      { sku: "TS-L", qty: 50 },
    ]);
    expect(plan.issuedThisRound).toBe(155);
    expect(plan.stepDone).toBe(true);
  });

  it("stepDone: เบิกสุทธิสะสม + รอบนี้ ≥ ต้องใช้ทั้งหมด (พอดีก็จบ · ขาดตัวเดียวยังไม่จบ)", () => {
    const partly = [
      { sku: "TS-M", issued: 80, returned: 0, needed: 100 },
      { sku: "TS-L", issued: 50, returned: 0, needed: 50 },
    ];
    expect(planGarmentIssue(partly, [{ sku: "TS-M", qty: 20 }]).stepDone).toBe(true);
    expect(planGarmentIssue(partly, [{ sku: "TS-M", qty: 19 }]).stepDone).toBe(false);
  });

  it("ยอดคืนหักออกจากสะสม — คืนแล้วต้องเบิกใหม่ให้ครบก่อนขั้นถึงจะจบ", () => {
    const withReturn = [{ sku: "TS-M", issued: 100, returned: 10, needed: 100 }];
    expect(planGarmentIssue(withReturn, [{ sku: "TS-M", qty: 9 }]).stepDone).toBe(false);
    expect(planGarmentIssue(withReturn, [{ sku: "TS-M", qty: 10 }]).stepDone).toBe(true);
  });

  // pin invariant ที่คอมเมนต์ในโค้ดประกาศไว้: สุทธิ "ไม่ clamp ต่อแถว" — แถวที่คืนมากกว่าเบิก
  // (เกิดได้จาก usage re-key ตอนรายการออเดอร์เปลี่ยน) ต้องหักยอดรวมตามจริง ไม่ใช่นับเป็น 0
  // (review จับด้วย mutation: ใส่ Math.max(0,·) ต่อแถวแล้วเทสชุดเดิมผ่านหมด — ขั้นเบิกจะปิดก่อน
  // ของครบจริง)
  it("ไม่ clamp ต่อแถว — แถวคืนมากกว่าเบิกหักยอดรวมตามจริง", () => {
    const rekeyed = [
      { sku: "A", issued: 10, returned: 0, needed: 10 },
      { sku: "B", issued: 0, returned: 4, needed: 0 },
    ];
    // สุทธิสะสม = 10 + (0−4) = 6 → เบิกอีก 3 = 9 < 10 ยังไม่จบ · อีก 4 = 10 พอดีจบ
    expect(planGarmentIssue(rekeyed, [{ sku: "A", qty: 3 }]).stepDone).toBe(false);
    expect(planGarmentIssue(rekeyed, [{ sku: "A", qty: 4 }]).stepDone).toBe(true);
  });
});

describe("planGarmentReturn — ด่านคืนเศษ", () => {
  const state = [
    {
      sku: "TS-M",
      productName: "เสื้อยืดคอกลม",
      size: "M",
      color: "ดำ",
      issued: 105,
      returned: 2,
    },
    { sku: "TS-F", productName: "เสื้อฟรีไซส์", size: "FREE", color: null, issued: 10, returned: 0 },
  ];

  it("คืนไม่เกินเบิกค้าง → ผ่าน + รวมยอดคืนถูก (ขอบพอดีเป๊ะผ่าน)", () => {
    const plan = planGarmentReturn(state, [
      { sku: "TS-M", qty: 103 },
      { sku: "TS-F", qty: 1 },
    ]);
    expect(plan.returnedQty).toBe(104);
    expect(plan.requested).toHaveLength(2);
  });

  it("คืนเกินเบิกค้าง → ปฏิเสธพร้อมชื่อสินค้า/ไซส์/สี และเพดานจริง", () => {
    expect(() => planGarmentReturn(state, [{ sku: "TS-M", qty: 104 }])).toThrow(
      "เสื้อยืดคอกลม M/ดำ: คืนได้ไม่เกิน 103 ตัว (เบิกค้างอยู่)"
    );
    // ไม่มีสี → ไม่มีเครื่องหมาย /
    expect(() => planGarmentReturn(state, [{ sku: "TS-F", qty: 11 }])).toThrow(
      "เสื้อฟรีไซส์ FREE: คืนได้ไม่เกิน 10 ตัว (เบิกค้างอยู่)"
    );
  });

  it("ไม่ได้ระบุจำนวน / sku แปลก / ไม่ใช่จำนวนเต็ม → ปฏิเสธตามด่าน", () => {
    expect(() => planGarmentReturn(state, [])).toThrow("ยังไม่ได้ระบุจำนวนที่คืน");
    // บรรทัด qty 0 ล้วน = ไม่ได้คืนอะไรจริง — ต้องโดนด่านเดียวกัน (pin ตัวกรอง qty > 0)
    expect(() => planGarmentReturn(state, [{ sku: "TS-M", qty: 0 }])).toThrow(
      "ยังไม่ได้ระบุจำนวนที่คืน"
    );
    expect(() => planGarmentReturn(state, [{ sku: "GHOST", qty: 1 }])).toThrow(
      "รายการ GHOST ไม่อยู่ในรายการเสื้อจากสต๊อคของออเดอร์นี้"
    );
    expect(() => planGarmentReturn(state, [{ sku: "TS-M", qty: 0.5 }])).toThrow(
      "จำนวนคืนของ TS-M ต้องเป็นจำนวนเต็ม"
    );
  });
});
