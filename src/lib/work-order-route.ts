/**
 * เส้นทางงานของใบผลิต — "สายไหนเดินขนานกัน บรรจบตรงไหน แล้วขั้นนี้รออะไรอยู่"
 * (แบบ E "ตอนนี้ทำอะไร (รู้ทางขนาน)" · เบสเคาะ 2026-09-06 จากหน้าลอง /proto/work-order-redesign?v=flow)
 *
 * ไม่ใช่กติกาสถานะใหม่ — เป็นการ "วาด" กติกาที่มีอยู่แล้วให้เห็น:
 *   · สาย = เลนจาก laneOf(stepType) (production-steps) · ขั้นในเลนเดียวกันเรียงตาม sortOrder
 *   · จุดบรรจบที่ 1 = รีดร้อน (HEAT_PRESS) รอ "ฟิล์มเสร็จ ∧ เสื้อพร้อม (เตรียมเสื้อ + ร้านนอกทุกสาย)" — เงื่อนไขเดียวกับ evaluateHeatPressGate
 *   · จุดบรรจบที่ 2 = หางงาน (เลน OTHER/PACK เช่น QC · แพ็ก) รอทุกขั้นก่อนหน้า — เงื่อนไขเดียวกับ stepsBlockingQc ที่ sendToQc ใช้
 * ใบที่ไม่มีรีดร้อน/ไม่มีหาง → แผนที่ก็แค่ไม่มีคอลัมน์นั้น · ใบที่มีสายเดียว → แถวเดียว ไม่มีอะไรขนาน
 *
 * pure — ไม่มี DOM/DB · client ใช้วาดแผนที่ + บอก "รอ X + Y" ในการ์ด
 */

import { LANE_ORDER, laneOf, type ProductionLane } from "@/lib/production-steps";

export interface RouteStepLite {
  id: string;
  stepType: string;
  status: string;
  sortOrder: number;
}

/** เลนที่เป็น "หางงาน" หลังผลิตเสร็จ — ไม่ใช่สายที่เดินขนานกับใคร */
const TAIL_LANES: ReadonlySet<ProductionLane> = new Set<ProductionLane>(["OTHER", "PACK"]);

function bySort<S extends RouteStepLite>(a: S, b: S) {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export interface RouteParts<S extends RouteStepLite> {
  /** สายที่เดินขนานกัน เรียงตาม LANE_ORDER — แต่ละสายคือลำดับขั้นของเลนนั้น */
  lanes: { lane: ProductionLane; steps: S[] }[];
  /** จุดบรรจบที่ 1 — รีดร้อน (ถ้ามี) */
  merge: S | null;
  /** หางงานหลังบรรจบ (QC · แพ็ก · ขั้นกำหนดเอง) เรียงตาม sortOrder */
  tail: S[];
}

export function routeParts<S extends RouteStepLite>(steps: readonly S[]): RouteParts<S> {
  const sorted = [...steps].sort(bySort);
  const merge = sorted.find((s) => s.stepType === "HEAT_PRESS") ?? null;
  const tail = sorted.filter((s) => TAIL_LANES.has(laneOf(s.stepType)));
  const byLane = new Map<ProductionLane, S[]>();
  for (const s of sorted) {
    if (s === merge || TAIL_LANES.has(laneOf(s.stepType))) continue;
    const lane = laneOf(s.stepType);
    byLane.set(lane, [...(byLane.get(lane) ?? []), s]);
  }
  const lanes = LANE_ORDER.filter((l) => byLane.has(l)).map((lane) => ({ lane, steps: byLane.get(lane)! }));
  return { lanes, merge, tail };
}

/** ขั้นที่ต้องปิดก่อน ขั้นนี้จึง "ถึงคิว" — ตามตำแหน่งบนเส้นทาง */
export function routePredecessors<S extends RouteStepLite>(step: S, steps: readonly S[]): S[] {
  const { lanes, merge, tail } = routeParts(steps);
  const parallel = lanes.flatMap((l) => l.steps);
  if (merge && step.id === merge.id) return parallel;
  const tailIndex = tail.findIndex((s) => s.id === step.id);
  if (tailIndex >= 0) return [...parallel, ...(merge ? [merge] : []), ...tail.slice(0, tailIndex)];
  const lane = lanes.find((l) => l.steps.some((s) => s.id === step.id));
  if (!lane) return [];
  const index = lane.steps.findIndex((s) => s.id === step.id);
  return lane.steps.slice(0, index);
}

/** ขั้นก่อนหน้าที่ยังไม่ปิด = สิ่งที่ขั้นนี้ "รอ" อยู่ (ว่าง = ถึงคิวแล้ว) */
export function routeWaitingOn<S extends RouteStepLite>(step: S, steps: readonly S[]): S[] {
  return routePredecessors(step, steps).filter((s) => s.status !== "COMPLETED");
}

/* ───────────────────────── ผังตาราง (grid) สำหรับวาด ─────────────────────────
 * คอลัมน์คี่ = ขั้น · คอลัมน์คู่ = เส้นเชื่อม · แถว = สาย
 * สายที่สั้นกว่าสายที่ยาวสุดจะลากเส้นยาวไปชนคอลัมน์บรรจบ (เห็นว่ารออยู่ตรงนั้น) */

export interface RouteCell<S extends RouteStepLite> {
  step: S;
  /** สายของขั้น (null = ขั้นบรรจบ/หาง กินทุกแถว) */
  lane: ProductionLane | null;
  col: number;
  rowStart: number;
  rowEnd: number;
}

export interface RouteLink {
  key: string;
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
}

export interface RouteGrid<S extends RouteStepLite> {
  cells: RouteCell<S>[];
  links: RouteLink[];
  rows: number;
  /** จำนวนคอลัมน์ทั้งหมด (รวมคอลัมน์เส้น) */
  columns: number;
}

export function routeGrid<S extends RouteStepLite>(steps: readonly S[]): RouteGrid<S> {
  const { lanes, merge, tail } = routeParts(steps);
  const rows = Math.max(1, lanes.length);
  const width = Math.max(0, ...lanes.map((l) => l.steps.length));
  const cells: RouteCell<S>[] = [];
  const links: RouteLink[] = [];
  const parallelEnd = width * 2 - 1; // คอลัมน์ขั้นสุดท้ายของสายที่ยาวสุด (0 ถ้าไม่มีสาย)
  let col = parallelEnd;

  lanes.forEach(({ lane, steps: laneSteps }, r) => {
    const row = r + 1;
    laneSteps.forEach((s, i) => {
      const c = i * 2 + 1;
      cells.push({ step: s, lane, col: c, rowStart: row, rowEnd: row + 1 });
      if (i > 0) links.push({ key: `${s.id}-in`, colStart: c - 1, colEnd: c, rowStart: row, rowEnd: row + 1 });
    });
  });

  const after = [...(merge ? [merge] : []), ...tail];
  after.forEach((s) => {
    const c = col + 2;
    if (col > 0) {
      if (s === merge || (!merge && s === tail[0])) {
        // เส้นจากทุกสายวิ่งเข้าขั้นบรรจบ — สายที่สั้นกว่าลากยาวมาชน
        lanes.forEach(({ steps: laneSteps }, r) => {
          const from = laneSteps.length * 2;
          links.push({ key: `${s.id}-in-${r}`, colStart: from, colEnd: c, rowStart: r + 1, rowEnd: r + 2 });
        });
      } else {
        links.push({ key: `${s.id}-in`, colStart: c - 1, colEnd: c, rowStart: 1, rowEnd: rows + 1 });
      }
    }
    cells.push({ step: s, lane: null, col: c, rowStart: 1, rowEnd: rows + 1 });
    col = c;
  });

  return { cells, links, rows, columns: Math.max(col, 1) };
}
