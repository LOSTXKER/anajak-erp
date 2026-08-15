import { isOutsourceStep, laneOf } from "@/lib/production-steps";

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
  const structuralMode = isOutsourceStep(input.stepType)
    ? "outsource"
    : input.stepType === "GARMENT_PICK"
      ? "garment-pick"
      : "internal";
  const unfinished = input.status !== "COMPLETED";
  const available =
    unfinished &&
    !input.ownedByOther &&
    !input.hasActiveOutsource &&
    !input.qcFailedBlocked;

  const canSendOutsource =
    structuralMode === "outsource" && input.canOutsource && available;
  const canQuickPass =
    structuralMode === "outsource" && input.canUpdateStep && available;
  const canRunInternal =
    structuralMode === "internal" &&
    input.canUpdateStep &&
    available &&
    input.status !== "FAILED";

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

// UX4.10: "ขั้นแรกที่ยังไม่เสร็จ" ของแต่ละเลน — ปุ่ม primary เน้นเฉพาะขั้นนี้
// ขั้นถัดๆ ไปในเลนเดียวกันถูกลดเป็นปุ่มรอง + ป้าย "รอขั้นก่อนหน้า"
// (server ไม่กันการเริ่มข้ามลำดับ — จอเป็นด่านเดียว กันงาน IN_PROGRESS ผีข้ามขั้น)
export function firstPendingStepIdsByLane(steps: readonly LaneOrderStepLite[]): Set<string> {
  const claimed = new Set<string>(); // เลนที่มีขั้นค้างตัวแรกแล้ว
  const ids = new Set<string>();
  for (const step of [...steps].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (step.status === "COMPLETED") continue;
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
}

export interface NowStep<S extends NowStepInput> {
  step: S;
  /** ปุ่มหลักที่กดได้ตอนนี้ — null = ลงมือไม่ได้ ต้องอ่าน waitingOn/note แทน */
  action: NowStepAction | null;
  /** ลงมือไม่ได้เพราะรออะไร (คิวรีดที่ฟิล์ม/เสื้อยังไม่บรรจบ) */
  waitingOn: string[];
  /** เหตุผลอื่นที่กดไม่ได้ เช่น อยู่ในรอบพิมพ์ · มีปัญหา · เป็นงานของคนอื่น */
  note: string | null;
}

const OUTSOURCE_ACTIVE_FOR_NOW = ["DRAFT", "SENT", "RECEIVED_BACK"];

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
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((step) => {
      const latestOutsource = step.outsourceOrders?.[0];
      const hasActiveOutsource = (step.outsourceOrders ?? []).some((os) =>
        OUTSOURCE_ACTIVE_FOR_NOW.includes(os.status),
      );
      const ownedByOther =
        !options.canSupervise && !!step.assignedTo && step.assignedTo.id !== options.meId;
      const qcFailedBlocked =
        latestOutsource?.status === "QC_FAILED" && !options.canSupervise;

      // ขั้นรีดที่ฟิล์ม/เสื้อยังไม่บรรจบ — ช่างเริ่มไม่ได้จริง บอกว่ารออะไรแทนโชว์ปุ่ม
      if (
        step.stepType === "HEAT_PRESS" &&
        !options.pressGate.ready &&
        step.status !== "FAILED"
      ) {
        return { step, action: null, waitingOn: options.pressGate.waitingOn, note: null };
      }

      // อยู่ในรอบพิมพ์ค้าง — server บล็อก updateStep ไว้ ปุ่มกดได้แต่ error
      const printRun = step.printRunItems?.[0]?.printRun;
      if (printRun) {
        return {
          step,
          action: null,
          waitingOn: [],
          note: `อยู่ในรอบพิมพ์ ${printRun.runNumber}`,
        };
      }

      if (step.status === "FAILED") {
        return { step, action: null, waitingOn: [], note: "มีปัญหา — เปิดดูรายละเอียด" };
      }
      if (ownedByOther) {
        return { step, action: null, waitingOn: [], note: "เป็นงานของคนอื่น" };
      }
      if (qcFailedBlocked) {
        return { step, action: null, waitingOn: [], note: "QC ร้านไม่ผ่าน — รอหัวหน้าตัดสิน" };
      }
      if (hasActiveOutsource) {
        return { step, action: null, waitingOn: [], note: "อยู่ที่ร้านนอก" };
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
        return { step, action: "send-outsource" as const, waitingOn: [], note: null };
      }
      if (policy.primary === "start") {
        return { step, action: "start" as const, waitingOn: [], note: null };
      }
      if (policy.primary === "complete") {
        // ขั้นนับจำนวนที่ยังไม่ครบ → เปิดช่องบันทึกจำนวนแทนปิดรวด
        const counting = step.qtyTotal != null && step.qtyTotal > 0;
        const remaining = counting && (step.qtyDone ?? 0) < (step.qtyTotal ?? 0);
        return {
          step,
          action: remaining ? ("record-qty" as const) : ("complete" as const),
          waitingOn: [],
          note: null,
        };
      }
      // ร้านนอกที่ยังไม่ได้เปิดใบส่ง — ผ่านรวดได้ถ้ามีสิทธิ์ผลิต
      if (policy.canQuickPass) {
        return { step, action: "quick-pass" as const, waitingOn: [], note: null };
      }
      return { step, action: null, waitingOn: [], note: null };
    });
}
