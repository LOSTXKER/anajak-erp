"use client";

import { TabsVariant } from "../work-order/_variants/tabs";
import { PlanVariant } from "./_variants/plan";
import { TableVariant, type DetailMode } from "./_variants/table";

export const OPTIONS = [
  { value: "now", label: "ปัจจุบัน · D มีปุ่มลงมือ" },
  { value: "plan", label: "A · คงโครง D แทนด้วยที่ยืน" },
  { value: "table", label: "B · ตารางแผนทั้งใบ" },
] as const;

export type Variant = (typeof OPTIONS)[number]["value"];
export const VALUES = OPTIONS.map((option) => option.value) as readonly Variant[];

/** แบบ B เท่านั้น — กดแถวแล้วรายละเอียดโผล่ที่ไหน (เบสทัก 09-03 ว่าใต้ตารางไม่ดี) */
export const DETAIL_OPTIONS: readonly { value: DetailMode; label: string }[] = [
  { value: "row", label: "กางใต้แถวที่กด" },
  { value: "dialog", label: "หน้าต่างเด้ง" },
  { value: "below", label: "แถบใต้ตาราง (แบบแรก)" },
];
export const DETAIL_VALUES = DETAIL_OPTIONS.map((o) => o.value) as readonly DetailMode[];
export type { DetailMode };

export function Preview({ variant, boss, detail }: { variant: Variant; boss: boolean; detail: DetailMode }) {
  if (variant === "now") return <TabsVariant touch={false} />;
  if (variant === "plan") return <PlanVariant boss={boss} />;
  // key เปลี่ยนตามแบบ เพื่อให้ค่าเริ่มต้น (เลือกขั้นไหนไว้ก่อน) ถูกตั้งใหม่ตอนสลับ
  return <TableVariant key={detail} boss={boss} detail={detail} />;
}
