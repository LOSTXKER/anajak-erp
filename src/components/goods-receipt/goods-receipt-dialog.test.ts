import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/components/goods-receipt/goods-receipt-dialog.tsx",
  "utf8",
);

describe("GoodsReceiptDialog Station evidence contract", () => {
  it("ส่งทุก canonical row จาก Station รวม counted=0", () => {
    expect(source).toContain("const isStationInspection =");
    expect(source).toContain("lines: (isStationInspection");
    expect(source).toContain(": lines.filter((l) => l.qtyCounted > 0 || l.defectQty > 0)");
  });

  it("เปิดให้ Station บันทึกผลนับทั้งใบเป็นศูนย์โดยบอกความหมายตรงๆ", () => {
    expect(source).toContain("!isStationInspection &&");
    expect(source).toContain('"\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e1c\u0e25\u0e15\u0e23\u0e27\u0e08: \u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e02\u0e2d\u0e07"');
  });
});
