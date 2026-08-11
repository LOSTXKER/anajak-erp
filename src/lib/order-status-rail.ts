// ตรรกะของแถบสถานะแบบราง (order-status-bar) ที่คิดได้โดยไม่ต้องมีจอ — แยกออกมาให้เทสได้
//
// โจทย์: ON_HOLD กับ CANCELLED **ไม่ได้อยู่ในเส้นทางงาน** (FLOW_BY_TYPE ไม่มีสองตัวนี้)
// → `flowSteps.indexOf(internalStatus)` = -1 → รางไม่รู้ว่าจะไฮไลต์ตรงไหน
// แต่คำถามแรกของคนเปิดหน้าคือ "แล้วมันค้างอยู่ตรงไหนของสายงาน" ซึ่งตอบได้จริงจาก
// ประวัติ: แถวเปลี่ยนสถานะแถวล่าสุดที่ newValue = สถานะปัจจุบัน → oldValue คือขั้นที่ค้าง
//
// ห้ามเดาจาก customerStatus — มันเป็นการ map แบบหลายต่อหนึ่ง (PRODUCTION_QUEUE/PRODUCING/
// QUALITY_CHECK/PACKING → IN_PRODUCTION เหมือนกันหมด) จะได้ขั้นผิดโดยดูเหมือนถูก

/** แถวประวัติเท่าที่แถบสถานะต้องใช้ — ตรงกับที่ order.getById ส่งมาแล้ว (ไม่ขอ field ใหม่) */
export interface StatusRevisionLike {
  changeType: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: Date | string;
}

export interface OffPathAnchor {
  /** ตำแหน่งใน flowSteps ที่งานค้างอยู่ · -1 = หาไม่เจอ/ขั้นนั้นไม่อยู่ในเส้นทางชนิดงานนี้ */
  index: number;
  /** สถานะดิบของขั้นที่ค้าง (ไว้แปลงเป็นป้ายไทยที่ฝั่ง UI) */
  status: string;
  /** เวลาที่งานหลุดออกจากเส้นทาง */
  at: Date | string;
}

/**
 * หาขั้นที่งานค้างอยู่ ตอนสถานะปัจจุบันอยู่นอกเส้นทาง (พักงาน/ยกเลิก)
 *
 * คืน null เมื่อ: สถานะปัจจุบันอยู่ในเส้นทางอยู่แล้ว · ไม่มีประวัติที่ตรง ·
 * หรือขั้นก่อนหน้าก็อยู่นอกเส้นทางเหมือนกัน (เช่น พักงาน → ยกเลิก — ต่อให้เจอแถว
 * ก็ยังไม่รู้ตำแหน่งบนราง เพราะ ON_HOLD ไม่มีที่ยืนใน flow)
 */
export function findOffPathAnchor(params: {
  internalStatus: string;
  flowSteps: readonly string[];
  revisions: readonly StatusRevisionLike[] | undefined;
}): OffPathAnchor | null {
  const { internalStatus, flowSteps, revisions } = params;
  if (flowSteps.includes(internalStatus)) return null;
  if (!revisions?.length) return null;

  // ไม่พึ่งลำดับที่ caller ส่งมา (getById เรียง desc แต่ที่อื่นอาจไม่) — เรียงเองจากใหม่ไปเก่า
  const statusRows = revisions
    .filter(
      (r) => r.changeType === "STATUS" && r.newValue === internalStatus && !!r.oldValue,
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const latest = statusRows[0];
  if (!latest?.oldValue) return null;

  const index = flowSteps.indexOf(latest.oldValue);
  if (index < 0) return null;

  return { index, status: latest.oldValue, at: latest.createdAt };
}

/** สถานะของขั้นหนึ่งบนราง — ใช้ตัดสินสี/เครื่องหมายที่ฝั่ง UI */
export type RailStepState = "done" | "current" | "todo" | "skipped";

/**
 * สถานะของแต่ละขั้นบนราง
 *
 * anchorIndex = ขั้นที่ไฮไลต์ (ขั้นปัจจุบัน หรือขั้นที่ค้างไว้ตอนพัก/ยกเลิก) · -1 = ไม่มี
 * cancelled = true → ขั้นที่ยังไม่ถึงกลายเป็น "ไม่ได้ทำต่อ" (skipped) ไม่ใช่ "รอทำ"
 */
export function railStepState(params: {
  index: number;
  anchorIndex: number;
  cancelled: boolean;
}): RailStepState {
  const { index, anchorIndex, cancelled } = params;
  if (anchorIndex < 0) return cancelled ? "skipped" : "todo";
  if (index < anchorIndex) return "done";
  if (index === anchorIndex) return "current";
  return cancelled ? "skipped" : "todo";
}
