/* ============================================================
   ผังงานในโรงงานบนหน้าแรก — node จริงของสายผลิต (เบสเคาะ 2026-09-14)

   สายเสื้อ: ออกแบบ/รอลูกค้า → เตรียมเสื้อ → ร้านนอก ─┐
   สายฟิล์ม:              พิมพ์ฟิล์ม DTF ───────────────┴→ รีดร้อน → ตรวจ QC → แพ็กสุดท้าย → ส่งของ

   ด่านรีดร้อนเริ่มได้เมื่อ "ฟิล์มเสร็จ ∧ เสื้อพร้อม" (evaluateHeatPressGate) — จำนวนที่รอ
   แต่ละอย่างจึงเป็นตัวบอกว่าสายไหนช้า · สถานี 5 ด่านทำเองตรงกับ factory-station.ts
   ไฟล์นี้ตีความตัวเลขจาก service (home-overview) เป็น node/สี/คอขวด ไม่ยิงข้อมูลเอง
   ============================================================ */

export type FactoryNodeKey = "design" | "prep" | "vendor" | "film" | "press" | "qc" | "pack" | "ship";
export type FactoryTone = "ok" | "warn" | "bad";

export interface FactoryNodeCounts {
  design: { total: number; awaitingApproval: number };
  prep: { total: number; active: number };
  film: { total: number; active: number };
  vendor: { pending: number; overduePickup: number };
  press: { total: number; active: number; ready: number; waitingFilm: number; waitingGarment: number };
  qc: { total: number; checkedToday: number };
  pack: { total: number };
  ship: { readyToShip: number; dueToday: number };
}

export interface FactoryNode {
  key: FactoryNodeKey;
  name: string;
  count: number;
  unit: "ใบงาน" | "ออเดอร์";
  /** ตัวเลขประกอบสั้น ๆ ใต้จำนวน */
  detail: string;
  tone: FactoryTone;
  /** node นอกโรงงาน (ลูกค้า/ร้านนอก/ขนส่ง) — วาดเป็นเส้นประ */
  external: boolean;
  href: string;
  /** งานที่เลยกำหนด ณ node นี้ — ใช้หา "คอขวด" */
  late: number;
  /** งานที่ติดรออยู่หน้า node นี้ */
  waiting: number;
}

export const FACTORY_NODE_ORDER: readonly FactoryNodeKey[] = [
  "design",
  "prep",
  "vendor",
  "film",
  "press",
  "qc",
  "pack",
  "ship",
];

export const FACTORY_TONE_LABELS: Record<FactoryTone, string> = {
  ok: "ปกติ",
  warn: "ต้องดู",
  bad: "ติด",
};

export function buildFactoryNodes(
  counts: FactoryNodeCounts,
  facts: { printRunsToday: number },
): FactoryNode[] {
  const pressWaiting = counts.press.waitingFilm + counts.press.waitingGarment;
  return [
    {
      key: "design",
      name: "ออกแบบ",
      count: counts.design.total,
      unit: "ออเดอร์",
      detail: `รอลูกค้าอนุมัติ ${counts.design.awaitingApproval}`,
      tone: counts.design.awaitingApproval > 0 ? "warn" : "ok",
      external: true,
      href: "/orders?status=DESIGNING",
      late: 0,
      waiting: counts.design.awaitingApproval,
    },
    {
      key: "prep",
      name: "เตรียมเสื้อ",
      count: counts.prep.total,
      unit: "ใบงาน",
      detail: `กำลังทำ ${counts.prep.active}`,
      tone: "ok",
      external: false,
      href: "/production?station=prep",
      late: 0,
      waiting: 0,
    },
    {
      key: "vendor",
      name: "ร้านนอก",
      count: counts.vendor.pending,
      unit: "ใบงาน",
      detail: counts.vendor.overduePickup > 0 ? `เลยกำหนดรับ ${counts.vendor.overduePickup}` : "รับกลับตามกำหนด",
      tone: counts.vendor.overduePickup > 0 ? "bad" : "ok",
      external: true,
      href: "/production?view=outsource",
      late: counts.vendor.overduePickup,
      waiting: 0,
    },
    {
      key: "film",
      name: "พิมพ์ฟิล์ม DTF",
      count: counts.film.total,
      unit: "ใบงาน",
      detail: `กำลังพิมพ์ ${counts.film.active} · รอบพิมพ์วันนี้ ${facts.printRunsToday}`,
      tone: "ok",
      external: false,
      href: "/production?station=film",
      late: 0,
      waiting: 0,
    },
    {
      key: "press",
      name: "รีดร้อน",
      count: counts.press.total,
      unit: "ใบงาน",
      detail:
        pressWaiting > 0
          ? `พร้อมรีด ${counts.press.ready} · รอฟิล์ม ${counts.press.waitingFilm} · รอเสื้อ ${counts.press.waitingGarment}`
          : `พร้อมรีด ${counts.press.ready}`,
      tone: pressWaiting > 0 ? "warn" : "ok",
      external: false,
      href: "/production?station=press",
      late: 0,
      waiting: pressWaiting,
    },
    {
      key: "qc",
      name: "ตรวจ QC",
      count: counts.qc.total,
      unit: "ออเดอร์",
      detail: `ตรวจแล้ววันนี้ ${counts.qc.checkedToday}`,
      tone: "ok",
      external: false,
      href: "/production",
      late: 0,
      waiting: 0,
    },
    {
      key: "pack",
      name: "แพ็กสุดท้าย",
      count: counts.pack.total,
      unit: "ออเดอร์",
      detail: `พร้อมส่ง ${counts.ship.readyToShip}`,
      tone: "ok",
      external: false,
      href: "/production",
      late: 0,
      waiting: 0,
    },
    {
      key: "ship",
      name: "ส่งของ",
      count: counts.ship.readyToShip,
      unit: "ออเดอร์",
      detail: `กำหนดส่งวันนี้ ${counts.ship.dueToday}`,
      tone: "ok",
      external: true,
      href: "/orders?status=READY_TO_SHIP",
      late: 0,
      waiting: 0,
    },
  ];
}

/** node ที่มีงานเลยกำหนดมากที่สุด — ไม่มีเลยคืน null (ไม่ติดป้ายเปล่า) */
export function findBottleneck(nodes: readonly FactoryNode[]): FactoryNodeKey | null {
  let worst: FactoryNode | null = null;
  for (const node of nodes) {
    if (node.late > 0 && (!worst || node.late > worst.late)) worst = node;
  }
  return worst?.key ?? null;
}

export function factoryHealth(nodes: readonly FactoryNode[]): { bad: number; warn: number; tone: FactoryTone } {
  const bad = nodes.filter((node) => node.tone === "bad").length;
  const warn = nodes.filter((node) => node.tone === "warn").length;
  return { bad, warn, tone: bad > 0 ? "bad" : warn > 0 ? "warn" : "ok" };
}

/** สัดส่วนงานในมือของ node ทำเอง เทียบ node ที่หนักสุด (ยังไม่มีกำลังต่อวันจาก WorkCenter) */
export function relativeLoad(nodes: readonly FactoryNode[]): Map<FactoryNodeKey, number> {
  const inHouse = nodes.filter((node) => !node.external);
  const max = Math.max(1, ...inHouse.map((node) => node.count));
  return new Map(inHouse.map((node) => [node.key, node.count / max]));
}
