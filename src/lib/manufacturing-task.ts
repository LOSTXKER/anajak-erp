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
 * ทางเข้างานจาก My Tasks — จอสถานี (/factory/station) และหน้ารายการผลิต (/production
 * รวมคิวร้านนอก) ถูกถอดออก 2026-09-02 รอออกแบบใหม่ · ทุกบทบาท/ทุกขั้นจึงเข้าใบผลิตเดียวกัน
 * (คง input shape เดิมไว้ ให้จอใหม่กลับมาต่อได้โดยไม่ต้องแก้ผู้เรียก)
 */
export function manufacturingTaskHref(input: ManufacturingTaskRouteInput): string {
  return `/production/${input.productionId}`;
}
