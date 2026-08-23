import { describe, expect, it } from "vitest";

import { assertFinalPackOutput } from "./final-pack";

const line = {
  quantityLineId: "line-1",
  expectedRevision: 0,
  qtyGood: 3,
  qtyScrap: 0,
  qtyRework: 0,
};

describe("final pack output", () => {
  it("รับเฉพาะยอดแพ็กที่แจกแจงเป็น line", () => {
    expect(() =>
      assertFinalPackOutput({
        qtyGood: 3,
        qtyScrap: 0,
        qtyRework: 0,
        quantityLines: [line],
      }),
    ).not.toThrow();
  });

  it("ห้ามยอดรวมลอยและห้ามบันทึก scrap/rework ที่สถานีแพ็ก", () => {
    expect(() =>
      assertFinalPackOutput({ qtyGood: 3, qtyScrap: 0, qtyRework: 0 }),
    ).toThrow("แยกตามสินค้า สี และไซซ์");
    expect(() =>
      assertFinalPackOutput({
        qtyGood: 2,
        qtyScrap: 1,
        qtyRework: 0,
        quantityLines: [{ ...line, qtyGood: 2, qtyScrap: 1 }],
      }),
    ).toThrow("ต้องย้อนกลับไป QC");
  });
});
