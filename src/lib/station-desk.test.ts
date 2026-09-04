import { describe, expect, it } from "vitest";
import { buildProductionBoard } from "@/lib/production-board";
import {
  STATION_OUTSOURCE,
  resolveStation,
  stationCards,
  stationCounts,
  stationDefs,
  stationQueue,
  visibleCards,
  type StationStepLike,
  stationForStep,
  findStationForJob,
  composeProblemReason,
  PROBLEM_REASON_MIN_LENGTH,
} from "@/lib/station-desk";

const NOW = new Date("2026-08-30T07:00:00.000Z");

type Step = StationStepLike & { assignedTo: { id: string; name: string } | null };

function step(partial: Partial<Step> & { id: string; stepType: string; sortOrder: number }): Step {
  return { status: "PENDING", assignedTo: null, qtyDone: 0, qtyTotal: 100, ...partial };
}

function order(partial: {
  id: string;
  internalStatus?: string;
  deadline?: string | null;
  steps?: Step[];
}) {
  return {
    id: partial.id,
    orderNumber: `ORD-${partial.id}`,
    deadline: partial.deadline ?? "2026-09-02T00:00:00.000Z",
    internalStatus: partial.internalStatus ?? "PRODUCING",
    productions: partial.steps ? [{ id: `p-${partial.id}`, status: "IN_PROGRESS", steps: partial.steps }] : [],
    readiness: null,
  };
}

const ORDERS = [
  // เตรียมเสื้อ กำลังทำ โดยเนส · DTF พร้อม
  order({
    id: "1",
    steps: [
      step({ id: "s1", stepType: "GARMENT_PICK", sortOrder: 1, status: "IN_PROGRESS", assignedTo: { id: "u-nes", name: "เนส" } }),
      step({ id: "s2", stepType: "DTF_PRINT", sortOrder: 2 }),
      step({ id: "s3", stepType: "HEAT_PRESS", sortOrder: 3 }),
    ],
  }),
  // ร้านปัก ของยังไม่กลับ · เตรียมเสื้อติดปัญหา (ของคนอื่น)
  order({
    id: "2",
    steps: [
      step({ id: "s4", stepType: "GARMENT_PICK", sortOrder: 1, status: "FAILED", notes: "เสื้อไม่พอ", assignedTo: { id: "u-bas", name: "บาส" } }),
      step({
        id: "s5",
        stepType: "EMBROIDERY",
        sortOrder: 2,
        status: "IN_PROGRESS",
        assignedTo: { id: "u-koi", name: "พี่ก้อย" },
        outsourceOrders: [{ status: "SENT", expectedBackAt: "2026-09-01T00:00:00.000Z", vendor: { name: "ร้านปักพี่หน่อย" } }],
      }),
    ],
  }),
  // อยู่ QC (ช่วงหลังผลิต)
  order({ id: "3", internalStatus: "QUALITY_CHECK", steps: [step({ id: "s6", stepType: "DTF_PRINT", sortOrder: 1, status: "COMPLETED" })] }),
];

function board(showBlocked = true) {
  return buildProductionBoard(ORDERS, { now: NOW, showBlocked });
}

describe("stationDefs", () => {
  it("มีสถานีประจำครบแม้ไม่มีงาน และร้านนอกทุกประเภทยุบเป็นสถานีเดียว", () => {
    const defs = stationDefs(board());
    expect(defs.map((d) => d.key)).toEqual(["lane:PREP", "lane:DTF", STATION_OUTSOURCE, "post:qc", "post:pack"]);
    expect(defs.find((d) => d.key === STATION_OUTSOURCE)?.spotKeys).toContain("lane:EMBROIDERY");
  });

  it("สายนอกรายการที่มีงานจริงโผล่เพิ่ม ไม่ให้งานไม่มีที่ไป", () => {
    const b = board();
    const defs = stationDefs({ stations: [...b.stations, { key: "lane:OTHER", label: "อื่นๆ", kind: "lane", count: 1, overdue: 0, isOutsource: false }] });
    expect(defs.at(-1)?.key).toBe("lane:OTHER");
  });

  it("resolveStation คืน null เมื่อไม่รู้จัก", () => {
    const defs = stationDefs(board());
    expect(resolveStation("lane:PREP", defs)?.label).toBe("เตรียมเสื้อ");
    expect(resolveStation("lane:NOPE", defs)).toBeNull();
    expect(resolveStation(null, defs)).toBeNull();
  });
});

describe("stationCards + stationQueue", () => {
  it("แยกกลุ่ม กำลังทำ / พร้อม / ติด และบอกเหตุที่ติด", () => {
    const b = board();
    const defs = stationDefs(b);
    const prep = stationQueue(stationCards(b, defs[0]!));
    expect(prep.doing.map((c) => c.job.order.id)).toEqual(["1"]);
    expect(prep.blocked.map((c) => c.job.order.id)).toEqual(["2"]);
    expect(prep.blocked[0]?.reason).toBe("เสื้อไม่พอ");
    expect(prep.blocked[0]?.stepLabel).toBe("เบิกเสื้อจากสต๊อค");
  });

  it("ร้านนอกที่ยังไม่กลับอยู่กลุ่มรอ พร้อมชื่อร้าน", () => {
    const b = board();
    const outsource = stationQueue(stationCards(b, resolveStation(STATION_OUTSOURCE, stationDefs(b))!));
    expect(outsource.blocked).toHaveLength(1);
    expect(outsource.blocked[0]?.state).toBe("waiting");
    expect(outsource.blocked[0]?.reason).toContain("ร้านปักพี่หน่อย");
  });

  it("ช่วงหลังผลิต (QC) เป็นการ์ดพร้อมทำที่ไม่มีขั้น", () => {
    const b = board();
    const qc = stationCards(b, resolveStation("post:qc", stationDefs(b))!);
    expect(qc).toHaveLength(1);
    expect(qc[0]?.step).toBeNull();
    expect(qc[0]?.state).toBe("ready");
  });

  it("ขั้นรีดที่รอฟิล์มอยู่กลุ่มรอ ไม่ใช่พร้อมทำ", () => {
    const b = board();
    const dtf = stationQueue(stationCards(b, resolveStation("lane:DTF", stationDefs(b))!));
    // ใบ 1: DTF_PRINT ยังไม่เสร็จ → จุดงานสาย DTF คือขั้นพิมพ์ (พร้อม) — ไม่มีการ์ดรีดค้าง
    expect(dtf.ready.map((c) => c.step?.stepType)).toEqual(["DTF_PRINT"]);
    expect(dtf.blocked).toHaveLength(0);
  });
});

describe("visibleCards + stationCounts", () => {
  it("ช่างเห็นเฉพาะงานของตน/ยังไม่มีคนรับ · หัวหน้าเห็นทุกคน", () => {
    const b = board();
    const prep = stationCards(b, stationDefs(b)[0]!);
    expect(visibleCards(prep, { id: "u-nes", canSupervise: false }).map((c) => c.job.order.id)).toEqual(["1"]);
    expect(visibleCards(prep, { id: "u-ton", canSupervise: false })).toHaveLength(0);
    expect(visibleCards(prep, { id: "u-bes", canSupervise: true })).toHaveLength(2);
  });

  it("ตัวเลขต่อสถานีนับตามคนดู", () => {
    const counts = stationCounts(board(), { id: "u-bes", canSupervise: true });
    const prep = counts.find((c) => c.key === "lane:PREP")!;
    expect(prep).toMatchObject({ doing: 1, ready: 0, blocked: 1, total: 2 });
    expect(counts.find((c) => c.key === "post:pack")).toMatchObject({ total: 0 });
  });
});

describe("stationForStep — ขั้นชนิดนี้อยู่สถานีไหน (ใบผลิตใช้ชื่อเดียวกับโหมดหน้างาน)", () => {
  it("ขั้นในโรงงานชี้สถานีประจำ · ร้านนอกทุกประเภทยุบเป็นสถานีเดียว", () => {
    expect(stationForStep("GARMENT_PICK").key).toBe("lane:PREP");
    expect(stationForStep("HEAT_PRESS").key).toBe("lane:DTF");
    expect(stationForStep("EMBROIDERY")).toEqual({ key: "outsource", label: "ร้านนอก" });
    expect(stationForStep("DTF_PRINT").key).toBe("lane:DTF");
  });
});

describe("composeProblemReason — ข้อความแจ้งปัญหาจากปุ่มเลือกเหตุ", () => {
  it("เลือกเหตุอย่างเดียว = ส่งเหตุนั้น · มีรายละเอียดต่อท้ายด้วยขีด", () => {
    expect(composeProblemReason("เครื่องเสีย", "")).toBe("เครื่องเสีย");
    expect(composeProblemReason("เครื่องเสีย", "  หัวพิมพ์ตัน ")).toBe("เครื่องเสีย — หัวพิมพ์ตัน");
  });
  it("อื่น ๆ ต้องพิมพ์เอง · ยังไม่เลือกอะไร = ส่งไม่ได้", () => {
    expect(composeProblemReason("other", " ฟิล์มหมด ")).toBe("ฟิล์มหมด");
    expect(composeProblemReason("other", "")).toBe("");
    expect(composeProblemReason(null, "อะไรก็ได้")).toBe("");
    expect("ab".length < PROBLEM_REASON_MIN_LENGTH).toBe(true);
  });
});

describe("findStationForJob — เปิดหน้าลงมือจากลิงก์ที่ไม่รู้สถานี", () => {
  it("หาสถานีจากใบ/ขั้นที่อยู่ในคิว · ไม่ระบุขั้นก็เจอ · ใบที่ไม่อยู่ในคิว = null", () => {
    const b = board();
    const defs = stationDefs(b);
    const prep = defs.find((d) => d.key === "lane:PREP")!;
    const card = stationCards(b, prep).find((c) => c.step?.id === "s1")!;
    expect(findStationForJob(b, defs, card.spot.productionId!, "s1")?.key).toBe("lane:PREP");
    expect(findStationForJob(b, defs, card.spot.productionId!, null)?.key).toBe("lane:PREP");
    const outsource = stationCards(b, defs.find((d) => d.key === STATION_OUTSOURCE)!).find((c) => c.step?.id === "s5")!;
    expect(findStationForJob(b, defs, outsource.spot.productionId!, "s5")?.key).toBe(STATION_OUTSOURCE);
    expect(findStationForJob(b, defs, "ไม่มีใบนี้", null)).toBeNull();
  });
});
