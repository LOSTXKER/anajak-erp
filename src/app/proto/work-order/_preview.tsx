"use client";

import { FocusVariant } from "./_variants/focus";
import { RemovedVariant } from "./_variants/removed";
import { TableVariant } from "./_variants/table";
import { TabsVariant } from "./_variants/tabs";
import { TimelineVariant } from "./_variants/timeline";

export const OPTIONS = [
  { value: "removed", label: "ที่ถอดไป (สรุป)" },
  { value: "tabs", label: "D · แท็บ + 2 คอลัมน์" },
  { value: "table", label: "A · ตารางขั้นงาน" },
  { value: "focus", label: "B · ตอนนี้ทำอะไร" },
  { value: "timeline", label: "C · ไทม์ไลน์" },
] as const;

export type Variant = (typeof OPTIONS)[number]["value"];
export const VALUES = OPTIONS.map((option) => option.value) as readonly Variant[];

export function Preview({ variant, touch }: { variant: Variant; touch: boolean }) {
  if (variant === "removed") return <RemovedVariant />;
  if (variant === "tabs") return <TabsVariant touch={touch} />;
  if (variant === "table") return <TableVariant touch={touch} />;
  if (variant === "focus") return <FocusVariant touch={touch} />;
  return <TimelineVariant touch={touch} />;
}
