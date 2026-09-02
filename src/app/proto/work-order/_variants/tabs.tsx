"use client";

/**
 * D · แท็บ + 2 คอลัมน์ — เบสสั่ง 2026-09-03 "อยากให้มีการแบ่งเป็นแท็บหน้า และข้อมูลแสดง 2 คอลัมน์"
 *
 * หัวใบ (ตัวเลข 4 ช่อง + การ์ดปัญหา) อยู่บนสุดทุกแท็บ → แถบแท็บ 4 แท็บ → เนื้อหาแต่ละแท็บวาง 2 คอลัมน์
 *   ขั้นงาน  : ซ้าย = รายการขั้นทั้งหมด (กดเลือก) · ขวา = ขั้นที่เลือก + โซนลงมือมาตรฐาน
 *   ทำอะไร   : ซ้าย = สินค้า/สี/ไซซ์ · ขวา = ลายและตำแหน่งพิมพ์ + ม็อกอัพอนุมัติ
 *   ข้อมูลใบ : ซ้าย = ข้อเท็จจริงของใบ · ขวา = เสื้อ/วัตถุดิบ + หมายเหตุ
 *   ประวัติ  : ซ้าย = เหตุการณ์ทั้งหมด · ขวา = แผน vs จริงต่อขั้น
 * ใช้ Tabs ตัวจริงชุดเดียวกับหน้าออเดอร์ (แท็บมีจุดแดงเมื่อมีของค้าง)
 */

import { useState } from "react";
import { CalendarCheck, ClipboardCheck, History, Shirt, Truck, Wrench } from "lucide-react";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Section } from "@/components/ui/section";
import { Alert } from "@/components/ui/alert";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { cn } from "@/lib/utils";
import { BigMockup } from "../../_kit/pieces";
import { EVENTS, ITEMS, STEPS, STEP_TONE, WORK_ORDER, currentStep, type WorkStep } from "../_data";
import {
  OutsourceFacts,
  OwnerText,
  ProblemCard,
  StepQty,
  StepStateChip,
  StepWorkZone,
  WorkOrderHeader,
} from "../_pieces";

/* ───────────────────────── แท็บ ขั้นงาน ───────────────────────── */

export function StepPicker({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <Section title="ขั้นงานทั้งหมด" meta={`${STEPS.filter((s) => s.state === "done").length}/${STEPS.length} ผ่านแล้ว`} icon={Wrench} tone="production" flush>
      <ol className="divide-y divide-divider">
        {STEPS.map((step) => {
          const on = step.id === selected;
          return (
            <li key={step.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(step.id)}
                className={cn(
                  "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-interactive-hover",
                  on && "bg-interactive-selected",
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-medium tabular-nums text-muted">
                  {step.order}
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-sm", on ? "font-semibold text-strong" : "font-medium text-strong")}>{step.label}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StepStateChip step={step} />
                    {step.owner ? <InfoChip size="sm">{step.owner}</InfoChip> : null}
                    {step.problem ? (
                      <InfoChip size="sm" tone="error" strong>
                        มีปัญหา
                      </InfoChip>
                    ) : null}
                  </span>
                </span>
                <StepQty step={step} />
              </button>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function StepDetail({ step, touch }: { step: WorkStep; touch: boolean }) {
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
        <StepWorkZone step={step} touch={touch} />
      </div>
    </Section>
  );
}

/* ───────────────────────── แท็บ ทำอะไร ───────────────────────── */

export function ItemsColumn() {
  return (
    <Section title="สินค้า สี ไซซ์" meta={`${ITEMS.length} รายการ · ${WORK_ORDER.qty} ตัว`} icon={Shirt} tone="product">
      <ul className="divide-y divide-divider">
        {ITEMS.map((item) => {
          const qty = item.sizes.reduce((sum, s) => sum + s.qty, 0);
          return (
            <li key={item.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
              <BigMockup src={item.mockup} alt={`ม็อกอัพ ${item.color}`} className="h-14 w-14 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="font-medium text-strong">
                    {item.product} <span className="text-secondary">· {item.color}</span>
                  </p>
                  <Metric value={qty} unit="ตัว" size="sm" />
                </div>
                <InfoChipRow className="mt-1.5">
                  {item.sizes.map((s) => (
                    <InfoChip key={s.size} size="sm">
                      {s.size} <span className="font-semibold">{s.qty}</span>
                    </InfoChip>
                  ))}
                </InfoChipRow>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

export function PrintsColumn() {
  const prints = ITEMS.flatMap((item) => item.prints.map((p) => ({ ...p, color: item.color, mockup: item.mockup })));
  const unique = prints.filter((p, i) => prints.findIndex((q) => q.position === p.position && q.technique === p.technique) === i);
  return (
    <Section title="ลายและตำแหน่งพิมพ์" meta={`ม็อกอัพอนุมัติ ${WORK_ORDER.approvedMockup.version} · ${WORK_ORDER.approvedMockup.approvedOn} โดย ${WORK_ORDER.approvedMockup.by}`} icon={ClipboardCheck} tone="production">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <FactList columns={1}>
          {unique.map((p) => (
            <Fact key={`${p.position}-${p.technique}`} label={`${p.position} · ${p.technique}`} value={p.size} sub={p.note} />
          ))}
        </FactList>
        <BigMockup src={ITEMS[0]!.mockup} alt="ม็อกอัพอนุมัติ" className="h-36 w-36" />
      </div>
    </Section>
  );
}

/* ───────────────────────── แท็บ ข้อมูลใบ ───────────────────────── */

export function OrderFactsColumn() {
  return (
    <Section title="ออเดอร์และสูตร" icon={ClipboardCheck} tone="production">
      <FactList columns={2}>
        <Fact label="ลูกค้า" value={WORK_ORDER.company} sub={`ผู้ติดต่อ ${WORK_ORDER.contact}`} />
        <Fact label="ช่องทาง" value={WORK_ORDER.channel} />
        <Fact label="สูตรขั้นงาน" value={WORK_ORDER.routingName} className="sm:col-span-2" />
        <Fact label="กำหนดส่ง" value={WORK_ORDER.dueLabel} sub={`อีก ${WORK_ORDER.dueInDays} วัน`} tone="warning" icon={CalendarCheck} />
        <Fact label="ความสำคัญ" value={WORK_ORDER.priority === "HIGH" ? "สำคัญ" : "ปกติ"} />
      </FactList>
    </Section>
  );
}

export function GarmentColumn() {
  const g = WORK_ORDER.garment;
  const outs = STEPS.filter((s) => s.outsource);
  return (
    <div className="space-y-5">
      <Section title="เสื้อและวัตถุดิบ" icon={Shirt} tone="product">
        <FactList columns={3}>
          <div>
            <Metric label="ต้องใช้" value={g.needed} unit="ตัว" size="md" />
          </div>
          <div>
            <Metric label="เบิกแล้ว" value={g.issued} unit="ตัว" size="md" />
          </div>
          <div>
            <Metric label="ยังขาด" value={g.missing} unit="ตัว" size="md" tone={g.missing > 0 ? "warning" : "success"} />
          </div>
        </FactList>
        <FactList columns={1} className="mt-4">
          <Fact label="แหล่งเสื้อ" value={g.source} />
          {g.missing > 0 ? <Fact label="ที่ขาด" value={g.missingDetail} tone="warning" /> : null}
        </FactList>
      </Section>
      <Section title="งานร้านนอกในใบนี้" icon={Truck} tone="production" meta={`${outs.length} งาน`}>
        <ul className="divide-y divide-divider">
          {outs.map((s) => (
            <li key={s.id} className="py-3 first:pt-0 last:pb-0">
              <OutsourceFacts step={s} />
            </li>
          ))}
        </ul>
      </Section>
      {WORK_ORDER.note ? (
        <Alert variant="warning" title="หมายเหตุจากใบงาน">
          {WORK_ORDER.note}
        </Alert>
      ) : null}
    </div>
  );
}

/* ───────────────────────── แท็บ ประวัติ ───────────────────────── */

export function EventsColumn() {
  return (
    <Section title="เหตุการณ์ทั้งหมด" icon={History} tone="system" meta={`${EVENTS.length} รายการ`}>
      <ol className="space-y-3">
        {EVENTS.map((event) => (
          <li key={event.at + event.what} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 text-sm">
            <span className="text-xs tabular-nums text-muted">{event.at}</span>
            <span className="min-w-0">
              <span className="block text-strong">{event.what}</span>
              <InfoChip size="sm" tone={event.tone === "danger" ? "error" : event.tone === "success" ? "success" : "neutral"} className="mt-1">
                {event.who}
              </InfoChip>
            </span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function PlanColumn() {
  return (
    <Section title="แผน vs จริง ต่อขั้น" icon={CalendarCheck} tone="production">
      <ol className="divide-y divide-divider">
        {STEPS.map((step) => (
          <li key={step.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", STEP_TONE[step.state].bar)} />
            <span className="min-w-0">
              <span className="block truncate text-sm text-strong">{step.label}</span>
              <span className="block text-xs text-muted">{STEP_TONE[step.state].label}</span>
            </span>
            <InfoChipRow>
              <InfoChip size="sm">แผน {step.planEnd}</InfoChip>
              {step.completedAt ? (
                <InfoChip size="sm" tone="success">เสร็จ {step.completedAt}</InfoChip>
              ) : step.startedAt ? (
                <InfoChip size="sm" tone="info">เริ่ม {step.startedAt}</InfoChip>
              ) : null}
            </InfoChipRow>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ───────────────────────── หน้า ───────────────────────── */

export const TABS = [
  { value: "steps", label: "ขั้นงาน" },
  { value: "make", label: "ทำอะไร" },
  { value: "info", label: "ข้อมูลใบ" },
  { value: "history", label: "ประวัติ" },
] as const;

export function TabsVariant({ touch }: { touch: boolean }) {
  const [selected, setSelected] = useState<string>(() => currentStep(STEPS).id);
  const step = STEPS.find((s) => s.id === selected) ?? STEPS[0]!;
  const problems = STEPS.filter((s) => s.problem);
  const twoCol = "grid gap-5 lg:grid-cols-2";

  return (
    <div className="space-y-6">
      <WorkOrderHeader steps={STEPS} />
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
            <StepDetail step={step} touch={touch} />
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
