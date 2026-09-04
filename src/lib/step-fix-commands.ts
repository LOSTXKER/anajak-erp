/**
 * รายการ "แก้ให้" ของหัวหน้าต่อขั้นงาน — กติกาล้วน ไม่มี UI (ทดสอบได้)
 * ใช้ทั้ง FixDialog (หน้างาน จอทัช) และเมนู "เพิ่มเติม" ในใบผลิต (components/production/step-command-dialogs.tsx)
 *
 * กติกาที่ต้องตรงกับ server (production.updateStep):
 *   ขั้น COMPLETED แก้ย้อนหลังไม่ได้ · ขั้นที่บริการเฉพาะเป็นเจ้าของ (เบิกเสื้อ/ตรวจรับ/พิมพ์ DTF) ไม่รับสถานะทั่วไป
 *   พัก/ผ่านแทน ได้เฉพาะขั้นที่ PENDING/IN_PROGRESS · คืนคิวได้เฉพาะ IN_PROGRESS · reopen ยังไม่มีคำสั่งฝั่ง server
 */

export type FixStepLike = { id: string; stepType: string; status: string; qtyTotal: number | null };

export type FixActions<S extends FixStepLike> = {
  openQty: (stepId: string) => void;
  /** เปิด dialog โหมดหัวหน้า (มอบหมาย/ปลดปัญหา) */
  openManagerEdit: (step: S) => void;
  setStatus: (step: S, status: "ON_HOLD" | "COMPLETED" | "PENDING") => void;
};

export type FixCommand = {
  key: "qty" | "assign" | "hold" | "requeue" | "skip" | "reopen";
  label: string;
  desc: string;
  enabled: boolean;
  /** เหตุที่ทำไม่ได้ — โชว์แทน desc ตอน disabled (ไม่ซ่อนรายการ คนต้องรู้ว่ามีแต่ทำไม่ได้เพราะอะไร) */
  why?: string;
  danger?: boolean;
  run: () => void;
};

/** ขั้นที่บริการเฉพาะเป็นเจ้าของ — เดินผ่านเมนูของตัวเอง ไม่รับ updateStep ทั่วไป */
export const SERVICE_OWNED_STEP_TYPES: ReadonlySet<string> = new Set(["GARMENT_PICK", "GARMENT_RECEIVE", "DTF_PRINT"]);

export function buildFixCommands<S extends FixStepLike>(step: S, actions: FixActions<S>): FixCommand[] {
  const done = step.status === "COMPLETED";
  const stuck = step.status === "FAILED" || step.status === "ON_HOLD";
  const live = step.status === "PENDING" || step.status === "IN_PROGRESS";
  const serviceOwned = SERVICE_OWNED_STEP_TYPES.has(step.stepType);
  return [
    {
      key: "qty",
      label: "แก้ยอดที่บันทึก",
      desc: "นับผิดหรือกดเลขผิด — ใส่ยอดที่ถูกแทน",
      enabled: live && !!step.qtyTotal && !serviceOwned,
      why: done ? "ขั้นปิดแล้ว" : serviceOwned ? "ขั้นนี้แก้ยอดผ่านเมนูเฉพาะ (เบิก/ตรวจรับ/รอบพิมพ์)" : !step.qtyTotal ? "ขั้นนี้ไม่นับตัว" : !live ? "แก้ยอดได้เฉพาะขั้นที่รอ/กำลังทำ" : undefined,
      run: () => actions.openQty(step.id),
    },
    {
      key: "assign",
      label: stuck ? "ปลดปัญหา / เปลี่ยนคนทำ" : "เปลี่ยนคนทำ",
      desc: stuck ? "บอกวิธีที่แก้แล้ว หรือย้ายงานให้คนอื่น" : "ย้ายให้คนอื่น หรือปลดชื่อคนที่กดรับงานผิด",
      enabled: !done,
      why: done ? "ขั้นปิดแล้ว" : undefined,
      run: () => actions.openManagerEdit(step),
    },
    {
      key: "hold",
      label: "พักงานนี้ไว้ก่อน",
      desc: "เอาออกจากคิวชั่วคราว ช่างจะไม่เห็นในคิวพร้อมทำ",
      enabled: live && !serviceOwned,
      why: !live ? "พักได้เฉพาะขั้นที่รอ/กำลังทำ" : serviceOwned ? "ขั้นนี้เดินผ่านเมนูเฉพาะ" : undefined,
      run: () => actions.setStatus(step, "ON_HOLD"),
    },
    {
      key: "requeue",
      label: "คืนกลับคิวพร้อมทำ",
      desc: "ช่างกดเริ่มผิดใบ — เอากลับเป็นรอทำ",
      enabled: step.status === "IN_PROGRESS" && !serviceOwned,
      why: step.status !== "IN_PROGRESS" ? "ใช้กับขั้นที่กำลังทำเท่านั้น" : serviceOwned ? "ขั้นนี้เดินผ่านเมนูเฉพาะ" : undefined,
      run: () => actions.setStatus(step, "PENDING"),
    },
    {
      key: "skip",
      label: "ผ่านขั้นนี้แทนช่าง",
      desc: "ทำแล้วจริงแต่ไม่ได้กดในระบบ — ปิดขั้นให้ในชื่อหัวหน้า",
      enabled: live && !serviceOwned,
      why: !live ? "ผ่านได้เฉพาะขั้นที่รอ/กำลังทำ" : serviceOwned ? "ขั้นนี้ปิดผ่านเมนูเฉพาะเท่านั้น" : undefined,
      danger: true,
      run: () => actions.setStatus(step, "COMPLETED"),
    },
    {
      key: "reopen",
      label: "ย้อนขั้นที่ปิดแล้วกลับ",
      desc: "ช่างกดปิดผิด — เปิดขั้นกลับมาทำต่อ",
      enabled: false,
      why: "ระบบยังไม่รองรับ — ขั้นที่ปิดแล้วแก้ย้อนหลังไม่ได้ (จดไว้ทำเพิ่ม)",
      run: () => undefined,
    },
  ];
}
