import { missingStandards } from "@/lib/work-order-standards";
import type { ProductionStep } from "./types";

/** พิกัดในหน้าให้ปุ่ม "ถัดไป"/"ปิดขั้นนี้" พาไปสิ่งที่ยังขาด — ขั้นคู่มีคนละพิกัด */
export const checklistAnchor = (stepId: string) => `work-order-checklist-${stepId}`;
export const pieceTableAnchor = (stepId: string) => `work-order-pieces-${stepId}`;

export function ticksMissing(step: ProductionStep): number {
  return missingStandards(step.stepType, step.checks.map((check) => check.itemKey)).length;
}
