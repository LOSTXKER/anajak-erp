"use client";

import { useState } from "react";
import { MonitorSmartphone, MessageSquareWarning, MousePointerClick } from "lucide-react";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventsColumn, GarmentColumn, ItemsColumn, OrderFactsColumn, PlanColumn, PrintsColumn } from "../work-order/_variants/tabs";
import { ProblemCard, WorkOrderHeader } from "../work-order/_pieces";
import { JARGON_FOLDED, JARGON_VISIBLE, chipCount, currentStep, stepsFor, type Variant } from "./_data";
import { StepDetail, StepList, TAB_LABELS } from "./_pieces";

export { OPTIONS, VALUES } from "./_data";
export type { Variant };

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-2xs font-medium uppercase tracking-wide text-muted">{children}</p>;
}

/** key ตาม variant/out ข้างนอก → ขั้นที่เลือกรีเซ็ตเองเมื่อสลับทาง */
export function Preview({ variant, out, boss, initial }: { variant: Variant; out: boolean; boss: boolean; initial?: string }) {
  return <PreviewInner key={`${variant}-${out ? 1 : 0}`} variant={variant} out={out} boss={boss} initial={initial} />;
}

function PreviewInner({ variant, out, boss, initial }: { variant: Variant; out: boolean; boss: boolean; initial?: string }) {
  const steps = stepsFor(out);
  const [selectedId, setSelectedId] = useState(() => initial ?? currentStep(steps).id);
  const selected = steps.find((s) => s.id === selectedId) ?? steps[0]!;
  const problems = steps.filter((s) => s.problem);
  const chips = chipCount(variant, steps, selected);
  const jargon = JARGON_VISIBLE[variant];
  const folded = JARGON_FOLDED[variant];
  const tabs = TAB_LABELS[variant];

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <Label>ตัวเลขที่ต้องเห็นก่อนตัดสิน — แท็บขั้นงาน ใบตัวอย่าง {steps.length} ขั้น</Label>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="card-surface rounded-2xl p-4">
            <Metric label="ชิป/ป้ายที่เห็นทันที" value={chips} unit="อัน" size="lg" icon={MonitorSmartphone} tone={chips > 12 ? "warning" : "default"} />
          </div>
          <div className="card-surface rounded-2xl p-4">
            <Metric label="กดเพิ่มถึงจะเห็นครบ" value={variant === "fold" ? 1 : 0} unit={variant === "fold" ? "ครั้งต่อขั้น" : "ครั้ง"} size="lg" icon={MousePointerClick} tone={variant === "fold" ? "default" : "muted"} />
          </div>
          <div className="card-surface rounded-2xl p-4 lg:col-span-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <MessageSquareWarning className="h-4 w-4" aria-hidden="true" /> ศัพท์ภายในที่ทีมผลิตเห็นทันที ({jargon.length})
            </p>
            <InfoChipRow className="mt-2">
              {jargon.length === 0 ? <InfoChip size="md" tone="success">ไม่มี</InfoChip> : null}
              {jargon.map((j) => (
                <InfoChip key={j} size="md" tone="warning">
                  {j}
                </InfoChip>
              ))}
              {folded.map((j) => (
                <InfoChip key={j} size="md">
                  {j} (พับไว้)
                </InfoChip>
              ))}
            </InfoChipRow>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <Label>ใบผลิต — โครง D เดิมทั้งใบ เปลี่ยนเฉพาะในแท็บขั้นงาน</Label>
        <div className="space-y-6">
          <WorkOrderHeader steps={steps} />
          {problems.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {problems.map((s) => (
                <ProblemCard key={s.id} step={s} />
              ))}
            </div>
          ) : null}
          <Tabs defaultValue="steps" className="space-y-6">
            <TabsBar>
              <TabsList aria-label="ส่วนของใบผลิต">
                <TabsTrigger value="steps" hasPending={problems.length > 0}>
                  ขั้นงาน
                </TabsTrigger>
                <TabsTrigger value="make">{tabs.make}</TabsTrigger>
                <TabsTrigger value="info">{tabs.info}</TabsTrigger>
                <TabsTrigger value="history">ประวัติ</TabsTrigger>
              </TabsList>
            </TabsBar>
            <TabsContent value="steps">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
                <StepList variant={variant} steps={steps} selected={selected.id} boss={boss} onSelect={setSelectedId} />
                <StepDetail variant={variant} step={selected} boss={boss} />
              </div>
            </TabsContent>
            <TabsContent value="make">
              <div className="grid gap-5 lg:grid-cols-2">
                <ItemsColumn />
                <PrintsColumn />
              </div>
            </TabsContent>
            <TabsContent value="info">
              <div className="grid gap-5 lg:grid-cols-2">
                <OrderFactsColumn />
                <GarmentColumn />
              </div>
            </TabsContent>
            <TabsContent value="history">
              <div className="grid gap-5 lg:grid-cols-2">
                <EventsColumn />
                <PlanColumn />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}
