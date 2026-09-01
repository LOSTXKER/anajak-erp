"use client";

/* สี่แบบที่กำลังเทียบ — "ของจริงตอนนี้" กับสามทางที่ลดของบนหน้าคนละวิธี
   ทุกแบบมีของครบเท่าของจริง ไม่มีอะไรถูกตัดทิ้งเงียบ ๆ — ที่ย้ายไปอยู่ที่ไหน
   เขียนบอกไว้ในหน้าเทียบ (page.tsx → WHERE_THINGS_GO) */

import { useState } from "react";
import { AlertTriangle, ClipboardCheck, History, PackageCheck } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  openExceptionCount,
  totalQuantity,
  type DensityWorkOrder,
} from "./_data";
import {
  EventLedger,
  ExceptionLedger,
  FreshnessRow,
  IdentityStrip,
  QuantityForStep,
  QuantityLedger,
  ReferenceControl,
  RouteSection,
  WorkPanel,
} from "./_sections";

function useSelectedStep(workOrder: DensityWorkOrder) {
  const first =
    workOrder.operations.find((step) => step.commands.length > 0) ??
    workOrder.operations[0] ??
    null;
  const [id, setId] = useState<string | null>(first?.id ?? null);
  const operation = workOrder.operations.find((step) => step.id === id) ?? null;
  return { id, setId, operation };
}

/* ════════════════════════════════ ปัจจุบัน — ทุกกองเรียงลงมาทั้งหมด */

export function CurrentVariant({ workOrder }: { workOrder: DensityWorkOrder }) {
  const { id, setId, operation } = useSelectedStep(workOrder);
  return (
    <div className="space-y-5">
      <FreshnessRow />
      <IdentityStrip workOrder={workOrder} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <RouteSection workOrder={workOrder} selectedId={id} onSelect={setId} />
        <div className="space-y-5">
          <WorkPanel workOrder={workOrder} operation={operation} />
          <ReferenceControl workOrder={workOrder} />
        </div>
      </div>
      <QuantityLedger workOrder={workOrder} />
      <ExceptionLedger workOrder={workOrder} />
      <EventLedger workOrder={workOrder} />
    </div>
  );
}

/* ════════════════════════════ A — ท้ายหน้าสามกองยุบเป็นกล่องเดียวสลับดู */

export function TabsVariant({ workOrder }: { workOrder: DensityWorkOrder }) {
  const { id, setId, operation } = useSelectedStep(workOrder);
  const open = openExceptionCount(workOrder);
  return (
    <div className="space-y-5">
      <FreshnessRow />
      <IdentityStrip workOrder={workOrder} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <RouteSection workOrder={workOrder} selectedId={id} onSelect={setId} />
        <div className="space-y-5">
          <WorkPanel workOrder={workOrder} operation={operation} />
          <ReferenceControl workOrder={workOrder} />
        </div>
      </div>

      <Section
        title="ข้อมูลของใบนี้"
        meta="ของเดิมสามกองเรียงลงมา — รวมเป็นกล่องเดียว กดสลับดูทีละอย่าง"
      >
        <Tabs defaultValue={open > 0 ? "problems" : "quantity"}>
          <div className="border-b border-divider">
            <TabsList>
              <TabsTrigger value="quantity">
                <PackageCheck className="h-4 w-4" aria-hidden />
                จำนวน ({workOrder.quantityLines.length})
              </TabsTrigger>
              <TabsTrigger
                value="problems"
                hasPending={open > 0}
                aria-label={`ปัญหา ${workOrder.exceptions.length} รายการ${open > 0 ? " · มีที่ยังไม่จบ" : ""}`}
              >
                <AlertTriangle className="h-4 w-4" aria-hidden />
                ปัญหา ({workOrder.exceptions.length})
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-4 w-4" aria-hidden />
                ประวัติ ({workOrder.events.length})
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="quantity" className="pt-4">
            <QuantityLedger workOrder={workOrder} />
          </TabsContent>
          <TabsContent value="problems" className="pt-4">
            <ExceptionLedger workOrder={workOrder} bare />
          </TabsContent>
          <TabsContent value="history" className="pt-4">
            <EventLedger workOrder={workOrder} bare />
          </TabsContent>
        </Tabs>
      </Section>
    </div>
  );
}

/* ══════════════════ B — ผังคือรายการ · ของของขั้นไหนไปอยู่กับขั้นนั้น */

export function ContextVariant({ workOrder }: { workOrder: DensityWorkOrder }) {
  const { id, setId, operation } = useSelectedStep(workOrder);
  const blocking = workOrder.exceptions.filter((item) => item.status.tone === "danger");
  const stepEvents = operation
    ? workOrder.events.filter((event) => event.stepName === operation.name)
    : [];
  const stepProblems = operation
    ? workOrder.exceptions.filter((item) => item.stepName === operation.name)
    : [];

  return (
    <div className="space-y-5">
      {blocking.map((item) => (
        <Alert key={item.id} variant="error" title={item.title}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {item.description} · ค้างที่ขั้น{" "}
              <span className="font-medium">{item.stepName}</span> ตั้งแต่ {item.createdAt}
            </span>
            <Button variant="outline" size="sm">
              จัดการปัญหานี้
            </Button>
          </span>
        </Alert>
      ))}

      {/* หัวใบยุบเหลือบรรทัดเดียว — เลขใบกับชื่อลูกค้าอยู่บนหัวหน้าอยู่แล้ว */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary">
        <span>
          กำหนดส่ง <span className="font-medium text-strong">{workOrder.deadline}</span>
        </span>
        <span aria-hidden className="text-muted">
          ·
        </span>
        <span>ความสำคัญ {workOrder.priorityLabel}</span>
        <span aria-hidden className="text-muted">
          ·
        </span>
        <span className="tabular-nums">
          {totalQuantity(workOrder).toLocaleString("th-TH")} ตัว
        </span>
        <span aria-hidden className="text-muted">
          ·
        </span>
        <span>ฉบับข้อมูล {workOrder.revision}</span>
        <span className="ml-auto text-xs text-muted">อัปเดตล่าสุด 12 วินาทีที่แล้ว</span>
      </div>

      {/* ลำดับใน DOM = ผัง → แผงลงมือ → ของทั้งใบ เพื่อให้จอแคบเจอ "งานที่ต้องทำ" ก่อน
          ส่วนบนจอกว้างสั่งตำแหน่งด้วย col/row ให้แผงลงมือยืนเต็มความสูงทางขวา */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)]">
        <RouteSection
          workOrder={workOrder}
          selectedId={id}
          onSelect={setId}
          withList={false}
        />
        <div className="xl:col-start-2 xl:row-span-2 xl:row-start-1">
        <WorkPanel
          workOrder={workOrder}
          operation={operation}
          extra={
            operation ? (
              <div className="space-y-4 border-t border-divider pt-4">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
                    จำนวนของขั้นนี้
                  </p>
                  <QuantityForStep workOrder={workOrder} operation={operation} />
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    ปัญหาของขั้นนี้
                  </p>
                  {stepProblems.length === 0 ? (
                    <p className="text-xs text-muted">ไม่มีปัญหาค้างที่ขั้นนี้</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {stepProblems.map((item) => (
                        <li key={item.id} className="flex justify-between gap-3">
                          <span className="text-secondary">{item.title}</span>
                          <span className="shrink-0 text-xs text-muted">
                            {item.status.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <History className="h-3.5 w-3.5" aria-hidden />
                    ประวัติของขั้นนี้
                  </p>
                  {stepEvents.length === 0 ? (
                    <p className="text-xs text-muted">ยังไม่มีประวัติของขั้นนี้</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {stepEvents.slice(0, 4).map((event) => (
                        <li key={event.id} className="flex justify-between gap-3">
                          <span className="text-secondary">{event.label}</span>
                          <span className="shrink-0 text-xs text-muted">{event.at}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null
          }
        />
        </div>
        {/* ของ "ทั้งใบ" ที่ไม่ผูกกับขั้นไหน — วางใต้ผัง ไม่ใช่กองท้ายหน้า */}
        <div className="grid items-start gap-5 lg:grid-cols-2 xl:col-start-1 xl:row-start-2">
          <ReferenceControl workOrder={workOrder} />
          <Section
            title="ประวัติทั้งใบ"
            icon={History}
            tone="system"
            meta="ของทุกขั้นรวมกัน · ของขั้นที่เลือกอยู่ในแผงข้าง ๆ แล้ว"
          >
            <EventLedger workOrder={workOrder} bare limit={5} />
          </Section>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ C — สองมุมใหญ่: มาทำงาน กับ มาดูข้อมูล แยกกันคนละแท็บ */

export function SplitVariant({ workOrder }: { workOrder: DensityWorkOrder }) {
  const { id, setId, operation } = useSelectedStep(workOrder);
  const open = openExceptionCount(workOrder);
  const blocking = workOrder.exceptions.filter((item) => item.status.tone === "danger");

  return (
    <Tabs defaultValue="work">
      <div className="border-b border-divider">
        <TabsList>
          <TabsTrigger value="work" hasPending={open > 0}>
            ลงมือทำ
          </TabsTrigger>
          <TabsTrigger value="record">ข้อมูลใบนี้</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="work" className="space-y-5 pt-5">
        {blocking.map((item) => (
          <Alert key={item.id} variant="error" title={item.title}>
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {item.description} · ค้างที่ขั้น{" "}
                <span className="font-medium">{item.stepName}</span>
              </span>
              <Button variant="outline" size="sm">
                จัดการปัญหานี้
              </Button>
            </span>
          </Alert>
        ))}
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)]">
          <RouteSection
            workOrder={workOrder}
            selectedId={id}
            onSelect={setId}
            withList={false}
          />
          <WorkPanel workOrder={workOrder} operation={operation} />
        </div>
      </TabsContent>

      <TabsContent value="record" className="space-y-5 pt-5">
        <FreshnessRow />
        <IdentityStrip workOrder={workOrder} />
        <ReferenceControl workOrder={workOrder} />
        <QuantityLedger workOrder={workOrder} />
        <ExceptionLedger workOrder={workOrder} />
        <EventLedger workOrder={workOrder} />
      </TabsContent>
    </Tabs>
  );
}

export const VARIANT_COMPONENTS = {
  current: CurrentVariant,
  tabs: TabsVariant,
  context: ContextVariant,
  split: SplitVariant,
} as const;

export type WorkOrderDensityVariant = keyof typeof VARIANT_COMPONENTS;
