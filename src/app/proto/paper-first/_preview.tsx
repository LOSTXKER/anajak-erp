"use client";

import { useState } from "react";
import { BatchForm, PAPER_DIFF, PaperTicket, StepDetail, StepList, TapSummary } from "./_pieces";
import { defaultStepId, stepsFor, type Variant } from "./_data";

export const OPTIONS = [
  { value: "now", label: "ปัจจุบัน · จอจดทุกขั้น + กระดาษเซ็นซ้ำ" },
  { value: "three", label: "A · กระดาษเป็นหลัก จอจด 3 จุด" },
  { value: "batch", label: "B · หัวหน้ากรอกจากกระดาษ" },
] as const;

export type { Variant };
export const VALUES = OPTIONS.map((option) => option.value) as readonly Variant[];

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-2xs font-medium uppercase tracking-wide text-muted">{children}</p>;
}

/** key ตาม variant/out ข้างนอก → state ขั้นที่เลือกกับฟอร์มรีเซ็ตเองเมื่อสลับทาง */
export function Preview({ variant, out, boss }: { variant: Variant; out: boolean; boss: boolean }) {
  return <PreviewInner key={`${variant}-${out ? 1 : 0}`} variant={variant} out={out} boss={boss} />;
}

function PreviewInner({ variant, out, boss }: { variant: Variant; out: boolean; boss: boolean }) {
  const steps = stepsFor(out);
  const [selectedId, setSelectedId] = useState(() => defaultStepId(variant, steps));
  const [formOpen, setFormOpen] = useState(false);
  const selected = steps.find((s) => s.id === selectedId) ?? steps[0]!;

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <Label>ตัวเลขที่ต้องเห็นก่อนตัดสิน — ใบตัวอย่าง ORD-2608-0061 · {steps.length} ขั้น</Label>
        <TapSummary variant={variant} steps={steps} />
      </section>

      <section className="space-y-2">
        <Label>ใบผลิต — แท็บขั้นงาน (ซ้าย รายการ · ขวา ขั้นที่เลือก + โซนลงมือ)</Label>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <StepList variant={variant} steps={steps} selected={selected.id} onSelect={setSelectedId} />
          <StepDetail variant={variant} step={selected} boss={boss} onOpenForm={() => setFormOpen(true)} />
        </div>
        {variant === "batch" && formOpen ? <BatchForm steps={steps} onClose={() => setFormOpen(false)} /> : null}
      </section>

      <section className="space-y-2">
        <Label>ใบสั่งงานกระดาษ — พิมพ์จากใบผลิต แล้วเดินไปกับกองเสื้อ</Label>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <PaperTicket variant={variant} steps={steps} />
          <div className="card-surface h-fit rounded-2xl p-4 text-sm">
            <p className="font-medium">กระดาษใบนี้ต่างจากที่พิมพ์ได้ตอนนี้ยังไง</p>
            <ul className="mt-2 space-y-1.5 text-xs text-secondary">
              {PAPER_DIFF[variant].map((item) => (
                <li key={item} className="flex gap-1.5">
                  <span aria-hidden="true" className="text-muted">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
