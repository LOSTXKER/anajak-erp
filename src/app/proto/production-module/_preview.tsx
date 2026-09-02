"use client";

import { awaitingProduction, productionJobs } from "./_data";
import { DeskVariant } from "./_variants/desk";
import { FlowVariant } from "./_variants/flow";
import { RemovedVariant } from "./_variants/removed";
import { ScheduleVariant } from "./_variants/schedule";

export const OPTIONS = [
  { value: "removed", label: "ที่ถอดไป (สรุป)" },
  { value: "desk", label: "A · โต๊ะงานหัวหน้า" },
  { value: "flow", label: "B · สายพาน" },
  { value: "schedule", label: "C · ตารางเวลา" },
] as const;

export type Variant = (typeof OPTIONS)[number]["value"];
export const VALUES = OPTIONS.map((option) => option.value) as readonly Variant[];

export function Preview({
  variant,
  busy,
  station,
}: {
  variant: Variant;
  busy: boolean;
  station: boolean;
}) {
  const jobs = productionJobs(busy);
  const awaiting = awaitingProduction(busy).length;
  const props = { jobs, station, awaiting };

  if (variant === "removed") return <RemovedVariant />;
  if (variant === "desk") return <DeskVariant {...props} />;
  if (variant === "flow") return <FlowVariant {...props} />;
  return <ScheduleVariant {...props} />;
}
