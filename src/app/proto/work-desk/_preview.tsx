"use client";

import { TabsVariant } from "../work-order/_variants/tabs";
import { DeskPanelVariant } from "./_variants/desk-panel";
import { TableVariant } from "./_variants/table";

export const OPTIONS = [
  { value: "now", label: "ปัจจุบัน · ใบผลิต D" },
  { value: "table", label: "A · ตารางขั้นงาน กางแถวแล้วทำ" },
  { value: "panel", label: "B · โต๊ะงาน + แผงข้าง" },
] as const;

export type Variant = (typeof OPTIONS)[number]["value"];
export const VALUES = OPTIONS.map((option) => option.value) as readonly Variant[];

export function Preview({ variant, boss }: { variant: Variant; boss: boolean }) {
  if (variant === "now") return <TabsVariant touch={false} />;
  if (variant === "table") return <TableVariant boss={boss} />;
  return <DeskPanelVariant boss={boss} />;
}
