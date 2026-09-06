"use client";

import { useState } from "react";
import { FileText, MessageSquareWarning, MousePointerClick } from "lucide-react";
import { Metric } from "@/components/ui/metric";
import { WorkOrderD } from "../work-order-quiet/_preview";
import { currentStep, decisionNumbers, stepsFor, type Variant } from "./_data";
import { OneAtATime, PaperTwin } from "./_pieces";
import { FlowWizard } from "./_flow";

export { OPTIONS, VALUES } from "./_data";
export type { Variant };

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-2xs font-medium uppercase tracking-wide text-muted">{children}</p>;
}

export function Preview({ variant, out, boss, initial }: { variant: Variant; out: boolean; boss: boolean; initial?: string }) {
  return <PreviewInner key={`${variant}-${out ? 1 : 0}`} variant={variant} out={out} boss={boss} initial={initial} />;
}

function PreviewInner({ variant, out, boss, initial }: { variant: Variant; out: boolean; boss: boolean; initial?: string }) {
  const steps = stepsFor(out);
  const [selectedId, setSelectedId] = useState(() => initial ?? currentStep(steps).id);
  const selected = steps.find((s) => s.id === selectedId) ?? steps[0]!;
  const n = decisionNumbers(variant, steps);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <Label>ตัวเลขที่ต้องเห็นก่อนตัดสิน — ใบตัวอย่าง {steps.length} ขั้น</Label>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="card-surface rounded-2xl p-4">
            <Metric label="กดกี่ครั้งถึงเห็นครบทุกขั้น" value={n.clicksToSeeAll} unit="ครั้ง" size="lg" icon={MousePointerClick} tone={n.clicksToSeeAll === 0 ? "success" : "default"} />
          </div>
          <div className="card-surface rounded-2xl p-4">
            <Metric label="ศัพท์ภายในที่เห็นทันที" value={n.jargon} unit="คำ" size="lg" icon={MessageSquareWarning} tone={n.jargon === 0 ? "success" : "warning"} />
          </div>
          <div className="card-surface rounded-2xl p-4 lg:col-span-2">
            <Metric label="หน้าตาเหมือนใบสั่งงานที่ทีมถือ" value={n.likePaper} size="lg" icon={FileText} tone={n.likePaper === "ไม่" ? "muted" : "default"} />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <Label>
          {variant === "now" ? "ปัจจุบัน — หัวใบ 4 ช่อง แล้วแท็บ 4 แท็บ (แท็บขั้นงานเป็น 2 คอลัมน์)" : variant === "paper" ? "C — หน้าเดียวเลื่อนลงอ่านจบ วางเหมือนกระดาษ ไม่มีแท็บ" : variant === "one" ? "D — แถบขั้นบนสุด แล้วผืนใหญ่ขั้นเดียว (ทั้งใบพับไว้ท้าย)" : "E — แผนที่เส้นทาง (สายขนานคนละแถว) แล้วการ์ด “ตอนนี้ทำได้” สายละใบ"}
        </Label>
        {variant === "now" ? <WorkOrderD variant="now" steps={steps} selected={selected} boss={boss} onSelect={setSelectedId} /> : variant === "paper" ? <PaperTwin steps={steps} boss={boss} /> : variant === "one" ? <OneAtATime steps={steps} selected={selected} boss={boss} onSelect={setSelectedId} /> : <FlowWizard steps={steps} boss={boss} />}
      </section>
    </div>
  );
}
