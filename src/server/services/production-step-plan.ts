import { badRequest, forbidden } from "@/server/errors";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";

// กติกาอัปเดตขั้นตอนผลิต (pure decision — แยกจาก tx writes ใน routers/production.ts
// เพื่อ unit test ได้ไม่ต้อง DB) · caller ต้องถือ lock FOR UPDATE + โหลดข้อมูลใน
// $transaction เองแล้วค่อยเรียก — ฟังก์ชันชุดนี้ตัดสิน/ประกอบผลจากข้อมูลที่โหลดแล้วเท่านั้น
// PERM3: ห้าม import hasPermission ที่นี่ — router เช็คสิทธิ์แล้วส่ง canSupervise เป็น flag
// (pattern เดียวกับ issueGarments ใน garment-pick.ts)

// input ของ updateStep หลังตัด stepId (ตรง zod schema ใน router)
export interface UpdateStepInput {
  status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD" | "FAILED";
  assignedToId?: string;
  actualCost?: number;
  qtyDone?: number;
  qtyTotal?: number | null;
  qcPassed?: boolean;
  qcNotes?: string;
  notes?: string;
}

// คนไม่มีสิทธิ์งานหัวหน้า (default = PRODUCTION_STAFF): ห้ามแตะ assignedToId/actualCost
// (มอบงาน + ต้นทุน = อำนาจหัวหน้า) — ต้องเรียกก่อนโหลด step เสมอ (คงลำดับ FORBIDDEN
// ก่อน NOT_FOUND: staff ส่ง assignedToId บน step ที่ไม่มีจริงต้องได้ FORBIDDEN)
export function assertStaffFields(params: {
  canSupervise: boolean;
  data: Pick<UpdateStepInput, "assignedToId" | "actualCost">;
}): void {
  if (!params.canSupervise) {
    if (params.data.assignedToId !== undefined || params.data.actualCost !== undefined) {
      forbidden("ฝ่ายผลิตแก้ผู้รับผิดชอบ/ต้นทุนจริงไม่ได้");
    }
  }
}

// step ที่ยังไม่มีเจ้าของ → claim อัตโนมัติ (ระบบยังไม่มี UI มอบหมายงาน ถ้าบังคับ assign
// ก่อน staff จะอัปเดตอะไรไม่ได้เลย) · step ของคนอื่น → ห้าม
// router เรียกเฉพาะเมื่อ !canSupervise (คนมีสิทธิ์หัวหน้าไม่ต้องโหลด/ไม่ต้องเช็ค)
export function planAutoClaim(params: {
  existingAssignedToId: string | null;
  userId: string;
}): { autoClaim: boolean } {
  if (params.existingAssignedToId === null) {
    return { autoClaim: true };
  }
  if (params.existingAssignedToId !== params.userId) {
    forbidden("งานนี้ถูกมอบหมายให้คนอื่นแล้ว");
  }
  return { autoClaim: false };
}

// input แตะ field ที่ต้องกันชนกับรอบพิมพ์ไหม (status/จำนวน) — qtyDone:0 และ
// qtyTotal:null นับว่าแตะ (zod nullable ส่ง null ได้จงใจ) · router ใช้ตัดสินว่าต้อง
// lock FOR UPDATE + query รอบพิมพ์ค้างหรือไม่
export function touchesRunGuardedFields(data: UpdateStepInput): boolean {
  return (
    data.status !== undefined ||
    data.qtyDone !== undefined ||
    data.qtyTotal !== undefined
  );
}

// ขั้นที่อยู่ในรอบพิมพ์ค้าง (PRINTING/PRINTED): สถานะ/จำนวนเดินผ่านรอบเท่านั้น —
// จุดตัดแยกฟิล์มเป็นด่านบังคับ ปิดมือ = ข้ามด่าน + จำนวนถูกนับซ้อนตอนรอบปิด
// contract = "มีแถวรอบค้าง" (row existence) ตรงโค้ดเดิม — ไม่ผูกกับค่า field
// (review จับ: รับ string|null จะเงียบถ้าวันหน้า runNumber เปลี่ยนเป็น nullable)
export function assertNotInActiveRun(activeRun: { runNumber: string } | null): void {
  if (activeRun) {
    badRequest(
      `งานอยู่ในรอบพิมพ์ ${activeRun.runNumber} — จัดการที่หน้ารอบพิมพ์ฟิล์ม (พิมพ์จบ/ตัดแยกเสร็จ หรือยกเลิกรอบ)`
    );
  }
}

// ปิดขั้น (รวมปุ่ม "ผ่านรวด" งานร้านนอก) ห้ามทับงานที่ยังค้างอยู่กับร้าน —
// ใบ outsource ที่ยังไม่ตัดสิน QC ต้องเดินจบทางใบ outsource เท่านั้น
// ลำดับด่านคงเดิม: ① ใบค้าง (ทุกใบ ไม่ใช่แค่ใบล่าสุด — แบ่งส่งหลายรอบได้)
// ② QC_FAILED ใบล่าสุด: ช่างห้ามกดผ่านรวดทับ — หัวหน้า (canSupervise) ปิดทับได้
export function assertStepClosable(params: {
  openOutsourceCount: number;
  latestOutsourceStatus: string | null;
  canSupervise: boolean;
}): void {
  if (params.openOutsourceCount > 0) {
    badRequest(
      `ขั้นนี้มีงานค้างอยู่กับร้านนอก ${params.openOutsourceCount} ใบ — กดรับกลับ/ตัดสิน QC ที่ใบ outsource ก่อน`
    );
  }
  // งานที่หัวหน้าตัดสิน QC ไม่ผ่านไปแล้ว ช่างห้ามกดผ่านรวดทับ — ต้องส่งแก้
  // รอบใหม่หรือให้หัวหน้าเป็นคนปิด
  if (params.latestOutsourceStatus === "QC_FAILED" && !params.canSupervise) {
    forbidden("งานนี้ QC ไม่ผ่านจากร้าน — ส่งแก้รอบใหม่ หรือให้หัวหน้าเป็นคนปิดขั้น");
  }
}

// ประกอบ data ก้อนแรกของ productionStep.update — timestamps quirk คงเดิมเป๊ะ:
// startedAt set เฉพาะ IN_PROGRESS ที่ input "ไม่มี" assignedToId (falsy check —
// หัวหน้ามอบงานพร้อมสั่งเริ่มจะไม่แตะ startedAt) · COMPLETED → completedAt เสมอ
export function buildStepUpdateData(params: {
  data: UpdateStepInput;
  autoClaim: boolean;
  userId: string;
  now: Date;
}): Record<string, unknown> {
  const { data, autoClaim, userId, now } = params;
  const updateData: Record<string, unknown> = { ...data };
  if (autoClaim) {
    updateData.assignedToId = userId;
  }
  if (data.status === "IN_PROGRESS" && !data.assignedToId) {
    updateData.startedAt = now;
  }
  if (data.status === "COMPLETED") {
    updateData.completedAt = now;
  }
  return updateData;
}

// กติกา qty หลัง update ก้อนแรก: ปิดขั้น → จำนวนทำแล้ว snap เท่าทั้งหมด (ติ๊กเสร็จ =
// ครบ ไม่ต้องกรอกเลขซ้ำ · qtyTotal 0/null = ขั้นแบบติ๊กเฉยๆ ไม่ snap — truthy check)
// · กรอกจำนวนบนขั้นที่ยังรอ → ขั้นเริ่มเอง (กันสถานะค้าง PENDING ทั้งที่ทำไปแล้วครึ่งกอง)
// คืน data สำหรับ update ครั้งที่สอง — null = ไม่ต้องยิง
export function qtyFollowUp(
  step: { status: string; qtyDone: number; qtyTotal: number | null; startedAt: Date | null },
  now: Date
): { qtyDone: number } | { status: "IN_PROGRESS"; startedAt: Date } | null {
  if (step.status === "COMPLETED" && step.qtyTotal && step.qtyDone < step.qtyTotal) {
    return { qtyDone: step.qtyTotal };
  }
  if (step.status === "PENDING" && step.qtyDone > 0) {
    return { status: "IN_PROGRESS", startedAt: step.startedAt ?? now };
  }
  return null;
}

// ชื่อขั้นที่คนอ่านรู้เรื่อง — ใช้ซ้ำทั้ง costEntry และกระดิ่ง FAILED
export function stepDisplayName(step: {
  customStepName: string | null;
  stepType: string;
}): string {
  return step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
}

// ต้นทุนจริงต่อขั้นตอน → แผน upsert costEntry (sourceRef กันเบิ้ลแถว) — เฉพาะตัวเลขจริง
// ไม่สร้างแถว 0 บาท (UI ถอดช่องนี้แล้วตามมติเลิกคิดต้นทุนต่องาน 2026-06-12 — เก็บ path
// ไว้รับ caller ตรงเท่านั้น) · lockOrderRow/upsert/recalcOrderCost คงใน router
export function stepCostEntryPlan(params: {
  actualCost: number | undefined;
  stepId: string;
  customStepName: string | null;
  stepType: string;
}): { sourceRef: string; name: string; amount: number } | null {
  if (params.actualCost === undefined || params.actualCost <= 0) {
    return null;
  }
  const stepName = stepDisplayName(params);
  return {
    sourceRef: `step:${params.stepId}`,
    name: `ต้นทุนขั้นตอน: ${stepName}`,
    amount: params.actualCost,
  };
}

// step มีปัญหา = ต้องมีคนมาดูด่วน — เนื้อกระดิ่งหาผู้จัดการ (audit ข้อ 20)
// router คง query managers (OWNER/MANAGER active ยกเว้นตัวเอง) + loop createNotification
export function failedStepNotification(params: {
  orderNumber: string;
  orderTitle: string;
  stepName: string;
  notes?: string;
  productionId: string;
  orderId: string;
}): {
  type: "ORDER";
  title: string;
  message: string;
  link: string;
  entityType: "ORDER";
  entityId: string;
} {
  return {
    type: "ORDER",
    title: `ขั้นตอนผลิตมีปัญหา — ${params.orderNumber}`,
    message: `${params.stepName}${params.notes ? `: ${params.notes}` : ""} (${params.orderTitle})`,
    // ชี้หน้าใบผลิตตรงๆ — ตัวจัดการขั้นตอนอยู่ที่นั่นแล้ว (แยกโมดูลผลิต 2026-06-12)
    link: `/production/${params.productionId}`,
    entityType: "ORDER",
    entityId: params.orderId,
  };
}
