"use client";

import { CurrentE } from "../work-order-lean/_variants";
import { CASES, CASE_VALUES, type Case } from "../work-order-desk/_preview";
import { orderFor, type LeanOrder } from "../work-order-lean/_data";
import { Workspace } from "./_workspace";

export { CASES, CASE_VALUES, type Case };
export const OPTIONS = [
  { value: "now", label: "ปัจจุบัน" },
  { value: "record", label: "A · ภาพรวมใบผลิต" },
  { value: "desk", label: "B · โต๊ะงาน" },
] as const;
export const VALUES = OPTIONS.map((option) => option.value);
export type Variant = typeof OPTIONS[number]["value"];
function getOrder(scenario: Case): LeanOrder {
  if (scenario === "empty") return { ...orderFor(false), orderNumber: "ORD-2609-0010", priority: null, dueInDays: 5, dueLabel: "12 ก.ย. 2569", routing: "ยังไม่กำหนดสูตร", steps: [], mockupVersion: null, mockups: [], items: orderFor(false).items.map((item) => ({ ...item, mockup: null })) };
  return orderFor(scenario === "parallel");
}
export const COPY: Record<Variant, { idea: string; tradeoff: string }> = {
  now: { idea: "แผนที่ขั้นงานและข้อมูลหลายส่วนอยู่พร้อมกัน", tradeoff: "ต้องไล่อ่านหลายจุดเพื่อหาว่าควรทำอะไรต่อ" },
  record: { idea: "เปิดมาเห็นเรื่องที่ต้องจัดการก่อน รายละเอียดอยู่ในแท็บที่ชื่อชัดเจน", tradeoff: "ต้องเลือกขั้นงานก่อนเปิดรายละเอียด แต่หน้าแรกอ่านจบได้เร็ว" },
  desk: { idea: "เลือกงานจากรายการด้านซ้าย แล้วจัดการในพื้นที่ด้านขวา", tradeoff: "สลับหลายงานบนคอมได้เร็ว มือถือกลับไปรายการเมื่อต้องเปลี่ยนงาน" },
};

export function Preview({ variant, scenario, boss, idPrefix }: { variant: Variant; scenario: Case; boss: boolean; idPrefix: string }) {
  const order = getOrder(scenario);
  return <div className="@container min-w-0">{variant === "now" ? <CurrentE key={scenario} order={order} boss={boss} idPrefix={idPrefix} /> : <Workspace key={`${variant}-${scenario}-${boss}`} order={order} mode={variant} boss={boss} idPrefix={idPrefix} />}</div>;
}
