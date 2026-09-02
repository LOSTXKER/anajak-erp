"use client";

import { TabsVariant } from "../work-order/_variants/tabs";
import { PlanVariant } from "./_variants/plan";
import { TableVariant } from "./_variants/table";

export const OPTIONS = [
  { value: "now", label: "ปัจจุบัน · D มีปุ่มลงมือ" },
  { value: "plan", label: "A · คงโครง D แทนด้วยที่ยืน" },
  { value: "table", label: "B · ตารางแผนทั้งใบ" },
] as const;

export type Variant = (typeof OPTIONS)[number]["value"];
export const VALUES = OPTIONS.map((option) => option.value) as readonly Variant[];

export function Preview({ variant, boss }: { variant: Variant; boss: boolean }) {
  if (variant === "now") return <TabsVariant touch={false} />;
  if (variant === "plan") return <PlanVariant boss={boss} />;
  return <TableVariant boss={boss} />;
}
