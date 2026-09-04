/**
 * จอสถานี `/station` แบบ A "หยิบงานเอง" (เบสเคาะ 2026-09-03 จากหน้าลอง /proto/station) — ฝั่งกติกา
 *
 * รับ board จาก `buildProductionBoard` (สูตรเดิม: จุดงานต่อสาย/ช่วงหลังผลิต) แล้วตอบคำถามของจอนี้:
 *   สถานีมีอะไรบ้าง · สถานีนี้มีการ์ดอะไร (ใบ × จุดงาน) · การ์ดอยู่กลุ่มไหน (กำลังทำ / พร้อมทำ / ติด-รอ) · ช่างคนนี้เห็นใบไหน
 *
 * สถานี = กลุ่มของสาย (lane) ในโรงงาน · ร้านนอกทุกประเภทยุบเป็นสถานีเดียว (เหมือนชิป "ร้านนอก" หน้าการผลิต)
 * · QC/แพ็กเป็นช่วงหลังผลิตที่ยึดสถานะออเดอร์ (POST_SECTIONS)
 * ⚠️ ยังเป็นรายการตายตัวตาม lane ของ legacy — พอ V2 cutover ให้เปลี่ยนแหล่งเป็น work center ในหน้าตั้งค่า (ROADMAP §A2)
 *
 * pure function ทั้งหมด — ไม่แตะ DOM ไม่แตะ Date.now()
 */

import {
  POST_SECTIONS,
  STATION_LEGACY_QC,
  type BoardJob,
  type BoardOrderLike,
  type BoardSpot,
  type BoardStepLike,
  type ProductionBoard,
} from "@/lib/production-board";
import { LANE_LABELS, LANE_ORDER, OUTSOURCE_LANES, STEP_TYPE_LABELS, laneOf } from "@/lib/production-steps";

export const STATION_OUTSOURCE = "outsource";

export type StationKind = "lane" | "outsource" | "post";

export type StationDef = {
  key: string;
  label: string;
  hint: string;
  kind: StationKind;
  /** stationKey ของจุดงานบน board ที่นับเป็นสถานีนี้ */
  spotKeys: readonly string[];
};

const STATION_HINT: Record<string, string> = {
  "lane:PREP": "เบิกจากสต๊อก หรือตรวจรับเสื้อลูกค้า",
  "lane:DTF": "พิมพ์ฟิล์ม แล้วรีดร้อน",
  "lane:OTHER": "ขั้นพิเศษที่ไม่อยู่ในสายประจำ",
  "lane:PACK": "ขั้นแพ็กจากใบเก่า",
  [STATION_LEGACY_QC]: "ใบเก่าที่ขั้นครบแล้ว รอส่งเข้า QC",
  "post:qc": "นับของดี / ของเสีย ก่อนแพ็ก",
  "post:pack": "พับ ถุง ลัง ใบแพ็ก แล้วปิดพร้อมส่ง",
};

/** สถานีประจำ — อยู่ครบทุกวันแม้ไม่มีงาน (เหมือนชิปหน้าการผลิต: 0 ก็เป็นข้อมูล) */
const FIXED_STATIONS: readonly StationDef[] = [
  ...LANE_ORDER.filter((lane) => !OUTSOURCE_LANES.has(lane) && lane !== "OTHER" && lane !== "PACK").map((lane) => ({
    key: `lane:${lane}`,
    label: lane === "DTF" ? "พิมพ์ DTF / รีดร้อน" : LANE_LABELS[lane],
    hint: STATION_HINT[`lane:${lane}`] ?? "",
    kind: "lane" as const,
    spotKeys: [`lane:${lane}`],
  })),
  {
    key: STATION_OUTSOURCE,
    label: "ร้านนอก",
    hint: "ส่งงาน ตามของ รับของกลับ",
    kind: "outsource",
    spotKeys: LANE_ORDER.filter((lane) => OUTSOURCE_LANES.has(lane)).map((lane) => `lane:${lane}`),
  },
  ...POST_SECTIONS.filter((section) => section.key !== "post:ship").map((section) => ({
    key: section.key as string,
    label: section.label === "กำลังแพ็ค" ? "แพ็กสุดท้าย" : section.label,
    hint: STATION_HINT[section.key] ?? "",
    kind: "post" as const,
    spotKeys: [section.key as string],
  })),
];

/** สถานีทั้งหมดของจอ — ประจำ + สายนอกรายการที่ดันมีงานจริง (ข้อมูลเก่า) ต้องไม่หายจนงานไม่มีที่ไป */
export function stationDefs(board: Pick<ProductionBoard<unknown, BoardStepLike>, "stations">): StationDef[] {
  const covered = new Set(FIXED_STATIONS.flatMap((s) => s.spotKeys));
  const extra = board.stations
    .filter((station) => !covered.has(station.key) && station.kind !== "queue" && station.key !== "post:ship" && station.count > 0)
    .map<StationDef>((station) => ({
      key: station.key,
      label: station.label,
      hint: STATION_HINT[station.key] ?? "",
      kind: station.isOutsource ? "outsource" : station.kind === "post" ? "post" : "lane",
      spotKeys: [station.key],
    }));
  return [...FIXED_STATIONS, ...extra];
}

/** ขั้นชนิดนี้ขึ้นคิวที่สถานีไหน — ใบผลิตใช้บอกหัวหน้าว่างานอยู่ที่ไหน (ชื่อชุดเดียวกับโหมดหน้างาน) */
export function stationForStep(stepType: string): Pick<StationDef, "key" | "label"> {
  const lane = laneOf(stepType);
  const key = OUTSOURCE_LANES.has(lane) ? STATION_OUTSOURCE : `lane:${lane}`;
  const def = FIXED_STATIONS.find((s) => s.key === key);
  return def ? { key: def.key, label: def.label } : { key, label: LANE_LABELS[lane] ?? lane };
}

export function resolveStation(raw: string | null | undefined, defs: readonly StationDef[]): StationDef | null {
  if (!raw) return null;
  return defs.find((def) => def.key === raw) ?? null;
}

export type StationCardState = "doing" | "ready" | "blocked" | "waiting";

export const STATION_STATE_META: Record<StationCardState, { label: string; tone: "info" | "neutral" | "error" | "warning"; strong: boolean }> = {
  doing: { label: "กำลังทำ", tone: "info", strong: true },
  ready: { label: "พร้อมทำ", tone: "neutral", strong: false },
  blocked: { label: "ติดปัญหา", tone: "error", strong: true },
  waiting: { label: "รอ", tone: "warning", strong: false },
};

const OUTSOURCE_AWAITING = new Set(["PENDING", "SENT", "IN_PROGRESS"]);

/** ขั้นบน board ที่รู้เรื่องร้านนอก/รอบพิมพ์ด้วย (optional เพราะ fixture เก่าไม่มี) */
export type StationStepLike = BoardStepLike & {
  outsourceOrders?: readonly {
    status: string;
    expectedBackAt: Date | string | null;
    vendor: { name: string };
  }[];
  printRunItems?: readonly { printRun: { runNumber: string } }[];
};

export type StationCard<O, S extends StationStepLike> = {
  key: string;
  job: BoardJob<O, S>;
  spot: BoardSpot<S>;
  step: S | null;
  stepLabel: string;
  state: StationCardState;
  owner: { id: string; name: string } | null;
  /** เหตุที่ติด/รอ — บอกช่างว่ารออะไร แทนปุ่มที่กดแล้วพัง */
  reason: string | null;
};

function stepLabelOf(step: BoardStepLike): string {
  return step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
}

function stateOf<S extends StationStepLike>(spot: BoardSpot<S>): { state: StationCardState; reason: string | null } {
  const step = spot.step;
  if (!step) return { state: "ready", reason: null };
  if (step.status === "FAILED") return { state: "blocked", reason: step.notes ?? step.qcNotes ?? "รอหัวหน้าตัดสินใจ" };
  if (step.status === "ON_HOLD") return { state: "blocked", reason: step.notes ?? "พักไว้ — รอหัวหน้าตัดสินใจ" };
  if (spot.waitingOn.length > 0) return { state: "waiting", reason: spot.waitingOn.join(" และ ") };
  const outsource = step.outsourceOrders?.[0];
  if (outsource && OUTSOURCE_AWAITING.has(outsource.status)) {
    return { state: "waiting", reason: `อยู่ที่ร้าน ${outsource.vendor.name}` };
  }
  const run = step.printRunItems?.[0];
  if (run) return { state: "doing", reason: `อยู่ในรอบพิมพ์ ${run.printRun.runNumber}` };
  if (step.status === "IN_PROGRESS") return { state: "doing", reason: null };
  return { state: "ready", reason: null };
}

/** การ์ดของสถานี — หนึ่งใบมีได้หลายการ์ดถ้าเดินหลายสายในสถานีเดียว (เช่น ร้านนอก 2 ร้าน) */
export function stationCards<S extends StationStepLike, O extends BoardOrderLike<S>>(
  board: Pick<ProductionBoard<O, S>, "jobs">,
  station: StationDef,
): StationCard<O, S>[] {
  const keys = new Set(station.spotKeys);
  const cards: StationCard<O, S>[] = [];
  for (const job of board.jobs) {
    for (const spot of job.spots) {
      if (!keys.has(spot.stationKey)) continue;
      const { state, reason } = stateOf(spot);
      cards.push({
        key: spot.key,
        job,
        spot,
        step: spot.step,
        stepLabel: spot.step ? stepLabelOf(spot.step) : spot.stationLabel,
        state,
        owner: spot.step?.assignedTo ?? null,
        reason,
      });
    }
  }
  return cards;
}

export type StationViewer = { id: string | null; canSupervise: boolean };

/** ช่างเห็นเฉพาะงานของตน/ยังไม่มีคนรับ · หัวหน้าเห็นข้ามคน (กติกาเดิมของจอสถานี docs/DESIGN.md) */
export function visibleCards<O, S extends StationStepLike>(cards: readonly StationCard<O, S>[], viewer: StationViewer): StationCard<O, S>[] {
  if (viewer.canSupervise) return [...cards];
  return cards.filter((card) => !card.owner || card.owner.id === viewer.id);
}

export type StationQueue<O, S extends StationStepLike> = {
  doing: StationCard<O, S>[];
  ready: StationCard<O, S>[];
  blocked: StationCard<O, S>[];
};

/** คิว 3 กลุ่ม — กำลังทำ → พร้อมทำ → ติด/รอ (ลำดับในกลุ่มตามกำหนดส่งที่ board เรียงมาแล้ว) */
export function stationQueue<O, S extends StationStepLike>(cards: readonly StationCard<O, S>[]): StationQueue<O, S> {
  return {
    doing: cards.filter((card) => card.state === "doing"),
    ready: cards.filter((card) => card.state === "ready"),
    blocked: cards.filter((card) => card.state === "blocked" || card.state === "waiting"),
  };
}

export type StationCount = StationDef & { doing: number; ready: number; blocked: number; total: number };

export function stationCounts<S extends StationStepLike, O extends BoardOrderLike<S>>(
  board: Pick<ProductionBoard<O, S>, "jobs" | "stations">,
  viewer: StationViewer,
): StationCount[] {
  return stationDefs(board).map((def) => {
    const queue = stationQueue(visibleCards(stationCards(board, def), viewer));
    return {
      ...def,
      doing: queue.doing.length,
      ready: queue.ready.length,
      blocked: queue.blocked.length,
      total: queue.doing.length + queue.ready.length + queue.blocked.length,
    };
  });
}

/** เปิดหน้าลงมือจาก URL โดยไม่รู้สถานี (ลิงก์จากใบผลิต · ช่างถูกพามาจาก /production/[id]) — หาสถานีที่ใบ/ขั้นนั้นอยู่ในคิว */
export function findStationForJob<S extends StationStepLike, O extends BoardOrderLike<S>>(
  board: Pick<ProductionBoard<O, S>, "jobs">,
  defs: readonly StationDef[],
  productionId: string,
  stepId: string | null,
): StationDef | null {
  for (const def of defs) {
    if (stationCards(board, def).some((card) => card.spot.productionId === productionId && (!stepId || card.step?.id === stepId))) return def;
  }
  return null;
}

/** ข้อความแจ้งปัญหาที่ส่งเข้า server จากปุ่มเลือกเหตุ + ช่องรายละเอียด — "" = ยังส่งไม่ได้ */
export function composeProblemReason(reason: string | null, detail: string): string {
  const extra = detail.trim();
  if (reason === "other") return extra;
  if (!reason) return "";
  return extra ? `${reason} — ${extra}` : reason;
}

export const PROBLEM_REASON_MIN_LENGTH = 3;

/** เหตุผลแจ้งปัญหาแบบกดเลือก — ช่างไม่ต้องพิมพ์ (ข้อความไปลง reportStationProblem.reason ตรง ๆ) */
export const STATION_PROBLEM_REASONS = [
  "เสื้อไม่พอ / ไม่ตรงใบงาน",
  "เสื้อมีตำหนิ",
  "ฟิล์ม / ไฟล์ไม่ตรงม็อกอัพ",
  "เครื่องเสีย",
  "ของร้านนอกยังไม่มา",
] as const;
