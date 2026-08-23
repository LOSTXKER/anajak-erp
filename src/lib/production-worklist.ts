import type {
  BoardException,
  BoardJob,
  BoardOrderLike,
  BoardRailPoint,
  BoardStepLike,
  ProductionBoard,
} from "@/lib/production-board";
import { sortBoardJobs } from "@/lib/production-board";
import { currentProductionProblemReason } from "@/lib/production-problem";

/* ============================================================
   รายการควบคุมการผลิต — มุมหัวหน้าผลิต

   หน่วยของตารางคือ "ออเดอร์" ไม่ใช่ขั้นงาน จึงไม่ทำให้งานผสมซ้ำหลายแถว
   แต่ยังเก็บทุกจุดงานไว้ในแถวเดียวเพื่อไม่ซ่อนงานที่เดินพร้อมกันหลายสาย
   ============================================================ */

export const PRODUCTION_WORKLIST_LENSES = [
  { key: "all", label: "ทั้งหมด" },
  { key: "attention", label: "ต้องจัดการ" },
  { key: "production", label: "กำลังผลิต" },
  { key: "qc", label: "รอ QC" },
  { key: "packing", label: "แพ็ก / พร้อมส่ง" },
] as const;

export type ProductionWorklistLens =
  (typeof PRODUCTION_WORKLIST_LENSES)[number]["key"];

export type ProductionWorklistCounts = Record<ProductionWorklistLens, number>;

export type ProductionWorklistSortDirection = "asc" | "desc";
export type ProductionWorklistSortColumn =
  | "orderNumber"
  | "progress"
  | "totalQuantity"
  | "deadline";
export type ProductionWorklistColumnSort =
  `${ProductionWorklistSortColumn}:${ProductionWorklistSortDirection}`;
export type ProductionWorklistSort =
  | "attention"
  | "urgent"
  | ProductionWorklistColumnSort;

export const DEFAULT_PRODUCTION_WORKLIST_SORT: ProductionWorklistSort = "attention";

export const PRODUCTION_WORKLIST_SORT_COLUMNS = {
  orderNumber: {
    asc: "orderNumber:asc",
    desc: "orderNumber:desc",
    defaultDirection: "desc",
  },
  progress: {
    asc: "progress:asc",
    desc: "progress:desc",
    defaultDirection: "asc",
  },
  totalQuantity: {
    asc: "totalQuantity:asc",
    desc: "totalQuantity:desc",
    defaultDirection: "desc",
  },
  deadline: {
    asc: "deadline:asc",
    desc: "deadline:desc",
    defaultDirection: "asc",
  },
} as const satisfies Record<
  ProductionWorklistSortColumn,
  {
    asc: ProductionWorklistColumnSort;
    desc: ProductionWorklistColumnSort;
    defaultDirection: ProductionWorklistSortDirection;
  }
>;

export const PRODUCTION_WORKLIST_SORT_OPTIONS = [
  { value: "attention", label: "ต้องจัดการก่อน" },
  { value: "urgent", label: "ด่วนก่อน" },
  { value: "deadline:asc", label: "กำหนดส่ง (ใกล้สุด)" },
  { value: "deadline:desc", label: "กำหนดส่ง (ไกลสุด)" },
  { value: "orderNumber:desc", label: "เลขออเดอร์ (ล่าสุด)" },
  { value: "orderNumber:asc", label: "เลขออเดอร์ (เก่าสุด)" },
  { value: "progress:asc", label: "ความคืบหน้า (น้อยสุด)" },
  { value: "progress:desc", label: "ความคืบหน้า (มากสุด)" },
  { value: "totalQuantity:desc", label: "จำนวน (มากสุด)" },
  { value: "totalQuantity:asc", label: "จำนวน (น้อยสุด)" },
] as const satisfies readonly {
  value: ProductionWorklistSort;
  label: string;
}[];

const LEGACY_PRODUCTION_WORKLIST_SORTS: Record<string, ProductionWorklistSort> = {
  due: DEFAULT_PRODUCTION_WORKLIST_SORT,
  newest: "orderNumber:desc",
};

export function resolveProductionWorklistSort(
  rawSort: string | null | undefined,
): ProductionWorklistSort {
  const requested = rawSort
    ? (LEGACY_PRODUCTION_WORKLIST_SORTS[rawSort] ?? rawSort)
    : DEFAULT_PRODUCTION_WORKLIST_SORT;
  return PRODUCTION_WORKLIST_SORT_OPTIONS.some(
    (option) => option.value === requested,
  )
    ? (requested as ProductionWorklistSort)
    : DEFAULT_PRODUCTION_WORKLIST_SORT;
}

export function productionWorklistProgress(
  rail: readonly BoardRailPoint[],
): { completed: number; total: number; percent: number } {
  const relevant = rail.filter((point) => point.state !== "na");
  const completed = relevant.filter((point) => point.state === "done").length;
  const total = relevant.length;
  return {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export type ProductionWorklistAction = {
  reason: string;
  owner: string;
  attention: boolean;
  tone: "red" | "amber" | "neutral";
};

function uniqueText(values: readonly (string | null | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

/**
 * คำตอบสั้นสำหรับหัวหน้า: แถวนี้ต้องทำอะไร และใครเป็นเจ้าของการส่งต่อถัดไป
 * เป็น presentation จาก board truth เท่านั้น ไม่สร้างสถานะหรืออนุมาน mutation ใหม่
 */
export function productionWorklistAction<
  S extends BoardStepLike,
  O extends BoardOrderLike<S>,
>(job: BoardJob<O, S>, exception?: BoardException): ProductionWorklistAction {
  const failedSpot = job.spots.find((spot) => spot.step?.status === "FAILED");
  const failureReason = failedSpot?.step
    ? currentProductionProblemReason(failedSpot.step)
    : null;
  const waits = uniqueText([
    ...(exception?.waitingOn ?? []),
    ...job.spots.flatMap((spot) => spot.waitingOn),
  ]);
  const assignedNames = uniqueText(
    job.spots.map((spot) => spot.step?.assignedTo?.name),
  );
  const firstSpecificReason = exception?.reasons.find(
    (reason) => reason.label !== "เลยกำหนด" && reason.label !== "มีปัญหา",
  );

  let owner: string;
  if (assignedNames.length > 0) {
    owner = assignedNames.length === 1
      ? assignedNames[0]!
      : `${assignedNames[0]} +${assignedNames.length - 1}`;
  } else if (job.order.internalStatus === "READY_TO_SHIP") {
    owner = "ฝ่ายจัดส่ง";
  } else if (job.order.internalStatus === "PACKING") {
    owner = "ฝ่ายแพ็ก";
  } else if (job.order.internalStatus === "QUALITY_CHECK") {
    owner = "QC";
  } else if (job.spots.some((spot) => spot.kind === "queue")) {
    owner = "หัวหน้าผลิต";
  } else {
    owner = failedSpot?.stationLabel ?? job.spots[0]?.stationLabel ?? "หัวหน้าผลิต";
  }

  const attention = Boolean(
    exception ||
      job.overdue ||
      failedSpot ||
      waits.length > 0,
  );

  if (waits.length > 0) {
    return {
      reason: waits[0]!.startsWith("รอ") ? waits[0]! : `รอ ${waits[0]}`,
      owner,
      attention,
      tone: job.overdue || failedSpot ? "red" : "amber",
    };
  }

  if (firstSpecificReason) {
    return {
      reason: firstSpecificReason.label,
      owner,
      attention,
      tone: firstSpecificReason.tone,
    };
  }

  if (failedSpot) {
    return {
      reason: failureReason ?? `แก้ปัญหาที่ ${failedSpot.stationLabel}`,
      owner,
      attention,
      tone: "red",
    };
  }

  if (job.overdue) {
    const reason = job.order.internalStatus === "READY_TO_SHIP"
      ? "ส่งงานที่เลยกำหนด"
      : job.order.internalStatus === "PACKING"
        ? "เร่งแพ็กงานที่เลยกำหนด"
        : job.order.internalStatus === "QUALITY_CHECK"
          ? "ตรวจงานที่เลยกำหนด"
          : "เร่งงานที่เลยกำหนด";
    return { reason, owner, attention, tone: "red" };
  }

  if (job.spots.some((spot) => spot.kind === "queue")) {
    return { reason: "เปิดใบผลิต", owner, attention, tone: "neutral" };
  }
  if (job.order.internalStatus === "READY_TO_SHIP") {
    return { reason: "ส่งมอบให้ลูกค้า", owner, attention, tone: "neutral" };
  }
  if (job.order.internalStatus === "PACKING") {
    return { reason: "แพ็กและเตรียมส่ง", owner, attention, tone: "neutral" };
  }
  if (job.order.internalStatus === "QUALITY_CHECK") {
    return { reason: "ตรวจคุณภาพ", owner, attention, tone: "neutral" };
  }

  return {
    reason: `ทำต่อที่ ${job.spots[0]?.stationLabel ?? "สายการผลิต"}`,
    owner,
    attention,
    tone: "neutral",
  };
}

function isProductionStatus(status: string) {
  return ["CONFIRMED", "DESIGN_APPROVED", "PRODUCTION_QUEUE", "PRODUCING"].includes(
    status,
  );
}

function isPackingStatus(status: string) {
  return ["PACKING", "READY_TO_SHIP"].includes(status);
}

function needsAttention<S extends BoardStepLike, O extends BoardOrderLike<S>>(
  job: BoardJob<O, S>,
  exceptionOrderIds: ReadonlySet<string>,
) {
  return (
    exceptionOrderIds.has(job.order.id) ||
    job.overdue ||
    job.spots.some(
      (spot) =>
        spot.waitingOn.length > 0 ||
        spot.step?.status === "FAILED",
    )
  );
}

export function isProductionWorklistLens(value: string): value is ProductionWorklistLens {
  return PRODUCTION_WORKLIST_LENSES.some((lens) => lens.key === value);
}

export function productionWorklistCounts<
  S extends BoardStepLike,
  O extends BoardOrderLike<S>,
>(board: ProductionBoard<O, S>): ProductionWorklistCounts {
  const exceptionOrderIds = new Set(board.exceptions.map((item) => item.orderId));
  return {
    all: board.jobs.length,
    attention: board.jobs.filter((job) => needsAttention(job, exceptionOrderIds)).length,
    production: board.jobs.filter((job) => isProductionStatus(job.order.internalStatus)).length,
    qc: board.jobs.filter((job) => job.order.internalStatus === "QUALITY_CHECK").length,
    packing: board.jobs.filter((job) => isPackingStatus(job.order.internalStatus)).length,
  };
}

/** ค่า filter ที่ไม่รู้จักตกกลับทั้งหมด และรักษาลำดับขาเข้าให้ sort contract จัดการ */
export function filterProductionWorklist<
  S extends BoardStepLike,
  O extends BoardOrderLike<S>,
>(
  board: ProductionBoard<O, S>,
  jobs: readonly BoardJob<O, S>[],
  lens: string,
): BoardJob<O, S>[] {
  const selected: ProductionWorklistLens = isProductionWorklistLens(lens) ? lens : "all";
  const exceptionOrderIds = new Set(board.exceptions.map((item) => item.orderId));
  return jobs.filter((job) => {
    if (selected === "all") return true;
    if (selected === "attention") return needsAttention(job, exceptionOrderIds);
    if (selected === "production") return isProductionStatus(job.order.internalStatus);
    if (selected === "qc") return job.order.internalStatus === "QUALITY_CHECK";
    return isPackingStatus(job.order.internalStatus);
  });
}

function timeOf(value: Date | string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function compareDeadline<
  S extends BoardStepLike,
  O extends BoardOrderLike<S>,
>(
  a: BoardJob<O, S>,
  b: BoardJob<O, S>,
  direction: ProductionWorklistSortDirection,
): number {
  const aTime = timeOf(a.order.deadline);
  const bTime = timeOf(b.order.deadline);
  if (aTime == null && bTime == null) return 0;
  if (aTime == null) return 1;
  if (bTime == null) return -1;
  return direction === "asc" ? aTime - bTime : bTime - aTime;
}

function compareOrderNumber<
  S extends BoardStepLike,
  O extends BoardOrderLike<S>,
>(
  a: BoardJob<O, S>,
  b: BoardJob<O, S>,
  direction: ProductionWorklistSortDirection,
): number {
  const result = a.order.orderNumber.localeCompare(b.order.orderNumber, "th", {
    numeric: true,
  });
  return direction === "asc" ? result : -result;
}

/**
 * ค่าเริ่มต้นเป็น operational priority (attention → due) และไม่ผูกกับหัวคอลัมน์ใด
 * เมื่อผู้ใช้เลือกคอลัมน์ ต้องเรียงทั้งตารางตามค่านั้นจริงโดยไม่ pin attention ซ้ำ
 */
export function sortProductionWorklist<
  S extends BoardStepLike,
  O extends BoardOrderLike<S>,
>(
  board: ProductionBoard<O, S>,
  jobs: readonly BoardJob<O, S>[],
  rawSort: string | null | undefined,
): BoardJob<O, S>[] {
  const sort = resolveProductionWorklistSort(rawSort);
  if (sort === "urgent") return sortBoardJobs(jobs, "urgent");

  const exceptionOrderIds = new Set(board.exceptions.map((item) => item.orderId));
  if (sort === DEFAULT_PRODUCTION_WORKLIST_SORT) {
    // คงลำดับ operational เดิม: due → priority ก่อน แล้ว stable-pin งานที่ต้องจัดการ
    // จึงไม่ทำให้งาน URGENT ที่ส่งวันเดียวกันถอยหลังเพราะเลขออเดอร์
    return sortBoardJobs(jobs, "due").sort((a, b) => {
      const attentionRank = Number(!needsAttention(a, exceptionOrderIds)) -
        Number(!needsAttention(b, exceptionOrderIds));
      return attentionRank;
    });
  }

  const [column, direction] = sort.split(":") as [
    ProductionWorklistSortColumn,
    ProductionWorklistSortDirection,
  ];
  return [...jobs].sort((a, b) => {
    let result = 0;
    if (column === "deadline") {
      result = compareDeadline(a, b, direction);
    } else if (column === "orderNumber") {
      result = compareOrderNumber(a, b, direction);
    } else if (column === "progress") {
      const aProgress = productionWorklistProgress(a.rail).percent;
      const bProgress = productionWorklistProgress(b.rail).percent;
      result = direction === "asc"
        ? aProgress - bProgress
        : bProgress - aProgress;
    } else {
      const aQuantity = a.order.totalQuantity ?? 0;
      const bQuantity = b.order.totalQuantity ?? 0;
      result = direction === "asc"
        ? aQuantity - bQuantity
        : bQuantity - aQuantity;
    }

    return (
      result ||
      compareDeadline(a, b, "asc") ||
      compareOrderNumber(a, b, "desc")
    );
  });
}

/** ไปยังจอที่ลงมือได้จริง โดยแถวคิวเปิดใบผลิตผ่าน deep-link เดิม */
export function productionWorklistHref<
  S extends BoardStepLike,
  O extends BoardOrderLike<S>,
>(job: BoardJob<O, S>, canCreateProduction: boolean): string {
  if (job.spots.some((spot) => spot.kind === "queue")) {
    return canCreateProduction
      ? `/production?create=${encodeURIComponent(job.order.id)}`
      : `/orders/${encodeURIComponent(job.order.id)}?tab=production`;
  }

  if (job.order.internalStatus === "PACKING" || job.order.internalStatus === "READY_TO_SHIP") {
    return `/orders/${encodeURIComponent(job.order.id)}?tab=delivery`;
  }

  if (job.order.internalStatus === "QUALITY_CHECK") {
    return `/orders/${encodeURIComponent(job.order.id)}?tab=production`;
  }

  const productionIds = [
    ...new Set(
      job.spots
        .map((spot) => spot.productionId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (productionIds.length === 1) {
    return `/production/${encodeURIComponent(productionIds[0]!)}`;
  }

  return `/orders/${encodeURIComponent(job.order.id)}?tab=production`;
}
