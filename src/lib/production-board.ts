import {
  LANE_LABELS,
  LANE_ORDER,
  OUTSOURCE_LANES,
  STEP_TYPE_LABELS,
  evaluateHeatPressGate,
  laneOf,
  productionWorkflowSteps,
  type ProductionLane,
} from "@/lib/production-steps";
import { BANGKOK_TZ } from "@/lib/utils";
import type { OrderMockupSourceLike } from "@/lib/mockup";

/* ============================================================
   บอร์ดการผลิต — view model ของหน้า /production (ทิศ C · ใบงาน PC1)

   เบสเคาะจาก mockup 2026-08-15: แถบสายงานเป็น "ตัวนำทาง" ตอบว่าโรงงานตันตรงไหน
   ส่วนรายการเรียงตามวันส่งเป็น "เนื้องาน" ตอบว่าอะไรจะไม่ทัน — ข้อมูลไม่ซ้ำกัน

   หน่วยของหน้านี้คือ "จุดงาน" (spot) ไม่ใช่ออเดอร์: ออเดอร์ผสมเดินหลายสายพร้อมกัน
   จึงมีหลายจุดในใบเดียว · หนึ่งแถว = หนึ่งออเดอร์ แต่กางจุดงานครบทุกจุดในแถวนั้น
   (แสดงจุดเดียวแล้วปิดจุดที่เหลือ = โกหกว่าเหลืองานเดียว)

   pure ทั้งไฟล์ — ไม่แตะ query/permission/สถานะ · ปุ่มลงมือยังอิง step ดิบชุดเดิม
   ============================================================ */

export type BoardStationKind = "queue" | "lane" | "post";

export type BoardStepLike = {
  id: string;
  stepType: string;
  customStepName?: string | null;
  status: string;
  sortOrder: number;
  qtyDone?: number | null;
  qtyTotal?: number | null;
  notes?: string | null;
  qcNotes?: string | null;
  assignedTo?: { id: string; name: string } | null;
};

export type BoardProductionLike<S extends BoardStepLike> = {
  id: string;
  status?: string;
  steps: readonly S[];
};

export type BoardReadinessCheck = {
  label: string;
  ok: boolean;
  waitingOn?: string | null;
};

export type BoardOrderLike<S extends BoardStepLike> = {
  id: string;
  orderNumber: string;
  deadline: Date | string | null;
  priority?: string | null;
  internalStatus: string;
  blindShip?: boolean;
  customerName?: string | null;
  totalQuantity?: number;
  productions: readonly BoardProductionLike<S>[];
  readiness?: { ready: boolean; checks: readonly BoardReadinessCheck[] } | null;
  // รูปแทนงานบนแถวคิว — optional เพราะ board ใช้กับ test fixture และจอที่ไม่ได้ query
  // ส่วนนี้มาด้วย · สูตรเลือกรูปอยู่ที่ orderMockupCover ใน src/lib/mockup.ts ที่เดียว
} & OrderMockupSourceLike;

/** ช่วงกำหนดส่ง — หัวกลุ่มของรายการงาน (เรียงตามนี้เสมอ) */
export type BoardBucketKey =
  | "late"
  | "today"
  | "tomorrow"
  | "week"
  | "later"
  | "none";

/** จุดไล่สายบนแถว — บอกว่างานเดินถึงไหนแล้วทั้งเส้น (งานผสมติดหลายจุดพร้อมกันได้) */
export type BoardRailState = "done" | "now" | "stuck" | "failed" | "wait" | "na";
export type BoardRailPoint = { key: string; label: string; state: BoardRailState };

const RAIL_STEPS: { key: string; label: string; match: (stepType: string) => boolean }[] = [
  { key: "prep", label: "เตรียมเสื้อ", match: (t) => laneOf(t) === "PREP" },
  { key: "film", label: "พิมพ์ฟิล์ม", match: (t) => t === "DTF_PRINT" },
  { key: "press", label: "รีดร้อน", match: (t) => t === "HEAT_PRESS" },
  {
    key: "outsource",
    label: "ร้านนอก",
    match: (t) => OUTSOURCE_LANES.has(laneOf(t)),
  },
];

/** จุดงานหนึ่งจุด = หนึ่งสายของหนึ่งใบผลิต (หรือหนึ่งช่วงหลังผลิต/คิวรอเปิดใบ) */
export type BoardSpot<S extends BoardStepLike> = {
  key: string;
  stationKey: string;
  stationLabel: string;
  kind: BoardStationKind;
  productionId: string | null;
  /** step ปัจจุบันของสายนี้ — null สำหรับช่วงหลังผลิตและคิวรอเปิดใบผลิต */
  step: S | null;
  doneSteps: number;
  totalSteps: number;
  /** ลงมือไม่ได้เพราะรอของ (คิวรีด DTF) — บอกว่ารออะไร แทนที่จะโชว์ปุ่มที่กดแล้วพัง */
  waitingOn: string[];
  ready: boolean;
};

export type BoardJob<O, S extends BoardStepLike> = {
  key: string;
  order: O;
  bucket: BoardBucketKey;
  overdue: boolean;
  dueSoon: boolean;
  /** สายที่งานนี้ค้างอยู่จริง — ใช้กรองจากแถบสายงาน (งานผสมอยู่หลายสาย) */
  stationKeys: string[];
  spots: BoardSpot<S>[];
  rail: BoardRailPoint[];
  /** ข้อความที่ใช้ค้นหา (เลขออเดอร์ · ลูกค้า) — lowercase แล้ว */
  searchText: string;
};

export type BoardStation = {
  key: string;
  label: string;
  kind: BoardStationKind;
  count: number;
  overdue: number;
  isOutsource: boolean;
};

export type BoardExceptionReason = { label: string; tone: "red" | "amber" };

export type BoardException = {
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  deadline: Date | string | null;
  priority: string | null;
  reasons: BoardExceptionReason[];
  waitingOn: string[];
  href: string;
  /** งานติดด่านพร้อมผลิต — หัวหน้าข้ามด่านเปิดใบผลิตได้ (soft-gate เดิม) */
  skippable: boolean;
};

export type BoardMyWork = {
  key: string;
  productionId: string;
  orderNumber: string;
  stepName: string;
  status: string;
};

export type ProductionBoard<O, S extends BoardStepLike> = {
  jobs: BoardJob<O, S>[];
  stations: BoardStation[];
  exceptions: BoardException[];
  myWork: BoardMyWork[];
  totalJobs: number;
  /** จุดงานรวม > จำนวนออเดอร์ เมื่อมีงานผสมเดินหลายสาย — ต้องบอกผู้ใช้ตรง ๆ */
  totalSpots: number;
};

export const STATION_ALL = "";
export const STATION_QUEUE = "queue";
export const STATION_LEGACY_QC = "legacy:qc";

/** ช่วงหลังผลิต — เป็น "ขั้น" ที่ยึดกับสถานะออเดอร์ ไม่ใช่ขั้นในใบผลิต */
export const POST_SECTIONS = [
  { key: "post:qc", label: "ตรวจ QC", status: "QUALITY_CHECK" },
  { key: "post:pack", label: "กำลังแพ็ค", status: "PACKING" },
  { key: "post:ship", label: "พร้อมส่ง", status: "READY_TO_SHIP" },
] as const;

const QUEUE_STATUSES = new Set(["CONFIRMED", "DESIGN_APPROVED", "PRODUCTION_QUEUE"]);

const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

const DAY_MS = 24 * 60 * 60 * 1000;

/** วันตามปฏิทินไทย — เทียบ "วันนี้/พรุ่งนี้" ต้องใช้เขตเวลาไทย ไม่ใช่ UTC ของเครื่อง */
function bangkokDayKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function timeOf(value: Date | string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export function bucketOf(deadline: Date | string | null, now: Date): BoardBucketKey {
  const due = timeOf(deadline);
  if (due == null) return "none";
  const dueKey = bangkokDayKey(new Date(due));
  const todayKey = bangkokDayKey(now);
  if (dueKey < todayKey) return "late";
  if (dueKey === todayKey) return "today";
  if (dueKey === bangkokDayKey(new Date(now.getTime() + DAY_MS))) return "tomorrow";
  if (dueKey <= bangkokDayKey(new Date(now.getTime() + 7 * DAY_MS))) return "week";
  return "later";
}

function stepName(step: BoardStepLike): string {
  return step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
}

function sortByDue(
  a: { deadline: Date | string | null; priority?: string | null },
  b: { deadline: Date | string | null; priority?: string | null },
) {
  const aDue = timeOf(a.deadline) ?? Number.MAX_SAFE_INTEGER;
  const bDue = timeOf(b.deadline) ?? Number.MAX_SAFE_INTEGER;
  if (aDue !== bDue) return aDue - bDue;
  return (
    (PRIORITY_RANK[a.priority ?? "NORMAL"] ?? 2) -
    (PRIORITY_RANK[b.priority ?? "NORMAL"] ?? 2)
  );
}

/** สถานะจุดหนึ่งบน rail จากกองขั้นที่เข้าเกณฑ์ — ไม่มีขั้นเลย = สายนี้ไม่เกี่ยวกับงานใบนี้ */
function railStateOf(steps: readonly BoardStepLike[]): BoardRailState {
  if (steps.length === 0) return "na";
  if (steps.some((s) => s.status === "FAILED")) return "failed";
  if (steps.every((s) => s.status === "COMPLETED")) return "done";
  if (steps.some((s) => s.status === "IN_PROGRESS")) return "now";
  return "wait";
}

function buildRail<S extends BoardStepLike>(
  order: BoardOrderLike<S>,
  allSteps: readonly S[],
  pressBlocked: boolean,
): BoardRailPoint[] {
  const status = order.internalStatus;
  const afterProduction = ["QUALITY_CHECK", "PACKING", "READY_TO_SHIP"].includes(status);
  const points: BoardRailPoint[] = RAIL_STEPS.map((rail) => {
    const matched = allSteps.filter((step) => rail.match(step.stepType));
    let state = railStateOf(matched);
    // ผ่านด่านผลิตไปแล้ว ขั้นผลิตที่มีอยู่ถือว่าจบ (บางใบปิดโดย rollup ไม่ใช่กดทีละขั้น)
    if (afterProduction && state !== "na" && state !== "failed") state = "done";
    if (rail.key === "press" && pressBlocked && state === "wait") state = "stuck";
    return { key: rail.key, label: rail.label, state };
  });
  points.push({
    key: "qc",
    label: "ตรวจ QC",
    state:
      status === "QUALITY_CHECK"
        ? "now"
        : status === "PACKING" || status === "READY_TO_SHIP"
          ? "done"
          : "wait",
  });
  points.push({
    key: "pack",
    label: "แพ็ค",
    state:
      status === "PACKING"
        ? "now"
        : status === "READY_TO_SHIP"
          ? "done"
          : "wait",
  });
  return points;
}

export function buildProductionBoard<
  S extends BoardStepLike,
  O extends BoardOrderLike<S>,
>(
  orders: readonly O[],
  options: {
    now: Date;
    viewerId?: string | null;
    /** หัวหน้า/ขาย/การเงินเห็นกองงานติดด่าน · ช่างเห็นเฉพาะงานที่ลงมือได้จริง */
    showBlocked: boolean;
  },
): ProductionBoard<O, S> {
  const { now, viewerId, showBlocked } = options;
  const nowMs = now.getTime();
  const sorted = [...orders].sort(sortByDue);

  const queueOrders = sorted.filter(
    (order) =>
      QUEUE_STATUSES.has(order.internalStatus) ||
      (order.internalStatus === "PRODUCING" && order.productions.length === 0),
  );
  const blockedQueue = queueOrders.filter((o) => o.readiness?.ready === false);
  const queueIds = new Set(queueOrders.map((o) => o.id));

  const jobs: BoardJob<O, S>[] = [];
  const myWork: BoardMyWork[] = [];
  const pressWaitByOrder = new Map<string, string[]>();

  for (const order of sorted) {
    const overdue = (timeOf(order.deadline) ?? Number.MAX_SAFE_INTEGER) < nowMs;
    const bucket = bucketOf(order.deadline, now);
    const spots: BoardSpot<S>[] = [];
    const allSteps: S[] = [];
    let pressBlocked = false;

    // rail อ่านจากขั้นทั้งใบเสมอ แม้ออเดอร์จะผ่านด่านผลิตไปแล้ว — ไม่งั้นงานที่อยู่ QC/แพ็ค
    // จะแสดงว่าไม่เคยใช้สายไหนเลย ทั้งที่เพิ่งเดินผ่านมาหมาด ๆ
    for (const production of order.productions) {
      allSteps.push(...productionWorkflowSteps(production.steps));
    }

    if (order.internalStatus === "PRODUCING") {
      for (const production of order.productions) {
        const orderedSteps = [...production.steps].sort((left, right) => {
          if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
          return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
        });
        const steps = productionWorkflowSteps(orderedSteps);
        const hasPendingLegacyPackaging = orderedSteps.some(
          (step) => step.stepType === "PACKAGING" && step.status !== "COMPLETED",
        );
        const gate = evaluateHeatPressGate(steps);

        for (const step of steps) {
          if (
            viewerId &&
            step.assignedTo?.id === viewerId &&
            step.status !== "COMPLETED"
          ) {
            myWork.push({
              key: step.id,
              productionId: production.id,
              orderNumber: order.orderNumber,
              stepName: stepName(step),
              status: step.status,
            });
          }
        }

        const byLane = new Map<ProductionLane, S[]>();
        for (const step of steps) {
          const lane = laneOf(step.stepType);
          byLane.set(lane, [...(byLane.get(lane) ?? []), step]);
        }
        for (const [lane, laneSteps] of byLane) {
          const pending = laneSteps.filter((s) => s.status !== "COMPLETED");
          if (pending.length === 0) continue;
          const current = pending[0]!;
          const gated =
            current.stepType === "HEAT_PRESS" &&
            !gate.ready &&
            current.status !== "FAILED";
          if (gated) {
            pressBlocked = true;
            pressWaitByOrder.set(order.id, [
              ...new Set([...(pressWaitByOrder.get(order.id) ?? []), ...gate.waitingOn]),
            ]);
          }
          spots.push({
            key: `${production.id}:${lane}`,
            stationKey: `lane:${lane}`,
            stationLabel: LANE_LABELS[lane],
            kind: "lane",
            productionId: production.id,
            step: current,
            doneSteps: laneSteps.length - pending.length,
            totalSteps: laneSteps.length,
            waitingOn: gated ? gate.waitingOn : [],
            ready: !gated,
          });
        }

        // PACKAGING เคยอยู่ก่อน QC ในใบเก่า แต่ flow จริงคือผลิต → QC → แพ็กสุดท้าย
        // จึงไม่คืนมันเป็น lane ผลิตอีก หากขั้นจริงครบแล้วให้หัวหน้าเห็นจุดกู้เข้า QC แทน
        if (
          hasPendingLegacyPackaging &&
          steps.every((step) => step.status === "COMPLETED")
        ) {
          spots.push({
            key: `${production.id}:legacy-qc`,
            stationKey: STATION_LEGACY_QC,
            stationLabel: "รอส่งเข้า QC",
            kind: "post",
            productionId: production.id,
            step: null,
            doneSteps: steps.length,
            totalSteps: steps.length,
            waitingOn: ["เปิดใบงานแล้วกดส่งเข้า QC"],
            ready: false,
          });
        }
      }
    }

    const post = POST_SECTIONS.find((s) => s.status === order.internalStatus);
    if (post) {
      spots.push({
        key: `${order.id}:${post.key}`,
        stationKey: post.key,
        stationLabel: post.label,
        kind: "post",
        productionId: null,
        step: null,
        doneSteps: 0,
        totalSteps: 0,
        waitingOn: [],
        ready: true,
      });
    }

    if (queueIds.has(order.id)) {
      const failing = (order.readiness?.checks ?? []).filter((c) => !c.ok);
      const blocked = order.readiness?.ready === false;
      // ช่างไม่เห็นกองติดด่าน — งานที่ลงมือไม่ได้ไม่ควรกินพื้นที่จอหน้างาน
      if (blocked && !showBlocked) continue;
      spots.push({
        key: `${order.id}:queue`,
        stationKey: STATION_QUEUE,
        stationLabel: "รอเปิดใบผลิต",
        kind: "queue",
        productionId: null,
        step: null,
        doneSteps: 0,
        totalSteps: 0,
        waitingOn: blocked
          ? [
              ...new Set(
                failing.map((c) => c.waitingOn || c.label).filter(Boolean) as string[],
              ),
            ]
          : [],
        ready: !blocked,
      });
    }

    if (spots.length === 0) continue;

    jobs.push({
      key: order.id,
      order,
      bucket,
      overdue,
      dueSoon:
        !overdue &&
        (timeOf(order.deadline) ?? Number.MAX_SAFE_INTEGER) - nowMs <= 48 * 60 * 60 * 1000,
      stationKeys: [...new Set(spots.map((s) => s.stationKey))],
      spots,
      rail: buildRail(order, allSteps, pressBlocked),
      searchText: [order.orderNumber, order.customerName ?? ""]
        .join(" ")
        .toLowerCase(),
    });
  }

  // ── แถบสายงาน — เรียงตามทางเดินงานจริง โชว์เฉพาะสายที่มีงาน ──
  const stationOrder: { key: string; label: string; kind: BoardStationKind; isOutsource: boolean }[] =
    [
      { key: STATION_QUEUE, label: "รอเปิดใบผลิต", kind: "queue", isOutsource: false },
      ...LANE_ORDER.map((lane) => ({
        key: `lane:${lane}`,
        label: LANE_LABELS[lane],
        kind: "lane" as const,
        isOutsource: OUTSOURCE_LANES.has(lane),
      })),
      {
        key: STATION_LEGACY_QC,
        label: "รอส่งเข้า QC",
        kind: "post" as const,
        isOutsource: false,
      },
      ...POST_SECTIONS.map((s) => ({
        key: s.key,
        label: s.label,
        kind: "post" as const,
        isOutsource: false,
      })),
    ];

  const stations: BoardStation[] = [];
  for (const station of stationOrder) {
    const matched = jobs.filter((job) => job.stationKeys.includes(station.key));
    if (matched.length === 0) continue;
    stations.push({
      ...station,
      count: matched.length,
      overdue: matched.filter((job) => job.overdue).length,
    });
  }

  // ── ต้องแก้ก่อน — ยุบหลายเหตุผลต่อออเดอร์เป็นแถวเดียว · แดงมาก่อนเหลือง ──
  const exceptionMap = new Map<string, BoardException>();
  const ensure = (order: O, href: string) => {
    let found = exceptionMap.get(order.id);
    if (!found) {
      found = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName ?? null,
        deadline: order.deadline,
        priority: order.priority ?? null,
        reasons: [],
        waitingOn: [],
        href,
        skippable: false,
      };
      exceptionMap.set(order.id, found);
    }
    return found;
  };

  for (const job of jobs) {
    const order = job.order;
    if (order.internalStatus !== "PRODUCING") continue;
    const target = job.spots.find((s) => s.productionId)?.productionId;
    const href = target ? `/production/${encodeURIComponent(target)}` : `/orders/${order.id}`;
    if (job.overdue) ensure(order, href).reasons.push({ label: "เลยกำหนด", tone: "red" });
    if (order.productions.some((p) => p.steps.some((s) => s.status === "FAILED"))) {
      ensure(order, href).reasons.push({ label: "มีปัญหา", tone: "red" });
    }
    const waiting = pressWaitByOrder.get(order.id);
    if (waiting?.length) {
      const item = ensure(order, href);
      item.reasons.push({ label: "รีดร้อนยังไม่พร้อม", tone: "amber" });
      item.waitingOn = [...new Set([...item.waitingOn, ...waiting])];
    }
    if (job.spots.some((spot) => spot.key.endsWith(":legacy-qc"))) {
      const item = ensure(order, href);
      item.reasons.push({ label: "รอส่งเข้า QC", tone: "amber" });
      item.waitingOn = [...new Set([...item.waitingOn, "ข้อมูลแพ็กเดิมต้องปิดผ่านใบงาน"])];
    }
  }

  if (showBlocked) {
    for (const order of blockedQueue) {
      const item = ensure(order, `/orders/${order.id}`);
      item.skippable = true;
      if ((timeOf(order.deadline) ?? Number.MAX_SAFE_INTEGER) < nowMs) {
        item.reasons.push({ label: "เลยกำหนด", tone: "red" });
      }
      const failing = (order.readiness?.checks ?? []).filter((c) => !c.ok);
      for (const check of failing) {
        item.reasons.push({ label: check.label, tone: "amber" });
      }
      // "รอใคร" มาจาก waitingOn เท่านั้น — detail มีตัวเลขเงิน ห้ามขึ้นภาพรวมผลิต
      item.waitingOn = [
        ...new Set([
          ...item.waitingOn,
          ...failing
            .map((c) => c.waitingOn)
            .filter((value): value is string => Boolean(value)),
        ]),
      ];
    }
  }

  const exceptions = [...exceptionMap.values()]
    .filter((e) => e.reasons.length > 0)
    .sort((a, b) => {
      const rank =
        (a.reasons.some((r) => r.tone === "red") ? 0 : 1) -
        (b.reasons.some((r) => r.tone === "red") ? 0 : 1);
      return rank || sortByDue(a, b);
    });

  return {
    jobs,
    stations,
    exceptions,
    myWork,
    totalJobs: jobs.length,
    totalSpots: jobs.reduce((sum, job) => sum + job.spots.length, 0),
  };
}

/** มุมที่ใช้ดูบอร์ด — เรียงอะไรขึ้นก่อน (บอร์ดกรองด้วยคอลัมน์อยู่แล้ว จึงไม่มีตัวกรองซ้อน) */
export type BoardSort = "due" | "urgent" | "newest";

export const BOARD_SORTS: { key: BoardSort; label: string }[] = [
  { key: "due", label: "ใกล้กำหนดส่ง" },
  { key: "urgent", label: "ด่วนก่อน" },
  { key: "newest", label: "เปิดงานล่าสุด" },
];

/** กรองงานตามสายที่โฟกัสและคำค้น — สายที่ไม่มีอยู่จริงถือว่าไม่ได้กรอง (ลิงก์เก่า/มือแก้) */
export function filterBoardJobs<O, S extends BoardStepLike>(
  jobs: readonly BoardJob<O, S>[],
  stations: readonly BoardStation[],
  station: string,
  query: string,
): BoardJob<O, S>[] {
  const validStation = stations.some((s) => s.key === station) ? station : STATION_ALL;
  const needle = query.trim().toLowerCase();
  return jobs.filter((job) => {
    if (validStation && !job.stationKeys.includes(validStation)) return false;
    if (needle && !job.searchText.includes(needle)) return false;
    return true;
  });
}

/** เรียงงานตามมุมที่เลือก — ค่าไม่รู้จักตกกลับ "ใกล้กำหนดส่ง" ซึ่งเป็นค่าเริ่มต้น */
export function sortBoardJobs<
  O extends { deadline: Date | string | null; priority?: string | null; orderNumber: string },
  S extends BoardStepLike,
>(jobs: readonly BoardJob<O, S>[], sort: string): BoardJob<O, S>[] {
  if (sort === "urgent") {
    return [...jobs].sort((a, b) => {
      const rank =
        (PRIORITY_RANK[a.order.priority ?? "NORMAL"] ?? 2) -
        (PRIORITY_RANK[b.order.priority ?? "NORMAL"] ?? 2);
      return rank || sortByDue(a.order, b.order);
    });
  }
  if (sort === "newest") {
    return [...jobs].sort((a, b) => b.order.orderNumber.localeCompare(a.order.orderNumber));
  }
  return [...jobs].sort((a, b) => sortByDue(a.order, b.order));
}

/** การ์ดหนึ่งใบบนบอร์ด = จุดงานหนึ่งจุด พร้อมออเดอร์ต้นทางที่มันสังกัด */
export type BoardColumnCard<O, S extends BoardStepLike> = {
  key: string;
  job: BoardJob<O, S>;
  spot: BoardSpot<S>;
};

export type BoardColumn<O, S extends BoardStepLike> = {
  station: BoardStation;
  cards: BoardColumnCard<O, S>[];
};

/**
 * แตกงานเป็นคอลัมน์ตามสถานี — หัวใจของบอร์ดโรงงาน
 *
 * งานผสมโผล่หลายคอลัมน์ตามจริง (ใบเดียวเดินสองสายพร้อมกันได้) ไม่ใช่ยุบเหลือ
 * คอลัมน์เดียวแล้วโกหกว่าเหลืองานเดียว
 */
export function buildBoardColumns<O, S extends BoardStepLike>(
  jobs: readonly BoardJob<O, S>[],
  stations: readonly BoardStation[],
): BoardColumn<O, S>[] {
  return stations.map((station) => ({
    station,
    // ลำดับการ์ดตามลำดับ jobs ที่ส่งเข้ามา — ผู้ใช้เป็นคนเลือกว่าจะเรียงด้วยอะไร
    cards: jobs.flatMap((job) =>
      job.spots
        .filter((spot) => spot.stationKey === station.key)
        .map((spot) => ({ key: spot.key, job, spot })),
    ),
  }));
}
