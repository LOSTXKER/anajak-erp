"use client";

import { SAMPLES, StepFrame, ZoneA, ZoneB, ZoneNow, headerActionB } from "./_pieces";

export const OPTIONS = [
  { value: "now", label: "ปัจจุบัน · 4 ปุ่มเท่ากัน" },
  { value: "menu", label: "A · หนึ่งปุ่มหลัก + เมนูรวม" },
  { value: "head", label: "B · ปุ่มหลักขึ้นหัวการ์ด" },
] as const;

export type Variant = (typeof OPTIONS)[number]["value"];
export const VALUES = OPTIONS.map((option) => option.value) as readonly Variant[];

export function Preview({ variant, boss }: { variant: Variant; boss: boolean }) {
  return (
    <ul className="grid gap-5 xl:grid-cols-2">
      {SAMPLES.map((step) => (
        <li key={step.key} className="space-y-1.5">
          <p className="text-2xs font-medium uppercase tracking-wide text-muted">{step.label}</p>
          {variant === "head" ? (
            <StepFrame step={step} headerAction={headerActionB(step, boss)}>
              <ZoneB step={step} boss={boss} />
            </StepFrame>
          ) : (
            <StepFrame step={step}>{variant === "now" ? <ZoneNow step={step} boss={boss} /> : <ZoneA step={step} boss={boss} />}</StepFrame>
          )}
        </li>
      ))}
    </ul>
  );
}
