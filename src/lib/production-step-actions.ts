import {
  isOutsourceStep,
  laneOf,
  OUTSOURCE_ACTIVE_STATUSES,
} from "@/lib/production-steps";
import { currentProductionProblemReason } from "@/lib/production-problem";

export type ProductionStepUiAction =
  | "send-outsource"
  | "quick-pass"
  | "start"
  | "complete"
  | "details";

export interface ProductionStepActionPolicyInput {
  stepType: string;
  status: string;
  canOutsource: boolean;
  canUpdateStep: boolean;
  ownedByOther: boolean;
  hasActiveOutsource: boolean;
  qcFailedBlocked: boolean;
}

export interface ProductionStepActionPolicy {
  structuralMode: "outsource" | "internal" | "garment-pick";
  primary: ProductionStepUiAction | null;
  canSendOutsource: boolean;
  canQuickPass: boolean;
  canRunInternal: boolean;
}

export function getProductionStepActionPolicy(
  input: ProductionStepActionPolicyInput,
): ProductionStepActionPolicy {
  const legacyPackaging = input.stepType === "PACKAGING";
  const structuralMode = isOutsourceStep(input.stepType)
    ? "outsource"
    : input.stepType === "GARMENT_PICK"
      ? "garment-pick"
      : "internal";
  const unfinished = input.status !== "COMPLETED";
  const available =
    unfinished &&
    !legacyPackaging &&
    !["FAILED", "ON_HOLD"].includes(input.status) &&
    !input.ownedByOther &&
    !input.hasActiveOutsource &&
    !input.qcFailedBlocked;

  const canSendOutsource =
    structuralMode === "outsource" && input.canOutsource && available;
  const canQuickPass =
    structuralMode === "outsource" && input.canUpdateStep && available;
  const canRunInternal =
    structuralMode === "internal" &&
    !["DTF_PRINT", "GARMENT_RECEIVE"].includes(input.stepType) &&
    input.canUpdateStep &&
    available;

  return {
    structuralMode,
    primary: canSendOutsource
      ? "send-outsource"
      : canRunInternal
        ? input.status === "IN_PROGRESS" ? "complete" : "start"
        : null,
    canSendOutsource,
    canQuickPass,
    canRunInternal,
  };
}

export interface LaneOrderStepLite {
  id: string;
  stepType: string;
  status: string;
  sortOrder: number;
}

function compareLaneSteps(left: LaneOrderStepLite, right: LaneOrderStepLite) {
  if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

// UX4.10: "ขั้นแรกที่ยังไม่เสร็จ" ของแต่ละเลน — ปุ่ม primary เน้นเฉพาะขั้นนี้
// ขั้นถัดๆ ไปในเลนเดียวกันถูกลดเป็นปุ่มรอง + ป้าย "รอขั้นก่อนหน้า"
// server กันซ้ำอีกชั้นใน production.updateStep; ชั้นนี้มีไว้บอกเหตุผลก่อนคนกด
export function firstPendingStepIdsByLane(steps: readonly LaneOrderStepLite[]): Set<string> {
  const claimed = new Set<string>(); // เลนที่มีขั้นค้างตัวแรกแล้ว
  const ids = new Set<string>();
  for (const step of [...steps].sort(compareLaneSteps)) {
    // PACKAGING เคยถูกสร้างเป็น production step แต่ flow จริงต้อง QC ก่อนแล้วแพ็กผ่าน
    // Delivery — เก็บแถวเก่าเพื่อ audit/display ได้ แต่ห้ามนับเป็นงานที่กดทำ
    if (step.status === "COMPLETED" || step.stepType === "PACKAGING") continue;
    const lane = laneOf(step.stepType);
    if (claimed.has(lane)) continue;
    claimed.add(lane);
    ids.add(step.id);
  }
  return ids;
}

/* ============================================================
   "ตอนนี้ต้องทำอะไร" ของใบผลิตหนึ่งใบ (ใบงาน PC2 · 2026-08-15)

   หลังบอร์ดผลิตถอดปุ่มลงมือออก หน้าใบผลิตเป็นที่เดียวที่กดทำงานได้ —
   กล่องบนสุดจึงต้องตอบให้ตรงว่าขั้นไหนลงมือได้จริงตอนนี้ และถ้าไม่ได้เพราะอะไร

   งานผสมเดินหลายเลนพร้อมกัน จึงคืนได้หลายขั้น (เลนละไม่เกินหนึ่ง) — ไม่ยุบเหลือ
   ขั้นเดียวแล้วปิดขั้นที่เหลือ เพราะช่างอีกคนอาจกำลังรอขั้นนั้นอยู่
   ============================================================ */

export type NowStepAction =
  | "start"
  | "complete"
  | "record-qty"
  | "send-outsource"
  | "quick-pass";

export interface NowStepInput {
  id: string;
  stepType: string;
  status: string;
  sortOrder: number;
  qtyDone?: number | null;
  qtyTotal?: number | null;
  assignedTo?: { id: string } | null;
  outsourceOrders?: readonly { status: string }[];
  printRunItems?: readonly { printRun: { runNumber: string } }[];
  notes?: string | null;
  qcNotes?: string | null;
}

export interface NowStep<S extends NowStepInput> {
  step: S;
  /** กลุ่มบนใบงาน — current = งานที่พร้อมให้จัดการ, waiting = ยังติดเงื่อนไข/คนอื่น */
  group: "current" | "waiting";
  /** ปุ่มหลักที่กดได้ตอนนี้ — null = ลงมือไม่ได้ ต้องอ่าน waitingOn/note แทน */
  action: NowStepAction | null;
  /** ลงมือไม่ได้เพราะรออะไร (คิวรีดที่ฟิล์ม/เสื้อยังไม่บรรจบ) */
  waitingOn: string[];
  /** เหตุผลอื่นที่กดไม่ได้ เช่น อยู่ในรอบพิมพ์ · มีปัญหา · เป็นงานของคนอื่น */
  note: string | null;
}

export function selectNowSteps<S extends NowStepInput>(
  steps: readonly S[],
  options: {
    canOutsource: boolean;
    canUpdateStep: boolean;
    canSupervise: boolean;
    meId: string | null;
    /** ผลของ evaluateHeatPressGate — ส่งเข้ามาเพื่อให้ไฟล์นี้ไม่ต้องรู้จักกติกาเลน */
    pressGate: { ready: boolean; waitingOn: string[] };
  },
): NowStep<S>[] {
  const laneNext = firstPendingStepIdsByLane(steps);
  return [...steps]
    .filter((step) => laneNext.has(step.id))
    .sort(compareLaneSteps)
    .map((step) => {
      const latestOutsource = step.outsourceOrders?.[0];
      const hasActiveOutsource = (step.outsourceOrders ?? []).some((os) =>
        OUTSOURCE_ACTIVE_STATUSES.includes(os.status),
      );
      const ownedByOther =
        !options.canSupervise && !!step.assignedTo && step.assignedTo.id !== options.meId;
      const qcFailedBlocked =
        latestOutsource?.status === "QC_FAILED" && !options.canSupervise;

      // exception เป็น blocked context ไม่ใช่งานปัจจุบันที่ชวนลงมือ. แสดงเหตุที่ยังเปิด
      // จาก structured trail และให้ outer Station/NowCard ใช้ heading ตรง bucket เดียวกัน.
      if (step.status === "FAILED") {
        return {
          step,
          group: "waiting" as const,
          action: null,
          waitingOn: [],
          note: currentProductionProblemReason(step) || "มีปัญหา — รอหัวหน้าตัดสินใจ",
        };
      }
      if (step.status === "ON_HOLD") {
        return {
          step,
          group: "waiting" as const,
          action: null,
          waitingOn: [],
          note: currentProductionProblemReason(step) || "พักไว้ — รอหัวหน้าตัดสินใจ",
        };
      }

      // ขั้นรีดที่ฟิล์ม/เสื้อยังไม่บรรจบ — ช่างเริ่มไม่ได้จริง บอกว่ารออะไรแทนโชว์ปุ่ม
      if (
        step.stepType === "HEAT_PRESS" &&
        !options.pressGate.ready
      ) {
        return {
          step,
          group: "waiting" as const,
          action: null,
          waitingOn: options.pressGate.waitingOn,
          note: null,
        };
      }

      // อยู่ในรอบพิมพ์ค้าง — server บล็อก updateStep ไว้ ปุ่มกดได้แต่ error
      const printRun = step.printRunItems?.[0]?.printRun;
      if (printRun) {
        return {
          step,
          group: "current" as const,
          action: null,
          waitingOn: [],
          note: `อยู่ในรอบพิมพ์ ${printRun.runNumber}`,
        };
      }

      if (ownedByOther) {
        return {
          step,
          group: "waiting" as const,
          action: null,
          waitingOn: [],
          note: "เป็นงานของคนอื่น",
        };
      }
      if (qcFailedBlocked) {
        return {
          step,
          group: "waiting" as const,
          action: null,
          waitingOn: [],
          note: "QC ร้านไม่ผ่าน — รอหัวหน้าตัดสิน",
        };
      }
      if (hasActiveOutsource) {
        return {
          step,
          group: "waiting" as const,
          action: null,
          waitingOn: [],
          note: "อยู่ที่ร้านนอก",
        };
      }
      // DTF_PRINT เดินด้วยรอบพิมพ์เท่านั้น — ห้ามชวนกดเริ่ม/ปิด generic
      if (step.stepType === "DTF_PRINT") {
        return {
          step,
          group: "current" as const,
          action: null,
          waitingOn: [],
          note: "จัดการผ่านหน้ารอบพิมพ์ฟิล์ม DTF",
        };
      }

      // ขั้นรับเสื้อลูกค้าปิดจากหลักฐานใบตรวจรับเท่านั้น — ห้ามมีปุ่ม generic
      // ที่ข้ามยอดนับจริง/รูป/ตำหนิซึ่ง goods-receipt service ใช้ตัดสินความพร้อม
      if (step.stepType === "GARMENT_RECEIVE") {
        return {
          step,
          group: "current" as const,
          action: null,
          waitingOn: [],
          note: "บันทึกผ่านใบตรวจรับเสื้อลูกค้า",
        };
      }

      const policy = getProductionStepActionPolicy({
        stepType: step.stepType,
        status: step.status,
        canOutsource: options.canOutsource,
        canUpdateStep: options.canUpdateStep,
        ownedByOther,
        hasActiveOutsource,
        qcFailedBlocked,
      });

      if (policy.primary === "send-outsource") {
        return {
          step,
          group: "current" as const,
          action: "send-outsource" as const,
          waitingOn: [],
          note: null,
        };
      }
      if (policy.primary === "start") {
        return {
          step,
          group: "current" as const,
          action: "start" as const,
          waitingOn: [],
          note: null,
        };
      }
      if (policy.primary === "complete") {
        // ขั้นนับจำนวนที่ยังไม่ครบ → เปิดช่องบันทึกจำนวนแทนปิดรวด
        const counting = step.qtyTotal != null && step.qtyTotal > 0;
        const remaining = counting && (step.qtyDone ?? 0) < (step.qtyTotal ?? 0);
        return {
          step,
          group: "current" as const,
          action: remaining ? ("record-qty" as const) : ("complete" as const),
          waitingOn: [],
          note: null,
        };
      }
      // ร้านนอกที่ยังไม่ได้เปิดใบส่ง — ผ่านรวดได้ถ้ามีสิทธิ์ผลิต
      if (policy.canQuickPass) {
        return {
          step,
          group: "current" as const,
          action: "quick-pass" as const,
          waitingOn: [],
          note: null,
        };
      }
      return {
        step,
        group:
          step.stepType === "GARMENT_PICK" && options.canUpdateStep
            ? ("current" as const)
            : ("waiting" as const),
        action: null,
        waitingOn: [],
        note: null,
      };
    });
}
