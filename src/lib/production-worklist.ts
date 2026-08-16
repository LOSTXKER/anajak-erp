import type {
  BoardJob,
  BoardOrderLike,
  BoardStepLike,
  ProductionBoard,
} from "@/lib/production-board";

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

/**
 * ค่า filter ที่ไม่รู้จักตกกลับทั้งหมด และงานที่ต้องจัดการขึ้นก่อนเสมอ
 * ภายในกลุ่มยังรักษาลำดับกำหนดส่งจาก buildProductionBoard/sortBoardJobs
 */
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
  const filtered = jobs.filter((job) => {
    if (selected === "all") return true;
    if (selected === "attention") return needsAttention(job, exceptionOrderIds);
    if (selected === "production") return isProductionStatus(job.order.internalStatus);
    if (selected === "qc") return job.order.internalStatus === "QUALITY_CHECK";
    return isPackingStatus(job.order.internalStatus);
  });

  return [...filtered].sort((a, b) => {
    const attentionRank = Number(!needsAttention(a, exceptionOrderIds)) -
      Number(!needsAttention(b, exceptionOrderIds));
    return attentionRank;
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
