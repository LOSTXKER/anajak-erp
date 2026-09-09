import { describe, expect, it } from "vitest";
import {
  allocateLegacyQcGood,
  legacyQcEvidence,
  type QcGoodLine,
} from "./qc-ledger";
import { packingEvidenceFromOrder } from "./packing-readiness";

type EvidenceOrder = Parameters<typeof legacyQcEvidence>[0];

function order(
  overrides: Partial<Pick<EvidenceOrder, "qcRecords" | "revisions">> = {},
): EvidenceOrder {
  return {
    items: [{ products: [{
      id: "product", description: "เสื้อยืด",
      variants: [
        { id: "m", size: "M", color: "ดำ", quantity: 6 },
        { id: "l", size: "L", color: "ดำ", quantity: 4 },
      ],
    }] }],
    qcRecords: [],
    revisions: [],
    ...overrides,
  };
}

function count(id: string, scopeRevisionId: string | null, lines: QcGoodLine[]) {
  return {
    id: `revision-${id}`, changeType: "QC_COUNT",
    newValue: JSON.stringify({
      kind: "LEGACY_QC_COUNT", version: 1, qcRecordId: id, scopeRevisionId, lines,
    }),
  };
}

function returned(
  id: string, deliveryId: string, deliveryLineId: string, variantId: string, qty: number,
) {
  return {
    id, changeType: "QC_RETURN",
    newValue: JSON.stringify({
      kind: "LEGACY_QC_RETURN", version: 1,
      sourceLines: [{ deliveryId, deliveryLineId, qty }],
      scopeLines: [{ variantId, qtyExpected: qty }],
    }),
  };
}

function parcels() {
  return [
    { id: "original", status: "DELIVERED", lines: [
      { id: "original-m", description: "เสื้อยืด", size: "M", color: "ดำ", qty: 6 },
      { id: "original-l", description: "เสื้อยืด", size: "L", color: "ดำ", qty: 4 },
    ] },
    { id: "replacement-l", status: "DELIVERED", lines: [
      { id: "replacement-l-line", description: "เสื้อยืด", size: "L", color: "ดำ", qty: 2 },
    ] },
  ];
}

describe("durable legacy QC and customer return evidence", () => {
  it("สะสมผลดีรายไซซ์จากประวัติออเดอร์ได้โดยไม่ต้องมี audit log", () => {
    const evidence = legacyQcEvidence(order({
      qcRecords: [
        { id: "round-2", qtyGood: 4, qtyDefect: 0 },
        { id: "round-1", qtyGood: 3, qtyDefect: 0 },
      ],
      revisions: [
        count("round-1", null, [{ variantId: "m", qtyGood: 3 }]),
        count("round-2", null, [{ variantId: "l", qtyGood: 4 }]),
      ],
    }));
    expect(evidence.checkedGood).toBe(7);
    expect(evidence.totalExpected).toBe(10);
    expect(evidence.lines.map((line) => [line.variantId, line.checkedGood])).toEqual([
      ["m", 3], ["l", 4],
    ]);
    expect(evidence.needsLegacyRecount).toBe(false);
  });

  it("ยอด QC เก่าที่ไม่มีหลักฐานรายไซซ์ต้องนับใหม่และไม่ยกยอดรวมมาแทนทุกไซซ์", () => {
    const evidence = legacyQcEvidence(order({
      qcRecords: [{ id: "old-aggregate", qtyGood: 10, qtyDefect: 0 }],
    }));
    expect(evidence.needsLegacyRecount).toBe(true);
    expect(evidence.checkedGood).toBe(0);
    expect(evidence.records).toEqual([]);
    expect(evidence.lines.every((line) => line.checkedGood === 0)).toBe(true);
  });

  it("ปฏิเสธหลักฐานที่นับ QcRecord เดียวซ้ำหรือยอดไม่ตรงผลตรวจ", () => {
    const revision = count("round-1", null, [{ variantId: "m", qtyGood: 3 }]);
    const qcRecords = [{ id: "round-1", qtyGood: 3, qtyDefect: 0 }];
    expect(() => legacyQcEvidence(order({
      qcRecords, revisions: [revision, revision],
    }))).toThrow("หลักฐาน QC ซ้ำ");
    expect(() => legacyQcEvidence(order({
      qcRecords,
      revisions: [count("round-1", null, [{ variantId: "m", qtyGood: 4 }])],
    }))).toThrow("ยอดดีในหลักฐาน QC ไม่ตรง");
  });

  it("M ผ่านแล้ว 3 จาก 6 ต้องห้ามนับ M เพิ่ม 4 แม้ยอดรวมออเดอร์ยังเหลือ 7", () => {
    const evidence = legacyQcEvidence(order({
      qcRecords: [{ id: "round-1", qtyGood: 3, qtyDefect: 0 }],
      revisions: [count("round-1", null, [{ variantId: "m", qtyGood: 3 }])],
    }));
    expect(evidence.totalExpected - evidence.checkedGood).toBe(7);
    expect(() => allocateLegacyQcGood({
      lines: evidence.lines, qtyGood: 4,
      goodLines: [{ variantId: "m", qtyGood: 4 }], defects: [],
    })).toThrow("นับเกินยอดงานรายไซซ์");
  });

  it("คืน L2 ส่งทดแทนแล้วคืน M1: ตรวจเฉพาะ M1 และของ L ที่ยังอยู่กับลูกค้ายังคงครบ 4", () => {
    const revisions = [
      count("original-qc", null, [{ variantId: "m", qtyGood: 6 }, { variantId: "l", qtyGood: 4 }]),
      returned("return-l2", "original", "original-l", "l", 2),
      count("return-l-qc", "return-l2", [{ variantId: "l", qtyGood: 2 }]),
      returned("return-m1", "original", "original-m", "m", 1),
    ];
    const source = order({
      revisions,
      qcRecords: [
        { id: "return-l-qc", qtyGood: 2, qtyDefect: 0 },
        { id: "original-qc", qtyGood: 10, qtyDefect: 0 },
      ],
    });
    const evidence = legacyQcEvidence(source);
    expect(evidence.scopeRevisionId).toBe("return-m1");
    expect(evidence.totalExpected).toBe(1);
    expect(evidence.checkedGood).toBe(0);
    expect(evidence.lines.map((line) => line.variantId)).toEqual(["m"]);
    const packing = packingEvidenceFromOrder({ ...source, deliveries: parcels() });
    expect(packing.totalPacked).toBe(9);
    expect(packing.totalRemaining).toBe(1);
    expect(packing.lines.find((line) => line.size === "L")?.packed).toBe(4);
    const checked = legacyQcEvidence({
      ...source,
      revisions: [...revisions, count("return-m-qc", "return-m1", [{ variantId: "m", qtyGood: 1 }])],
      qcRecords: [...source.qcRecords, { id: "return-m-qc", qtyGood: 1, qtyDefect: 0 }],
    });
    expect(checked.checkedGood).toBe(1);
    expect(checked.records.map((record) => record.id)).toEqual(["return-m-qc"]);
  });

  it("คืนทั้งกล่องทดแทนไม่นำจำนวนคืนมาหักซ้ำ และไม่กลืนชิ้นที่ยังอยู่กับลูกค้า", () => {
    const source = order({ revisions: [
      returned("return-l2", "original", "original-l", "l", 2),
      returned("return-m1", "original", "original-m", "m", 1),
      returned("return-replacement-l2", "replacement-l", "replacement-l-line", "l", 2),
    ] });
    const packing = packingEvidenceFromOrder({
      ...source,
      deliveries: parcels().map((parcel) => parcel.id === "replacement-l"
        ? { ...parcel, status: "RETURNED" } : parcel),
    });
    expect(packing.totalPacked).toBe(7);
    expect(packing.totalRemaining).toBe(3);
    expect(packing.lines.find((line) => line.size === "M")?.packed).toBe(5);
    expect(packing.lines.find((line) => line.size === "L")?.packed).toBe(2);
    expect(() => allocateLegacyQcGood({
      lines: [{ variantId: "m", qtyExpected: 1, checkedGood: 0 }],
      qtyGood: 1, goodLines: [{ variantId: "m", qtyGood: 1 }],
      defects: [{ variantId: "m", qty: 1 }], isReturnInspection: true,
    })).toThrow("จำนวนดีและเสียเกินจำนวนรับคืนรายไซซ์");
  });
});
