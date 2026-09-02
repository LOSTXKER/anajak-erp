"use client";

/**
 * B · ตารางแผนทั้งใบ — พอไม่มีปุ่มลงมือแล้ว แท็บขั้นงานไม่ต้องแบ่ง 2 คอลัมน์อีก
 * ทุกขั้นเป็นแถวในตารางเดียว (ขั้น · สถานี · คนทำ · ยอด · ควรเสร็จ · ตอนนี้อยู่ไหน) เหมือนหน้าการผลิตที่เบสเคาะ
 * กดแถว = การ์ดที่ยืนแบบย่อกางใต้ตาราง (ปุ่มวางแผน + ไปทำที่จอสถานี) · ไม่มีปุ่มในแถว
 * แท็บอื่นเหมือน D ทุกอย่าง
 */

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Section } from "@/components/ui/section";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoChip } from "@/components/ui/info-chip";
import { cn } from "@/lib/utils";
import { currentStep } from "../../work-order/_data";
import { OutsourceFacts, ProblemCard, StepQty, StepStateChip } from "../../work-order/_pieces";
import { EventsColumn, GarmentColumn, ItemsColumn, OrderFactsColumn, PlanColumn, PrintsColumn, TABS } from "../../work-order/_variants/tabs";
import { STEPS, whereabouts, type WorkStep } from "../_data";
import { DeskHeader, StationChip, WhereCard } from "../_pieces";

function PlanTable({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <DataTable.Root className="min-w-0 max-w-full [&_td]:px-3 [&_th:not([aria-sort])]:px-3">
      <DataTable.Head>
        <tr>
          <DataTable.Th>ขั้น</DataTable.Th>
          <DataTable.Th>สถานี</DataTable.Th>
          <DataTable.Th>คนทำ</DataTable.Th>
          <DataTable.Th align="right">ยอด</DataTable.Th>
          <DataTable.Th>ควรเสร็จ</DataTable.Th>
          <DataTable.Th>ตอนนี้อยู่ไหน</DataTable.Th>
          <DataTable.Th align="right">
            <span className="sr-only">ดูรายละเอียดขั้น</span>
          </DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body>
        {STEPS.map((step) => {
          const on = step.id === selected;
          const w = whereabouts(step);
          return (
            <DataTable.Row
              key={step.id}
              onClick={() => onSelect(step.id)}
              aria-selected={on}
              className={cn("cursor-pointer", on && "bg-interactive-selected", step.state === "blocked" && !on && "bg-red-50/40 dark:bg-red-950/15")}
            >
              <DataTable.Td>
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-medium tabular-nums text-muted">{step.order}</span>
                  <div className="min-w-0">
                    <p className={cn("truncate", on ? "font-semibold text-strong" : "font-medium text-strong")}>{step.label}</p>
                    <div className="mt-1">
                      <StepStateChip step={step} />
                    </div>
                  </div>
                </div>
              </DataTable.Td>
              <DataTable.Td className="whitespace-nowrap">
                <StationChip step={step} />
              </DataTable.Td>
              <DataTable.Td className="whitespace-nowrap">{step.owner ? <span className="text-strong">{step.owner}</span> : <span className="text-muted">ยังไม่มีคนรับ</span>}</DataTable.Td>
              <DataTable.Td align="right" className="whitespace-nowrap">
                <StepQty step={step} />
              </DataTable.Td>
              <DataTable.Td className="whitespace-nowrap">
                <InfoChip size="sm" tone={step.state === "blocked" ? "warning" : "neutral"}>
                  {step.planEnd}
                </InfoChip>
              </DataTable.Td>
              <DataTable.Td className="max-w-72">
                <p className={cn("truncate text-sm", w.tone === "error" ? "font-medium text-red-700 dark:text-red-300" : "text-secondary")}>{w.headline}</p>
              </DataTable.Td>
              <DataTable.Td align="right">
                <ChevronRight className={cn("ml-auto h-4 w-4", on ? "text-strong" : "text-muted")} aria-hidden="true" />
              </DataTable.Td>
            </DataTable.Row>
          );
        })}
      </DataTable.Body>
    </DataTable.Root>
  );
}

function SelectedStrip({ step, boss }: { step: WorkStep; boss: boolean }) {
  return (
    <Section title={`ขั้น ${step.order} · ${step.label}`} meta={<StepStateChip step={step} size="md" />} tone="production">
      <div className="space-y-4">
        {step.problem ? <ProblemCard step={step} /> : null}
        {step.outsource ? <OutsourceFacts step={step} /> : null}
        <WhereCard step={step} boss={boss} compact />
      </div>
    </Section>
  );
}

export function TableVariant({ boss }: { boss: boolean }) {
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
          <div className="space-y-5">
            <PlanTable selected={selected} onSelect={setSelected} />
            <SelectedStrip step={step} boss={boss} />
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
