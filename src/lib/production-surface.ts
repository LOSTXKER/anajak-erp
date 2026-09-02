/**
 * โมดูลผลิต "หนึ่งโมดูล สองสายตา" (เบสเคาะ 2026-09-03 — แบ่งตามบทบาท ไม่ใช่สถานที่)
 *   หัวหน้า/เบส → โต๊ะงาน `/production` + ใบผลิต `/production/[id]` (ทำได้ครบในหน้าเดียว)
 *   ช่าง        → โหมดหน้างาน `/production/floor` (คิวสถานีของฉัน → หน้าลงมือ ปุ่มใหญ่ ไม่มีเงิน)
 * ไฟล์นี้ตอบคำถามเดียว: บัญชีนี้ควรเห็นสายตาไหน — ใช้ทั้ง server component (redirect) และ client
 */

import type { Role } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

export const FLOOR_HREF = "/production/floor";

/** ช่างหน้างาน = บทบาทช่างผลิตที่มีสิทธิ์งานผลิตแต่ไม่มีสิทธิ์หัวหน้า (override รายคนนับด้วย) */
export function isFloorWorker(role: Role, permissionOverrides: unknown): boolean {
  return role === "PRODUCTION_STAFF" && hasPermission(role, permissionOverrides, "manage_production") && !hasPermission(role, permissionOverrides, "supervise_operations");
}

/** ลิงก์เปิดหน้าลงมือของใบ/ขั้นในโหมดหน้างาน — หน้างานหาสถานีให้เองจากคิว จึงไม่ต้องส่ง st */
export function floorJobHref(productionId: string, stepId?: string | null, opts: { fix?: boolean } = {}): string {
  const q = new URLSearchParams({ s: "job", job: productionId });
  if (stepId) q.set("step", stepId);
  if (opts.fix) q.set("fix", "1");
  return `${FLOOR_HREF}?${q.toString()}`;
}
