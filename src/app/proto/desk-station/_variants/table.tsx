"use client";

/**
 * B · ตารางแผนทั้งใบ — พอไม่มีปุ่มลงมือแล้ว แท็บขั้นงานไม่ต้องแบ่ง 2 คอลัมน์อีก
 * ทุกขั้นเป็นแถวในตารางเดียว (ขั้น · สถานี · คนทำ · ยอด · ควรเสร็จ · ตอนนี้อยู่ไหน) เหมือนหน้าการผลิตที่เบสเคาะ
 * ไม่มีปุ่มในแถว · กดแถวแล้วรายละเอียดโผล่ที่ไหน = ตัวเลือก `detail` (เบสทัก 09-03 "ใต้ตารางไม่ดีมั้ง")
 *   row    = กางใต้แถวที่กด (ตารางยืดลง แถวอื่นขยับตาม)
 *   dialog = หน้าต่างเด้งกลางจอ ปิดแล้วกลับมาตารางเดิม
 *   below  = แถบใต้ตาราง (แบบแรกที่เบสไม่ชอบ — เก็บไว้เทียบ)
 * แท็บอื่นเหมือน D ทุกอย่าง
 */

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Section } from "@/components/ui/section";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoChip } from "@/components/ui/info-chip";
import { SUNK_PANEL } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { currentStep } from "../../work-order/_data";
import { OutsourceFacts, ProblemCard, StepQty, StepStateChip } from "../../work-order/_pieces";
import { EventsColumn, GarmentColumn, ItemsColumn, OrderFactsColumn, PlanColumn, PrintsColumn, TABS } from "../../work-order/_variants/tabs";
import { STEPS, whereabouts, type WorkStep } from "../_data";
import { DeskHeader, StationChip, WhereCard } from "../_pieces";

export type DetailMode = "row" | "dialog" | "below";

const COLS = 7;

/** เนื้อในของรายละเอียดขั้น — ชุดเดียวกันทั้ง 3 ที่โผล่ */
function StepDetailBody({ step, boss }: { step: WorkStep; boss: boolean }) {
  return (
    <div className="space-y-4">
      {step.problem ? <ProblemCard step={step} /> : null}
      {step.outsource ? <OutsourceFacts step={step} /> : null}
      <WhereCard step={step} boss={boss} compact />
    </div>
  );
}

function PlanTable({ selected, onSelect, detail, boss }: { selected: string | null; onSelect: (id: string) => void; detail: DetailMode; boss: boolean }) {
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
          const open = on && detail === "row";
          const w = whereabouts(step);
          return (
            <Fragment key={step.id}>
              <DataTable.Row
                onClick={() => onSelect(step.id)}
                aria-selected={on}
                aria-expanded={detail === "row" ? open : undefined}
                className={cn("cursor-pointer", on && detail !== "dialog" && "bg-interactive-selected", step.state === "blocked" && !on && "bg-red-50/40 dark:bg-red-950/15")}
              >
                <DataTable.Td>
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-medium tabular-nums text-muted">{step.order}</span>
                    <div className="min-w-0">
                      <p className={cn("truncate", on && detail !== "dialog" ? "font-semibold text-strong" : "font-medium text-strong")}>{step.label}</p>
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
                  {detail === "row" ? (
                    <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", open ? "rotate-180 text-strong" : "text-muted")} aria-hidden="true" />
                  ) : (
                    <ChevronRight className={cn("ml-auto h-4 w-4", on && detail !== "dialog" ? "text-strong" : "text-muted")} aria-hidden="true" />
                  )}
                </DataTable.Td>
              </DataTable.Row>
              {open ? (
                <tr className={SUNK_PANEL}>
                  <td colSpan={COLS} className="px-4 py-4 sm:px-6">
                    <div className="max-w-4xl">
                      <StepDetailBody step={step} boss={boss} />
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </DataTable.Body>
    </DataTable.Root>
  );
}

function SelectedStrip({ step, boss }: { step: WorkStep; boss: boolean }) {
  return (
    <Section title={`ขั้น ${step.order} · ${step.label}`} meta={<StepStateChip step={step} size="md" />} tone="production">
      <StepDetailBody step={step} boss={boss} />
    </Section>
  );
}

function StepDialog({ step, boss, onClose }: { step: WorkStep | null; boss: boolean; onClose: () => void }) {
  return (
    <Dialog open={!!step} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-2xl">
        {step ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                ขั้น {step.order} · {step.label}
                <StepStateChip step={step} size="md" />
              </DialogTitle>
              <DialogDescription>{whereabouts(step).headline}</DialogDescription>
            </DialogHeader>
            <StepDetailBody step={step} boss={boss} />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function TableVariant({ boss, detail = "row" }: { boss: boolean; detail?: DetailMode }) {
  // แบบหน้าต่างเด้ง: เปิดหน้ามายังไม่เลือกอะไร (ไม่ให้เด้งใส่หน้าคนตั้งแต่โหลด) · แบบอื่นเลือกขั้นที่ต้องทำตอนนี้ให้ก่อน
  const [selected, setSelected] = useState<string | null>(() => (detail === "dialog" ? null : currentStep(STEPS).id));
  const step = selected ? (STEPS.find((s) => s.id === selected) ?? null) : null;
  const problems = STEPS.filter((s) => s.problem);
  const twoCol = "grid gap-5 lg:grid-cols-2";
  const select = (id: string) => setSelected(detail === "row" && id === selected ? null : id);

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
            <PlanTable selected={selected} onSelect={select} detail={detail} boss={boss} />
            {detail === "below" && step ? <SelectedStrip step={step} boss={boss} /> : null}
          </div>
          {detail === "dialog" ? <StepDialog step={step} boss={boss} onClose={() => setSelected(null)} /> : null}
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
