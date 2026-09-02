export type ManufacturingTaskRouteInput = {
  canSupervise: boolean;
  executionEnabled: boolean;
  executionMode: string | null;
  workCenterCode: string | null;
  stepType: string;
  stepId: string;
  productionId: string;
  orderNumber: string;
};

/**
 * ทางเข้างานจาก My Tasks — จอสถานี (/factory/station) ถูกถอดออก 2026-09-02 รอออกแบบใหม่
 * ทุกบทบาทจึงเข้าใบผลิตเดียวกัน ยกเว้นงานร้านนอกที่ไป worklist ใน /production
 * (คง input shape เดิมไว้ ให้จอสถานีใหม่กลับมาต่อได้โดยไม่ต้องแก้ผู้เรียก)
 */
export function manufacturingTaskHref(input: ManufacturingTaskRouteInput): string {
  if (
    !input.canSupervise &&
    input.executionEnabled &&
    (input.executionMode === "OUTSOURCE" || input.workCenterCode === "OUTSOURCE")
  ) {
    const params = new URLSearchParams({
      view: "outsource",
      q: input.orderNumber,
    });
    return `/production?${params.toString()}`;
  }
  return `/production/${input.productionId}`;
}
