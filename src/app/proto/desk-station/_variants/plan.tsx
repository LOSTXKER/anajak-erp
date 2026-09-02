"use client";

/**
 * A · คงโครง D — แท็บ 4 แท็บ + 2 คอลัมน์เหมือนเดิม แต่คอลัมน์ขวาของแท็บขั้นงาน
 * เปลี่ยนจาก "โซนลงมือ" เป็น "การ์ดที่ยืน" (งานอยู่ไหน ใครถือ + ปุ่มวางแผน + ไปทำที่จอสถานี)
 * แท็บอื่นเหมือน D ทุกอย่าง (import จากหน้าลองใบผลิตเดิม)
 */

import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Section } from "@/components/ui/section";
import { Fact, FactList } from "@/components/ui/fact";
import { Metric } from "@/components/ui/metric";
import { currentStep } from "../../work-order/_data";
import { OutsourceFacts, OwnerText, ProblemCard, StepStateChip } from "../../work-order/_pieces";
import { EventsColumn, GarmentColumn, ItemsColumn, OrderFactsColumn, PlanColumn, PrintsColumn, StepPicker, TABS } from "../../work-order/_variants/tabs";
import { STEPS, type WorkStep } from "../_data";
import { DeskHeader, WhereCard } from "../_pieces";

function StepPlanDetail({ step, boss }: { step: WorkStep; boss: boolean }) {
  return (
    <Section title={`ขั้น ${step.order} · ${step.label}`} meta={<StepStateChip step={step} size="md" />} action={<OwnerText step={step} />} tone="production">
      <div className="space-y-5">
        {step.problem ? <ProblemCard step={step} /> : null}
        <FactList columns={3}>
          <div>
            <Metric label="ทำแล้ว" value={step.qtyDone.toLocaleString("th-TH")} unit={`/ ${step.qtyTotal.toLocaleString("th-TH")} ตัว`} size="lg" tone={step.qtyDone >= step.qtyTotal ? "success" : "default"} />
          </div>
          <Fact icon={CalendarCheck} label="ควรเสร็จ" value={step.planEnd} />
          <Fact label={step.completedAt ? "เสร็จจริง" : "เริ่มเมื่อ"} value={step.completedAt ?? step.startedAt ?? "ยังไม่เริ่ม"} tone={step.startedAt ? "default" : "muted"} />
        </FactList>
        {step.outsource ? <OutsourceFacts step={step} /> : null}
        {step.note ? <p className="text-sm text-secondary">{step.note}</p> : null}
        <WhereCard step={step} boss={boss} />
      </div>
    </Section>
  );
}

export function PlanVariant({ boss }: { boss: boolean }) {
  const [selected, setSelected] = useState<string>(() => currentStep(STEPS).id);
  const step = STEPS.find((s) => s.id === selected) ?? STEPS[0]!;
  const problems = STEPS.filter((s) => s.problem);
  const twoCol = "grid gap-5 lg:grid-cols-2";

  return (
    <div className="space-y-6">
      <DeskHeader boss={boss} />
      {problems.length > 0 ? (
        <div className={twoCol}>
          {problems.map((s) => (
            <ProblemCard key={s.id} step={s} />
          ))}
        </div>
      ) : null}

      <Tabs defaultValue="steps" className="space-y-6">
        <TabsBar>
          <TabsList aria-label="ส่วนของใบผลิต">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} hasPending={tab.value === "steps" && problems.length > 0}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </TabsBar>

        <TabsContent value="steps">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <StepPicker selected={selected} onSelect={setSelected} />
            <StepPlanDetail step={step} boss={boss} />
          </div>
        </TabsContent>
        <TabsContent value="make">
          <div className={twoCol}>
            <ItemsColumn />
            <PrintsColumn />
          </div>
        </TabsContent>
        <TabsContent value="info">
          <div className={twoCol}>
            <OrderFactsColumn />
            <GarmentColumn />
          </div>
        </TabsContent>
        <TabsContent value="history">
          <div className={twoCol}>
            <EventsColumn />
            <PlanColumn />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
